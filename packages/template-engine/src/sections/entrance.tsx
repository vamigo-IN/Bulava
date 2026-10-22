'use client';

import { useEffect } from 'react';
import { INTRO_OPEN_EVENT } from '../intro';
import { INTRO_DONE_EVENT } from '../stage/openings';

/** How long after the guest's tap the words start to rise: the doors have begun to part by then. */
const AFTER_TAP_MS = 380;

/**
 * The heirloom hero's words come in once, one after another, as the opening lifts (live pages). They are
 * never hidden at first paint: they wait only while an opening covers the page (it locks the page's
 * scroll), and rise as the guest opens it (`bulava:intro-open`, a moment after the tap, so they come in
 * while the doors swing over the photograph), or when it is gone or `bulava:intro-done` fires. The rest of
 * the hero (the photograph, the arcade, the view) is there from the first frame. Reduced motion: nothing moves.
 */
export function HeroEntrance({ targetId }: { targetId: string }) {
  useEffect(() => {
    const el = document.getElementById(targetId);
    const html = document.documentElement;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches || html.style.overflow !== 'hidden') return;
    let done = false;
    let timer = 0;
    const play = () => {
      if (done) return;
      done = true;
      el.dataset.enter = 'play';
    };
    const opened = () => {
      if (!timer) timer = window.setTimeout(play, AFTER_TAP_MS);
    };
    el.dataset.enter = 'wait';
    const observer = new MutationObserver(() => {
      if (html.style.overflow !== 'hidden') play();
    });
    observer.observe(html, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener(INTRO_OPEN_EVENT, opened);
    window.addEventListener(INTRO_DONE_EVENT, play);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      window.removeEventListener(INTRO_OPEN_EVENT, opened);
      window.removeEventListener(INTRO_DONE_EVENT, play);
    };
  }, [targetId]);
  return null;
}
