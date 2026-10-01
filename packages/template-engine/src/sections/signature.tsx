import type { SectionProps } from '../types';
import { cardClass, cx, SectionShell, shell } from './shared';

/**
 * menu: the celebration menu from a text slot. Each line is either
 * "Course | dishes" or a plain line. Hidden when empty.
 */
export function Menu(p: SectionProps) {
  const text = p.value('text');
  if (!text) return null;
  const rows = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [course, ...rest] = line.split('|');
      return rest.length ? { course: course!.trim(), dishes: rest.join('|').trim() } : { course: null, dishes: line };
    });
  return (
    <SectionShell {...shell(p)} heading={p.value('heading') ?? p.t('template.menu.title')}>
      <div className={cx('mx-auto max-w-md px-6 py-8 text-center', cardClass(p.look))}>
        <ul className="space-y-6">
          {rows.map((row, i) => (
            <li key={i}>
              {row.course ? <p className="text-2xl text-[var(--t-secondary-ink)] [font-family:var(--t-script)]">{row.course}</p> : null}
              <p className="mt-1 leading-relaxed text-[var(--t-muted-ink)]">{row.dishes}</p>
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}

/** quote: a verse, shloka or line from the couple, set large. Hidden when empty. */
export function Quote(p: SectionProps) {
  const text = p.value('text');
  if (!text) return null;
  const by = p.value('by');
  return (
    <SectionShell {...shell(p)} tone="inverse">
      <figure className="mx-auto max-w-2xl text-center">
        <span aria-hidden="true" className="block text-6xl leading-none text-[var(--t-accent-ink)] [font-family:var(--t-heading)]">
          “
        </span>
        <blockquote className="-mt-4 text-2xl leading-snug italic [font-family:var(--t-heading)] sm:text-3xl">{text}</blockquote>
        {by ? <figcaption className="mt-5 text-xs tracking-[0.3em] uppercase text-[var(--t-muted-ink)]">{by}</figcaption> : null}
      </figure>
    </SectionShell>
  );
}
