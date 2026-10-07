import { z } from 'zod';

// ───────────────────────────── Primitives ─────────────────────────────

export const IdSchema = z.uuid();

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? undefined : v))
    .optional();

/**
 * Indian-first phone normalization to E.164.
 * Accepts "98765 43210", "+91-98765-43210", "09876543210", "+44 7700 900123".
 */
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  if (raw === '') return null;
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (hasPlus) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) return `+${digits}`;
  return null;
}

export const PhoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid phone number' });
      return z.NEVER;
    }
    return normalized;
  });

const optionalPhone = z
  .union([z.literal(''), PhoneSchema])
  .transform((v) => (v === '' ? undefined : v))
  .optional();

const optionalEmail = z
  .union([z.literal(''), z.email().max(254)])
  .transform((v) => (v === '' ? undefined : v.toLowerCase()))
  .optional();

export const SlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** ISO-8601 datetime with offset, or empty -> null. Stored as UTC. */
const optionalDateTime = z
  .union([z.literal(''), z.null(), z.iso.datetime({ offset: true })])
  .transform((v) => (v ? v : null))
  .optional();

export const AccessModeSchema = z.enum(['PUBLIC', 'PRIVATE_LINK', 'INVITE_ONLY', 'GROUP_RESTRICTED', 'SECRET_TOKEN']);
export type AccessMode = z.infer<typeof AccessModeSchema>;

export const VisibilitySchema = z.enum(['LISTED', 'UNLISTED']);
export const RSVPResponseStatusSchema = z.enum(['ATTENDING', 'DECLINED', 'MAYBE']);

// ───────────────────────────── Auth ─────────────────────────────

/**
 * An explicit tick of an unticked box (DPDP Act consent; the Consumer Protection
 * (E-Commerce) Rules forbid recording consent from pre-ticked boxes).
 */
const agreed = (message: string) => z.boolean({ error: message }).refine((v) => v === true, message);

export const SignupSchema = z.object({
  name: trimmed(120),
  email: z.email().max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(10, 'At least 10 characters').max(128),
  /** The Terms of Service and the Privacy Policy, recorded as consents with their versions. */
  acceptTerms: agreed('Please accept the Terms of Service and the Privacy Policy'),
});
export type SignupInput = z.infer<typeof SignupSchema>;

/** Days a deleted account can still be restored by signing in, before it is erased for good. */
export const ACCOUNT_RESTORE_DAYS = 30;

/** DELETE /users/me: the password, or for accounts without one (Google only), the word DELETE. */
export const DeleteAccountSchema = z.object({
  password: z.string().max(128).optional(),
  confirm: z.string().trim().max(20).optional(),
});
export type DeleteAccountInput = z.infer<typeof DeleteAccountSchema>;

/** POST /auth/restore: the one-use token from signing in to an account that is waiting to be deleted. */
export const RestoreAccountSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{20,128}$/) });
export type RestoreAccountInput = z.infer<typeof RestoreAccountSchema>;

export const LoginSchema = z.object({
  email: z.email().max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof LoginSchema>;

// ───────────────────────────── Two-step sign-in ─────────────────────────────

/** A 6-digit authenticator code; people often type a space in the middle. */
export const TotpCodeSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s/g, ''))
  .pipe(z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'));

export const RecoveryCodeSchema = z.string().trim().min(8).max(40);

/** Either an authenticator code or one recovery code, never both. */
const secondFactor = {
  code: TotpCodeSchema.optional(),
  recoveryCode: RecoveryCodeSchema.optional(),
};
const oneFactor = (v: { code?: string; recoveryCode?: string }) => Boolean(v.code) !== Boolean(v.recoveryCode);

export const LoginMfaSchema = z
  .object({ challengeToken: z.string().min(20).max(200), ...secondFactor })
  .refine(oneFactor, { message: 'Enter an authenticator code or a recovery code', path: ['code'] });
export type LoginMfaInput = z.infer<typeof LoginMfaSchema>;

/** Set a first password (Google-only accounts) or change it (current password required). */
export const SetPasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128).optional(),
  newPassword: z.string().min(10, 'At least 10 characters').max(128),
});
export type SetPasswordInput = z.infer<typeof SetPasswordSchema>;

