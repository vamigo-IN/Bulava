'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Copy, FileJson, Film, Globe, Heart, IdCard, Plus, RotateCcw, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { ImportCardForm } from '@/components/import-card';
import { RequirePermission, useInvalidate } from '@/components/shell';
import { Alert, Badge, Button, EmptyState, ErrorNotice, Field, Input, Modal, PageHeader, Select, Spinner, statusTone, Table, Td, Th } from '@/components/ui';
import { apiDelete, apiGet, apiPost, errorMessage } from '@/lib/api';
import { t, tMaybe } from '@/lib/i18n';
import type { AdminTemplate, TemplateType } from '@/lib/types';
import { formatDate, formatNumber } from '@/lib/utils';

const TYPE_ICONS = { WEBSITE: Globe, VIDEO: Film, DIGITAL_CARD: IdCard } as const;
const CREATABLE_TYPES = ['WEBSITE', 'VIDEO', 'DIGITAL_CARD'] as const;

export default function TemplatesPage() {
  return (
    <RequirePermission permission="template.manage">
      <TemplateList />
    </RequirePermission>
  );
}

function workingInfo(tpl: AdminTemplate) {
  const current = tpl.versions.find((v) => v.id === tpl.currentVersionId);
  const latest = tpl.versions[0];
  const pendingDraft = latest && latest.status === 'DRAFT' && latest.id !== tpl.currentVersionId ? latest : null;
  return { current, pendingDraft };
}

