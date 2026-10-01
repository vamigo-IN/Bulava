import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/auth-form';

// Rendered per request so the page carries its own CSP nonce (see src/middleware.ts).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Create account' };

export default function SignupPage() {
  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
