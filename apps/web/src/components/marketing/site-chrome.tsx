import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { createTranslator } from '@bulava/localization';
// The single module: the package entry would ship the template engine's client components with every page.
import { Mandala } from '@bulava/template-engine/src/ornaments';
import type { PublicSiteConfig } from '@bulava/validation';
import { getSiteConfig, whatsappChatUrl } from '@/lib/site-config';
import { cn } from '@/lib/utils';
import { AccountLinks } from './account-links';
import { HeaderFrame } from './header-frame';
import { Logo } from './logo';
import { MarketingEffects } from './marketing-effects';

export { Logo };

const t = createTranslator('en');

const NAV = [
  { href: '/templates', label: t('nav.templates') },
  { href: '/#how-it-works', label: t('nav.howItWorks') },
  { href: '/#features', label: t('nav.features') },
  { href: '/pricing', label: t('nav.pricing') },
];

/** The site-wide notice set in the admin console (Site settings > Branding). */
function AnnouncementBar({ announcement }: { announcement: PublicSiteConfig['site']['announcement'] }) {
  if (!announcement.enabled || !announcement.text) return null;
  const external = announcement.link?.startsWith('https://');
  const linkClass = 'font-semibold text-gold-200 underline underline-offset-4 transition-colors hover:text-gold-100';
  // A named landmark, so assistive technology (and AI agents) find it outside the header and main.
  return (
    <aside aria-label={t('nav.announcement')} className="relative z-50 bg-night-950 px-4 py-2 text-center text-sm text-ivory/90">
      <span>{announcement.text}</span>
      {announcement.link ? (
        <>
          {' '}
          {external ? (
            <a href={announcement.link} className={linkClass} rel="noopener">
              {announcement.linkText || announcement.link}
            </a>
          ) : (
            <Link href={announcement.link} className={linkClass}>
              {announcement.linkText || announcement.link}
            </Link>
          )}
        </>
      ) : null}
    </aside>
  );
}

/**
 * Marketing header. Pages that open on a dark hero pass `tone="dark"`; the
 * header then keeps matching whatever section is under it while scrolling.
 */
export async function SiteHeader({ tone = 'light' }: { tone?: 'dark' | 'light' }) {
  const { site } = await getSiteConfig();
  return (
    <>
      <AnnouncementBar announcement={site.announcement} />
      <HeaderFrame initialTone={tone}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-[72px]">
          <Logo adaptive name={site.name} imageUrl={site.logoUrl} />
          <nav aria-label="Main" className="hidden items-center gap-0.5 rounded-full border border-[var(--hdr-border)] bg-[var(--hdr-pill)] p-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-[var(--hdr-muted)] transition-colors duration-300 hover:bg-[var(--hdr-hover)] hover:text-[var(--hdr-text)]"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="hidden md:block">
            <AccountLinks variant="desktop" />
          </div>
          <details className="group relative md:hidden">
            <summary className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full border border-[var(--hdr-border)] bg-[var(--hdr-pill)] transition-colors hover:bg-[var(--hdr-hover)] [&::-webkit-details-marker]:hidden">
              <Menu aria-hidden className="size-5 group-open:hidden" />
              <X aria-hidden className="hidden size-5 group-open:block" />
              <span className="sr-only">{t('nav.menu')}</span>
            </summary>
            <div className="absolute right-0 mt-3 w-72 origin-top-right animate-scale-in rounded-3xl border border-gold-200/70 bg-ivory/95 p-3 text-ink shadow-2xl backdrop-blur-xl">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="block rounded-2xl px-4 py-3 text-base font-medium transition-colors duration-200 hover:bg-gold-100/70">
                  {n.label}
                </Link>
              ))}
              <div className="my-2 gold-rule" />
              <AccountLinks variant="mobile" />
            </div>
          </details>
        </div>
      </HeaderFrame>
      <MarketingEffects viewLabel={t('cursor.view')} />
    </>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold tracking-[0.25em] text-gold-300 uppercase">{title}</h3>
      <ul className="mt-5 space-y-3 text-sm text-ivory/70">{children}</ul>
    </div>
  );
}

const FooterLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <li>
    <Link href={href} className="link-grow transition-colors duration-300 hover:text-ivory">
      {children}
    </Link>
  </li>
);

const SOCIAL = ['instagram', 'facebook', 'youtube', 'x', 'linkedin', 'pinterest'] as const;

