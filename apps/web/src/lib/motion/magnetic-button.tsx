'use client';

import { useRef, type ReactNode, type ComponentProps } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

interface MagneticButtonProps extends ComponentProps<'div'> {
  children: ReactNode;
  strength?: number;
  className?: string;
}

/**
 * Wraps a button/link so it magnetically pulls toward the cursor on hover,
 * creating an interactive premium feel. Respects prefers-reduced-motion.
 */
export function MagneticButton({ children, strength = 0.35, className, ...props }: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const move = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      gsap.to(el, {
        x: x * strength,
        y: y * strength,
        duration: 0.4,
        ease: 'power2.out',
      });
    };

    const reset = () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    };

    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', reset);
    return () => {
      el.removeEventListener('mousemove', move);
      el.removeEventListener('mouseleave', reset);
    };
  }, { scope: ref });

  return (
    <div ref={ref} className={className} style={{ display: 'inline-block' }} {...props}>
      {children}
    </div>
  );
}
