'use client';

import { CalendarHeart, CheckCircle2, Eye } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useRef, type ReactNode } from 'react';
import type { TemplateDefinition } from '@bulava/template-schema';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

/** Only for a template without a pre-rendered preview: the template engine loads with it. */
const LiveScreen = dynamic(() => import('./live-template').then((m) => m.LiveScreen));

/** Inner width of the hero phone's screen (the 284 px frame minus its 7 px borders). */
const SCREEN_WIDTH = 270;

export interface HeroChips {
  opened: string;
  rsvp: string;
  event: string;
}

/** A glass notification floating at its own depth; it pops in, then bobs gently. */
function Chip({ icon, text, className, depth, delay }: { icon: ReactNode; text: string; className: string; depth: number; delay: number }) {
  return (
    <div className={`absolute z-20 hidden sm:block ${className}`} style={{ transform: `translateZ(${depth}px)` }} aria-hidden="true">
      <div data-chip data-depth={depth}>
        <div className="animate-pop-in" style={{ animationDelay: `${delay}s` }}>
          <div
            className="flex animate-float-slow items-center gap-3 rounded-2xl border border-white/10 bg-night-800/90 py-2.5 pr-4 pl-2.5 text-[13px] font-medium whitespace-nowrap text-ivory shadow-[0_24px_48px_-16px_rgba(0,0,0,0.9)] backdrop-blur-md"
            style={{ animationDelay: `-${(depth / 45).toFixed(1)}s` }}
          >
            <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-b from-gold-200 to-gold-300 text-night-900">{icon}</span>
            {text}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The homepage's 3D stage: a phone playing a real invitation (a pre-rendered
 * long preview, or the live template when there is none; it scrolls itself
 * and pauses while the visitor looks), two more designs fanned out
 * behind it, and glass "what happens next" chips floating at different depths.
 * The rig leans toward the pointer and drifts on scroll. It is lit by a soft
 * radial glow and a floor shadow rather than a panel, so it has no edges. The
 * entrance is pure CSS (it plays from the first paint, before hydration); all
 * motion stops for reduced-motion visitors.
 */
export function HeroStage({
  name,
  image,
  definition,
  eventType,
  back,
  chips,
  liveLabel,
}: {
  name: string;
  /** The pre-rendered long preview (lib/template-previews); `width` and `height` are its CSS size. */
  image?: { src: string; width: number; height: number } | null;
  /** Rendered live only when there is no image. */
  definition?: TemplateDefinition | null;
  eventType: string;
  back: [ReactNode, ReactNode];
  chips: HeroChips;
  liveLabel: string;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const rig = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);

  // Drift as the hero scrolls away: the rig tips back, the chips rise at their own speeds.
  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const q = gsap.utils.selector(stage);
      const drift = gsap.timeline({ scrollTrigger: { trigger: stage.current, start: 'top top', end: 'bottom top', scrub: 0.8 } });
      drift.to(q('[data-rig-scroll]'), { y: -60, rotateX: 8, ease: 'none' }, 0);
      for (const chip of q('[data-chip]')) drift.to(chip, { y: -Number((chip as HTMLElement).dataset.depth ?? 100) * 0.7, ease: 'none' }, 0);
    },
    { scope: stage },
  );

  // Lean toward the pointer: CSS variables on the rig, no React render per move.
  useEffect(() => {
    const el = rig.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth) * 2 - 1));
        const y = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight) * 2 - 1));
        el.style.setProperty('--tilt-y', `${(-8 + x * 9).toFixed(2)}deg`);
        el.style.setProperty('--tilt-x', `${(3 - y * 6).toFixed(2)}deg`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  // Slow auto-scroll through the invitation, pausing at the end; paused while the visitor interacts.
  useEffect(() => {
    const el = screen.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    let hold = 120;
    let paused = false;
    const pause = () => (paused = true);
    const resume = () => (paused = false);
    const tick = () => {
      if (!paused && !document.hidden) {
        if (hold > 0) hold--;
        else if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
          hold = 150;
          el.scrollTo({ top: 0, behavior: 'smooth' });
        } else el.scrollTop += 0.6;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    el.addEventListener('pointerenter', pause);
    el.addEventListener('pointerleave', resume);
    el.addEventListener('focusin', pause);
    el.addEventListener('focusout', resume);
    el.addEventListener('touchstart', pause, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointerenter', pause);
      el.removeEventListener('pointerleave', resume);
      el.removeEventListener('focusin', pause);
      el.removeEventListener('focusout', resume);
      el.removeEventListener('touchstart', pause);
    };
  }, []);

  return (
    // --s scales the 620×660 rig to the column: phones get the whole stage, never a cropped box.
    <div
      ref={stage}
      className="relative mx-auto h-[calc(660px*var(--s))] w-full max-w-[620px] [--s:0.6] min-[420px]:[--s:0.66] sm:[--s:0.84] lg:[--s:0.74] xl:[--s:0.92] 2xl:[--s:1]"
    >
      {/* Light, not a box: a warm glow behind the phones and their shadow on the floor. */}
      <div aria-hidden="true" className="pointer-events-none absolute top-[46%] left-1/2 aspect-square w-[118%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(227,197,133,0.24),rgba(155,44,53,0.16)_45%,transparent_72%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-[2%] left-1/2 h-10 w-[58%] -translate-x-1/2 rounded-[50%] bg-black/70 blur-2xl" />

      <div className="absolute top-0 left-1/2 h-[660px] w-[620px] origin-top -translate-x-1/2 scale-[var(--s)] [perspective:1800px]">
        <div data-rig-scroll className="h-full w-full [transform-style:preserve-3d]">
          <div
            ref={rig}
            className="relative h-full w-full transition-transform duration-700 ease-out [transform-style:preserve-3d]"
            style={{ transform: 'rotateY(var(--tilt-y, -8deg)) rotateX(var(--tilt-x, 3deg))' }}
          >
            {/* Two more designs fanned out behind. */}
            <div aria-hidden="true" className="absolute top-20 left-2 [transform:translateZ(-190px)_rotateY(24deg)_rotate(-5deg)]">
              <div className="animate-slide-in-left brightness-[0.8]" style={{ animationDelay: '0.35s' }}>
                {back[0]}
              </div>
            </div>
            <div aria-hidden="true" className="absolute top-20 right-2 [transform:translateZ(-190px)_rotateY(-24deg)_rotate(5deg)]">
              <div className="animate-slide-in-right brightness-[0.8]" style={{ animationDelay: '0.4s', animationDuration: '1.1s' }}>
                {back[1]}
              </div>
            </div>

            {/* The live invitation. */}
            <div className="absolute top-6 left-1/2 z-10 -translate-x-1/2 [transform:translateZ(70px)]">
              <div className="animate-rise-in" style={{ animationDelay: '0.1s' }}>
                <div
                  className="absolute -top-11 left-1/2 flex -translate-x-1/2 animate-fade-in-up items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] whitespace-nowrap text-gold-200 uppercase backdrop-blur-md"
                  style={{ animationDelay: '0.9s' }}
                >
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                  </span>
                  {liveLabel}
                </div>
                <div className="phone-frame shadow-[0_60px_90px_-30px_rgba(0,0,0,0.85),0_0_0_1px_rgba(227,197,133,0.25),0_0_70px_-12px_rgba(227,197,133,0.35)]" style={{ width: 284, height: 580 }}>
                  <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-br from-white/15 via-transparent to-transparent" aria-hidden="true" />
                  <div
                    ref={screen}
                    data-lenis-prevent
                    className="relative h-full w-full overflow-y-auto overscroll-contain bg-white [scrollbar-width:none]"
                    // A scrollable area keyboard users can focus. ARIA allows a label on a group, not on a plain
                    // div; a group (not a region landmark) so its name cannot clash with the page's sections.
                    role="group"
                    tabIndex={0}
                    aria-label={`${liveLabel}: ${name}`}
                  >
                    {image ? (
                      <img
                        src={image.src}
                        alt=""
                        width={SCREEN_WIDTH}
                        height={Math.round((image.height * SCREEN_WIDTH) / image.width)}
                        decoding="async"
                        className="block h-auto w-full"
                      />
                    ) : definition ? (
                      <LiveScreen definition={definition} eventType={eventType} />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <Chip depth={150} delay={1.0} className="top-[128px] -left-2" icon={<Eye className="size-4" aria-hidden />} text={chips.opened} />
            <Chip depth={190} delay={1.2} className="right-[-2px] bottom-[214px]" icon={<CheckCircle2 className="size-4" aria-hidden />} text={chips.rsvp} />
            <Chip depth={120} delay={1.4} className="bottom-[84px] left-0" icon={<CalendarHeart className="size-4" aria-hidden />} text={chips.event} />
          </div>
        </div>
      </div>
    </div>
  );
}
