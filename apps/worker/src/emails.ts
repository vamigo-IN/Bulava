import { createTranslator, formatEventDateWithWeekday, formatEventTime } from '@bulava/localization';

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * Minimal, email-client-safe layout (inline styles, no external assets).
 * `site` is the site name from the admin console (Branding & contact).
 */
export function layout(site: string, title: string, bodyHtml: string, cta?: { label: string; url: string }, footer?: string): string {
  const name = escapeHtml(site);
  return `<!doctype html><html><body style="margin:0;background:#f6f1e9;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#6b0f1a;color:#f1d9a0;padding:18px 24px;font-family:Georgia,serif;font-size:22px">${name}</td></tr>
<tr><td style="padding:24px"><h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">${escapeHtml(title)}</h1>${bodyHtml}
${cta ? `<p style="margin:24px 0 0"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#6b0f1a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold">${escapeHtml(cta.label)}</a></p>` : ''}
</td></tr>
<tr><td style="padding:16px 24px;color:#78716c;font-size:12px;border-top:1px solid #eee">${footer ? escapeHtml(footer) : `You received this because of an event you are part of on ${name}.`}</td></tr>
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

/** The last email to an account: it has now been erased, after the restore window (sent just before the address is removed). */
export function accountDeletedEmail(input: { site: string; name: string }) {
  const body = [
    `Hello ${input.name},`,
    `As you asked, your ${input.site} account has now been deleted for good, together with your events, guest lists and photos.`,
    'We keep only the payment records that tax law requires, without your contact details. You are always welcome to create a new account.',
  ];
  return {
    subject: `Your ${input.site} account has been deleted`,
    html: layout(input.site, 'Your account has been deleted', body.map((p) => `<p style="line-height:1.5;margin:0 0 12px">${escapeHtml(p)}</p>`).join('')),
    text: body.join('\n\n'),
  };
}

/** A watermark-free card, paid for: the image is attached, the order page keeps it downloadable. */
export function cardOrderEmail(input: { site: string; name: string; reference: string; amountMinor: number; paidAt: Date; paymentId: string | null; orderUrl: string; fileName: string }) {
  const amount = `₹${(input.amountMinor / 100).toFixed(2)}`;
  const paid = input.paidAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const rows: Array<[string, string]> = [
    ['Order', input.reference],
    ['Amount paid', amount],
    ['Paid on', paid],
    ...(input.paymentId ? ([['Payment ID', input.paymentId]] as Array<[string, string]>) : []),
  ];
  const receipt = rows.map(([k, v]) => `<tr><td style="padding:4px 0;color:#78716c">${escapeHtml(k)}</td><td style="padding:4px 0;text-align:right;font-weight:bold">${escapeHtml(v)}</td></tr>`).join('');
  const greeting = `Hello ${input.name},`;
  const intro = `Thank you for your purchase. Your watermark-free invitation card is attached (${input.fileName}), ready to share on WhatsApp or print.`;
  const later = 'You can download it again from your order page at any time, and have it emailed to you again from there.';
  return {
    subject: `Your invitation card is ready (${input.reference})`,
    html: layout(
      input.site,
      'Your invitation card is ready',
      `<p style="line-height:1.5;margin:0 0 12px">${escapeHtml(greeting)}</p><p style="line-height:1.5;margin:0 0 12px">${escapeHtml(intro)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1e9;border-radius:8px;padding:10px 14px;margin:0 0 12px">${receipt}</table><p style="line-height:1.5;margin:0">${escapeHtml(later)}</p>`,
      { label: 'Open my order', url: input.orderUrl },
      `You received this because you bought an invitation card on ${input.site}. Keep the order link to yourself: anyone with it can download your card.`,
    ),
    text: [greeting, '', intro, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', later, input.orderUrl].join('\n'),
  };
}

/** A registrant's place is confirmed (ADR-073): the event, when and where they are expected, and their own link. */
export function registrationConfirmedEmail(input: {
  site: string;
  language: string;
  guestName: string;
  eventTitle: string;
  when: string | null;
  venue: { name: string; address: string | null; city: string | null; mapUrl: string | null } | null;
  inviteUrl: string;
}) {
  const t = createTranslator(input.language);
  const where = input.venue ? [input.venue.name, input.venue.address, input.venue.city].filter(Boolean).join(', ') : null;
  const dear = t('invitation.dear', { guestName: input.guestName });
  const body = t('email.registration.CONFIRMED', { event: input.eventTitle });
  const details = [
    input.when ? `<strong>${escapeHtml(t('invitation.when'))}:</strong> ${escapeHtml(input.when)}` : null,
    where ? `<strong>${escapeHtml(t('invitation.venue'))}:</strong> ${escapeHtml(where)}` : null,
  ]
    .filter(Boolean)
    .join('<br>');
  const map = input.venue?.mapUrl ? `<p style="margin:12px 0 0"><a href="${escapeHtml(input.venue.mapUrl)}" style="color:#6b0f1a">${escapeHtml(t('invitation.viewMap'))}</a></p>` : '';
  const keep = t('email.registration.keepLink');
  return {
    subject: t('email.registration.CONFIRMED.subject', { event: input.eventTitle }),
    html: layout(
      input.site,
      input.eventTitle,
      `<p style="line-height:1.5">${escapeHtml(dear)}</p><p style="line-height:1.5">${escapeHtml(body)}</p>${details ? `<p style="line-height:1.7;background:#f6f1e9;border-radius:8px;padding:12px 14px">${details}</p>` : ''}${map}<p style="line-height:1.5;color:#57534e;font-size:13px">${escapeHtml(keep)}</p>`,
      { label: t('email.openInvitation'), url: input.inviteUrl },
    ),
    text: [dear, '', body, '', ...(input.when ? [`${t('invitation.when')}: ${input.when}`] : []), ...(where ? [`${t('invitation.venue')}: ${where}`] : []), ...(input.venue?.mapUrl ? [input.venue.mapUrl] : []), '', input.inviteUrl, '', keep].join('\n'),
  };
}

/** The photo album, sent by the host or the morning after the last function (ADR-073). */
export function galleryEmail(input: { site: string; language: string; guestName: string; eventTitle: string; galleryUrl: string }) {
  const t = createTranslator(input.language);
  const dear = t('invitation.dear', { guestName: input.guestName });
  const body = t('email.gallery.body', { event: input.eventTitle });
  return {
    subject: t('email.gallery.subject', { event: input.eventTitle }),
    html: layout(input.site, input.eventTitle, `<p style="line-height:1.5">${escapeHtml(dear)}</p><p style="line-height:1.5">${escapeHtml(body)}</p>`, { label: t('email.gallery.cta'), url: input.galleryUrl }),
    text: `${dear}\n\n${body}\n\n${input.galleryUrl}`,
  };
}

/** "₹599", "₹1,250.50": the amount in rupees, as receipts show it. */
export function formatRupees(minor: number): string {
  const rupees = minor / 100;
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** A plan unlocked (ADR-073): the receipt, one-time with GST, and what to do next. */
export function planPurchasedEmail(input: { site: string; name: string; plan: string; amountMinor: number; orderUrl: string }) {
  const amount = formatRupees(input.amountMinor);
  const greeting = `Hello ${input.name},`;
  const intro =
    input.amountMinor > 0
      ? `Thank you! Your ${input.plan} plan is unlocked. You paid ${amount} once, GST included: nothing renews.`
      : `Your ${input.plan} plan is unlocked with your coupon: there was nothing to pay, and nothing renews.`;
  const next = 'Your receipt and invoice details are on your payments page. Publish your invitation whenever you are ready.';
  return {
    subject: `Your ${input.plan} plan is unlocked`,
    html: layout(
      input.site,
      `Your ${input.plan} plan is unlocked`,
      `<p style="line-height:1.5;margin:0 0 12px">${escapeHtml(greeting)}</p><p style="line-height:1.5;margin:0 0 12px">${escapeHtml(intro)}</p><p style="line-height:1.5;margin:0">${escapeHtml(next)}</p>`,
      { label: 'View my receipt', url: input.orderUrl },
      `You received this because you bought a plan on ${input.site}.`,
    ),
    text: [greeting, '', intro, '', next, '', input.orderUrl].join('\n'),
  };
}

/** A payment that did not go through, or a checkout left waiting (ADR-073): the plan is still there to finish. */
export function paymentIncompleteEmail(input: { site: string; name: string; plan: string; amountMinor: number; orderUrl: string; state: 'failed' | 'pending' }) {
  const amount = formatRupees(input.amountMinor);
  const greeting = `Hello ${input.name},`;
  const intro =
    input.state === 'failed'
      ? `Your payment of ${amount} for the ${input.plan} plan did not go through. If any money left your account, your bank returns it automatically.`
      : `Your ${input.plan} plan (${amount}, paid once) is waiting for payment. It takes a minute to finish.`;
  const next = input.state === 'failed' ? 'You can try again with UPI, a card or net banking: your design and guests are safe.' : 'Your design and guests are saved: pick up where you left off.';
  const title = input.state === 'failed' ? 'Your payment did not go through' : `Finish unlocking ${input.plan}`;
  return {
    subject: title,
    html: layout(
      input.site,
      title,
      `<p style="line-height:1.5;margin:0 0 12px">${escapeHtml(greeting)}</p><p style="line-height:1.5;margin:0 0 12px">${escapeHtml(intro)}</p><p style="line-height:1.5;margin:0">${escapeHtml(next)}</p>`,
      { label: input.state === 'failed' ? 'Try again' : 'Finish payment', url: input.orderUrl },
      `You received this because you started a checkout on ${input.site}.`,
    ),
    text: [greeting, '', intro, '', next, '', input.orderUrl].join('\n'),
  };
}

/** A guest answered a WhatsApp message (ADR-073): their words, and a link to answer from the host's own WhatsApp. */
export function guestReplyEmail(input: { site: string; guestName: string; eventTitle: string; text: string; optedOut: boolean; replyUrl: string; dashboardUrl: string }) {
  const said = input.text.trim() || '(a reaction or a file)';
  const intro = `${input.guestName} replied on WhatsApp about ${input.eventTitle}:`;
  const note = input.optedOut ? `${input.guestName} asked not to get WhatsApp messages: they get email from now on.` : 'Answer them from your own WhatsApp:';
  return {
    subject: `${input.guestName} replied on WhatsApp`,
    html: layout(
      input.site,
      `${input.guestName} replied`,
      `<p style="line-height:1.5;margin:0 0 12px">${escapeHtml(intro)}</p><blockquote style="margin:0 0 12px;padding:10px 14px;background:#f6f1e9;border-left:3px solid #6b0f1a;border-radius:6px;line-height:1.5">${escapeHtml(said).replace(/\n/g, '<br>')}</blockquote><p style="line-height:1.5;margin:0">${escapeHtml(note)}</p>`,
      input.optedOut ? { label: 'Open your event', url: input.dashboardUrl } : { label: 'Reply on WhatsApp', url: input.replyUrl },
      `You received this because a guest of ${input.eventTitle} wrote to ${input.site}'s WhatsApp number.`,
    ),
    text: [intro, '', said, '', note, input.optedOut ? input.dashboardUrl : input.replyUrl].join('\n'),
  };
}
