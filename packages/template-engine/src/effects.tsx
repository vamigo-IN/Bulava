'use client';

import { useEffect, useRef } from 'react';
import type { EffectName, ThemeColors } from '@bulava/template-schema';

/**
 * Ambient particles over a live invitation: rose petals, marigold petals,
 * rising gold dust, fireflies, confetti, sky lanterns or snow. One canvas,
 * a modest particle count, device-pixel ratio capped for older phones, paused
 * while the tab is hidden, and nothing at all for reduced-motion users.
 * The canvas ignores pointer events and is hidden from assistive technology.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  phase: number;
  color: string;
}

const MARIGOLD = ['#ffb300', '#ff8f00', '#f57c00', '#ffd54f'];

export function Effects({ effect, colors, contained = false }: { effect: EffectName; colors: ThemeColors; contained?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el || effect === 'none' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0;
    let h = 0;
    // Contained (design previews): fill the first screen of the preview, not the whole app window.
    const resize = () => {
      const box = contained ? el.parentElement?.getBoundingClientRect() : null;
      w = box ? box.width : window.innerWidth;
      h = box ? box.height : window.innerHeight;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const small = w < 640;
    const count = { petals: 22, marigold: 26, goldDust: 46, fireflies: 22, confetti: 40, lanterns: 6, snow: 50, none: 0 }[effect] * (small ? 0.7 : 1);
    const palette =
      effect === 'petals'
        ? [colors.primary, colors.secondary, '#f8bbd0', '#f48fb1']
        : effect === 'marigold'
          ? MARIGOLD
          : effect === 'confetti'
            ? [colors.primary, colors.secondary, colors.accent, '#ffffff']
            : effect === 'fireflies'
              ? ['#fff59d', '#e6ee9c']
              : effect === 'snow'
                ? ['#ffffff']
                : [colors.accent, '#ffe7a3'];

    const rising = effect === 'goldDust' || effect === 'lanterns' || effect === 'fireflies';
    const spawn = (initial: boolean): Particle => {
      const size =
        effect === 'lanterns' ? 10 + Math.random() * 8 : effect === 'goldDust' ? 1 + Math.random() * 2.2 : effect === 'fireflies' ? 1.5 + Math.random() * 2 : effect === 'snow' ? 1.5 + Math.random() * 2.5 : 5 + Math.random() * 6;
      return {
        x: Math.random() * w,
        y: initial ? Math.random() * h : rising ? h + 20 : -20,
        vx: (Math.random() - 0.5) * (effect === 'fireflies' ? 0.5 : 0.35),
        vy: rising ? -(0.2 + Math.random() * (effect === 'lanterns' ? 0.45 : 0.5)) : 0.5 + Math.random() * 0.9,
        size,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.04,
        phase: Math.random() * Math.PI * 2,
        color: palette[Math.floor(Math.random() * palette.length)]!,
      };
    };
    const particles = Array.from({ length: Math.round(count) }, () => spawn(true));

    const draw = (p: Particle, t: number) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      switch (effect) {
        case 'petals':
        case 'marigold': {
          ctx.rotate(p.rot);
          ctx.scale(1, 0.55 + 0.45 * Math.sin(t * 0.002 + p.phase));
          ctx.fillStyle = p.color;
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * (effect === 'petals' ? 0.62 : 0.45), 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'confetti': {
          ctx.rotate(p.rot);
          ctx.scale(1, Math.sin(t * 0.004 + p.phase));
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          break;
        }
        case 'lanterns': {
          ctx.globalAlpha = 0.8;
          const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 2.4);
          glow.addColorStop(0, 'rgba(255,200,110,0.55)');
          glow.addColorStop(1, 'rgba(255,160,60,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(-p.size * 2.4, -p.size * 2.4, p.size * 4.8, p.size * 4.8);
          const body = ctx.createLinearGradient(0, -p.size, 0, p.size);
          body.addColorStop(0, '#ffe29a');
          body.addColorStop(1, '#ff9f43');
          ctx.fillStyle = body;
          ctx.beginPath();
          ctx.roundRect(-p.size * 0.6, -p.size * 0.8, p.size * 1.2, p.size * 1.6, p.size * 0.35);
          ctx.fill();
          break;
        }
        default: {
          const twinkle = effect === 'fireflies' || effect === 'goldDust' ? 0.35 + 0.65 * Math.abs(Math.sin(t * 0.0025 + p.phase)) : 0.9;
          ctx.globalAlpha = twinkle;
          if (effect !== 'snow') {
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.size * 4;
          }
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    };

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(48, now - last) / 16.7;
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        const sway = effect === 'fireflies' ? Math.sin(now * 0.001 + p.phase) * 0.6 : Math.sin(now * 0.0012 + p.phase) * 0.45;
        p.x += (p.vx + sway) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const out = rising ? p.y < -40 : p.y > h + 40;
        if (out || p.x < -60 || p.x > w + 60) particles[i] = spawn(false);
        draw(p, now);
      }
      frame = requestAnimationFrame(tick);
    };
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [effect, colors, contained]);

  if (effect === 'none') return null;
  if (contained) {
    return (
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 h-[760px] overflow-hidden" aria-hidden="true">
        <canvas ref={canvas} className="h-full w-full" />
      </div>
    );
  }
  return <canvas ref={canvas} aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 h-full w-full" />;
}
