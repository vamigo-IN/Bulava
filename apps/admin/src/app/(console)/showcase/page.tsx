'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ExternalLink, Heart, Plus, Search, Star, TriangleAlert, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { SettingValues } from '@bulava/validation';
import { SettingsCard, useGroupEditor, useSettingsOverview } from '@/components/settings';
import { RequirePermission, useCan } from '@/components/shell';
import { Alert, Badge, Button, buttonVariants, Card, Checkbox, ErrorNotice, Field, Input, PageHeader, Spinner } from '@/components/ui';
import { apiGet, apiPut, errorMessage } from '@/lib/api';
import { t, type AdminMessageKey } from '@/lib/i18n';
import type { AdminShowcase, SettingGroupView, ShowcaseCandidate } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';

const QUERY_KEY = ['admin', 'showcase'];
/** Search results shown under each section (featured templates first, as the catalog orders them). */
const RESULTS = 8;

type Section = AdminShowcase['sections'][number];

export default function ShowcasePage() {
  return (
    <RequirePermission permission="showcase.manage">
      <Showcase />
    </RequirePermission>
  );
}

function Showcase() {
  const data = useQuery({ queryKey: QUERY_KEY, queryFn: () => apiGet<AdminShowcase>('/admin/showcase') });
  const canSettings = useCan('settings.manage');
  const byKey = useMemo(() => new Map((data.data?.templates ?? []).map((tpl) => [tpl.key, tpl])), [data.data]);
  return (
    <>
      <PageHeader
        title={t('showcase.title')}
        subtitle={t('showcase.subtitle')}
        actions={
          data.data ? (
            <a href={`${data.data.siteOrigin}/`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'secondary' })}>
              <ExternalLink aria-hidden className="size-4" /> {t('showcase.open')}
            </a>
          ) : null
        }
      />
      {data.isPending ? <Spinner /> : null}
      {data.isError ? <ErrorNotice error={data.error} /> : null}
      {data.data ? (
        <div className="space-y-5">
          {data.data.sections.map((s) => (
            <SectionEditor key={s.section} section={s} byKey={byKey} templates={data.data.templates} siteOrigin={data.data.siteOrigin} />
          ))}
          {canSettings ? (
            <LikesSettings />
          ) : (
            <Card>
              <h2 className="flex items-center gap-2 font-semibold text-stone-900">
                <Heart aria-hidden className="size-4 text-brand-700" /> {t('likes.settings.title')}
              </h2>
              <p className="mt-2 text-sm text-stone-600">{t('likes.settings.readOnly')}</p>
            </Card>
          )}
        </div>
      ) : null}
    </>
  );
}

type LikesSettingsValue = SettingValues['likes'];

function LikesSettings() {
  const overview = useSettingsOverview();
  if (overview.isPending) return <Spinner />;
  if (overview.isError) return <ErrorNotice error={overview.error} />;
  return <LikesSettingsForm view={overview.data.groups.likes} />;
}

/**
 * Hearts on designs (ADR-055). Every like is real; this only decides when the
 * numbers are public. There is no way to add likes from here, by design.
 */
function LikesSettingsForm({ view }: { view: SettingGroupView }) {
  const editor = useGroupEditor<LikesSettingsValue>('likes', view);
  const { draft, set } = editor;
  const saved = view.value as LikesSettingsValue;
  return (
    <SettingsCard
      title={t('likes.settings.title')}
      description={t('likes.settings.hint')}
      view={view}
      editor={editor}
      status={saved.showCounts ? { tone: 'success', label: t('likes.settings.shown') } : { tone: 'neutral', label: t('likes.settings.hidden') }}
    >
      <Checkbox label={t('likes.settings.showCounts')} checked={draft.showCounts} onChange={(e) => set('showCounts', e.target.checked)} />
      <Field label={t('likes.settings.minimum')} hint={t('likes.settings.minimumHint')} className="max-w-xs">
        {(p) => <Input {...p} type="number" min={0} max={10000} step={1} value={draft.minimum} onChange={(e) => set('minimum', Math.max(0, Math.min(10000, Math.round(Number(e.target.value || 0)))))} />}
      </Field>
    </SettingsCard>
  );
}

