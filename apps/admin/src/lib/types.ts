/** Shapes returned by the admin API (dates arrive as ISO strings). */

export type PlatformPermission =
  | 'admin.read'
  | 'template.manage'
  | 'asset.manage'
  | 'pricing.manage'
  | 'user.manage'
  | 'content.manage'
  | 'media.moderate'
  | 'billing.read'
  | 'payment.refund'
  | 'plan.grant'
  | 'settings.manage'
  | 'staff.manage';
export type PlatformRole = 'USER' | 'SUPPORT' | 'CONTENT_MANAGER' | 'FINANCE_MANAGER' | 'PLATFORM_ADMIN' | 'SUPER_ADMIN';
/** Roles the Super Admin can give; SUPER_ADMIN itself is handed over, never assigned. */
export const ASSIGNABLE_ROLES: PlatformRole[] = ['USER', 'SUPPORT', 'CONTENT_MANAGER', 'FINANCE_MANAGER', 'PLATFORM_ADMIN'];
/** Most senior first. */
export const ROLE_RANK: Record<PlatformRole, number> = { SUPER_ADMIN: 0, PLATFORM_ADMIN: 1, FINANCE_MANAGER: 2, CONTENT_MANAGER: 3, SUPPORT: 4, USER: 5 };

export interface Me {
  id: string;
  name: string;
  email: string | null;
  platformRole: PlatformRole;
  platformPermissions: PlatformPermission[];
  mfaEnabled: boolean;
  /** This session passed two-step sign-in. */
  mfaVerified: boolean;
  /** Staff must pass two-step sign-in before admin routes answer. */
  mfaRequired: boolean;
}

export interface MfaStatus {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
  requiredForStaff: boolean;
  sessionVerified: boolean;
}

export interface AdminStats {
  users: number;
  events: number;
  activeEvents: number;
  invitations: number;
  rsvps: number;
  videosGenerated: number;
  renderFailures: number;
  mediaUploads: number;
  storageBytes: number;
  revenueMinor: number;
  orders: number;
  conversion: number;
  popularTemplates: Array<{ name: string; key: string; count: number }>;
  popularLanguages: Array<{ language: string; count: number }>;
  queues: QueueCounts;
}

export type QueueCounts = Record<string, Partial<Record<'waiting' | 'active' | 'completed' | 'failed' | 'delayed', number>>>;

export type TemplateStatus = 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';
export type TemplateType = 'WEBSITE' | 'VIDEO' | 'DIGITAL_CARD' | 'EMAIL' | 'SOCIAL';
export type TemplateTier = 'FREE' | 'STANDARD' | 'PREMIUM';

export interface TemplateVersionSummary {
  id: string;
  version: number;
  status: TemplateStatus;
  publishedAt: string | null;
  createdAt: string;
  type?: TemplateType;
  changelog?: string | null;
}

export interface AdminTemplate {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  style: string | null;
  tier: TemplateTier;
  badge: 'NEW' | 'POPULAR' | 'BESTSELLER' | null;
  featured: boolean;
  sortOrder: number;
  eventTypes: string[];
  languages: string[];
  outputs: TemplateType[];
  tags: string[];
  status: TemplateStatus;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  versions: TemplateVersionSummary[];
}

export interface TemplateDetail {
  template: AdminTemplate;
  working: TemplateVersionSummary & { definition: unknown; type: TemplateType };
  usage: number;
}

export interface CheckReport {
  ok: boolean;
  issues: Array<{ path: string; message: string }>;
  licenseIssues: Array<{ assetId: string; message: string }>;
  matrix: Array<{ case: string; empty: string[]; long: string[]; durationSec?: number }>;
}

export interface License {
  id: string;
  licenseType: string;
  provider: string;
  source: string | null;
  purchaseReference: string | null;
  commercialUse: boolean;
  onDemandUse: boolean;
  socialMediaUse: boolean;
  attributionRequired: boolean;
  attributionText: string | null;
  expiresAt: string | null;
}

export type AssetStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'ARCHIVED';

export interface Asset {
  id: string;
  name: string;
  type: 'IMAGE' | 'VIDEO' | 'SVG' | 'AUDIO' | 'FONT' | 'LOTTIE';
  category: string;
  tags: string[];
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  status: AssetStatus;
  createdAt: string;
  license: License | null;
  previewUrl: string;
  usage: number;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string | null;
  durationSeconds: number;
  collection: 'ORIGINAL' | 'LICENSED';
  status: AssetStatus;
  createdAt: string;
  license: License;
  previewUrl: string;
}

export interface LicenseAlert {
  licenseId: string;
  provider: string;
  expiresAt: string;
  expired: boolean;
  assets: Array<{ id: string; name: string; templates: Array<{ id: string; key: string; name: string; status: TemplateStatus }> }>;
  music: Array<{ id: string; title: string }>;
}

export interface PlanFeature {
  id: string;
  featureKey: string;
  enabled: boolean;
  limit: number | null;
}

export interface Plan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  interval: string;
  active: boolean;
  sortOrder: number;
  features: PlanFeature[];
}

export interface Coupon {
  id: string;
  code: string;
  percentOff: number | null;
  amountOffMinor: number | null;
  maxRedemptions: number | null;
  redemptions: number;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
  createdAt: string;
}

export type OrderStatus = 'CREATED' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
/** What a payment means to a reader: complimentary, awaiting payment, abandoned checkout… */
export type PaymentState = OrderStatus | 'COMPLIMENTARY' | 'REVOKED' | 'AWAITING_PAYMENT' | 'ABANDONED' | 'PAID_WITH_COUPON';

