'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent as ReactWheelEvent } from 'react';
import type { StageIntro } from '@bulava/template-schema';
import { poseTransform } from './camera';
import type { CoverMotion } from './covers3d';
import {
  DRAG_COMMIT,
  fitStart,
  idlePose,
  INTRO_DONE_EVENT,
  OPENING_DRAG,
  OPENING_MARKS,
  OPENING_MS,
  openingLight,
  openingPose,
  openingStart,
  openingState,
  viewIn,
  type CoverPieceInfo,
  type OpeningEnter,
  type StageViewBox,
} from './openings';
import type { CameraPose, Vec3 } from './types';
import { num, perspectiveOf, u } from './units';

/**
 * A stage opening on the web (final.md §3.2, §4): the overlay draws no stage.
 * It drives the hero's own server-rendered DOM by selector (the world's
 * camera, the lens, the hidden cover pieces by id), so there is one stage on
 * the page and the opening lands EXACTLY on the hero's rest pose: at the end
 * every element it touched gets back the server's own inline style.
 *
 * First paint is an opaque layer with the medallion, as every opening shows.
 * After hydration the opening sets the cover up in the hero (start pose, cover
 * shown, the set unbuilt, the words hidden) and fades that layer away over
 * 300 ms; the overlay stays as a transparent button that takes a tap, Enter or
 * Space, a drag (each opening scrubs part of the way with the finger and
 * finishes when let go past a third of it) or a scroll of the wheel. Set art
 * never enters this module: it reads `data-pose`, `data-at` and the cover's
 * hinge lines (the plan the server computed).
 */

/** What the server knows of a page's stage opening (renderer.tsx): plain data for the client. */
export interface StageOpeningPlan {
  /** Light inks over the stage (STAGE_META.dark): the first paint is the primary colour, else the page's background. */
  dark: boolean;
  /** The cover's hinge lines (covers3d's coverMotion for the set). */
  motion: CoverMotion;
  /** The cover's half-width and plane: on wide screens the start comes close enough for it to fill them. */
  fit?: { half: number; z: number };
  /** The set's key light: the colour of the light that floods through as the cover opens. */
  light: string;
  /** The set's walls, ceilings and hung pieces that wait off the picture while their ends are on screen (covers3d's enterOf). */
  enter?: OpeningEnter;
}

export interface StageOpeningProps {
  variant: StageIntro;
  /** The page's root (#rootId): the hero is found under it. */
  rootId: string;
  /** Whether it plays (set after hydration, never for reduced motion or a second visit): nothing touches the hero before. */
  active: boolean;
  plan: StageOpeningPlan;
  /** The hint ("Tap to open the doors") and the button's accessible name. */
  label: string;
  /** The first paint's medallion (the overlay's own, as every opening). */
  medallion: ReactNode;
  /** The guest's first gesture that may start sound (pointer up, Enter, Space). */
  onGesture: () => void;
  /** The opening has landed on the rest pose: the overlay goes. */
  onOpen: () => void;
  /** No stage to open on (the hero was redrawn without it): the overlay plays the 2D twin. */
  onFallback: () => void;
}

const BUILD_CLEAR_MS = 2500;
const SPRING_MS = 420;
const READY_MS = 300;
/** The most one frame may move an opening on (ms). */
const MAX_FRAME_MS = 100;

type Phase = 'idle' | 'drag' | 'wheel' | 'spring' | 'play' | 'done';

interface Controller {
  down(x: number, y: number): void;
  move(x: number, y: number): void;
  up(): void;
  cancel(): void;
  wheel(delta: number): void;
  commit(): void;
  dispose(): void;
}

interface CoverEl {
  el: HTMLElement;
  info: CoverPieceInfo;
  /** The server's opacity (sheer silk): multiplied into every frame's. */
  base: number;
  style: string | null;
  transform: string;
  opacity: string;
  visible: boolean;
}

