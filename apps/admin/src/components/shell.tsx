'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Blocks,
  CodeXml,
  FileClock,
  FileText,
  House,
  Image as ImageIcon,
  IdCard,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Menu,
  MessageSquareQuote,
  Music,
  Palette,
  Receipt,
  KeyRound,
  Search,
  ShieldCheck,
  Tags,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { t, type AdminMessageKey } from '@/lib/i18n';
import type { Me, PlatformPermission } from '@/lib/types';
import { cn } from '@/lib/utils';
import { TwoStepPanel } from './two-step';
import { Alert, Button, Spinner } from './ui';

interface NavItem {
  href: string;
  label: AdminMessageKey;
  icon: LucideIcon;
  permission: PlatformPermission;
  /** Shows the number of new contact-form messages. */
  badge?: 'contact';
}

const NAV: Array<{ group: AdminMessageKey | null; items: NavItem[] }> = [
  { group: null, items: [{ href: '/', label: 'nav.overview', icon: LayoutDashboard, permission: 'admin.read' }] },
  {
    group: 'nav.group.catalog',
    items: [
      { href: '/templates', label: 'nav.templates', icon: LayoutTemplate, permission: 'template.manage' },
      { href: '/assets', label: 'nav.assets', icon: ImageIcon, permission: 'asset.manage' },
      { href: '/music', label: 'nav.music', icon: Music, permission: 'asset.manage' },
      { href: '/licenses', label: 'nav.licenses', icon: AlertTriangle, permission: 'asset.manage' },
    ],
  },
  {
    group: 'nav.group.commerce',
    items: [
      { href: '/pricing', label: 'nav.pricing', icon: Tags, permission: 'pricing.manage' },
      { href: '/orders', label: 'nav.orders', icon: Receipt, permission: 'billing.read' },
      { href: '/cards', label: 'nav.cards', icon: IdCard, permission: 'cards.view' },
    ],
  },
  {
    group: 'nav.group.support',
    items: [{ href: '/messages', label: 'nav.messages', icon: Inbox, permission: 'contact.manage', badge: 'contact' }],
  },
  {
    group: 'nav.group.people',
    items: [
      { href: '/users', label: 'nav.users', icon: Users, permission: 'admin.read' },
      { href: '/staff', label: 'nav.staff', icon: UserCog, permission: 'staff.manage' },
      { href: '/moderation', label: 'nav.moderation', icon: ShieldCheck, permission: 'media.moderate' },
      { href: '/testimonials', label: 'nav.testimonials', icon: MessageSquareQuote, permission: 'content.manage' },
    ],
  },
  {
    group: 'nav.group.website',
    items: [
      { href: '/showcase', label: 'nav.showcase', icon: House, permission: 'showcase.manage' },
      { href: '/pages', label: 'nav.pages', icon: FileText, permission: 'page.manage' },
      { href: '/settings', label: 'nav.siteBranding', icon: Palette, permission: 'settings.manage' },
      { href: '/settings/seo', label: 'nav.siteSeo', icon: Search, permission: 'settings.manage' },
      { href: '/settings/code', label: 'nav.siteCode', icon: CodeXml, permission: 'settings.manage' },
      { href: '/settings/integrations', label: 'nav.integrations', icon: Blocks, permission: 'settings.manage' },
    ],
  },
  {
    group: 'nav.group.system',
    items: [
      { href: '/operations', label: 'nav.operations', icon: Activity, permission: 'admin.read' },
      { href: '/audit', label: 'nav.audit', icon: FileClock, permission: 'admin.read' },
    ],
  },
];

const MeContext = createContext<Me | null>(null);

/** The signed-in staff member. Only available inside the console shell. */
export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error('useMe must be used inside ConsoleShell');
  return me;
}

export function useCan(permission: PlatformPermission): boolean {
  return useMe().platformPermissions.includes(permission);
}

async function signOut(): Promise<void> {
  await apiPost('/auth/logout').catch(() => undefined);
  window.location.assign('/login');
}

