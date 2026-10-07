import { createHash } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import { CloudflareSaasProvider, ManualHostnameProvider, type HostnameProvider, type RoutingTarget } from '@bulava/domains';
import type { ResolvedSetting, SettingsStore } from '@bulava/settings';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Where replies go, when not the settings' reply-to address. */
  replyTo?: string;
}

/** Channel providers (spec §50): swap implementations without touching callers. */
export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ messageId: string }>;
}

export interface WhatsAppTemplateMessage {
  /** E.164 phone number. */
  to: string;
  /** An approved template name from WhatsApp Manager. */
  template: string;
  language: string;
  /** Body variables {{1}}, {{2}}, … in order. */
  params: string[];
}

export interface WhatsAppProvider {
  readonly name: string;
  sendTemplate(message: WhatsAppTemplateMessage): Promise<{ messageId: string }>;
}

export interface SmtpOptions {
  host: string;
  port: number;
  security?: 'auto' | 'ssl' | 'starttls' | 'none';
  user?: string;
  password?: string;
  replyTo?: string;
}

export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'SMTP';
  private readonly transport: Transporter;

  constructor(
    private readonly from: string,
    private readonly options: SmtpOptions,
  ) {
    const security = options.security ?? 'auto';
    this.transport = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      // ssl: TLS from the first byte; starttls: upgrade and refuse to continue without it.
      secure: security === 'ssl' || (security === 'auto' && options.port === 465),
      requireTLS: security === 'starttls',
      ignoreTLS: security === 'none',
      ...(options.user ? { auth: { user: options.user, pass: options.password } } : {}),
    });
  }

  async send(message: EmailMessage): Promise<{ messageId: string }> {
    // A message's own reply-to (a contact-form sender) wins over the settings' default.
    const replyTo = message.replyTo ?? this.options.replyTo;
    const info = await this.transport.sendMail({ from: this.from, to: message.to, subject: message.subject, html: message.html, text: message.text, ...(replyTo ? { replyTo } : {}) });
    return { messageId: info.messageId };
  }

  close(): void {
    this.transport.close();
  }
}

/** A display name that is safe inside "Name <address>". */
function fromHeader(name: string, email: string): string {
  const clean = name.replace(/["\\\r\n<>]/g, '').trim();
  return clean ? `"${clean}" <${email}>` : email;
}

export function emailProviderFromSettings(s: ResolvedSetting<'email'>): SmtpEmailProvider | null {
  const v = s.value;
  if (!v.enabled || !v.host) return null;
  const fromEmail = v.fromEmail ?? v.username ?? 'no-reply@bulava.in';
  return new SmtpEmailProvider(fromHeader(v.fromName, fromEmail), {
    host: v.host,
    port: v.port,
    security: v.security,
    user: v.username,
    password: s.secrets.password,
    replyTo: v.replyTo,
  });
}

/** WhatsApp Business messages through Meta's Cloud API (approved templates only). */
export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'META_CLOUD';

  constructor(
    private readonly options: { phoneNumberId: string; accessToken: string; apiVersion: string; apiBase?: string },
    private readonly http: typeof fetch = fetch,
  ) {}

  async sendTemplate(message: WhatsAppTemplateMessage): Promise<{ messageId: string }> {
    const base = (this.options.apiBase || 'https://graph.facebook.com').replace(/\/$/, '');
    const res = await this.http(`${base}/${this.options.apiVersion}/${this.options.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.options.accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: message.to.replace(/[^\d]/g, ''),
        type: 'template',
        template: {
          name: message.template,
          language: { code: message.language },
          ...(message.params.length ? { components: [{ type: 'body', parameters: message.params.map((text) => ({ type: 'text', text })) }] } : {}),
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => ({}))) as { messages?: Array<{ id?: string }>; error?: { message?: string; code?: number } };
    if (!res.ok) throw new WhatsAppSendError(body.error?.message ?? `HTTP ${res.status}`, body.error?.code, res.status);
    return { messageId: body.messages?.[0]?.id ?? '' };
  }
}

export class WhatsAppSendError extends Error {
  constructor(
    message: string,
    readonly code: number | undefined,
    readonly status: number,
  ) {
    super(message);
  }

  /** A retry cannot help: bad number, template or permissions (Graph 4xx other than rate limits). */
  get permanent(): boolean {
    return this.status >= 400 && this.status < 500 && this.status !== 429 && this.code !== 130429 && this.code !== 131048 && this.code !== 131056;
  }
}

export interface WhatsAppChannel {
  provider: WhatsAppProvider;
  templates: { invitation?: string; reminder?: string };
  language: string;
}

export function whatsappFromSettings(s: ResolvedSetting<'whatsapp'>, apiBase?: string): WhatsAppChannel | null {
  const v = s.value;
  const token = s.secrets.accessToken;
  if (!v.enabled || !v.phoneNumberId || !token) return null;
  return {
    provider: new MetaWhatsAppProvider({ phoneNumberId: v.phoneNumberId, accessToken: token, apiVersion: v.apiVersion, apiBase }),
    templates: v.templates,
    language: v.templateLanguage,
  };
}

export interface DomainRouting {
  provider: HostnameProvider;
  target: RoutingTarget;
}

const fingerprint = (...parts: unknown[]) => createHash('sha256').update(JSON.stringify(parts)).digest('hex');

/**
 * Channel providers built from the Super Admin's settings (admin console), so a
 * change applies without restarting the worker: settings are re-read at most
 * every few seconds and a provider is rebuilt only when its settings change.
 */
export class SettingsProviders {
  private emailCache?: { key: string; provider: SmtpEmailProvider | null };
  private whatsappCache?: { key: string; channel: WhatsAppChannel | null };
  private domainsCache?: { key: string; routing: DomainRouting | null };

  constructor(
    private readonly store: SettingsStore,
    private readonly options: { webHost: string; whatsappApiBase?: string; cloudflareApiBase?: string },
  ) {}

  async email(): Promise<EmailProvider | null> {
    const s = await this.store.get('email');
    const key = fingerprint(s.value, s.secrets);
    if (this.emailCache?.key !== key) {
      this.emailCache?.provider?.close();
      this.emailCache = { key, provider: emailProviderFromSettings(s) };
    }
    return this.emailCache.provider;
  }

  async whatsapp(): Promise<WhatsAppChannel | null> {
    const s = await this.store.get('whatsapp');
    const key = fingerprint(s.value, s.secrets);
    if (this.whatsappCache?.key !== key) this.whatsappCache = { key, channel: whatsappFromSettings(s, this.options.whatsappApiBase) };
    return this.whatsappCache.channel;
  }

  /** Where customer domains must point and who issues their certificates; null while custom domains are off. */
  async domains(): Promise<DomainRouting | null> {
    const s = await this.store.get('domains');
    const token = s.secrets.cloudflareApiToken;
    const key = fingerprint(s.value, token ?? '');
    if (this.domainsCache?.key !== key) {
      const provider =
        s.value.mode === 'cloudflare' && token && s.value.zoneId
          ? new CloudflareSaasProvider({ apiToken: token, zoneId: s.value.zoneId, apiBase: this.options.cloudflareApiBase })
          : s.value.mode === 'manual'
            ? new ManualHostnameProvider()
            : null;
      const target = { cname: (s.value.cnameTarget ?? `domains.${this.options.webHost}`).toLowerCase(), addresses: s.value.addresses };
      this.domainsCache = { key, routing: provider ? { provider, target } : null };
    }
    return this.domainsCache.routing;
  }
}
