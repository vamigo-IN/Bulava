import { CardDesignSchema, type CardDesign, type CardFormat } from '@bulava/template-schema';
import { api, ApiError } from './api';
import { readStore, recentCards, RECENT_KEY, writeStore } from './card-store';

/**
 * The digital card editor's browser side (docs/cards.md). A card's session
 * token and an order's token travel in headers, never in a URL; the browser
 * keeps them in localStorage with the latest design, so a refresh, a closed
 * dialog or a payment redirect never loses a card.
 */

export const CARD_SESSION_HEADER = 'x-card-session';
export const CARD_ORDER_HEADER = 'x-card-order';

export interface CardConfig {
  enabled: boolean;
  priceMinor: number;
  currency: string;
  paymentsReady: boolean;
  /** The free card's watermark, exactly as the export draws it. */
  watermark: string;
  formats: Record<CardFormat, { width: number; height: number; pixels: { width: number; height: number } }>;
  /** Signed in: prefill, and whether their plan covers watermark-free cards. */
  account: { name: string; email: string | null; phone: string | null; planDownload: boolean; planName: string | null } | null;
}

export interface CardUpload {
  id: string;
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'REJECTED';
  url: string | null;
  width: number | null;
  height: number | null;
  error: string | null;
}

export interface CardSessionOrder {
  reference: string;
  status: 'PENDING' | 'PAID';
  designHash: string;
  orderToken: string;
  paidAt: string | null;
}

export interface OpenedSession {
  templateKey: string;
  designHash: string;
  customized: boolean;
  updatedAt: string;
  design: unknown;
  uploads: CardUpload[];
  orders: CardSessionOrder[];
}

export interface CardExportView {
  id: string;
  kind: 'FREE' | 'PAID' | 'PLAN';
  status: 'QUEUED' | 'RENDERING' | 'READY' | 'FAILED' | 'EXPIRED';
  width: number;
  height: number;
  readyAt: string | null;
  error: string | null;
}

export interface CardCheckout {
  orderToken: string;
  reference: string;
  status: 'PENDING' | 'PAID';
  amountMinor: number;
  currency: string;
  keyId?: string;
  providerOrderId?: string;
  prefill?: { name: string; email: string; contact: string };
}

export interface CardOrderView {
  reference: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED';
  amountMinor: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  refundedAt: string | null;
  templateKey: string;
  format: CardFormat;
  width: number;
  height: number;
  email: string;
  emailStatus: 'NONE' | 'QUEUED' | 'SENT' | 'FAILED';
  emailedAt: string | null;
  paymentReference: string | null;
  failureReason: string | null;
  /** open: a checkout may still be paying; closed: the buyer closed it or it failed. */
  checkout: 'open' | 'closed' | null;
  card: { status: CardExportView['status']; readyAt: string | null; previewUrl: string | null } | null;
}

const withSession = (token: string) => ({ [CARD_SESSION_HEADER]: token });
const withOrder = (token: string) => ({ [CARD_ORDER_HEADER]: token });