/**
 * The website's pre-rendered preview, through the console's own origin (next.config
 * rewrites /template-previews to the web app). A template without one shows its colours.
 */
function Thumb({ template }: { template: ShowcaseCandidate | undefined }) {
  const [failed, setFailed] = useState(false);
  const colors = template?.colors;
  const src = template ? `/template-previews/${template.key}${template.fits.includes('hero') ? '' : '-poster'}.webp` : null;
  return (
    <span
      aria-hidden="true"
      className="block h-16 w-9 shrink-0 overflow-hidden rounded-md ring-1 ring-stone-200"
      style={{ background: `linear-gradient(160deg, ${colors?.background ?? '#fdf7ec'}, ${colors?.accent ?? '#e9c87f'})` }}
    >
      {src && !failed ? <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover object-top" onError={() => setFailed(true)} /> : null}
    </span>
  );
}

function SectionEditor({ section, byKey, templates, siteOrigin }: { section: Section; byKey: Map<string, ShowcaseCandidate>; templates: ShowcaseCandidate[]; siteOrigin: string }) {
  const qc = useQueryClient();
  const savedValue = section.templateKeys.join(',');
  const [keys, setKeys] = useState(section.templateKeys);
  const [q, setQ] = useState('');
  const [saved, setSaved] = useState(false);
  // A new saved value (this screen's save, or someone else's) replaces the draft.
  useEffect(() => setKeys(savedValue ? savedValue.split(',') : []), [savedValue]);

  const save = useMutation({
    mutationFn: (templateKeys: string[]) => apiPut<AdminShowcase>(`/admin/showcase/${section.section}`, { templateKeys }),
    onSuccess: (result) => {
      qc.setQueryData(QUERY_KEY, result);
      setSaved(true);
    },
  });

  const dirty = keys.join(',') !== savedValue;
  const full = keys.length >= section.max;
  const needle = q.trim().toLowerCase();
  const results = useMemo(
    () =>
      templates
        .filter((tpl) => tpl.fits.includes(section.section) && !keys.includes(tpl.key))
        .filter((tpl) => !needle || `${tpl.name} ${tpl.category} ${tpl.key}`.toLowerCase().includes(needle))
        .slice(0, RESULTS),
    [templates, keys, needle, section.section],
  );

  const change = (next: string[]) => {
    setKeys(next);
    setSaved(false);
    save.reset();
  };
  const move = (i: number, by: -1 | 1) => {
    const next = [...keys];
    [next[i], next[i + by]] = [next[i + by]!, next[i]!];
    change(next);
  };
  const siteHref = (key: string) => `${siteOrigin}${section.section === 'cards' ? `/cards/editor/${key}` : `/templates/${key}`}`;
  const title = t(`showcase.section.${section.section}` as AdminMessageKey);
  const headingId = `showcase-${section.section}`;
  const searchId = `showcase-${section.section}-search`;

  return (
    <Card aria-labelledby={headingId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={headingId} className="text-base font-semibold text-stone-900">
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-stone-500">{t(`showcase.section.${section.section}.desc` as AdminMessageKey)}</p>
        </div>
        <Badge tone={keys.length ? 'brand' : 'neutral'}>{keys.length ? t('showcase.chosen', { count: keys.length, max: section.max }) : t('showcase.automatic')}</Badge>
      </div>

      {keys.length ? (
        <ol className="mt-4 space-y-2">
          {keys.map((key, i) => {
            const tpl = byKey.get(key);
            const name = tpl?.name ?? key;
            const fits = !!tpl && tpl.fits.includes(section.section);
            return (
              <li key={key} className={cn('flex items-center gap-3 rounded-lg border p-2', fits ? 'border-stone-200' : 'border-amber-300 bg-amber-50/60')}>
                <span className="w-5 shrink-0 text-center text-xs text-stone-500 tabular-nums">{i + 1}</span>
                <Thumb template={tpl} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium text-stone-900">
                    {name}
                    {tpl?.featured ? <Star role="img" aria-label={t('showcase.featured')} className="size-3.5 shrink-0 fill-gold-400 text-gold-500" /> : null}
                  </p>
                  <p className="truncate text-xs text-stone-500">{tpl ? `${tpl.category} · ${t(`tier.${tpl.tier}`)} · ${key}` : key}</p>
                  {fits ? null : (
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-900">
                      <TriangleAlert aria-hidden className="size-3.5" /> {t('showcase.unfit')}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {tpl ? (
                    <a href={siteHref(key)} target="_blank" rel="noreferrer" aria-label={t('showcase.view', { name })} title={t('showcase.view', { name })} className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
                      <ExternalLink aria-hidden className="size-4" />
                    </a>
                  ) : null}
                  <Button variant="ghost" size="icon" disabled={i === 0} aria-label={t('showcase.moveUp', { name })} title={t('showcase.moveUp', { name })} onClick={() => move(i, -1)}>
                    <ArrowUp aria-hidden className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" disabled={i === keys.length - 1} aria-label={t('showcase.moveDown', { name })} title={t('showcase.moveDown', { name })} onClick={() => move(i, 1)}>
                    <ArrowDown aria-hidden className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={t('showcase.remove', { name })} title={t('showcase.remove', { name })} onClick={() => change(keys.filter((k) => k !== key))}>
                    <X aria-hidden className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-stone-300 px-4 py-3 text-sm text-stone-500">{t('showcase.empty')}</p>
      )}

      <div className="mt-5">
        <label htmlFor={searchId} className="text-sm font-medium text-stone-800">
          {t('showcase.add')}
        </label>
        {full ? (
          <p className="mt-1 text-sm text-stone-500">{t('showcase.full')}</p>
        ) : (
          <>
            <div className="relative mt-1.5 max-w-md">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
              <Input id={searchId} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('showcase.searchPlaceholder')} aria-label={t('showcase.search', { section: title })} className="pl-9" />
            </div>
            {results.length ? (
              <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {results.map((tpl) => (
                  <li key={tpl.key}>
                    <button
                      type="button"
                      onClick={() => change([...keys, tpl.key])}
                      aria-label={t('showcase.addNamed', { name: tpl.name })}
                      className="flex w-full items-center gap-3 rounded-lg border border-stone-200 bg-white p-2 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/50 focus-visible:ring-2 focus-visible:ring-brand-200 focus-visible:outline-none"
                    >
                      <Thumb template={tpl} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-stone-900">{tpl.name}</span>
                        <span className="block truncate text-xs text-stone-500">
                          {tpl.category} · {t(`tier.${tpl.tier}`)}
                        </span>
                      </span>
                      <Plus aria-hidden className="size-4 shrink-0 text-brand-700" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-stone-500">{t('showcase.noResults')}</p>
            )}
          </>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-4">
        <Button disabled={!dirty || save.isPending} onClick={() => save.mutate(keys)}>
          {save.isPending ? t('common.saving') : t('showcase.save')}
        </Button>
        {dirty ? (
          <Button variant="secondary" disabled={save.isPending} onClick={() => change(savedValue ? savedValue.split(',') : [])}>
            {t('showcase.discard')}
          </Button>
        ) : null}
        {savedValue ? (
          <Button variant="ghost" disabled={save.isPending} onClick={() => window.confirm(t('showcase.confirmClear')) && save.mutate([])}>
            {t('showcase.clear')}
          </Button>
        ) : null}
        {section.updatedAt ? <span className="ml-auto text-xs text-stone-500">{t('showcase.updated', { date: formatDateTime(section.updatedAt) })}</span> : null}
      </div>
      {save.isError ? <Alert className="mt-3">{errorMessage(save.error, t('common.error'))}</Alert> : null}
      {saved && !dirty && !save.isError ? (
        <Alert tone="success" className="mt-3">
          {t('showcase.saved')}
        </Alert>
      ) : null}
    </Card>
  );
}
