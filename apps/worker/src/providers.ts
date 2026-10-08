import { createHash } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import { CloudflareSaasProvider, ManualHostnameProvider, type HostnameProvider, type RoutingTarget } from '@bulava/domains';
import { WHATSAPP_DELIVERY_TAG, whatsappReady, type ResolvedSetting, type SettingsStore } from '@bulava/settings';

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
  /** Authentication templates: the code for the "copy code" button. */
  copyCode?: string;
}

/** Where a sent message stands, as its provider reports it; `status` null = nothing newer to report. */
export interface WhatsAppDeliveryState {
  status: 'sent' | 'delivered' | 'read' | 'failed' | null;
  error?: string;
}

export interface WhatsAppProvider {
  readonly name: string;
  /** Recorded on invitation delivery rows ('getgabs', 'meta'). */
  readonly tag?: string;
  sendTemplate(message: WhatsAppTemplateMessage): Promise<{ messageId: string }>;
  /**
   * Asks for a sent message's delivery state. Only providers that report it on
   * request have this (GetGabs); Meta pushes statuses to the webhook instead.
   */
  deliveryState?(messageId: string): Promise<WhatsAppDeliveryState>;
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
  readonly tag = WHATSAPP_DELIVERY_TAG.META_CLOUD;

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
          ...(message.params.length || message.copyCode
            ? {
                components: [
                  ...(message.params.length ? [{ type: 'body', parameters: message.params.map((text) => ({ type: 'text', text })) }] : []),
                  // Authentication templates carry the code again on their copy-code (URL) button.
                  ...(message.copyCode ? [{ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: message.copyCode }] }] : []),
                ],
              }
            : {}),
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

export const GETGABS_API_BASE = 'https://app.getgabs.com';

const digits = (phone: string) => phone.replace(/[^\d]/g, '');

/** What GetGabs answers: Meta's send response, or `{ status: false, message }` (and sometimes Meta's `error`) when it refuses. */
interface GetGabsResponse {
  status?: boolean;
  messages?: Array<{ id?: string; message_status?: string }>;
  message?: string | { status?: string; error_message?: string | null };
  msg?: string;
  error?: string | { message?: string; code?: number };
}

/** A refusal as a send error; GetGabs reports some with HTTP 200, which count as client errors unless they ask to slow down. */
function getGabsError(httpStatus: number, body: GetGabsResponse): WhatsAppSendError {
  const message =
    (typeof body.error === 'object' ? body.error?.message : body.error) ??
    (typeof body.message === 'string' ? body.message : undefined) ??
    body.msg ??
    `GetGabs answered HTTP ${httpStatus}`;
  const code = typeof body.error === 'object' ? body.error?.code : undefined;
  const status = httpStatus >= 200 && httpStatus < 300 ? (/rate|too many|try again/i.test(message) ? 429 : 400) : httpStatus;
  return new WhatsAppSendError(message, code, status);
}

const DELIVERY_STATES = new Set(['sent', 'delivered', 'read', 'failed']);

/**
 * WhatsApp Business messages through GetGabs (app.getgabs.com), a Meta
 * business partner: the same approved templates as the Cloud API, sent with
 * the GetGabs API key from the sender number connected in its panel. GetGabs'
 * webhook carries incoming chats, not delivery reports, so delivery is read
 * back per message (see whatsapp-status.ts).
 */
export class GetGabsWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'GETGABS';
  readonly tag = WHATSAPP_DELIVERY_TAG.GETGABS;

  constructor(
    private readonly options: { apiKey: string; senderNumber: string; campaignId?: string; apiBase?: string },
    private readonly http: typeof fetch = fetch,
  ) {}

  private async post(path: string, payload: object): Promise<{ res: Response; body: GetGabsResponse }> {
    const base = (this.options.apiBase || GETGABS_API_BASE).replace(/\/$/, '');
    const res = await this.http(`${base}${path}`, {
      method: 'POST',
      // The key travels in the body: that is how GetGabs authenticates its messaging API.
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ api_key: this.options.apiKey, ...payload }),
      signal: AbortSignal.timeout(15_000),
    });
    return { res, body: (await res.json().catch(() => ({}))) as GetGabsResponse };
  }

  async sendTemplate(message: WhatsAppTemplateMessage): Promise<{ messageId: string }> {
    // Component casing as in GetGabs' documentation.
    const components = [
      ...(message.params.length ? [{ type: 'BODY', parameters: message.params.map((text) => ({ type: 'text', text })) }] : []),
      // Authentication templates carry the code again on their copy-code (URL) button.
      ...(message.copyCode ? [{ type: 'button', sub_type: 'URL', index: 0, parameters: [{ type: 'text', text: message.copyCode }] }] : []),
    ];
    const { res, body } = await this.post('/whatsappbusiness/send-templated-message', {
      sender: digits(this.options.senderNumber),
      campaign_id: this.options.campaignId ?? '',
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: digits(message.to),
      type: 'template',
      template: { name: message.template, language: { code: message.language }, ...(components.length ? { components } : {}) },
    });
    if (!res.ok || body.status === false || body.error) throw getGabsError(res.status, body);
    return { messageId: body.messages?.[0]?.id ?? '' };
  }

  async deliveryState(messageId: string): Promise<WhatsAppDeliveryState> {
    const { res, body } = await this.post('/whatsappbusiness/getmessgageinfobyid', { message_id: messageId });
    if (!res.ok || body.status === false) throw getGabsError(res.status, body);
    const info = typeof body.message === 'object' && body.message ? body.message : {};
    const status = String(info.status ?? '').toLowerCase();
    return {
      status: DELIVERY_STATES.has(status) ? (status as WhatsAppDeliveryState['status']) : null,
      ...(info.error_message ? { error: String(info.error_message).slice(0, 500) } : {}),
    };
  }
}

export interface WhatsAppChannel {
  provider: WhatsAppProvider;
  /** Approved template names by purpose; a missing one keeps that message off WhatsApp. */
  templates: { invitation?: string; reminder?: string; preview?: string; otp?: string };
  language: string;
}

/** The provider the settings choose, or null while WhatsApp is off or incomplete. `bases` point the APIs elsewhere (tests). */
export function whatsappFromSettings(s: ResolvedSetting<'whatsapp'>, bases: { meta?: string; getgabs?: string } = {}): WhatsAppChannel | null {
  const v = s.value;
  if (!whatsappReady(v, s.secrets)) return null;
  const provider =
    v.provider === 'GETGABS'
      ? new GetGabsWhatsAppProvider({ apiKey: s.secrets.apiKey!, senderNumber: v.senderNumber!, campaignId: v.campaignId, apiBase: bases.getgabs })
      : new MetaWhatsAppProvider({ phoneNumberId: v.phoneNumberId!, accessToken: s.secrets.accessToken!, apiVersion: v.apiVersion, apiBase: bases.meta });
  return { provider, templates: v.templates, language: v.templateLanguage };
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
    private readonly options: { webHost: string; whatsappApiBase?: string; getgabsApiBase?: string; cloudflareApiBase?: string },
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
    if (this.whatsappCache?.key !== key) {
      this.whatsappCache = { key, channel: whatsappFromSettings(s, { meta: this.options.whatsappApiBase, getgabs: this.options.getgabsApiBase }) };
    }
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