export const cardApi = {
  config: () => api<CardConfig>('/public/cards/config'),
  event: (body: { type: 'TEMPLATE_SELECTED' | 'EDITOR_OPENED' | 'DOWNLOAD_MODAL_OPENED' | 'PAID_OPTION_SELECTED'; templateKey?: string; session?: string; meta?: Record<string, string | number | boolean> }) =>
    api<{ ok: true }>('/public/cards/events', { method: 'POST', body }).catch(() => undefined),
  createSession: (design: CardDesign) => api<{ token: string; designHash: string; customized: boolean; updatedAt: string }>('/public/cards/sessions', { method: 'POST', body: { design } }),
  openSession: (token: string) => api<OpenedSession>('/public/cards/session', { headers: withSession(token) }),
  saveDesign: (token: string, design: CardDesign) => api<{ designHash: string; customized: boolean; updatedAt: string }>('/public/cards/session/design', { method: 'PUT', body: { design }, headers: withSession(token) }),
  createUpload: (token: string, contentType: string, size: number) =>
    api<{ uploadId: string; uploadUrl: string; headers: Record<string, string> }>('/public/cards/session/uploads', { method: 'POST', body: { contentType, size }, headers: withSession(token) }),
  completeUpload: (token: string, id: string) => api<CardUpload>(`/public/cards/session/uploads/${id}/complete`, { method: 'POST', body: {}, headers: withSession(token) }),
  upload: (token: string, id: string) => api<CardUpload>(`/public/cards/session/uploads/${id}`, { headers: withSession(token) }),
  freeDownload: (token: string, body: { phone: string; marketingConsent: boolean }) => api<CardExportView>('/public/cards/session/free-download', { method: 'POST', body, headers: withSession(token) }),
  planDownload: (token: string) => api<CardExportView>('/cards/session/plan-download', { method: 'POST', body: {}, headers: withSession(token) }),
  exportStatus: (token: string, id: string) => api<CardExportView>(`/public/cards/session/exports/${id}`, { headers: withSession(token) }),
  exportDownload: (token: string, id: string) => api<{ url: string; fileName: string }>(`/public/cards/session/exports/${id}/download`, { method: 'POST', body: {}, headers: withSession(token) }),
  createOrder: (token: string, body: { phone: string; name: string; email: string; acceptTerms: boolean; marketingConsent: boolean }) =>
    api<CardCheckout>('/public/cards/session/orders', { method: 'POST', body, headers: withSession(token) }),
  order: (orderToken: string) => api<CardOrderView>('/public/cards/order', { headers: withOrder(orderToken) }),
  resumeOrder: (orderToken: string) => api<CardCheckout>('/public/cards/order/checkout', { method: 'POST', body: {}, headers: withOrder(orderToken) }),
  verifyOrder: (orderToken: string, body: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) =>
    api<{ status: 'PAID' }>('/public/cards/order/verify', { method: 'POST', body, headers: withOrder(orderToken) }),
  orderEvent: (orderToken: string, body: { type: 'PAYMENT_FAILED' | 'PAYMENT_CANCELLED'; reason?: string }) =>
    api<{ ok: true }>('/public/cards/order/events', { method: 'POST', body, headers: withOrder(orderToken) }).catch(() => undefined),
  orderDownload: (orderToken: string) => api<{ url: string; fileName: string }>('/public/cards/order/download', { method: 'POST', body: {}, headers: withOrder(orderToken) }),
  orderEmail: (orderToken: string) => api<{ emailStatus: 'QUEUED' }>('/public/cards/order/email', { method: 'POST', body: {}, headers: withOrder(orderToken) }),
  orderRegenerate: (orderToken: string) => api<{ status: string }>('/public/cards/order/regenerate', { method: 'POST', body: {}, headers: withOrder(orderToken) }),
  recover: (body: { email: string; phone: string }) => api<{ ok: true }>('/public/cards/recover', { method: 'POST', body }),
};

/** A link that downloads without leaving the page (the file is sent as an attachment). */
export function startDownload(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export const isSessionGone = (error: unknown) => error instanceof ApiError && (error.code === 'CARD_SESSION_EXPIRED' || error.status === 410);

// ─────────────────────────── Saved on this device ───────────────────────────

export interface StoredCard {
  templateKey: string;
  templateName: string;
  design: CardDesign;
  /** The server's copy, once the card was saved there. */
  token: string | null;
  savedAt: number;
}

const cardKey = (templateKey: string) => `bulava.card.${templateKey}`;

/** The card last designed from a template on this device, if it still reads as a design. */
export function loadStoredCard(templateKey: string): StoredCard | null {
  const stored = readStore<StoredCard>(cardKey(templateKey));
  if (!stored || stored.templateKey !== templateKey) return null;
  const design = CardDesignSchema.safeParse(stored.design);
  return design.success ? { ...stored, design: design.data } : null;
}

export function saveStoredCard(card: StoredCard): void {
  writeStore(cardKey(card.templateKey), card);
  const recent = recentCards().filter((r) => r.templateKey !== card.templateKey);
  writeStore(RECENT_KEY, [{ templateKey: card.templateKey, templateName: card.templateName, savedAt: card.savedAt }, ...recent].slice(0, 12));
}

export function forgetStoredCard(templateKey: string): void {
  try {
    localStorage.removeItem(cardKey(templateKey));
  } catch {
    // Nothing to forget.
  }
  writeStore(RECENT_KEY, recentCards().filter((r) => r.templateKey !== templateKey));
}

export { rememberOrder, storedOrders, type StoredOrder } from './card-store';

/** ₹50, ₹1,250.50 */
export function formatRupees(minor: number): string {
  const rupees = minor / 100;
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2, maximumFractionDigits: 2 })}`;
}
