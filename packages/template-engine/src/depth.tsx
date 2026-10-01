'use client';

import { useEffect } from 'react';

/**
 * Brings illustrated scenes to life: every [data-depth] layer inside a
 * [data-bulava-scene] moves at its own speed as the page scrolls (far layers
 * lag behind, near ones keep pace) and shifts with the pointer or the phone's
 * tilt (near layers move most). Together that reads as depth.
 *
 * One passive listener set per page, work only inside requestAnimationFrame
 * and only for scenes on screen. Nothing runs for reduced-motion users.
 */
export function DepthScene({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const scenes = Array.from(root.querySelectorAll<HTMLElement>('[data-bulava-scene]'));
    if (!scenes.length) return;
    const layers = scenes.flatMap((scene) =>
      Array.from(scene.querySelectorAll<HTMLElement>('[data-depth]')).map((el) => ({ el, scene, depth: Math.min(1, Math.max(0, Number(el.dataset.depth) || 0)) })),
    );

    let target = { x: 0, y: 0 };
    let current = { x: 0, y: 0 };
    let frame = 0;

    const update = () => {
      frame = 0;
      current = { x: current.x + (target.x - current.x) * 0.08, y: current.y + (target.y - current.y) * 0.08 };
      const vh = window.innerHeight;
      for (const layer of layers) {
        const rect = layer.scene.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > vh) continue;
        const scrolled = Math.max(0, -rect.top);
        const lag = scrolled * (1 - layer.depth) * 0.42;
        const x = current.x * layer.depth * 22;
        const y = current.y * layer.depth * 12;
        layer.el.style.transform = `translate3d(${x.toFixed(2)}px, ${(lag + y).toFixed(2)}px, 0)`;
      }
      if (Math.abs(target.x - current.x) > 0.002 || Math.abs(target.y - current.y) > 0.002) schedule();
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      target = { x: clamp((e.clientX / window.innerWidth - 0.5) * 2), y: clamp((e.clientY / window.innerHeight - 0.5) * 2) };
      schedule();
    };
    // Android reports orientation without a permission prompt; iOS needs one, so it simply stays still there.
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || e.beta === null) return;
      target = { x: clamp(e.gamma / 25), y: clamp((e.beta - 40) / 25) };
      schedule();
    };

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('deviceorientation', onTilt, { passive: true });
    schedule();
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('deviceorientation', onTilt);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [rootId]);
  return null;
}
