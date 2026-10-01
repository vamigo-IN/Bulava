import type { SettingGroup } from '@bulava/validation';

export interface EnvFallback {
  value: Record<string, unknown>;
  secrets: Record<string, string>;
}

const list = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const present = (o: Record<string, string | undefined>) => Object.fromEntries(Object.entries(o).filter((e): e is [string, string] => Boolean(e[1])));

/** "Bulava <no-reply@bulava.in>" or a bare address. */
function parseFrom(from: string | undefined): { fromName?: string; fromEmail?: string } {
  if (!from) return {};
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  if (m) return { fromName: m[1]?.trim() || undefined, fromEmail: m[2]?.trim() };
  return { fromEmail: from.trim() };
}

/**
 * Settings that were configured through environment variables before the
 * admin console managed them. Used until the group is first saved in the
 * console; saving copies these values (and secrets) into the database.
 */
export function envFallback(group: SettingGroup, env: NodeJS.ProcessEnv): EnvFallback | null {
  switch (group) {
    case 'payments':
      if (!env.RAZORPAY_KEY && !env.RAZORPAY_SECRET) return null;
      return { value: { keyId: env.RAZORPAY_KEY }, secrets: present({ keySecret: env.RAZORPAY_SECRET, webhookSecret: env.RAZORPAY_WEBHOOK_SECRET }) };
    case 'email':
      if (!env.SMTP_HOST) return null;
      return {
        value: { host: env.SMTP_HOST, port: env.SMTP_PORT || 587, username: env.SMTP_USER || undefined, ...parseFrom(env.SMTP_FROM) },
        secrets: present({ password: env.SMTP_PASSWORD }),
      };
    case 'domains': {
      const cloudflare = Boolean(env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ZONE_ID);
      const mode = cloudflare ? 'cloudflare' : env.CUSTOM_DOMAIN_TLS === 'manual' ? 'manual' : null;
      if (!mode && !env.CUSTOM_DOMAIN_TARGET) return null;
      return {
        value: { mode: mode ?? 'off', zoneId: env.CLOUDFLARE_ZONE_ID || undefined, cnameTarget: env.CUSTOM_DOMAIN_TARGET || undefined, addresses: list(env.CUSTOM_DOMAIN_ADDRESSES) },
        secrets: present({ cloudflareApiToken: env.CLOUDFLARE_API_TOKEN }),
      };
    }
    case 'whatsapp':
      if (!env.WHATSAPP_PHONE_NUMBER_ID) return null;
      return {
        value: {
          enabled: Boolean(env.WHATSAPP_ACCESS_TOKEN),
          phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
          businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID || undefined,
          templates: { invitation: env.WHATSAPP_INVITATION_TEMPLATE || undefined, reminder: env.WHATSAPP_REMINDER_TEMPLATE || undefined },
          ...(env.WHATSAPP_TEMPLATE_LANGUAGE ? { templateLanguage: env.WHATSAPP_TEMPLATE_LANGUAGE } : {}),
        },
        secrets: present({ accessToken: env.WHATSAPP_ACCESS_TOKEN, appSecret: env.WHATSAPP_APP_SECRET }),
      };
    case 'maps':
      // Filled in but off: maps appear on guest invitations only once the Super Admin
      // has seen the preview work and switched them on (a key without the Maps Embed API
      // enabled would show Google's error box on every invitation).
      if (!env.GOOGLE_MAPS_KEY) return null;
      return { value: { enabled: false, embedKey: env.GOOGLE_MAPS_KEY }, secrets: {} };
    case 'tracking': {
      const value = present({
        ga4Id: env.NEXT_PUBLIC_GA4_ID ?? env.GA4_ID,
        posthogKey: env.NEXT_PUBLIC_POSTHOG_KEY ?? env.POSTHOG_KEY,
        posthogHost: env.NEXT_PUBLIC_POSTHOG_HOST ?? env.POSTHOG_HOST,
      });
      return Object.keys(value).length ? { value, secrets: {} } : null;
    }
    default:
      return null;
  }
}
