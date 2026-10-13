import type { ReactNode } from 'react';
import { Icon } from '../canvas/icons';
import { Glyph } from '../ornaments-suite';
import { Curtain, FlipCard } from '../interactive';
import type { SectionProps } from '../types';
import { PhotoFrame, RoundPortrait, Seal, type Dress } from './dress';
import { cardClass, cx, dressFor, faces, initials, labelClass, Paragraphs, SectionShell, shell } from './shared';

interface Person {
  name: string;
  /** The parents' line ("Father & Mother", or the host's own words); empty shows nothing. */
  parents?: string;
  /** "Daughter of" / "Son of", in the page's language. */
  label: string;
  photo?: string;
  /** The face the parents' names are set in (faces().name). */
  face: string;
  /** How the label is set in the page's script (labelClass). */
  labelClass: string;
}

/** The couple's names and parents' lines (empty lines show nothing), with their photos. */
function people(p: SectionProps): [Person, Person] | null {
  const c = p.ctx.couple;
  if (!c) return null;
  const photos = p.ctx.photos;
  const slots = p.ctx.photoSlots ?? {};
  const face = faces(p).name;
  const label = labelClass(p.language);
  return [
    { name: c.partnerOne, parents: p.value('partnerOneParents'), label: p.t('template.couple.daughterOf'), photo: slots.partnerOne?.url ?? photos[0]?.url, face, labelClass: label },
    { name: c.partnerTwo, parents: p.value('partnerTwoParents'), label: p.t('template.couple.sonOf'), photo: slots.partnerTwo?.url ?? photos[1]?.url, face, labelClass: label },
  ];
}

/** "Rakesh Sharma & Sunita Sharma" as two lines, the second led by a script ampersand. */
function ParentNames({ line, className }: { line: string; className?: string }) {
  const at = line.search(/\s+&\s+/);
  if (at < 0) return <span className={className}>{line}</span>;
  const first = line.slice(0, at);
  const second = line.slice(at).replace(/^\s+&\s+/, '');
  return (
    <span className={className}>
      {first}
      <br />
      <span aria-hidden="true" className="mr-[0.3em] [font-family:var(--t-script)] text-[1.1em] not-italic text-[var(--t-secondary-ink)]">
        &amp;
      </span>
      <span className="sr-only">and </span>
      {second}
    </span>
  );
}

/** The parents under a name: "Daughter of" in small capitals, then their names in the heading face. Nothing when empty. */
function Parents({ person, align = 'center', className }: { person: Person; align?: 'center' | 'start' | 'end'; className?: string }) {
  if (!person.parents) return null;
  const items = align === 'start' ? 'items-start text-left' : align === 'end' ? 'items-end text-right' : 'items-center text-center';
  return (
    <div className={cx('mt-3 flex flex-col gap-1.5', items, className)}>
      <p className={cx('text-[var(--t-secondary-ink)]', person.labelClass)}>{person.label}</p>
      <ParentNames line={person.parents} className={cx('block max-w-[17rem] text-[0.95rem] leading-snug text-balance text-[var(--t-text)] @min-[640px]:text-base', person.face)} />
    </div>
  );
}

/** A person's initials in the script face: what a frame shows until the host adds a photo. */
function Initial({ name, className }: { name: string; className?: string }) {
  return <span className={cx('[font-family:var(--t-script)] leading-none text-[var(--t-on-primary)] drop-shadow-[0_2px_6px_rgba(0,0,0,0.25)]', className ?? 'text-6xl')}>{initials(name)}</span>;
}

/** The ampersand between two names, in the script face. */
function Amp({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cx('[font-family:var(--t-script)] leading-none text-[var(--t-secondary-ink)]', className ?? 'text-4xl')}>
      &amp;
    </span>
  );
}

const NAME = 'leading-tight break-words [overflow-wrap:anywhere] text-[var(--t-primary-ink)] [font-family:var(--t-script)]';

/**
 * couple: the two people, their parents ("Daughter of … / Son of …", empty
 * lines show nothing) and their photos (photo.partnerOne / photo.partnerTwo,
 * else the first two chosen photos), dressed in the template's suite.
 * Variants: default (round portraits in the suite's seal, side by side),
 * stacked (the same, one above the other), portraits (alias arch: tall frames
 * in the suite's shape: a jharokha, a temple niche, a mihrab, a lancet, an
 * arch, an oval…), duet (two round portraits overlapping, the names on one
 * line, the families side by side), monogram (the names either side of a seal
 * with their initials), flip (3D cards that turn over to the parents), profile
 * (editorial rows).
 */
