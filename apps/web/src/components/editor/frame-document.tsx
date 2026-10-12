'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const STYLE_NODES = 'link[rel="stylesheet"], style';
const EMPTY = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:transparent"></body></html>';

/**
 * A design drawn in a document of its own (ADR-065): an iframe as wide as a
 * phone (or a desktop), so the template's layouts answer to that width the way
 * they do on a guest's phone, not to the editor's window. The site's
 * stylesheets and font variables are copied in (and followed while it is open,
 * for development's hot reloads); React renders into it through a portal, so
 * events, state and the editor's tools work as anywhere else. Without a
 * `height` it grows with its content (the page around it scrolls); with one,
 * the content scrolls inside it.
 */
export function FrameDocument({
  width,
  height,
  title,
  className,
  style,
  onKeyDown,
  children,
}: {
  width: number;
  /** A fixed height: the content scrolls inside. None: as tall as the content. */
  height?: number;
  title: string;
  className?: string;
  style?: CSSProperties;
  /** Keys pressed inside the frame (its own window, which the editor's shortcuts do not hear). */
  onKeyDown?: (event: KeyboardEvent) => void;
  children: ReactNode;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const keys = useRef(onKeyDown);
  keys.current = onKeyDown;
  const cleanup = useRef<(() => void) | null>(null);

  // The frame's document is ready once its (empty) page has loaded; it is set up then, once.
  const setUp = () => {
    const doc = frame.current?.contentDocument;
    const win = frame.current?.contentWindow;
    // Before its page loads, a frame shows the browser's own blank document: wait for the real one.
    if (!doc || !win || doc.URL !== 'about:srcdoc' || !doc.body || doc.body.dataset.ready) return;
    cleanup.current?.();
    doc.body.dataset.ready = '1';
    // The site's font variables live on <html> (next/font), its rules in the stylesheets.
    doc.documentElement.className = document.documentElement.className;
    doc.documentElement.lang = document.documentElement.lang;
    const copy = (node: Node) => {
      if (node instanceof HTMLElement && node.matches(STYLE_NODES)) doc.head.appendChild(node.cloneNode(true));
    };
    document.head.querySelectorAll(STYLE_NODES).forEach(copy);
    const follow = new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach(copy)));
    follow.observe(document.head, { childList: true });
    const root = doc.createElement('div');
    doc.body.appendChild(root);
    // The frame's own observer: its elements belong to its document.
    const measure = new (win as Window & typeof globalThis).ResizeObserver(() => setContentHeight(Math.ceil(root.getBoundingClientRect().height)));
    measure.observe(root);
    const onKey = (e: KeyboardEvent) => keys.current?.(e);
    doc.addEventListener('keydown', onKey);
    cleanup.current = () => {
      follow.disconnect();
      measure.disconnect();
      doc.removeEventListener('keydown', onKey);
    };
    setMount(root);
  };

  useEffect(() => {
    // A frame that loaded before React listened (a cached empty page) is set up here.
    if (frame.current?.contentDocument?.readyState === 'complete') setUp();
    return () => cleanup.current?.();
    // Once: the frame's document lives as long as the component.
  }, []);

  return (
    <>
      <iframe
        ref={frame}
        title={title}
        className={className}
        srcDoc={EMPTY}
        onLoad={setUp}
        style={{ display: 'block', border: 0, width, height: height ?? Math.max(contentHeight, 1), background: 'transparent', colorScheme: 'light', ...style }}
      />
      {mount ? createPortal(children, mount) : null}
    </>
  );
}
