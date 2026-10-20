import { previewLookToken } from '@bulava/auth';
import { firstName, previewMadeList, previewTitle } from '@bulava/database';
import { previewReadyEmail, previewRequestedEmail, previewWelcomeEmail, previewWorkEmail } from './emails';
import type { Outcome, WorkerDeps } from './processors';

// The preview desk's messages (ADR-076).

/** Requests that are over: nothing more is sent to their customer. */
const ENDED = new Set(['CLOSED', 'CANCELLED']);

/** The request a customer's message is about: their rows carry only its id (no guest, no account). */
export function previewRequestOf(payload: unknown): string | null {
  const id = (payload as { previewRequestId?: unknown } | null)?.previewRequestId;
  return typeof id === 'string' && id ? id : null;
}

/** The customer's number, as they gave it on the request. */
export async function previewRecipient(deps: Pick<WorkerDeps, 'prisma'>, requestId: string): Promise<string | null> {
  return (await deps.prisma.previewRequest.findUnique({ where: { id: requestId }, select: { phone: true } }))?.phone ?? null;
}

/** The customer's preview page: the link is signed with the request's current version, so a replaced link stops working. */
export function previewLookUrl(deps: Pick<WorkerDeps, 'env'>, request: { id: string; linkVersion: number }): string {
  return `${deps.env.WEB_ORIGIN.replace(/\/$/, '')}/look/${previewLookToken(request.id, request.linkVersion, deps.env.TOKEN_ENCRYPTION_KEY)}`;
}

/**
 * "We have your request" and "Your preview is ready", to the customer's own
 * number and email. Written when sent, so a link that waited a minute names
 * everything shared by then, and says nothing once the request is over or
 * every preview was taken back.
 */
export async function composePreviewCustomer(deps: WorkerDeps, type: string, requestId: string, channel: 'EMAIL' | 'WHATSAPP', oneLine: (text: string) => string): Promise<Outcome> {
  const request = await deps.prisma.previewRequest.findUnique({
    where: { id: requestId },
    select: { id: true, reference: true, status: true, name: true, email: true, details: true, title: true, linkVersion: true, items: { where: { status: 'SHARED' }, select: { kind: true } } },
  });
  if (!request || ENDED.has(request.status)) return { skip: 'The preview request is closed' };
  if (channel === 'EMAIL' && !request.email) return { skip: 'No email on the request' };
  const name = firstName(request.name);
  const site = channel === 'EMAIL' ? await deps.siteName() : '';

  if (type === 'PREVIEW_REQUESTED') {
    if (channel === 'WHATSAPP') return { whatsapp: { template: 'previewRequested', params: [oneLine(name), request.reference] } };
    return { email: { to: request.email!, ...previewRequestedEmail({ site, name, reference: request.reference }) } };
  }
  if (type === 'PREVIEW_READY') {
    if (request.status === 'OWNED') return { skip: 'The customer owns the designs already' };
    if (!request.items.length) return { skip: 'Nothing is shared any more' };
    const made = previewMadeList(request.items.map((item) => item.kind));
    const url = previewLookUrl(deps, request);
    if (channel === 'WHATSAPP') return { whatsapp: { template: 'previewReady', params: [oneLine(name), made, url] } };
    return { email: { to: request.email!, ...previewReadyEmail({ site, name, made, title: previewTitle(request), url }) } };
  }
  return { skip: `No ${channel === 'EMAIL' ? 'email' : 'WhatsApp'} template for ${type}` };
}

/**
 * Emails to the people who make previews: work given to them, a customer's
 * changes or WhatsApp reply, and the welcome when an admin adds them. Work
 * that moved to someone else since, or a request that is over, sends nothing.
 */
export async function composePreviewWork(deps: WorkerDeps, n: { type: string; userId: string | null }, payload: Record<string, unknown>, to: { email: string; name: string }): Promise<Outcome> {
  const web = deps.env.WEB_ORIGIN.replace(/\/$/, '');
  const site = await deps.siteName();
  if (n.type === 'PREVIEW_WELCOME') {
    const user = n.userId ? await deps.prisma.user.findUnique({ where: { id: n.userId }, select: { platformRole: true } }) : null;
    if (user?.platformRole !== 'PREVIEW_PROVIDER') return { skip: 'No longer a preview provider' };
    return { email: { to: to.email, ...previewWelcomeEmail({ site, name: to.name, url: `${web}/login?next=${encodeURIComponent('/dashboard/desk')}` }) } };
  }
  const requestId = typeof payload.requestId === 'string' ? payload.requestId : '';
  const request = requestId ? await deps.prisma.previewRequest.findUnique({ where: { id: requestId }, select: { id: true, reference: true, status: true, assigneeId: true, details: true, title: true } }) : null;
  if (!request || ENDED.has(request.status)) return { skip: 'The preview request is closed' };
  // Changes and replies go to whoever has the request now (or to the admins while nobody has it).
  if (request.assigneeId && request.assigneeId !== n.userId) return { skip: 'Someone else has the request now' };
  const url = `${web}/dashboard/desk/${request.id}`;
  const title = previewTitle(request);
  const message = typeof payload.message === 'string' ? payload.message : typeof payload.text === 'string' ? payload.text : undefined;
  if (n.type === 'PREVIEW_ASSIGNED') return { email: { to: to.email, ...previewWorkEmail({ site, name: to.name, kind: 'assigned', title, reference: request.reference, url }) } };
  if (n.type === 'PREVIEW_CHANGES') return { email: { to: to.email, ...previewWorkEmail({ site, name: to.name, kind: 'changes', title, reference: request.reference, message, url }) } };
  if (n.type === 'PREVIEW_REPLY') {
    return { email: { to: to.email, ...previewWorkEmail({ site, name: to.name, kind: 'reply', title, reference: request.reference, message: payload.optedOut === true ? `${message ?? ''}\n\n(They asked not to get WhatsApp messages: write by email if they gave one.)`.trim() : message, url }) } };
  }
  return { skip: `No email template for ${n.type}` };
}

/** Requests still being made or waiting for their customer: their preview cards are kept, however old. */
export const OPEN_PREVIEW_STATUSES = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'SENT', 'CHANGES_REQUESTED'] as const;
