'use client';

import { useEffect } from 'react';

/**
 * Opens the reply card where it is (a closed <details>) when the page is reached at the RSVP section's
 * address or the page menu's RSVP link is followed (#<sectionId>).
 */
export function RsvpAutoOpen({ sectionId, detailsId }: { sectionId: string; detailsId: string }) {
  useEffect(() => {
    const open = () => {
      if (window.location.hash !== `#${sectionId}`) return;
      const details = document.getElementById(detailsId);
      if (details instanceof HTMLDetailsElement && !details.open) details.open = true;
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, [sectionId, detailsId]);
  return null;
}
