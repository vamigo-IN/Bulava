import { promises as dns } from 'node:dns';
import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { SettingsStore } from '@bulava/settings';
import { ObjectStorage, StorageKeys } from '@bulava/storage';
import { z, type SettingCheckResult, type SettingCheckStep, type SettingGroup } from '@bulava/validation';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { STORAGE } from '../../infrastructure/storage/storage.module';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { escapeHtml } from '../guest-access/otp.service';
import { SETTINGS_STORE } from './settings.service';

export const CHECKABLE = ['payments', 'email', 'whatsapp', 'maps', 'domains', 'storage'] as const;
export type Checkable = (typeof CHECKABLE)[number];
export const RunCheckSchema = z.object({ to: z.string().trim().max(200).optional() });

const TIMEOUT = 10_000;

/** External APIs; tests and staging can point them elsewhere. */
function apiBase(name: 'RAZORPAY_API_BASE' | 'CLOUDFLARE_API_BASE' | 'WHATSAPP_API_BASE', fallback: string): string {
  return (process.env[name] || fallback).replace(/\/$/, '');
}

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
  ) {}

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
    const token = s.secrets.accessToken;
    if (!s.value.phoneNumberId || !token) {
      steps.push({ label: 'WhatsApp Business account', ok: false, detail: 'Add the phone number ID and a permanent access token from Meta Business (WhatsApp Manager → API setup).' });
      return;
    }
    const base = `${apiBase('WHATSAPP_API_BASE', 'https://graph.facebook.com')}/${s.value.apiVersion}`;
    const res = await fetch(`${base}/${s.value.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const body = (await res.json().catch(() => ({}))) as { display_phone_number?: string; verified_name?: string; quality_rating?: string; error?: { message?: string } };
    if (!res.ok) {
      steps.push({ label: 'Meta accepted the token', ok: false, detail: body.error?.message ?? `Meta answered ${res.status}.` });
      return;
    }
    steps.push({ label: 'Meta accepted the token', ok: true, detail: `${body.verified_name ?? 'Business'} · ${body.display_phone_number ?? ''} · quality ${body.quality_rating ?? 'unknown'}` });
    const templates = s.value.templates;
    steps.push({
      label: 'Message templates',
      ok: templates.invitation && templates.reminder ? true : null,
      detail: templates.invitation && templates.reminder ? `${templates.invitation}, ${templates.reminder}` : 'Add the approved template names for invitations and reminders.',
    });
    if (to) {
      const number = to.replace(/[^\d]/g, '');
      const send = await fetch(`${base}/${s.value.phoneNumberId}/messages`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        // hello_world is Meta's pre-approved sample template.
        body: JSON.stringify({ messaging_product: 'whatsapp', to: number, type: 'template', template: { name: 'hello_world', language: { code: 'en_US' } } }),
        signal: AbortSignal.timeout(TIMEOUT),
      });
      const sent = (await send.json().catch(() => ({}))) as { messages?: Array<{ id: string }>; error?: { message?: string } };
      steps.push(send.ok ? { label: `Test message sent to +${number}`, ok: true } : { label: 'Test message', ok: false, detail: sent.error?.message ?? `Meta answered ${send.status}.` });
    }
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