export const MfaSetupSchema = z.object({ password: z.string().min(1).max(128) });
export type MfaSetupInput = z.infer<typeof MfaSetupSchema>;

export const MfaEnableSchema = z.object({ code: TotpCodeSchema });
export type MfaEnableInput = z.infer<typeof MfaEnableSchema>;

export const MfaDisableSchema = z
  .object({ password: z.string().min(1).max(128), ...secondFactor })
  .refine(oneFactor, { message: 'Enter an authenticator code or a recovery code', path: ['code'] });
export type MfaDisableInput = z.infer<typeof MfaDisableSchema>;

export const MfaRegenerateSchema = z.object({ code: TotpCodeSchema });
export type MfaRegenerateInput = z.infer<typeof MfaRegenerateSchema>;

// ───────────────────────────── Events ─────────────────────────────

/** Category-specific details, keyed by EventType.detailsSchemaKey. */
export const eventDetailsSchemas = {
  couple: z.object({
    partnerOne: trimmed(120),
    partnerTwo: trimmed(120),
  }),
  honoree: z.object({
    name: trimmed(120),
  }),
} as const;
export type EventDetailsSchemaKey = keyof typeof eventDetailsSchemas;

export function validateEventDetails(schemaKey: string | null | undefined, details: unknown) {
  if (!schemaKey || !(schemaKey in eventDetailsSchemas)) {
    return z.record(z.string(), z.unknown()).safeParse(details ?? {});
  }
  return eventDetailsSchemas[schemaKey as EventDetailsSchemaKey].safeParse(details ?? {});
}

const LanguageCodeSchema = z.string().regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/);
const TimezoneSchema = z.string().min(1).max(64).refine((tz) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'Unknown time zone');

export const CreateEventSchema = z.object({
  typeKey: z.string().trim().min(1).max(40),
  title: trimmed(160),
  description: optionalText(4000),
  language: LanguageCodeSchema.default('en'),
  timezone: TimezoneSchema.default('Asia/Kolkata'),
  accessMode: AccessModeSchema.default('INVITE_ONLY'),
  visibility: VisibilitySchema.default('UNLISTED'),
  details: z.record(z.string(), z.unknown()).default({}),
  /** Create the event type's suggested functions and groups. */
  applyDefaults: z.boolean().default(true),
});
export type CreateEventInput = z.infer<typeof CreateEventSchema>;

export const UpdateEventSchema = z.object({
  title: trimmed(160).optional(),
  description: optionalText(4000),
  language: LanguageCodeSchema.optional(),
  timezone: TimezoneSchema.optional(),
  accessMode: AccessModeSchema.optional(),
  visibility: VisibilitySchema.optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED', 'CANCELLED']).optional(),
  /** Require guests to confirm identity with a one-time code. */
  requireOtp: z.boolean().optional(),
  /** PIN for PRIVATE_LINK events; null removes it. */
  pin: z.union([z.string().trim().regex(/^[0-9A-Za-z]{4,12}$/, 'Use 4–12 letters or digits'), z.null()]).optional(),
});
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;

// ───────────────────────────── Functions ─────────────────────────────

export const VenueInputSchema = z.object({
  name: trimmed(160),
  address: optionalText(500),
  city: optionalText(120),
  mapUrl: z.union([z.literal(''), z.url().max(1000)]).transform((v) => (v === '' ? undefined : v)).optional(),
});

