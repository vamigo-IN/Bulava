/** Response shapes of the Bulava API (see apps/api services for the source of truth). */
import type { Customization, RenderContext, TemplateDefinition } from '@bulava/template-schema';

export type AccessMode = 'PUBLIC' | 'PRIVATE_LINK' | 'INVITE_ONLY' | 'GROUP_RESTRICTED' | 'SECRET_TOKEN';
export type RsvpStatus = 'PENDING' | 'ATTENDING' | 'DECLINED' | 'MAYBE';

export interface User {
  id: string;
  name: string;
  email: string | null;
  /** WhatsApp number, E.164. */
  phone: string | null;
  locale: string;
  platformRole: string;
  hasPassword: boolean;
  googleLinked: boolean;
  mfaEnabled: boolean;
  /** The email was confirmed with a code (or by Google). */
  emailVerified: boolean;
  /** The WhatsApp number was confirmed with a code: it signs in with WhatsApp. */
  phoneVerified: boolean;
  /** Made from a WhatsApp number alone (the quick start) and not yet secured: cannot publish, pay or invite. */
  provisional: boolean;
  /** Agreed to updates on WhatsApp. */
  whatsappUpdates: boolean;
}

export interface EventType {
  key: string;
  name: string;
  description: string | null;
  detailsSchemaKey: string | null;
  defaultFunctions: Array<{ name: string; slug: string }>;
  defaultGroups: Array<{ name: string; slug: string }>;
}

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
}

export interface EventSummary {
  id: string;
  typeKey: string;
  title: string;
  slug: string;
  description: string | null;
  language: string;
  timezone: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED' | 'CANCELLED';
  visibility: 'LISTED' | 'UNLISTED';
  accessMode: AccessMode;
  hasPin: boolean;
  requireOtp: boolean;
  startDate: string | null;
  endDate: string | null;
  details: Record<string, string>;
  /** readyFunctions: functions with a date, time and venue. */
  counts: { functions: number; readyFunctions: number; guests: number };
  /** The website design the host chose; null while the event type's default stands in. */
  design: { templateKey: string; templateName: string; tier: 'FREE' | 'STANDARD' | 'PREMIUM' } | null;
  /** The host's shareable, watermarked preview link: /preview/<token>. */
  previewToken: string;
  /** "quick_start" when it began on the template page. */
  source: string | null;
  role?: string;
  /** What the signed-in member may do in this event (the dashboard shows only that). */
  permissions?: string[];
  createdAt: string;
  updatedAt: string;
}

/** What a host shares: one event link (public, private link, secret link) or personal invitations. */
export interface ShareLinkInfo {
  mode: AccessMode;
  kind: 'LINK' | 'PERSONAL';
  url: string | null;
  /** Secret links only: when the link stops working. */
  expiresAt: string | null;
  expired: boolean;
  hasPin: boolean;
  registrationOpen: boolean;
  eventStatus: EventSummary['status'];
}

export interface EventFunction {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: 'DRAFT' | 'SCHEDULED' | 'POSTPONED' | 'CANCELLED' | 'COMPLETED';
  visibility: 'LISTED' | 'UNLISTED';
  sortOrder: number;
  accessMode: AccessMode | 'INHERIT';
  effectiveAccessMode: AccessMode;
  venue: { id: string; name: string; address: string | null; city: string | null; mapUrl: string | null } | null;
  audienceGroupIds: string[];
}

export interface GuestGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  kind: 'SYSTEM' | 'CUSTOM';
  color: string | null;
  memberCount: number;
}

export interface Guest {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  guestType: string;
  preferredLanguage: string | null;
  isVip: boolean;
  dietary: string | null;
  groupIds: string[];
  assignments: Array<{ functionId: string; allowed: boolean; guestLimit: number; plusOneAllowed: boolean; notes: string | null }>;
  access: Record<string, { allowed: boolean; reason: string }>;
  invitations: Array<{ id: string; status: string; functionId: string | null; openedAt: string | null; sentAt: string | null }>;
  rsvps: Array<{ functionId: string | null; status: RsvpStatus; attendeeCount: number; respondedAt: string }>;
}

