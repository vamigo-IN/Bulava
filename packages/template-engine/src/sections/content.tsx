import { Curtain, FlipCard } from '../interactive';
import type { SectionProps } from '../types';
import { cardClass, cx, initials, Paragraphs, SectionShell, shell } from './shared';

/**
 * couple: the two people, with photos placed by the customer (photo.partnerOne /
 * photo.partnerTwo, else the first two chosen photos) or monograms.
 * Variants: default (round medallions), stacked, arch (tall arched frames),
 * flip (3D cards that turn over to show family lines), profile (editorial).
 */
export function Couple(p: SectionProps) {
  const c = p.ctx.couple;
  if (!c) return null;
  const photos = p.ctx.photos;
  const slots = p.ctx.photoSlots ?? {};
  const people = [
    { name: c.partnerOne, parents: p.value('partnerOneParents'), photo: slots.partnerOne?.url ?? photos[0]?.url },
    { name: c.partnerTwo, parents: p.value('partnerTwoParents'), photo: slots.partnerTwo?.url ?? photos[1]?.url },
  ];
  const heading = p.value('heading') ?? p.t('template.couple.title');
  const variant = p.instance.variant;

  const portrait = (person: (typeof people)[number], shape: string) =>
    person.photo ? (
      <img src={person.photo} alt={person.name} className={cx('h-full w-full object-cover', shape)} loading="lazy" />
    ) : (
      <span className="flex h-full w-full items-center justify-center text-6xl text-[var(--t-primary-ink)] [font-family:var(--t-script)]">{initials(person.name)}</span>
    );

  if (variant === 'arch') {
    return (
      <SectionShell {...shell(p)} heading={heading} tone="surface">
        <div className="grid grid-cols-2 gap-5 sm:gap-10">
          {people.map((person, i) => (
            <div key={person.name} className="flex flex-col items-center text-center">
              <div className={cx('bulava-tilt relative w-full max-w-[220px] rounded-t-full border-[3px] border-[var(--t-accent)] p-1.5 shadow-[0_24px_40px_-20px_rgba(0,0,0,0.5)]', i ? 'sm:mt-12' : '')}>
                <div className="aspect-[3/4] overflow-hidden rounded-t-full bg-[var(--t-card-alt)]">{portrait(person, 'rounded-t-full')}</div>
                <span className="absolute -bottom-3 left-1/2 size-6 -translate-x-1/2 rotate-45 border-2 border-[var(--t-accent)] bg-[var(--t-card)]" aria-hidden="true" />
              </div>
              <h3 className="mt-7 text-3xl [font-family:var(--t-script)] text-[var(--t-primary-ink)] sm:text-4xl">{person.name}</h3>
              {person.parents ? <p className="mt-2 max-w-[16rem] text-sm text-[var(--t-muted-ink)]">{person.parents}</p> : null}
            </div>
          ))}
        </div>
      </SectionShell>
    );
  }

  if (variant === 'flip') {
    return (
      <SectionShell {...shell(p)} heading={heading} tone="surface">
        <div className="grid gap-6 sm:grid-cols-2">
          {people.map((person) => (
            <FlipCard
              key={person.name}
              label={p.t('template.couple.flip', { name: person.name })}
              className="aspect-[3/4]"
              front={
                <span className={cx('relative flex h-full w-full flex-col overflow-hidden', cardClass(p.look))}>
                  <span className="relative block flex-1 overflow-hidden">{portrait(person, '')}</span>
                  <span className="block px-4 py-4 text-center">
                    <span className="block text-3xl [font-family:var(--t-script)] text-[var(--t-primary-ink)]">{person.name}</span>
                    <span className="mt-1 block text-[0.65rem] tracking-[0.3em] uppercase text-[var(--t-muted-ink)]">{p.t('template.couple.tapToTurn')}</span>
                  </span>
                </span>
              }
              back={
                <span className={cx('flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center', cardClass(p.look))}>
                  <span className="text-5xl [font-family:var(--t-script)] text-[var(--t-accent-ink)]">{initials(person.name)}</span>
                  <span className="text-2xl [font-family:var(--t-heading)]">{person.name}</span>
                  {person.parents ? <span className="text-sm leading-relaxed text-[var(--t-muted-ink)]">{person.parents}</span> : null}
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
      <SectionShell {...shell(p)} heading={heading}>
        <div className="space-y-14">
          {people.map((person, i) => (
            <div key={person.name} className={cx('flex flex-col items-center gap-6 sm:flex-row', i % 2 ? 'sm:flex-row-reverse sm:text-right' : 'sm:text-left')}>
              <div className="w-44 shrink-0 overflow-hidden rounded-[calc(var(--t-radius)*1.4)] border border-[var(--t-line)] shadow-2xl sm:w-52">
                <div className="aspect-[4/5]">{portrait(person, '')}</div>
              </div>
              <div className="text-center sm:text-inherit">
                <span className={cx('mb-3 block h-px w-16 bg-[var(--t-accent)]', i % 2 ? 'mx-auto sm:mr-0' : 'mx-auto sm:ml-0')} aria-hidden="true" />
                <h3 className="text-5xl italic [font-family:var(--t-heading)]">{person.name}</h3>
                {person.parents ? <p className="mt-3 max-w-sm text-[var(--t-muted-ink)]">{person.parents}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell {...shell(p)} heading={heading} tone="surface">
      <div className={cx('grid gap-10', variant === 'stacked' ? 'grid-cols-1' : 'sm:grid-cols-2')}>
        {people.map((person) => (
          <div key={person.name} className="flex flex-col items-center text-center">
            <div className="flex size-40 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--t-secondary)] bg-[var(--t-card)] p-1.5 shadow-md">
              {person.photo ? (
                <img src={person.photo} alt={person.name} className="h-full w-full rounded-full object-cover" loading="lazy" />
              ) : (
                <span className="text-5xl text-[var(--t-primary-ink)] [font-family:var(--t-script)]">{initials(person.name)}</span>
              )}
            </div>
            <h3 className="mt-5 text-2xl [font-family:var(--t-heading)]">{person.name}</h3>
            {person.parents ? <p className="mt-2 max-w-xs text-sm text-[var(--t-muted-ink)]">{person.parents}</p> : null}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

/** family / parents: blessings text block. */
export function Family(p: SectionProps) {
  const text = p.value('text');
  if (!text) return null;
  return (
    <SectionShell {...shell(p)} heading={p.value('heading') ?? p.t('template.family.title')}>
      <Paragraphs text={text} className="text-lg [font-family:var(--t-heading)] text-[var(--t-text)] sm:text-xl" />
    </SectionShell>
  );
}

/**
 * story: narrative text with an optional photo (photo.story, else the second chosen photo).
 * Variants: default, curtain (the photo waits behind velvet curtains), polaroid.
 */
export function Story(p: SectionProps) {
  const text = p.value('text');
  if (!text) return null;
  const photo = p.value('image');
  const heading = p.value('heading') ?? p.t('template.story.title');

  if (photo && p.instance.variant === 'curtain') {
    return (
      <SectionShell {...shell(p)} heading={heading}>
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
      <SectionShell {...shell(p)} heading={heading}>
        <div className="grid items-center gap-10 sm:grid-cols-2">
          <div className="bulava-tilt mx-auto w-64 -rotate-3 bg-white p-3 pb-12 shadow-[0_24px_40px_-18px_rgba(0,0,0,0.55)]">
            <img src={photo} alt="" className="aspect-square w-full object-cover" loading="lazy" />
          </div>
          <Paragraphs text={text} className="sm:text-left" />
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell {...shell(p)} heading={heading}>
      <div className={cx('grid items-center gap-8', photo && 'sm:grid-cols-2')}>
        {photo ? <img src={photo} alt="" className="w-full rounded-[var(--t-radius)] object-cover shadow-lg" loading="lazy" /> : null}
        <Paragraphs text={text} className={photo ? 'sm:text-left' : undefined} />
      </div>
    </SectionShell>
  );
}

/** accommodation / travel / giftRegistry: heading + custom text; hidden when empty. */
export function InfoBlock(p: SectionProps & { defaultHeading: string; icon: string }) {
  const text = p.value('text');
  if (!text) return null;
  return (
    <SectionShell {...shell(p)} heading={p.value('heading') ?? p.defaultHeading} tone="surface">
      <div className={cx('mx-auto max-w-xl p-6 text-center', cardClass(p.look))}>
        <div aria-hidden className="mb-3 text-3xl">
          {p.icon}
        </div>
        <Paragraphs text={text} />
      </div>
    </SectionShell>
  );
}

/** announcements: host updates visible to this viewer. */
export function Announcements(p: SectionProps) {
  const items = p.ctx.announcements ?? [];
  if (!items.length) return null;
  return (
    <SectionShell {...shell(p)} heading={p.value('heading') ?? p.t('template.announcements.title')}>
      <ul className="space-y-3">
        {items.map((a, i) => (
          <li key={i} className={cx('border-l-4 border-l-[var(--t-accent)] p-4', cardClass(p.look))}>
            <p className="font-semibold">{a.title}</p>
            <p className="mt-1 text-sm whitespace-pre-line text-[var(--t-muted-ink)]">{a.body}</p>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
