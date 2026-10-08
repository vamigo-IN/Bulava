import { promises as dns } from 'node:dns';
import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Inject, Injectable } from '@nestjs/common';
import { SettingsStore, type ResolvedSetting } from '@bulava/settings';
import { ObjectStorage, StorageKeys } from '@bulava/storage';
import { z, type SettingCheckResult, type SettingCheckStep, type SettingGroup } from '@bulava/validation';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { STORAGE } from '../../infrastructure/storage/storage.module';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { googleRedirectUri } from '../auth/google-redirect';
import { escapeHtml } from '../guest-access/otp.service';
import { SETTINGS_STORE } from './settings.service';

export const CHECKABLE = ['payments', 'email', 'whatsapp', 'google', 'maps', 'domains', 'storage'] as const;
export type Checkable = (typeof CHECKABLE)[number];
export const RunCheckSchema = z.object({ to: z.string().trim().max(200).optional() });

const TIMEOUT = 10_000;

/** External APIs; tests and staging can point them elsewhere. */
function apiBase(name: 'RAZORPAY_API_BASE' | 'CLOUDFLARE_API_BASE' | 'WHATSAPP_API_BASE' | 'GETGABS_API_BASE', fallback: string): string {
  return (process.env[name] || fallback).replace(/\/$/, '');
}

/**
 * A JSON request with node's http client, which (unlike fetch) may send a body
 * with GET: GetGabs' session endpoint expects one. Never throws on an HTTP
 * status; a body that is not JSON comes back as {}.
 */
export function requestJson(url: string, options: { method: string; body?: object; headers?: Record<string, string> }): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const payload = options.body ? JSON.stringify(options.body) : undefined;
    const target = new URL(url);
    const req = (target.protocol === 'https:' ? httpsRequest : httpRequest)(
      target,
      {
        method: options.method,
        headers: { accept: 'application/json', ...(payload ? { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(payload)) } : {}), ...options.headers },
        timeout: TIMEOUT,
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          if (text.length < 1_000_000) text += chunk;
        });
        res.on('end', () => {
          let body: Record<string, unknown> = {};
          try {
            const parsed: unknown = JSON.parse(text);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
          } catch {
            // Not JSON: an HTML error page, for example.
          }
          resolve({ status: res.statusCode ?? 0, body });
        });
      },
    );
    req.on('timeout', () => req.destroy(Object.assign(new Error('No answer within 10 seconds'), { name: 'TimeoutError' })));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** The message in a JSON error answer, whichever field the API uses. */
function errorText(body: Record<string, unknown>): string | undefined {
  const error = body.error;
  if (typeof error === 'object' && error !== null && typeof (error as { message?: unknown }).message === 'string') return (error as { message: string }).message.slice(0, 300);
  for (const value of [error, body.error_description, body.message, body.msg]) if (typeof value === 'string' && value) return value.slice(0, 300);
  return undefined;
}

/** How many variables ({{1}}, {{2}}, …) Bulava fills in each kind of template. */
const TEMPLATE_VARIABLES = { invitation: 3, reminder: 3, preview: 3, otp: 1 } as const;
const TEMPLATE_KIND_LABEL = { invitation: 'invitation', reminder: 'reminder', preview: 'preview link', otp: 'sign-in code' } as const;