const FunctionBaseSchema = z.object({
  name: trimmed(120),
  slug: SlugSchema.optional(),
  description: optionalText(2000),
  startsAt: optionalDateTime,
  endsAt: optionalDateTime,
  venue: VenueInputSchema.nullable().optional(),
  visibility: VisibilitySchema.default('LISTED'),
  /** 'INHERIT' = use the event policy. */
  accessMode: z.union([AccessModeSchema, z.literal('INHERIT')]).default('INHERIT'),
  audienceGroupIds: z.array(IdSchema).max(100).default([]),
  status: z.enum(['DRAFT', 'SCHEDULED', 'POSTPONED', 'CANCELLED', 'COMPLETED']).default('SCHEDULED'),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

const endsAfterStart = (v: { startsAt?: string | null; endsAt?: string | null }) =>
  !v.startsAt || !v.endsAt || new Date(v.endsAt) > new Date(v.startsAt);

export const CreateFunctionSchema = FunctionBaseSchema.refine(endsAfterStart, {
  message: 'End time must be after start time',
  path: ['endsAt'],
});
export type CreateFunctionInput = z.infer<typeof CreateFunctionSchema>;

export const UpdateFunctionSchema = z
  .object({
    name: trimmed(120).optional(),
    slug: SlugSchema.optional(),
    description: optionalText(2000),
    startsAt: optionalDateTime,
    endsAt: optionalDateTime,
    venue: VenueInputSchema.nullable().optional(),
    visibility: VisibilitySchema.optional(),
    accessMode: z.union([AccessModeSchema, z.literal('INHERIT')]).optional(),
    audienceGroupIds: z.array(IdSchema).max(100).optional(),
    status: z.enum(['DRAFT', 'SCHEDULED', 'POSTPONED', 'CANCELLED', 'COMPLETED']).optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .refine(endsAfterStart, { message: 'End time must be after start time', path: ['endsAt'] });
export type UpdateFunctionInput = z.infer<typeof UpdateFunctionSchema>;

// ───────────────────────────── Groups ─────────────────────────────

export const CreateGroupSchema = z.object({
  name: trimmed(80),
  slug: SlugSchema.optional(),
  description: optionalText(500),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;

export const UpdateGroupSchema = CreateGroupSchema.partial();
export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>;

// ───────────────────────────── Guests ─────────────────────────────

export const CreateGuestSchema = z.object({
  name: trimmed(120),
  phone: optionalPhone,
  email: optionalEmail,
  address: optionalText(500),
  notes: optionalText(1000),
  guestType: z.enum(['ADULT', 'CHILD', 'FAMILY']).default('ADULT'),
  preferredLanguage: LanguageCodeSchema.optional(),
  isVip: z.boolean().default(false),
  dietary: optionalText(200),
  groupIds: z.array(IdSchema).max(50).default([]),
});
export type CreateGuestInput = z.infer<typeof CreateGuestSchema>;

export const UpdateGuestSchema = z.object({
  name: trimmed(120).optional(),
  phone: optionalPhone,
  email: optionalEmail,
  address: optionalText(500),
  notes: optionalText(1000),
  guestType: z.enum(['ADULT', 'CHILD', 'FAMILY']).optional(),
  preferredLanguage: LanguageCodeSchema.optional(),
  isVip: z.boolean().optional(),
  /** '' clears it. */
  dietary: z.string().trim().max(200).transform((v) => (v === '' ? null : v)).optional(),
});
export type UpdateGuestInput = z.infer<typeof UpdateGuestSchema>;

export const SetGuestGroupsSchema = z.object({
  groupIds: z.array(IdSchema).max(50),
});
export type SetGuestGroupsInput = z.infer<typeof SetGuestGroupsSchema>;

export const FunctionAssignmentSchema = z.object({
  functionId: IdSchema,
  allowed: z.boolean().default(true),
  plusOneAllowed: z.boolean().default(false),
  guestLimit: z.number().int().min(1).max(50).default(1),
  notes: optionalText(500),
});

/** Replaces the guest's full set of direct function assignments. */
export const SetGuestFunctionsSchema = z.object({
  assignments: z
    .array(FunctionAssignmentSchema)
    .max(100)
    .refine((a) => new Set(a.map((x) => x.functionId)).size === a.length, 'Duplicate function'),
});
export type SetGuestFunctionsInput = z.infer<typeof SetGuestFunctionsSchema>;

// ───────────────────────────── Guest logistics (stay, travel, seating) ─────────────────────────────

export const TravelDirectionSchema = z.enum(['ARRIVAL', 'DEPARTURE']);
export type TravelDirection = z.infer<typeof TravelDirectionSchema>;
export const TravelModeSchema = z.enum(['FLIGHT', 'TRAIN', 'ROAD', 'BUS', 'OTHER']);
export type TravelMode = z.infer<typeof TravelModeSchema>;

const optionalUrl = z
  .union([z.literal(''), z.url().max(1000)])
  .transform((v) => (v === '' ? undefined : v))
  .optional();

export const GuestStaySchema = z
  .object({
    hotelName: trimmed(160),
    address: optionalText(500),
    mapUrl: optionalUrl,
    roomNumber: optionalText(40),
    roomType: optionalText(80),
    checkInAt: optionalDateTime,
    checkOutAt: optionalDateTime,
    notes: optionalText(1000),
  })
  .refine((s) => !s.checkInAt || !s.checkOutAt || new Date(s.checkOutAt) >= new Date(s.checkInAt), {
    message: 'Check-out must be after check-in',
    path: ['checkOutAt'],
  });
export type GuestStayInput = z.infer<typeof GuestStaySchema>;

const travelFields = {
  mode: TravelModeSchema,
  carrier: optionalText(80),
  reference: optionalText(40),
  at: z.iso.datetime({ offset: true }),
  place: optionalText(160),
  travellers: z.number().int().min(1).max(50).default(1),
  pickupRequested: z.boolean().default(false),
};

/** Host version: includes the pickup arrangement shown to the guest. */
export const GuestTravelSchema = z.object({ ...travelFields, pickupNote: optionalText(500) });
export type GuestTravelInput = z.infer<typeof GuestTravelSchema>;

/** Guest version (from the invitation page): no host-only fields. */
export const GuestTravelSelfItemSchema = z.object(travelFields);
export type GuestTravelSelfItem = z.infer<typeof GuestTravelSelfItemSchema>;

/**
 * Host edit of one guest's logistics. Each key present replaces that part;
 * `null` removes it; an absent key leaves it unchanged.
 */
export const SetGuestLogisticsSchema = z.object({
  isVip: z.boolean().optional(),
  dietary: z.union([z.null(), z.string().trim().max(200)]).transform((v) => (v ? v : null)).optional(),
  stay: GuestStaySchema.nullable().optional(),
  arrival: GuestTravelSchema.nullable().optional(),
  departure: GuestTravelSchema.nullable().optional(),
});
export type SetGuestLogisticsInput = z.infer<typeof SetGuestLogisticsSchema>;

export const GuestTravelSelfSchema = z.object({
  arrival: GuestTravelSelfItemSchema.nullable().optional(),
  departure: GuestTravelSelfItemSchema.nullable().optional(),
});
export type GuestTravelSelfInput = z.infer<typeof GuestTravelSelfSchema>;

/** Replaces the whole seating plan of one function. */
export const SetSeatingSchema = z.object({
  seats: z
    .array(z.object({ guestId: IdSchema, tableLabel: trimmed(40), seatLabel: optionalText(20) }))
    .max(5000)
    .refine((a) => new Set(a.map((x) => x.guestId)).size === a.length, 'A guest can have only one seat per function'),
});
export type SetSeatingInput = z.infer<typeof SetSeatingSchema>;

export const LogisticsSettingsSchema = z.object({ collectGuestTravel: z.boolean() });
export type LogisticsSettingsInput = z.infer<typeof LogisticsSettingsSchema>;

// ───────────────────────────── Reminders ─────────────────────────────

/** Automatic reminders: an RSVP nudge at a chosen time, and a reminder N hours before each function. */
export const SetDomainSchema = z.object({ hostname: z.string().trim().min(3).max(300) });
export type SetDomainInput = z.infer<typeof SetDomainSchema>;

export const ReminderSettingsSchema = z.object({
  rsvpReminderAt: z.iso.datetime({ offset: true }).nullable(),
  functionReminderHours: z.number().int().min(1).max(168).nullable(),
});
export type ReminderSettingsInput = z.infer<typeof ReminderSettingsSchema>;

// ───────────────────────────── Invitations ─────────────────────────────

export const CreateInvitationSchema = z.object({
  guestId: IdSchema,
  /** null/omitted = event-wide invitation. */
  functionId: IdSchema.nullable().optional(),
  expiresAt: optionalDateTime,
  maxUses: z.number().int().min(1).max(1000).nullable().optional(),
});
export type CreateInvitationInput = z.infer<typeof CreateInvitationSchema>;

export const BulkCreateInvitationsSchema = z.object({
  guestIds: z.array(IdSchema).min(1).max(1000),
  expiresAt: optionalDateTime,
});
export type BulkCreateInvitationsInput = z.infer<typeof BulkCreateInvitationsSchema>;

// ───────────────────────────── RSVP ─────────────────────────────

export const RSVPAnswerValueSchema = z.union([
  z.string().max(1000),
  z.number(),
  z.boolean(),
  z.array(z.string().max(200)).max(20),
]);

export const RSVPResponseSchema = z.object({
  /** null = event-level RSVP. */
  functionId: IdSchema.nullable(),
  status: RSVPResponseStatusSchema,
  attendeeCount: z.number().int().min(0).max(50).default(1),
  answers: z.record(z.string().max(64), RSVPAnswerValueSchema).default({}),
});

export const RSVPSubmitSchema = z.object({
  responses: z
    .array(RSVPResponseSchema)
    .min(1)
    .max(50)
    .refine(
      (r) => new Set(r.map((x) => x.functionId ?? 'EVENT')).size === r.length,
      'Only one response per function',
    ),
  message: optionalText(1000),
});
export type RSVPSubmitInput = z.infer<typeof RSVPSubmitSchema>;

// ───────────────────────────── RSVP questions ─────────────────────────────

/** Localized text: {"en": "Meal preference", "hi": "भोजन"}. English is required. */
export const LocalizedTextSchema = z
  .record(z.string().regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/), z.string().trim().min(1).max(300))
  .refine((v) => typeof v.en === 'string', 'An English label is required');

export const RSVPQuestionTypeSchema = z.enum(['TEXT', 'NUMBER', 'BOOLEAN', 'SINGLE_CHOICE', 'MULTI_CHOICE']);

/** Question fields without defaults, so partial updates never reset what they omit. */
const RSVPQuestionFields = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9_]{0,47}$/, 'Use lowercase letters, numbers and underscores'),
  label: LocalizedTextSchema,
  type: RSVPQuestionTypeSchema,
  options: z.array(z.object({ value: z.string().trim().min(1).max(60), label: LocalizedTextSchema })).max(30),
  required: z.boolean(),
  /** null = asked for every function. */
  functionId: IdSchema.nullable(),
  sortOrder: z.number().int().min(0).max(1000),
});

const RSVPQuestionBase = RSVPQuestionFields.extend({
  options: RSVPQuestionFields.shape.options.default([]),
  required: RSVPQuestionFields.shape.required.default(false),
  functionId: RSVPQuestionFields.shape.functionId.default(null),
  sortOrder: RSVPQuestionFields.shape.sortOrder.default(0),
});

const choicesNeedOptions = (q: { type?: string; options?: unknown[] }) =>
  !q.type || !['SINGLE_CHOICE', 'MULTI_CHOICE'].includes(q.type) || (q.options?.length ?? 0) >= 2;

export const CreateRSVPQuestionSchema = RSVPQuestionBase.refine(choicesNeedOptions, {
  message: 'Choice questions need at least two options',
  path: ['options'],
});
export type CreateRSVPQuestionInput = z.infer<typeof CreateRSVPQuestionSchema>;

// Built from the default-free fields: in Zod 4 a default inside .partial() still fills in omitted keys.
export const UpdateRSVPQuestionSchema = RSVPQuestionFields.omit({ key: true })
  .partial()
  .extend({ active: z.boolean().optional() });
export type UpdateRSVPQuestionInput = z.infer<typeof UpdateRSVPQuestionSchema>;

// ───────────────────────────── Common ─────────────────────────────

export const PaginationSchema = z.object({
  cursor: IdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  q: z.string().trim().max(120).optional(),
});
export type PaginationInput = z.infer<typeof PaginationSchema>;

export { z };

// ───────────────────────────── Plans & entitlements ─────────────────────────────

/**
 * Feature keys used by PlanFeature and Entitlement rows. Limits live in the
 * database (admin-editable); code only knows the keys and their meaning.
 * limit null = unlimited; enabled=false = feature off.
 */
export const FEATURE_KEYS = {
  EVENTS_MAX: 'events.max',
  FUNCTIONS_MAX: 'functions.max',
  GUESTS_MAX: 'guests.max',
  TEMPLATES_MAX_TIER: 'templates.maxTier',
  PHOTOS_MAX: 'media.photos.max',
  VIDEO_RENDERS_MAX: 'video.renders.max',
  VIDEO_HD: 'video.hd',
  WATERMARK: 'branding.watermark',
  PLANNER: 'planner.workspace',
  CUSTOM_DOMAIN: 'domain.custom',
  /** WhatsApp Business messages per event (invitations and reminders sent from the platform's number). */
  WHATSAPP_MESSAGES: 'messaging.whatsapp.max',
} as const;
export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

/** Template tiers as numbers for templates.maxTier comparisons. */
export const TEMPLATE_TIER_RANK = { FREE: 0, STANDARD: 1, PREMIUM: 2 } as const;

export const CreateOrderSchema = z.object({
  planKey: z.string().trim().min(1).max(40),
  couponCode: z.string().trim().toUpperCase().max(40).optional(),
  /** The Terms of Service and the Refund and Cancellation Policy, ticked for this purchase. */
  acceptTerms: agreed('Please accept the Terms of Service and the Refund and Cancellation Policy'),
});
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const VerifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1).max(100),
  razorpayPaymentId: z.string().min(1).max(100),
  razorpaySignature: z.string().regex(/^[0-9a-f]{64}$/),
});
export type VerifyPaymentInput = z.infer<typeof VerifyPaymentSchema>;

