import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { createTranslator } from '@bulava/localization';
// The single module: the package entry would ship the template engine's client components with every page.
import { Mandala } from '@bulava/template-engine/src/ornaments';
import type { PublicSiteConfig } from '@bulava/validation';
import { getSitePages } from '@/lib/server-api';
import { getSiteConfig, whatsappChatUrl } from '@/lib/site-config';
import { cn } from '@/lib/utils';
import { WhatsAppMark } from '@/components/ui/whatsapp-mark';
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
    <aside aria-label={t('nav.announcement')} className="relative z-50 bg-gradient-to-r from-brand-800 via-brand-700 to-brand-800 px-4 py-2 text-center text-sm text-ivory/95">
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
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-xl px-3.5 py-2 text-[0.9375rem] font-medium text-[var(--hdr-muted)] transition-colors duration-300 hover:bg-[var(--hdr-hover)] hover:text-[var(--hdr-text)]"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="hidden md:block">
            <AccountLinks variant="desktop" />
          </div>
          <details className="group relative md:hidden">
            <summary className="btn-3d btn-3d-light size-11 cursor-pointer list-none rounded-full [&::-webkit-details-marker]:hidden">
              <Menu aria-hidden className="size-5 group-open:hidden" />
              <X aria-hidden className="hidden size-5 group-open:block" />
              <span className="sr-only">{t('nav.menu')}</span>
            </summary>
            <div className="clay absolute right-0 mt-4 w-72 origin-top-right animate-scale-in rounded-3xl p-3 text-ink">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="block rounded-2xl px-4 py-3 text-base font-medium transition-colors duration-200 hover:bg-gold-100/60">
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
      <h3 className="font-display text-xl text-ivory">{title}</h3>
      <ul className="mt-5 space-y-3 text-[0.9375rem] text-ivory/70">{children}</ul>
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
  const [{ site }, pages] = await Promise.all([getSiteConfig(), getSitePages()]);
  const social = SOCIAL.filter((key) => site.social[key]);
  // Site pages choose their column in the admin console (Pages).
  const company = pages.filter((p) => p.footerGroup === 'COMPANY');
  const legal = pages.filter((p) => p.footerGroup === 'LEGAL');
  // Footer text comes from the admin console (Branding & contact > Footer); an empty field hides its line.
  const { eyebrow, about, copyright, note } = site.footer;
  const copyrightLine = copyright.replaceAll('{year}', String(new Date().getFullYear())).replaceAll('{name}', site.name);
  return (
    <footer data-header-tone="dark" className="relative isolate overflow-hidden bg-night-900 text-ivory">
      <Mandala className="pointer-events-none absolute -right-40 -bottom-56 w-[640px] text-gold-300 opacity-[0.05]" />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pt-20 pb-14 sm:px-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Logo light name={site.name} imageUrl={site.logoUrl} />
          {eyebrow ? <p className="eyebrow mt-5 text-gold-300/90">{eyebrow}</p> : null}
          {about ? <p className="mt-5 max-w-sm text-[0.9375rem] leading-relaxed text-ivory/70">{about}</p> : null}
          {site.supportEmail || site.supportPhone ? (
            <div className="mt-6 space-y-1.5 text-sm text-ivory/75">
              <p className="font-display text-lg text-ivory">{t('footer.support')}</p>
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
            <nav aria-label={t('footer.follow')} className="mt-7 flex flex-wrap gap-2.5 text-sm">
              {social.map((key) => (
                <a
                  key={key}
                  href={site.social[key]}
                  className="btn-3d btn-3d-light min-h-10 rounded-xl px-4 text-sm"
                  rel="noopener me"
                  target="_blank"
                >
                  {t(`social.${key}`)}
                </a>
              ))}
            </nav>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:col-span-8">
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
            {company.map((p) => (
              <FooterLink key={p.slug} href={`/${p.slug}`}>
                {p.title}
              </FooterLink>
            ))}
          </FooterColumn>
          <FooterColumn title={t('footer.legal')}>
            {legal.map((p) => (
              <FooterLink key={p.slug} href={`/${p.slug}`}>
                {p.title}
              </FooterLink>
            ))}
          </FooterColumn>
        </div>
      </div>
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        {copyrightLine || note ? (
          <div className="flex flex-col gap-1.5 border-t border-white/10 py-6 text-xs text-ivory/60 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            {copyrightLine ? <p>{copyrightLine}</p> : null}
            {note ? <p className="sm:text-right">{note}</p> : null}
          </div>
        ) : null}
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
      className="btn-3d btn-3d-green fixed right-4 bottom-4 z-50 size-14 rounded-full sm:right-6 sm:bottom-6"
    >
      <WhatsAppMark className="size-7" />
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
      {eyebrow ? <p className={cn('eyebrow', light ? 'text-gold-200' : 'text-brand-700')}>{eyebrow}</p> : null}
      <Heading id={id} className={cn('mt-4 font-display text-[2.4rem] leading-[1.08] tracking-[-0.015em] text-balance sm:text-5xl lg:text-[3.4rem]', light ? 'text-ivory' : 'text-ink')}>
        {title}
      </Heading>
      {subtitle ? <p className={cn('mt-5 text-lg leading-relaxed text-pretty', light ? 'text-ivory/70' : 'text-stone-600')}>{subtitle}</p> : null}
    </div>
  );
}
