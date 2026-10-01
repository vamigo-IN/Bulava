'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SceneStill, type SceneArt } from '@bulava/template-engine';

/** A scene still (drawn or painted) that fills its container's width (template pickers, where tile sizes vary). */
export function ScenePoster({ art, ratio, children }: { art: SceneArt; ratio: number; children?: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry?.contentRect.width ?? 0)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={box} className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: ratio, background: art.background }}>
      {width ? (
        <SceneStill art={art} width={width} height={Math.round(width / ratio)}>
          {children}
        </SceneStill>
      ) : null}
    </div>
  );
}