// ───────────────────────────── Announcements ─────────────────────────────

export const AnnouncementAudienceSchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ functionIds: z.array(IdSchema).min(1).max(50) }),
  z.object({ groupIds: z.array(IdSchema).min(1).max(50) }),
  z.object({ guestIds: z.array(IdSchema).min(1).max(1000) }),
]);
export type AnnouncementAudience = z.infer<typeof AnnouncementAudienceSchema>;

export const CreateAnnouncementSchema = z.object({
  title: trimmed(120),
  body: z.string().trim().min(1).max(2000),
  audience: AnnouncementAudienceSchema.default({ all: true }),
  /** Publish immediately (and notify) instead of saving a draft. */
  publish: z.boolean().default(true),
  /** Also email guests who have an email address. */
  notifyByEmail: z.boolean().default(true),
});
export type CreateAnnouncementInput = z.infer<typeof CreateAnnouncementSchema>;

export const EventPinSchema = z
  .string()
  .trim()
  .regex(/^[0-9A-Za-z]{4,12}$/, 'Use 4–12 letters or digits');

// ───────────────────────────── Public registration (spec §89) ─────────────────────────────

/** Extra fields a public event's registration form asks for (name/email/phone are built in). */
export const RegistrationFieldSchema = z
  .object({
    key: z.string().trim().regex(/^[a-z][a-z0-9_]{0,47}$/, 'Use lowercase letters, numbers and underscores'),
    label: LocalizedTextSchema,
    type: RSVPQuestionTypeSchema,
    options: z
      .array(z.object({ value: z.string().trim().min(1).max(60), label: LocalizedTextSchema }))
      .max(30)
      .default([]),
    required: z.boolean().default(false),
  })
  .refine(choicesNeedOptions, { message: 'Choice fields need at least two options', path: ['options'] });
