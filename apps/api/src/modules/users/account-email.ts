function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const longDate = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

/**
 * Sent when someone deletes their account: what happens now, the last day to
 * change their mind, and how (sign in). Inline styles only, like the other emails.
 */
export function accountDeletionScheduledEmail(input: { site: string; name: string; deleteAt: Date; loginUrl: string; supportEmail: string }) {
  const site = escapeHtml(input.site);
  const until = longDate(input.deleteAt);
  const subject = `Your ${input.site} account will be deleted on ${until}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f6f1e9;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#6b0f1a;color:#f1d9a0;padding:18px 24px;font-family:Georgia,serif;font-size:22px">${site}</td></tr>
<tr><td style="padding:24px">
<h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">Your account is scheduled for deletion</h1>
<p style="line-height:1.55;margin:0 0 12px">Hello ${escapeHtml(input.name)}, we received your request to delete your account. Your events are offline now and your guests can no longer open their invitations.</p>
<p style="line-height:1.55;margin:0 0 12px"><strong>Changed your mind?</strong> Sign in before <strong>${escapeHtml(until)}</strong> and choose “Restore my account”. Everything comes back as it was.</p>
<p style="line-height:1.55;margin:0 0 16px">After that date your account, events, guest lists and photos are erased for good. We keep only the payment records that tax law requires.</p>
<p style="margin:20px 0 0"><a href="${escapeHtml(input.loginUrl)}" style="display:inline-block;background:#6b0f1a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold">Restore my account</a></p>
</td></tr>
<tr><td style="padding:16px 24px;color:#78716c;font-size:12px;border-top:1px solid #eee">If you didn't ask for this, sign in now to restore your account, change your password and write to ${escapeHtml(input.supportEmail)}.</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    `Hello ${input.name},`,
    '',
    'We received your request to delete your account. Your events are offline now and your guests can no longer open their invitations.',
    '',
    `Changed your mind? Sign in before ${until} and choose "Restore my account": ${input.loginUrl}`,
    '',
    'After that date your account, events, guest lists and photos are erased for good. We keep only the payment records that tax law requires.',
    '',
    `If you didn't ask for this, sign in now to restore your account, change your password and write to ${input.supportEmail}.`,
  ].join('\n');
  return { subject, html, text };
}