const parseAt = (s: string | undefined): Vec3 | undefined => {
  if (!s) return undefined;
  const [x, y, z] = s.split(',').map(Number);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ? { x: x!, y: y!, z: z! } : undefined;
};

const isPose = (p: unknown): p is CameraPose =>
  !!p && typeof p === 'object' && (['x', 'y', 'z', 'yaw', 'pitch', 'roll', 'fov'] as const).every((k) => Number.isFinite((p as Record<string, unknown>)[k]));

/** The set's poses as the hero wrote them (`data-pose`). */
function posesFrom(stage: HTMLElement): { rest: CameraPose; far: CameraPose } | null {
  try {
    const data = JSON.parse(stage.dataset.pose ?? '') as { rest?: unknown; far?: unknown };
    return isPose(data.rest) && isPose(data.far) ? { rest: data.rest, far: data.far } : null;
  } catch {
    return null;
  }
}

/** The screen's half-width in stage units (the stage box's --u is max(h/800, w/1200)). */
function halfWidthOf(stage: HTMLElement): number | null {
  const box = stage.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return null;
  return box.width / 2 / Math.max(box.height / 800, box.width / 1200);
}

/** The stage box in stage units (what the entering planes are judged on). */
function viewOf(stage: HTMLElement): StageViewBox {
  const box = stage.getBoundingClientRect();
  return box.width < 1 || box.height < 1 ? { w: 1200, h: 800 } : viewIn(box.width, box.height);
}

/** A set piece that waits off the picture while the opening plays (its own opacity multiplied in). */
interface EnterEl {
  id: string;
  el: HTMLElement;
  base: number;
  opacity: string;
}

const ease = (t: number) => 1 - (1 - t) ** 3;
const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

/**
 * The opening's engine, imperative on purpose: one requestAnimationFrame loop
 * writes the hero's DOM directly (no React renders per frame).
 */