export type RegistrationField = z.infer<typeof RegistrationFieldSchema>;

export const RegistrationFieldsSchema = z
  .array(RegistrationFieldSchema)
  .max(20)
  .refine((fields) => new Set(fields.map((f) => f.key)).size === fields.length, 'Field keys must be unique');

export const RegistrationSettingsSchema = z.object({
  enabled: z.boolean(),
  fields: RegistrationFieldsSchema.default([]),
  /** Confirmed places; null = no cap beyond the plan's guest limit. */
  maxRegistrations: z.number().int().min(1).max(100_000).nullable().default(null),
  approvalRequired: z.boolean().default(false),
  waitlistEnabled: z.boolean().default(false),
  closesAt: optionalDateTime,
});
export type RegistrationSettingsInput = z.infer<typeof RegistrationSettingsSchema>;

export const RegisterSchema = z
  .object({
    name: trimmed(120),
    email: optionalEmail,
    phone: optionalPhone,
    answers: z.record(z.string().max(64), RSVPAnswerValueSchema).default({}),
    preferredLanguage: LanguageCodeSchema.optional(),
    /** The registrant agrees to the host storing these details (privacy consent). */
    consent: z.literal(true, { error: 'Please agree to share your details with the host' }),
  })
  .refine((r) => !!(r.email || r.phone), { message: 'Enter an email address or a phone number', path: ['email'] });
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const RegistrationStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'WAITLISTED', 'REJECTED', 'CANCELLED']);
export type RegistrationStatus = z.infer<typeof RegistrationStatusSchema>;

