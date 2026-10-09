import { escapeHtml } from '../guest-access/otp.service';
import type { EmailCodePurpose } from './email-code.service';

const COPY: Record<EmailCodePurpose, { title: string; intro: (site: string) => string; footer: string }> = {
  signup: {
    title: 'Confirm your email',
    intro: (site) => `Enter this code to finish creating your ${site} account.`,
    footer: 'If you did not try to create an account, you can ignore this email. Nothing is created without the code.',
  },
  login: {
    title: 'Your sign-in code',
    intro: () => 'Enter this code to finish signing in.',
    footer: 'If you did not just try to sign in, someone may know your password. Choose a new one with “Forgot password?” on the sign-in page.',
  },
  claim: {
    title: 'Confirm your email',
    intro: (site) => `Enter this code to add this email address to your ${site} account.`,
    footer: 'If you did not ask for this, you can ignore this email. The address is not added without the code.',
  },
  reset: {
    title: 'Reset your password',
    intro: () => 'Enter this code to choose a new password.',
    footer: 'If you did not ask to reset your password, you can ignore this email. Your password stays the same.',
  },
};

/**
 * A six-digit code for signing up, signing in, adding an email or resetting a
 * password. The code is in the subject too, so it shows in the notification.
 * Inline styles only, like the other emails.
 */
export function emailCodeEmail(input: { site: string; name?: string; code: string; purpose: EmailCodePurpose; minutes: number }) {
  const copy = COPY[input.purpose];
  const site = escapeHtml(input.site);
  const greeting = input.name ? `Hello ${input.name},` : 'Hello,';
  const subject = `${input.code} is your ${input.site} code`;
  const html = `<!doctype html><html><body style="margin:0;background:#f6f1e9;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#6b0f1a;color:#f1d9a0;padding:18px 24px;font-family:Georgia,serif;font-size:22px">${site}</td></tr>
<tr><td style="padding:24px">
<h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">${escapeHtml(copy.title)}</h1>
<p style="line-height:1.55;margin:0 0 12px">${escapeHtml(greeting)} ${escapeHtml(copy.intro(input.site))}</p>
<p style="margin:20px 0;text-align:center"><span style="display:inline-block;background:#f8f2ea;border:1px solid #e9c87f;border-radius:10px;padding:14px 22px;font-family:'Courier New',monospace;font-size:32px;font-weight:bold;letter-spacing:8px;color:#4a0b16">${escapeHtml(input.code)}</span></p>
<p style="line-height:1.55;margin:0 0 12px">The code expires in ${input.minutes} minutes. Never share it: ${site} will never ask you for it.</p>
</td></tr>
<tr><td style="padding:16px 24px;color:#78716c;font-size:12px;border-top:1px solid #eee">${escapeHtml(copy.footer)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    greeting,
    '',
    copy.intro(input.site),
    '',
    `Your code: ${input.code}`,
    '',
    `The code expires in ${input.minutes} minutes. Never share it: ${input.site} will never ask you for it.`,
    '',
    copy.footer,
  ].join('\n');
  return { subject, html, text };
}
