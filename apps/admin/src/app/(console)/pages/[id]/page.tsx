'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, Lock, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  PAGE_TOKENS,
  parsePageBody,
  SITE_PAGE_FOOTER_GROUPS,
  SITE_PAGE_LAYOUTS,
  SitePageInputSchema,
  slugify,
  type PageBlock,
  type PageInline,
  type PageToken,
  type PageTokenValues,
  type PublicSiteConfig,
  type SitePageInput,
} from '@bulava/validation';
import { RequirePermission, useInvalidate } from '@/components/shell';
import { Alert, Badge, Button, Card, CardTitle, ErrorNotice, Field, Input, PageHeader, Select, Spinner, Textarea } from '@/components/ui';
import { apiDelete, apiGet, apiPost, apiPut, errorMessage } from '@/lib/api';
import { t, type AdminMessageKey } from '@/lib/i18n';
import type { SitePage } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';

export default function PageEditorRoute() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequirePermission permission="page.manage">
      {id === 'new' ? <PageEditor page={null} /> : <ExistingPage id={id} />}
    </RequirePermission>
  );
}

function ExistingPage({ id }: { id: string }) {
  const page = useQuery({ queryKey: ['admin', 'pages', id], queryFn: () => apiGet<SitePage>(`/admin/pages/${id}`) });
  if (page.isPending) return <Spinner />;
  if (page.isError) return <ErrorNotice error={page.error} />;
  return <PageEditor page={page.data} />;
}

const EMPTY: SitePageInput = {
  slug: '',
  title: '',
  description: '',
  layout: 'DOCUMENT',
  status: 'DRAFT',
  footerGroup: null,
  sortOrder: 10,
  sections: [{ heading: '', body: '' }],
};

function toInput(page: SitePage): SitePageInput {
  const { slug, title, description, layout, status, footerGroup, sortOrder, sections } = page;
  return { slug, title, description, layout, status, footerGroup, sortOrder, sections: sections.length ? sections : [{ heading: '', body: '' }] };
}

