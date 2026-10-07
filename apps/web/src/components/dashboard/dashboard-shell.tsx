'use client';

import { Bell, CalendarHeart, CheckCircle2, ChevronDown, Clapperboard, LayoutGrid, LogOut, ReceiptIndianRupee, UserCheck, UserRound, Users, Wallet, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { apiPost } from '@/lib/api';
import { I18nProvider, useT } from '@/lib/i18n';
import { useMe, useNotifications } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/primitives';
import { BrandLogo } from '@/components/marketing/brand-logo';

const MENU_MOTION = {
  initial: { opacity: 0, y: -6, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -6, scale: 0.97 },
  transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const },
};
const MENU_PANEL = 'absolute right-0 z-50 mt-2 origin-top-right overflow-hidden rounded-2xl border border-gold-200/80 bg-white shadow-lift';

/** Closes a popover on a click outside it or on Escape. */
function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, open, close]);
}

const NOTIF_ICON: Record<string, LucideIcon> = {
  RSVP_RECEIVED: CheckCircle2,
  RENDER_COMPLETE: Clapperboard,
  PAYMENT: Wallet,
  REGISTRATION_RECEIVED: UserCheck,
  MEMBER_ADDED: Users,
};

function Notifications() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const client = useQueryClient();
  const list = useNotifications();
  const unread = list.data?.filter((n) => !n.readAt).length ?? 0;
  useDismiss(box, open, () => setOpen(false));
  const markAll = async () => {
    await Promise.all((list.data ?? []).filter((n) => !n.readAt).map((n) => apiPost(`/notifications/${n.id}/read`).catch(() => undefined)));
    await client.invalidateQueries({ queryKey: ['notifications'] });
  };
  const label = (n: NonNullable<typeof list.data>[number]) => {
    const p = n.payload;
    if (n.type === 'RSVP_RECEIVED') return t('notif.RSVP_RECEIVED', { guest: String(p.guestName ?? ''), event: String(p.eventTitle ?? '') });
    if (n.type === 'RENDER_COMPLETE') return t('notif.RENDER_COMPLETE');
    if (n.type === 'PAYMENT') return t('notif.PAYMENT', { plan: String(p.plan ?? '') });
    if (n.type === 'REGISTRATION_RECEIVED') return t('notif.REGISTRATION_RECEIVED', { guest: String(p.guestName ?? ''), event: String(p.eventTitle ?? '') });
    if (n.type === 'MEMBER_ADDED') return t('notif.MEMBER_ADDED', { event: String(p.eventTitle ?? '') });
    return n.type;
  };
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) void markAll();
        }}
        aria-expanded={open}
        aria-label={t('notif.title')}
        className={cn('relative grid size-10 place-items-center rounded-full text-stone-700 transition-colors duration-300 hover:bg-sand hover:text-ink', open && 'bg-sand text-ink')}
      >
        <Bell aria-hidden className="size-[18px]" />
        {unread ? (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-brand-700 px-1 text-[10px] leading-4 font-bold text-white ring-2 ring-ivory">
            {unread > 9 ? '9+' : unread}
          </motion.span>
        ) : null}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div {...MENU_MOTION} className={cn(MENU_PANEL, 'w-[min(22rem,calc(100vw-2rem))]')}>
            <p className="border-b border-gold-100 px-5 py-4 font-display text-xl">{t('notif.title')}</p>
            <ul className="max-h-96 overflow-y-auto">
              {list.data?.length ? (
                list.data.map((n, i) => {
                  const Icon = NOTIF_ICON[n.type] ?? Bell;
                  return (
                    <motion.li key={n.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="border-b border-gold-100 last:border-0">
                      <div className="flex gap-3 px-5 py-3.5 text-sm transition-colors duration-200 hover:bg-gold-100/30">
                        <span aria-hidden className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0">
                          {n.eventId || (n.type === 'PAYMENT' && typeof n.payload.orderId === 'string') ? (
                            <Link
                              href={
                                n.type === 'PAYMENT' && typeof n.payload.orderId === 'string'
                                  ? `/dashboard/payments/${n.payload.orderId}`
                                  : `/dashboard/events/${n.eventId}${n.type === 'RSVP_RECEIVED' ? '/rsvps' : n.type === 'RENDER_COMPLETE' ? '/video' : ''}`
                              }
                              onClick={() => setOpen(false)}
                              className="font-medium text-ink transition-colors hover:text-brand-700"
                            >
                              {label(n)}
                            </Link>
                          ) : (
                            <span className="font-medium text-ink">{label(n)}</span>
                          )}
                          <p className="mt-0.5 text-xs text-stone-500">{new Date(n.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                        </div>
                      </div>
                    </motion.li>
                  );
                })
              ) : (
                <li className="flex flex-col items-center gap-2 px-5 py-10 text-center text-sm text-stone-500">
                  <CheckCircle2 aria-hidden className="size-6 text-gold-500" />
                  {t('notif.empty')}
                </li>
              )}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function AccountMenu({ name, onLogout }: { name?: string; onLogout: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useDismiss(box, open, () => setOpen(false));
  const item = 'flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm text-stone-700 transition-colors duration-200 hover:bg-gold-100/40 hover:text-ink';
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn('flex min-h-10 items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors duration-300 hover:bg-sand sm:pr-3', open && 'bg-sand')}
      >
        <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-brand-900 text-sm font-semibold text-gold-200 ring-2 ring-gold-300/40">{name?.[0]?.toUpperCase() ?? '·'}</span>
        <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">{name}</span>
        <ChevronDown aria-hidden className={cn('size-4 text-stone-500 transition-transform duration-300', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div {...MENU_MOTION} role="menu" className={cn(MENU_PANEL, 'w-56 py-1.5')}>
            <Link role="menuitem" href="/dashboard" onClick={() => setOpen(false)} className={cn(item, 'sm:hidden')}>
              <CalendarHeart aria-hidden className="size-4 text-gold-600" />
              {t('dash.nav.events')}
            </Link>
            <Link role="menuitem" href="/templates" onClick={() => setOpen(false)} className={cn(item, 'sm:hidden')}>
              <LayoutGrid aria-hidden className="size-4 text-gold-600" />
              {t('nav.templates')}
            </Link>
            <Link role="menuitem" href="/dashboard/account" onClick={() => setOpen(false)} className={item}>
              <UserRound aria-hidden className="size-4 text-gold-600" />
              {t('dash.nav.account')}
            </Link>
            <Link role="menuitem" href="/dashboard/payments" onClick={() => setOpen(false)} className={item}>
              <ReceiptIndianRupee aria-hidden className="size-4 text-gold-600" />
              {t('dash.nav.payments')}
            </Link>
            <div className="my-1.5 h-px bg-gold-100" />
            <button role="menuitem" type="button" onClick={onLogout} className={item}>
              <LogOut aria-hidden className="size-4 text-gold-600" />
              {t('auth.logout')}
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const client = useQueryClient();
  const me = useMe();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const logout = async () => {
    await apiPost('/auth/logout').catch(() => undefined);
    client.clear();
    router.replace('/login');
  };

  const nav = [
    { href: '/dashboard', label: t('dash.nav.events'), active: pathname === '/dashboard' || pathname.startsWith('/dashboard/events') },
    { href: '/templates', label: t('nav.templates'), active: false },
  ];

  return (
    <div className="relative isolate min-h-dvh bg-ivory">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(ellipse_60%_80%_at_50%_0%,rgba(227,197,133,0.22),transparent_70%)]" />
      <header className={cn('sticky top-0 z-30 transition-[background-color,box-shadow] duration-300', scrolled ? 'bg-ivory/85 shadow-[0_1px_0_rgba(184,137,43,0.2),0_10px_30px_-20px_rgba(28,25,23,0.3)] backdrop-blur-xl backdrop-saturate-150' : 'bg-transparent')}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <BrandLogo href="/dashboard" />
            <nav aria-label="Dashboard" className="hidden items-center gap-0.5 rounded-full border border-gold-200/80 bg-white/60 p-1 sm:flex">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={n.active ? 'page' : undefined}
                  className={cn('rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-300', n.active ? 'bg-night-900 text-ivory' : 'text-stone-600 hover:text-ink')}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1">
            <Notifications />
            <AccountMenu name={me.data?.name} onLogout={logout} />
          </div>
        </div>
      </header>
      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-7xl px-4 pt-4 pb-16 sm:px-6 sm:pt-6"
      >
        {me.isPending ? <Spinner label={t('common.loading')} /> : me.isError ? null : children}
      </motion.main>
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <I18nProvider language="en">
      <Shell>{children}</Shell>
    </I18nProvider>
  );
}
