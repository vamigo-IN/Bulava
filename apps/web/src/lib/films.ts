import type { TemplateDefinition } from '@bulava/template-schema';

/**
 * Does this film open on a canvas (a film drawn from a canvas invitation,
 * ADR-058)? A plain module, so server components may call it too.
 */
export const isCanvasFilm = (definition: Pick<TemplateDefinition, 'scenes'> | undefined | null): boolean => Boolean(definition?.scenes?.some((s) => s.canvas));