function createController(o: {
  kind: StageIntro;
  rootId: string;
  plan: StageOpeningPlan;
  overlay: HTMLElement | null;
  dim: HTMLElement | null;
  glow: HTMLElement | null;
  onReady: () => void;
  onStarted: () => void;
  onDone: () => void;
}): Controller | null {
  const root = document.getElementById(o.rootId);
  const hero = root?.querySelector<HTMLElement>('[data-bulava-stage-hero]');
  const stage = hero?.querySelector<HTMLElement>('[data-bulava-stage]');
  if (!hero || !stage || stage.dataset.opening !== o.kind) return null;
  const world = stage.querySelector<HTMLElement>('.bulava-stage-world');
  const lens = stage.querySelector<HTMLElement>('.bulava-stage-lens');
  const rig = stage.querySelector<HTMLElement>('.bulava-stage-rig');
  const look = stage.querySelector<HTMLElement>('.bulava-stage-look');
  const poses = posesFrom(stage);
  const coverNodes = world ? Array.from(world.querySelectorAll<HTMLElement>('[data-cover]')) : [];
  if (!world || !lens || !rig || !look || !poses || !coverNodes.length) return null;

  const kind = o.kind;
  const set = { poses };
  const words = hero.querySelector<HTMLElement>('[data-stage-words]');
  const veil = hero.querySelector<HTMLElement>('.bulava-stage-veil');
  const saved = new Map<HTMLElement, string | null>();
  for (const el of [world, lens, rig, look, veil]) if (el) saved.set(el, el.getAttribute('style'));
  const covers: CoverEl[] = coverNodes.map((el) => {
    const at = parseAt(el.dataset.at);
    const info: CoverPieceInfo = {
      id: el.dataset.piece ?? '',
      kind: el.classList.contains('bulava-light') ? 'light' : at ? 'prop' : 'plane',
      ...(at ? { at } : {}),
      placement: el.style.transform,
      fades: el.hasAttribute('data-fade'),
    };
    const base = el.style.opacity === '' ? 1 : Number(el.style.opacity);
    return { el, info, base: Number.isFinite(base) ? base : 1, style: el.getAttribute('style'), transform: '', opacity: '', visible: false };
  });
  const infos = covers.map((c) => c.info);
  // The set's planes that wait off the picture while their front ends are on screen, and its hung pieces with them.
  const enter = o.plan.enter;
  const entering: EnterEl[] = [];
  for (const id of enter ? [...enter.edges.map((e) => e.id), ...enter.hangs] : []) {
    const el = world.querySelector<HTMLElement>(`[data-piece="${id}"]:not([data-cover])`);
    if (!el) continue;
    saved.set(el, el.getAttribute('style'));
    const base = el.style.opacity === '' ? 1 : Number(el.style.opacity);
    entering.push({ id, el, base: Number.isFinite(base) ? base : 1, opacity: el.style.opacity });
  }
  let view = viewOf(stage);
  const marks = OPENING_MARKS[kind];
  const drag = OPENING_DRAG[kind];
  const commitAt = drag.max * DRAG_COMMIT;

  const startOf = (): CameraPose => {
    const start = openingStart(kind, set);
    const half = o.plan.fit ? halfWidthOf(stage) : null;
    return o.plan.fit && half ? fitStart(start, o.plan.fit, half) : start;
  };
  let start = startOf();
  let fov = '';

  let phase: Phase = 'idle';
  let q = 0; // what is drawn
  let target = 0; // where the finger or the wheel wants it
  let from = { q: 0, at: 0 }; // where a spring back began
  let pointer: { x: number; y: number; q: number; moved: boolean } | null = null;
  let wheelAcc = 0;
  let wheelTimer = 0;
  let built = false;
  let typed = false;
  let started = false;
  let frame = 0;
  let disposed = false;
  const shown = performance.now();
  let last = shown;

  const write = (now: number) => {
    const t = (now - shown) / 1000;
    const pose = idlePose(openingPose(kind, q, start, poses.rest), t, q);
    const st = openingState(kind, q, set, { covers: { pieces: infos, motion: o.plan.motion, ...(enter ? { enter } : {}) }, pose, view });
    world.style.transform = poseTransform(pose);
    const f = num(pose.fov);
    if (f !== fov) {
      fov = f;
      lens.style.perspective = u(perspectiveOf(pose.fov));
    }
    for (const c of covers) {
      const s = st.pieces[c.info.id];
      if (!s) continue;
      const opacity = (s.opacity ?? 1) * c.base;
      const visible = opacity > 0.002;
      if (visible !== c.visible) {
        c.visible = visible;
        c.el.style.visibility = visible ? 'visible' : 'hidden';
      }
      if (!visible) continue;
      if (s.transform && s.transform !== c.transform) {
        c.transform = s.transform;
        c.el.style.transform = s.transform;
      }
      const op = opacity >= 0.999 ? '' : fmt(opacity);
      if (op !== c.opacity) {
        c.opacity = op;
        c.el.style.opacity = op;
      }
    }
    for (const e of entering) {
      const fade = st.pieces[e.id]?.opacity ?? 1;
      const op = fade >= 0.999 ? (e.base < 1 ? fmt(e.base) : '') : fmt(fade * e.base);
      if (op !== e.opacity) {
        e.opacity = op;
        e.el.style.opacity = op;
      }
    }
    const light = openingLight(kind, q);
    if (o.dim) o.dim.style.opacity = fmt(light.dim);
    if (o.glow) {
      o.glow.style.opacity = fmt(light.glow);
      o.glow.style.transform = light.spread === 1 ? '' : `scale(${fmt(light.spread)}, 1)`;
    }
    if (veil) veil.style.opacity = fmt(light.veil);
    if (phase === 'play') {
      if (!built && q >= marks.build) {
        built = true;
        stage.classList.remove('bulava-unbuilt');
        stage.classList.add('bulava-build');
        // Outlives the overlay on purpose: the set finishes building after the opening is gone.
        window.setTimeout(() => stage.classList.remove('bulava-build'), BUILD_CLEAR_MS);
      }
      if (!typed && q >= marks.type) {
        typed = true;
        words?.classList.remove('bulava-type-pre');
        words?.classList.add('bulava-type');
      }
    }
    if (!started && (q > 0.03 || phase === 'play')) {
      started = true;
      o.onStarted();
    }
  };

  /** Every element back to the server's own style (the covers hidden again), the classes and state gone. */
  const restore = (opened: boolean) => {
    for (const [el, style] of saved) {
      if (style === null) el.removeAttribute('style');
      else el.setAttribute('style', style);
    }
    for (const c of covers) {
      if (c.style === null) c.el.removeAttribute('style');
      else c.el.setAttribute('style', c.style);
      // Gone from the page once opened (the camera has passed them); hidden as the server drew them otherwise.
      if (opened) c.el.style.display = 'none';
    }
    stage.classList.remove('bulava-unbuilt');
    if (!opened) stage.classList.remove('bulava-build');
    stage.removeAttribute('data-opening-state');
    words?.classList.remove('bulava-type-pre');
    if (opened) words?.classList.add('bulava-type');
  };

  const finish = () => {
    phase = 'done';
    q = 1;
    if (!built) {
      built = true;
      stage.classList.add('bulava-build');
      window.setTimeout(() => stage.classList.remove('bulava-build'), BUILD_CLEAR_MS);
    }
    restore(true);
    o.overlay?.closest('[data-stage-opening]')?.setAttribute('data-done', '');
    window.dispatchEvent(new CustomEvent(INTRO_DONE_EVENT, { detail: { opening: kind } }));
    o.onDone();
  };

  const tick = (now: number) => {
    frame = 0;
    if (disposed || phase === 'done') return;
    // A stalled frame (a hidden tab, a busy phone) slows the opening rather than skipping it.
    const dt = Math.max(0, Math.min(MAX_FRAME_MS, now - last));
    last = now;
    if (phase === 'play') {
      q = Math.min(1, q + dt / OPENING_MS[kind]);
      if (q >= 1) return finish();
    } else if (phase === 'spring') {
      const k = Math.min(1, (now - from.at) / SPRING_MS);
      q = from.q * (1 - ease(k));
      if (k >= 1) {
        q = 0;
        phase = 'idle';
      }
    } else if (phase === 'drag' || phase === 'wheel') {
      // The drawing follows the finger with a little weight.
      q += (target - q) * 0.35;
      if (Math.abs(target - q) < 0.0005) q = target;
    }
    write(now);
    frame = requestAnimationFrame(tick);
  };

  const play = () => {
    if (phase === 'play' || phase === 'done') return;
    window.clearTimeout(wheelTimer);
    pointer = null;
    // From wherever the finger left it, on at the opening's own pace (OPENING_MS for the whole way).
    phase = 'play';
  };
  const springBack = () => {
    phase = 'spring';
    from = { q, at: performance.now() };
  };

  /** The scrub a drag of (dx, dy) px reaches, from where the drag began. */
  const scrub = (dx: number, dy: number, q0: number) => {
    const w = window.innerWidth || 390;
    const h = window.innerHeight || 844;
    const reach = drag.axis === 'up' ? Math.max(0, -dy) / (drag.reach * h) : Math.abs(dx) / (drag.reach * w);
    return Math.min(drag.max, q0 + Math.min(1, reach) * drag.max);
  };

  const onResize = () => {
    view = viewOf(stage);
    if (phase === 'idle') start = startOf();
  };

  // Set the cover up in the hero, under the first paint's opaque layer.
  stage.setAttribute('data-opening-state', 'playing');
  stage.classList.add('bulava-unbuilt');
  words?.classList.add('bulava-type-pre');
  // The two rig elements carry the hint while the camera flies (the rig takes them over afterwards): no re-raster per frame.
  rig.style.willChange = 'transform';
  look.style.willChange = 'transform';
  write(shown);
  window.addEventListener('resize', onResize, { passive: true });
  // Two frames: the start state is on screen before the layer starts to clear.
  frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame((now) => {
      if (disposed) return;
      o.onReady();
      tick(now);
    });
  });

  return {
    down(x, y) {
      if (phase === 'play' || phase === 'done') return;
      window.clearTimeout(wheelTimer);
      pointer = { x, y, q, moved: false };
    },
    move(x, y) {
      const p = pointer;
      if (!p || phase === 'play' || phase === 'done') return;
      const dx = x - p.x;
      const dy = y - p.y;
      if (!p.moved && Math.hypot(dx, dy) < 6) return;
      p.moved = true;
      phase = 'drag';
      target = scrub(dx, dy, p.q);
    },
    up() {
      const p = pointer;
      pointer = null;
      // Only a release of a press made here counts (a right click's or one pressed elsewhere is not a tap).
      if (!p || phase === 'play' || phase === 'done') return;
      // A tap, or a drag let go past a third of its scrub, opens it; a shorter drag springs back.
      if (!p.moved || target >= commitAt) play();
      else springBack();
    },
    cancel() {
      if (!pointer) return;
      pointer = null;
      if (phase === 'drag') springBack();
    },
    wheel(delta) {
      if (phase === 'play' || phase === 'done' || pointer) return;
      wheelAcc = Math.max(0, wheelAcc + delta);
      phase = 'wheel';
      const h = window.innerHeight || 844;
      target = Math.min(drag.max, (Math.min(1, wheelAcc / (drag.reach * h)) || 0) * drag.max);
      window.clearTimeout(wheelTimer);
      if (target >= commitAt) play();
      else
        wheelTimer = window.setTimeout(() => {
          wheelAcc = 0;
          if (phase === 'wheel') springBack();
        }, 280);
    },
    commit: play,
    dispose() {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(wheelTimer);
      window.removeEventListener('resize', onResize);
      if (phase !== 'done') restore(false);
    },
  };
}