export function ConsoleShell({ children }: { children: ReactNode }) {
  const me = useQuery({ queryKey: ['me'], queryFn: () => apiGet<Me>('/users/me'), staleTime: 60_000, retry: false });
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  if (me.isPending) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner />
      </div>
    );
  }
  if (me.isError || !me.data) {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <Alert>{t('common.error')}</Alert>
      </div>
    );
  }
  if (!me.data.platformPermissions.length) {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="max-w-sm space-y-4 text-center">
          <Alert tone="warning">{t('login.noAccess')}</Alert>
          <Button variant="secondary" onClick={signOut}>
            <LogOut className="size-4" /> {t('login.signOut')}
          </Button>
        </div>
      </div>
    );
  }

  // Staff routes refuse sessions without a second factor; send staff to set one up first.
  if (me.data.mfaRequired && !me.data.mfaVerified) {
    return (
      <div className="grid min-h-dvh place-items-center bg-stone-100 p-4">
        <div className="w-full max-w-2xl space-y-4">
          <div className="flex items-center justify-between">
            <Brand dark />
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="size-4" /> {t('login.signOut')}
            </Button>
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">{t('mfa.gateTitle')}</h1>
            <p className="mt-1 text-sm text-stone-600">{me.data.mfaEnabled ? t('mfa.gateReauth') : t('mfa.gateBody')}</p>
          </div>
          {me.data.mfaEnabled ? (
            <Button onClick={signOut}>{t('mfa.signInAgain')}</Button>
          ) : (
            <TwoStepPanel startOpen onEnabled={() => void me.refetch()} />
          )}
        </div>
      </div>
    );
  }

  const allowed = new Set(me.data.platformPermissions);
  const isActive = (href: string) => (href === '/' || href === '/settings' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  const nav = (
    <nav aria-label={t('nav.menu')} className="space-y-5">
      {NAV.map(({ group, items }) => {
        const visible = items.filter((i) => allowed.has(i.permission));
        if (!visible.length) return null;
        return (
          <div key={group ?? 'root'}>
            {group ? <p className="mb-1.5 px-3 text-[0.65rem] font-semibold tracking-[0.18em] text-stone-400 uppercase">{t(group)}</p> : null}
            <ul className="space-y-0.5">
              {visible.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive(item.href) ? 'bg-brand-700 text-white' : 'text-stone-300 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden />
                    {t(item.label)}
                    {item.badge === 'contact' ? <NewMessagesBadge /> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const account = (
    <div className="border-t border-white/10 pt-4">
      <p className="truncate text-sm font-medium text-white">{me.data.name}</p>
      <p className="truncate text-xs text-stone-400">{me.data.email}</p>
      <p className="mt-1 text-xs text-gold-300">{t(`role.${me.data.platformRole}`)}</p>
      <Link href="/security" onClick={() => setMenuOpen(false)} className="mt-3 flex items-center gap-2 text-xs text-stone-300 hover:text-white">
        <KeyRound className="size-3.5" aria-hidden /> {t('nav.security')}
      </Link>
      <button type="button" onClick={signOut} className="mt-2 flex items-center gap-2 text-xs text-stone-300 hover:text-white">
        <LogOut className="size-3.5" aria-hidden /> {t('login.signOut')}
      </button>
    </div>
  );

  return (
    <MeContext.Provider value={me.data}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
        <aside className="hidden flex-col justify-between bg-stone-950 px-3 py-5 lg:sticky lg:top-0 lg:flex lg:h-dvh">
          <div className="min-h-0 overflow-y-auto">
            <Brand />
            <div className="mt-6">{nav}</div>
          </div>
          <div className="px-3">{account}</div>
        </aside>

        <div className="sticky top-0 z-30 flex items-center justify-between bg-stone-950 px-4 py-3 lg:hidden">
          <Brand />
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" aria-expanded={menuOpen} aria-label={t('nav.menu')} onClick={() => setMenuOpen((v) => !v)}>
            <Menu className="size-5" />
          </Button>
        </div>
        {menuOpen ? (
          <div className="fixed inset-x-0 top-14 bottom-0 z-20 overflow-y-auto bg-stone-950 px-3 py-4 lg:hidden">
            {nav}
            <div className="mt-6 px-3">{account}</div>
          </div>
        ) : null}

        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </MeContext.Provider>
  );
}

/** New contact-form messages, refreshed every minute (only rendered for staff who can see them). */
function NewMessagesBadge() {
  const counts = useQuery({ queryKey: ['admin', 'contact', 'counts'], queryFn: () => apiGet<Record<string, number>>('/admin/contact-messages/counts'), refetchInterval: 60_000 });
  const n = counts.data?.NEW ?? 0;
  if (!n) return null;
  return (
    <span className="ml-auto rounded-full bg-gold-300 px-1.5 py-px text-[0.65rem] font-bold text-brand-900 tabular-nums" aria-label={t('nav.newMessages', { count: n })}>
      {n > 99 ? '99+' : n}
    </span>
  );
}

function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2 px-3">
      <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-gold-300 to-gold-600 font-display text-lg font-bold text-brand-900">ब</span>
      <span className={cn('font-display text-xl font-semibold', dark ? 'text-stone-900' : 'text-white')}>
        Bulava <span className="text-xs font-sans font-medium tracking-[0.2em] text-gold-300 uppercase">admin</span>
      </span>
    </Link>
  );
}

/** Renders children only for staff with the permission; the API enforces it regardless. */
export function RequirePermission({ permission, children }: { permission: PlatformPermission; children: ReactNode }) {
  const can = useCan(permission);
  if (!can) return <Alert tone="warning">{t('common.forbidden')}</Alert>;
  return <>{children}</>;
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[][]) => Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

