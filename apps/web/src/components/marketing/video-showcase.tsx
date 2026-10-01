'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { TemplateDefinition } from '@bulava/template-schema';
import { motion } from 'framer-motion';
import { TiltCard } from '@/components/effects/tilt-card';

const VideoPlayer = dynamic(() => import('./video-player').then((m) => m.VideoPlayer), {
  ssr: false,
  loading: () => <Placeholder />,
});

/** Night-toned stand-in while the player loads (the showcase sits on dark sections). */
function Placeholder() {
  return <div className="h-full w-full animate-pulse bg-gradient-to-b from-night-700 to-night-800" />;
}

/**
 * Live previews of video templates (rendered in the browser by the same
 * Remotion composition the video worker uses). The player bundle loads only
 * when this section scrolls into view. The phones turn in from the side and
 * lean toward the pointer.
 */
export function VideoShowcase({ templates, playLabel }: { templates: Array<{ key: string; name: string; eventType: string; definition: TemplateDefinition }>; playLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: '200px' });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="grid grid-cols-1 justify-items-center gap-10 min-[560px]:grid-cols-2 lg:grid-cols-3 [perspective:1400px]">
      {templates.map((tpl, i) => (
        <motion.figure
          key={tpl.key}
          initial={{ opacity: 0, y: 48, rotateY: i === 0 ? 18 : i === 2 ? -18 : 0 }}
          whileInView={{ opacity: 1, y: 0, rotateY: 0 }}
          transition={{ duration: 0.9, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true, margin: '-60px' }}
          className="group flex flex-col items-center"
        >
          <div className="relative">
            <span aria-hidden="true" className="absolute -bottom-6 left-1/2 h-10 w-4/5 -translate-x-1/2 rounded-[50%] bg-black/60 blur-2xl" />
            <TiltCard className="rounded-[2.2rem]" max={5} glare={false}>
              <div className="phone-frame shadow-[0_0_0_1px_rgba(227,197,133,0.18),0_40px_80px_-30px_rgba(0,0,0,0.9)] transition-shadow duration-500 group-hover:shadow-[0_0_0_1px_rgba(227,197,133,0.4),0_40px_90px_-24px_rgba(227,197,133,0.35)]" style={{ width: 244, height: 434 }}>
                {visible ? <VideoPlayer definition={tpl.definition} eventType={tpl.eventType} label={playLabel} /> : <Placeholder />}
              </div>
            </TiltCard>
          </div>
          <figcaption className="mt-7 font-display text-2xl text-ivory transition-colors duration-300 group-hover:text-gold-200">{tpl.name}</figcaption>
        </motion.figure>
      ))}
    </div>
  );
}
