export interface PublicUser {
  id: string;
  name: string;
  email: string | null;
  locale: string;
  platformRole: string;
}

/** What the apps may see of an account. */
export function toPublicUser(user: { id: string; name: string; email: string | null; locale: string; platformRole: string }): PublicUser {
  return { id: user.id, name: user.name, email: user.email, locale: user.locale, platformRole: user.platformRole };
}
