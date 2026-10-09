'use client';

import { useEffect, useMemo, useState } from 'react';
import { createTranslator } from '@bulava/localization';
import { CardView, TemplateStyles } from '@bulava/template-engine';
import { cardRenderContext, type CardDesign, type CardPhotoBinding } from '@bulava/template-schema';

const frames = (n: number) => new Promise<void>((resolve) => {
  const step = (left: number) => (left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
  step(n);
});

/**
 * The card exactly as the editor draws it, at its design size. It says it is
 * ready (data-card-ready) once the fonts are in, text has been fitted with
 * them, and every photo and drawing has loaded; the renderer then takes the
 * screenshot. A photo that fails to load is left out rather than drawn broken.
 */
export function CardRenderFrame({ design, photos, watermark }: { design: CardDesign; photos: Record<string, string>; watermark: string | null }) {
  const [pass, setPass] = useState(0);
  const [ready, setReady] = useState(false);
  const t = useMemo(() => createTranslator(design.language), [design.language]);
  const ctx = useMemo(() => cardRenderContext(design, photos as Partial<Record<CardPhotoBinding, string>>), [design, photos]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await document.fonts.ready;
      // Fonts load as text first uses them: draw again so text fitting measures the real letters.
      setPass(1);
      await frames(3);
      const images = [...document.images];
      await Promise.all(
        images.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener('load', () => resolve(), { once: true });
                img.addEventListener('error', () => resolve(), { once: true });
              }),
        ),
      );
      await document.fonts.ready;
      await frames(3);
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div id="card" data-card-ready={ready ? '' : undefined} style={{ width: design.board.width, height: design.board.height, overflow: 'hidden', background: '#ffffff' }}>
      <TemplateStyles />
      {/* Development builds show Next's indicator in a corner: never in a card. */}
      <style>{'nextjs-portal{display:none!important}'}</style>
      <CardView key={pass} design={design} ctx={ctx} t={t} watermark={watermark} />
    </div>
  );
}
