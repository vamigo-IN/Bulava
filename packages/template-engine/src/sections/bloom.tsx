import { Illustration } from '../art/illustrations';
import type { SectionProps } from '../types';

/** The bouquets' leaves and the swans' water: natural colours that stay in every preset. */
const LEAVES = '#8a9a6b';
const WATER = '#c9b9a0';

/**
 * footer "bloom" (The Sacred Garden): the closing line in gold script and the couple's names beneath it, over their
 * photograph (the `image` prop: the closing photo, else the cover) rising out of the cream, with peonies and roses
 * gathered at its foot. Without a photo the two swans close the page between the bouquets. The guest's own
 * details, the check-in pass and the watermark follow. Props: title, image.
 */
export function BloomFooter(p: SectionProps) {
  const title = p.value('title') ?? p.t('template.footer.hopeToSee');
  const image = p.value('image');
  const couple = p.ctx.couple;
  const who = couple ? p.t('template.footer.coupleNames', { one: couple.partnerOne, two: couple.partnerTwo }) : (p.ctx.honoree?.name ?? p.ctx.event.title);
  const bouquet = (side: 'left' | 'right') => (
    <div
      aria-hidden="true"
      className={`bulava-deckle-breathe pointer-events-none absolute bottom-[-6px] h-[300px] w-[200px] ${side === 'left' ? '-left-[30px] [--dk-origin:bottom_left]' : '-right-[30px] [--dk-origin:bottom_right]'}`}
    >
      <Illustration name="peonyCorner" color={LEAVES} colors={p.colors} w={220} h={330} style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible', transform: side === 'right' ? 'scaleX(-1)' : undefined }} />
    </div>
  );
  return (
    <footer id={p.instance.id} className="bulava-reveal bulava-deckle relative overflow-hidden bg-[var(--t-bg)] text-center">
      <div className="relative mx-auto w-full max-w-[450px]">
        {image ? (
          <div className="relative aspect-[450/675] w-full">
            <img src={image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover [object-position:50%_30%]" />
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[42%]" style={{ background: 'linear-gradient(to bottom, var(--t-bg) 22%, color-mix(in srgb, var(--t-bg) 55%, transparent) 62%, transparent)' }} />
          </div>
        ) : (
          <div className="relative h-[520px] w-full">
            <div aria-hidden="true" className="absolute inset-x-0 bottom-[150px] mx-auto w-[290px]">
              <Illustration name="swanPair" color={WATER} colors={p.colors} w={256} h={160} style={{ display: 'block', width: '100%', height: 'auto' }} />
            </div>
          </div>
        )}
        <div className="absolute inset-x-0 top-[14px] px-6">
          <p className="bulava-deckle-fade text-[41px] leading-[1.45] text-balance text-[var(--t-secondary-display)] [font-family:var(--t-heading)]">{title}</p>
          <p className="bulava-deckle-rise mt-1 text-[28px] leading-[1.45] font-light break-words text-balance text-[var(--t-secondary-display)] [font-family:var(--t-body)]">{who}</p>
        </div>
        {bouquet('left')}
        {bouquet('right')}
      </div>
      {p.slots.guestInfo ? <div className="relative mx-auto max-w-md px-6 pt-8 text-left">{p.slots.guestInfo}</div> : null}
      {p.slots.checkIn ? <div className="relative mx-auto max-w-xs px-6 pt-8">{p.slots.checkIn}</div> : null}
      {p.slots.watermark ? <p className="relative px-6 py-6 text-xs text-[var(--t-muted-ink)]">{p.t('template.madeWith')}</p> : null}
    </footer>
  );
}
