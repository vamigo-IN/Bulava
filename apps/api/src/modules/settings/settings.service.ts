import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { maskSecret, SettingsStore, SettingsValidationError, type ResolvedSetting } from '@bulava/settings';
import { ObjectStorage, StorageKeys, storageConfigFromEnv } from '@bulava/storage';
import {
  SETTING_GROUPS,
  SETTING_SECRETS,
  trackerSources,
  whatsappReady,
  z,
  type PublicSiteConfig,
  type SaveSettingsInput,
  type SettingGroup,
  type SiteAssetKind,
} from '@bulava/validation';
import { APP_CONFIG, type AppConfig } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { STORAGE } from '../../infrastructure/storage/storage.module';
import { AppError } from '../../common/errors/app-error';
import type { RequestMeta } from '../../common/decorators/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { googleRedirectUri } from '../auth/google-redirect';

export const SETTINGS_STORE = Symbol('SETTINGS_STORE');

/** What each site asset may be: type, extension and size. SVG favicons and logos are fine; share images must be raster. */
const SITE_ASSET_TYPES: Record<SiteAssetKind, { maxBytes: number; types: Record<string, string> }> = {
  logo: { maxBytes: 2 * 1024 * 1024, types: { 'image/png': 'png', 'image/svg+xml': 'svg', 'image/webp': 'webp' } },
  favicon: { maxBytes: 512 * 1024, types: { 'image/png': 'png', 'image/svg+xml': 'svg', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico' } },
  ogImage: { maxBytes: 5 * 1024 * 1024, types: { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } },
};
const SITE_KEY_FIELD = { logo: 'logoKey', favicon: 'faviconKey', ogImage: 'ogImageKey' } as const;

export const SiteAssetUploadSchema = z.object({
  kind: z.enum(['logo', 'favicon', 'ogImage']),
  contentType: z.string().max(100),
  sizeBytes: z.number().int().positive(),
});
export const SiteAssetCompleteSchema = z.object({ kind: z.enum(['logo', 'favicon', 'ogImage']), storageKey: z.string().max(200) });

const HOUR_MS = 3_600_000;

/**
 * The Super Admin's platform settings (site, SEO, tracking, custom code and
 * integrations). Secrets are write-only: the console sees whether each one
 * is set and its last four characters, never the value.
 */
@Injectable()
export class PlatformSettingsService {
  private publicCache: { at: number; value: PublicSiteConfig } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(SETTINGS_STORE) private readonly store: SettingsStore,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) { }

  get<G extends SettingGroup>(group: G) {
    return this.store.get(group);
  }

  /** Which ways hosts can reach guests right now (Integrations: Email and WhatsApp). */
  async messaging(): Promise<{ email: boolean; whatsappInvitations: boolean; whatsappReminders: boolean }> {
    const [email, whatsapp] = await Promise.all([this.store.get('email'), this.store.get('whatsapp')]);
    const w = whatsapp.value;
    const live = whatsappReady(w, whatsapp.secrets);
    return {
      email: email.value.enabled && !!email.value.host,
      whatsappInvitations: live && !!w.templates.invitation,
      whatsappReminders: live && !!w.templates.reminder,
    };
  }

  /** Platform messages to hosts on WhatsApp (the preview link, sign-in codes), each needing its approved template. */
  async whatsappHost(): Promise<{ preview: boolean; otp: boolean }> {
    const whatsapp = await this.store.get('whatsapp');
    const w = whatsapp.value;
    const live = whatsappReady(w, whatsapp.secrets);
    return { preview: live && !!w.templates.preview, otp: live && !!w.templates.otp };
  }

  private view(s: ResolvedSetting<SettingGroup>, editors: Map<string, string>) {
    const secrets = SETTING_SECRETS[s.group] as readonly string[];
    return {
      value: s.value,
      secrets: Object.fromEntries(secrets.map((name) => [name, { set: Boolean((s.secrets as Record<string, string>)[name]), hint: maskSecret((s.secrets as Record<string, string>)[name]) }])),
      source: s.source,
      updatedAt: s.updatedAt,
      updatedBy: s.updatedById ? (editors.get(s.updatedById) ?? null) : null,
      lastCheck: s.lastCheck,
      ignored: s.ignored,
    };
  }

  /** Storage stays in the server environment (every service must agree, and a new bucket would orphan existing files). */
  storageView() {
    try {
      const c = storageConfigFromEnv();
      return { configured: true, endpoint: c.endpoint, publicEndpoint: c.publicEndpoint ?? c.endpoint, bucket: c.bucket, region: c.region ?? 'auto', accessKeyHint: maskSecret(c.accessKeyId), source: 'environment' as const };
    } catch {
      return { configured: false, source: 'environment' as const };
    }
  }

  async overview() {
    this.store.invalidate();
    const groups = await Promise.all(SETTING_GROUPS.map((g) => this.store.get(g)));
    const editorIds = [...new Set(groups.map((g) => g.updatedById).filter((id): id is string => Boolean(id)))];
    const editors = new Map((await this.prisma.user.findMany({ where: { id: { in: editorIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
    const site = groups.find((g) => g.group === 'site')!.value as ResolvedSetting<'site'>['value'];
    const web = this.config.WEB_ORIGIN.replace(/\/$/, '');
    const preview = async (key: string | undefined) => (key ? this.storage.presignDownload(key, { expiresInSeconds: 3600 }) : null);
    return {
      groups: Object.fromEntries(groups.map((g) => [g.group, this.view(g, editors)])),
      storage: { ...this.storageView(), lastCheck: await this.store.lastCheck('storage') },
      origins: {
        web: this.config.WEB_ORIGIN,
        paymentsWebhook: `${web}/api/v1/payments/razorpay/webhook`,
        whatsappWebhook: `${web}/api/v1/whatsapp/webhook`,
        /** Followed by the webhook token, which the console knows only while it is being set. */
        getgabsWebhook: `${web}/api/v1/whatsapp/getgabs?token=`,
        googleRedirect: googleRedirectUri(this.config),
      },
      assetPreviews: { logo: await preview(site.logoKey), favicon: await preview(site.faviconKey), ogImage: await preview(site.ogImageKey) },
    };
  }

  async save(group: SettingGroup, input: SaveSettingsInput, actorId: string, meta: RequestMeta) {
    const current = await this.store.get(group);
    let value: Record<string, unknown> = input.value;
    if (group === 'site') {
      // Asset keys change only through the upload endpoint: a form must never point the public logo route at another object.
      const site = current.value as ResolvedSetting<'site'>['value'];
      value = { ...value, logoKey: site.logoKey, faviconKey: site.faviconKey, ogImageKey: site.ogImageKey };
    }
    let saved: ResolvedSetting<SettingGroup>;
    try {
      saved = await this.store.save(group, value, input.secrets, actorId);
    } catch (error) {
      if (error instanceof SettingsValidationError) throw new AppError('VALIDATION_FAILED', 'Some settings are not valid.', error.issues);
      throw error;
    }
    const changed = Object.keys(saved.value as object).filter((k) => JSON.stringify((saved.value as Record<string, unknown>)[k]) !== JSON.stringify((current.value as Record<string, unknown>)[k]));
    await this.audit.record({
      actorType: 'USER',
      actorId,
      action: 'settings.updated',
      targetType: 'PlatformSetting',
      targetId: group,
      // Names only: secret values never reach the audit log.
      metadata: { group, fields: changed, secrets: Object.keys(input.secrets) },
      meta,
    });
    this.publicCache = null;
    return this.view(saved, new Map([[actorId, (await this.prisma.user.findUnique({ where: { id: actorId }, select: { name: true } }))?.name ?? '']]));
  }

  // ───── Logo, favicon, share image ─────

  async siteAssetUpload(input: z.infer<typeof SiteAssetUploadSchema>) {
    const rule = SITE_ASSET_TYPES[input.kind];
    const ext = rule.types[input.contentType];
    if (!ext) throw new AppError('UPLOAD_REJECTED', `This file type cannot be used as the ${input.kind}.`);
    if (input.sizeBytes > rule.maxBytes) throw new AppError('UPLOAD_REJECTED', `Files must be under ${Math.round(rule.maxBytes / 1024)} KB.`);
    const storageKey = StorageKeys.siteAsset(input.kind, randomUUID(), ext);
    return { storageKey, uploadUrl: await this.storage.presignUpload(storageKey, input.contentType, 600), headers: { 'Content-Type': input.contentType } };
  }

  /** The stored object is checked (type and size) before it becomes the site's asset; the previous file is deleted. */
  async siteAssetComplete(input: z.infer<typeof SiteAssetCompleteSchema>, actorId: string, meta: RequestMeta) {
    const rule = SITE_ASSET_TYPES[input.kind];
    const match = new RegExp(`^site/${input.kind}-[0-9a-f-]{36}\\.(png|svg|webp|jpg|ico)$`).exec(input.storageKey);
    if (!match) throw new AppError('UPLOAD_REJECTED', 'Unknown upload.');
    const head = await this.storage.head(input.storageKey);
    const size = Number(head?.ContentLength ?? 0);
    const expected = Object.entries(rule.types).filter(([, ext]) => ext === match[1]).map(([type]) => type);
    if (!head || !size || size > rule.maxBytes || !expected.includes(head.ContentType ?? '')) {
      if (head) await this.storage.delete(input.storageKey).catch(() => undefined);
      throw new AppError('UPLOAD_REJECTED', 'The file was not received or is not allowed.');
    }
    const current = await this.store.get('site');
    const field = SITE_KEY_FIELD[input.kind];
    const previous = current.value[field];
    await this.store.save('site', { ...current.value, [field]: input.storageKey }, {}, actorId);
    if (previous && previous !== input.storageKey) await this.storage.delete(previous).catch(() => undefined);
    await this.audit.record({ actorType: 'USER', actorId, action: 'settings.site_asset', targetType: 'PlatformSetting', targetId: 'site', metadata: { kind: input.kind, sizeBytes: size }, meta });
    this.publicCache = null;
    return { kind: input.kind, previewUrl: await this.storage.presignDownload(input.storageKey, { expiresInSeconds: 3600 }) };
  }

  async siteAssetRemove(kind: SiteAssetKind, actorId: string, meta: RequestMeta) {
    const current = await this.store.get('site');
    const field = SITE_KEY_FIELD[kind];
    const previous = current.value[field];
    if (!previous) return { removed: false };
    await this.store.save('site', { ...current.value, [field]: undefined }, {}, actorId);
    await this.storage.delete(previous).catch(() => undefined);
    await this.audit.record({ actorType: 'USER', actorId, action: 'settings.site_asset_removed', targetType: 'PlatformSetting', targetId: 'site', metadata: { kind }, meta });
    this.publicCache = null;
    return { removed: true };
  }

  /** Signed URL for a public site asset, signed at the top of the hour so browsers can cache it. */
  async publicAssetUrl(kind: SiteAssetKind): Promise<string> {
    const key = (await this.store.get('site')).value[SITE_KEY_FIELD[kind]];
    if (!key || !key.startsWith('site/')) throw AppError.notFound('Asset');
    const hour = new Date(Math.floor(Date.now() / HOUR_MS) * HOUR_MS);
    return this.storage.presignDownload(key, { expiresInSeconds: 7200, signingDate: hour });
  }

  // ───── Public configuration ─────

  /** Everything public pages need. Cached briefly; saving any setting clears it. */
  async publicConfig(): Promise<PublicSiteConfig> {
    if (this.publicCache && Date.now() - this.publicCache.at < 30_000) return this.publicCache.value;
    const [site, seo, tracking, code] = await Promise.all([this.store.get('site'), this.store.get('seo'), this.store.get('tracking'), this.store.get('code')]);
    const { logoKey, faviconKey, ogImageKey, ...siteRest } = site.value;
    const assetUrl = (kind: SiteAssetKind, key: string | undefined) =>
      key ? `/api/v1/public/site-assets/${kind}?v=${createHash('sha256').update(key).digest('hex').slice(0, 10)}` : null;
    const csp = trackerSources(tracking.value);
    if (code.value.enabled) {
      for (const kind of ['script', 'connect', 'img', 'frame'] as const) csp[kind].push(...code.value.allowedSources[kind]);
    }
    const value: PublicSiteConfig = {
      site: { ...siteRest, logoUrl: assetUrl('logo', logoKey), faviconUrl: assetUrl('favicon', faviconKey), ogImageUrl: assetUrl('ogImage', ogImageKey) },
      seo: seo.value,
      tracking: tracking.value,
      code: code.value.enabled ? { headHtml: code.value.headHtml, bodyHtml: code.value.bodyHtml } : { headHtml: '', bodyHtml: '' },
      csp: { script: [...new Set(csp.script)], connect: [...new Set(csp.connect)], img: [...new Set(csp.img)], frame: [...new Set(csp.frame)] },
    };
    this.publicCache = { at: Date.now(), value };
    return value;
  }
}
