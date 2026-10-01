import {
  ArrowRight,
  ArrowUpRight,
  Baby,
  Building2,
  CalendarHeart,
  Cake,
  Camera,
  Check,
  Clapperboard,
  Flame,
  Flower2,
  Gem,
  HeartHandshake,
  House,
  Languages,
  ListChecks,
  LockKeyhole,
  Megaphone,
  MessageCircle,
  Minus,
  Palette,
  PartyPopper,
  Play,
  Plus,
  QrCode,
  Quote,
  Send,
  Sparkle,
  Star,
  Users,
  Wine,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Fragment } from 'react';
import { createTranslator, type MessageKey } from '@bulava/localization';
import { Mandala, SCENES, TemplateStyles } from '@bulava/template-engine';
import { SpotlightGrid } from '@/components/effects/spotlight-grid';
import { TiltCard } from '@/components/effects/tilt-card';
import { AuthAwareLink } from '@/components/marketing/account-links';
import { HeroStage } from '@/components/marketing/hero-stage';
import { PricingCards } from '@/components/marketing/pricing-cards';
import { SceneCoverflow, type CoverflowItem } from '@/components/marketing/scene-coverflow';
import { SectionHeading, SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { SiteStructuredData } from '@/components/marketing/structured-data';
import { TemplateCard, TemplatePhone } from '@/components/marketing/template-card';
import { TemplateExplorer, type ExplorerItem } from '@/components/marketing/template-explorer';
import { VideoShowcase } from '@/components/marketing/video-showcase';
import { MagneticButton } from '@/lib/motion/magnetic-button';
import { getPlans, getStats, getTemplates, getTestimonials, tierPrice, type TemplateSummary } from '@/lib/server-api';
import { getSiteConfig } from '@/lib/site-config';
import { cn } from '@/lib/utils';
import { Parallax, Reveal, StepsProgress } from './home-animations';

export const revalidate = 60;

const t = createTranslator('en');

const TRADITIONS = ['signature', 'hindu', 'sikh', 'muslim', 'south-indian', 'christian', 'bengali', 'marathi', 'gujarati', 'punjabi'];
const MARQUEE = ['hindu', 'sikh', 'muslim', 'south-indian', 'christian', 'bengali', 'marathi', 'gujarati', 'punjabi', 'rajasthani', 'destination', 'modern'];

const CATEGORIES: Array<{ key: string; href: string; icon: LucideIcon }> = [
  { key: 'weddings', href: '/templates?event=WEDDING', icon: Gem },
  { key: 'preWedding', href: '/templates?tag=haldi', icon: Flower2 },
  { key: 'saveTheDate', href: '/templates?tag=save-the-date', icon: CalendarHeart },
  { key: 'engagement', href: '/templates?event=ENGAGEMENT', icon: HeartHandshake },
  { key: 'birthday', href: '/templates?event=BIRTHDAY', icon: Cake },
  { key: 'anniversary', href: '/templates?event=ANNIVERSARY', icon: Wine },
  { key: 'family', href: '/templates?event=BABY_SHOWER', icon: Baby },
  { key: 'home', href: '/templates?event=HOUSEWARMING', icon: House },
  { key: 'faith', href: '/templates?event=RELIGIOUS', icon: Flame },
  { key: 'corporate', href: '/templates?event=CORPORATE', icon: Building2 },
];

/** Bento order: wide cards fill two columns so every row of four is complete. */
const FEATURES: Array<{ key: 'private' | 'rsvp' | 'languages' | 'whatsapp' | 'photos' | 'video' | 'checkin' | 'updates'; icon: LucideIcon; wide?: boolean }> = [
  { key: 'private', icon: LockKeyhole, wide: true },
  { key: 'rsvp', icon: ListChecks },
  { key: 'languages', icon: Languages },
  { key: 'whatsapp', icon: MessageCircle },
  { key: 'photos', icon: Camera },
  { key: 'video', icon: Clapperboard, wide: true },
  { key: 'checkin', icon: QrCode, wide: true },
  { key: 'updates', icon: Megaphone, wide: true },
];

const STEPS: Array<{ n: 1 | 2 | 3 | 4; icon: LucideIcon }> = [
  { n: 1, icon: Palette },
  { n: 2, icon: Users },
  { n: 3, icon: Send },
  { n: 4, icon: PartyPopper },
];

type Mark = 'yes' | 'no' | 'partly';
const COMPARE_ROWS: Array<{ key: MessageKey; values: [Mark | string, Mark | string, Mark | string] }> = [
  { key: 'home.compare.cost', values: [t('home.compare.cost.bulava'), t('home.compare.cost.print'), t('home.compare.cost.video')] },
  { key: 'home.compare.edit', values: ['yes', 'no', 'no'] },
  { key: 'home.compare.rsvp', values: ['yes', 'no', 'no'] },
  { key: 'home.compare.perGuest', values: ['yes', 'partly', 'no'] },
  { key: 'home.compare.map', values: ['yes', 'no', 'partly'] },
  { key: 'home.compare.photos', values: ['yes', 'no', 'no'] },
  { key: 'home.compare.languages', values: ['yes', 'partly', 'partly'] },
];

/** The gold call to action used on dark sections. */
const GOLD_CTA =
  'group/cta inline-flex min-h-13 items-center gap-2 rounded-full bg-gradient-to-b from-gold-200 to-gold-300 px-7 text-base font-semibold text-night-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_18px_40px_-16px_rgba(227,197,133,0.75)] transition-[background-color,box-shadow] duration-300 hover:from-gold-100 hover:to-gold-200';
const GHOST_CTA =
  'group/ghost inline-flex min-h-13 items-center gap-3 rounded-full py-2 pr-6 pl-2 text-base font-medium text-ivory ring-1 ring-white/15 transition-[background-color,box-shadow] duration-300 hover:bg-white/5 hover:ring-gold-300/40';

function CompareMark({ value, lead }: { value: string; lead: boolean }) {
  if (value === 'yes')
    return (
      <>
        <span aria-hidden className={cn('mx-auto grid size-7 place-items-center rounded-full', lead ? 'bg-gold-300 text-brand-900' : 'bg-emerald-50 text-emerald-700')}>
          <Check className="size-4" strokeWidth={3} />
        </span>
        <span className="sr-only">{t('home.compare.yes')}</span>
      </>
    );
  if (value === 'no')
    return (
      <>
        <X aria-hidden className="mx-auto size-4 text-stone-400" />
        <span className="sr-only">{t('home.compare.no')}</span>
      </>
    );
  if (value === 'partly')
    return (
      <>
        <Minus aria-hidden className="mx-auto size-4 text-gold-500" />
        <span className="sr-only">{t('home.compare.partly')}</span>
      </>
    );
  return <>{value}</>;
}

function Proof({ stats }: { stats: Awaited<ReturnType<typeof getStats>> }) {
  if (!stats) return null;
  // Only real numbers from the database; small counts are not shown as "social proof".
  const items = [
    t('home.proof.templates', { count: stats.templates }),
    t('home.proof.languages', { count: stats.languages }),
    ...(stats.events >= 100 ? [t('home.proof.events', { count: stats.events.toLocaleString('en-IN') })] : []),
    ...(stats.rsvps >= 1000 ? [t('home.proof.rsvps', { count: stats.rsvps.toLocaleString('en-IN') })] : []),
  ];
  return (
    <ul className="mt-10 flex animate-fade-in-up flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/10 pt-7 text-sm text-ivory/70" style={{ animationDelay: '0.9s' }}>
      {items.map((i) => (
        <li key={i} className="flex items-center gap-2">
          <Sparkle aria-hidden className="size-3.5 fill-gold-300 text-gold-300" />
          {i}
        </li>
      ))}
    </ul>
  );
}

/** The hero title rises word by word from behind a mask, in CSS so it plays from the first paint. */
function RisingWords({ text, start = 0.15 }: { text: string; start?: number }) {
  const words = text.split(' ');
  return words.map((word, i) => (
    <Fragment key={i}>
      <span aria-hidden="true" className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-bottom">
        <span className="inline-block animate-word-rise" style={{ animationDelay: `${(start + i * 0.07).toFixed(2)}s` }}>
          {word}
        </span>
      </span>
      {i < words.length - 1 ? ' ' : null}
    </Fragment>
  ));
}

export default async function HomePage() {
  const [templates, plans, stats, testimonials, siteConfig] = await Promise.all([getTemplates(), getPlans(), getStats(), getTestimonials(), getSiteConfig()]);
  const websites = templates.filter((x) => x.outputs.includes('WEBSITE') && x.definition);
  const videos = templates.filter((x) => x.outputs.includes('VIDEO') && x.definition);
  const byKey = new Map(websites.map((w) => [w.key, w]));
  // The stage plays a flagship scene live; two more designs sit behind it.
  const heroLive = byKey.get('marigold-mahal') ?? websites.find((w) => w.featured) ?? websites[0];
  const heroBack = ['rajwada-royale', 'kanjeevaram-gold'].map((k) => byKey.get(k)).filter((x): x is TemplateSummary => !!x);
  // Illustrated 3D scene templates, found from their data (the hero section's variant), flagships first.
  const sceneNames = new Set<string>(SCENES);
  const scenes: CoverflowItem[] = websites
    .filter((w) => sceneNames.has(w.definition?.website?.pages[0]?.sections[0]?.variant ?? ''))
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice(0, 12)
    .map((w) => ({ key: w.key, name: w.name, blurb: w.description ?? '', node: <TemplatePhone template={w} width={250} height={470} sections={1} /> }));
  const spotlight = websites.find((w) => w.featured && w.tier === 'PREMIUM') ?? websites[0];
  const explorerItems: ExplorerItem[] = websites.map((tpl) => ({
    key: tpl.key,
    tier: tpl.tier,
    tags: tpl.tags,
    eventTypes: tpl.eventTypes,
    outputs: tpl.outputs,
    node: <TemplateCard template={tpl} t={t} priceLabel={tierPrice(tpl.tier, plans)} />,
  }));
  const marquee = MARQUEE.map((tag) => t(`tag.${tag}` as MessageKey));

  return (
    <>
      <TemplateStyles />
      <SiteStructuredData config={siteConfig} origin={process.env.WEB_ORIGIN ?? 'http://localhost:3000'} />
      <SiteHeader tone="dark" />
      <main>
        {/* ───── Act one (dark): hero, traditions, illustrated scenes ───── */}
        <div data-header-tone="dark" className="grain relative isolate -mt-16 overflow-hidden bg-night-950 text-ivory lg:-mt-[72px]">
          {/* Ambient light: soft pools of maroon and gold, never a panel with edges. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-[18%] right-[-12%] h-[860px] w-[860px] animate-drift rounded-full bg-[radial-gradient(closest-side,rgba(122,29,39,0.62),rgba(91,14,27,0.22)_55%,transparent)]" />
            <div className="absolute top-[30%] -left-[18%] h-[640px] w-[640px] rounded-full bg-[radial-gradient(closest-side,rgba(184,137,43,0.16),transparent)]" />
            <div className="absolute inset-x-0 top-0 h-[1100px] [background-image:radial-gradient(rgba(227,197,133,0.12)_1px,transparent_1px)] [background-size:30px_30px] [mask-image:radial-gradient(ellipse_70%_55%_at_60%_35%,#000_20%,transparent_75%)]" />
          </div>
          <Parallax speed={0.35} className="absolute -top-44 -left-52 -z-10 w-[620px] text-gold-300 opacity-[0.06]">
            <Mandala className="w-full animate-spin-slow" />
          </Parallax>

          {/* Hero */}
          <section aria-labelledby="hero-title" className="relative mx-auto grid max-w-7xl items-center gap-x-10 gap-y-16 px-4 pt-28 pb-16 sm:px-6 lg:grid-cols-12 lg:pt-36 lg:pb-24">
            <div className="lg:col-span-6">
              <p className="eyebrow animate-fade-in-up bg-white/5 text-gold-200 ring-1 ring-white/10">{t('home.hero.eyebrow')}</p>
              {/* Labelled once, so screen readers read the sentence rather than one masked word at a time. */}
              <h1 id="hero-title" aria-label={t('home.hero.title')} className="mt-6 font-display text-[2.9rem] leading-[1.02] font-medium tracking-tight text-balance sm:text-6xl xl:text-[4.6rem]">
                <RisingWords text={t('home.hero.title')} />
              </h1>
              <p className="mt-7 max-w-xl animate-fade-in-up text-lg leading-relaxed text-pretty text-ivory/75" style={{ animationDelay: '0.55s' }}>
                {t('home.hero.subtitle')}
              </p>
              <p className="mt-3 max-w-xl animate-fade-in-up text-base text-ivory/60" style={{ animationDelay: '0.65s' }}>
                {t('home.hero.support')}
              </p>
              <div className="mt-9 flex animate-fade-in-up flex-wrap items-center gap-3" style={{ animationDelay: '0.75s' }}>
                <MagneticButton strength={0.25}>
                  <Link href="/templates" className={GOLD_CTA}>
                    {t('home.hero.browse')}
                    <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/cta:translate-x-1" />
                  </Link>
                </MagneticButton>
                {heroLive ? (
                  <Link href={`/templates/${heroLive.key}/demo`} className={GHOST_CTA}>
                    <span className="grid size-9 place-items-center rounded-full bg-white/10 transition-colors duration-300 group-hover/ghost:bg-gold-300 group-hover/ghost:text-night-900">
                      <Play aria-hidden className="size-3.5 translate-x-px fill-current" />
                    </span>
                    {t('home.hero.demo')}
                  </Link>
                ) : null}
              </div>
              <Proof stats={stats} />
            </div>
            <div className="lg:col-span-6">
              {heroLive?.definition ? (
                <HeroStage
                  definition={heroLive.definition}
                  eventType={heroLive.eventTypes[0] ?? 'WEDDING'}
                  liveLabel={t('home.hero.live')}
                  chips={{ opened: t('home.hero.chip.opened'), rsvp: t('home.hero.chip.rsvp'), event: t('home.hero.chip.event') }}
                  back={[
                    heroBack[0] ? <TemplatePhone key="back-0" template={heroBack[0]} width={200} height={400} sections={1} /> : null,
                    heroBack[1] ? <TemplatePhone key="back-1" template={heroBack[1]} width={200} height={400} sections={1} /> : null,
                  ]}
                />
              ) : null}
            </div>
            <div aria-hidden="true" className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 text-[10px] font-semibold tracking-[0.3em] text-ivory/45 uppercase lg:flex">
              {t('home.hero.scroll')}
              <span className="relative h-10 w-px overflow-hidden bg-white/10">
                <span className="absolute inset-0 animate-scroll-cue bg-gradient-to-b from-transparent via-gold-300 to-transparent" />
              </span>
            </div>
          </section>

          {/* Traditions marquee */}
          <section aria-label={t('home.marquee.label')} className="relative border-y border-white/[0.07] bg-white/[0.02]">
            <div className="mx-auto flex max-w-7xl items-center gap-8 px-4 py-6 sm:px-6">
              <p className="hidden shrink-0 text-[11px] font-semibold tracking-[0.25em] text-gold-300 uppercase md:block">{t('home.marquee.label')}</p>
              <div className="marquee min-w-0 flex-1 overflow-hidden">
                <div className="marquee-track">
                  {[0, 1].map((copy) => (
                    <ul key={copy} aria-hidden={copy === 1 ? true : undefined} className="flex shrink-0 items-center">
                      {marquee.map((label) => (
                        <li key={label} className="flex items-center gap-8 pr-8 font-display text-2xl whitespace-nowrap text-ivory/80 sm:text-3xl">
                          {label}
                          <Sparkle aria-hidden className="size-3.5 fill-gold-300/70 text-gold-300/70" />
                        </li>
                      ))}
                    </ul>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Illustrated 3D scenes */}
          {scenes.length ? (
            <section className="relative pt-28 pb-36" aria-labelledby="scenes-title">
              <Reveal className="px-4">
                <div className="mx-auto max-w-3xl text-center">
                  <p className="eyebrow bg-white/5 text-gold-200 ring-1 ring-white/10">{t('home.scenes.eyebrow')}</p>
                  <h2 id="scenes-title" className="mt-5 font-display text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-[3.5rem]">
                    {t('home.scenes.title')}
                  </h2>
                  <p className="mt-5 text-lg leading-relaxed text-pretty text-ivory/70">{t('home.scenes.subtitle')}</p>
                </div>
              </Reveal>
              <Reveal variant="scale" className="mt-12">
                <SceneCoverflow items={scenes} labels={{ demo: t('home.scenes.demo'), details: t('home.scenes.details'), previous: t('home.scenes.previous'), next: t('home.scenes.next') }} />
              </Reveal>
              <div className="mt-10 text-center">
                <Link href="/templates?tag=signature" className={GOLD_CTA}>
                  {t('home.signature.cta')}
                  <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/cta:translate-x-1" />
                </Link>
              </div>
            </section>
          ) : (
            <div className="h-24" />
          )}
        </div>

        {/* ───── Act two (light): occasions, the collection, a spotlight ───── */}
        <div data-header-tone="light" className="relative z-10 -mt-10 rounded-t-[2.5rem] bg-ivory">
          <section className="mx-auto max-w-7xl px-4 pt-24 pb-24 sm:px-6" aria-labelledby="categories-title">
            <Reveal>
              <SectionHeading id="categories-title" eyebrow={t('home.categories.eyebrow')} title={t('home.categories.title')} />
            </Reveal>
            <SpotlightGrid className="mt-14">
              <Reveal stagger="li">
                <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
                  {CATEGORIES.map(({ key, href, icon: Icon }) => (
                    <li key={key}>
                      <Link
                        href={href}
                        className="spotlight group relative flex h-full flex-col rounded-3xl border border-gold-200/80 bg-white p-5 shadow-soft transition-[translate,box-shadow,border-color] duration-500 hover:-translate-y-1 hover:border-gold-300 hover:shadow-lift sm:p-6"
                      >
                        <ArrowUpRight aria-hidden className="absolute top-5 right-5 size-4 text-stone-400 transition-[translate,color] duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-700" />
                        <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 text-gold-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_10px_20px_-10px_rgba(91,14,27,0.8)] transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">
                          <Icon aria-hidden className="size-5" />
                        </span>
                        <span className="mt-5 font-display text-xl leading-tight text-ink sm:text-[1.35rem]">{t(`home.cat.${key}` as MessageKey)}</span>
                        <span className="mt-1.5 text-sm leading-snug text-stone-500">{t(`home.cat.${key}.desc` as MessageKey)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </SpotlightGrid>
          </section>

          <section id="templates" className="scroll-mt-24 border-t border-gold-200/60 bg-gradient-to-b from-sand/50 to-ivory py-24" aria-labelledby="grid-title">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <Reveal>
                <SectionHeading id="grid-title" eyebrow={t('home.grid.eyebrow')} title={t('home.grid.title')} subtitle={t('home.grid.subtitle')} />
              </Reveal>
              <Reveal className="mt-10" delay={0.1}>
                <TemplateExplorer
                  items={explorerItems}
                  traditions={[{ value: '', label: t('filter.all') }, ...TRADITIONS.map((v) => ({ value: v, label: t(`tag.${v}` as MessageKey) }))]}
                  tiers={[{ value: '', label: t('filter.all') }, ...(['FREE', 'STANDARD', 'PREMIUM'] as const).map((v) => ({ value: v, label: t(`filter.tier.${v}`) }))]}
                  limit={12}
                  phoneLimit={6}
                  moreHref="/templates"
                  moreLabel={t('home.grid.more', { count: websites.length })}
                  emptyLabel={t('home.grid.empty')}
                />
              </Reveal>
            </div>
          </section>

          {spotlight ? (
            <section className="mx-auto max-w-7xl px-4 pt-8 pb-28 sm:px-6" aria-labelledby="spotlight-title">
              <Reveal variant="scale">
                <div className="grid overflow-hidden rounded-[2.5rem] border border-gold-200/80 bg-white shadow-lift lg:grid-cols-2">
                  <div className="grain relative isolate flex items-center justify-center overflow-hidden bg-night-900 px-6 py-16">
                    <div aria-hidden="true" className="absolute top-1/2 left-1/2 -z-10 aspect-square w-[130%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(227,197,133,0.26),rgba(122,29,39,0.35)_50%,transparent_75%)]" />
                    <Mandala className="pointer-events-none absolute top-1/2 left-1/2 -z-10 w-[560px] -translate-x-1/2 -translate-y-1/2 animate-spin-slow text-gold-300 opacity-[0.08]" />
                    <TiltCard className="rounded-[2.2rem]" max={8}>
                      <Link href={`/templates/${spotlight.key}`} data-cursor="view" className="block rounded-[2.2rem]" aria-label={spotlight.name}>
                        <TemplatePhone template={spotlight} width={280} height={540} sections={4} />
                      </Link>
                    </TiltCard>
                  </div>
                  <div className="flex flex-col justify-center p-8 sm:p-12 lg:p-16">
                    <p className="eyebrow self-start bg-gold-100 text-gold-700 ring-1 ring-gold-200">{t('home.spotlight.eyebrow')}</p>
                    <h2 id="spotlight-title" className="mt-5 font-display text-5xl leading-[1.02] tracking-tight">
                      {spotlight.name}
                    </h2>
                    {spotlight.description ? <p className="mt-4 text-lg leading-relaxed text-stone-600">{spotlight.description}</p> : null}
                    <ul className="mt-8 space-y-4">
                      {(['home.spotlight.point1', 'home.spotlight.point2', 'home.spotlight.point3', 'home.spotlight.point4'] as const).map((k) => (
                        <li key={k} className="flex gap-3 text-stone-700">
                          <span aria-hidden className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-700 text-gold-200">
                            <Check className="size-3.5" strokeWidth={3} />
                          </span>
                          {t(k)}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-10 flex flex-wrap items-center gap-4">
                      <Link
                        href={`/templates/${spotlight.key}`}
                        className="group/cta inline-flex min-h-12 items-center gap-2 rounded-full bg-night-900 px-7 font-semibold text-ivory shadow-[0_14px_30px_-14px_rgba(19,7,11,0.8)] transition-colors duration-300 hover:bg-brand-700"
                      >
                        {t('template.view')}
                        <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/cta:translate-x-1" />
                      </Link>
                      {tierPrice(spotlight.tier, plans) ? <span className="text-sm text-stone-600">{t('template.included', { plan: t(`filter.tier.${spotlight.tier}`) })}</span> : null}
                    </div>
                  </div>
                </div>
              </Reveal>
            </section>
          ) : null}
        </div>

        {/* ───── Act three (dark): video invitations and features ───── */}
        <div data-header-tone="dark" className="grain relative isolate overflow-hidden bg-night-950 text-ivory">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-40 left-1/2 h-[700px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(122,29,39,0.45),transparent)]" />
            <div className="absolute right-[-15%] bottom-[10%] h-[620px] w-[620px] rounded-full bg-[radial-gradient(closest-side,rgba(184,137,43,0.12),transparent)]" />
          </div>
          <Parallax speed={0.3} className="absolute top-[38%] -right-56 -z-10 w-[640px] text-gold-300 opacity-[0.05]">
            <Mandala className="w-full animate-spin-slow" />
          </Parallax>

          {videos.length ? (
            <section className="mx-auto max-w-7xl px-4 pt-28 pb-24 sm:px-6" aria-labelledby="video-title">
              <Reveal>
                <SectionHeading id="video-title" light eyebrow={t('home.video.eyebrow')} title={t('home.video.title')} subtitle={t('home.video.subtitle')} />
              </Reveal>
              <div className="mt-16">
                <VideoShowcase
                  playLabel={t('home.video.play')}
                  templates={videos.slice(0, 3).map((v) => ({ key: v.key, name: v.name, eventType: v.eventTypes[0] ?? 'WEDDING', definition: v.definition! }))}
                />
              </div>
            </section>
          ) : null}

          <section id="features" className={cn('mx-auto max-w-7xl scroll-mt-24 px-4 pb-28 sm:px-6', videos.length ? 'pt-8' : 'pt-28')} aria-labelledby="features-title">
            <Reveal>
              <SectionHeading id="features-title" light eyebrow={t('home.features.eyebrow')} title={t('home.features.title')} subtitle={t('home.features.subtitle')} />
            </Reveal>
            <SpotlightGrid className="mt-14">
              <Reveal stagger="li">
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {FEATURES.map(({ key, icon: Icon, wide }) => (
                    <li
                      key={key}
                      className={cn(
                        'spotlight group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03] p-7 transition-[border-color,background-color] duration-500 hover:border-gold-300/25 hover:bg-white/[0.05]',
                        wide && 'sm:col-span-2',
                      )}
                    >
                      {wide ? (
                        <Icon aria-hidden strokeWidth={0.75} className="pointer-events-none absolute -right-8 -bottom-10 size-52 text-gold-300/[0.07] transition-transform duration-700 group-hover:scale-110 group-hover:-rotate-6" />
                      ) : null}
                      <span className="grid size-12 place-items-center rounded-2xl bg-gold-300/10 text-gold-200 ring-1 ring-gold-300/20 transition-transform duration-500 group-hover:-translate-y-0.5">
                        <Icon aria-hidden className="size-5" />
                      </span>
                      <h3 className={cn('mt-6 font-display text-2xl text-ivory', wide && 'sm:text-3xl')}>{t(`home.feature.${key}.title`)}</h3>
                      <p className={cn('mt-2 text-sm leading-relaxed text-ivory/65', wide && 'max-w-md sm:text-base')}>{t(`home.feature.${key}.body`)}</p>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </SpotlightGrid>
          </section>
        </div>

        {/* ───── Act four (light): how it works, comparison ───── */}
        <div data-header-tone="light" className="bg-ivory">
          <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-24 px-4 pt-28 pb-24 sm:px-6" aria-labelledby="how-title">
            <Reveal>
              <SectionHeading id="how-title" eyebrow={t('home.how.eyebrow')} title={t('home.how.title')} subtitle={t('home.how.subtitle')} />
            </Reveal>
            <StepsProgress className="mt-16">
              <div aria-hidden="true" className="absolute top-7 right-[12.5%] left-[12.5%] hidden h-px bg-gold-200 lg:block">
                <div data-progress className="h-full origin-left bg-gradient-to-r from-gold-500 via-brand-600 to-brand-700" />
              </div>
              <ol className="relative grid gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
                {STEPS.map(({ n, icon: Icon }) => (
                  <li key={n} data-step className="group text-center">
                    <span className="relative mx-auto grid size-14 place-items-center rounded-full border border-gold-300 bg-ivory text-gold-600 shadow-soft transition-[background-color,color,border-color,box-shadow] duration-500 group-data-[active]:border-transparent group-data-[active]:bg-brand-700 group-data-[active]:text-gold-200 group-data-[active]:shadow-[0_0_0_6px_rgba(227,197,133,0.18)]">
                      <Icon aria-hidden className="size-6" />
                    </span>
                    <span className="mt-6 block text-xs font-semibold tracking-[0.3em] text-gold-600">{String(n).padStart(2, '0')}</span>
                    <h3 className="mt-2 font-display text-2xl">{t(`home.how.${n}.title`)}</h3>
                    <p className="mx-auto mt-2 max-w-xs leading-relaxed text-stone-600">{t(`home.how.${n}.body`)}</p>
                  </li>
                ))}
              </ol>
            </StepsProgress>
          </section>

          <section className="mx-auto max-w-5xl px-4 pb-28 sm:px-6" aria-labelledby="compare-title">
            <Reveal>
              <SectionHeading id="compare-title" eyebrow={t('home.compare.eyebrow')} title={t('home.compare.title')} />
            </Reveal>
            <Reveal className="mt-12" delay={0.1}>
              <div className="overflow-x-auto rounded-[2rem] border border-gold-200/80 bg-white shadow-soft">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead>
                    <tr>
                      <th scope="col" className="p-5" />
                      <th scope="col" className="bg-gradient-to-b from-brand-700 to-brand-800 p-5 text-center font-display text-xl font-medium text-ivory">
                        {t('home.compare.bulava')}
                      </th>
                      <th scope="col" className="p-5 text-center font-medium text-stone-600">
                        {t('home.compare.print')}
                      </th>
                      <th scope="col" className="p-5 text-center font-medium text-stone-600">
                        {t('home.compare.video')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE_ROWS.map((row) => (
                      <tr key={row.key} className="border-t border-gold-100 transition-colors duration-200 hover:bg-gold-100/30">
                        <th scope="row" className="p-5 font-medium text-ink">
                          {t(row.key)}
                        </th>
                        {row.values.map((v, i) => (
                          <td key={i} className={cn('p-5 text-center', i === 0 ? 'bg-brand-50 font-semibold text-brand-700' : 'text-stone-600')}>
                            <CompareMark value={v} lead={i === 0} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </section>
        </div>

        {/* ───── Act five (dark): pricing ───── */}
        <section id="pricing" data-header-tone="dark" className="grain relative isolate scroll-mt-24 overflow-hidden bg-night-900 py-28 text-ivory" aria-labelledby="pricing-title">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-60 left-1/2 h-[640px] w-[980px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(227,197,133,0.14),transparent)]" />
          </div>
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
            <Reveal>
              <SectionHeading id="pricing-title" light eyebrow={t('home.pricing.eyebrow')} title={t('home.pricing.title')} subtitle={t('home.pricing.subtitle')} />
            </Reveal>
            <Reveal className="mt-16" delay={0.1}>
              <PricingCards plans={plans} t={t} dark />
            </Reveal>
          </div>
        </section>

        {/* ───── Act six (light): voices, questions, the invitation to start ───── */}
        <div data-header-tone="light" className="bg-ivory">
          {/* Testimonials: only real, consented quotes; hidden when there are none. */}
          {testimonials.length ? (
            <section className="mx-auto max-w-7xl px-4 pt-28 sm:px-6" aria-labelledby="testimonials-title">
              <Reveal>
                <SectionHeading id="testimonials-title" eyebrow={t('home.testimonials.eyebrow')} title={t('home.testimonials.title')} />
              </Reveal>
              <Reveal stagger="li" className="mt-14">
                <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                  {testimonials.map((q) => (
                    <li key={q.id} className="flex flex-col rounded-3xl border border-gold-200/80 bg-white p-7 shadow-soft transition-shadow duration-500 hover:shadow-lift">
                      <Quote aria-hidden className="size-8 fill-gold-100 text-gold-300" />
                      <p className="mt-4 flex gap-0.5 text-gold-500">
                        <span className="sr-only">{t('home.testimonials.rating', { rating: q.rating })}</span>
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star key={i} aria-hidden className={cn('size-4', i < q.rating ? 'fill-current' : 'text-stone-300')} />
                        ))}
                      </p>
                      <blockquote className="mt-3 flex-1 leading-relaxed text-stone-700">&ldquo;{q.quote}&rdquo;</blockquote>
                      <p className="mt-6 font-display text-lg">{q.authorName}</p>
                      <p className="text-sm text-stone-500">{[q.location, q.eventLabel].filter(Boolean).join(' · ')}</p>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </section>
          ) : null}

          <section className="mx-auto grid max-w-7xl gap-12 px-4 py-28 sm:px-6 lg:grid-cols-12" aria-labelledby="faq-title">
            <Reveal className="lg:col-span-5">
              <div className="lg:sticky lg:top-28">
                <SectionHeading id="faq-title" align="left" eyebrow={t('home.faq.eyebrow')} title={t('home.faq.title')} subtitle={t('home.faq.subtitle')} />
                <Link href="/contact" className="group/cta mt-8 inline-flex items-center gap-2 font-semibold text-brand-700">
                  <span className="link-grow">{t('home.faq.more')}</span>
                  <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/cta:translate-x-1" />
                </Link>
              </div>
            </Reveal>
            <Reveal className="lg:col-span-7" delay={0.1}>
              <div className="divide-y divide-gold-200/80 overflow-hidden rounded-[2rem] border border-gold-200/80 bg-white shadow-soft">
                {([1, 2, 3, 4, 5, 6] as const).map((n) => (
                  <details key={n} className="group px-6 py-5 transition-colors duration-300 open:bg-gold-100/25 sm:px-8 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-1 font-display text-xl">
                      {t(`home.faq.${n}.q`)}
                      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full border border-gold-200 text-gold-600 transition-[rotate,background-color,color,border-color] duration-500 group-open:rotate-45 group-open:border-transparent group-open:bg-brand-700 group-open:text-gold-200">
                        <Plus className="size-4" />
                      </span>
                    </summary>
                    <p className="mt-3 pr-12 leading-relaxed text-stone-600">{t(`home.faq.${n}.a`)}</p>
                  </details>
                ))}
              </div>
            </Reveal>
          </section>

          <section className="px-4 pb-28 sm:px-6" aria-labelledby="final-title">
            <Reveal variant="scale">
              <div className="grain relative isolate mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-night-900 px-6 py-20 text-center text-ivory sm:px-12 sm:py-24">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
                  <div className="absolute -top-32 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(122,29,39,0.7),transparent)]" />
                  <div className="absolute -bottom-40 left-1/2 h-[380px] w-[700px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(227,197,133,0.18),transparent)]" />
                </div>
                <Mandala className="pointer-events-none absolute -top-40 -right-32 -z-10 w-[480px] animate-spin-slow text-gold-300 opacity-[0.1]" />
                <Mandala className="pointer-events-none absolute -bottom-48 -left-40 -z-10 w-[420px] animate-spin-slow text-gold-300 opacity-[0.06]" />
                <h2 id="final-title" className="mx-auto max-w-3xl font-display text-4xl leading-[1.05] tracking-tight text-balance sm:text-6xl">
                  {t('home.final.title')}
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-lg text-ivory/75">{t('home.final.subtitle')}</p>
                <div className="mt-10 flex flex-wrap justify-center gap-3">
                  <MagneticButton strength={0.25}>
                    <AuthAwareLink signedOutHref="/signup" signedInHref="/dashboard" className={GOLD_CTA}>
                      {t('nav.getStarted')}
                      <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/cta:translate-x-1" />
                    </AuthAwareLink>
                  </MagneticButton>
                  <Link href="/templates" className="inline-flex min-h-13 items-center rounded-full px-7 font-medium text-ivory ring-1 ring-white/20 transition-[background-color,box-shadow] duration-300 hover:bg-white/5 hover:ring-gold-300/40">
                    {t('home.hero.browse')}
                  </Link>
                </div>
              </div>
            </Reveal>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
