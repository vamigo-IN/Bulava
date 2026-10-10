'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { createTranslator } from '@bulava/localization';
import { buttonVariants } from '@/components/ui/primitives';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';

const t = createTranslator('en');

/** The header's call to action: a maroon 3D button (it reads on the cream and the dark header). */
const HEADER_CTA = 'btn-3d group/cta min-h-11 rounded-xl px-5 text-sm';

function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

const Arrow = () => <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/cta:translate-x-0.5" />;

/** Header account area: "Sign in / Get started", or "My events" and the avatar when signed in. */
export function AccountLinks({ variant }: { variant: 'desktop' | 'mobile' }) {
  const session = useSession();

  if (session.status === 'signed-in') {
    const { user } = session;
    return variant === 'desktop' ? (
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className={HEADER_CTA}>
          {t('nav.myEvents')} <Arrow />
        </Link>
        <Link href="/dashboard/account" className="flex items-center gap-2 text-sm font-medium" title={user.email ?? user.name}>
          <span aria-hidden className="icon-3d size-10 rounded-full font-semibold transition-transform duration-300 hover:scale-105">
            {initial(user.name)}
          </span>
          <span className="sr-only">{t('nav.account', { name: user.name })}</span>
        </Link>
      </div>
    ) : (
      <>
        <p className="px-3 pt-1 text-xs text-stone-500">{t('nav.signedInAs', { name: user.name })}</p>
        <Link href="/dashboard" className={buttonVariants({ className: 'group/cta mt-2 w-full' })}>
          {t('nav.myEvents')} <Arrow />
        </Link>
      </>
    );
  }

  // Signed out, or still checking: the same markup the server rendered.
  return variant === 'desktop' ? (
    <div className={cn('flex items-center gap-2', session.status === 'unknown' && 'opacity-90')}>
      <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-[var(--hdr-muted)] transition-colors duration-300 hover:bg-[var(--hdr-hover)] hover:text-[var(--hdr-text)]">
        {t('nav.signIn')}
      </Link>
      <Link href="/login" className={HEADER_CTA}>
        {t('nav.getStarted')} <Arrow />
      </Link>
    </div>
  ) : (
    <>
      <Link href="/login" className="block rounded-2xl px-4 py-3 text-base font-medium transition-colors duration-200 hover:bg-gold-100/70">
        {t('nav.signIn')}
      </Link>
      <Link href="/login" className={buttonVariants({ className: 'group/cta mt-1 w-full' })}>
        {t('nav.getStarted')} <Arrow />
      </Link>
    </>
  );
}

/**
 * A call to action that skips sign-up for people who are already signed in,
 * e.g. "Use this template" goes straight to creating an event.
 */
export function AuthAwareLink({
  signedOutHref,
  signedInHref,
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href'> & { signedOutHref: string; signedInHref: string; children: ReactNode }) {
  const session = useSession();
  return (
    <Link {...props} href={session.status === 'signed-in' ? signedInHref : signedOutHref}>
      {children}
    </Link>
  );
}
