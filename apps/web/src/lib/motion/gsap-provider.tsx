'use client';

import { useEffect, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Wrap the app once: registers the GSAP plugins and default easing. */
export function GSAPProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Respect reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.globalTimeline.timeScale(20); // effectively skip
    }

    // Default easing for a premium feel
    gsap.defaults({ ease: 'power3.out', duration: 0.8 });

    ScrollTrigger.defaults({
      toggleActions: 'play none none reverse',
    });

    return () => {
      ScrollTrigger.getAll().forEach((st) => st.kill());
    };
  }, []);

  return <>{children}</>;
}

export { gsap, ScrollTrigger };
