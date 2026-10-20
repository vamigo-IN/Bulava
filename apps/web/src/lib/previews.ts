import { api } from './api';
import type { CardCheckout } from './cards';

/**
 * The preview desk's browser side (ADR-076, docs/previews.md). The customer's
 * page lives at /look/<token>; the API gets the token in a header, never in an
 * API path (the API and Nginx log paths).
 */

export const LOOK_HEADER = 'x-preview-look';
export const LOOK_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export type PreviewKind = 'WEBSITE' | 'CARD' | 'FILM';
export const PREVIEW_KINDS: readonly PreviewKind[] = ['WEBSITE', 'CARD', 'FILM'];
export type PreviewStatus = 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'SENT' | 'CHANGES_REQUESTED' | 'OWNED' | 'CLOSED' | 'CANCELLED';

// ─────────────────────────── The customer's page ───────────────────────────

export interface LookItem {
  id: string;
  kind: PreviewKind;
  templateKey: string;
  templateName: string;
  sharedAt: string | null;
  /** Where it opens: the website's preview link, or this page's card and film pages; null once owned (the website is the owner's). */
  href: string | null;
  /** A card's design, photos and watermark, for its thumbnail. */
  design?: unknown;
  photos?: Record<string, string>;
  watermark?: string | null;
}

export type LookOffer =
  | { kind: 'PLAN'; planKey: string; planName: string; priceMinor: number; listPriceMinor: number | null; tagline: string | null; couponCode: string | null }
  | { kind: 'CARD'; priceMinor: number };

export interface LookView {
  reference: string;
  state: 'waiting' | 'ready' | 'owned' | 'ended';
  title: string;
  eventTypeKey: string;
  date: string | null;
  language: string;
  customerName: string;
  designer: string | null;
  /** Owned, by the account signed in on this request. */
  ownedByYou: boolean;
  items: LookItem[];
  offer: LookOffer;
}

/** "Make it yours": owned now (a plan that covers it), the plan's checkout, or a card's checkout. */
export type OwnResult = { owned: true; eventId: string | null } | { checkout: { planKey: string; couponCode: string | null; look: string } } | { cardCheckout: CardCheckout };

const look = (token: string) => ({ [LOOK_HEADER]: token });

export const lookApi = {
  get: (token: string) => api<LookView>('/public/looks', { headers: look(token) }),
  view: (token: string) => api<{ ok: true }>('/public/looks/view', { method: 'POST', body: {}, headers: look(token) }).catch(() => undefined),
  changes: (token: string, message: string) => api<{ ok: true }>('/public/looks/changes', { method: 'POST', body: { message }, headers: look(token) }),
  own: (token: string, body: { itemId?: string; name?: string; email?: string; acceptTerms?: boolean } = {}) => api<OwnResult>('/looks/own', { method: 'POST', body, headers: look(token) }),
};

/** The checkout for a preview's plan: its page's link goes with the order, so paying moves the designs into the account. */
export function lookCheckoutHref(checkout: { planKey: string; couponCode: string | null; look: string }): string {
  const query = new URLSearchParams({ plan: checkout.planKey, look: checkout.look, ...(checkout.couponCode ? { coupon: checkout.couponCode } : {}) });
  return `/dashboard/checkout?${query.toString()}`;
}

// ─────────────────────────── The account's previews ───────────────────────────

export interface MyPreview {
  reference: string;
  status: PreviewStatus;
  title: string;
  date: string | null;
  wants: PreviewKind[];
  shared: PreviewKind[];
  link: string;
  eventId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** How the customer's dashboard names a request's state. */
export function myPreviewState(p: MyPreview): 'waiting' | 'ready' | 'owned' | 'ended' {
  if (p.status === 'OWNED') return 'owned';
  if (p.status === 'CLOSED' || p.status === 'CANCELLED') return 'ended';
  return p.shared.length ? 'ready' : 'waiting';
}

// ─────────────────────────── The desk ───────────────────────────

export interface DeskSummary {
  mine: number;
  open: number;
  changes: number;
  sent: number;
}

export interface DeskRow {
  id: string;
  reference: string;
  status: PreviewStatus;
  source: 'WEBSITE' | 'STAFF';
  name: string;
  title: string;
  eventTypeKey: string;
  date: string | null;
  city: string | null;
  wants: PreviewKind[];
  templateKey: string | null;
  assignee: { id: string; name: string } | null;
  items: number;
  views: number;
  lastViewedAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeskList {
  total: number;
  page: number;
  pageSize: number;
  requests: DeskRow[];
}

export interface DeskItem {
  id: string;
  kind: PreviewKind;
  status: 'DRAFT' | 'SHARED' | 'WITHDRAWN';
  templateKey: string;
  templateName: string;
  sharedAt: string | null;
  eventId: string | null;
  cardSessionId: string | null;
  /** Where the provider designs it (null for staff who only look). */
  edit: string | null;
  /** Where the customer sees it. */
  view: string | null;
}

export interface DeskFunction {
  name: string;
  date?: string;
  time?: string;
  venue?: string;
}

export interface DeskOfferPlan {
  key: string;
  name: string;
  priceMinor: number;
  listPriceMinor: number | null;
  visibility: 'PUBLIC' | 'HIDDEN';
}

export interface DeskActivity {
  id: string;
  kind: string;
  text: string | null;
  meta: Record<string, unknown>;
  at: string;
  actor: string | null;
}

export interface DeskDetail {
  id: string;
  reference: string;
  status: PreviewStatus;
  source: 'WEBSITE' | 'STAFF';
  customer: { name: string; phone: string; email: string | null };
  celebration: {
    eventTypeKey: string;
    eventTypeName: string;
    detailsSchemaKey: string | null;
    title: string;
    details: Record<string, string>;
    date: string | null;
    venue: string | null;
    city: string | null;
    functions: DeskFunction[];
    language: string;
  };
  wants: PreviewKind[];
  template: { key: string; name: string } | null;
  notes: string | null;
  assignee: { id: string; name: string } | null;
  assignedAt: string | null;
  /** The provider of this request, or staff who manage previews: the number, the email, the editors. */
  mine: boolean;
  offer: { planKey: string | null; couponCode: string | null; plans: DeskOfferPlan[] };
  link: { path: string; url: string } | null;
  items: DeskItem[];
  views: number;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  sentAt: string | null;
  ownedAt: string | null;
  createdAt: string;
  activity: DeskActivity[];
  /** After sharing or sending again: what went out. */
  message?: { whatsapp: boolean; email: boolean; queued: boolean };
}

export const OPEN_STATUSES: readonly PreviewStatus[] = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'SENT', 'CHANGES_REQUESTED'];

/** "₹1,499" */
export const inr = (minor: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: minor % 100 ? 2 : 0 }).format(minor / 100);
