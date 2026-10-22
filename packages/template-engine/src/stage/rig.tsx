'use client';

import { useEffect } from 'react';
import { INTRO_DONE_EVENT } from './openings';
import { perspectiveOf } from './units';

/**
 * The stage hero's camera rig on the web (final.md §3.1.4): it reads only the
 * stage's DOM (`data-pose`), never set art.
 *
 *  - `.bulava-stage-rig`, the outer element: the breath is CSS (StageStyles);
 *    here the scroll dolly, translate3d(0, 0, D·u) with D growing to the set's
 *    `dolly` as the hero scrolls away (the camera walks in as the guest leaves).
 *  - `.bulava-stage-look`, the inner element: the pointer (a mouse) or the
 *    phone's tilt (Android; iOS asks permission, so it stays still) turns the
 *    view up to ±4° of yaw and ±2.5° of pitch, eased at 0.08 a frame. The pivot
 *    is the horizon point a lens-length ahead of the eye: near things slide one
 *    way, far ones the other, the subject almost still.
 *  - Off screen it pauses everything (`.bulava-stage-off`) and drops the
 *    `will-change` hints, which it sets on the two rig elements only.
 *  - It waits while a stage opening plays (`data-opening-state="playing"`, or
 *    the opening's overlay still on the page) and starts on `bulava:intro-done`.
 *  - Reduced motion: nothing moves; the rest pose is the design.
 *
 * Before any of that it checks the stage's units: where a browser cannot use
 * container units inside perspective or transforms (older iOS), it writes
 * `--u` in px on the stage box and keeps it in step with the box's size.
 */
export function StageRig({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    const stages = Array.from(root.querySelectorAll<HTMLElement>('[data-bulava-stage]')).filter((s) => s.dataset.mode === 'live' || s.dataset.mode === 'preview');
    if (!stages.length) return;
    const units = stages.map(keepUnits);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rigs = reduce ? [] : stages.map((stage) => rigOf(stage, root));
    return () => {
      for (const stop of units) stop();
      for (const rig of rigs) rig();
    };
  }, [rootId]);
  return null;
}

/**
 * The stage box's --u where container units fail: the lens's perspective should be p·u px; when it is not
 * (cq units unsupported, or not inside perspective), --u is written in px from the box and kept in step.
 * The box is measured in its own CSS px (computed sizes, as the lens's perspective is): a client rect would
 * carry an ancestor's zoom or scale (a canvas stand-in's zoom), and px written from it are zoomed again.
 */
function keepUnits(stage: HTMLElement): () => void {
  const lens = stage.querySelector<HTMLElement>('.bulava-stage-lens');
  if (!lens) return () => undefined;
  const expected = () => {
    const box = getComputedStyle(stage);
    const width = Number.parseFloat(box.width);
    const height = Number.parseFloat(box.height);
    return width > 0 && height > 0 ? Math.max(height / 800, width / 1200) : 0;
  };
  const fov = (() => {
    try {
      return Number((JSON.parse(stage.dataset.pose ?? '{}') as { fov?: number }).fov) || 60;
    } catch {
      return 60;
    }
  })();
  const unit = expected();
  if (!unit) return () => undefined;
  const measured = Number.parseFloat(getComputedStyle(lens).perspective);
  const p = perspectiveOf(fov) * unit;
  const supported = (() => {
    try {
      return CSS.supports('height', '1cqh');
    } catch {
      return false;
    }
  })();
  if (supported && Number.isFinite(measured) && Math.abs(measured - p) <= Math.max(1, p * 0.01)) return () => undefined;
  const write = () => {
    const next = expected();
    if (next) stage.style.setProperty('--u', `${Math.round(next * 100000) / 100000}px`);
  };
  write();
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(write);
  observer?.observe(stage);
  window.addEventListener('resize', write, { passive: true });
  return () => {
    observer?.disconnect();
    window.removeEventListener('resize', write);
  };
}

const MAX_YAW = 4;
const MAX_PITCH = 2.5;
const EASE = 0.08;
const clamp1 = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v);

