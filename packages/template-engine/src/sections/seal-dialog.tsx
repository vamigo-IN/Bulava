'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';

/**
 * The reply seal's form (rsvp "seal"): the seal is the button, and the reply form opens over the page in a native
 * dialog (focus stays inside it, Escape or a tap on the backdrop closes it). It also opens by itself when the page is
 * reached at the section's address or a link to it is followed (#<sectionId>), as the page menu's RSVP link does.
 */
export function SealDialog({
  sectionId,
  trigger,
  label,
  closeLabel,
  title,
  children,
}: {
  sectionId: string;
  /** What the guest presses: the seal and its prompt. */
  trigger: ReactNode;
  /** The button's accessible name. */
  label: string;
  closeLabel: string;
  /** The form's heading inside the dialog. */
  title: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = useCallback(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);
  useEffect(() => {
    const atAnchor = () => {
      if (window.location.hash === `#${sectionId}`) open();
    };
    atAnchor();
    window.addEventListener('hashchange', atAnchor);
    return () => window.removeEventListener('hashchange', atAnchor);
  }, [sectionId, open]);
  return (
    <>
      <button type="button" onClick={open} aria-haspopup="dialog" aria-label={label} className="group mx-auto flex flex-col items-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--t-orn)]">
        {trigger}
      </button>
      <dialog
        ref={dialog}
        aria-label={title}
        className="bulava-seal-dialog m-auto max-h-[92dvh] w-[min(100vw_-_24px,460px)] overflow-visible bg-transparent p-0 backdrop:bg-[rgb(40_24_16/0.55)]"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className="bulava-reply-card relative max-h-[92dvh] overflow-y-auto rounded-[6px] px-5 pt-12 pb-8 shadow-[0_30px_60px_-30px_rgba(40,24,16,0.6)] @min-[480px]:px-9">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label={closeLabel}
            className="absolute top-2.5 right-2.5 flex size-11 items-center justify-center rounded-full text-[var(--t-text)] transition-colors hover:bg-[color-mix(in_srgb,var(--t-orn)_14%,transparent)]"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <h2 className="mb-6 text-center text-[34px] leading-[1.25] font-normal text-[var(--t-secondary-display)] [font-family:var(--t-heading)]">{title}</h2>
          {children}
        </div>
      </dialog>
    </>
  );
}
