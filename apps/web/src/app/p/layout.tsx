import type { ReactNode } from 'react';

// Rendered per request so each page carries its own CSP nonce (see src/middleware.ts).
export const dynamic = 'force-dynamic';

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
