'use client';

import { Check, Copy, MapPin } from 'lucide-react';
import { useState } from 'react';
import { whatsappReady, type SettingValues } from '@bulava/validation';
import { CheckPanel, GroupSecret, SettingsCard, SettingsPage, TextField, useGroupEditor, type GroupEditor } from '@/components/settings';
import { useMe } from '@/components/shell';
import { Alert, Badge, Button, Card, Checkbox, Field, Input, Select } from '@/components/ui';
import { t, type AdminMessageKey } from '@/lib/i18n';
import type { SettingGroupView, SettingsOverview } from '@/lib/types';

type Payments = SettingValues['payments'];
type Email = SettingValues['email'];
type WhatsApp = SettingValues['whatsapp'];
type Google = SettingValues['google'];
type Maps = SettingValues['maps'];
type Domains = SettingValues['domains'];
type Status = { tone: 'success' | 'warning' | 'neutral'; label: string };

const SECURITY: Array<{ value: Email['security']; label: AdminMessageKey }> = [
  { value: 'auto', label: 'int.email.security.auto' },
  { value: 'ssl', label: 'int.email.security.ssl' },
  { value: 'starttls', label: 'int.email.security.starttls' },
  { value: 'none', label: 'int.email.security.none' },
];

const WHATSAPP_PROVIDERS: Array<{ value: WhatsApp['provider']; label: AdminMessageKey }> = [
  { value: 'GETGABS', label: 'int.whatsapp.provider.getgabs' },
  { value: 'META_CLOUD', label: 'int.whatsapp.provider.meta' },
];

const DOMAIN_MODES: Array<{ value: Domains['mode']; label: AdminMessageKey }> = [
  { value: 'off', label: 'int.domains.mode.off' },
  { value: 'cloudflare', label: 'int.domains.mode.cloudflare' },
  { value: 'manual', label: 'int.domains.mode.manual' },
];

/** The place shown by the map preview. */
const SAMPLE_PLACE = 'Rambagh Palace, Jaipur';

function status(enabled: boolean, complete: boolean): Status {
  if (!enabled) return { tone: 'neutral', label: t('int.status.off') };
  return complete ? { tone: 'success', label: t('int.status.ready') } : { tone: 'warning', label: t('int.status.incomplete') };
}

export default function IntegrationsPage() {
  return (
    <SettingsPage title={t('int.title')} subtitle={t('int.subtitle')}>
      {(overview) => (
        <>
          <PaymentsForm view={overview.groups.payments} webhookUrl={overview.origins.paymentsWebhook} />
          <EmailForm view={overview.groups.email} />
          <WhatsAppForm view={overview.groups.whatsapp} origins={overview.origins} />
          <GoogleForm view={overview.groups.google} redirectUri={overview.origins.googleRedirect} />
          <MapsForm view={overview.groups.maps} />
          <DomainsForm view={overview.groups.domains} webHost={new URL(overview.origins.web).hostname} />
          <StorageCard storage={overview.storage} />
        </>
      )}
    </SettingsPage>
  );
}

function PaymentsForm({ view, webhookUrl }: { view: SettingGroupView; webhookUrl: string }) {
  const editor = useGroupEditor<Payments>('payments', view);
  const { draft, set } = editor;
  const saved = view.value as Payments;
  return (
    <SettingsCard
      title={t('int.payments')}
      description={t('int.payments.hint')}
      view={view}
      editor={editor}
      status={status(saved.enabled, Boolean(saved.keyId && view.secrets.keySecret?.set))}
      savedMessage={t('settings.savedIntegration')}
      after={<CheckPanel target="payments" lastCheck={view.lastCheck} dirty={editor.dirty} />}
    >
      <Checkbox label={t('int.payments.enabled')} checked={draft.enabled} onChange={(e) => set('enabled', e.target.checked)} />
      <TextField
        label={t('int.payments.keyId')}
        placeholder="rzp_live_…"
        spellCheck={false}
        autoComplete="off"
        className="max-w-md [&_input]:font-mono"
        value={draft.keyId}
        onChange={(v) => set('keyId', v)}
      />
      <GroupSecret editor={editor} view={view} name="keySecret" label={t('int.payments.keySecret')} />
      <GroupSecret editor={editor} view={view} name="webhookSecret" label={t('int.payments.webhookSecret')} />
      <CopyLine label={t('int.payments.webhookUrl')} value={webhookUrl} />
    </SettingsCard>
  );
}

