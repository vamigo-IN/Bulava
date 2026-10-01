'use client';

import { CursorFollower } from '@/components/effects/cursor-follower';
import { SmoothScroll } from '@/lib/motion/smooth-scroll';

/** The marketing site's feel: smooth scrolling and the trailing cursor. Mounted by the site header. */
export function MarketingEffects({ viewLabel }: { viewLabel: string }) {
  return (
    <>
      <SmoothScroll />
      <CursorFollower viewLabel={viewLabel} />
    </>
  );
}