export const RegistrationDecisionSchema = z.object({ decision: z.enum(['CONFIRM', 'WAITLIST', 'REJECT', 'CANCEL']) });
export type RegistrationDecision = z.infer<typeof RegistrationDecisionSchema>['decision'];

export type FormAnswerValue = z.infer<typeof RSVPAnswerValueSchema>;
export type FormAnswerCheck = { ok: true; value: Record<string, FormAnswerValue> } | { ok: false; key: string; reason: 'unknown' | 'required' | 'invalid' };

/** Check answers against form fields (pure; used by the API and for client-side hints). */
export function checkFormAnswers(fields: RegistrationField[], answers: Record<string, FormAnswerValue>): FormAnswerCheck {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  for (const key of Object.keys(answers)) {
    if (!byKey.has(key)) return { ok: false, key, reason: 'unknown' };
  }
  const value: Record<string, FormAnswerValue> = {};
  for (const f of fields) {
    const v = answers[f.key];
    const empty = v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
    if (empty) {
      if (f.required) return { ok: false, key: f.key, reason: 'required' };
      continue;
    }
    const allowed = new Set(f.options.map((o) => o.value));
    const ok =
      (f.type === 'TEXT' && typeof v === 'string') ||
      (f.type === 'NUMBER' && typeof v === 'number' && Number.isFinite(v)) ||
      (f.type === 'BOOLEAN' && typeof v === 'boolean') ||
      (f.type === 'SINGLE_CHOICE' && typeof v === 'string' && allowed.has(v)) ||
      (f.type === 'MULTI_CHOICE' && Array.isArray(v) && v.every((x) => allowed.has(x)));
    if (!ok) return { ok: false, key: f.key, reason: 'invalid' };
    value[f.key] = v;
  }
  return { ok: true, value };
}