function EmailForm({ view }: { view: SettingGroupView }) {
  const me = useMe();
  const editor = useGroupEditor<Email>('email', view);
  const { draft, set } = editor;
  const saved = view.value as Email;
  const [to, setTo] = useState('');
  return (
    <SettingsCard
      title={t('int.email')}
      description={t('int.email.hint')}
      view={view}
      editor={editor}
      status={status(saved.enabled, Boolean(saved.host))}
      savedMessage={t('settings.savedIntegration')}
      after={
        <CheckPanel target="email" lastCheck={view.lastCheck} dirty={editor.dirty} body={{ to }}>
          <Field label={t('int.email.testTo')} className="min-w-60 flex-1">
            {(p) => <Input {...p} type="email" autoComplete="off" placeholder={me.email ?? ''} value={to} onChange={(e) => setTo(e.target.value)} />}
          </Field>
        </CheckPanel>
      }
    >
      <Checkbox label={t('int.email.enabled')} checked={draft.enabled} onChange={(e) => set('enabled', e.target.checked)} />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField className="sm:col-span-2" label={t('int.email.host')} placeholder="smtp.example.com" spellCheck={false} value={draft.host} onChange={(v) => set('host', v)} />
        <TextField
          label={t('int.email.port')}
          type="number"
          min={1}
          max={65_535}
          value={draft.port}
          // An emptied field stays empty while typing; the server refuses it if saved that way.
          onChange={(v) => set('port', (v === '' ? '' : Number(v)) as Email['port'])}
        />
      </div>
      <Field label={t('int.email.security')}>
        {(p) => (
          <Select {...p} value={draft.security} className="max-w-md" onChange={(e) => set('security', e.target.value as Email['security'])}>
            {SECURITY.map((s) => (
              <option key={s.value} value={s.value}>
                {t(s.label)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <TextField label={t('int.email.username')} autoComplete="off" spellCheck={false} className="max-w-md" value={draft.username} onChange={(v) => set('username', v)} />
      <GroupSecret editor={editor} view={view} name="password" label={t('int.email.password')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t('int.email.fromName')} maxLength={80} value={draft.fromName} onChange={(v) => set('fromName', v)} />
        <TextField label={t('int.email.fromEmail')} type="email" placeholder="invites@example.com" value={draft.fromEmail} onChange={(v) => set('fromEmail', v)} />
        <TextField label={t('int.email.replyTo')} type="email" value={draft.replyTo} onChange={(v) => set('replyTo', v)} />
      </div>
    </SettingsCard>
  );
}

function WhatsAppForm({ view, origins }: { view: SettingGroupView; origins: SettingsOverview['origins'] }) {
  const editor = useGroupEditor<WhatsApp>('whatsapp', view);
  const { draft, set } = editor;
  const saved = view.value as WhatsApp;
  const templates = draft.templates ?? {};
  const [to, setTo] = useState('');
  const getgabs = draft.provider === 'GETGABS';
  // Ready to send once switched on: the saved provider's credentials and a guest template.
  const credentials = whatsappReady({ ...saved, enabled: true }, { apiKey: view.secrets.apiKey?.set, accessToken: view.secrets.accessToken?.set });
  const complete = credentials && Boolean(saved.templates?.invitation || saved.templates?.reminder);
  return (
    <SettingsCard
      title={t('int.whatsapp')}
      description={t('int.whatsapp.hint')}
      view={view}
      editor={editor}
      status={status(saved.enabled, complete)}
      savedMessage={t('settings.savedIntegration')}
      after={
        <CheckPanel target="whatsapp" lastCheck={view.lastCheck} dirty={editor.dirty} body={to.trim() ? { to: to.trim() } : {}}>
          <Field label={t('int.whatsapp.testTo')} className="min-w-60 flex-1">
            {(p) => <Input {...p} type="tel" autoComplete="off" placeholder="+91…" value={to} onChange={(e) => setTo(e.target.value)} />}
          </Field>
        </CheckPanel>
      }
    >
      <Checkbox label={t('int.whatsapp.enabled')} checked={draft.enabled} onChange={(e) => set('enabled', e.target.checked)} />
      <Field label={t('int.whatsapp.provider')} hint={t('int.whatsapp.providerHint')}>
        {(p) => (
          <Select {...p} value={draft.provider} className="max-w-md" onChange={(e) => set('provider', e.target.value as WhatsApp['provider'])}>
            {WHATSAPP_PROVIDERS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.label)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {getgabs ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t('int.whatsapp.getgabs.sender')}
              hint={t('int.whatsapp.getgabs.senderHint')}
              type="tel"
              autoComplete="off"
              placeholder="+919876543210"
              className="[&_input]:font-mono"
              value={draft.senderNumber}
              onChange={(v) => set('senderNumber', v)}
            />
            <TextField
              label={t('int.whatsapp.getgabs.campaign')}
              hint={t('int.whatsapp.getgabs.campaignHint')}
              spellCheck={false}
              autoComplete="off"
              className="[&_input]:font-mono"
              value={draft.campaignId}
              onChange={(v) => set('campaignId', v)}
            />
          </div>
          <GroupSecret editor={editor} view={view} name="apiKey" label={t('int.whatsapp.getgabs.apiKey')} hint={t('int.whatsapp.getgabs.apiKeyHint')} />
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label={t('int.whatsapp.phoneNumberId')} inputMode="numeric" spellCheck={false} className="[&_input]:font-mono" value={draft.phoneNumberId} onChange={(v) => set('phoneNumberId', v)} />
            <TextField
              label={t('int.whatsapp.businessAccountId')}
              inputMode="numeric"
              spellCheck={false}
              className="[&_input]:font-mono"
              value={draft.businessAccountId}
              onChange={(v) => set('businessAccountId', v)}
            />
            <TextField label={t('int.whatsapp.apiVersion')} placeholder="v21.0" spellCheck={false} className="[&_input]:font-mono" value={draft.apiVersion} onChange={(v) => set('apiVersion', v)} />
          </div>
          <GroupSecret editor={editor} view={view} name="accessToken" label={t('int.whatsapp.accessToken')} />
          <GroupSecret editor={editor} view={view} name="appSecret" label={t('int.whatsapp.appSecret')} />
        </>
      )}
      <h3 className="pt-2 text-sm font-semibold text-stone-900">{t('int.whatsapp.templates')}</h3>
      <p className="-mt-2 text-xs text-stone-500">
        {t(getgabs ? 'int.whatsapp.templatesWhere.getgabs' : 'int.whatsapp.templatesWhere.meta')} {t('int.whatsapp.templatesHint')}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label={t('int.whatsapp.invitationTemplate')}
          placeholder="event_invitation"
          spellCheck={false}
          className="[&_input]:font-mono"
          value={templates.invitation}
          onChange={(v) => set('templates', { ...templates, invitation: v })}
        />
        <TextField
          label={t('int.whatsapp.reminderTemplate')}
          placeholder="event_reminder"
          spellCheck={false}
          className="[&_input]:font-mono"
          value={templates.reminder}
          onChange={(v) => set('templates', { ...templates, reminder: v })}
        />
        <TextField label={t('int.whatsapp.language')} placeholder="en" spellCheck={false} className="[&_input]:font-mono" value={draft.templateLanguage} onChange={(v) => set('templateLanguage', v)} />
      </div>
      <p className="text-xs text-stone-500">{t('int.whatsapp.hostTemplatesHint')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t('int.whatsapp.previewTemplate')}
          placeholder="host_preview_link"
          spellCheck={false}
          className="[&_input]:font-mono"
          value={templates.preview}
          onChange={(v) => set('templates', { ...templates, preview: v })}
        />
        <TextField
          label={t('int.whatsapp.otpTemplate')}
          placeholder="host_sign_in_code"
          spellCheck={false}
          className="[&_input]:font-mono"
          value={templates.otp}
          onChange={(v) => set('templates', { ...templates, otp: v })}
        />
      </div>
      <h3 className="pt-2 text-sm font-semibold text-stone-900">{t('int.whatsapp.webhookTitle')}</h3>
      {getgabs ? (
        <>
          <p className="-mt-2 text-xs text-stone-500">{t('int.whatsapp.getgabs.webhookHint')}</p>
          <GetGabsWebhook editor={editor} view={view} baseUrl={origins.getgabsWebhook} />
        </>
      ) : (
        <>
          <p className="-mt-2 text-xs text-stone-500">{t('int.whatsapp.webhookHint')}</p>
          <GroupSecret editor={editor} view={view} name="webhookVerifyToken" label={t('int.whatsapp.webhookVerifyToken')} />
          <CopyLine label={t('int.whatsapp.webhookUrl')} value={origins.whatsappWebhook} />
        </>
      )}
    </SettingsCard>
  );
}

/** A random token for a webhook address (hex, so it needs no escaping in a URL). */
function newWebhookToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * GetGabs does not sign its webhook calls, so the address carries a secret
 * token. The console makes one and shows the whole address until it is saved;
 * from then on the token is write-only, like every other secret.
 */
function GetGabsWebhook({ editor, view, baseUrl }: { editor: GroupEditor<WhatsApp>; view: SettingGroupView; baseUrl: string }) {
  const pending = editor.secrets.webhookToken;
  const saved = view.secrets.webhookToken;
  const cancel = (
    <Button size="sm" variant="ghost" onClick={() => editor.setSecret('webhookToken', undefined)}>
      {t('common.cancel')}
    </Button>
  );
  if (typeof pending === 'string') {
    return (
      <div className="space-y-2">
        <CopyLine label={t('int.whatsapp.getgabs.webhookNew')} value={`${baseUrl}${pending}`} />
        <p className="text-xs text-amber-800">{t('int.whatsapp.getgabs.webhookOnce')}</p>
        {cancel}
      </div>
    );
  }
  if (pending === null) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-red-700">{t('int.whatsapp.getgabs.webhookWillRemove')}</span>
        {cancel}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-stone-700">{saved?.set ? t('int.whatsapp.getgabs.webhookSaved', { hint: saved.hint ?? '••••' }) : t('int.whatsapp.getgabs.webhookNone')}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => editor.setSecret('webhookToken', newWebhookToken())}>
          {saved?.set ? t('int.whatsapp.getgabs.regenerate') : t('int.whatsapp.getgabs.generate')}
        </Button>
        {saved?.set ? (
          <Button size="sm" variant="ghost" className="text-red-700" onClick={() => editor.setSecret('webhookToken', null)}>
            {t('settings.secret.remove')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function GoogleForm({ view, redirectUri }: { view: SettingGroupView; redirectUri: string }) {
  const editor = useGroupEditor<Google>('google', view);
  const { draft, set } = editor;
  const saved = view.value as Google;
  return (
    <SettingsCard
      title={t('int.google')}
      description={t('int.google.hint')}
      view={view}
      editor={editor}
      status={status(saved.enabled, Boolean(saved.clientId && view.secrets.clientSecret?.set))}
      savedMessage={t('settings.savedIntegration')}
      after={<CheckPanel target="google" lastCheck={view.lastCheck} dirty={editor.dirty} />}
    >
      <Checkbox label={t('int.google.enabled')} checked={draft.enabled} onChange={(e) => set('enabled', e.target.checked)} />
      <p className="text-sm text-stone-600">{t('int.google.steps')}</p>
      <CopyLine label={t('int.google.redirectUri')} value={redirectUri} />
      <TextField
        label={t('int.google.clientId')}
        placeholder="1234567890-abc123.apps.googleusercontent.com"
        spellCheck={false}
        autoComplete="off"
        className="[&_input]:font-mono"
        value={draft.clientId}
        onChange={(v) => set('clientId', v)}
      />
      <GroupSecret editor={editor} view={view} name="clientSecret" label={t('int.google.clientSecret')} />
    </SettingsCard>
  );
}

function MapsForm({ view }: { view: SettingGroupView }) {
  const editor = useGroupEditor<Maps>('maps', view);
  const { draft, set } = editor;
  const saved = view.value as Maps;
  const [preview, setPreview] = useState(false);
  return (
    <SettingsCard
      title={t('int.maps')}
      description={t('int.maps.hint')}
      view={view}
      editor={editor}
      status={status(saved.enabled, Boolean(saved.embedKey))}
      savedMessage={t('settings.savedIntegration')}
      after={
        <>
          <CheckPanel target="maps" lastCheck={view.lastCheck} dirty={editor.dirty}>
            {saved.embedKey ? (
              <Button size="sm" variant="secondary" aria-expanded={preview} disabled={editor.dirty} onClick={() => setPreview((v) => !v)}>
                <MapPin className="size-3.5" aria-hidden /> {t('int.maps.preview')}
              </Button>
            ) : null}
          </CheckPanel>
          {preview && saved.embedKey ? (
            <>
              <p className="mt-3 text-xs text-stone-500">{t('int.maps.previewHint')}</p>
              {/* The key goes to Google exactly as on invitations; only this site's origin is sent as referrer. */}
              <iframe
                title={t('int.maps.previewTitle')}
                src={`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(saved.embedKey)}&q=${encodeURIComponent(SAMPLE_PLACE)}`}
                loading="lazy"
                referrerPolicy="origin"
                className="mt-2 aspect-[16/9] w-full rounded-lg border border-stone-200 bg-stone-100"
              />
            </>
          ) : null}
        </>
      }
    >
      <Checkbox label={t('int.maps.enabled')} checked={draft.enabled} onChange={(e) => set('enabled', e.target.checked)} />
      <TextField
        label={t('int.maps.key')}
        hint={t('int.maps.keyHint')}
        placeholder="AIza…"
        spellCheck={false}
        autoComplete="off"
        className="[&_input]:max-w-md [&_input]:font-mono"
        value={draft.embedKey}
        onChange={(v) => set('embedKey', v)}
      />
      <Checkbox label={t('int.maps.showOnInvitations')} checked={draft.showOnInvitations} onChange={(e) => set('showOnInvitations', e.target.checked)} />
    </SettingsCard>
  );
}

function DomainsForm({ view, webHost }: { view: SettingGroupView; webHost: string }) {
  const editor = useGroupEditor<Domains>('domains', view);
  const { draft, set } = editor;
  const saved = view.value as Domains;
  const complete = saved.mode === 'manual' || Boolean(saved.zoneId && view.secrets.cloudflareApiToken?.set);
  return (
    <SettingsCard
      title={t('int.domains')}
      description={t('int.domains.hint')}
      view={view}
      editor={editor}
      status={status(saved.mode !== 'off', complete)}
      savedMessage={t('settings.savedIntegration')}
      after={<CheckPanel target="domains" lastCheck={view.lastCheck} dirty={editor.dirty} />}
    >
      <Field label={t('int.domains.mode')}>
        {(p) => (
          <Select {...p} value={draft.mode} className="max-w-md" onChange={(e) => set('mode', e.target.value as Domains['mode'])}>
            {DOMAIN_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {t(m.label)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {draft.mode === 'cloudflare' ? (
        <>
          <TextField label={t('int.domains.zoneId')} spellCheck={false} autoComplete="off" className="max-w-md [&_input]:font-mono" value={draft.zoneId} onChange={(v) => set('zoneId', v)} />
          <GroupSecret editor={editor} view={view} name="cloudflareApiToken" label={t('int.domains.token')} />
        </>
      ) : null}
      {draft.mode !== 'off' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t('int.domains.cname')}
            hint={t('int.domains.cnameHint', { host: webHost })}
            placeholder={`domains.${webHost}`}
            spellCheck={false}
            className="[&_input]:font-mono"
            value={draft.cnameTarget}
            onChange={(v) => set('cnameTarget', v)}
          />
          <CommaListField label={t('int.domains.addresses')} hint={t('int.domains.addressesHint')} placeholder="203.0.113.10" value={draft.addresses} onChange={(v) => set('addresses', v)} />
        </div>
      ) : null}
    </SettingsCard>
  );
}

/** Storage lives in the server environment (every service must agree on it); the console shows it and tests it. */
function StorageCard({ storage }: { storage: SettingsOverview['storage'] }) {
  const rows: Array<[AdminMessageKey, string | null | undefined]> = [
    ['int.storage.endpoint', storage.endpoint],
    ['int.storage.publicEndpoint', storage.publicEndpoint],
    ['int.storage.bucket', storage.bucket],
    ['int.storage.region', storage.region],
    ['int.storage.accessKey', storage.accessKeyHint],
  ];
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-stone-900">{t('int.storage')}</h2>
          <p className="mt-1 max-w-2xl text-sm text-stone-500">{t('int.storage.hint')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={storage.configured ? 'success' : 'warning'}>{storage.configured ? t('int.status.ready') : t('int.status.incomplete')}</Badge>
          <Badge tone="warning">{t('settings.source.environment')}</Badge>
        </div>
      </div>
      {storage.configured ? (
        <dl className="mb-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs font-semibold tracking-wide text-stone-500 uppercase">{t(label)}</dt>
              <dd className="mt-0.5 font-mono text-xs break-all text-stone-800">{value || t('common.none')}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <Alert tone="warning" className="mb-4">
          {t('int.storage.notConfigured')}
        </Alert>
      )}
      <CheckPanel target="storage" lastCheck={storage.lastCheck} />
    </Card>
  );
}

function CopyLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
      <p className="text-stone-600">{label}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 rounded bg-white px-2 py-1 font-mono text-xs break-all text-stone-800">{value}</code>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            void navigator.clipboard.writeText(value).then(
              () => setCopied(true),
              () => setCopied(false),
            )
          }
        >
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />} {copied ? t('common.copied') : t('common.copy')}
        </Button>
      </div>
    </div>
  );
}

/** A short list typed as comma-separated text; the text is kept while typing. */
function CommaListField({ label, hint, placeholder, value, onChange }: { label: string; hint?: string; placeholder?: string; value: string[] | undefined; onChange: (value: string[]) => void }) {
  const [text, setText] = useState((value ?? []).join(', '));
  return (
    <Field label={label} hint={hint}>
      {(p) => (
        <Input
          {...p}
          spellCheck={false}
          className="font-mono"
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onChange(
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            );
          }}
        />
      )}
    </Field>
  );
}
