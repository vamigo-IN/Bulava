import type { ReactNode } from 'react';
import type { ThemeColors } from '@bulava/template-schema';
import { stageSet } from './sets';
import type { CameraPose, StageName } from './types';
import { stageVeil, StageView } from './view';

/**
 * A still of a stage in a fixed box (final.md §3.4): film posters, pickers,
 * the Studio. The rest pose (or a given one), `detail: 'low'`, no cover, rig,
 * particles or keyframes: every style is inline, with --u in px, so it needs
 * no stylesheet and imports nothing but the stage. Children (a title) sit on
 * top, as in SceneStill.
 */
export function StageStill({
  name,
  colors,
  width,
  height,
  monogram = '',
  pose,
  veil = true,
  children,
}: {
  name: StageName;
  colors: ThemeColors;
  width: number;
  height: number;
  monogram?: string;
  /** Another camera (default: the set's rest pose). */
  pose?: CameraPose;
  /**
   * The words veil behind a title: on (default) the set's own, off none, or a film scene's backdrop veil, drawn as
   * films draw it (the larger of it and the set's, so an editor's still matches the frame).
   */
  veil?: boolean | number;
  children?: ReactNode;
}) {
  const set = stageSet(name, { colors, monogram, detail: 'low' });
  const unit = Math.max(height / 800, width / 1200);
  const strength = veil === false ? 0 : Math.max(typeof veil === 'number' ? veil : 0, set.veil);
  return (
    <div data-bulava-stage-still={name} style={{ position: 'relative', width, height, overflow: 'hidden', background: set.sky }}>
      <StageView set={set} colors={colors} mode="still" unit={unit} pose={pose} />
      {strength > 0 ? <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: stageVeil({ name: set.name, veil: strength }, colors) }} /> : null}
      {children}
    </div>
  );
}
