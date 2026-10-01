import { createTranslator, formatEventDateWithWeekday, formatEventTime } from '@bulava/localization';

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * Minimal, email-client-safe layout (inline styles, no external assets).
 * `site` is the site name from the admin console (Branding & contact).
 */
export function layout(site: string, title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  const name = escapeHtml(site);
  return `<!doctype html><html><body style="margin:0;background:#f6f1e9;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#6b0f1a;color:#f1d9a0;padding:18px 24px;font-family:Georgia,serif;font-size:22px">${name}</td></tr>
<tr><td style="padding:24px"><h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">${escapeHtml(title)}</h1>${bodyHtml}
${cta ? `<p style="margin:24px 0 0"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#6b0f1a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold">${escapeHtml(cta.label)}</a></p>` : ''}
</td></tr>
<tr><td style="padding:16px 24px;color:#78716c;font-size:12px;border-top:1px solid #eee">You received this because of an event you are part of on ${name}.</td></tr>
</table></td></tr></table></body></html>`;
}

export function announcementEmail(input: { site: string; language: string; guestName: string; eventTitle: string; title: string; body: string; inviteUrl: string | null }) {
  const t = createTranslator(input.language);
  const paragraphs = input.body.split(/\n{2,}/).map((p) => `<p style="line-height:1.5;margin:0 0 12px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
  return {
    subject: `${input.eventTitle}: ${input.title}`,
    html: layout(input.site, input.title, `<p style="margin:0 0 12px">${escapeHtml(t('invitation.dear', { guestName: input.guestName }))}</p>${paragraphs}`, input.inviteUrl ? { label: t('email.openInvitation'), url: input.inviteUrl } : undefined),
    text: `${t('invitation.dear', { guestName: input.guestName })}\n\n${input.body}\n\n${input.inviteUrl ?? ''}`,
  };
}

export function invitationEmail(input: { site: string; language: string; guestName: string; eventTitle: string; inviteUrl: string }) {
  const t = createTranslator(input.language);
  const text = t('invitation.whatsappMessage', { guestName: input.guestName, eventTitle: input.eventTitle, url: input.inviteUrl });
  return {
    subject: `${t('invitation.youAreInvited')}: ${input.eventTitle}`,
    html: layout(input.site, input.eventTitle, `<p style="line-height:1.5">${escapeHtml(t('invitation.dear', { guestName: input.guestName }))}</p><p style="line-height:1.5">${escapeHtml(t('invitation.youAreInvited'))}.</p>`, {
      label: t('email.openInvitation'),
      url: input.inviteUrl,
    }),
    text,
  };
}

export function rsvpReceivedEmail(input: { site: string; guestName: string; eventTitle: string; responses: Array<{ functionName: string | null; status: string; attendeeCount: number }>; dashboardUrl: string }) {
  const rows = input.responses
    .map((r) => `<li>${escapeHtml(r.functionName ?? 'Event')}: <strong>${escapeHtml(r.status.toLowerCase())}</strong>${r.attendeeCount ? ` (${r.attendeeCount})` : ''}</li>`)
    .join('');
  return {
    subject: `${input.guestName} replied to ${input.eventTitle}`,
    html: layout(input.site, `New RSVP from ${input.guestName}`, `<ul style="line-height:1.6;padding-left:18px">${rows}</ul>`, { label: 'View RSVPs', url: input.dashboardUrl }),
    text: `${input.guestName} replied to ${input.eventTitle}:\n${input.responses.map((r) => `- ${r.functionName ?? 'Event'}: ${r.status} (${r.attendeeCount})`).join('\n')}\n\n${input.dashboardUrl}`,
  };
}

export function registrationUpdateEmail(input: { site: string; language: string; guestName: string; eventTitle: string; status: string }) {
  const t = createTranslator(input.language);
  const key = `email.registration.${input.status}` as Parameters<typeof t>[0];
  const body = t(key);
  return {
    subject: t('email.registration.subject', { event: input.eventTitle }),
    html: layout(input.site, input.eventTitle, `<p style="line-height:1.5">${escapeHtml(t('invitation.dear', { guestName: input.guestName }))}</p><p style="line-height:1.5">${escapeHtml(body)}</p>`),
    text: `${t('invitation.dear', { guestName: input.guestName })}

${body}`,
  };
}

/** Gentle nudge to guests who have not replied yet. */
export function rsvpReminderEmail(input: { site: string; language: string; guestName: string; eventTitle: string; inviteUrl: string }) {
  const t = createTranslator(input.language);
  const dear = t('invitation.dear', { guestName: input.guestName });
  const body = t('email.reminder.rsvp.body', { event: input.eventTitle });
  return {
    subject: t('email.reminder.rsvp.subject', { event: input.eventTitle }),
    html: layout(input.site, input.eventTitle, `<p style="line-height:1.5">${escapeHtml(dear)}</p><p style="line-height:1.5">${escapeHtml(body)}</p>`, { label: t('email.reminder.rsvp.cta'), url: input.inviteUrl }),
    text: `${dear}\n\n${body}\n\n${input.inviteUrl}`,
  };
}

/** "See you soon": when and where the function is, in the event's time zone. */
export function functionReminderEmail(input: {
  site: string;
  language: string;
  timeZone: string;
  guestName: string;
  eventTitle: string;
  functionName: string;
  startsAt: Date;
  venue: { name: string; address: string | null; city: string | null; mapUrl: string | null } | null;
  inviteUrl: string;
}) {
  const t = createTranslator(input.language);
  const fmt = { language: input.language, timeZone: input.timeZone };
  const when = `${formatEventDateWithWeekday(input.startsAt, fmt)}, ${formatEventTime(input.startsAt, fmt)}`;
  const where = input.venue ? [input.venue.name, input.venue.address, input.venue.city].filter(Boolean).join(', ') : null;
  const dear = t('invitation.dear', { guestName: input.guestName });
  const body = t('email.reminder.function.body', { function: input.functionName, event: input.eventTitle });
  const details = [`<strong>${escapeHtml(t('invitation.when'))}:</strong> ${escapeHtml(when)}`, where ? `<strong>${escapeHtml(t('invitation.venue'))}:</strong> ${escapeHtml(where)}` : null]
    .filter(Boolean)
    .join('<br>');
  const map = input.venue?.mapUrl ? `<p style="margin:12px 0 0"><a href="${escapeHtml(input.venue.mapUrl)}" style="color:#6b0f1a">${escapeHtml(t('invitation.viewMap'))}</a></p>` : '';
  return {
    subject: t('email.reminder.function.subject', { function: input.functionName, when }),
    html: layout(
      input.site,
      `${input.functionName} · ${input.eventTitle}`,
      `<p style="line-height:1.5">${escapeHtml(dear)}</p><p style="line-height:1.5">${escapeHtml(body)}</p><p style="line-height:1.7;background:#f6f1e9;border-radius:8px;padding:12px 14px">${details}</p>${map}`,
      { label: t('email.openInvitation'), url: input.inviteUrl },
    ),
    text: `${dear}\n\n${body}\n\n${t('invitation.when')}: ${when}${where ? `\n${t('invitation.venue')}: ${where}` : ''}${input.venue?.mapUrl ? `\n${input.venue.mapUrl}` : ''}\n\n${input.inviteUrl}`,
  };
}