export function Couple(p: SectionProps) {
  const list = people(p);
  if (!list) return null;
  const heading = p.value('heading') ?? p.t('template.couple.title');
  const variant = p.instance.variant;
  const d = dressFor(p, variant === 'profile' ? 'plain' : 'surface');
  const common = { ...shell(p), dress: d, heading };

  if (variant === 'arch' || variant === 'portraits') {
    return (
      <SectionShell {...common}>
        <div className="relative grid grid-cols-2 items-start gap-x-5 gap-y-10 @min-[640px]:gap-x-20">
          {list.map((person, i) => (
            <div key={i} className={cx('flex min-w-0 flex-col items-center text-center', i ? '@min-[640px]:mt-16' : '')}>
              <div className="w-full max-w-[230px]">
                <PhotoFrame d={d} src={person.photo} alt={person.name} fallback={<Initial name={person.name} className="text-5xl @min-[640px]:text-6xl" />} tilt />
              </div>
              <h3 className={cx('mt-6 text-[2rem] @min-[640px]:text-5xl', NAME)}>{person.name}</h3>
              <Parents person={person} />
            </div>
          ))}
          <div className="pointer-events-none absolute top-[22%] left-1/2 hidden -translate-x-1/2 @min-[640px]:block">
            <Amp className="text-6xl" />
          </div>
        </div>
      </SectionShell>
    );
  }

  if (variant === 'duet') {
    const [one, two] = list;
    return (
      <SectionShell {...common}>
        <div className="mx-auto max-w-xl">
          <div className="relative mx-auto flex w-full max-w-[22rem] justify-center @min-[640px]:max-w-[26rem]">
            <RoundPortrait d={d} src={one.photo} alt={one.name} fallback={<Initial name={one.name} className="text-5xl" />} className="z-[1] -mr-[9%] w-[56%]" halo={false} pendant={false} />
            <RoundPortrait d={d} src={two.photo} alt={two.name} fallback={<Initial name={two.name} className="text-5xl" />} className="-ml-[9%] w-[56%]" halo={false} pendant={false} />
            <div className="absolute -bottom-5 left-1/2 z-[2] w-14 -translate-x-1/2 rounded-full" style={{ background: 'var(--t-band, var(--t-bg))' }}>
              <Seal d={d} className="w-full" quiet>
                <Amp className="text-2xl" />
              </Seal>
            </div>
          </div>
          <h3 className={cx('mt-10 text-center text-[2.4rem] @min-[640px]:text-6xl', NAME)}>
            {one.name} <Amp className="mx-1 text-[0.8em]" /> {two.name}
          </h3>
          {one.parents || two.parents ? (
            <div className={cx('mt-8 grid gap-6', one.parents && two.parents ? 'grid-cols-[1fr_auto_1fr] items-start' : '')}>
              {one.parents ? <Parents person={one} className="mt-0" /> : null}
              {one.parents && two.parents ? <span aria-hidden="true" className="h-full w-px bg-[var(--t-line)]" /> : null}
              {two.parents ? <Parents person={two} className="mt-0" /> : null}
            </div>
          ) : null}
        </div>
      </SectionShell>
    );
  }

  if (variant === 'monogram') {
    const mono = `${initials(list[0].name).slice(0, 1)}${initials(list[1].name).slice(0, 1)}`;
    const side = (person: Person, align: 'end' | 'start') => (
      <div className={cx('flex min-w-0 flex-col items-center text-center', align === 'end' ? '@min-[640px]:items-end @min-[640px]:text-right' : '@min-[640px]:items-start @min-[640px]:text-left')}>
        {person.photo ? <RoundPortrait d={d} src={person.photo} alt={person.name} className="mb-5 w-28 @min-[640px]:w-32" halo={false} /> : null}
        <h3 className={cx('text-[2.2rem] @min-[640px]:text-5xl', NAME)}>{person.name}</h3>
        <Parents person={person} className={align === 'end' ? '@min-[640px]:items-end @min-[640px]:text-right' : '@min-[640px]:items-start @min-[640px]:text-left'} />
      </div>
    );
    return (
      <SectionShell {...common} wide>
        <div className="grid items-center gap-8 @min-[640px]:grid-cols-[1fr_auto_1fr] @min-[640px]:gap-14">
          {side(list[0], 'end')}
          <Seal d={d} className="mx-auto w-40 @min-[640px]:w-52">
            <span className="text-4xl tracking-[0.1em] text-[var(--t-heading-ink)] [font-family:var(--t-heading)] @min-[640px]:text-5xl">
              {mono[0]}
              <span className="mx-1 align-middle text-[0.55em] text-[var(--t-secondary-ink)] [font-family:var(--t-script)]">&amp;</span>
              {mono[1]}
            </span>
          </Seal>
          {side(list[1], 'start')}
        </div>
      </SectionShell>
    );
  }

  if (variant === 'flip') {
    return (
      <SectionShell {...common}>
        <div className="grid gap-6 @min-[640px]:grid-cols-2">
          {list.map((person, i) => (
            <FlipCard
              key={i}
              label={p.t('template.couple.flip', { name: person.name })}
              className="aspect-[3/4]"
              front={
                <span className={cx('relative flex h-full w-full flex-col overflow-hidden', cardClass(p.look))}>
                  <span className="relative block flex-1 overflow-hidden" style={{ background: 'linear-gradient(160deg, var(--t-accent), var(--t-primary))' }}>
                    {person.photo ? <img src={person.photo} alt={person.name} className="h-full w-full object-cover" loading="lazy" /> : <span className="flex h-full w-full items-center justify-center"><Initial name={person.name} /></span>}
                  </span>
                  <span className="block px-4 py-4 text-center">
                    <span className={cx('block text-3xl', NAME)}>{person.name}</span>
                    <span className="mt-1 block text-[0.65rem] tracking-[0.3em] uppercase text-[var(--t-muted-ink)]">{p.t('template.couple.tapToTurn')}</span>
                  </span>
                </span>
              }
              back={
                <span className={cx('flex h-full w-full flex-col items-center justify-center gap-2 p-8 text-center', cardClass(p.look))}>
                  <Seal d={d} className="w-24" quiet>
                    <span className="text-4xl [font-family:var(--t-heading)] text-[var(--t-heading-ink)]">{initials(person.name).slice(0, 1)}</span>
                  </Seal>
                  <span className={cx('mt-2 block text-3xl', NAME)}>{person.name}</span>
                  {person.parents ? (
                    <span className="mt-1 flex flex-col items-center gap-1.5">
                      <span className={cx('text-[var(--t-secondary-ink)]', person.labelClass)}>{person.label}</span>
                      <ParentNames line={person.parents} className={cx('block text-base leading-snug text-[var(--t-text)]', person.face)} />
                    </span>
                  ) : null}
                </span>
              }
            />
          ))}
        </div>
      </SectionShell>
    );
  }

  if (variant === 'profile') {
    return (
      <SectionShell {...common}>
        <div className="space-y-14">
          {list.map((person, i) => (
            <div key={i} className={cx('flex flex-col items-center gap-6 @min-[640px]:flex-row', i % 2 ? '@min-[640px]:flex-row-reverse @min-[640px]:text-right' : '@min-[640px]:text-left')}>
              <div className="w-44 shrink-0 @min-[640px]:w-52">
                <PhotoFrame d={d} src={person.photo} alt={person.name} fallback={<Initial name={person.name} />} />
              </div>
              <div className={cx('flex min-w-0 flex-col items-center text-center', i % 2 ? '@min-[640px]:items-end @min-[640px]:text-right' : '@min-[640px]:items-start @min-[640px]:text-left')}>
                <span className="mb-3 block h-px w-16 bg-[var(--t-orn)]" aria-hidden="true" />
                <h3 className={cx('text-4xl break-words @min-[640px]:text-5xl', person.face)}>{person.name}</h3>
                <Parents person={person} className={i % 2 ? '@min-[640px]:items-end @min-[640px]:text-right' : '@min-[640px]:items-start @min-[640px]:text-left'} />
              </div>
            </div>
          ))}
        </div>
      </SectionShell>
    );
  }

  // default and stacked: round portraits in the suite's seal, side by side or one above the other.
  const stacked = variant === 'stacked';
  return (
    <SectionShell {...common}>
      <div className={cx('grid items-start', stacked ? 'mx-auto max-w-sm grid-cols-1 gap-2' : 'grid-cols-[1fr_auto_1fr] gap-2 @min-[640px]:gap-10')}>
        <PersonBlock d={d} person={list[0]} stacked={stacked} />
        <div className={cx('flex justify-center', stacked ? 'py-3' : 'self-start pt-[22%]')}>
          <Amp className={stacked ? 'text-5xl' : 'text-4xl @min-[640px]:text-6xl'} />
        </div>
        <PersonBlock d={d} person={list[1]} stacked={stacked} />
      </div>
    </SectionShell>
  );
}

