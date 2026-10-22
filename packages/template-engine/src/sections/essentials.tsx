import { getLanguage } from '@bulava/localization';
import type { IconName } from '@bulava/template-schema';
import { Icon } from '../canvas/icons';
import { Glyph } from '../ornaments-suite';
import type { SectionProps } from '../types';
import { ShapedCard } from './dress';
import { cx, dressFor, heirloomCaps, SectionShell, shell } from './shared';
import { menuRows } from './signature';

interface Column {
  key: 'stay' | 'travel' | 'gifts' | 'menu';
  icon: IconName;
  label: string;
  text: string;
}

/** Text that runs long is clamped to four lines with a "Read more" that opens it in place. */
const isLong = (text: string) => text.length > 160 || text.split('\n').length > 3;

/**
 * essentials: where to stay, how to travel, the gift note and the menu, as one strip of columns under
 * gold line icons (a list on phones). Each empty column is left out; with none, the strip hides. The menu
 * column names the courses ("Welcome · Starters · Mains · Dessert") and opens the whole menu, printed on
 * a cusped card, under the strip. Columns carry ids (`<id>-stay`, `-travel`, `-gifts`, `-menu`) for the
 * page menu. Props: stay, travel, gifts, menu.
 */
export function Essentials(p: SectionProps) {
  const id = p.instance.id;
  const rows = menuRows(p.value('menu'));
  const courses = rows.filter((r) => r.course).map((r) => r.course);
  const menuLine = courses.length ? courses.join(' · ') : rows[0]?.dishes;
  const all: Array<Omit<Column, 'text'> & { text: string | undefined }> = [
    { key: 'stay', icon: 'bed', label: p.t('template.essentials.stay'), text: p.value('stay') },
    { key: 'travel', icon: 'plane', label: p.t('template.essentials.travel'), text: p.value('travel') },
    { key: 'gifts', icon: 'gift', label: p.t('template.essentials.gifts'), text: p.value('gifts') },
    { key: 'menu', icon: 'cloche', label: p.t('template.essentials.menu'), text: menuLine },
  ];
  const columns = all.filter((c): c is Column => !!c.text);
  if (!columns.length) return null;
  const d = dressFor(p, 'surface');
  const paper = { ...d, band: 'plain' as const };
  const script = getLanguage(p.language).script;
  const still = p.mode === 'thumbnail';
  const summary = 'bulava-caps mx-auto mt-2 inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-[12.5px] font-semibold tracking-[0.12em] uppercase text-[var(--t-primary-ink)] underline decoration-[var(--t-line)] underline-offset-4 @min-[900px]:mt-1 [&::-webkit-details-marker]:hidden';
  return (
    <SectionShell {...shell(p)} dress={d} wide className="border-y border-[var(--t-line)]">
      <div className="bulava-ess-wrap">
        <ul className="mx-auto grid max-w-[1240px] @min-[900px]:auto-cols-fr @min-[900px]:grid-flow-col">
          {columns.map((c, i) => (
            <li key={c.key} id={`${id}-${c.key}`} className={cx('relative flex gap-5 py-5 text-left @min-[900px]:flex-col @min-[900px]:items-center @min-[900px]:gap-0 @min-[900px]:px-6 @min-[900px]:py-1 @min-[900px]:text-center', i > 0 && 'border-t border-[var(--t-line)] @min-[900px]:border-t-0')}>
              {i > 0 ? <span aria-hidden="true" className="absolute top-[20%] left-0 hidden h-[60%] w-px bg-[var(--t-line)] @min-[900px]:block" /> : null}
              <span className="block size-12 shrink-0 text-[var(--t-orn)] @min-[900px]:size-[54px]">
                <Icon name={c.icon} weight={1.25} />
              </span>
              <div className="min-w-0 @min-[900px]:mt-4">
                <h3 className={cx('leading-[1.3] font-semibold text-[var(--t-primary-ink)]', heirloomCaps(script, 'text-[12.5px] tracking-[0.16em] @min-[640px]:text-[13px]'))}>{c.label}</h3>
                {c.key !== 'menu' && isLong(c.text) && !still ? (
                  <div className="bulava-more mt-2">
                    <p className="bulava-clamp-4 text-[15px] leading-[1.6] whitespace-pre-line text-[var(--t-text)]">{c.text}</p>
                    <details>
                      <summary className={summary}>{p.t('template.essentials.more')}</summary>
                    </details>
                  </div>
                ) : (
                  <p className={cx('mt-2 text-[15px] leading-[1.6] whitespace-pre-line text-[var(--t-text)]', isLong(c.text) && 'line-clamp-4')}>{c.text}</p>
                )}
                {c.key === 'menu' && rows.length && !still ? (
                  <details className="bulava-ess-toggle">
                    <summary className={summary}>{p.t('template.menu.see')}</summary>
                  </details>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {rows.length && !still ? (
          <div className="bulava-ess-menu bulava-reply-card mx-auto mt-10 hidden max-w-[560px] bg-transparent" style={{ backgroundColor: 'transparent' }}>
            <ShapedCard d={paper} shape="cusped" fill="var(--rc-bg)" className="px-7 pt-[26cqw] pb-10 text-center @min-[640px]:px-12">
              <ul className="space-y-6">
                {rows.map((row, i) => (
                  <li key={i}>
                    {i > 0 ? <Glyph name={d.suite.glyph} className="mx-auto mb-5 size-3 text-[var(--t-orn)] opacity-70" /> : null}
                    {row.course ? <p className="text-[26px] leading-tight text-[var(--t-secondary-ink)] [font-family:var(--t-script)]">{row.course}</p> : null}
                    <p className="mt-1 text-[15px] leading-relaxed text-[var(--t-muted-ink)]">{row.dishes}</p>
                  </li>
                ))}
              </ul>
            </ShapedCard>
          </div>
        ) : null}
      </div>
    </SectionShell>
  );
}
