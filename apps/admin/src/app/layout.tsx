import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { fontVariables } from './fonts';
import { QueryProvider } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Bulava Admin', template: '%s · Bulava Admin' },
  robots: { index: false, follow: false },
};

// Every console page renders per request so it carries its own CSP nonce (src/middleware.ts).
export const dynamic = 'force-dynamic';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0c0a09' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-dvh font-sans">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
