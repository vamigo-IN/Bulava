import type { EventRole } from '@bulava/database';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export const ROLE_LABEL: Record<EventRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  CO_HOST: 'Co-host',
  FUNCTION_MANAGER: 'Function manager',
  GUEST_MANAGER: 'Guest manager',
  MEDIA_MANAGER: 'Photo manager',
  PHOTOGRAPHER: 'Photographer',
};

/**
 * The invitation a new team member receives: what they were invited to, the
 * 6-digit code, and the link where they enter it and create their account.
 * Inline styles only, like the worker's other emails.
 */
export function teamInviteEmail(input: { site: string; inviterName: string; eventTitle: string; role: EventRole; code: string; url: string }) {
  const site = escapeHtml(input.site);
  const role = ROLE_LABEL[input.role];
  const subject = `${input.inviterName} added you to the team for ${input.eventTitle}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f6f1e9;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#6b0f1a;color:#f1d9a0;padding:18px 24px;font-family:Georgia,serif;font-size:22px">${site}</td></tr>
<tr><td style="padding:24px">
<h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">You're on the team for ${escapeHtml(input.eventTitle)}</h1>
<p style="line-height:1.5;margin:0 0 12px">${escapeHtml(input.inviterName)} added you as <strong>${escapeHtml(role)}</strong>.</p>
<p style="line-height:1.5;margin:0 0 8px">Your code:</p>
<p style="font-size:30px;letter-spacing:8px;font-weight:bold;margin:0 0 16px">${escapeHtml(input.code)}</p>
<p style="line-height:1.5;margin:0 0 12px">Open the link, enter the code, then choose your name and password.</p>
<p style="margin:20px 0 0"><a href="${escapeHtml(input.url)}" style="display:inline-block;background:#6b0f1a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold">Join the team</a></p>
<p style="line-height:1.5;margin:16px 0 0;color:#78716c;font-size:13px">The code works once. If you were not expecting this, you can ignore this email.</p>
</td></tr>
<tr><td style="padding:16px 24px;color:#78716c;font-size:12px;border-top:1px solid #eee">Sent by ${site} on behalf of ${escapeHtml(input.inviterName)}.</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    `${input.inviterName} added you to the team for ${input.eventTitle} on ${input.site} as ${role}.`,
    '',
    `Your code: ${input.code}`,
    '',
    `Open this link, enter the code, then choose your name and password: ${input.url}`,
    '',
    'The code works once. If you were not expecting this, you can ignore this email.',
  ].join('\n');
  return { subject, html, text };
}
