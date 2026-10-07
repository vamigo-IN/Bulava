import type { ContactTopic } from '@bulava/validation';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Line breaks kept, everything else escaped. */
const paragraphs = (text: string) => escapeHtml(text).replace(/\r?\n/g, '<br>');

export const CONTACT_TOPIC_LABEL: Record<ContactTopic, string> = {
  GENERAL: 'General question',
  EVENT_HELP: 'Help with my event',
  BILLING: 'Payments and refunds',
  PARTNERSHIP: 'Planners and partnerships',
  PRIVACY: 'Privacy and my data',
  FEEDBACK: 'Feedback',
};

function frame(site: string, inner: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f1e9;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#6b0f1a;color:#f1d9a0;padding:18px 24px;font-family:Georgia,serif;font-size:22px">${escapeHtml(site)}</td></tr>
<tr><td style="padding:24px">${inner}</td></tr>
<tr><td style="padding:16px 24px;color:#78716c;font-size:12px;border-top:1px solid #eee">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

/**
 * New contact-form message, to the support inbox. Reply-to is the sender, so
 * answering from a mailbox works, but replying from the console keeps a record.
 */
export function contactReceivedEmail(input: { site: string; reference: string; name: string; email: string; phone: string | null; topic: ContactTopic; message: string }) {
  const topic = CONTACT_TOPIC_LABEL[input.topic];
  const subject = `[${input.reference}] ${topic}: ${input.name}`;
  const rows = [
    ['From', `${escapeHtml(input.name)} &lt;${escapeHtml(input.email)}&gt;`],
    ...(input.phone ? [['Phone', escapeHtml(input.phone)]] : []),
    ['Topic', escapeHtml(topic)],
    ['Reference', escapeHtml(input.reference)],
  ];
  const html = frame(
    input.site,
    `<h1 style="font-family:Georgia,serif;font-size:21px;margin:0 0 14px">New message from the contact form</h1>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5;margin:0 0 16px">${rows
      .map(([k, v]) => `<tr><td style="padding:2px 16px 2px 0;color:#78716c">${k}</td><td style="padding:2px 0">${v}</td></tr>`)
      .join('')}</table>
<div style="border-left:3px solid #e9c87f;padding:4px 0 4px 14px;line-height:1.6;font-size:15px">${paragraphs(input.message)}</div>`,
    'Reply from the Messages inbox in the admin console to keep a record. Replying to this email reaches the sender directly.',
  );
  const text = [
    'New message from the contact form',
    '',
    `From: ${input.name} <${input.email}>`,
    ...(input.phone ? [`Phone: ${input.phone}`] : []),
    `Topic: ${topic}`,
    `Reference: ${input.reference}`,
    '',
    input.message,
    '',
    'Reply from the Messages inbox in the admin console to keep a record.',
  ].join('\n');
  return { subject, html, text };
}

/** A reply written in the console, with the sender's message quoted underneath. */
export function contactReplyEmail(input: { site: string; reference: string; name: string; reply: string; original: string; supportEmail: string }) {
  const subject = `Re: your message to ${input.site} [${input.reference}]`;
  const html = frame(
    input.site,
    `<p style="line-height:1.6;margin:0 0 14px">Hello ${escapeHtml(input.name)},</p>
<div style="line-height:1.6;font-size:15px;margin:0 0 20px">${paragraphs(input.reply)}</div>
<p style="color:#78716c;font-size:13px;margin:0 0 6px">Your message (${escapeHtml(input.reference)}):</p>
<div style="border-left:3px solid #e7e5e4;padding:4px 0 4px 14px;color:#57534e;font-size:14px;line-height:1.5">${paragraphs(input.original)}</div>`,
    `Just reply to this email to continue the conversation, or write to ${escapeHtml(input.supportEmail)} and quote ${escapeHtml(input.reference)}.`,
  );
  const text = [
    `Hello ${input.name},`,
    '',
    input.reply,
    '',
    `Your message (${input.reference}):`,
    ...input.original.split(/\r?\n/).map((l) => `> ${l}`),
    '',
    `Just reply to this email to continue the conversation, or write to ${input.supportEmail} and quote ${input.reference}.`,
  ].join('\n');
  return { subject, html, text };
}
