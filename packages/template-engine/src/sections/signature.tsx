import { Glyph } from '../ornaments-suite';
import type { SectionProps } from '../types';
import { Seal, ShapedCard } from './dress';
import { cardClass, cx, dressFor, faces, SectionShell, shell } from './shared';

/**
 * menu: the celebration menu from a text slot, printed on a card in the suite's
 * shape. Each line is either "Course | dishes" or a plain line. Hidden when empty.
 */
export function Menu(p: SectionProps) {
  const text = p.value('text');
  if (!text) return null;
  const d = dressFor(p);
  const rows = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [course, ...rest] = line.split('|');
      return rest.length ? { course: course!.trim(), dishes: rest.join('|').trim() } : { course: null, dishes: line };
    });
  const list = (
    <ul className="space-y-6">
      {rows.map((row, i) => (
        <li key={i}>
          {i > 0 && d.suite.name !== 'none' ? <Glyph name={d.suite.glyph} className="mx-auto mb-5 size-3 text-[var(--t-orn)] opacity-70" /> : null}
          {row.course ? <p className="text-2xl text-[var(--t-secondary-ink)] [font-family:var(--t-script)]">{row.course}</p> : null}
          <p className="mt-1 leading-relaxed text-[var(--t-muted-ink)]">{row.dishes}</p>
        </li>
      ))}
    </ul>
  );
  return (
    <SectionShell {...shell(p)} dress={d} heading={p.value('heading') ?? p.t('template.menu.title')}>
      {d.suite.name === 'none' ? (
        <div className={cx('mx-auto max-w-md px-6 py-8 text-center', cardClass(p.look))}>{list}</div>
      ) : (
        <div className="mx-auto max-w-md text-center">
          <ShapedCard d={d} className="px-7 pt-12 pb-10">
            {list}
          </ShapedCard>
        </div>
      )}
    </SectionShell>
  );
}

/** quote: a verse, shloka or line from the couple, set large under the suite's seal. Hidden when empty. */
export function Quote(p: SectionProps) {
  const text = p.value('text');
  if (!text) return null;
  const by = p.value('by');
  const d = dressFor(p, 'inverse');
  const suited = d.suite.name !== 'none';
  return (
    <SectionShell {...shell(p)} dress={d}>
      <figure className="relative mx-auto max-w-2xl text-center">
        {suited ? (
          <Seal d={d} className="mx-auto mb-6 w-16" quiet>
            <span aria-hidden="true" className="text-4xl leading-none text-[var(--t-accent-ink)] [font-family:var(--t-heading)]">
              “
            </span>
          </Seal>
        ) : (
          <span aria-hidden="true" className="block text-6xl leading-none text-[var(--t-accent-ink)] [font-family:var(--t-heading)]">
            “
          </span>
        )}
        <blockquote className={cx('text-2xl leading-snug @min-[640px]:text-3xl', faces(p).prose, !suited && '-mt-4')}>{text}</blockquote>
        {by ? <figcaption className="mt-5 text-xs tracking-[0.3em] uppercase text-[var(--t-muted-ink)]">{by}</figcaption> : null}
      </figure>
    </SectionShell>
  );
}
