import { ArrowRight, Clock3, Mail, MessageCircle, Phone, type LucideIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createTranslator } from '@bulava/localization';
import { Mandala } from '@bulava/template-engine/src/ornaments';
import { pageAnchor, parsePageBody, type PageBlock, type PageTokenValues, type PublicSitePage, type PublicSitePageLink } from '@bulava/validation';
import { ContactForm } from '@/components/marketing/contact-form';
import { PageBlocks } from '@/components/marketing/page-blocks';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { getSitePage, getSitePages } from '@/lib/server-api';
import { getSiteConfig, whatsappChatUrl } from '@/lib/site-config';

// Pages are edited in the admin console: rendered on first visit, then refreshed every minute.
export const revalidate = 60;

const t = createTranslator('en');

/** None at build time (the API is not reachable then); each page renders on its first visit. */
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }): Promise<Metadata> {
  const { page } = await params;
  const content = await getSitePage(page).catch(() => null);
  return content ? { title: content.title, description: content.description, alternates: { canonical: `/${content.slug}` } } : {};
}

interface Section {
  heading: string;
  anchor: string;
  blocks: PageBlock[];
}

/** Sections with the settings' values filled in; a section left empty (no company address yet) is skipped. */
function sectionsOf(page: PublicSitePage, values: PageTokenValues): Section[] {
  return page.sections.map((s) => ({ heading: s.heading, anchor: pageAnchor(s.heading), blocks: parsePageBody(s.body, values) })).filter((s) => s.blocks.length);
}

const readingMinutes = (page: PublicSitePage) => Math.max(1, Math.round(page.sections.reduce((n, s) => n + s.body.split(/\s+/).length, 0) / 220));

/** About: each section a numbered clay card. */
function SectionCards({ sections }: { sections: Section[] }) {
  return (
    <ol className={`mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-2 ${sections.length % 3 === 0 ? 'lg:max-w-6xl lg:grid-cols-3' : ''}`}>
      {sections.map((s, i) => (
        <li key={s.anchor} id={s.anchor} className="clay clay-lift flex scroll-mt-28 flex-col rounded-[1.75rem] p-7 sm:p-8">
          <span aria-hidden="true" className="font-display text-5xl leading-none text-gold-500">
            {String(i + 1).padStart(2, '0')}
          </span>
          <h2 className="mt-5 font-display text-2xl tracking-[-0.01em] sm:text-[1.7rem]">{s.heading}</h2>
          <PageBlocks blocks={s.blocks} className="mt-3 text-base" />
        </li>
      ))}
    </ol>
  );
}

