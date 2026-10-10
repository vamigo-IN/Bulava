export interface PublicUser {
  id: string;
  name: string;
  email: string | null;
  /** WhatsApp number, E.164. */
  phone: string | null;
  locale: string;
  platformRole: string;
  /**
   * Made from a WhatsApp number alone (the template page's quick start) and not
   * yet secured with a verified code, an email confirmed with its code, or Google. Such an
   * account designs and previews, but cannot publish, pay or invite.
   */
  provisional: boolean;
  /** Agreed to updates on WhatsApp (a separate, optional consent). */
  whatsappUpdates: boolean;
}

/** What the apps may see of an account. */
export function toPublicUser(user: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  locale: string;
  platformRole: string;
  provisional: boolean;
  whatsappOptInAt: Date | null;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    locale: user.locale,
    platformRole: user.platformRole,
    provisional: user.provisional,
    whatsappUpdates: user.whatsappOptInAt !== null,
  };
}