/** Which way the hint's arrows point: up for the gate and the silk, outward for the doors and the card. */
function Cue({ axis }: { axis: 'up' | 'side' }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {axis === 'up' ? <path d="M6 14l6-6 6 6M6 19l6-6 6 6" opacity="0.9" /> : <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" />}
    </svg>
  );
}

const rgb = (hex: string): string => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.replace(/(.)/g, '$1$1') : h.slice(0, 6);
  const n = Number.parseInt(full, 16);
  return Number.isFinite(n) ? `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}` : '255, 220, 160';
};

/** The house lights: a vignette and a veil of shade, lifted as the cover opens. */
const dimOf = (dark: boolean) =>
  dark
    ? 'radial-gradient(ellipse 78% 68% at 50% 54%, rgba(4, 3, 8, 0) 42%, rgba(4, 3, 8, 0.62) 100%), linear-gradient(rgba(4, 3, 8, 0.16), rgba(4, 3, 8, 0.16))'
    : 'radial-gradient(ellipse 80% 70% at 50% 54%, rgba(40, 24, 12, 0) 46%, rgba(40, 24, 12, 0.34) 100%), linear-gradient(rgba(40, 24, 12, 0.06), rgba(40, 24, 12, 0.06))';

/** The light that floods through as the cover parts (plain alpha with a hot core, never a blend mode). */
function glowOf(kind: StageIntro, color: string): string {
  const c = rgb(color);
  // Scaled across by openingLight's `spread` as the cover parts (the doorway's starts as a blade of light at the seam).
  const shape = { arrival: 'ellipse 62% 48% at 50% 57%', doorway: 'ellipse 24% 60% at 50% 54%', silk: 'ellipse 95% 60% at 50% 42%', unfold: 'ellipse 48% 40% at 50% 58%' }[kind];
  return `radial-gradient(${shape}, rgba(255, 248, 228, 0.9) 0%, rgba(${c}, 0.55) 26%, rgba(${c}, 0.18) 52%, rgba(${c}, 0) 74%)`;
}

