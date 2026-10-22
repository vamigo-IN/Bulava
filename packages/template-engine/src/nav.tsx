'use client';

import { useEffect, useId, useState } from 'react';

/** A link of the page menu: the section (or the column of one) it leads to. */
export interface PageNavLink {
  href: string;
  label: string;
}

export interface PageNavProps {
  links: PageNavLink[];
  /** The couple's initials (one or two letters each), set in the script face. */
  monogram: [string, string] | string;
  /** "Save the date": the event in Google Calendar, opened in a new tab (none without a date). */
  save?: { href: string; label: string } | null;
  labels: { nav: string; open: string; close: string };
  /** Id of the first section (the hero): the bar sticks once its upper 40% has left the screen. */
  heroId?: string;
  /** Live pages stick and follow the reader; thumbnails and the editors draw it still. */
  interactive: boolean;
}

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

/** The two initials: the first large, the second smaller below and to its right. */
function Monogram({ monogram, size }: { monogram: PageNavProps['monogram']; size: 'bar' | 'crest' | 'phone' }) {
  const big = size === 'crest' ? 'text-[40px]' : size === 'bar' ? 'text-[34px]' : 'text-[28px]';
  if (typeof monogram === 'string') return <span className={cx('leading-none [font-family:var(--t-script)]', big)}>{monogram}</span>;
  return (
    <span className={cx('relative inline-block leading-none [font-family:var(--t-script)]', big)} aria-hidden="true">
      <span>{monogram[0]}</span>
      <span className="relative -ml-[0.18em] inline-block translate-y-[0.32em] text-[0.72em]">{monogram[1]}</span>
    </span>
  );
}

/**
 * The page menu (website.nav "bar"): the couple's monogram, links to the sections the page shows and "Save
 * the date". On wide pages (1100 px and up) it lies over the hero as a cream panel, the monogram on a
 * maroon cartouche hanging over the arcade, and once the hero's upper 40% has scrolled away it sticks to the top as a full-width bar
 * that marks the section in view. Narrower, it is a bar above the hero with a menu button that opens the
 * links in a sheet (closed by a link, Escape or a tap outside). Links are plain anchors to section ids.
 */
export function PageNav({ links, monogram, save, labels, heroId, interactive }: PageNavProps) {
  const sheetId = `nav${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | undefined>(links[0]?.href);

  useEffect(() => {
    if (!interactive) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const hero = heroId ? document.getElementById(heroId) : null;
      setStuck(!!hero && window.scrollY > hero.offsetTop + hero.offsetHeight * 0.4);
      let current = links[0]?.href;
      for (const link of links) {
        const target = document.getElementById(link.href.slice(1));
        if (target && target.getBoundingClientRect().top <= 120) current = link.href;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [interactive, heroId, links]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      const sheet = document.getElementById(sheetId);
      const button = document.querySelector(`[aria-controls="${sheetId}"]`);
      if (sheet && !sheet.contains(e.target as Node) && !button?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open, sheetId]);

  const pill = 'bulava-caps inline-flex items-center justify-center rounded-full bg-[var(--t-button)] font-semibold uppercase leading-none text-[var(--t-on-button)] shadow-[0_10px_22px_-14px_rgba(112,37,43,0.65)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--t-accent)]';
  const saveLink = (className: string) =>
    save ? (
      interactive ? (
        <a href={save.href} target="_blank" rel="noopener noreferrer" className={cx(pill, className)}>
          {save.label}
        </a>
      ) : (
        <span className={cx(pill, className)}>{save.label}</span>
      )
    ) : null;

  return (
    <nav aria-label={labels.nav} className={cx('bulava-nav relative z-40 @min-[1100px]:h-16 @min-[1100px]:-mb-16', interactive && '@min-[1100px]:sticky @min-[1100px]:top-0')}>
      {/* Phones and tablets: a bar above the hero, and a sheet of links. */}
      <div className="flex h-14 items-center justify-between gap-3 border-b border-[var(--t-line)] bg-[color-mix(in_srgb,var(--t-surface)_96%,transparent)] pr-1 pl-5 text-[var(--t-primary-ink)] @min-[1100px]:hidden">
        <Monogram monogram={monogram} size="phone" />
        <div className="flex items-center gap-1.5">
          {saveLink('h-[34px] px-4 text-[11px] tracking-[0.14em]')}
          {links.length ? (
            <button type="button" className="flex size-11 items-center justify-center" aria-expanded={open} aria-controls={sheetId} aria-label={open ? labels.close : labels.open} onClick={() => setOpen((o) => !o)}>
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
                {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          ) : null}
        </div>
      </div>
      <div id={sheetId} hidden={!open} className="absolute inset-x-0 top-14 z-40 border-b border-[var(--t-line)] bg-[var(--t-surface)] shadow-[0_18px_30px_-24px_rgba(0,0,0,0.45)] @min-[1100px]:hidden">
        <ul>
          {links.map((link) => (
            <li key={link.href} className="border-t border-[var(--t-line)] first:border-t-0">
              <a href={link.href} onClick={() => setOpen(false)} className="bulava-caps flex min-h-12 items-center px-6 text-[13px] font-semibold tracking-[0.14em] uppercase text-[var(--t-text)]">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
      {/* Wide pages: a panel over the hero, then a bar stuck to the top. */}
      <div className={cx('relative hidden @min-[1100px]:block', stuck ? 'h-[60px] border-b border-[var(--t-line)] bg-[var(--t-surface)] shadow-[0_10px_24px_-22px_rgba(0,0,0,0.5)]' : 'h-16')}>
        {stuck ? (
          <span className="absolute top-1/2 left-[6.25%] -translate-y-1/2 text-[var(--t-primary-ink)]">
            <Monogram monogram={monogram} size="bar" />
          </span>
        ) : (
          // Over the hero: a small maroon cartouche hanging from the top edge, edged in gold, the monogram in ivory.
          <span className="absolute top-0 left-[6.25%] flex h-[86px] w-[74px] items-center justify-center rounded-b-[37px] bg-[var(--t-primary)] pb-1.5 text-[var(--t-on-primary)] shadow-[0_12px_24px_-14px_rgba(0,0,0,0.6)]">
            <span aria-hidden="true" className="absolute inset-x-[5px] top-0 bottom-[5px] rounded-b-[32px] border-x border-b border-[color-mix(in_srgb,var(--t-secondary)_80%,transparent)]" />
            <Monogram monogram={monogram} size="crest" />
          </span>
        )}
        <div className={cx('absolute top-0 flex items-center justify-between gap-6', stuck ? 'right-[6.25%] left-[16%] h-[60px]' : 'right-[6.7%] left-[17%] h-16 bg-[color-mix(in_srgb,var(--t-surface)_92%,transparent)] px-6 @min-[1280px]:left-[21%] @min-[1280px]:px-7')}>
          <ul className="flex min-w-0 items-center gap-x-5 overflow-hidden @min-[1280px]:gap-x-7">
            {links.map((link) => (
              <li key={link.href} className="shrink-0">
                <a
                  href={link.href}
                  aria-current={active === link.href ? 'true' : undefined}
                  className={cx('bulava-caps text-[12.5px] font-medium tracking-[0.08em] uppercase transition-colors hover:text-[var(--t-primary-ink)]', active === link.href ? 'text-[var(--t-primary-ink)]' : 'text-[var(--t-text)]')}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          {saveLink('h-[44px] shrink-0 px-7 text-[12px] tracking-[0.12em]')}
        </div>
      </div>
    </nav>
  );
}
