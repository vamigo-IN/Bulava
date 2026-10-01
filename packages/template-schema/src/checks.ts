import { createTranslator } from '@bulava/localization';
import { resolveValue } from './bindings';
import { sampleRenderContext } from './context';
import type { TemplateDefinition, Value } from './definition';
import { videoDurationSec } from './validate';

export interface TemplateCheckCase {
  name: string;
  language: string;
  longNames: boolean;
  noPhotos: boolean;
  typeKey: string;
}

export interface TemplateCheckResult {
  case: string;
  /** Props that resolved to nothing (the section will hide or show a gap). */
  empty: string[];
  /** Props that resolved to very long text for their slot (overflow risk). */
  long: string[];
  durationSec?: number;
}

/** The spec's template test matrix: languages × name lengths × photos × event types. */
export function templateCheckCases(definition: TemplateDefinition): TemplateCheckCase[] {
  const types = definition.eventTypes.length ? definition.eventTypes.slice(0, 2) : ['WEDDING', 'BIRTHDAY'];
  const cases: TemplateCheckCase[] = [];
  for (const language of ['en', 'hi', 'hi-Latn']) {
    for (const longNames of [false, true]) {
      for (const noPhotos of [false, true]) {
        for (const typeKey of types) {
          cases.push({ name: `${language}/${longNames ? 'long' : 'short'}/${noPhotos ? 'no-photos' : 'photos'}/${typeKey}`, language, longNames, noPhotos, typeKey });
        }
      }
    }
  }
  return cases;
}

const OPTIONAL_PROP = /^(tagline|image|invocation|subtitle|place|hashtag|closing|text|partnerOneParents|partnerTwoParents|heading|eyebrow)$/;

/** Resolve every prop/element across the test matrix. Pure; used by Template Studio before publishing. */
export function runTemplateChecks(definition: TemplateDefinition): TemplateCheckResult[] {
  return templateCheckCases(definition).map((c) => {
    const ctx = sampleRenderContext({ language: c.language, longNames: c.longNames, noPhotos: c.noPhotos, typeKey: c.typeKey });
    const opts = { t: createTranslator(c.language), language: c.language, timeZone: ctx.event.timezone };
    const empty: string[] = [];
    const long: string[] = [];
    const check = (path: string, value: Value | undefined, required: boolean, maxChars: number) => {
      if (!value) return;
      const out = resolveValue(value, ctx, opts);
      if (out === undefined || out === '') {
        if (required) empty.push(path);
      } else if (String(out).length > maxChars) {
        long.push(path);
      }
    };
    definition.website?.pages.forEach((page) =>
      page.sections.forEach((s) =>
        Object.entries(s.props).forEach(([key, v]) => check(`${s.id}.${key}`, v, !OPTIONAL_PROP.test(key), key === 'title' ? 60 : 600)),
      ),
    );
    definition.scenes?.forEach((scene) =>
      scene.elements.forEach((el) => {
        if (el.kind === 'text') check(`${scene.id}.${el.id}`, el.content, false, Math.max(12, Math.floor((el.frame.w / (el.style.fontSize * 0.55)) * Math.max(1, Math.floor(el.frame.h / (el.style.fontSize * el.style.lineHeight))))));
      }),
    );
    return {
      case: c.name,
      empty,
      long,
      ...(definition.scenes ? { durationSec: videoDurationSec(definition, ctx.functions.length) } : {}),
    };
  });
}
