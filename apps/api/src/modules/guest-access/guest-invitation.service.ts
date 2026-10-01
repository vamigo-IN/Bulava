import { Injectable } from '@nestjs/common';
import { authorizedFunctions, validateInvitationToken } from '@bulava/auth';
import type { Prisma, RSVPQuestionType } from '@bulava/database';
import { FEATURE_KEYS, type GuestTravelSelfInput, type RSVPSubmitInput } from '@bulava/validation';
import type { Customization, RenderContext, TemplateDefinition } from '@bulava/template-schema';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { AudienceService, type GuestAudienceFacts } from '../audience/audience.service';
import { InvitationTokenService } from '../invitations/invitation-token.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnnouncementsService } from '../announcements/announcements.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RenderContextService } from '../templates/render-context.service';
import { MediaService } from '../media/media.service';
import { CheckInService } from '../checkin/checkin.service';
import { LogisticsService } from '../logistics/logistics.service';
import { maskTarget, OtpService } from './otp.service';

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;
const OPEN_FOR_RSVP = new Set(['SCHEDULED', 'POSTPONED']);

type AnswerValue = string | number | boolean | string[];

export interface GuestQuestionDto {
  id: string;
  key: string;
  label: string;
  type: RSVPQuestionType;
  options: Array<{ value: string; label: string }>;
  required: boolean;
}

export interface GuestFunctionDto {
  id: string;
  name: string;
  description: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  status: string;
  venue: { name: string; address: string | null; city: string | null; mapUrl: string | null } | null;
  attendeeLimit: number;
  rsvpOpen: boolean;
  rsvp: { status: string; attendeeCount: number; answers: Record<string, unknown>; respondedAt: Date } | null;
  questions: GuestQuestionDto[];
  /** This guest's table at this function, if the host has seated them. */
  seat: { tableLabel: string; seatLabel: string | null } | null;
}

export interface GuestInvitationView {
  event: {
    title: string;
    typeKey: string;
    description: string | null;
    language: string;
    timezone: string;
    status: string;
    details: unknown;
  };
  guest: { name: string; preferredLanguage: string | null };
  scope: { functionId: string | null };
  functions: GuestFunctionDto[];
  /** Event-level RSVP, used when the invitation covers no specific functions. */
  eventRsvp: { status: string; attendeeCount: number; respondedAt: Date } | null;
  eventRsvpOpen: boolean;
  message: string | null;
  /** Website template chosen by the host (or the free default) and its render context. */
  template: { key: string; definition: TemplateDefinition; customization: Customization | null } | null;
  context: RenderContext;
  /** Show the "Made with Bulava" mark (free plan). */
  watermark: boolean;
  /** Photo rooms this guest may upload to / view. */
  mediaRooms: Array<{ name: string; code: string; uploadsEnabled: boolean; canViewGallery: boolean }>;
  /** Code for the guest check-in QR (event day). */
  checkInCode: string | null;
  /** This guest's own stay and travel details (never other guests'). */
  logistics: Omit<Awaited<ReturnType<LogisticsService['forGuest']>>, 'seats'>;
}

function localizedLabel(label: Prisma.JsonValue, language: string): string {
  if (label && typeof label === 'object' && !Array.isArray(label)) {
    const map = label as Record<string, unknown>;
    const value = map[language] ?? map.en ?? Object.values(map)[0];
    if (typeof value === 'string') return value;
  }
  return typeof label === 'string' ? label : '';
}

/**
 * Everything a guest can do with an invitation link.
 * The token is the credential: it is hashed, looked up, validated
 * (revocation, expiry, usage), and then the pure access evaluator decides
 * which functions the guest may see and RSVP to. Nothing the client sends
 * about guest, event or function identity is trusted.
 */
