import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { createTranslator, getLanguage, type MessageKey } from '@bulava/localization';
import { TemplateRenderer } from '@bulava/template-engine';
import type { GuestInvitationView } from '@/lib/types';
import { InvitationExperience } from '@/components/invite/invitation-experience';
import { PhotoRooms, RsvpIsland } from '@/components/invite/guest-islands';
import { GuestLogistics } from '@/components/invite/guest-logistics';
import { hasGuestLogistics } from '@/lib/guest-view';
import { OtpGate } from '@/components/invite/otp-gate';

export const dynamic = 'force-dynamic';

// Private page: metadata never contains event or guest details, and it is never indexed.
export const metadata: Metadata = {
  title: 'You are invited',
  description: 'Open your personal invitation on Bulava.',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

/** Link-preview crawlers must not count as the guest opening the invitation. */
const PREVIEW_BOTS =
  /(WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|Slackbot|LinkedInBot|Discordbot|SkypeUriPreview|Googlebot|bingbot|Applebot|redditbot|Pinterest)/i;

type Result = { ok: true; view: GuestInvitationView } | { ok: false; code: string; details?: { target?: string; channel?: string } };

async function loadInvitation(token: string): Promise<Result> {
  const incoming = await headers();
  const jar = await cookies();
  const forwardedFor = incoming.get('x-forwarded-for');
  const otpPass = jar.get('bulava_otp')?.value;
  const apiBase = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';
  try {
    const res = await fetch(`${apiBase}/api/v1/public/invitations/${encodeURIComponent(token)}`, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
        ...(otpPass ? { 'x-bulava-otp-pass': otpPass } : {}),
        'user-agent': incoming.get('user-agent') ?? 'bulava-web',
      },
    });
    const body = (await res.json().catch(() => null)) as
      | { success: true; data: GuestInvitationView }
      | { success: false; error: { code: string; details?: { target?: string; channel?: string } } }
      | null;
    if (body?.success) return { ok: true, view: body.data };
    return body && !body.success ? { ok: false, code: body.error.code, details: body.error.details } : { ok: false, code: 'INTERNAL_ERROR' };
  } catch {
    return { ok: false, code: 'INTERNAL_ERROR' };
  }
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="paper flex min-h-dvh items-center justify-center px-6 text-center">
      <div>
        <p className="font-display text-4xl text-brand-700">{title}</p>
        <p className="mt-3 text-stone-600">{body}</p>
      </div>
    </main>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const userAgent = (await headers()).get('user-agent') ?? '';
  const en = createTranslator('en');

  if (PREVIEW_BOTS.test(userAgent)) {
    return <Message title={en('invitation.youAreInvited')} body={en('invitation.openPrompt')} />;
  }

  const result = await loadInvitation(token);
  if (!result.ok) {
    if (result.code === 'OTP_REQUIRED') {
      return <OtpGate token={token} target={result.details?.target ?? ''} />;
    }
    const key = (
      {
        INVITATION_EXPIRED: 'invitation.expired',
        INVITATION_REVOKED: 'invitation.revokedMessage',
        INVITATION_USAGE_EXCEEDED: 'invitation.revokedMessage',
        EVENT_NOT_PUBLISHED: 'invitation.notPublished',
        RATE_LIMITED: 'error.RATE_LIMITED',
      } as Record<string, MessageKey>
    )[result.code] ?? (result.code === 'INTERNAL_ERROR' ? 'common.error' : 'invitation.invalid');
    // Show English and Hindi: we do not know the guest's language without a valid token.
    const hi = createTranslator('hi');
    return <Message title={en(key)} body={hi(key)} />;
  }

  const view = result.view;
  const language = view.guest.preferredLanguage ?? view.event.language;
  const t = createTranslator(language);

  // Hosts on older data without a template still get the classic layout.
  if (!view.template) {
    return (
      <div lang={language} dir={getLanguage(language).direction}>
        <InvitationExperience token={token} initialView={view} language={language} />
      </div>
    );
  }

  return (
    <TemplateRenderer
      definition={view.template.definition}
      customization={view.template.customization}
      context={view.context}
      language={language}
      mode="live"
      introKey={view.checkInCode ?? view.template.key}
      slots={{
        rsvp: <RsvpIsland token={token} initialView={view} language={language} />,
        photoShare: view.mediaRooms.length ? <PhotoRooms rooms={view.mediaRooms} token={token} language={language} /> : undefined,
        checkIn: view.checkInCode ? (
          <div className="rounded-2xl bg-white p-4 text-center text-stone-800">
            <p className="font-semibold">{t('invite.checkin.title')}</p>
            <img src={`/api/v1/public/check-in/${view.checkInCode}/qr.svg`} alt={t('invite.checkin.title')} width={180} height={180} className="mx-auto my-2 size-44" />
            <p className="text-xs text-stone-500">{t('invite.checkin.body')}</p>
          </div>
        ) : undefined,
        guestInfo: hasGuestLogistics(view) ? <GuestLogistics token={token} initialView={view} language={language} /> : undefined,
        watermark: view.watermark,
      }}
    />
  );
}