function PageEditor({ page }: { page: SitePage | null }) {
  const router = useRouter();
  const invalidate = useInvalidate();
  // What was last loaded or saved; the form is "unsaved" while it differs.
  const [initial, setInitial] = useState<SitePageInput>(() => (page ? toInput(page) : EMPTY));
  const [form, setForm] = useState<SitePageInput>(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(page));
  const [issues, setIssues] = useState<string[]>([]);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const locked = page?.system ?? false;

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = <K extends keyof SitePageInput>(key: K, value: SitePageInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setSection = (index: number, patch: Partial<SitePageInput['sections'][number]>) =>
    setForm((f) => ({ ...f, sections: f.sections.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));
  const moveSection = (index: number, by: -1 | 1) =>
    setForm((f) => {
      const next = [...f.sections];
      const [moved] = next.splice(index, 1);
      next.splice(index + by, 0, moved!);
      return { ...f, sections: next };
    });

  const save = useMutation({
    mutationFn: (body: SitePageInput) => (page ? apiPut<SitePage>(`/admin/pages/${page.id}`, body) : apiPost<SitePage>('/admin/pages', body)),
    onSuccess: async (saved) => {
      setInitial(toInput(saved));
      setForm(toInput(saved));
      await invalidate(['admin', 'pages']);
      if (!page) router.replace(`/pages/${saved.id}`);
    },
  });
  const remove = useMutation({
    mutationFn: () => apiDelete(`/admin/pages/${page!.id}`),
    onSuccess: async () => {
      await invalidate(['admin', 'pages']);
      router.push('/pages');
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = SitePageInputSchema.safeParse(form);
    if (!parsed.success) {
      setIssues(parsed.error.issues.slice(0, 6).map((i) => `${issueLabel(i.path)}: ${i.message}`));
      return;
    }
    setIssues([]);
    save.mutate(parsed.data);
  }

  return (
    <form onSubmit={submit}>
      <Link href="/pages" className="mb-3 inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-brand-700">
        <ArrowLeft className="size-4" aria-hidden /> {t('pages.back')}
      </Link>
      <PageHeader
        title={page ? page.title : t('pages.new')}
        subtitle={page ? t('pages.lastSaved', { when: formatDateTime(page.updatedAt) }) : t('pages.newSubtitle')}
        actions={
          <>
            {dirty ? <Badge tone="warning">{t('settings.unsaved')}</Badge> : null}
            {page?.status === 'PUBLISHED' ? (
              <a href={page.url} target="_blank" rel="noopener" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-stone-700 hover:bg-stone-100">
                <ExternalLink className="size-4" aria-hidden /> {t('pages.view')}
              </a>
            ) : null}
            <Button type="submit" disabled={save.isPending || (!dirty && Boolean(page))}>
              {save.isPending ? t('common.saving') : page ? t('common.save') : t('pages.create')}
            </Button>
          </>
        }
      />

      {issues.length ? (
        <Alert className="mb-4">
          <p className="font-semibold">{t('pages.fix')}</p>
          <ul className="mt-1 list-disc pl-5">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {save.isError ? <Alert className="mb-4">{errorMessage(save.error, t('common.error'))}</Alert> : null}
      {save.isSuccess && !dirty ? (
        <Alert tone="success" className="mb-4">
          {t('pages.saved')}
        </Alert>
      ) : null}
      {remove.isError ? <Alert className="mb-4">{errorMessage(remove.error, t('common.error'))}</Alert> : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="space-y-6">
          <Card>
            <CardTitle>{t('pages.details')}</CardTitle>
            {locked ? (
              <Alert tone="info" className="mb-4">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Lock className="size-3.5" aria-hidden /> {t('pages.builtIn')}
                </span>{' '}
                {t('pages.builtInHint')}
              </Alert>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('pages.titleLabel')}>
                {(p) => (
                  <Input
                    {...p}
                    required
                    maxLength={120}
                    value={form.title}
                    onChange={(e) => {
                      const title = e.target.value;
                      setForm((f) => ({ ...f, title, ...(slugTouched ? {} : { slug: slugify(title).slice(0, 60) }) }));
                    }}
                  />
                )}
              </Field>
              <Field label={t('pages.slug')} hint={t('pages.slugHint', { path: `/${form.slug || '…'}` })}>
                {(p) => (
                  <Input
                    {...p}
                    required
                    disabled={locked}
                    maxLength={60}
                    className="font-mono"
                    value={form.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
                    }}
                  />
                )}
              </Field>
              <Field className="sm:col-span-2" label={t('pages.description')} hint={t('pages.descriptionHint', { count: form.description.length })}>
                {(p) => <Textarea {...p} required rows={2} maxLength={300} value={form.description} onChange={(e) => set('description', e.target.value)} />}
              </Field>
              <Field label={t('pages.layout')} hint={t(`pages.layoutHint.${form.layout}`)}>
                {(p) => (
                  <Select {...p} disabled={locked} value={form.layout} onChange={(e) => set('layout', e.target.value as SitePageInput['layout'])}>
                    {SITE_PAGE_LAYOUTS.map((l) => (
                      <option key={l} value={l}>
                        {t(`pages.layout.${l}`)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t('common.status')} hint={t(form.status === 'PUBLISHED' ? 'pages.statusHint.PUBLISHED' : 'pages.statusHint.DRAFT')}>
                {(p) => (
                  <Select {...p} disabled={locked} value={form.status} onChange={(e) => set('status', e.target.value as SitePageInput['status'])}>
                    <option value="PUBLISHED">{t('status.PUBLISHED')}</option>
                    <option value="DRAFT">{t('status.DRAFT')}</option>
                  </Select>
                )}
              </Field>
              <Field label={t('pages.footer')} hint={t('pages.footerHint')}>
                {(p) => (
                  <Select {...p} value={form.footerGroup ?? ''} onChange={(e) => set('footerGroup', (e.target.value || null) as SitePageInput['footerGroup'])}>
                    <option value="">{t('pages.footer.none')}</option>
                    {SITE_PAGE_FOOTER_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {t(`pages.footer.${g}`)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t('pages.order')} hint={t('pages.orderHint')}>
                {(p) => <Input {...p} type="number" min={0} max={1000} value={form.sortOrder} onChange={(e) => set('sortOrder', Math.max(0, Math.min(1000, Number(e.target.value) || 0)))} />}
              </Field>
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="mb-0">{t('pages.sections')}</CardTitle>
              <span className="text-xs text-stone-500">{t('pages.sectionsHint')}</span>
            </div>
            <ol className="space-y-4">
              {form.sections.map((section, index) => (
                <li key={index} className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold tracking-wide text-stone-500 uppercase">{t('pages.section', { n: index + 1 })}</span>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" aria-label={t('pages.moveUp')} disabled={index === 0} onClick={() => moveSection(index, -1)}>
                        <ArrowUp className="size-4" aria-hidden />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label={t('pages.moveDown')} disabled={index === form.sections.length - 1} onClick={() => moveSection(index, 1)}>
                        <ArrowDown className="size-4" aria-hidden />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-red-700 hover:bg-red-50"
                        aria-label={t('pages.removeSection')}
                        disabled={form.sections.length === 1}
                        onClick={() => window.confirm(t('pages.confirmRemoveSection')) && setForm((f) => ({ ...f, sections: f.sections.filter((_, i) => i !== index) }))}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Field label={t('pages.heading')}>{(p) => <Input {...p} required maxLength={120} value={section.heading} onChange={(e) => setSection(index, { heading: e.target.value })} />}</Field>
                    <Field label={t('pages.body')}>
                      {(p) => (
                        <Textarea
                          {...p}
                          required
                          maxLength={20_000}
                          // Tall enough for the text: its lines plus about one more per 80 characters of wrapping.
                          rows={Math.min(28, Math.max(6, section.body.split('\n').length + Math.ceil(section.body.length / 80)))}
                          className="font-mono text-[13px] leading-relaxed"
                          value={section.body}
                          onChange={(e) => setSection(index, { body: e.target.value })}
                        />
                      )}
                    </Field>
                  </div>
                </li>
              ))}
            </ol>
            <Button variant="secondary" className="mt-4" disabled={form.sections.length >= 40} onClick={() => setForm((f) => ({ ...f, sections: [...f.sections, { heading: '', body: '' }] }))}>
              <Plus className="size-4" aria-hidden /> {t('pages.addSection')}
            </Button>
          </Card>

          <FormattingGuide />

          {page && !page.system ? (
            <Card className="border-red-200">
              <CardTitle>{t('pages.deleteTitle')}</CardTitle>
              <p className="mb-3 text-sm text-stone-600">{t('pages.deleteHint')}</p>
              <Button variant="danger" disabled={remove.isPending} onClick={() => window.confirm(t('pages.confirmDelete', { title: page.title })) && remove.mutate()}>
                <Trash2 className="size-4" aria-hidden /> {t('pages.delete')}
              </Button>
            </Card>
          ) : null}
        </div>

        <div className="xl:sticky xl:top-6">
          <Preview form={form} />
        </div>
      </div>
    </form>
  );
}

function issueLabel(path: PropertyKey[]): string {
  if (path[0] === 'sections' && typeof path[1] === 'number') return `${t('pages.section', { n: path[1] + 1 })}${path[2] ? ` · ${String(path[2])}` : ''}`;
  return String(path[0] ?? '');
}

// ───────── Guide and preview ─────────

function useTokenValues(): { values: PageTokenValues; loaded: boolean } {
  const config = useQuery({ queryKey: ['public', 'site-config'], queryFn: () => apiGet<PublicSiteConfig>('/public/site-config'), staleTime: 60_000 });
  const c = config.data;
  return {
    loaded: Boolean(c),
    values: c
      ? {
          siteName: c.site.name,
          supportEmail: c.site.supportEmail,
          supportPhone: c.site.supportPhone,
          legalName: c.seo.organization.legalName,
          address: c.seo.organization.address,
          grievanceOfficer: c.seo.organization.grievanceOfficer,
        }
      : {},
  };
}

const MARKUP: Array<[string, AdminMessageKey]> = [
  ['A blank line', 'pages.guide.paragraph'],
  ['### Sub-heading', 'pages.guide.heading'],
  ['- Item', 'pages.guide.bullets'],
  ['1. Item', 'pages.guide.numbers'],
  ['**bold**', 'pages.guide.bold'],
  ['[text](/terms)', 'pages.guide.link'],
];

function FormattingGuide() {
  const { values, loaded } = useTokenValues();
  return (
    <Card>
      <details>
        <summary className="cursor-pointer text-base font-semibold text-stone-900">{t('pages.guide.title')}</summary>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">{t('pages.guide.markup')}</p>
            <dl className="space-y-1.5 text-sm">
              {MARKUP.map(([code, help]) => (
                <div key={code} className="flex gap-3">
                  <dt className="w-32 shrink-0 font-mono text-xs text-brand-700">{code}</dt>
                  <dd className="text-stone-600">{t(help)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-stone-500">{t('pages.guide.autolink')}</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">{t('pages.guide.tokens')}</p>
            <dl className="space-y-1.5 text-sm">
              {PAGE_TOKENS.map((token: PageToken) => (
                <div key={token} className="flex gap-3">
                  <dt className="w-36 shrink-0 font-mono text-xs text-brand-700">{`{${token}}`}</dt>
                  <dd className={cn('min-w-0 truncate', values[token] ? 'text-stone-700' : 'text-amber-700')}>{loaded ? (values[token] ?? t('pages.guide.notSet')) : '…'}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-stone-500">{t('pages.guide.tokensHint')}</p>
          </div>
        </div>
      </details>
    </Card>
  );
}

function Inline({ nodes }: { nodes: PageInline[] }) {
  return nodes.map((n, i) =>
    n.type === 'strong' ? (
      <strong key={i}>{n.text}</strong>
    ) : n.type === 'link' ? (
      <span key={i} className="font-semibold text-brand-700 underline decoration-gold-300 underline-offset-2">
        {n.text}
      </span>
    ) : (
      n.text
    ),
  );
}

function Blocks({ blocks }: { blocks: PageBlock[] }): ReactNode {
  return blocks.map((b, i) =>
    b.type === 'h3' ? (
      <h4 key={i} className="pt-1 font-display text-base font-semibold text-stone-900">
        <Inline nodes={b.content} />
      </h4>
    ) : b.type === 'p' ? (
      <p key={i}>
        <Inline nodes={b.content} />
      </p>
    ) : (
      <ul key={i} className={cn('space-y-1 pl-5', b.type === 'ol' ? 'list-decimal' : 'list-disc marker:text-gold-500')}>
        {b.items.map((item, j) => (
          <li key={j}>
            <Inline nodes={item} />
          </li>
        ))}
      </ul>
    ),
  );
}

/** A close approximation of the public page, parsed exactly as the site parses it. */
function Preview({ form }: { form: SitePageInput }) {
  const { values } = useTokenValues();
  const sections = form.sections.map((s) => ({ heading: s.heading, blocks: parsePageBody(s.body, values) }));
  const hidden = sections.filter((s) => s.heading && !s.blocks.length).length;
  return (
    <section aria-label={t('pages.preview')} className="overflow-hidden rounded-xl border border-stone-200 bg-[#f6eee5] shadow-sm">
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-2 text-xs text-stone-500">
        <span className="font-semibold tracking-wide uppercase">{t('pages.preview')}</span>
        <span className="font-mono">/{form.slug || '…'}</span>
      </div>
      <div className="max-h-[calc(100dvh-9rem)] overflow-y-auto p-5 sm:p-7">
        <p className="text-center font-display text-3xl leading-tight text-stone-900">{form.title || t('pages.titleLabel')}</p>
        <p className="mx-auto mt-2 max-w-md text-center text-sm text-stone-600">{form.description}</p>
        {hidden ? (
          <Alert tone="warning" className="mt-4">
            {t('pages.hiddenSections', { count: hidden })}
          </Alert>
        ) : null}
        <div className={cn('mt-6 gap-4', form.layout === 'CARDS' ? 'grid sm:grid-cols-2' : 'space-y-4')}>
          {form.layout === 'CONTACT' ? (
            <div className="rounded-2xl border border-dashed border-gold-300 bg-white/70 p-4 text-center text-sm text-stone-500">{t('pages.contactFormHere')}</div>
          ) : null}
          {sections.map((s, i) =>
            s.blocks.length ? (
              <article key={i} className="rounded-2xl bg-[#fffaf5] p-5 shadow-[inset_0_2px_2px_rgba(255,255,255,0.9),3px_8px_16px_-6px_rgba(56,32,22,0.15)]">
                <h3 className="font-display text-xl text-stone-900">{s.heading || '…'}</h3>
                <div className="mt-2 space-y-2.5 text-sm leading-relaxed text-stone-700">
                  <Blocks blocks={s.blocks} />
                </div>
              </article>
            ) : null,
          )}
        </div>
      </div>
    </section>
  );
}
