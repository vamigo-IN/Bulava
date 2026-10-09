import { escapeHtml } from '../guest-access/otp.service';

/**
 * "Find my card": links to each paid card bought with this email and number.
 * The links open the order page, where the card downloads and can be emailed
 * again. Inline styles only, like the other emails.
 */
export function cardRecoveryEmail(input: { site: string; orders: Array<{ reference: string; paidAt: Date; url: string }> }) {
  const site = escapeHtml(input.site);
  const date = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const rows = input.orders
    .map(
      (o) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid #eee"><strong>${escapeHtml(o.reference)}</strong><br><span style="color:#78716c;font-size:13px">Paid on ${escapeHtml(date(o.paidAt))}</span></td><td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right"><a href="${escapeHtml(o.url)}" style="display:inline-block;background:#6b0f1a;color:#ffffff;text-decoration:none;padding:9px 16px;border-radius:999px;font-weight:bold;font-size:14px">Open card</a></td></tr>`,
    )
    .join('');
  const html = `<!doctype html><html><body style="margin:0;background:#f6f1e9;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#6b0f1a;color:#f1d9a0;padding:18px 24px;font-family:Georgia,serif;font-size:22px">${site}</td></tr>
<tr><td style="padding:24px">
<h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">Your invitation cards</h1>
<p style="line-height:1.55;margin:0 0 12px">Here ${input.orders.length === 1 ? 'is the card' : 'are the cards'} you bought on ${site}. Open one to download it again or have it emailed to you.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
<p style="line-height:1.55;margin:16px 0 0;color:#57534e;font-size:13px">Keep these links to yourself: anyone with one can download that card.</p>
</td></tr>
<tr><td style="padding:16px 24px;color:#78716c;font-size:12px;border-top:1px solid #eee">You received this because someone asked to find the cards bought with this email address. If it was not you, you can ignore it.</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    'Your invitation cards',
    '',
    `Here ${input.orders.length === 1 ? 'is the card' : 'are the cards'} you bought on ${input.site}:`,
    '',
    ...input.orders.map((o) => `${o.reference} (paid on ${date(o.paidAt)}): ${o.url}`),
    '',
    'Keep these links to yourself: anyone with one can download that card.',
  ].join('\n');
  return { subject: `Your invitation cards from ${input.site}`, html, text };
}
