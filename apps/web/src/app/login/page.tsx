import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/auth-form';

// Rendered per request so the page carries its own CSP nonce (see src/middleware.ts).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Sign in or create your account' };

/** One sign-in for everyone: an email or WhatsApp number, or Google; new people finish making their account here too. */
export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
