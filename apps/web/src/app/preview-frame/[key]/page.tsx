import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TemplateRenderer, TemplateStyles } from '@bulava/template-engine';
import { sampleRenderContext } from '@bulava/template-schema';
import { FilmPosterView } from '@/components/marketing/live-template';
import { isCanvasFilm } from '@/lib/films';
import { hasPosterScene, PosterScene } from '@/components/marketing/template-card';
import { POSTER_HEIGHT, POSTER_WIDTH, PREVIEW_VIEWPORT_WIDTH } from '@/lib/template-previews';
import { getTemplate } from '@/lib/server-api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * One template for infrastructure/scripts/template-previews.mjs to photograph.
 * Websites at phone width: `view=card` is what gallery thumbnails render (first
 * sections, no photos), `view=full` what the home page's hero phone renders.
 * Films and cards: `view=poster`, their scene and title as gallery cards draw it
 * (404 without a scene). Off unless TEMPLATE_PREVIEW_FRAMES=1, so it never exists
 * in production.
 */
export default async function PreviewFramePage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ view?: string }> }) {
  if (process.env.TEMPLATE_PREVIEW_FRAMES !== '1') notFound();
  const [{ key }, { view }] = await Promise.all([params, searchParams]);
  const tpl = await getTemplate(key);
  if (!tpl?.definition) notFound();

  if (view === 'poster') {
    if (tpl.definition.type !== 'WEBSITE' && isCanvasFilm(tpl.definition)) {
      return (
        <div id="preview-frame" style={{ width: POSTER_WIDTH, height: POSTER_HEIGHT }}>
          <FilmPosterView definition={tpl.definition} eventType={tpl.eventTypes[0] ?? 'WEDDING'} tags={tpl.tags} width={POSTER_WIDTH} height={POSTER_HEIGHT} label="Video" />
        </div>
      );
    }
    if (tpl.definition.type === 'WEBSITE' || !hasPosterScene(tpl)) notFound();
    return (
      <div id="preview-frame" style={{ width: POSTER_WIDTH, height: POSTER_HEIGHT }}>
        <PosterScene template={tpl} width={POSTER_WIDTH} height={POSTER_HEIGHT} />
      </div>
    );
  }

  if (tpl.definition.type !== 'WEBSITE') notFound();
  const typeKey = tpl.eventTypes[0] ?? 'WEDDING';
  return (
    <div id="preview-frame" style={{ width: PREVIEW_VIEWPORT_WIDTH }}>
      {view === 'full' ? (
        <TemplateRenderer definition={tpl.definition} context={sampleRenderContext({ typeKey, tags: tpl.tags })} mode="preview" language="en" />
      ) : (
        <>
          <TemplateStyles />
          <TemplateRenderer definition={tpl.definition} context={sampleRenderContext({ typeKey, noPhotos: true, tags: tpl.tags })} mode="thumbnail" maxSections={4} />
        </>
      )}
    </div>
  );
}
