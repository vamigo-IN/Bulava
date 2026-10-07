import type { CSSProperties } from 'react';
import type { IconName } from '@bulava/template-schema';

/**
 * Line icons for detail rows and buttons, drawn here so templates, films and
 * the Studio share one set without an icon library in the engine. 24-unit
 * grid, stroked with the current colour.
 */
const PATHS: Record<IconName, string> = {
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  heart: 'M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6.3a5 5 0 1 1 7.5 6.3z',
  rings: 'M9 16a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM15 19a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM9 3l1.5 2M15 6l1.5-2',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  camera: 'M3 8a2 2 0 0 1 2-2h2l2-3h6l2 3h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  gift: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6.3 6.3l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.6 2z',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8zM4 15l.6 1.4L6 17l-1.4.6L4 19l-.6-1.4L2 17l1.4-.6z',
  star: 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z',
  car: 'M5 17h14M3 11l2-5a2 2 0 0 1 1.9-1.3h10.2A2 2 0 0 1 19 6l2 5M3 11h18v6H3zM7 17a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM17 17a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  bed: 'M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  dinner: 'M3 2v7a3 3 0 0 0 6 0V2M6 2v20M17 2c-2 0-3 3-3 7v4h3v9M17 2v11',
  flower: 'M12 22v-7M12 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 7a3.5 3.5 0 1 1 0-7M12 7a3.5 3.5 0 1 0 0-7M8 11a3.5 3.5 0 1 1-7 0M16 11a3.5 3.5 0 1 0 7 0M8 11a3.5 3.5 0 1 0-7 0M16 11a3.5 3.5 0 1 1 7 0',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0',
  diya: 'M3 13h18c0 3.3-4 6-9 6s-9-2.7-9-6zM12 11c-2-2-2-4 0-6 2 2 2 4 0 6zM8 19l-1 2M16 19l1 2',
  navigation: 'M3 11l19-9-9 19-2-8z',
};

export function Icon({ name, style, weight = 1.75 }: { name: IconName; style?: CSSProperties; weight?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block', ...style }}>
      <path d={PATHS[name]} />
    </svg>
  );
}