@Injectable()
export class GuestInvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audience: AudienceService,
    private readonly audit: AuditService,
    private readonly renderContext: RenderContextService,
    private readonly announcements: AnnouncementsService,
    private readonly entitlements: EntitlementsService,
    private readonly notifications: NotificationsService,
    private readonly analytics: AnalyticsService,
    private readonly media: MediaService,
    private readonly checkIns: CheckInService,
    private readonly otp: OtpService,
    private readonly logistics: LogisticsService,
  ) {}

  async view(token: string, otpPass?: string): Promise<GuestInvitationView> {
    const ctx = await this.resolve(token, otpPass);
    const firstOpen = !ctx.invitation.openedAt;
    await this.recordOpen(ctx);
    if (firstOpen) this.analytics.track('invitation_opened', { eventId: ctx.event.id, guestId: ctx.guest.id });
    return this.buildView(ctx);
  }

  /** The guest's own arrival/departure, when the host asks for it. */
  async submitTravel(token: string, input: GuestTravelSelfInput, meta: RequestMeta, otpPass?: string): Promise<GuestInvitationView> {
    const ctx = await this.resolve(token, otpPass);
    if (ctx.event.status !== 'ACTIVE') throw new AppError('FUNCTION_CLOSED', 'This event is closed.');
    await this.logistics.saveGuestTravel(ctx.event.id, ctx.guest.id, input, meta);
    return this.buildView(ctx);
  }

  async submitRsvp(token: string, input: RSVPSubmitInput, meta: RequestMeta, otpPass?: string): Promise<GuestInvitationView> {
    const ctx = await this.resolve(token, otpPass);
    if (ctx.event.status !== 'ACTIVE') throw new AppError('FUNCTION_CLOSED', 'RSVP is closed for this event.');

    const functionsById = new Map(ctx.functions.map((f) => [f.id, f]));
    const questions = await this.prisma.rSVPQuestion.findMany({
      where: { eventId: ctx.event.id, active: true },
      orderBy: { sortOrder: 'asc' },
    });

    const prepared = input.responses.map((response) => {
      let limit: number;
      if (response.functionId === null) {
        if (ctx.invitation.functionId !== null) {
          throw new AppError('FUNCTION_NOT_AUTHORIZED', 'This invitation is for a specific function.');
        }
        limit = Math.max(1, ...ctx.functions.map((f) => AudienceService.attendeeLimit(ctx.guestFacts, f.id)));
      } else {
        const fn = functionsById.get(response.functionId);
        if (!fn) throw new AppError('FUNCTION_NOT_AUTHORIZED', 'This invitation does not include that function.');
        if (!OPEN_FOR_RSVP.has(fn.status)) throw new AppError('FUNCTION_CLOSED', `RSVP is closed for ${fn.name}.`);
        limit = AudienceService.attendeeLimit(ctx.guestFacts, fn.id);
      }

      const attendeeCount = response.status === 'DECLINED' ? 0 : response.attendeeCount;
      if (response.status === 'ATTENDING' && attendeeCount < 1) {
        throw new AppError('ATTENDEE_LIMIT_EXCEEDED', 'At least one attendee is required.');
      }
      if (attendeeCount > limit) {
        throw new AppError('ATTENDEE_LIMIT_EXCEEDED', `Up to ${limit} attendees allowed.`, { functionId: response.functionId, limit });
      }

      const applicable = questions.filter((q) => q.functionId === null || q.functionId === response.functionId);
      const answers = this.validateAnswers(applicable, response.answers, response.status === 'ATTENDING');
      return { ...response, attendeeCount, answers };
    });

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const r of prepared) {
        const existing = await tx.rSVP.findFirst({
          where: { guestId: ctx.guest.id, functionId: r.functionId },
          select: { id: true },
        });
        const data = {
          status: r.status,
          attendeeCount: r.attendeeCount,
          message: input.message ?? null,
          respondedAt: now,
          invitationId: ctx.invitation.id,
        };
        const rsvp = existing
          ? await tx.rSVP.update({ where: { id: existing.id }, data })
          : await tx.rSVP.create({
              data: { ...data, eventId: ctx.event.id, guestId: ctx.guest.id, functionId: r.functionId, source: 'INVITATION' },
            });
        await tx.rSVPAnswer.deleteMany({ where: { rsvpId: rsvp.id } });
        if (r.answers.length > 0) {
          await tx.rSVPAnswer.createMany({
            data: r.answers.map((a) => ({ rsvpId: rsvp.id, questionId: a.questionId, value: a.value })),
          });
        }
        if (r.functionId) {
          await tx.functionGuest.updateMany({
            where: { guestId: ctx.guest.id, functionId: r.functionId },
            data: { rsvpStatus: r.status },
          });
        }
      }
      const anyAttending = prepared.some((r) => r.status === 'ATTENDING');
      const allDeclined = prepared.every((r) => r.status === 'DECLINED');
      await tx.invitation.update({
        where: { id: ctx.invitation.id },
        data: {
          status: 'RESPONDED',
          acceptedAt: anyAttending ? now : null,
          declinedAt: allDeclined ? now : null,
        },
      });
      await this.audit.record(
        {
          actorType: 'GUEST',
          actorId: ctx.guest.id,
          action: 'rsvp.submitted',
          targetType: 'Invitation',
          targetId: ctx.invitation.id,
          eventId: ctx.event.id,
          metadata: prepared.map((r) => ({ functionId: r.functionId, status: r.status, attendeeCount: r.attendeeCount })),
          meta,
        },
        tx,
      );
    });

    // Tell the hosts (in-app + email) and record the analytics event.
    const summary = prepared.map((r) => ({
      functionName: r.functionId ? (functionsById.get(r.functionId)?.name ?? '') : null,
      status: r.status,
      attendeeCount: r.attendeeCount,
    }));
    const owner = await this.prisma.user.findUnique({ where: { id: ctx.event.ownerId }, select: { id: true, email: true } });
    if (owner) {
      const payload = { guestName: ctx.guest.name, eventTitle: ctx.event.title, responses: summary };
      await this.notifications.notify({ type: 'RSVP_RECEIVED', channel: 'IN_APP', eventId: ctx.event.id, userId: owner.id, payload });
      if (owner.email) await this.notifications.notify({ type: 'RSVP_RECEIVED', channel: 'EMAIL', eventId: ctx.event.id, userId: owner.id, payload });
    }
    this.analytics.track('rsvp_completed', { eventId: ctx.event.id, guestId: ctx.guest.id }, { responses: prepared.length });

    return this.buildView(await this.resolve(token, otpPass));
  }

  /** OTP step for events whose policy requires identity confirmation. */
  async sendOtp(token: string) {
    const ctx = await this.resolve(token, undefined, { skipOtp: true });
    return this.otp.send(ctx.guest, ctx.event.title);
  }

  async verifyOtp(token: string, code: string) {
    const ctx = await this.resolve(token, undefined, { skipOtp: true });
    const target = ctx.guest.email ?? ctx.guest.phone;
    if (!target) throw new AppError('OTP_INVALID', 'Verification is not available for this invitation.');
    return this.otp.verify(ctx.guest.id, target, code);
  }

  // ─────────────────────────── internals ───────────────────────────

  private async resolve(token: string, otpPass?: string, options: { skipOtp?: boolean } = {}) {
    if (!TOKEN_SHAPE.test(token)) throw new AppError('INVITATION_INVALID', 'This invitation link is not valid.');

    const row = await this.prisma.invitationToken.findUnique({
      where: { tokenHash: InvitationTokenService.hash(token) },
      include: {
        invitation: { include: { guest: true } },
        event: { include: { accessPolicy: true } },
      },
    });
    if (!row || row.event.deletedAt || row.invitation.guest.deletedAt) {
      throw new AppError('INVITATION_INVALID', 'This invitation link is not valid.');
    }

    const validation = validateInvitationToken(row, row.invitation);
    if (!validation.ok) {
      const message = {
        INVITATION_REVOKED: 'This invitation is no longer active.',
        INVITATION_EXPIRED: 'This invitation has expired.',
        INVITATION_USAGE_EXCEEDED: 'This invitation link has already been used.',
      }[validation.code];
      throw new AppError(validation.code, message);
    }
    if (row.event.status === 'DRAFT') {
      throw new AppError('EVENT_NOT_PUBLISHED', 'This invitation is not available yet.');
    }
    const contact = row.invitation.guest.email ?? row.invitation.guest.phone;
    if (row.event.accessPolicy.requireOtp && contact && !options.skipOtp && !this.otp.verifyPass(row.invitation.guestId, otpPass)) {
      throw new AppError('OTP_REQUIRED', 'Please confirm it is you with a one-time code.', { target: maskTarget(contact), channel: row.invitation.guest.email ? 'EMAIL' : 'SMS' });
    }

    const [eventFacts, [guestFacts]] = await Promise.all([
      this.audience.loadEventFacts(row.eventId),
      this.audience.loadGuestFacts(row.eventId, [row.invitation.guestId]),
    ]);
    if (!guestFacts) throw new AppError('INVITATION_INVALID', 'This invitation link is not valid.');

    const viewer = AudienceService.viewerFor(guestFacts, row.invitation.functionId);
    const allowedIds = new Set(
      authorizedFunctions(eventFacts.functions, eventFacts.eventPolicy, viewer).map((f) => f.id),
    );
    const functions = await this.prisma.eventFunction.findMany({
      where: { id: { in: [...allowedIds] }, eventId: row.eventId, deletedAt: null },
      include: { venue: true },
      orderBy: [{ sortOrder: 'asc' }, { startsAt: 'asc' }],
    });

    return {
      tokenRow: row,
      invitation: row.invitation,
      guest: row.invitation.guest,
      event: row.event,
      guestFacts: guestFacts as GuestAudienceFacts,
      eventFacts,
      functions,
    };
  }

  private async recordOpen(ctx: Awaited<ReturnType<GuestInvitationService['resolve']>>): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      // Conditional increment keeps limited-use tokens correct under concurrency.
      const updated = await tx.invitationToken.updateMany({
        where: {
          id: ctx.tokenRow.id,
          revokedAt: null,
          ...(ctx.tokenRow.maxUses !== null ? { useCount: { lt: ctx.tokenRow.maxUses } } : {}),
        },
        data: { useCount: { increment: 1 }, lastUsedAt: now },
      });
      if (updated.count !== 1) {
        throw new AppError('INVITATION_USAGE_EXCEEDED', 'This invitation link has already been used.');
      }
      if (!ctx.invitation.openedAt) {
        await tx.invitation.update({
          where: { id: ctx.invitation.id },
          data: {
            openedAt: now,
            ...(ctx.invitation.status === 'ACTIVE' || ctx.invitation.status === 'SENT' ? { status: 'OPENED' } : {}),
          },
        });
        await tx.functionGuest.updateMany({
          where: {
            guestId: ctx.guest.id,
            invitationStatus: { not: 'OPENED' },
            ...(ctx.invitation.functionId ? { functionId: ctx.invitation.functionId } : {}),
          },
          data: { invitationStatus: 'OPENED' },
        });
      }
    });
  }

  private async buildView(ctx: Awaited<ReturnType<GuestInvitationService['resolve']>>): Promise<GuestInvitationView> {
    const language = ctx.guest.preferredLanguage ?? ctx.event.language;
    const [rsvps, questions] = await Promise.all([
      this.prisma.rSVP.findMany({
        where: { guestId: ctx.guest.id },
        include: { answers: { include: { question: { select: { key: true } } } } },
      }),
      this.prisma.rSVPQuestion.findMany({
        where: { eventId: ctx.event.id, active: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);
    const rsvpByFunction = new Map(rsvps.map((r) => [r.functionId ?? 'EVENT', r]));
    const eventOpen = ctx.event.status === 'ACTIVE';

    const toQuestion = (q: (typeof questions)[number]): GuestQuestionDto => ({
      id: q.id,
      key: q.key,
      label: localizedLabel(q.label, language),
      type: q.type,
      options: Array.isArray(q.options)
        ? (q.options as Array<{ value?: unknown; label?: Prisma.JsonValue }>)
            .filter((o) => typeof o?.value === 'string')
            .map((o) => ({ value: o.value as string, label: localizedLabel(o.label ?? (o.value as string), language) }))
        : [],
      required: q.required,
    });

    const eventRsvp = rsvpByFunction.get('EVENT');
    const guestViewer = { guest: ctx.guestFacts, event: ctx.eventFacts };
    const [template, announcements, features, mediaRooms, gallery, checkInCode] = await Promise.all([
      this.renderContext.resolveTemplate(ctx.event.id, ctx.event.typeKey, 'WEBSITE'),
      this.announcements.forGuest(ctx.event.id, ctx.guestFacts, ctx.eventFacts),
      this.entitlements.forEvent(ctx.event.id),
      this.media.roomsForGuest(ctx.event.id, ctx.guestFacts, ctx.eventFacts),
      this.media.galleryForTemplate(ctx.event.id, guestViewer),
      this.checkIns.codeForGuest(ctx.event.id, ctx.guest.id),
    ]);
    // Seats only for functions this guest may see (ctx.functions is already access-filtered).
    const { seats, ...logistics } = await this.logistics.forGuest(
      ctx.event.id,
      ctx.guest.id,
      ctx.functions.map((f) => f.id),
    );
    const seatByFunction = new Map(seats.map((s) => [s.functionId, { tableLabel: s.tableLabel, seatLabel: s.seatLabel }]));
    const [{ photos, photoSlots }, music] = await Promise.all([
      this.media.templatePhotos(ctx.event.id, template?.customization),
      this.renderContext.resolveMusic(template),
    ]);
    const context = await this.renderContext.build({
      event: ctx.event,
      functions: ctx.functions,
      guestName: ctx.guest.name,
      customization: template?.customization,
      announcements,
      gallery,
      photos,
      photoSlots,
      language,
      music,
    });
    return {
      event: {
        title: ctx.event.title,
        typeKey: ctx.event.typeKey,
        description: ctx.event.description,
        language: ctx.event.language,
        timezone: ctx.event.timezone,
        status: ctx.event.status,
        details: ctx.event.details,
      },
      guest: { name: ctx.guest.name, preferredLanguage: ctx.guest.preferredLanguage },
      scope: { functionId: ctx.invitation.functionId },
      functions: ctx.functions.map((fn) => {
        const rsvp = rsvpByFunction.get(fn.id);
        return {
          id: fn.id,
          name: fn.name,
          description: fn.description,
          startsAt: fn.startsAt,
          endsAt: fn.endsAt,
          status: fn.status,
          venue: fn.venue
            ? { name: fn.venue.name, address: fn.venue.address, city: fn.venue.city, mapUrl: fn.venue.mapUrl }
            : null,
          attendeeLimit: AudienceService.attendeeLimit(ctx.guestFacts, fn.id),
          rsvpOpen: eventOpen && OPEN_FOR_RSVP.has(fn.status),
          rsvp: rsvp
            ? {
                status: rsvp.status,
                attendeeCount: rsvp.attendeeCount,
                respondedAt: rsvp.respondedAt,
                answers: Object.fromEntries(rsvp.answers.map((a) => [a.question.key, a.value])),
              }
            : null,
          questions: questions.filter((q) => q.functionId === null || q.functionId === fn.id).map(toQuestion),
          seat: seatByFunction.get(fn.id) ?? null,
        };
      }),
      eventRsvp: eventRsvp
        ? { status: eventRsvp.status, attendeeCount: eventRsvp.attendeeCount, respondedAt: eventRsvp.respondedAt }
        : null,
      eventRsvpOpen: eventOpen && ctx.invitation.functionId === null,
      message: rsvps.find((r) => r.message)?.message ?? null,
      template: template ? { key: template.templateKey, definition: template.definition, customization: template.customization } : null,
      context,
      watermark: EntitlementsService.enabled(features, FEATURE_KEYS.WATERMARK),
      mediaRooms,
      checkInCode,
      logistics,
    };
  }

  private validateAnswers(
    questions: Array<{ id: string; key: string; type: RSVPQuestionType; required: boolean; options: Prisma.JsonValue }>,
    answers: Record<string, AnswerValue>,
    attending: boolean,
  ): Array<{ questionId: string; value: Prisma.InputJsonValue }> {
    const byKey = new Map(questions.map((q) => [q.key, q]));
    for (const key of Object.keys(answers)) {
      if (!byKey.has(key)) throw new AppError('RSVP_ANSWER_INVALID', `Unknown question: ${key}`);
    }
    const result: Array<{ questionId: string; value: Prisma.InputJsonValue }> = [];
    for (const q of questions) {
      const value = answers[q.key];
      const empty = value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
      if (empty) {
        if (q.required && attending) throw new AppError('RSVP_ANSWER_INVALID', `Please answer: ${q.key}`, { key: q.key });
        continue;
      }
      const allowed = Array.isArray(q.options)
        ? new Set((q.options as Array<{ value?: unknown }>).map((o) => o?.value).filter((v): v is string => typeof v === 'string'))
        : new Set<string>();
      const ok =
        (q.type === 'TEXT' && typeof value === 'string') ||
        (q.type === 'NUMBER' && typeof value === 'number' && Number.isFinite(value)) ||
        (q.type === 'BOOLEAN' && typeof value === 'boolean') ||
        (q.type === 'SINGLE_CHOICE' && typeof value === 'string' && allowed.has(value)) ||
        (q.type === 'MULTI_CHOICE' && Array.isArray(value) && value.every((v) => allowed.has(v)));
      if (!ok) throw new AppError('RSVP_ANSWER_INVALID', `Invalid answer for: ${q.key}`, { key: q.key });
      result.push({ questionId: q.id, value: value as Prisma.InputJsonValue });
    }
    return result;
  }
}