/** One stage's rig; returns its teardown. */
function rigOf(stage: HTMLElement, root: HTMLElement): () => void {
  const rig = stage.querySelector<HTMLElement>('.bulava-stage-rig');
  const look = stage.querySelector<HTMLElement>('.bulava-stage-look');
  if (!rig || !look) return () => undefined;
  const hero = stage.closest<HTMLElement>('[data-bulava-stage-hero]') ?? stage;
  const dolly = (() => {
    try {
      return Math.max(0, Number((JSON.parse(stage.dataset.pose ?? '{}') as { dolly?: number }).dolly) || 0);
    } catch {
      return 0;
    }
  })();

  let onScreen = true;
  let active = false;
  let frame = 0;
  let target = { x: 0, y: 0 };
  let current = { x: 0, y: 0 };
  let dollyAt = Number.NaN;

  /** A stage opening still owns the camera: its state on the stage, or its overlay still on the page. */
  const held = () => stage.dataset.openingState === 'playing' || !!root.querySelector('[data-stage-opening]:not([data-done])');

  const update = () => {
    frame = 0;
    if (!active) return;
    // The scroll dolly: how far the hero has scrolled past the top, as a share of its height.
    const rect = hero.getBoundingClientRect();
    const share = rect.height ? Math.min(1, Math.max(0, -rect.top / rect.height)) : 0;
    const d = Math.round(share * dolly * 100) / 100;
    if (d !== dollyAt) {
      dollyAt = d;
      rig.style.transform = d ? `translate3d(0, 0, calc(${d} * var(--u)))` : '';
    }
    current = { x: current.x + (target.x - current.x) * EASE, y: current.y + (target.y - current.y) * EASE };
    const settled = Math.abs(target.x - current.x) < 0.002 && Math.abs(target.y - current.y) < 0.002;
    if (settled) current = { ...target };
    const yaw = Math.round(current.x * MAX_YAW * 1000) / 1000;
    const pitch = Math.round(-current.y * MAX_PITCH * 1000) / 1000;
    look.style.transform = yaw || pitch ? `rotateY(${yaw}deg) rotateX(${pitch}deg)` : '';
    if (!settled) schedule();
  };
  const schedule = () => {
    if (active && !frame) frame = requestAnimationFrame(update);
  };

  const onPointer = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    target = { x: clamp1((e.clientX / window.innerWidth - 0.5) * 2), y: clamp1((e.clientY / window.innerHeight - 0.5) * 2) };
    schedule();
  };
  const onTilt = (e: DeviceOrientationEvent) => {
    if (e.gamma === null || e.beta === null) return;
    target = { x: clamp1(e.gamma / 25), y: clamp1((e.beta - 40) / 25) };
    schedule();
  };

  const start = () => {
    if (active) return;
    active = true;
    rig.style.willChange = 'transform';
    look.style.willChange = 'transform';
    window.addEventListener('scroll', schedule, { passive: true, capture: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('deviceorientation', onTilt, { passive: true });
    schedule();
  };
  const stop = () => {
    if (!active) return;
    active = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    rig.style.willChange = '';
    look.style.willChange = '';
    window.removeEventListener('scroll', schedule, { capture: true });
    window.removeEventListener('resize', schedule);
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('deviceorientation', onTilt);
  };
  /** Run while on screen and no opening holds the camera. */
  const decide = () => {
    if (onScreen && !held()) start();
    else stop();
  };

  const io =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(
          (entries) => {
            const entry = entries[entries.length - 1];
            if (!entry) return;
            onScreen = entry.isIntersecting;
            stage.classList.toggle('bulava-stage-off', !onScreen);
            decide();
          },
          { threshold: 0 },
        );
  io?.observe(hero);
  // An opening starting or ending (its state on the stage, its overlay leaving the page).
  const mo = typeof MutationObserver === 'undefined' ? null : new MutationObserver(decide);
  mo?.observe(stage, { attributes: true, attributeFilter: ['data-opening-state'] });
  mo?.observe(root, { childList: true });
  window.addEventListener(INTRO_DONE_EVENT, decide);
  decide();

  return () => {
    stop();
    io?.disconnect();
    mo?.disconnect();
    window.removeEventListener(INTRO_DONE_EVENT, decide);
    stage.classList.remove('bulava-stage-off');
    rig.style.transform = '';
    look.style.transform = '';
  };
}