export async function SiteFooter() {
  const { site } = await getSiteConfig();
  const social = SOCIAL.filter((key) => site.social[key]);
  return (
    <footer data-header-tone="dark" className="grain relative isolate overflow-hidden bg-night-950 text-ivory">
      <Mandala className="pointer-events-none absolute -right-40 -bottom-56 w-[640px] text-gold-300 opacity-[0.05]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-300/40 to-transparent" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pt-20 pb-14 sm:px-6 md:grid-cols-12">
        <div className="md:col-span-5">
          <Logo light name={site.name} imageUrl={site.logoUrl} />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-ivory/70">{t('footer.tagline')}</p>
          {site.supportEmail || site.supportPhone ? (
            <div className="mt-6 space-y-1.5 text-sm text-ivory/75">
              <p className="text-[11px] font-semibold tracking-[0.25em] text-gold-300 uppercase">{t('footer.support')}</p>
              {site.supportEmail ? (
                <p>
                  <a href={`mailto:${site.supportEmail}`} className="link-grow transition-colors duration-300 hover:text-ivory">
                    {site.supportEmail}
                  </a>
                </p>
              ) : null}
              {site.supportPhone ? (
                <p>
                  <a href={`tel:${site.supportPhone}`} className="link-grow transition-colors duration-300 hover:text-ivory">
                    {site.supportPhone}
                  </a>
                </p>
              ) : null}
            </div>
          ) : null}
          {social.length ? (
            <nav aria-label={t('footer.follow')} className="mt-6 flex flex-wrap gap-2 text-sm">
              {social.map((key) => (
                <a
                  key={key}
                  href={site.social[key]}
                  className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-ivory/80 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-300/40 hover:text-ivory"
                  rel="noopener me"
                  target="_blank"
                >
                  {t(`social.${key}`)}
                </a>
              ))}
            </nav>
          ) : null}
        </div>
        <div className="grid gap-10 sm:grid-cols-3 md:col-span-7">
          <FooterColumn title={t('footer.templates')}>
            <FooterLink href="/templates?tag=hindu">{t('tag.hindu')}</FooterLink>
            <FooterLink href="/templates?tag=sikh">{t('tag.sikh')}</FooterLink>
            <FooterLink href="/templates?tag=muslim">{t('tag.muslim')}</FooterLink>
            <FooterLink href="/templates?tag=south-indian">{t('tag.south-indian')}</FooterLink>
            <FooterLink href="/templates?tag=christian">{t('tag.christian')}</FooterLink>
            <FooterLink href="/templates?event=BIRTHDAY">{t('home.cat.birthday')}</FooterLink>
          </FooterColumn>
          <FooterColumn title={t('footer.product')}>
            <FooterLink href="/templates">{t('nav.templates')}</FooterLink>
            <FooterLink href="/#how-it-works">{t('nav.howItWorks')}</FooterLink>
            <FooterLink href="/#features">{t('nav.features')}</FooterLink>
            <FooterLink href="/pricing">{t('nav.pricing')}</FooterLink>
          </FooterColumn>
          <FooterColumn title={t('footer.company')}>
            <FooterLink href="/about">{t('footer.about')}</FooterLink>
            <FooterLink href="/contact">{t('footer.contact')}</FooterLink>
            <FooterLink href="/privacy">{t('footer.privacy')}</FooterLink>
            <FooterLink href="/terms">{t('footer.terms')}</FooterLink>
            <FooterLink href="/refund">{t('footer.refund')}</FooterLink>
          </FooterColumn>
        </div>
      </div>
      <div className="relative border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-ivory/55 sm:px-6">
          <p>{t('footer.rights', { year: new Date().getFullYear(), name: site.name })}</p>
          <p className="tracking-[0.2em] text-gold-300/80 uppercase">{t('footer.madeIn')}</p>
        </div>
      </div>
      {site.whatsappNumber ? <WhatsAppChatButton number={site.whatsappNumber} message={site.whatsappMessage} /> : null}
    </footer>
  );
}

/** Floating click-to-chat link to the business WhatsApp number (public pages only; no script). */
function WhatsAppChatButton({ number, message }: { number: string; message: string }) {
  return (
    <a
      href={whatsappChatUrl(number, message)}
      target="_blank"
      rel="noopener"
      aria-label={t('footer.whatsappChat')}
      title={t('footer.whatsappChat')}
      className="fixed right-4 bottom-4 z-50 flex size-14 items-center justify-center rounded-full bg-[#0f7a6e] text-white shadow-xl ring-4 ring-white/70 transition-all duration-300 hover:scale-110 hover:shadow-[0_0_30px_rgba(15,122,110,0.5)] focus-visible:scale-110 sm:right-6 sm:bottom-6"
    >
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true" fill="currentColor">
        <path d="M16 3C9 3 3.3 8.6 3.3 15.6c0 2.2.6 4.4 1.7 6.3L3.2 28.8l7.1-1.8c1.8 1 3.8 1.5 5.8 1.5 7 0 12.7-5.7 12.7-12.7S23 3 16 3Zm0 23.2c-1.8 0-3.6-.5-5.2-1.4l-.4-.2-4.2 1.1 1.1-4.1-.2-.4a10.5 10.5 0 0 1-1.6-5.6C5.5 9.8 10.2 5.1 16 5.1s10.5 4.7 10.5 10.5S21.8 26.2 16 26.2Zm5.8-7.9c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.6-1.6-.9-.8-1.6-1.9-1.8-2.2-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.3.3-.6.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.5c.2.2 2.4 3.6 5.7 5 .8.4 1.4.6 1.9.7.8.3 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.7-.4Z" />
      </svg>
    </a>
  );
}

/**
 * Section heading used across marketing pages: an eyebrow chip, a serif title and an optional lead.
 * `level={1}` for a page's own title (every page needs exactly one h1).
 */
export function SectionHeading({
  id,
  eyebrow,
  title,
  subtitle,
  light = false,
  align = 'center',
  level = 2,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  light?: boolean;
  align?: 'center' | 'left';
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl'}>
      {eyebrow ? <p className={cn('eyebrow', light ? 'bg-white/5 text-gold-200 ring-1 ring-white/10' : 'bg-gold-100 text-gold-700 ring-1 ring-gold-200')}>{eyebrow}</p> : null}
      <Heading id={id} className={cn('mt-5 font-display text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-[3.5rem]', light ? 'text-ivory' : 'text-ink')}>
        {title}
      </Heading>
      {subtitle ? <p className={cn('mt-5 text-lg leading-relaxed text-pretty', light ? 'text-ivory/70' : 'text-stone-600')}>{subtitle}</p> : null}
    </div>
  );
}