export function StageOpening({ variant, rootId, active, plan, label, medallion, onGesture, onOpen, onFallback }: StageOpeningProps) {
  const self = useRef<HTMLDivElement>(null);
  const dim = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const ctl = useRef<Controller | null>(null);
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState(true);
  // The latest callbacks and plan, read by the controller (a new plan object must not restart an opening).
  const latest = useRef({ plan, onOpen, onFallback });
  latest.current = { plan, onOpen, onFallback };

  useEffect(() => {
    if (!active) return;
    const controller = createController({
      kind: variant,
      rootId,
      plan: latest.current.plan,
      overlay: self.current,
      dim: dim.current,
      glow: glow.current,
      onReady: () => setReady(true),
      onStarted: () => setHint(false),
      onDone: () => latest.current.onOpen(),
    });
    if (!controller) {
      latest.current.onFallback();
      return;
    }
    ctl.current = controller;
    return () => {
      ctl.current = null;
      controller.dispose();
    };
  }, [variant, rootId, active]);

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    ctl.current?.down(e.clientX, e.clientY);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* the pointer is already gone */
    }
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => ctl.current?.move(e.clientX, e.clientY);
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    // As `down`: a mouse's other buttons (a right click opening the menu) neither open it nor start the music.
    if (!ctl.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    // Pointer up is a user activation on touch screens too: the music may start here.
    onGesture();
    ctl.current.up();
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onGesture();
    ctl.current?.commit();
  };
  // Lines (deltaMode 1) or pages (2) as pixels, roughly.
  const wheel = (e: ReactWheelEvent<HTMLDivElement>) => ctl.current?.wheel(e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight || 800 : 1));
  const axis = OPENING_DRAG[variant].axis;

  return (
    <div ref={self} className="absolute inset-0">
      <div ref={dim} aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: dimOf(plan.dark), opacity: 0 }} />
      <div ref={glow} aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: glowOf(variant, plan.light), opacity: 0 }} />
      {/* First paint (and pages without JavaScript): the invitation closed, as every opening shows it. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center transition-opacity ease-out ${plan.dark ? 'text-[var(--t-on-primary)]' : 'text-[var(--t-primary-ink)]'}`}
        style={{
          background: `radial-gradient(circle at 50% 46%, color-mix(in srgb, var(--t-accent) 16%, transparent), transparent 62%), ${plan.dark ? 'var(--t-primary)' : 'var(--t-bg)'}`,
          opacity: ready ? 0 : 1,
          transitionDuration: `${READY_MS}ms`,
        }}
      >
        {medallion}
        <span className="mt-6 bulava-breathe text-sm tracking-[0.3em] uppercase">{label}</span>
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        className="group absolute inset-0 cursor-pointer touch-none select-none outline-none"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => ctl.current?.cancel()}
        onKeyDown={key}
        onWheel={wheel}
      >
        <span className="pointer-events-none absolute inset-x-0 bottom-[max(4.5%,1.75rem)] flex justify-center px-6 transition-opacity duration-500" style={{ opacity: ready && hint ? 1 : 0 }}>
          <span className="bulava-breathe">
            <span className="inline-flex items-center gap-2 rounded-full bg-black/45 px-4 py-1.5 text-center text-xs font-semibold tracking-[0.26em] text-white uppercase shadow-[0_8px_28px_-10px_rgba(0,0,0,0.7)] ring-1 ring-white/25 group-focus-visible:ring-2 group-focus-visible:ring-white">
              <Cue axis={axis} />
              {label}
            </span>
          </span>
        </span>
      </div>
    </div>
  );
}
