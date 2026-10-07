'use client';

/**
 * Last resort when the root layout itself fails (app/error.tsx covers every
 * page below it). It replaces the layout, so the stylesheet and fonts aren't
 * loaded: inline styles in the brand's cream and maroon.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#f6eee5', color: '#1c1917', fontFamily: 'Georgia, "Times New Roman", serif' }}>
        <main role="alert" style={{ maxWidth: 440, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 34, fontWeight: 400, margin: '0 0 12px' }}>Something went wrong</h1>
          <p style={{ margin: '0 0 28px', fontFamily: 'system-ui, sans-serif', fontSize: 17, lineHeight: 1.55, color: '#57534e' }}>
            Bulava could not load this page. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ minHeight: 48, padding: '0 24px', border: 0, borderRadius: 16, background: 'linear-gradient(180deg,#a83a47,#7a1d27 58%,#611420)', color: '#fff8f1', fontSize: 16, fontWeight: 600, fontFamily: 'system-ui, sans-serif', cursor: 'pointer' }}
          >
            Try again
          </button>
          {error.digest ? <p style={{ marginTop: 24, fontFamily: 'system-ui, sans-serif', fontSize: 12, color: '#78716c' }}>Reference {error.digest}</p> : null}
        </main>
      </body>
    </html>
  );
}
