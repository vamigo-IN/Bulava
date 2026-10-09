import type { CanvasSpec } from '../canvas-kit';
import { themeSpecs, type Theme } from './theme';
import { BIRTHDAY_THEMES } from './themes-birthday';
import { CELEBRATION_THEMES } from './themes-celebrations';
import { FAMILY_THEMES } from './themes-family';
import { HOME_THEMES } from './themes-home';
import { WEDDING_THEMES } from './themes-wedding';

/**
 * The factory's collection (docs/templates.md#template-factory): every theme a
 * designer has art-directed, each laid out in the compositions that suit it.
 */
export const THEMES: Theme[] = [...WEDDING_THEMES, ...CELEBRATION_THEMES, ...BIRTHDAY_THEMES, ...FAMILY_THEMES, ...HOME_THEMES];

/**
 * The templates, ordered so a gallery's first page shows one design from every
 * theme before the second design of any (round by round through the layouts).
 */
export function factorySpecs(themes: Theme[] = THEMES): CanvasSpec[] {
  const perTheme = themes.map(themeSpecs);
  const rounds = Math.max(0, ...perTheme.map((s) => s.length));
  const out: CanvasSpec[] = [];
  for (let round = 0; round < rounds; round++) for (const specs of perTheme) if (specs[round]) out.push(specs[round]!);
  return out;
}

export const FACTORY_SPECS: CanvasSpec[] = factorySpecs();