/** Policies: one reading card, with an index of its sections (sticky beside it on wide screens). */
function Document({ sections, related }: { sections: Section[]; related: PublicSitePageLink[] }) {
  const index = (
    <ol className="mt-4 space-y-1 text-sm">
      {sections.map((s, i) => (
        <li key={s.anchor}>
          <a href={`#${s.anchor}`} className="flex gap-2.5 rounded-lg px-2 py-1.5 text-stone-600 transition-colors duration-300 hover:bg-white/70 hover:text-brand-700">
            <span aria-hidden="true" className="w-5 shrink-0 text-right font-display text-gold-600 tabular-nums">
              {i + 1}
            </span>
            {s.heading}
          </a>
        </li>
      ))}
    </ol>
  );
  return (
    <div className="mx-auto mt-12 grid max-w-6xl gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav aria-label={t('content.onThisPage')} className="hidden lg:block">
        <div className="clay-inset sticky top-28 max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-[1.5rem] p-4" data-lenis-prevent>
          <p className="eyebrow px-2 text-brand-700">{t('content.onThisPage')}</p>
          {index}
        </div>
      </nav>
      <div className="min-w-0">
        {/* Phones: the same index, folded away until asked for. */}
        <details className="clay-inset group mb-6 rounded-[1.5rem] p-4 lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between px-2 font-semibold text-ink [&::-webkit-details-marker]:hidden">
            {t('content.onThisPage')}
            <span aria-hidden="true" className="text-xl text-brand-700 transition-transform duration-300 group-open:rotate-45">
              +
            </span>
          </summary>
          <nav aria-label={t('content.onThisPage')}>{index}</nav>
        </details>
        <article className="clay rounded-[2rem] p-6 sm:p-12">
          <div className="space-y-12">
            {sections.map((s, i) => (
              <section key={s.anchor} id={s.anchor} aria-labelledby={`${s.anchor}-title`} className="scroll-mt-28">
                <h2 id={`${s.anchor}-title`} className="flex items-baseline gap-3 font-display text-[1.75rem] leading-tight tracking-[-0.01em] sm:text-3xl">
                  <span aria-hidden="true" className="font-display text-lg text-gold-600 tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {s.heading}
                </h2>
                <PageBlocks blocks={s.blocks} className="mt-4" />
              </section>
            ))}
          </div>
        </article>
        <aside className="mt-8 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="clay flex items-center gap-4 rounded-[1.5rem] p-5">
            <span className="icon-3d size-11 shrink-0 rounded-xl">
              <Mail aria-hidden className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-xl text-ink">{t('content.questions')}</p>
              <p className="text-sm text-stone-600">{t('content.questionsBody')}</p>
            </div>
          </div>
          <Link href="/contact" className="btn-3d group/cta min-h-12 rounded-2xl px-6">
            {t('content.contactUs')}
            <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/cta:translate-x-1" />
          </Link>
        </aside>
        {related.length ? (
          <nav aria-label={t('content.related')} className="mt-10">
            <p className="eyebrow text-brand-700">{t('content.related')}</p>
            <ul className="mt-4 flex flex-wrap gap-2.5">
              {related.map((p) => (
                <li key={p.slug}>
                  <Link href={`/${p.slug}`} className="btn-3d btn-3d-light min-h-10 rounded-full px-4 text-sm">
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </div>
  );
}

interface ContactAction {
  href: string;
  label: string;
  detail: string;
  icon: LucideIcon;
  external?: boolean;
}

/** Contact: the form, with quick actions and the page's sections beside it. */
function Contact({ sections, actions, supportEmail }: { sections: Section[]; actions: ContactAction[]; supportEmail: string }) {
  return (
    <div className="mx-auto mt-12 grid max-w-6xl items-start gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="clay relative rounded-[2rem] p-6 sm:p-10">
        <ContactForm supportEmail={supportEmail} />
      </div>
      <div className="space-y-5">
        <h2 className="sr-only">{t('contact.reach')}</h2>
        {actions.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {actions.map(({ href, label, detail, icon: Icon, external }) => (
              <li key={href}>
                <a href={href} {...(external ? { target: '_blank', rel: 'noopener' } : {})} className="clay clay-lift group flex items-center gap-4 rounded-[1.5rem] p-4">
                  <span className="icon-3d size-12 shrink-0 rounded-xl transition-transform duration-500 group-hover:-rotate-6">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-xl text-ink">{label}</span>
                    <span className="block truncate text-sm text-stone-600">{detail}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {sections.map((s) => (
          <section key={s.anchor} id={s.anchor} className="clay-inset scroll-mt-28 rounded-[1.5rem] p-5 sm:p-6">
            <h3 className="font-display text-xl text-ink">{s.heading}</h3>
            <PageBlocks blocks={s.blocks} className="mt-2 space-y-3 text-[0.9375rem]" />
          </section>
        ))}
      </div>
    </div>
  );
}

export default async function ContentRoute({ params }: { params: Promise<{ page: string }> }) {
  const { page: slug } = await params;
  const [page, { site, seo }, links] = await Promise.all([getSitePage(slug), getSiteConfig(), getSitePages()]);
  if (!page) notFound();

  const values: PageTokenValues = {
    siteName: site.name,
    supportEmail: site.supportEmail,
    supportPhone: site.supportPhone,
    legalName: seo.organization.legalName,
    address: seo.organization.address,
    grievanceOfficer: seo.organization.grievanceOfficer,
  };
  const sections = sectionsOf(page, values);
  const updated = new Date(page.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const actions: ContactAction[] =
    page.layout === 'CONTACT'
      ? [
          { href: `mailto:${site.supportEmail}`, label: t('contact.action.email'), detail: site.supportEmail, icon: Mail },
          ...(site.supportPhone ? [{ href: `tel:${site.supportPhone}`, label: t('contact.action.call'), detail: site.supportPhone, icon: Phone }] : []),
          ...(site.whatsappNumber
            ? [{ href: whatsappChatUrl(site.whatsappNumber, site.whatsappMessage), label: t('contact.action.whatsapp'), detail: site.whatsappNumber, icon: MessageCircle, external: true }]
            : []),
        ]
      : [];
  const related = page.layout === 'DOCUMENT' ? links.filter((l) => l.footerGroup === 'LEGAL' && l.slug !== page.slug) : [];

  return (
    <>
      <SiteHeader />
      {/* Clip sideways only: overflow-hidden would stop the policies' index from sticking. */}
      <main className="relative isolate min-h-dvh overflow-x-clip px-4 pt-14 pb-28 sm:px-6 sm:pt-20">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(ellipse_55%_70%_at_50%_0%,rgba(233,200,127,0.4),transparent_70%)]" />
        <Mandala className="pointer-events-none absolute -top-72 left-1/2 -z-10 w-[720px] -translate-x-1/2 animate-spin-slow text-gold-500 opacity-[0.08]" />
        <header className="mx-auto max-w-3xl text-center">
          <p className="eyebrow text-brand-700">{page.footerGroup === 'LEGAL' ? t('content.legal') : site.name}</p>
          <h1 className="mt-4 font-display text-[2.6rem] leading-[1.05] tracking-[-0.02em] text-balance sm:text-6xl">{page.title}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-pretty text-stone-600">{page.description}</p>
          {/* Policies show when they last changed and how long they take to read. */}
          {page.layout === 'DOCUMENT' ? (
            <p className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 text-sm text-stone-600">
              <span className="rounded-full bg-surface px-3.5 py-1.5 shadow-clay-sm">{t('content.updated', { date: updated })}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-1.5 shadow-clay-sm">
                <Clock3 aria-hidden className="size-3.5 text-gold-600" />
                {t('content.readingTime', { minutes: readingMinutes(page) })}
              </span>
            </p>
          ) : null}
        </header>
        {page.layout === 'DOCUMENT' ? <Document sections={sections} related={related} /> : null}
        {page.layout === 'CARDS' ? <SectionCards sections={sections} /> : null}
        {page.layout === 'CONTACT' ? <Contact sections={sections} actions={actions} supportEmail={site.supportEmail} /> : null}
      </main>
      <SiteFooter />
    </>
  );
}