// ───────────────────────────── Event team ─────────────────────────────

/** Roles a host can grant. OWNER is set at creation and cannot be granted. */
export const TeamRoleSchema = z.enum(['ADMIN', 'CO_HOST', 'FUNCTION_MANAGER', 'GUEST_MANAGER', 'MEDIA_MANAGER', 'PHOTOGRAPHER']);
export type TeamRole = z.infer<typeof TeamRoleSchema>;

export const AddMemberSchema = z.object({
  email: z.email().max(254).transform((v) => v.trim().toLowerCase()),
  role: TeamRoleSchema,
  /** FUNCTION_MANAGER only: limit to these functions (empty = all). */
  functionIds: z.array(IdSchema).max(50).default([]),
});
export type AddMemberInput = z.infer<typeof AddMemberSchema>;

export const UpdateMemberSchema = z.object({ role: TeamRoleSchema.optional(), functionIds: z.array(IdSchema).max(50).optional() });
export type UpdateMemberInput = z.infer<typeof UpdateMemberSchema>;

/** The 6-digit code from a team invitation email (spaces are ignored). */
export const TeamInviteCodeSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s/g, ''))
  .pipe(z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'));

export const VerifyTeamInviteSchema = z.object({ code: TeamInviteCodeSchema });
export type VerifyTeamInviteInput = z.infer<typeof VerifyTeamInviteSchema>;

/** Accepting a team invitation by creating the account it was sent to. */
export const AcceptTeamInviteSchema = z.object({
  code: TeamInviteCodeSchema,
  name: trimmed(120),
  password: z.string().min(10, 'At least 10 characters').max(128),
});
export type AcceptTeamInviteInput = z.infer<typeof AcceptTeamInviteSchema>;

// ───────────────────────────── Shared event link ─────────────────────────────

/** When a SECRET_TOKEN event's link stops working: in the future, at most a year ahead. */
export const ShareLinkExpirySchema = z.object({
  expiresAt: z.iso.datetime({ offset: true }).refine((v) => {
    const at = Date.parse(v);
    return at > Date.now() && at <= Date.now() + 366 * 24 * 3600 * 1000;
  }, 'Choose a date within the next year'),
});
export type ShareLinkExpiryInput = z.infer<typeof ShareLinkExpirySchema>;

// ───────────────────────────── Photo album ─────────────────────────────

export const GalleryVisibilitySchema = z.enum(['PUBLIC', 'PRIVATE', 'INVITE_ONLY', 'FUNCTION_RESTRICTED']);
export const ModerationModeSchema = z.enum(['AUTO_APPROVE', 'MANUAL_APPROVAL', 'AI_ASSISTED']);

/** The main album's settings (one upload link, gallery and live wall per event). Every field optional; no defaults. */
export const UpdateAlbumSchema = z.object({
  name: trimmed(80).optional(),
  galleryVisibility: GalleryVisibilitySchema.optional(),
  moderationMode: ModerationModeSchema.optional(),
  uploadsEnabled: z.boolean().optional(),
  guestsCanDownload: z.boolean().optional(),
  originalQuality: z.boolean().optional(),
  liveWallEnabled: z.boolean().optional(),
});
export type UpdateAlbumInput = z.infer<typeof UpdateAlbumSchema>;

export const CreateSubAlbumSchema = z.object({ name: trimmed(80) });
export type CreateSubAlbumInput = z.infer<typeof CreateSubAlbumSchema>;

/** Function sub-albums keep their function's name, so only custom ones may be renamed. */
export const UpdateSubAlbumSchema = z.object({
  name: trimmed(80).optional(),
  showInGallery: z.boolean().optional(),
  showOnWall: z.boolean().optional(),
});
export type UpdateSubAlbumInput = z.infer<typeof UpdateSubAlbumSchema>;

/** A file a guest or a team member is about to upload. */
export const MediaUploadRequestSchema = z.object({
  fileName: trimmed(200),
  contentType: z.string().max(100),
  sizeBytes: z.number().int().positive(),
  /** The sub-album; guests default to the album's General folder. */
  albumId: IdSchema.optional(),
  uploaderName: z.string().trim().max(80).optional(),
});
export type MediaUploadRequestInput = z.infer<typeof MediaUploadRequestSchema>;

/** Team members (photographers) always choose the sub-album. */
export const TeamUploadRequestSchema = MediaUploadRequestSchema.omit({ uploaderName: true }).extend({ albumId: IdSchema });
export type TeamUploadRequestInput = z.infer<typeof TeamUploadRequestSchema>;

// ───────────────────────────── Contact form ─────────────────────────────

export const CONTACT_TOPICS = ['GENERAL', 'EVENT_HELP', 'BILLING', 'PARTNERSHIP', 'PRIVACY', 'FEEDBACK'] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];
export const CONTACT_STATUSES = ['NEW', 'OPEN', 'RESOLVED', 'SPAM'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/** A message from the public contact form (POST /public/contact). */
export const ContactMessageSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().max(254).transform((v) => v.trim().toLowerCase()),
  phone: optionalPhone,
  topic: z.enum(CONTACT_TOPICS),
  message: z.string().trim().min(20, 'Please tell us a little more (at least 20 characters)').max(4000),
  /** Hidden from people; a form that fills it in is a bot, and its message is dropped. */
  website: z.string().max(200).optional(),
});
export type ContactMessageInput = z.infer<typeof ContactMessageSchema>;

/** Staff triage: status and an internal note (never shown to the sender). */
export const ContactMessageUpdateSchema = z
  .object({
    status: z.enum(CONTACT_STATUSES).optional(),
    note: z.string().trim().max(4000).optional(),
  })
  .refine((v) => v.status !== undefined || v.note !== undefined, 'Nothing to change');
export type ContactMessageUpdateInput = z.infer<typeof ContactMessageUpdateSchema>;

/** A reply emailed to the sender from the console. */
export const ContactReplySchema = z.object({
  body: z.string().trim().min(2).max(8000),
  /** Mark the message resolved once the reply is sent. */
  resolve: z.boolean(),
});
export type ContactReplyInput = z.infer<typeof ContactReplySchema>;

// Site pages (About, Contact, policies and pages staff create).
export * from './pages';

// Platform settings (admin console).
export * from './settings';