export interface OrderPayment {
  provider: string;
  providerPaymentId: string;
  status: string;
  amountMinor: number;
  verifiedAt: string | null;
  createdAt?: string;
}

export interface Order {
  id: string;
  kind: 'PURCHASE' | 'ADMIN_GRANT';
  eventId: string | null;
  eventTitle: string | null;
  amountMinor: number;
  currency: string;
  status: OrderStatus;
  state: PaymentState;
  note: string | null;
  /** Who gave a complimentary upgrade. */
  grantedBy: string | null;
  providerOrderId: string | null;
  createdAt: string;
  plan: { key: string; name: string };
  user: { id: string; email: string | null; name: string };
  coupon: { code: string } | null;
  payments: OrderPayment[];
}

export interface OrdersResponse {
  orders: Order[];
  /** Customer purchases by status (complimentary upgrades are not revenue). */
  totals: Partial<Record<OrderStatus, { count: number; amountMinor: number }>>;
}

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export interface AdminUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  platformRole: PlatformRole;
  totpEnabledAt: string | null;
  createdAt: string;
  _count: { ownedEvents: number; orders: number };
}

export interface UserProfile {
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    status: UserStatus;
    platformRole: PlatformRole;
    locale: string | null;
    emailVerifiedAt: string | null;
    phoneVerifiedAt: string | null;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
    googleLinked: boolean;
    mfaEnabled: boolean;
    lastActiveAt: string | null;
  };
  summary: {
    events: number;
    guests: number;
    invitations: number;
    photos: number;
    videos: number;
    /** Only for staff who can see billing. */
    paidOrders?: number;
    totalPaidMinor?: number;
    currency?: string;
    accountPlan: string | null;
  };
  events: Array<{
    id: string;
    title: string;
    typeKey: string;
    status: string;
    slug: string | null;
    createdAt: string;
    counts: { guests: number; invitations: number; videoJobs: number; functions: number; photos: number };
    plan: string;
    templates: Array<{ output: string; key: string; name: string; tier: TemplateTier; version: number; chosenAt: string }>;
    videos: Array<{ template: string; status: string; createdAt: string }>;
    domain: { hostname: string; status: string } | null;
  }>;
  memberships: Array<{ role: string; event: { id: string; title: string; status: string } }>;
  entitlements: Array<{
    featureKey: string;
    enabled: boolean;
    limit: number | null;
    used: number;
    eventId: string | null;
    eventTitle: string | null;
    sourceType: string;
    validFrom: string;
    validUntil: string | null;
    active: boolean;
  }>;
  /** Null for staff without billing access. */
  orders: Array<{
    id: string;
    kind: Order['kind'];
    plan: { key: string; name: string };
    eventId: string | null;
    eventTitle: string | null;
    amountMinor: number;
    currency: string;
    status: OrderStatus;
    state: PaymentState;
    coupon: string | null;
    note: string | null;
    grantedBy: string | null;
    providerOrderId: string | null;
    createdAt: string;
    payments: OrderPayment[];
  }> | null;
  sessions: Array<{ id: string; createdAt: string; lastUsedAt: string | null; userAgent: string | null; ipAddress: string | null; mfa: boolean }>;
  activity: Array<{ id: string; action: string; actorId: string | null; byThisUser: boolean; targetType: string; result: string; createdAt: string; ipAddress: string | null }>;
}

export interface StaffOverview {
  people: Array<{ id: string; name: string; email: string | null; status: UserStatus; platformRole: PlatformRole; mfaEnabled: boolean; createdAt: string }>;
  staffMfaRequired: boolean;
  /** Permissions each role carries. */
  roles: Record<PlatformRole, PlatformPermission[]>;
}

// ───── Site settings ─────

export type SettingGroup = 'site' | 'seo' | 'tracking' | 'code' | 'payments' | 'email' | 'whatsapp' | 'maps' | 'domains';

export interface SettingCheckStep {
  label: string;
  /** true passed, false failed, null information. */
  ok: boolean | null;
  detail?: string;
}

export interface SettingCheckResult {
  ok: boolean;
  steps: SettingCheckStep[];
  checkedAt: string;
}

export interface SettingGroupView<V = Record<string, unknown>> {
  value: V;
  secrets: Record<string, { set: boolean; hint: string | null }>;
  /** admin: saved in the console; environment: server variables until the first save; default: nothing set. */
  source: 'admin' | 'environment' | 'default';
  updatedAt: string | null;
  updatedBy: string | null;
  lastCheck: SettingCheckResult | null;
  /** Stored values that no longer pass validation. */
  ignored: string[];
}

export interface SettingsOverview {
  groups: Record<SettingGroup, SettingGroupView>;
  storage: {
    configured: boolean;
    endpoint?: string;
    publicEndpoint?: string;
    bucket?: string;
    region?: string;
    accessKeyHint?: string | null;
    source: 'environment';
    lastCheck: SettingCheckResult | null;
  };
  origins: { web: string; paymentsWebhook: string };
  assetPreviews: Record<'logo' | 'favicon' | 'ogImage', string | null>;
}

export interface ModerationItem {
  id: string;
  eventTitle: string;
  roomName: string;
  uploaderName: string | null;
  createdAt: string;
  thumbUrl: string | null;
}

export interface FailedRender {
  id: string;
  eventId: string;
  error: string | null;
  attempts: number;
  createdAt: string;
  templateVersion: { template: { name: string } };
}

export interface Testimonial {
  id: string;
  quote: string;
  authorName: string;
  location: string | null;
  eventLabel: string | null;
  rating: number;
  consentAt: string;
  published: boolean;
  sortOrder: number;
}

export interface AuditEntry {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  eventId: string | null;
  result: string;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface EventTypeOption {
  key: string;
  name: string;
}
