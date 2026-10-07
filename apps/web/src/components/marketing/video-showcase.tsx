'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { TemplateDefinition } from '@bulava/template-schema';
import { TiltCard } from '@/components/effects/tilt-card';
import { cn } from '@/lib/utils';

const VideoPlayer = dynamic(() => import('./video-player').then((m) => m.VideoPlayer), {
  ssr: false,
  loading: () => <Placeholder />,
});

/** Night-toned stand-in while the player loads (the showcase sits on dark sections). */
function Placeholder() {
  return <div className="h-full w-full animate-pulse bg-gradient-to-b from-night-700 to-night-800" />;
}

/** Where each phone starts its entrance: the outer two turned in from the sides. */
const ENTRANCE = [
  'motion-safe:[transform:translateY(48px)_rotateY(18deg)]',
  'motion-safe:[transform:translateY(48px)]',
  'motion-safe:[transform:translateY(48px)_rotateY(-18deg)]',
];

/**
 * Live previews of video templates (rendered in the browser by the same
 * Remotion composition the video worker uses). The player bundle loads only
 * when this section nears the viewport. The phones turn in from the side as
 * they come into view (a CSS transition, so the home page needs no animation
 * library for it) and lean toward the pointer.
 */
export function VideoShowcase({ templates, playLabel }: { templates: Array<{ key: string; name: string; eventType: string; definition: TemplateDefinition }>; playLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const load = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: '200px' });
    const enter = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setShown(true), { rootMargin: '-60px' });
    load.observe(node);
    enter.observe(node);
    return () => {
      load.disconnect();
      enter.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className="grid grid-cols-1 justify-items-center gap-10 min-[560px]:grid-cols-2 lg:grid-cols-3 [perspective:1400px]">
      {templates.map((tpl, i) => (
        <figure
          key={tpl.key}
          className={cn(
            'group flex flex-col items-center transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none',
            shown ? null : ['motion-safe:opacity-0', ENTRANCE[i % ENTRANCE.length]],
          )}
          style={{ transitionDelay: `${i * 120}ms` }}
        >
          <div className="relative">
            <span aria-hidden="true" className="absolute -bottom-6 left-1/2 h-10 w-4/5 -translate-x-1/2 rounded-[50%] bg-black/60 blur-2xl" />
            <TiltCard className="rounded-[2.2rem]" max={5} glare={false}>
              <div className="phone-frame shadow-[0_0_0_1px_rgba(227,197,133,0.18),0_40px_80px_-30px_rgba(0,0,0,0.9)] transition-shadow duration-500 group-hover:shadow-[0_0_0_1px_rgba(227,197,133,0.4),0_40px_90px_-24px_rgba(227,197,133,0.35)]" style={{ width: 244, height: 434 }}>
                {near ? <VideoPlayer definition={tpl.definition} eventType={tpl.eventType} label={playLabel} /> : <Placeholder />}
              </div>
            </TiltCard>
          </div>
          <figcaption className="mt-7 font-display text-2xl text-ivory transition-colors duration-300 group-hover:text-gold-200">{tpl.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}