function PersonBlock({ d, person, stacked }: { d: Dress; person: Person; stacked: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <RoundPortrait d={d} src={person.photo} alt={person.name} fallback={<Initial name={person.name} className="text-4xl @min-[640px]:text-5xl" />} className={stacked ? 'w-52' : 'w-full max-w-[210px]'} />
      <h3 className={cx('mt-4', stacked ? 'text-[2.4rem]' : 'text-[1.9rem] @min-[640px]:text-5xl', NAME)}>{person.name}</h3>
      <Parents person={person} />
    </div>
  );
}

/**
 * family / parents: the blessings. Variants: default (the text), blessings (each
 * family's parents side by side under the couple's names, the suite's seal
 * between them, then the text). Empty lines show nothing; with nothing at all
 * the section hides.
 */
export function Family(p: SectionProps) {
  const text = p.value('text');
  const one = p.value('partnerOneParents');
  const two = p.value('partnerTwoParents');
  const couple = p.ctx.couple;
  const families = p.instance.variant === 'blessings' && couple && (one || two);
  if (!text && !families) return null;
  const heading = p.value('heading') ?? p.t('template.family.title');
  const d = dressFor(p);
  const face = faces(p);
  if (families) {
    const col = (who: string, line?: string) =>
      line ? (
        <div className="flex min-w-0 flex-col items-center text-center">
          <p className={cx('break-words text-[var(--t-secondary-ink)]', labelClass(p.language))}>{p.t('template.family.of', { name: who })}</p>
          <ParentNames line={line} className={cx('mt-3 block text-xl leading-snug text-balance @min-[640px]:text-2xl', face.name)} />
        </div>
      ) : null;
    return (
      <SectionShell {...shell(p)} dress={d} heading={heading}>
        <div className={cx('grid items-center gap-6', one && two ? '@min-[640px]:grid-cols-[1fr_auto_1fr] @min-[640px]:gap-10' : '')}>
          {col(couple.partnerOne, one)}
          {one && two ? (
            <>
              <Seal d={d} className="mx-auto hidden w-20 @min-[640px]:flex" quiet />
              <div aria-hidden="true" className="flex justify-center text-[var(--t-orn)] @min-[640px]:hidden">
                <Glyph name={d.suite.glyph} className="size-5" />
              </div>
            </>
          ) : null}
          {col(couple.partnerTwo, two)}
        </div>
        {text ? <Paragraphs text={text} className={cx('mx-auto mt-10 max-w-xl text-lg text-[var(--t-text)]', face.prose)} /> : null}
      </SectionShell>
    );
  }
  return (
    <SectionShell {...shell(p)} dress={d} heading={heading}>
      <Paragraphs text={text!} className={cx('text-lg text-[var(--t-text)] @min-[640px]:text-xl', face.prose)} />
    </SectionShell>
  );
}

