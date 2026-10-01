'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { track } from '@/lib/track';

/** A Next.js link that records an analytics event when followed. */
export function TrackedLink({ event, properties, onClick, ...props }: ComponentProps<typeof Link> & { event: string; properties?: Record<string, unknown> }) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        track(event, properties);
        onClick?.(e);
      }}
    />
  );
}
