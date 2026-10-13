'use client';

import { Download, LockKeyhole } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { MessageKey } from '@bulava/localization';
import { apiDelete, apiPatch, apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { can } from '@/lib/permissions';
import { useDesign, useEvent, useEventPlan, useEventTypes, useInvalidateEvent, useLanguages } from '@/lib/queries';
import type { AccessMode, EventSummary } from '@/lib/types';
import { AccessOptions } from '@/components/events/access-options';
import { TeamCard } from '@/components/events/team-card';
import { DomainCard } from '@/components/events/domain-card';
import { Alert, Button, Card, Checkbox, Field, Input, Select, Spinner } from '@/components/ui/primitives';

const EXPORTS = ['guests', 'rsvps', 'invitations', 'attendance', 'media'] as const;

export default function SettingsPage() {
  const t = useT();
  const router = useRouter();
  const client = useQueryClient();
  const { eventId } = useParams<{ eventId: string }>();
  const event = useEvent(eventId);
  const invalidate = useInvalidateEvent(eventId);
  const [pin, setPin] = useState('');
  const [cloneTitle, setCloneTitle] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  if (!event.data) return <Spinner label={t('common.loading')} />;
  const e = event.data;

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setMessage(null);
    try {
      await fn();
      await invalidate();
      if (success) setMessage({ tone: 'success', text: success });
    } catch (err) {
      setMessage({ tone: 'danger', text: errorMessage(t, err) });
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="font-display text-3xl">{t('settings.title')}</h2>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      <GeneralCard event={e} run={run} />
      <NamesCard event={e} run={run} />
      <RepliesCard event={e} run={run} />
      <LinkCard event={e} run={run} />

      <Card className="space-y-4 rounded-3xl">
        <div>
          <h3 className="font-display text-2xl">{t('settings.access')}</h3>
          <p className="mt-1 text-sm text-stone-600">{e.status === 'DRAFT' ? t('settings.access.draft') : t('settings.access.live')}</p>
        </div>
        <AccessCard event={e} run={run} />
        <Checkbox label={t('settings.otp')} checked={e.requireOtp} onChange={(ev) => run(() => apiPatch(`/events/${eventId}`, { requireOtp: ev.target.checked }), t('common.save'))} />
        {e.accessMode === 'PUBLIC' ? (
          <Checkbox label={t('settings.visibility')} checked={e.visibility === 'LISTED'} onChange={(ev) => run(() => apiPatch(`/events/${eventId}`, { visibility: ev.target.checked ? 'LISTED' : 'UNLISTED' }))} />
        ) : null}
        {e.accessMode === 'PRIVATE_LINK' ? (
          <div className="rounded-2xl bg-sand/60 p-4">
            <p className="text-sm font-semibold">{t('settings.pin')}</p>
            {e.hasPin ? <p className="text-sm text-stone-600">{t('settings.pin.active')}</p> : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <Input className="max-w-40" value={pin} onChange={(ev) => setPin(ev.target.value.trim())} maxLength={12} placeholder="4321" aria-label={t('settings.pin')} />
              <Button className="rounded-full" disabled={pin.length < 4} onClick={() => run(() => apiPatch(`/events/${eventId}`, { pin }).then(() => setPin('')), t('settings.pin.active'))}>
                {t('settings.pin.set')}
              </Button>
              {e.hasPin ? (
                <Button variant="ghost" onClick={() => run(() => apiPatch(`/events/${eventId}`, { pin: null }))}>
                  {t('settings.pin.remove')}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        {/* The public page exists only once the event is published; until then the preview link stands in. */}
        {e.status === 'DRAFT' ? (
          <p className="text-sm text-stone-600">{t('settings.publicLinkAfterPublish')}</p>
        ) : e.accessMode === 'PUBLIC' || e.accessMode === 'PRIVATE_LINK' ? (
          <p className="text-sm">
            {t('settings.publicLink')}:{' '}
            <a className="font-medium text-brand-700 underline" href={`/e/${e.slug}`} target="_blank" rel="noreferrer">
              /e/{e.slug}
            </a>
          </p>
        ) : null}
      </Card>

      <Card className="rounded-3xl">
        <h3 className="font-display text-2xl">{t('settings.exports')}</h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {EXPORTS.map((kind) => (
            <li key={kind}>
              <a href={`/api/v1/events/${eventId}/exports/${kind}.csv`} className="flex min-h-11 items-center justify-between rounded-xl border border-gold-200 px-4 text-sm hover:border-gold-500">
                {t(`settings.export.${kind}` as MessageKey)}
                <Download aria-hidden className="size-4 text-gold-600" />
              </a>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3 rounded-3xl">
        <h3 className="font-display text-2xl">{t('settings.status')}</h3>
        <div className="flex flex-wrap gap-2">
          {e.status !== 'COMPLETED' ? (
            <Button variant="secondary" className="rounded-full" onClick={() => run(() => apiPatch(`/events/${eventId}`, { status: 'COMPLETED' }))}>
              {t('settings.complete')}
            </Button>
          ) : null}
          {e.status !== 'ARCHIVED' ? (
            <Button variant="secondary" className="rounded-full" onClick={() => run(() => apiPatch(`/events/${eventId}`, { status: 'ARCHIVED' }))}>
              {t('settings.archive')}
            </Button>
          ) : null}
        </div>
      </Card>

      <Card className="space-y-3 rounded-3xl">
        <h3 className="font-display text-2xl">{t('settings.clone')}</h3>
        <p className="text-sm text-stone-600">{t('settings.clone.body')}</p>
        <div className="flex flex-wrap gap-2">
          <Input className="max-w-sm" value={cloneTitle} onChange={(ev) => setCloneTitle(ev.target.value)} placeholder={`${e.title} (copy)`} aria-label={t('settings.clone.title')} />
          <Button
            className="rounded-full"
            onClick={() =>
              run(async () => {
                const res = await apiPost<{ id: string }>(`/events/${eventId}/clone`, { title: cloneTitle.trim() || `${e.title} (copy)` });
                await client.invalidateQueries({ queryKey: ['events'] });
                router.push(`/dashboard/events/${res.id}`);
              })
            }
          >
            {t('settings.clone')}
          </Button>
        </div>
      </Card>

      <TeamCard eventId={eventId} myRole={event.data.role ?? 'OWNER'} />
      <DomainCard eventId={eventId} />

      <Card className="space-y-3 rounded-3xl border-red-200">
        <h3 className="font-display text-2xl text-red-800">{t('settings.danger')}</h3>
        <p className="text-sm text-stone-600">{t('settings.delete.body')}</p>
        <Input value={confirm} onChange={(ev) => setConfirm(ev.target.value)} placeholder={e.title} aria-label={t('settings.delete.confirm')} />
        <Button
          variant="danger"
          className="rounded-full"
          disabled={confirm !== e.title}
          onClick={() =>
            run(async () => {
              await apiDelete(`/events/${eventId}`);
              await client.invalidateQueries({ queryKey: ['events'] });
              router.replace('/dashboard');
            })
          }
        >
          {t('settings.delete')}
        </Button>
      </Card>
    </div>
  );
}

type Run = (fn: () => Promise<unknown>, success?: string) => Promise<void>;

/** The event's name and the language of its invitation. */
function GeneralCard({ event, run }: { event: EventSummary; run: Run }) {
  const t = useT();
  const languages = useLanguages();
  const [title, setTitle] = useState(event.title);
  const [language, setLanguage] = useState(event.language);
  useEffect(() => {
    setTitle(event.title);
    setLanguage(event.language);
  }, [event.title, event.language]);
  const dirty = title.trim() !== event.title || language !== event.language;
  return (
    <Card className="space-y-4 rounded-3xl">
      <h3 className="font-display text-2xl">{t('settings.general')}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('event.field.title')}>{(p) => <Input {...p} maxLength={160} value={title} onChange={(ev) => setTitle(ev.target.value)} />}</Field>
        <Field label={t('event.field.language')}>
          {(p) => (
            <Select {...p} value={language} onChange={(ev) => setLanguage(ev.target.value)}>
              {languages.data?.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeName} ({l.name})
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Button className="rounded-2xl" disabled={!dirty || !title.trim()} onClick={() => run(() => apiPatch(`/events/${event.id}`, { title: title.trim(), language }), t('common.saved'))}>
        {t('common.save')}
      </Button>
    </Card>
  );
}

/** The mother first, as Hindu invitations name parents (the invitation orders them by the design's tradition, ADR-068). */
const PARENTS = ['partnerOneMother', 'partnerOneFather', 'partnerTwoMother', 'partnerTwoFather'] as const;

/** The names the invitation shows (ADR-068): the couple and their parents, or the person celebrated; fixed here at any time. */
function NamesCard({ event, run }: { event: EventSummary; run: Run }) {
  const t = useT();
  const types = useEventTypes();
  const schema = types.data?.find((x) => x.key === event.typeKey)?.detailsSchemaKey;
  const fields: readonly string[] = schema === 'couple' ? ['partnerOne', 'partnerTwo', ...PARENTS] : schema === 'honoree' ? ['name'] : [];
  const fromEvent = () => Object.fromEntries(fields.map((k) => [k, event.details[k] ?? '']));
  const [values, setValues] = useState<Record<string, string>>(fromEvent);
  useEffect(() => {
    setValues(fromEvent());
    // The saved names, whenever they change (or the event type's fields arrive).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.details, schema]);
  if (!fields.length) return null;
  const required = schema === 'couple' ? ['partnerOne', 'partnerTwo'] : ['name'];
  const dirty = fields.some((k) => (values[k] ?? '').trim() !== (event.details[k] ?? ''));
  const complete = required.every((k) => (values[k] ?? '').trim());
  const label = (k: string) => {
    if (k === 'partnerOne' || k === 'partnerTwo') return t(k === 'partnerOne' ? 'event.field.partnerOne' : 'event.field.partnerTwo');
    if (k === 'name') return t('event.field.honoree');
    const partner = (k.startsWith('partnerOne') ? values.partnerOne : values.partnerTwo)?.trim() || t(k.startsWith('partnerOne') ? 'create.preview.one' : 'create.preview.two');
    return t(k.endsWith('Father') ? 'create.parents.father' : 'create.parents.mother', { name: partner });
  };
  const save = () => {
    const details = Object.fromEntries(fields.flatMap((k) => ((values[k] ?? '').trim() ? [[k, values[k]!.trim()]] : [])));
    return run(() => apiPatch(`/events/${event.id}`, { details }), t('common.saved'));
  };
  return (
    <Card className="space-y-4 rounded-3xl">
      <div>
        <h3 className="font-display text-2xl">{t('settings.names')}</h3>
        <p className="mt-1 text-sm text-stone-600">{schema === 'couple' ? t('settings.names.coupleBody') : t('settings.names.body')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((k) => (
          <Field key={k} label={label(k)}>
            {(p) => <Input {...p} maxLength={120} autoComplete="off" value={values[k] ?? ''} onChange={(ev) => setValues({ ...values, [k]: ev.target.value })} />}
          </Field>
        ))}
      </div>
      <Button className="rounded-2xl" disabled={!dirty || !complete} onClick={() => void save()}>
        {t('common.save')}
      </Button>
    </Card>
  );
}

/** Whether guests reply on the invitation (ADR-068): the host's choice, while the plan has replies. */
function RepliesCard({ event, run }: { event: EventSummary; run: Run }) {
  const t = useT();
  const plan = useEventPlan(event.id);
  const inPlan = plan.data?.features['rsvp.enabled']?.enabled ?? true;
  return (
    <Card className="space-y-3 rounded-3xl">
      <div>
        <h3 className="font-display text-2xl">{t('publish.rsvp.title')}</h3>
        <p className="mt-1 text-sm text-stone-600">{t('settings.rsvp.body')}</p>
      </div>
      <Checkbox
        label={t('settings.rsvp.on')}
        checked={event.rsvpEnabled && inPlan}
        disabled={!inPlan}
        onChange={(ev) => void run(() => apiPatch(`/events/${event.id}`, { rsvpEnabled: ev.target.checked }), ev.target.checked ? t('settings.rsvp.turnedOn') : t('settings.rsvp.turnedOff'))}
      />
      {!inPlan ? (
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-stone-600">
          <LockKeyhole aria-hidden className="size-4 text-gold-600" />
          {t('publish.rsvp.notInPlan')}
          {can(event, 'payment.read') ? (
            <Link href={`/dashboard/events/${event.id}/unlock`} className="font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4">
              {t('unlock.cta')}
            </Link>
          ) : null}
        </p>
      ) : null}
    </Card>
  );
}

/** Who can open the invitation: chosen when publishing, and changed here afterwards. */
function AccessCard({ event, run }: { event: EventSummary; run: Run }) {
  const t = useT();
  const [mode, setMode] = useState<AccessMode>(event.accessMode);
  useEffect(() => setMode(event.accessMode), [event.accessMode]);
  return (
    <div className="space-y-3">
      <AccessOptions value={mode} onChange={setMode} />
      {mode !== event.accessMode ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button className="rounded-2xl" onClick={() => run(() => apiPatch(`/events/${event.id}`, { accessMode: mode }), t('settings.access.saved'))}>
            {t('settings.access.save')}
          </Button>
          <Button variant="ghost" className="rounded-2xl" onClick={() => setMode(event.accessMode)}>
            {t('common.cancel')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const LINK_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The invitation's own link (ADR-062): plans with a custom link let the owner
 * choose /e/<their-name>; the old link keeps opening the invitation. Others see
 * what unlocks it, or who can.
 */
function LinkCard({ event, run }: { event: EventSummary; run: (fn: () => Promise<unknown>, success?: string) => Promise<void> }) {
  const t = useT();
  const design = useDesign(event.id);
  const [name, setName] = useState(event.slug);
  useEffect(() => setName(event.slug), [event.slug]);
  const owner = can(event, 'billing.manage');
  const included = design.data?.entitlements['link.custom']?.enabled ?? false;
  const valid = name.length >= 4 && name.length <= 60 && LINK_NAME.test(name);
  return (
    <Card className="space-y-3 rounded-3xl">
      <div>
        <h3 className="font-display text-2xl">{t('settings.link.title')}</h3>
        <p className="mt-1 text-sm text-stone-600">{t('settings.link.hint')}</p>
      </div>
      {owner && included ? (
        <form
          className="space-y-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (valid && name !== event.slug) void run(() => apiPatch(`/events/${event.id}`, { slug: name }), t('settings.link.saved'));
          }}
        >
          <Field label={t('settings.link.label')} hint={valid || !name ? t('settings.link.rules') : t('settings.link.invalid')}>
            {(p) => (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-stone-500">/e/</span>
                <Input
                  {...p}
                  className="max-w-72 min-w-0 flex-1"
                  value={name}
                  maxLength={60}
                  autoCapitalize="none"
                  spellCheck={false}
                  onChange={(ev) => setName(ev.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-'))}
                  aria-invalid={name && !valid ? true : undefined}
                />
                <Button type="submit" className="rounded-full" disabled={!valid || name === event.slug}>
                  {t('common.save')}
                </Button>
              </div>
            )}
          </Field>
          <p className="text-xs text-stone-500">{t('settings.link.oldKeeps')}</p>
        </form>
      ) : (
        <div className="flex items-start gap-3 rounded-2xl bg-sand/60 p-4 text-sm">
          <LockKeyhole aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-700" />
          <p className="text-stone-700">
            {t('settings.link.current', { link: `/e/${event.slug}` })}{' '}
            {owner ? (
              <Link href={`/dashboard/events/${event.id}/unlock`} className="font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4">
                {t('settings.link.unlock')}
              </Link>
            ) : (
              t('upgrade.ownerOnly.short')
            )}
          </p>
        </div>
      )}
    </Card>
  );
}
