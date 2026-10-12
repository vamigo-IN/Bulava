'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PhoneFrame } from './editor-chrome';
import { FrameDocument } from './frame-document';

/** A phone's width in design pixels, and the frame's bezel on both sides. */
const SCREEN = 390;
const PHONE = SCREEN + 10;

/**
 * A design on a phone, scaled to the space it has (ADR-065): drawn in a frame
 * as wide as a phone, so the template lays out exactly as on a guest's phone,
 * inside the editors' thin-bezel phone. It fills its box's width (up to
 * `maxWidth`) and height; the design scrolls inside the screen.
 */
export function PhonePreview({ title, maxWidth = 360, className, children }: { title: string; maxWidth?: number; className?: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: maxWidth, h: 640 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => entry && setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const scale = Math.max(0.3, Math.min(maxWidth, size.w) / PHONE);
  const screenHeight = Math.max(320, Math.round(size.h / scale) - 10);
  return (
    <div ref={box} className={cn('relative mx-auto w-full overflow-hidden', className)} style={{ maxWidth }}>
      <div className="absolute top-0 left-1/2 origin-top" style={{ width: PHONE, transform: `translateX(-50%) scale(${scale})` }}>
        <PhoneFrame>
          <FrameDocument width={SCREEN} height={screenHeight} title={title}>
            {children}
          </FrameDocument>
        </PhoneFrame>
      </div>
    </div>
  );
}