/**
 * story: narrative text with an optional photo (photo.story, else the second chosen photo).
 * Variants: default (the photo in the suite's frame beside the text), curtain (the photo
 * waits behind velvet curtains), polaroid, letter (a letter on the suite's paper, the photo
 * pinned above it, the seal below).
 */
export function Story(p: SectionProps) {
  const text = p.value('text');
  if (!text) return null;
  const photo = p.value('image');
  const heading = p.value('heading') ?? p.t('template.story.title');
  const d = dressFor(p);

  if (photo && p.instance.variant === 'curtain') {
    return (
      <SectionShell {...shell(p)} dress={d} heading={heading}>
        <div className="mx-auto max-w-sm">
          <Curtain label={p.t('template.tapToReveal')} color={p.colors.primary}>
            <img src={photo} alt="" className="aspect-[4/5] w-full object-cover" loading="lazy" />
          </Curtain>
        </div>
        <Paragraphs text={text} className="mx-auto mt-10 max-w-xl text-lg" />
      </SectionShell>
    );
  }

  if (photo && p.instance.variant === 'polaroid') {
    return (
      <SectionShell {...shell(p)} dress={d} heading={heading}>
        <div className="grid items-center gap-10 @min-[640px]:grid-cols-2">
          <div className="bulava-tilt relative mx-auto w-64 -rotate-3 bg-white p-3 pb-12 shadow-[0_24px_40px_-18px_rgba(0,0,0,0.55)]">
            <span aria-hidden="true" className="absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 rotate-2 bg-[var(--t-accent)] opacity-70" />
            <img src={photo} alt="" className="aspect-square w-full object-cover" loading="lazy" />
          </div>
          <Paragraphs text={text} className="@min-[640px]:text-left" />
        </div>
      </SectionShell>
    );
  }

  if (p.instance.variant === 'letter') {
    // The letter is light paper on any band: the pieces on it take the paper's colours.
    const paper: Dress = { ...d, band: 'plain' };
    return (
      <SectionShell {...shell(p)} dress={d} heading={heading}>
        <div className={cx('bulava-reply-card relative mx-auto max-w-xl px-7 pb-12 text-center shadow-[0_30px_60px_-36px_rgba(0,0,0,0.6)] @min-[640px]:px-14', photo ? 'mt-16 pt-6' : 'pt-12')}>
          <div className="pointer-events-none absolute inset-2.5 border border-[var(--t-line)]" aria-hidden="true" />
          {photo ? (
            <div className="relative mx-auto -mt-20 mb-8 w-36 rotate-[-2deg]">
              <PhotoFrame d={paper} src={photo} alt="" fallback={null} />
            </div>
          ) : null}
          <Paragraphs text={text} className={cx('relative text-lg leading-loose text-[var(--t-text)]', faces(p).prose)} />
          <Seal d={paper} className="relative mx-auto mt-8 w-14" quiet />
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell {...shell(p)} dress={d} heading={heading}>
      <div className={cx('grid items-center gap-10', photo && '@min-[640px]:grid-cols-[2fr_3fr]')}>
        {photo ? (
          <div className="mx-auto w-full max-w-[260px]">
            <PhotoFrame d={d} src={photo} alt="" fallback={null} />
          </div>
        ) : null}
        <Paragraphs text={text} className={photo ? '@min-[640px]:text-left' : 'mx-auto max-w-xl text-lg'} />
      </div>
    </SectionShell>
  );
}

const INFO_ICONS: Record<string, 'bed' | 'car' | 'gift'> = { '🏨': 'bed', '🚗': 'car', '🎁': 'gift' };

/** accommodation / travel / giftRegistry: heading + custom text in a card under the suite's seal; hidden when empty. */
export function InfoBlock(p: SectionProps & { defaultHeading: string; icon: string }) {
  const text = p.value('text');
  if (!text) return null;
  const icon = INFO_ICONS[p.icon];
  const d = dressFor(p, 'surface');
  return (
    <SectionShell {...shell(p)} dress={d} heading={p.value('heading') ?? p.defaultHeading}>
      <div className={cx('relative mx-auto mt-6 max-w-xl px-6 pt-12 pb-8 text-center', cardClass(p.look))}>
        <div className="absolute -top-9 left-1/2 w-[72px] -translate-x-1/2 rounded-full" style={{ background: 'var(--t-band, var(--t-bg))' }}>
          <Seal d={d} quiet>
            {icon ? (
              <span className="block size-7 text-[var(--t-heading-ink)]">
                <Icon name={icon} />
              </span>
            ) : (
              <span aria-hidden="true" className="text-2xl">
                {p.icon}
              </span>
            )}
          </Seal>
        </div>
        <Paragraphs text={text} />
      </div>
    </SectionShell>
  );
}

/** announcements: host updates visible to this viewer, each marked with the suite's glyph. */
export function Announcements(p: SectionProps) {
  const items = p.ctx.announcements ?? [];
  if (!items.length) return null;
  const d = dressFor(p);
  return (
    <SectionShell {...shell(p)} dress={d} heading={p.value('heading') ?? p.t('template.announcements.title')}>
      <ul className="space-y-3">
        {items.map((a, i) => (
          <AnnouncementItem key={i} d={d} title={a.title} body={a.body} card={cardClass(p.look)} />
        ))}
      </ul>
    </SectionShell>
  );
}

function AnnouncementItem({ d, title, body, card }: { d: Dress; title: string; body: string; card: string }): ReactNode {
  return (
    <li className={cx('flex gap-4 p-4', card)}>
      <Glyph name={d.suite.glyph} className="mt-0.5 size-5 shrink-0 text-[var(--t-orn)]" />
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm whitespace-pre-line text-[var(--t-muted-ink)]">{body}</p>
      </div>
    </li>
  );
}