export interface Invitation {
  id: string;
  status: 'ACTIVE' | 'SENT' | 'OPENED' | 'RESPONDED' | 'REVOKED' | 'EXPIRED';
  guest: { id: string; name: string; phone: string | null; preferredLanguage: string | null };
  function: { id: string; name: string } | null;
  url: string | null;
  expiresAt: string | null;
  sentAt: string | null;
  openedAt: string | null;
  useCount: number;
  createdAt: string;
}

export interface RsvpSummary {
  totalGuests: number;
  functions: Array<{
    functionId: string;
    name: string;
    status: string;
    invited: number;
    attending: number;
    declined: number;
    maybe: number;
    pending: number;
    headcount: number;
  }>;
}

export interface RsvpRow {
  id: string;
  guest: { id: string; name: string; phone: string | null };
  function: { id: string; name: string } | null;
  status: RsvpStatus;
  attendeeCount: number;
  message: string | null;
  answers: Record<string, unknown>;
  respondedAt: string;
}

export interface GuestInvitationView {
  event: {
    title: string;
    typeKey: string;
    description: string | null;
    language: string;
    timezone: string;
    status: string;
    details: Record<string, string>;
  };
  guest: { name: string; preferredLanguage: string | null };
  scope: { functionId: string | null };
  functions: Array<{
    id: string;
    name: string;
    description: string | null;
    startsAt: string | null;
    endsAt: string | null;
    status: string;
    venue: { name: string; address: string | null; city: string | null; mapUrl: string | null } | null;
    attendeeLimit: number;
    rsvpOpen: boolean;
    rsvp: { status: RsvpStatus; attendeeCount: number; answers: Record<string, unknown> } | null;
    questions: Array<{
      id: string;
      key: string;
      label: string;
      type: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SINGLE_CHOICE' | 'MULTI_CHOICE';
      options: Array<{ value: string; label: string }>;
      required: boolean;
    }>;
    /** This guest's table at this function. */
    seat: { tableLabel: string; seatLabel: string | null } | null;
  }>;
  eventRsvp: { status: RsvpStatus; attendeeCount: number } | null;
  eventRsvpOpen: boolean;
  message: string | null;
  template: { key: string; definition: TemplateDefinition; customization: Customization | null } | null;
  context: RenderContext;
  watermark: boolean;
  mediaRooms: Array<{ name: string; code: string; uploadsEnabled: boolean; canViewGallery: boolean }>;
  checkInCode: string | null;
  /** This guest's own stay and travel; the host may ask them to add travel plans. */
  logistics: {
    collectTravel: boolean;
    stay: {
      hotelName: string;
      address: string | null;
      mapUrl: string | null;
      roomNumber: string | null;
      roomType: string | null;
      checkInAt: string | null;
      checkOutAt: string | null;
      notes: string | null;
    } | null;
    arrival: GuestTravel | null;
    departure: GuestTravel | null;
  };
}

export interface GuestTravel {
  direction: 'ARRIVAL' | 'DEPARTURE';
  mode: 'FLIGHT' | 'TRAIN' | 'ROAD' | 'BUS' | 'OTHER';
  carrier: string | null;
  reference: string | null;
  at: string;
  place: string | null;
  travellers: number;
  pickupRequested: boolean;
  pickupNote: string | null;
  enteredByGuest: boolean;
}

export interface FeatureValue {
  enabled: boolean;
  limit: number | null;
  source: 'FREE_PLAN' | 'EVENT_PURCHASE' | 'SUBSCRIPTION';
}

export interface ResolvedTemplate {
  templateId: string;
  templateKey: string;
  templateVersionId: string;
  tier: 'FREE' | 'STANDARD' | 'PREMIUM';
  definition: import('@bulava/template-schema').TemplateDefinition;
  customization: import('@bulava/template-schema').Customization | null;
  isDefault: boolean;
}

export interface DesignState {
  selections: { WEBSITE: ResolvedTemplate | null; VIDEO: ResolvedTemplate | null; DIGITAL_CARD: ResolvedTemplate | null };
  context: import('@bulava/template-schema').RenderContext;
  entitlements: Record<string, FeatureValue>;
  watermark: boolean;
}

export interface VideoJob {
  id: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  error: string | null;
  templateName: string;
  output: 'VIDEO' | 'DIGITAL_CARD';
  createdAt: string;
  finishedAt: string | null;
  result: { width: number; height: number; durationSeconds: number; sizeBytes: number; watermarked: boolean } | null;
}

