import { getLanguage } from '@bulava/localization';
import type { SectionProps } from '../types';
import { Crest, FleuronRule } from './dress';
import { cx, dressFor, heirloomCaps, SectionShell, shell } from './shared';

/**
 * invitation: the invitation's own words, centred between a small gold crest and the fleuron's rule: gold
 * capitals ("With joyful hearts"), the lead ("We cordially invite you to"), the event's title large in italic
 * serif, and its description. Art stands beside it (the section's decor). Hidden only without a title.
 * Props: eyebrow, lead, title, text.
 */
export function Invitation(p: SectionProps) {
  const title = p.value('title') ?? p.ctx.event.title;
  if (!title) return null;
  const d = dressFor(p, 'surface');
  const script = getLanguage(p.language).script;
  const eyebrow = p.value('eyebrow') ?? p.t('template.invitation.eyebrow');
  const lead = p.value('lead') ?? p.t('template.invitation.lead');
  const text = p.value('text');
  return (
    <SectionShell {...shell(p)} dress={d}>
      <div className="mx-auto max-w-[640px] text-center">
        <Crest d={d} className="mx-auto h-[24px] w-[33px] @min-[640px]:h-[29px] @min-[640px]:w-10" />
        <p className={cx('mt-4 leading-[1.4] font-semibold text-[var(--t-secondary-ink)]', heirloomCaps(script, 'text-[11.5px] tracking-[0.24em] @min-[640px]:text-[13px]'))}>{eyebrow}</p>
        <p className="mt-5 text-[26px] leading-[1.2] font-medium text-[var(--t-primary-ink)] [font-family:var(--t-heading)] @min-[640px]:text-[38px]">{lead}</p>
        <h2 className="mt-1 text-[36px] leading-[1.1] font-semibold italic break-words text-balance text-[var(--t-primary-ink)] [font-family:var(--t-heading)] @min-[640px]:text-[54px]">{title}</h2>
        {text ? <p className="mx-auto mt-6 max-w-[560px] text-[15px] leading-[1.75] text-[var(--t-muted-ink)] @min-[640px]:text-base">{text}</p> : null}
        <FleuronRule d={d} className="mt-8" />
      </div>
    </SectionShell>
  );
}
