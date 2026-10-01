'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Smooth, inertial scrolling for marketing pages only (never the dashboard or
 * guest pages, where it would fight scrollable panels and forms). Lenis runs on
 * GSAP's ticker so scroll-linked animations stay in step. Anchor links scroll
 * smoothly and stop below the header. Nested scroll areas (phone previews) keep
 * their own scrolling. Off with reduced motion.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // Scrollable panels inside the page (template previews) scroll on their own.
      allowNestedScroll: true,
      anchors: { offset: -88 },
    });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);
  return null;
}
