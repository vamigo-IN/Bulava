'use client';

/**
 * Last resort when the console's root layout itself fails. It replaces the
 * layout, so the stylesheet isn't loaded: inline styles only.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#f5f5f4', fontFamily: 'system-ui, sans-serif', color: '#1c1917' }}>
        <div role="alert" style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>The console could not load</h1>
          <p style={{ margin: '0 0 20px', color: '#57534e', lineHeight: 1.5 }}>Something went wrong on our side. Please try again in a moment.</p>
          <button
            type="button"
            onClick={reset}
            style={{ minHeight: 40, padding: '0 18px', border: 0, borderRadius: 8, background: '#5b0e1b', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
          >
            Try again
          </button>
          {error.digest ? <p style={{ marginTop: 20, fontSize: 12, color: '#78716c' }}>Reference: {error.digest}</p> : null}
        </div>
      </body>
    </html>
  );
}