/** A folder of the event album: one per function, General, or one the host added. */
export interface SubAlbum {
  id: string;
  kind: 'GENERAL' | 'FUNCTION' | 'CUSTOM';
  name: string;
  functionId: string | null;
  functionStartsAt: string | null;
  /** The function was deleted; its photos stay here. */
  functionRemoved: boolean;
  showInGallery: boolean;
  showOnWall: boolean;
  itemCount: number;
  pendingCount: number;
}

/** The event's one photo album: a single upload link, gallery and live wall, with sub-albums. */
export interface EventAlbum {
  id: string;
  name: string;
  galleryVisibility: 'PUBLIC' | 'PRIVATE' | 'INVITE_ONLY' | 'FUNCTION_RESTRICTED';
  moderationMode: 'AUTO_APPROVE' | 'MANUAL_APPROVAL' | 'AI_ASSISTED';
  uploadsEnabled: boolean;
  liveWallEnabled: boolean;
  /** Secret link for the live photo wall (only while it is on). */
  wallUrl: string | null;
  downloadPolicy: { guestsCanDownload: boolean; originalQuality: boolean };
  qrCode: string | null;
  uploadUrl: string | null;
  galleryUrl: string | null;
  itemCount: number;
  pendingCount: number;
  albums: SubAlbum[];
}

export interface MediaItem {
  id: string;
  kind: string;
  status: 'PROCESSING' | 'PENDING_MODERATION' | 'APPROVED' | 'REJECTED';
  albumId?: string | null;
  uploaderName: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  createdAt: string;
  thumbUrl: string | null;
  viewUrl: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: { all?: true; functionIds?: string[]; groupIds?: string[]; guestIds?: string[] };
  publishedAt: string | null;
  createdAt: string;
}

export interface AttendanceRow {
  functionId: string | null;
  name: string;
  guestsCheckedIn: number;
  headcount: number;
  expectedHeadcount: number;
}

export interface Plan {
  key: string;
  name: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  interval: 'ONE_TIME' | 'YEAR';
  features: Array<{ featureKey: string; enabled: boolean; limit: number | null }>;
}

export interface OrderRow {
  id: string;
  status: 'CREATED' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  amountMinor: number;
  createdAt: string;
  plan: { key: string; name: string };
}

export interface TemplateSummaryLite {
  key: string;
  name: string;
  description: string | null;
  category: string;
  tier: 'FREE' | 'STANDARD' | 'PREMIUM';
  badge: string | null;
  tags: string[];
  eventTypes: string[];
  outputs: Array<'WEBSITE' | 'VIDEO' | 'DIGITAL_CARD'>;
  /** What a card shows without the definition: the theme's colours, the hero section's variant, and the design's look (shared by one design's versions for other occasions). */
  preview?: { colors: import('@bulava/template-schema').ThemeColors | null; heroVariant: string | null; look?: string | null };
  definition?: import('@bulava/template-schema').TemplateDefinition;
}

/** Public registration state shown on /e/[slug] (no personal data). */
export interface PublicRegistrationInfo {
  enabled: boolean;
  open: boolean;
  fields: Array<{
    key: string;
    label: Record<string, string>;
    type: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SINGLE_CHOICE' | 'MULTI_CHOICE';
    options: Array<{ value: string; label: Record<string, string> }>;
    required: boolean;
  }>;
  approvalRequired: boolean;
  spotsLeft: number | null;
  full: boolean;
  waitlist: boolean;
  closesAt: string | null;
}

// ───── Event team ─────

export type TeamRole = 'ADMIN' | 'CO_HOST' | 'FUNCTION_MANAGER' | 'GUEST_MANAGER' | 'MEDIA_MANAGER' | 'PHOTOGRAPHER';

export interface TeamMember {
  id: string;
  role: TeamRole | 'OWNER';
  functionIds: string[];
  createdAt: string;
  user: { id: string; name: string; email: string | null };
  isYou: boolean;
}

/** An invitation emailed to someone without an account yet (they join with the code). */
export interface TeamInvite {
  id: string;
  email: string;
  role: TeamRole;
  functionIds: string[];
  /** LOCKED after too many wrong codes; resending unlocks it. */
  status: 'PENDING' | 'LOCKED';
  createdAt: string;
  invitedBy: string | null;
}

export interface TeamList {
  members: TeamMember[];
  invites: TeamInvite[];
}
