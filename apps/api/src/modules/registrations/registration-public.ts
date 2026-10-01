import type { Prisma } from '@bulava/database';
import { RegistrationFieldsSchema, type RegistrationField } from '@bulava/validation';

// Pure helpers shared by the public event page and the registrations service.
// Kept free of service imports so PublicEventsService can use them without a cycle.

/** What the public event page needs to show the form (no personal data). */
export interface PublicRegistrationInfo {
  enabled: boolean;
  open: boolean;
  fields: RegistrationField[];
  approvalRequired: boolean;
  spotsLeft: number | null;
  full: boolean;
  waitlist: boolean;
  closesAt: string | null;
}

export function summarizeForPublic(
  settings: { enabled: boolean; fields: Prisma.JsonValue; maxRegistrations: number | null; approvalRequired: boolean; waitlistEnabled: boolean; closesAt: Date | null } | null,
  confirmed: number,
  eventActive: boolean,
): PublicRegistrationInfo | null {
  if (!settings?.enabled) return null;
  const fields = RegistrationFieldsSchema.safeParse(settings.fields);
  const spotsLeft = settings.maxRegistrations === null ? null : Math.max(0, settings.maxRegistrations - confirmed);
  const full = spotsLeft === 0;
  const closed = !!settings.closesAt && settings.closesAt <= new Date();
  return {
    enabled: true,
    open: eventActive && !closed && (!full || settings.waitlistEnabled || settings.approvalRequired),
    fields: fields.success ? fields.data : [],
    approvalRequired: settings.approvalRequired,
    spotsLeft,
    full,
    waitlist: full && settings.waitlistEnabled,
    closesAt: settings.closesAt?.toISOString() ?? null,
  };
}
