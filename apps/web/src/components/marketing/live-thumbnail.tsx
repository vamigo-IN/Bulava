'use client';

import dynamic from 'next/dynamic';

/**
 * A template card's live preview, for a template without a pre-rendered image.
 * Server components render this instead of importing the template engine, whose
 * code then loads only on pages that actually show a live preview.
 */
export const LiveThumbnail = dynamic(() => import('./live-template').then((m) => m.LiveThumbnailView));