function describe(error: unknown): string {
  if (error instanceof Error) return error.name === 'TimeoutError' ? 'No answer within 10 seconds' : error.message.slice(0, 300);
  return String(error).slice(0, 300);
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * A browser-facing localhost address this process cannot connect to: the local
 * Docker stack, where localhost means the developer's machine to a browser but
 * the container itself here. Anything else is a real failure.
 */
export function unreachableLoopback(url: string, error: unknown): boolean {
  if (!LOOPBACK.has(new URL(url).hostname)) return false;
  // fetch() fails with the socket error in `cause` (an AggregateError when several addresses were tried).
  const cause = (error as { cause?: { code?: string; errors?: Array<{ code?: string }> } } | null)?.cause;
  const codes = [cause?.code, ...(cause?.errors ?? []).map((e) => e.code)];
  return codes.some((code) => code === 'ECONNREFUSED' || code === 'EADDRNOTAVAIL' || code === 'EHOSTUNREACH');
}

/**
 * "Check" buttons in the admin console: each integration is exercised for
 * real (credentials accepted, a test message delivered, a file written and
 * read back), and the result is remembered on the setting.
 */
@Injectable()
export class SettingsChecksService {
  constructor(
    @Inject(SETTINGS_STORE) private readonly store: SettingsStore,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly queues: QueueService,
    private readonly audit: AuditService,
  ) { }

  async run(target: Checkable, input: z.infer<typeof RunCheckSchema>, actor: { id: string; email: string | null }, meta: RequestMeta): Promise<SettingCheckResult> {
    const steps: SettingCheckStep[] = [];
    try {
      switch (target) {
        case 'payments':
          await this.payments(steps);
          break;
        case 'email':
          await this.email(steps, input.to || actor.email);
          break;
        case 'whatsapp':
          await this.whatsapp(steps, input.to);
          break;
        case 'google':
          await this.google(steps);
          break;
        case 'maps':
          await this.maps(steps);
          break;
        case 'domains':
          await this.domains(steps);
          break;
        case 'storage':
          await this.storageCheck(steps);
          break;
      }
    } catch (error) {
      steps.push({ label: 'Unexpected error', ok: false, detail: describe(error) });
    }
    const result: SettingCheckResult = { ok: steps.length > 0 && steps.every((s) => s.ok !== false), steps, checkedAt: new Date().toISOString() };
    await this.store.recordCheck(target as SettingGroup | 'storage', result);
    await this.audit.record({ actorType: 'USER', actorId: actor.id, action: 'settings.checked', targetType: 'PlatformSetting', targetId: target, metadata: { ok: result.ok }, meta });
    return result;
  }

  private async payments(steps: SettingCheckStep[]) {
    const s = await this.store.get('payments');
    steps.push({ label: 'Online payments switched on', ok: s.value.enabled ? true : null, detail: s.value.enabled ? undefined : 'Checkout is off: customers cannot buy plans.' });
    const secret = s.secrets.keySecret;
    if (!s.value.keyId || !secret) {
      steps.push({ label: 'Razorpay keys', ok: false, detail: 'Add the key id and key secret from the Razorpay dashboard (Account & Settings → API keys).' });
      return;
    }
    const live = s.value.keyId.startsWith('rzp_live_');
    steps.push({ label: 'Mode', ok: null, detail: live ? 'Live: real payments are charged.' : 'Test: no real money moves. Switch to live keys before launch.' });
    const res = await fetch(`${apiBase('RAZORPAY_API_BASE', 'https://api.razorpay.com/v1')}/payments?count=1`, {
      headers: { authorization: `Basic ${Buffer.from(`${s.value.keyId}:${secret}`).toString('base64')}` },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    steps.push(
      res.ok
        ? { label: 'Razorpay accepted the keys', ok: true }
        : { label: 'Razorpay accepted the keys', ok: false, detail: res.status === 401 ? 'Razorpay rejected the key id or secret.' : `Razorpay answered ${res.status}.` },
    );
    steps.push(
      s.secrets.webhookSecret
        ? { label: 'Webhook secret', ok: true, detail: 'Payments are also confirmed by Razorpay webhooks.' }
        : { label: 'Webhook secret', ok: null, detail: 'Not set: payments are confirmed only when the customer returns from checkout. Add the webhook in Razorpay and paste its secret.' },
    );
  }

  private async email(steps: SettingCheckStep[], to: string | null | undefined) {
    const s = await this.store.get('email');
    if (!s.value.enabled || !s.value.host) {
      steps.push({ label: 'Email settings', ok: false, detail: s.value.enabled ? 'Add the SMTP server first.' : 'Email is switched off.' });
      return;
    }
    if (!s.value.fromEmail) steps.push({ label: 'Sender address', ok: null, detail: 'No sender address: the worker uses no-reply@ on the site domain, which your provider may refuse.' });
    const address = z.email().safeParse(to);
    if (!address.success) {
      steps.push({ label: 'Test email', ok: false, detail: 'Enter an address to send the test email to.' });
      return;
    }
    // Sent by the worker with the saved settings, exactly as real emails are.
    const site = (await this.store.get('site')).value.name;
    const started = Date.now();
    try {
      const outcome = await this.queues.runAndWait(
        'email',
        {
          to: address.data,
          subject: `${site} email check`,
          text: `This is a test email from the ${site} admin console. Your email settings work.`,
          html: `<p>This is a test email from the ${escapeHtml(site)} admin console.</p><p><strong>Your email settings work.</strong></p>`,
        },
        45_000,
      );
      steps.push(
        outcome === 'sent'
          ? { label: `Test email sent to ${address.data}`, ok: true, detail: `Handed to ${s.value.host} in ${Math.round((Date.now() - started) / 100) / 10}s. Check the inbox (and spam folder).` }
          : { label: 'Test email', ok: false, detail: 'The worker has no email settings yet. Settings reach the worker within 15 seconds of saving; try again.' },
      );
    } catch (error) {
      const message = describe(error);
      steps.push({ label: 'Test email', ok: false, detail: /timed out|timeout/i.test(message) ? 'No worker picked up the email: is the worker running?' : `The mail server refused: ${message}` });
    }
  }

  private async whatsapp(steps: SettingCheckStep[], to: string | undefined) {
    const s = await this.store.get('whatsapp');
    steps.push({ label: 'WhatsApp switched on', ok: s.value.enabled ? true : null, detail: s.value.enabled ? undefined : 'Off: nothing is sent on WhatsApp.' });
    const connected = s.value.provider === 'GETGABS' ? await this.getgabs(steps, s) : await this.metaCloud(steps, s);
    if (!connected) return;
    const { invitation, reminder, preview, otp } = s.value.templates;
    steps.push({
      label: 'Message templates',
      ok: invitation && reminder ? true : null,
      detail: invitation && reminder ? `${invitation}, ${reminder}` : 'Add the approved template names for invitations and reminders.',
    });
    steps.push({
      label: 'Host messages',
      ok: null,
      detail: [
        preview ? `Preview links: ${preview}.` : 'No preview link template: quick-start previews are not sent on WhatsApp.',
        otp ? `Sign-in codes: ${otp}.` : 'No sign-in code template: hosts sign in with email or Google only.',
      ].join(' '),
    });
    if (to) await this.whatsappTest(steps, s, to);
  }

  /** GetGabs: the API key (it must open a session), each template as GetGabs has it, and the optional webhook. */
  private async getgabs(steps: SettingCheckStep[], s: ResolvedSetting<'whatsapp'>): Promise<boolean> {
    const apiKey = s.secrets.apiKey;
    if (!s.value.senderNumber || !apiKey) {
      steps.push({ label: 'GetGabs account', ok: false, detail: 'Add the API key (GetGabs → Settings → Developer Tools) and the WhatsApp number GetGabs sends from.' });
      return false;
    }
    steps.push({ label: 'Provider', ok: null, detail: `GetGabs, sending from ${s.value.senderNumber}${s.value.campaignId ? ` in campaign ${s.value.campaignId}` : ''}.` });
    const base = apiBase('GETGABS_API_BASE', 'https://app.getgabs.com');
    const session = await requestJson(`${base}/partners/getSessionToken`, { method: 'GET', body: { api_key: apiKey } }).catch((error: unknown) => ({
      status: 0,
      body: { message: describe(error) } as Record<string, unknown>,
    }));
    const token = typeof session.body.access_token === 'string' && session.body.access_token ? session.body.access_token : null;
    if (token) {
      steps.push({ label: 'GetGabs accepted the API key', ok: true });
      await this.getgabsTemplates(steps, base, token, apiKey, s.value);
    } else if (
      session.status === 401 ||
      session.status === 403 ||
      // A clear refusal; anything else (such as a key reported missing) is no proof the key is wrong.
      (session.body.status === false && /invalid|unauthori[sz]ed|not found|incorrect|wrong|expired|disabled/i.test(errorText(session.body) ?? ''))
    ) {
      steps.push({ label: 'GetGabs accepted the API key', ok: false, detail: `GetGabs answered: ${errorText(session.body) ?? `HTTP ${session.status}`}. Copy the key again from GetGabs.` });
      return false;
    } else {
      // The session endpoint is not the messaging API: an unexpected answer is no proof the key is wrong.
      steps.push({
        label: 'GetGabs accepted the API key',
        ok: null,
        detail: `GetGabs did not confirm it (${session.status ? `HTTP ${session.status}` : (errorText(session.body) ?? 'no answer')}). Send a test message to check the key.`,
      });
    }
    steps.push({
      label: 'Delivery reports',
      ok: null,
      detail: 'GetGabs reports delivery on request: Bulava asks about each invitation 5 minutes, 1 hour, 6 hours, 1 day and 3 days after sending.',
    });
    steps.push(
      s.secrets.webhookToken
        ? { label: 'Webhook', ok: true, detail: 'Replies to invitations mark them read, once the URL is in GetGabs → Settings → Developer Tools → Webhook URL for All Chats.' }
        : { label: 'Webhook', ok: null, detail: 'Optional: generate a webhook token so that replies to invitations mark them read.' },
    );
    return true;
  }

  /** Each template as GetGabs has it: approved, in the language Bulava sends, with as many variables as Bulava fills. */
  private async getgabsTemplates(steps: SettingCheckStep[], base: string, token: string, apiKey: string, v: ResolvedSetting<'whatsapp'>['value']) {
    for (const kind of ['invitation', 'reminder', 'preview', 'otp'] as const) {
      const name = v.templates[kind];
      if (!name) continue;
      const label = `Template ${name} (${TEMPLATE_KIND_LABEL[kind]})`;
      const res = await requestJson(`${base}/partners/api/template/fetchJson`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: { adminauthToken: apiKey, template_name: name },
      }).catch(() => null);
      const template = res?.body.template as { status?: unknown; language?: unknown; components?: Array<{ type?: unknown; text?: unknown }> } | undefined;
      if (!res || typeof template !== 'object' || template === null) {
        const missing = res !== null && (res.status === 404 || res.body.status === false);
        steps.push({
          label,
          ok: missing ? false : null,
          detail: missing
            ? `GetGabs has no template by this name (${errorText(res.body) ?? `HTTP ${res.status}`}). Create it in GetGabs → Templates and wait for Meta's approval.`
            : 'GetGabs did not return it; check the name in GetGabs → Templates.',
        });
        continue;
      }
      const status = typeof template.status === 'string' ? template.status.toUpperCase() : null;
      const language = typeof template.language === 'string' ? template.language : null;
      const body = Array.isArray(template.components) ? template.components.find((c) => typeof c.type === 'string' && c.type.toUpperCase() === 'BODY')?.text : undefined;
      const variables = typeof body === 'string' ? new Set((body.match(/\{\{\s*\d+\s*\}\}/g) ?? []).map((m) => m.replace(/\s/g, ''))).size : null;
      const failures = [
        status && status !== 'APPROVED' ? `Meta has not approved it (${status})` : null,
        variables !== null && variables !== TEMPLATE_VARIABLES[kind] ? `it has ${variables} variables; Bulava fills ${TEMPLATE_VARIABLES[kind]}` : null,
      ].filter((f): f is string => Boolean(f));
      const languageNote =
        language && language !== v.templateLanguage
          ? `GetGabs lists it in ${language}, but Bulava sends ${v.templateLanguage}: set the template language to ${language} unless the template also exists in ${v.templateLanguage}.`
          : null;
      steps.push({
        label,
        ok: failures.length ? false : languageNote ? null : true,
        detail: failures.length ? `${failures.join('; ')}.` : (languageNote ?? `${status ?? 'Found'} · ${language ?? v.templateLanguage}`),
      });
    }
  }

  /** Meta's Cloud API: the token and phone number (with its quality rating), and the optional webhook. */
  private async metaCloud(steps: SettingCheckStep[], s: ResolvedSetting<'whatsapp'>): Promise<boolean> {
    const token = s.secrets.accessToken;
    if (!s.value.phoneNumberId || !token) {
      steps.push({ label: 'WhatsApp Business account', ok: false, detail: 'Add the phone number ID and a permanent access token from Meta Business (WhatsApp Manager → API setup).' });
      return false;
    }
    const base = `${apiBase('WHATSAPP_API_BASE', 'https://graph.facebook.com')}/${s.value.apiVersion}`;
    const res = await fetch(`${base}/${s.value.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const body = (await res.json().catch(() => ({}))) as { display_phone_number?: string; verified_name?: string; quality_rating?: string; error?: { message?: string } };
    if (!res.ok) {
      steps.push({ label: 'Meta accepted the token', ok: false, detail: body.error?.message ?? `Meta answered ${res.status}.` });
      return false;
    }
    steps.push({ label: 'Meta accepted the token', ok: true, detail: `${body.verified_name ?? 'Business'} · ${body.display_phone_number ?? ''} · quality ${body.quality_rating ?? 'unknown'}` });
    steps.push(
      s.secrets.appSecret && s.secrets.webhookVerifyToken
        ? { label: 'Webhook configured', ok: true, detail: 'Delivery status updates (sent, delivered, read, failed) are verified with App Secret and Webhook Verify Token.' }
        : { label: 'Webhook configured', ok: null, detail: 'Optional: add App Secret and Webhook Verify Token to track real-time message delivery status from Meta.' },
    );
    return true;
  }

  /**
   * A real message, sent by the worker with its settings exactly as guests and
   * hosts get them: the first template set (invitation, reminder, preview link,
   * sign-in code) with sample details in its variables.
   */
  private async whatsappTest(steps: SettingCheckStep[], s: ResolvedSetting<'whatsapp'>, to: string) {
    const number = `+${to.replace(/[^\d]/g, '')}`;
    if (!/^\+[1-9]\d{7,14}$/.test(number)) {
      steps.push({ label: 'Test message', ok: false, detail: 'Enter the number in international format, like +919876543210.' });
      return;
    }
    const kind = (['invitation', 'reminder', 'preview', 'otp'] as const).find((k) => s.value.templates[k]);
    if (!kind) {
      steps.push({ label: 'Test message', ok: false, detail: 'Add a template name first: the test sends one of your approved templates.' });
      return;
    }
    const site = (await this.store.get('site')).value.name;
    const web = this.config.WEB_ORIGIN.replace(/\/$/, '');
    const params =
      kind === 'otp'
        ? ['123456']
        : kind === 'preview'
          ? ['Test', `${site} sample design`, `${web}/templates`]
          : ['Test guest', kind === 'reminder' ? `Sangeet · ${site} test event` : `${site} test event`, `${web}/`];
    try {
      const result = (await this.queues.runAndWait('whatsapp', { to: number, template: kind, params, ...(kind === 'otp' ? { copyCode: '123456' } : {}) }, 45_000)) as {
        outcome?: string;
        detail?: string;
        messageId?: string;
      } | null;
      if (result?.outcome === 'sent') {
        steps.push({ label: `Test message sent to ${number}`, ok: true, detail: `${result.detail ?? kind}, with sample details${result.messageId ? ` · message ${result.messageId}` : ''}.` });
      } else if (result?.outcome === 'skipped') {
        steps.push({ label: 'Test message', ok: false, detail: `${result.detail ?? 'Skipped'}. Settings reach the worker within 15 seconds of saving; try again.` });
      } else {
        steps.push({ label: 'Test message', ok: false, detail: result?.detail ?? 'The worker did not send it.' });
      }
    } catch (error) {
      const message = describe(error);
      steps.push({ label: 'Test message', ok: false, detail: /timed out|timeout/i.test(message) ? 'No worker picked up the message: is the worker running?' : message });
    }
  }

  /**
   * Google sign-in: the client ID and secret are tried at Google's token
   * endpoint with a made-up code, which Google answers with invalid_grant when
   * the client is right and invalid_client when it is not.
   */
  private async google(steps: SettingCheckStep[]) {
    const s = await this.store.get('google');
    steps.push({ label: 'Continue with Google switched on', ok: s.value.enabled ? true : null, detail: s.value.enabled ? undefined : 'Off: the sign-in and sign-up pages do not offer Google.' });
    const secret = s.secrets.clientSecret;
    if (!s.value.clientId || !secret) {
      steps.push({ label: 'OAuth client', ok: false, detail: 'Add the client ID and client secret of a Web application client (Google Cloud → APIs & Services → Credentials).' });
      return;
    }
    const redirect = googleRedirectUri(this.config);
    const res = await fetch(this.config.GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: 'bulava-connection-check', client_id: s.value.clientId, client_secret: secret, redirect_uri: redirect }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; error_description?: string };
    const label = 'Google accepted the client ID and secret';
    if (body.error === 'invalid_grant') {
      steps.push({ label, ok: true });
    } else if (body.error === 'invalid_client' || body.error === 'unauthorized_client') {
      steps.push({ label, ok: false, detail: `Google answered: ${body.error_description ?? body.error}. Copy both again from the client in Google Cloud.` });
    } else if (body.error === 'redirect_uri_mismatch') {
      steps.push({ label: 'Authorized redirect URI', ok: false, detail: `Add ${redirect} under Authorized redirect URIs on the client in Google Cloud.` });
      return;
    } else {
      steps.push({ label, ok: null, detail: `Unexpected answer from Google (HTTP ${res.status}${body.error ? `, ${body.error}` : ''}).` });
    }
    steps.push({ label: 'Authorized redirect URI', ok: null, detail: `${redirect} must be listed on the client; Google checks it when someone signs in.` });
  }

  private async maps(steps: SettingCheckStep[]) {
    const s = await this.store.get('maps');
    steps.push({ label: 'Maps switched on', ok: s.value.enabled ? true : null, detail: s.value.enabled ? undefined : 'Off: invitations show a directions link only.' });
    if (!s.value.embedKey) {
      steps.push({ label: 'Maps Embed API key', ok: false, detail: 'Create a browser key in Google Cloud with the Maps Embed API enabled, restricted to your site’s domains.' });
      return;
    }
    steps.push({
      label: 'Maps Embed API key',
      ok: null,
      detail: 'Google checks a restricted key against the page showing the map, so it can only be tested in a browser: the preview below uses it.',
    });
  }

  private async domains(steps: SettingCheckStep[]) {
    const s = await this.store.get('domains');
    const target = (s.value.cnameTarget ?? `domains.${new URL(this.config.WEB_ORIGIN).hostname}`).toLowerCase();
    if (s.value.mode === 'off') {
      steps.push({ label: 'Custom domains', ok: null, detail: 'Off: hosts cannot connect their own domains.' });
      return;
    }
    if (s.value.mode === 'cloudflare') {
      const token = s.secrets.cloudflareApiToken;
      if (!token || !s.value.zoneId) {
        steps.push({ label: 'Cloudflare for SaaS', ok: false, detail: 'Add the zone ID and an API token with "SSL and Certificates: Edit" on that zone.' });
        return;
      }
      const base = apiBase('CLOUDFLARE_API_BASE', 'https://api.cloudflare.com/client/v4');
      const headers = { authorization: `Bearer ${token}` };
      const verify = await fetch(`${base}/user/tokens/verify`, { headers, signal: AbortSignal.timeout(TIMEOUT) });
      steps.push(verify.ok ? { label: 'Cloudflare accepted the token', ok: true } : { label: 'Cloudflare accepted the token', ok: false, detail: `Cloudflare answered ${verify.status}.` });
      if (!verify.ok) return;
      const zone = await fetch(`${base}/zones/${s.value.zoneId}`, { headers, signal: AbortSignal.timeout(TIMEOUT) });
      const body = (await zone.json().catch(() => ({}))) as { result?: { name?: string; status?: string } };
      steps.push(zone.ok ? { label: 'Zone', ok: body.result?.status === 'active' ? true : null, detail: `${body.result?.name ?? ''} (${body.result?.status ?? 'unknown'})` } : { label: 'Zone', ok: false, detail: `Cloudflare answered ${zone.status}.` });
    } else {
      steps.push({ label: 'Certificates', ok: null, detail: 'Manual: you install a certificate for each customer domain on the server.' });
    }
    try {
      const records = await Promise.any([dns.resolve4(target), dns.resolveCname(target)]);
      steps.push({ label: `Routing name ${target}`, ok: true, detail: records.join(', ') });
    } catch {
      steps.push({ label: `Routing name ${target}`, ok: false, detail: 'Does not resolve yet: create it in your DNS (pointing at this server or the Cloudflare fallback origin).' });
    }
    if (s.value.addresses.length) steps.push({ label: 'Addresses for root domains', ok: null, detail: s.value.addresses.join(', ') });
  }

  /** Storage is configured in the server environment; this proves it end to end. */
  private async storageCheck(steps: SettingCheckStep[]) {
    const key = StorageKeys.healthProbe(randomUUID());
    const body = `bulava storage check ${new Date().toISOString()}`;
    const timed = async (label: string, run: () => Promise<string | undefined>, browserUrl?: string) => {
      const started = Date.now();
      try {
        const detail = await run();
        steps.push({ label, ok: true, detail: [detail, `${Date.now() - started} ms`].filter(Boolean).join(' · ') });
        return true;
      } catch (error) {
        // The local Docker stack: browsers reach storage on the developer's localhost, which is not this container.
        if (browserUrl && unreachableLoopback(browserUrl, error)) {
          steps.push({
            label,
            ok: null,
            detail: `Browsers use ${new URL(browserUrl).origin}, which cannot be reached from inside the API's container. Upload a photo in the dashboard to confirm it works.`,
          });
          return true;
        }
        steps.push({ label, ok: false, detail: describe(error) });
        return false;
      }
    };
    if (!(await timed('Write a file', async () => void (await this.storage.put(key, body, 'text/plain'))))) return;
    await timed('Read it back', async () => {
      const read = (await this.storage.getBuffer(key)).toString('utf8');
      if (read !== body) throw new Error('The file came back different.');
      return undefined;
    });
    // The public endpoint is what browsers use: signed links must open from outside the server.
    const download = await this.storage.presignDownload(key, { expiresInSeconds: 120 });
    await timed(
      'Signed download link opens',
      async () => {
        const res = await fetch(download, { signal: AbortSignal.timeout(TIMEOUT) });
        if (!res.ok) throw new Error(`The signed link answered ${res.status} (${new URL(download).origin}).`);
        return new URL(download).origin;
      },
      download,
    );
    const upload = await this.storage.presignUpload(StorageKeys.healthProbe(randomUUID()), 'image/jpeg', 120);
    await timed(
      'Browser uploads allowed (CORS)',
      async () => {
        const res = await fetch(upload, {
          method: 'OPTIONS',
          headers: { origin: this.config.WEB_ORIGIN, 'access-control-request-method': 'PUT', 'access-control-request-headers': 'content-type' },
          signal: AbortSignal.timeout(TIMEOUT),
        });
        const allowed = res.headers.get('access-control-allow-origin');
        if (!allowed || (allowed !== '*' && allowed !== this.config.WEB_ORIGIN)) {
          throw new Error(`The bucket does not allow uploads from ${this.config.WEB_ORIGIN}: add it to the bucket's CORS rules (PUT, GET; header content-type).`);
        }
        return `allowed for ${allowed}`;
      },
      upload,
    );
    await timed('Delete the test file', async () => void (await this.storage.delete(key)));
  }

  /** Throws for unknown targets (the controller validates the path). */
  static assertCheckable(target: string): Checkable {
    if (!(CHECKABLE as readonly string[]).includes(target)) throw AppError.notFound('Check');
    return target as Checkable;
  }
}
