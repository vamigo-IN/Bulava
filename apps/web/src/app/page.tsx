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
// Single modules, not the package entry (which would ship the engine's client components with the page).
import { SCENES } from '@bulava/template-engine/src/art/scenes';
import { Mandala } from '@bulava/template-engine/src/ornaments';
import { SpotlightGrid } from '@/components/effects/spotlight-grid';
import { TiltCard } from '@/components/effects/tilt-card';
import { AuthAwareLink } from '@/components/marketing/account-links';
import { FaqList } from '@/components/marketing/faq-list';
import { HeroStage } from '@/components/marketing/hero-stage';
import { PricingCards } from '@/components/marketing/pricing-cards';
import { SceneCoverflow, type CoverflowItem } from '@/components/marketing/scene-coverflow';
import { SectionHeading, SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { SiteStructuredData } from '@/components/marketing/structured-data';
import { TemplateCard, TemplatePhone } from '@/components/marketing/template-card';
import { TemplateExplorer, type ExplorerItem } from '@/components/marketing/template-explorer';
import { VideoShowcase } from '@/components/marketing/video-showcase';
import { MagneticButton } from '@/lib/motion/magnetic-button';
import { getGalleryTemplates, getPlans, getShowcase, getStats, getTemplate, getTemplateDefinitions, getTestimonials, tierPrice, type TemplateSummary } from '@/lib/server-api';
import { getSiteConfig } from '@/lib/site-config';
import { onePerLook } from '@/lib/template-looks';
import { fullPreview } from '@/lib/template-previews';
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

/** The main call to action: a maroon 3D button. */
const PRIMARY_CTA = 'btn-3d group/cta min-h-14 rounded-2xl px-7 text-base';
/** The second action beside it: a light 3D button with a maroon icon tile. */
const SECONDARY_CTA = 'btn-3d btn-3d-light group/ghost min-h-14 gap-3 rounded-2xl py-2 pr-6 pl-2.5 text-base';

function CompareMark({ value, lead }: { value: string; lead: boolean }) {
  if (value === 'yes')
    return (
      <>
        <span aria-hidden className={cn('mx-auto size-7 rounded-full', lead ? 'icon-3d' : 'grid place-items-center bg-emerald-50 text-emerald-700')}>
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

/**
 * A section's templates: the ones chosen in the console (Home page) first, in
 * their order, then the automatic choice fills what is left. Picks the API no
 * longer lists (unpublished since) simply drop out.
 */
function withPicks(picked: string[] | undefined, pool: TemplateSummary[], automatic: Array<TemplateSummary | undefined>, count = Number.POSITIVE_INFINITY): TemplateSummary[] {
  const byKey = new Map(pool.map((p) => [p.key, p]));
  const out = new Map<string, TemplateSummary>();
  for (const tpl of [...(picked ?? []).map((k) => byKey.get(k)), ...automatic]) {
    if (out.size >= count) break;
    if (tpl && !out.has(tpl.key)) out.set(tpl.key, tpl);
  }
  return [...out.values()];
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
    <ul className="mt-10 flex animate-fade-in-up flex-wrap items-center gap-3" style={{ animationDelay: '0.9s' }}>
      {items.map((i) => (
        <li key={i} className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-medium text-stone-700 shadow-clay-sm">
          <Sparkle aria-hidden className="size-3.5 fill-gold-500 text-gold-500" />
          {i}
        </li>
      ))}
    </ul>
  );
}

/**
 * The hero title rises word by word from behind a mask, in CSS so it plays from the first paint.
 * The last `accent` words are set in maroon.
 */
function RisingWords({ text, start = 0.15, accent = 0 }: { text: string; start?: number; accent?: number }) {
  const words = text.split(' ');
  return words.map((word, i) => (
    <Fragment key={i}>
      <span aria-hidden="true" className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-bottom">
        <span className={cn('inline-block animate-word-rise', i >= words.length - accent && 'text-brand-700')} style={{ animationDelay: `${(start + i * 0.07).toFixed(2)}s` }}>
          {word}
        </span>
      </span>
      {i < words.length - 1 ? ' ' : null}
    </Fragment>
  ));
}

export default async function HomePage() {
  const [templates, plans, stats, testimonials, siteConfig, showcase] = await Promise.all([getGalleryTemplates(), getPlans(), getStats(), getTestimonials(), getSiteConfig(), getShowcase()]);
  const websites = templates.filter((x) => x.outputs.includes('WEBSITE'));
  const videos = templates.filter((x) => x.outputs.includes('VIDEO'));
  const byKey = new Map(websites.map((w) => [w.key, w]));
  // The stage plays a flagship scene live; two more designs sit behind it. Each section
  // shows what the console's Home page chose first, then its own choice.
  const [heroLive] = withPicks(showcase.hero, websites, [byKey.get('marigold-mahal'), websites.find((w) => w.featured), websites[0]], 1);
  const heroBack = withPicks(
    showcase.heroBack,
    websites.filter((w) => w.key !== heroLive?.key),
    ['rajwada-royale', 'kanjeevaram-gold'].filter((k) => k !== heroLive?.key).map((k) => byKey.get(k)),
    2,
  );
  const heroImage = heroLive ? fullPreview(heroLive.key) : null;
  const films = withPicks(showcase.videos, videos, videos, 3);
  // Definitions only where the live renderer draws: the hero phone without its image, and the films.
  const [heroDefinition, videoDefinitions] = await Promise.all([
    heroLive && !heroImage ? (heroLive.definition ?? getTemplate(heroLive.key).then((t) => t?.definition ?? null)) : null,
    getTemplateDefinitions(films.map((v) => v.key)),
  ]);
  // Illustrated 3D scene templates, found from their data (the hero section's variant), flagships first.
  const sceneNames = new Set<string>(SCENES);
  const sceneTemplates = websites
    .filter((w) => sceneNames.has(w.preview?.heroVariant ?? w.definition?.website?.pages[0]?.sections[0]?.variant ?? ''))
    .sort((a, b) => Number(b.featured) - Number(a.featured));
  const scenes: CoverflowItem[] = withPicks(showcase.scenes, websites, sceneTemplates, 12).map((w) => ({
    key: w.key,
    name: w.name,
    blurb: w.description ?? '',
    node: <TemplatePhone template={w} width={250} height={470} sections={1} />,
  }));
  const [spotlight] = withPicks(showcase.spotlight, websites, [websites.find((w) => w.featured && w.tier === 'PREMIUM'), websites[0]], 1);
  // Each design once: a design made for several occasions shows its picked or main version.
  const designs = onePerLook(withPicks(showcase.collection, websites, websites), (w) => w.preview?.look);
  const explorerItems: ExplorerItem[] = designs.map((tpl) => ({
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
      <SiteStructuredData config={siteConfig} origin={process.env.WEB_ORIGIN || 'http://localhost:3000'} />
      <SiteHeader />
      <main>
        {/* ───── Act one: hero, traditions, illustrated scenes ───── */}
        <div data-header-tone="light" className="relative isolate overflow-hidden">
          {/* Ambient light: soft pools of gold and rose on the cream, never a panel with edges. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-[22%] right-[-14%] h-[860px] w-[860px] animate-drift rounded-full bg-[radial-gradient(closest-side,rgba(233,200,127,0.42),rgba(240,212,196,0.3)_55%,transparent)]" />
            <div className="absolute top-[32%] -left-[20%] h-[640px] w-[640px] rounded-full bg-[radial-gradient(closest-side,rgba(168,58,71,0.09),transparent)]" />
          </div>
          <Parallax speed={0.35} className="absolute -top-44 -left-52 -z-10 w-[620px] text-gold-500 opacity-[0.08]">
            <Mandala className="w-full animate-spin-slow" />
          </Parallax>

          {/* Hero */}
          <section aria-labelledby="hero-title" className="relative mx-auto grid max-w-7xl items-center gap-x-10 gap-y-16 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-12 lg:pt-20 lg:pb-24">
            <div className="lg:col-span-6">
              <p className="eyebrow animate-fade-in-up text-brand-700">{t('home.hero.eyebrow')}</p>
              {/* Labelled once, so screen readers read the sentence rather than one masked word at a time. */}
              <h1 id="hero-title" aria-label={t('home.hero.title')} className="mt-6 font-display text-[2.9rem] leading-[1.04] tracking-[-0.02em] text-balance text-ink sm:text-6xl xl:text-[4.5rem]">
                <RisingWords text={t('home.hero.title')} accent={3} />
              </h1>
              <p className="mt-7 max-w-xl animate-settle-up text-lg leading-relaxed text-pretty text-stone-600" style={{ animationDelay: '0.2s' }}>
                {t('home.hero.subtitle')}
              </p>
              <p className="mt-3 max-w-xl animate-fade-in-up text-base text-stone-500" style={{ animationDelay: '0.65s' }}>
                {t('home.hero.support')}
              </p>
              <div className="mt-9 flex animate-fade-in-up flex-wrap items-center gap-4" style={{ animationDelay: '0.75s' }}>
                <MagneticButton strength={0.25}>
                  <Link href="/templates" className={PRIMARY_CTA}>
                    {t('home.hero.browse')}
                    <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/cta:translate-x-1" />
                  </Link>
                </MagneticButton>
                {heroLive ? (
                  <Link href={`/templates/${heroLive.key}/demo`} className={SECONDARY_CTA}>
                    <span className="icon-3d size-9 rounded-xl">
                      <Play aria-hidden className="size-3.5 translate-x-px fill-current" />
                    </span>
                    {t('home.hero.demo')}
                  </Link>
                ) : null}
              </div>
              <Proof stats={stats} />
            </div>
            <div className="lg:col-span-6">
              {heroLive && (heroImage || heroDefinition) ? (
                <HeroStage
                  name={heroLive.name}
                  image={heroImage}
                  // The definition is sent to the browser only when the live renderer has to draw it.
                  definition={heroImage ? null : heroDefinition}
                  eventType={heroLive.eventTypes[0] ?? 'WEDDING'}
                  liveLabel={t('home.hero.live')}
                  chips={{ opened: t('home.hero.chip.opened'), rsvp: t('home.hero.chip.rsvp'), event: t('home.hero.chip.event') }}
                  back={[
                    heroBack[0] ? <TemplatePhone key="back-0" template={heroBack[0]} width={200} height={400} sections={1} priority /> : null,
                    heroBack[1] ? <TemplatePhone key="back-1" template={heroBack[1]} width={200} height={400} sections={1} priority /> : null,
                  ]}
                />
              ) : null}
            </div>
            <div aria-hidden="true" className="pointer-events-none absolute bottom-2 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 text-[10px] font-semibold tracking-[0.3em] text-stone-500 uppercase lg:flex">
              {t('home.hero.scroll')}
              <span className="relative h-10 w-px overflow-hidden bg-stone-300/70">
                <span className="absolute inset-0 animate-scroll-cue bg-gradient-to-b from-transparent via-brand-600 to-transparent" />
              </span>
            </div>
          </section>

          {/* Traditions marquee */}
          <section aria-label={t('home.marquee.label')} className="relative border-y border-gold-200/60 bg-surface/60">
            <div className="mx-auto flex max-w-7xl items-center gap-8 px-4 py-6 sm:px-6">
              <p className="eyebrow hidden shrink-0 text-brand-700 md:inline-flex">{t('home.marquee.label')}</p>
              <div className="marquee min-w-0 flex-1 overflow-hidden">
                <div className="marquee-track">
                  {[0, 1].map((copy) => (
                    <ul key={copy} aria-hidden={copy === 1 ? true : undefined} className="flex shrink-0 items-center">
                      {marquee.map((label) => (
                        <li key={label} className="flex items-center gap-8 pr-8 font-display text-2xl whitespace-nowrap text-ink/75 sm:text-3xl">
                          {label}
                          <Sparkle aria-hidden className="size-3.5 fill-gold-500/80 text-gold-500/80" />
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
            <section className="relative pt-28 pb-32" aria-labelledby="scenes-title">
              <Reveal className="px-4">
                <SectionHeading id="scenes-title" eyebrow={t('home.scenes.eyebrow')} title={t('home.scenes.title')} subtitle={t('home.scenes.subtitle')} />
              </Reveal>
              <Reveal variant="scale" className="mt-12">
                <SceneCoverflow items={scenes} labels={{ demo: t('home.scenes.demo'), details: t('home.scenes.details'), previous: t('home.scenes.previous'), next: t('home.scenes.next') }} />
              </Reveal>
              <div className="mt-10 text-center">
                <Link href="/templates?tag=signature" className={PRIMARY_CTA}>
                  {t('home.signature.cta')}
                  <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/cta:translate-x-1" />
                </Link>
              </div>
            </section>
          ) : (
            <div className="h-24" />
          )}
        </div>

        {/* ───── Act two: occasions, the collection, a spotlight ───── */}
        <div data-header-tone="light" className="relative">
          <section className="mx-auto max-w-7xl px-4 pt-8 pb-24 sm:px-6" aria-labelledby="categories-title">
            <Reveal>
              <SectionHeading id="categories-title" eyebrow={t('home.categories.eyebrow')} title={t('home.categories.title')} />
            </Reveal>
            <SpotlightGrid className="mt-14">
              <Reveal stagger="li">
                <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
                  {CATEGORIES.map(({ key, href, icon: Icon }) => (
                    <li key={key}>
                      <Link href={href} className="clay clay-lift spotlight group relative flex h-full flex-col rounded-3xl p-5 sm:p-6">
                        <ArrowUpRight aria-hidden className="absolute top-5 right-5 size-4 text-stone-400 transition-[translate,color] duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-700" />
                        <span className="icon-3d size-12 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">
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

          <section id="templates" className="scroll-mt-24 border-y border-gold-200/50 bg-[linear-gradient(180deg,rgba(239,226,210,0.55),rgba(246,238,229,0))] py-24" aria-labelledby="grid-title">
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
                  moreLabel={t('home.grid.more', { count: designs.length })}
                  emptyLabel={t('home.grid.empty')}
                />
              </Reveal>
            </div>
          </section>

          {spotlight ? (
            <section className="mx-auto max-w-7xl px-4 pt-24 pb-28 sm:px-6" aria-labelledby="spotlight-title">
              <Reveal variant="scale">
                <div className="clay grid overflow-hidden rounded-[2.5rem] lg:grid-cols-2">
                  <div className="relative isolate m-3 flex items-center justify-center overflow-hidden rounded-[2rem] bg-[radial-gradient(ellipse_at_50%_35%,#fdf0d6,#f4e2c8_50%,#ead3b6)] px-6 py-16 shadow-clay-inset">
                    <div aria-hidden="true" className="absolute top-1/2 left-1/2 -z-10 aspect-square w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.75),transparent_70%)]" />
                    <Mandala className="pointer-events-none absolute top-1/2 left-1/2 -z-10 w-[560px] -translate-x-1/2 -translate-y-1/2 animate-spin-slow text-gold-500 opacity-[0.14]" />
                    <TiltCard className="rounded-[2.2rem]" max={8}>
                      <Link href={`/templates/${spotlight.key}`} data-cursor="view" className="block rounded-[2.2rem]" aria-label={spotlight.name}>
                        <TemplatePhone template={spotlight} width={280} height={540} sections={4} />
                      </Link>
                    </TiltCard>
                  </div>
                  <div className="flex flex-col justify-center p-8 sm:p-12 lg:p-14">
                    <p className="eyebrow self-start text-brand-700">{t('home.spotlight.eyebrow')}</p>
                    <h2 id="spotlight-title" className="mt-4 font-display text-5xl leading-[1.04] tracking-[-0.015em]">
                      {spotlight.name}
                    </h2>
                    {spotlight.description ? <p className="mt-4 text-lg leading-relaxed text-stone-600">{spotlight.description}</p> : null}
                    <ul className="mt-8 space-y-4">
                      {(['home.spotlight.point1', 'home.spotlight.point2', 'home.spotlight.point3', 'home.spotlight.point4'] as const).map((k) => (
                        <li key={k} className="flex gap-3 text-stone-700">
                          <span aria-hidden className="icon-3d mt-0.5 size-6 shrink-0 rounded-full">
                            <Check className="size-3.5" strokeWidth={3} />
                          </span>
                          {t(k)}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-10 flex flex-wrap items-center gap-4">
                      <Link href={`/templates/${spotlight.key}`} className="btn-3d group/cta min-h-13 rounded-2xl px-7">
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

        {/* ───── Act three: video invitations and features ───── */}
        <div data-header-tone="light" className="relative isolate overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-40 left-1/2 h-[700px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(233,200,127,0.3),transparent)]" />
            <div className="absolute right-[-15%] bottom-[10%] h-[620px] w-[620px] rounded-full bg-[radial-gradient(closest-side,rgba(168,58,71,0.07),transparent)]" />
          </div>
          <Parallax speed={0.3} className="absolute top-[38%] -right-56 -z-10 w-[640px] text-gold-500 opacity-[0.07]">
            <Mandala className="w-full animate-spin-slow" />
          </Parallax>

          {videoDefinitions.size ? (
            <section className="mx-auto max-w-7xl px-4 pt-28 pb-24 sm:px-6" aria-labelledby="video-title">
              <Reveal>
                <SectionHeading id="video-title" eyebrow={t('home.video.eyebrow')} title={t('home.video.title')} subtitle={t('home.video.subtitle')} />
              </Reveal>
              <div className="mt-16">
                <VideoShowcase
                  playLabel={t('home.video.play')}
                  templates={films
                    .filter((v) => videoDefinitions.has(v.key))
                    .map((v) => ({ key: v.key, name: v.name, eventType: v.eventTypes[0] ?? 'WEDDING', definition: videoDefinitions.get(v.key)! }))}
                />
              </div>
            </section>
          ) : null}

          <section id="features" className={cn('mx-auto max-w-7xl scroll-mt-24 px-4 pb-28 sm:px-6', videoDefinitions.size ? 'pt-8' : 'pt-28')} aria-labelledby="features-title">
            <Reveal>
              <SectionHeading id="features-title" eyebrow={t('home.features.eyebrow')} title={t('home.features.title')} subtitle={t('home.features.subtitle')} />
            </Reveal>
            <SpotlightGrid className="mt-14">
              <Reveal stagger="li">
                <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {FEATURES.map(({ key, icon: Icon, wide }) => (
                    <li key={key} className={cn('clay clay-lift spotlight group relative overflow-hidden rounded-3xl p-7', wide && 'sm:col-span-2')}>
                      {wide ? (
                        <Icon aria-hidden strokeWidth={0.75} className="pointer-events-none absolute -right-8 -bottom-10 size-52 text-brand-700/[0.06] transition-transform duration-700 group-hover:scale-110 group-hover:-rotate-6" />
                      ) : null}
                      <span className="icon-3d size-12 transition-transform duration-500 group-hover:-rotate-6">
                        <Icon aria-hidden className="size-5" />
                      </span>
                      <h3 className={cn('mt-6 font-display text-2xl text-ink', wide && 'sm:text-3xl')}>{t(`home.feature.${key}.title`)}</h3>
                      <p className={cn('mt-2 text-sm leading-relaxed text-stone-600', wide && 'max-w-md sm:text-base')}>{t(`home.feature.${key}.body`)}</p>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </SpotlightGrid>
          </section>
        </div>

        {/* ───── Act four: how it works, comparison ───── */}
        <div data-header-tone="light">
          <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-24 px-4 pt-28 pb-24 sm:px-6" aria-labelledby="how-title">
            <Reveal>
              <SectionHeading id="how-title" eyebrow={t('home.how.eyebrow')} title={t('home.how.title')} subtitle={t('home.how.subtitle')} />
            </Reveal>
            <StepsProgress className="mt-16">
              <ol className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {STEPS.map(({ n, icon: Icon }) => (
                  <li key={n} data-step className="clay clay-lift group flex flex-col rounded-3xl p-7">
                    <div className="flex items-start justify-between gap-4">
                      <span className="font-display text-5xl leading-none text-gold-500 transition-colors duration-500 group-data-[active]:text-brand-700">{String(n).padStart(2, '0')}</span>
                      <span className="icon-3d size-12 transition-transform duration-500 group-data-[active]:-rotate-6">
                        <Icon aria-hidden className="size-5" />
                      </span>
                    </div>
                    <h3 className="mt-6 font-display text-2xl">{t(`home.how.${n}.title`)}</h3>
                    <p className="mt-2 leading-relaxed text-stone-600">{t(`home.how.${n}.body`)}</p>
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
              {/* `relative`: the cells' sr-only labels are absolutely positioned; without a positioned
                  scroll box they escape it and widen the whole page on phones. Focusable and named,
                  so keyboard users can scroll it sideways. */}
              <div role="group" aria-labelledby="compare-title" tabIndex={0} className="clay relative overflow-x-auto rounded-[2rem]">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead>
                    <tr>
                      <td className="p-5" />
                      <th scope="col" className="bg-gradient-to-b from-[#a83a47] via-brand-600 to-brand-700 p-5 text-center font-display text-xl font-normal text-ivory">
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
                          <td key={i} className={cn('p-5 text-center', i === 0 ? 'bg-brand-50/70 font-semibold text-brand-700' : 'text-stone-600')}>
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

        {/* ───── Act five (the one dark band): pricing ───── */}
        <section id="pricing" data-header-tone="dark" className="relative isolate scroll-mt-24 overflow-hidden bg-night-900 py-28 text-ivory" aria-labelledby="pricing-title">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-60 left-1/2 h-[640px] w-[980px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(227,197,133,0.16),transparent)]" />
            <div className="absolute -bottom-72 left-[10%] h-[560px] w-[760px] rounded-full bg-[radial-gradient(closest-side,rgba(122,29,39,0.4),transparent)]" />
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

        {/* ───── Act six: voices, questions, the invitation to start ───── */}
        <div data-header-tone="light">
          {/* Testimonials: only real, consented quotes; hidden when there are none. */}
          {testimonials.length ? (
            <section className="mx-auto max-w-7xl px-4 pt-28 sm:px-6" aria-labelledby="testimonials-title">
              <Reveal>
                <SectionHeading id="testimonials-title" eyebrow={t('home.testimonials.eyebrow')} title={t('home.testimonials.title')} />
              </Reveal>
              <Reveal stagger="li" className="mt-14">
                <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                  {testimonials.map((q) => (
                    <li key={q.id} className="clay clay-lift flex flex-col rounded-3xl p-7">
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
                <Link href="/contact" className="btn-3d btn-3d-light group/cta mt-8 min-h-12 rounded-2xl px-6 text-brand-700">
                  {t('home.faq.more')}
                  <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/cta:translate-x-1" />
                </Link>
              </div>
            </Reveal>
            <Reveal className="lg:col-span-7" delay={0.1}>
              <FaqList questions={[1, 2, 3, 4, 5, 6]} t={t} />
            </Reveal>
          </section>

          <section className="px-4 pb-28 sm:px-6" aria-labelledby="final-title">
            <Reveal variant="scale">
              {/* The closing invitation: a maroon clay slab, lit from the top left like the buttons. */}
              <div className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-[linear-gradient(160deg,#a33441,#7a1d27_48%,#4a0b16)] px-6 py-20 text-center text-ivory shadow-[inset_0_3px_2px_rgba(255,255,255,0.22),inset_5px_0_4px_rgba(255,255,255,0.08),inset_0_-8px_14px_rgba(30,2,8,0.45),inset_-6px_0_10px_rgba(30,2,8,0.3),8px_30px_60px_-22px_rgba(74,11,22,0.6)] sm:px-12 sm:py-24">
                <Mandala className="pointer-events-none absolute -top-40 -right-32 -z-10 w-[480px] animate-spin-slow text-gold-200 opacity-[0.12]" />
                <Mandala className="pointer-events-none absolute -bottom-48 -left-40 -z-10 w-[420px] animate-spin-slow text-gold-200 opacity-[0.08]" />
                <h2 id="final-title" className="mx-auto max-w-3xl font-display text-4xl leading-[1.08] tracking-[-0.015em] text-balance sm:text-6xl">
                  {t('home.final.title')}
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-lg text-ivory/85">{t('home.final.subtitle')}</p>
                <div className="mt-10 flex flex-wrap justify-center gap-4">
                  <MagneticButton strength={0.25}>
                    <AuthAwareLink signedOutHref="/login" signedInHref="/dashboard" className="btn-3d btn-3d-gold group/cta min-h-14 rounded-2xl px-8 text-base">
                      {t('nav.getStarted')}
                      <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/cta:translate-x-1" />
                    </AuthAwareLink>
                  </MagneticButton>
                  <Link href="/templates" className="btn-3d btn-3d-light min-h-14 rounded-2xl px-8 text-base">
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