function TemplateList() {
  const [view, setView] = useState<'live' | 'deleted'>('live');
  const templates = useQuery({ queryKey: ['admin', 'templates', view], queryFn: () => apiGet<AdminTemplate[]>(`/admin/templates${view === 'deleted' ? '?deleted=true' : ''}`) });
  const [deleting, setDeleting] = useState<AdminTemplate | null>(null);
  const invalidate = useInvalidate();
  const restore = useMutation({
    mutationFn: (id: string) => apiPost(`/admin/templates/${id}/restore`),
    onSuccess: () => invalidate(['admin', 'templates']),
  });
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [duplicating, setDuplicating] = useState<AdminTemplate | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (templates.data ?? []).filter(
      (tpl) =>
        (!needle || tpl.name.toLowerCase().includes(needle) || tpl.key.includes(needle) || tpl.category.toLowerCase().includes(needle)) &&
        (!type || tpl.outputs.includes(type as TemplateType)) &&
        (!status || tpl.status === status),
    );
  }, [templates.data, q, type, status]);

  return (
    <>
      <PageHeader
        title={t('templates.title')}
        subtitle={t('templates.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setImporting(true)}>
              <FileJson className="size-4" /> {t('templates.import')}
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> {t('templates.new')}
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-stone-200 bg-white p-0.5" role="group" aria-label={t('templates.view')}>
          {(['live', 'deleted'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`min-h-9 rounded-md px-3 text-sm font-medium ${view === v ? 'bg-brand-700 text-white' : 'text-stone-600 hover:bg-stone-100'}`}
            >
              {t(`templates.view.${v}`)}
            </button>
          ))}
        </div>
        <Input type="search" placeholder={t('templates.search')} aria-label={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select aria-label={t('common.type')} value={type} onChange={(e) => setType(e.target.value)} className="w-auto">
          <option value="">{`${t('common.type')}: ${t('common.all')}`}</option>
          {CREATABLE_TYPES.map((v) => (
            <option key={v} value={v}>
              {t(`type.${v}`)}
            </option>
          ))}
        </Select>
        <Select aria-label={t('common.status')} value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="">{`${t('common.status')}: ${t('common.all')}`}</option>
          {(['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'] as const).map((v) => (
            <option key={v} value={v}>
              {t(`status.${v}`)}
            </option>
          ))}
        </Select>
        {templates.data ? <span className="text-sm text-stone-500">{t('templates.count', { count: rows.length })}</span> : null}
      </div>

      {templates.isPending ? <Spinner /> : null}
      {templates.isError ? <ErrorNotice error={templates.error} /> : null}
      {templates.data && !rows.length ? <EmptyState>{t('common.empty')}</EmptyState> : null}
      {rows.length ? (
        <Table>
          <thead>
            <tr>
              <Th>{t('templates.col.template')}</Th>
              <Th>{t('common.type')}</Th>
              <Th>{t('templates.col.tier')}</Th>
              <Th>{t('common.status')}</Th>
              <Th>{t('templates.col.version')}</Th>
              <Th className="text-right">{t('templates.col.likes')}</Th>
              <Th>{t('common.updated')}</Th>
              <Th className="text-right">{t('common.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tpl) => {
              const { current, pendingDraft } = workingInfo(tpl);
              const output = tpl.outputs[0] ?? 'WEBSITE';
              const Icon = TYPE_ICONS[output as keyof typeof TYPE_ICONS] ?? Globe;
              return (
                <tr key={tpl.id} className="hover:bg-stone-50">
                  <Td>
                    <Link href={`/templates/${tpl.id}`} className="font-medium text-stone-900 hover:text-brand-700 hover:underline">
                      {tpl.name}
                    </Link>
                    <p className="mt-0.5 font-mono text-xs text-stone-500">{tpl.key}</p>
                    <p className="text-xs text-stone-500">
                      {tpl.category}
                      {tpl.style ? ` · ${tpl.style}` : ''}
                    </p>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-1.5">
                      <Icon className="size-4 text-stone-400" aria-hidden /> {tMaybe(`type.${output}`)}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={tpl.tier === 'PREMIUM' ? 'gold' : tpl.tier === 'STANDARD' ? 'brand' : 'neutral'}>{t(`tier.${tpl.tier}`)}</Badge>
                      {tpl.badge ? <Badge>{t(`badge.${tpl.badge}`)}</Badge> : null}
                      {tpl.featured ? (
                        <Badge tone="gold" aria-label={t('details.featured')}>
                          <Star className="size-3" aria-hidden />
                        </Badge>
                      ) : null}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={statusTone(tpl.status)}>{t(`status.${tpl.status}`)}</Badge>
                  </Td>
                  <Td className="tabular-nums">
                    {current ? `v${current.version}` : t('common.none')}
                    {pendingDraft ? <p className="text-xs text-amber-700">{t('templates.draftPending', { version: pendingDraft.version })}</p> : null}
                  </Td>
                  <Td className="text-right whitespace-nowrap tabular-nums">
                    <span className="inline-flex items-center gap-1 text-stone-700">
                      <Heart aria-hidden className="size-3.5 text-stone-400" /> {formatNumber(tpl.likeCount ?? 0)}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(tpl.updatedAt)}</Td>
                  <Td className="text-right whitespace-nowrap">
                    {view === 'deleted' ? (
                      <Button variant="secondary" size="sm" disabled={restore.isPending} onClick={() => restore.mutate(tpl.id)}>
                        <RotateCcw className="size-3.5" /> {t('templates.restore')}
                      </Button>
                    ) : (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setDuplicating(tpl)}>
                          <Copy className="size-3.5" /> {t('templates.duplicate')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleting(tpl)} aria-label={t('templates.deleteNamed', { name: tpl.name })}>
                          <Trash2 className="size-3.5 text-red-700" /> {t('templates.delete')}
                        </Button>
                      </>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : null}

      <Modal open={importing} onClose={() => setImporting(false)} title={t('templates.import.title')} wide>
        {importing ? <ImportCardForm onDone={() => setImporting(false)} /> : null}
      </Modal>
      <Modal open={creating} onClose={() => setCreating(false)} title={t('templates.createTitle')}>
        <CreateTemplateForm templates={templates.data ?? []} onDone={() => setCreating(false)} />
      </Modal>
      <Modal open={!!duplicating} onClose={() => setDuplicating(null)} title={t('templates.duplicateTitle', { name: duplicating?.name ?? '' })}>
        {duplicating ? <DuplicateForm source={duplicating} onDone={() => setDuplicating(null)} /> : null}
      </Modal>
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={t('templates.deleteTitle', { name: deleting?.name ?? '' })}>
        {deleting ? <DeleteTemplate template={deleting} onDone={() => setDeleting(null)} /> : null}
      </Modal>
    </>
  );
}

/** Confirm a delete: the template leaves the catalog; events using it keep working; it can be restored. */
function DeleteTemplate({ template, onDone }: { template: AdminTemplate; onDone: () => void }) {
  const invalidate = useInvalidate();
  const remove = useMutation({
    mutationFn: () => apiDelete(`/admin/templates/${template.id}`),
    onSuccess: async () => {
      await invalidate(['admin', 'templates']);
      onDone();
    },
  });
  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-700">{t('templates.deleteBody')}</p>
      {remove.isError ? <Alert tone="danger">{errorMessage(remove.error, t('common.error'))}</Alert> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>
          <Trash2 className="size-4" /> {t('templates.delete')}
        </Button>
      </div>
    </div>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function CreateTemplateForm({ templates, onDone }: { templates: AdminTemplate[]; onDone: () => void }) {
  const router = useRouter();
  const invalidate = useInvalidate();
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [category, setCategory] = useState('');
  const [type, setType] = useState<(typeof CREATABLE_TYPES)[number]>('WEBSITE');
  const [from, setFrom] = useState('');
  const categories = useMemo(() => [...new Set(templates.map((tpl) => tpl.category))].sort(), [templates]);
  const sources = templates.filter((tpl) => tpl.outputs.includes(type) && tpl.currentVersionId);

  const create = useMutation({
    mutationFn: () =>
      apiPost<{ template: { id: string } }>('/admin/templates', { key, name, category, type, ...(from ? { fromTemplateKey: from } : {}) }),
    onSuccess: async (res) => {
      await invalidate(['admin', 'templates']);
      onDone();
      router.push(`/templates/${res.template.id}`);
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {create.isError ? <Alert>{errorMessage(create.error, t('common.error'))}</Alert> : null}
      <Field label={t('common.name')}>
        {(p) => (
          <Input
            {...p}
            required
            maxLength={80}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!keyTouched) setKey(slugify(e.target.value));
            }}
          />
        )}
      </Field>
      <Field label={t('templates.key')} hint={t('templates.keyHint')}>
        {(p) => (
          <Input
            {...p}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={80}
            className="font-mono"
            value={key}
            onChange={(e) => {
              setKeyTouched(true);
              setKey(e.target.value);
            }}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('common.category')}>
          {(p) => (
            <>
              <Input {...p} required maxLength={60} list="template-categories" value={category} onChange={(e) => setCategory(e.target.value)} />
              <datalist id="template-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label={t('common.type')}>
          {(p) => (
            <Select
              {...p}
              value={type}
              onChange={(e) => {
                setType(e.target.value as (typeof CREATABLE_TYPES)[number]);
                setFrom('');
              }}
            >
              {CREATABLE_TYPES.map((v) => (
                <option key={v} value={v}>
                  {t(`type.${v}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label={t('templates.from')}>
        {(p) => (
          <Select {...p} value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">{t('templates.fromBlank')}</option>
            {sources.map((tpl) => (
              <option key={tpl.id} value={tpl.key}>
                {tpl.name} ({tpl.key})
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? t('common.saving') : t('common.create')}
        </Button>
      </div>
    </form>
  );
}

function DuplicateForm({ source, onDone }: { source: AdminTemplate; onDone: () => void }) {
  const router = useRouter();
  const invalidate = useInvalidate();
  const [name, setName] = useState(`${source.name} (copy)`);
  const [key, setKey] = useState(`${source.key}-copy`.slice(0, 80));
  const duplicate = useMutation({
    mutationFn: () => apiPost<{ id: string }>(`/admin/templates/${source.id}/duplicate`, { key, name }),
    onSuccess: async (res) => {
      await invalidate(['admin', 'templates']);
      onDone();
      router.push(`/templates/${res.id}`);
    },
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        duplicate.mutate();
      }}
      className="space-y-4"
    >
      {duplicate.isError ? <Alert>{errorMessage(duplicate.error, t('common.error'))}</Alert> : null}
      <Field label={t('common.name')}>{(p) => <Input {...p} required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
      <Field label={t('templates.key')} hint={t('templates.keyHint')}>
        {(p) => <Input {...p} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} className="font-mono" value={key} onChange={(e) => setKey(e.target.value)} />}
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={duplicate.isPending}>
          {duplicate.isPending ? t('common.saving') : t('templates.duplicate')}
        </Button>
      </div>
    </form>
  );
}
