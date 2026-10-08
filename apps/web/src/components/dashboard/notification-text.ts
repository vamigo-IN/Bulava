import { Bell, CheckCircle2, Clapperboard, UserCheck, Users, Wallet, type LucideIcon } from 'lucide-react';
import type { Translator } from '@bulava/localization';

/** One of the host's notifications (GET /notifications). */
export interface HostNotification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
  eventId: string | null;
}

const ICONS: Record<string, LucideIcon> = {
  RSVP_RECEIVED: CheckCircle2,
  RENDER_COMPLETE: Clapperboard,
  PAYMENT: Wallet,
  REGISTRATION_RECEIVED: UserCheck,
  MEMBER_ADDED: Users,
};

/** The icon, sentence and link of a notification, shared by the bell's panel and the home page. */
export function notificationView(t: Translator, n: HostNotification): { icon: LucideIcon; text: string; href: string | null } {
  const p = n.payload;
  const text =
    n.type === 'RSVP_RECEIVED'
      ? t('notif.RSVP_RECEIVED', { guest: String(p.guestName ?? ''), event: String(p.eventTitle ?? '') })
      : n.type === 'RENDER_COMPLETE'
        ? t('notif.RENDER_COMPLETE')
        : n.type === 'PAYMENT'
          ? t('notif.PAYMENT', { plan: String(p.plan ?? '') })
          : n.type === 'REGISTRATION_RECEIVED'
            ? t('notif.REGISTRATION_RECEIVED', { guest: String(p.guestName ?? ''), event: String(p.eventTitle ?? '') })
            : n.type === 'MEMBER_ADDED'
              ? t('notif.MEMBER_ADDED', { event: String(p.eventTitle ?? '') })
              : n.type;
  const href =
    n.type === 'PAYMENT' && typeof p.orderId === 'string'
      ? `/dashboard/payments/${p.orderId}`
      : n.eventId
        ? `/dashboard/events/${n.eventId}${n.type === 'RSVP_RECEIVED' ? '/rsvps' : n.type === 'RENDER_COMPLETE' ? '/video' : n.type === 'REGISTRATION_RECEIVED' ? '/registrations' : ''}`
        : null;
  return { icon: ICONS[n.type] ?? Bell, text, href };
}

/** "5 min ago", "Yesterday", "12 Oct": short, for activity lists. */
export function relativeTime(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto', style: 'short' });
  if (minutes < 1) return rtf.format(0, 'minute');
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (days < 7) return rtf.format(-days, 'day');
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
