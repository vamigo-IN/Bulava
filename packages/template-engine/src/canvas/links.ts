import type { RenderContext } from '@bulava/template-schema';

/** Google Calendar's "add event" link: works on every phone without a download. */
export function calendarUrl(ctx: RenderContext): string | null {
  const fn = ctx.function;
  const start = fn?.startsAt ?? ctx.event.startDate;
  if (!start) return null;
  const startDate = new Date(start);
  const endDate = fn?.endsAt ? new Date(fn.endsAt) : new Date(startDate.getTime() + 3 * 3_600_000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const venue = fn?.venue ?? ctx.venue;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: fn ? `${fn.name} · ${ctx.event.title}` : ctx.event.title,
    dates: `${stamp(startDate)}/${stamp(endDate)}`,
    ...(venue ? { location: [venue.name, venue.address, venue.city].filter(Boolean).join(', ') } : {}),
    ...(ctx.event.description ? { details: ctx.event.description } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
