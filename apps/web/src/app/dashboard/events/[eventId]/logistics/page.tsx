'use client';

import { Download, UtensilsCrossed } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { formatEventDateWithWeekday, formatEventTime, type MessageKey } from '@bulava/localization';
import { GuestLogisticsEditor } from '@/components/logistics/guest-editor';
import { SeatingPlanner } from '@/components/logistics/seating-planner';
import { MODE_ICON, type LogisticsBoard, type LogisticsGuest, type Travel } from '@/components/logistics/types';
import { Alert, Badge, Button, Card, Checkbox, EmptyState, Input, Select, Spinner } from '@/components/ui/primitives';
import { apiGet, apiPut } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { useEvent, useFunctions } from '@/lib/queries';

type Tab = 'guests' | 'movements' | 'seating';

export default function LogisticsPage() {
  const t = useT();
  const { eventId } = useParams<{ eventId: string }>();
  const event = useEvent(eventId);
  const board = useQuery({ queryKey: ['events', eventId, 'logistics'], queryFn: () => apiGet<LogisticsBoard>(`/events/${eventId}/logistics`) });
  const [tab, setTab] = useState<Tab>('guests');
  const [settingError, setSettingError] = useState<string | null>(null);

  if (board.isPending || event.isPending) return <Spinner label={t('common.loading')} />;
  if (!board.data || !event.data) return <Alert>{errorMessage(t, board.error ?? event.error)}</Alert>;
  const { summary, settings } = board.data;
  const timeZone = settings.timezone;

  async function toggleCollect(collectGuestTravel: boolean) {
    setSettingError(null);
    try {
      await apiPut(`/events/${eventId}/logistics/settings`, { collectGuestTravel });
      await board.refetch();
    } catch (err) {
      setSettingError(errorMessage(t, err));
    }
  }

  const stats: Array<{ label: string; value: number; hint?: string }> = [
    { label: t('logi.stat.vip'), value: summary.vip },
    { label: t('logi.stat.dietary'), value: summary.dietary },
    { label: t('logi.stat.stays'), value: summary.withStay, hint: summary.hotels.map((h) => `${h.hotelName} (${h.guests})`).join(' · ') || undefined },
    { label: t('logi.stat.arrivals'), value: summary.arrivals, hint: summary.pickupTravellers ? t('logi.stat.pickups', { count: summary.pickupTravellers }) : undefined },
    { label: t('logi.stat.departures'), value: summary.departures, hint: summary.dropTravellers ? t('logi.stat.drops', { count: summary.dropTravellers }) : undefined },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl">{t('logi.title')}</h2>
        <p className="mt-1 max-w-3xl text-stone-600">{t('logi.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className="rounded-2xl">
            <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">{s.label}</p>
            <p className="mt-1 font-display text-3xl lining-nums tabular-nums">{s.value}</p>
            {s.hint ? <p className="mt-1 truncate text-xs text-stone-500" title={s.hint}>{s.hint}</p> : null}
          </Card>
        ))}
      </div>

      <Card className="flex flex-wrap items-start justify-between gap-4 rounded-2xl">
        <div className="max-w-xl space-y-1">
          <Checkbox label={t('logi.collect')} checked={settings.collectGuestTravel} onChange={(e) => void toggleCollect(e.target.checked)} />
          <p className="pl-7 text-xs text-stone-500">{t('logi.collectHint')}</p>
          {settingError ? <Alert>{settingError}</Alert> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{t('logi.exports')}:</span>
          {(['travel', 'stays', 'seating'] as const).map((kind) => (
            // File downloads from the API, not pages.
             
            <a key={kind} href={`/api/v1/events/${eventId}/exports/${kind}.csv`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-gold-300 bg-white px-3.5 text-sm transition-colors hover:border-gold-500 hover:bg-gold-100/60">
              <Download aria-hidden className="size-3.5 text-gold-600" />
              {t(`logi.export.${kind}` as MessageKey)}
            </a>
          ))}
        </div>
      </Card>

      <div role="tablist" className="flex flex-wrap gap-2">
        {(['guests', 'movements', 'seating'] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`min-h-10 rounded-full border px-4 text-sm ${tab === key ? 'border-brand-700 bg-brand-700 text-white' : 'border-stone-300 bg-white hover:bg-stone-50'}`}
          >
            {t(`logi.tab.${key}` as MessageKey)}
          </button>
        ))}
      </div>

      {tab === 'guests' ? <GuestsTab eventId={eventId} guests={board.data.guests} timeZone={timeZone} language={event.data.language} onSaved={() => void board.refetch()} /> : null}
      {tab === 'movements' ? <MovementsTab guests={board.data.guests} timeZone={timeZone} language={event.data.language} /> : null}
      {tab === 'seating' ? <SeatingTab eventId={eventId} /> : null}
    </div>
  );
}

function GuestsTab({ eventId, guests, timeZone, language, onSaved }: { eventId: string; guests: LogisticsGuest[]; timeZone: string; language: string; onSaved: () => void }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const shown = guests.filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase()));
  const when = (iso: string) => `${formatEventDateWithWeekday(iso, { language, timeZone })}, ${formatEventTime(iso, { language, timeZone })}`;
  const travelLine = (tr: Travel | null) =>
    tr ? `${MODE_ICON[tr.mode]} ${[tr.carrier, tr.reference].filter(Boolean).join(' ')} · ${when(tr.at)}${tr.pickupRequested ? ' · 🚐' : ''}` : t('logi.none');

  return (
    <div className="space-y-3">
      <Input aria-label={t('logi.search')} placeholder={t('logi.search')} value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-sm" />
      <ul className="space-y-2">
        {shown.map((g) => (
          <li key={g.id} className="rounded-2xl border border-gold-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {g.name} {g.isVip ? <Badge tone="warning">⭐ {t('logi.vip')}</Badge> : null}
                </p>
                {g.dietary ? (
                  <p className="flex items-center gap-1.5 text-xs text-green-800">
                    <UtensilsCrossed aria-hidden className="size-3.5" />
                    {g.dietary}
                  </p>
                ) : null}
              </div>
              {editing === g.id ? null : (
                <Button size="sm" variant="secondary" onClick={() => setEditing(g.id)}>
                  {t('logi.edit')}
                </Button>
              )}
            </div>
            {editing === g.id ? (
              <div className="mt-3">
                <GuestLogisticsEditor
                  eventId={eventId}
                  guest={g}
                  timeZone={timeZone}
                  onCancel={() => setEditing(null)}
                  onSaved={() => {
                    setEditing(null);
                    onSaved();
                  }}
                />
              </div>
            ) : (
              <dl className="mt-2 grid gap-1 text-sm text-stone-600 md:grid-cols-3">
                <div>
                  <dt className="text-xs text-stone-500">🏨 {t('logi.stay')}</dt>
                  <dd>{g.stay ? [g.stay.hotelName, g.stay.roomNumber ? `#${g.stay.roomNumber}` : null].filter(Boolean).join(' ') : t('logi.none')}</dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-500">🛬 {t('logi.arrival')}</dt>
                  <dd>
                    {travelLine(g.arrival)} {g.arrival?.enteredByGuest ? <Badge tone="brand">{t('logi.byGuest')}</Badge> : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-500">🛫 {t('logi.departure')}</dt>
                  <dd>
                    {travelLine(g.departure)} {g.departure?.enteredByGuest ? <Badge tone="brand">{t('logi.byGuest')}</Badge> : null}
                  </dd>
                </div>
              </dl>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Arrivals and departures by day, in the event's time zone: the transport desk's view. */
function MovementsTab({ guests, timeZone, language }: { guests: LogisticsGuest[]; timeZone: string; language: string }) {
  const t = useT();
  const days = useMemo(() => {
    const items = guests.flatMap((g) => [g.arrival, g.departure].filter((x): x is Travel => !!x).map((tr) => ({ guest: g, tr })));
    items.sort((a, b) => a.tr.at.localeCompare(b.tr.at));
    const byDay = new Map<string, typeof items>();
    for (const item of items) {
      const day = formatEventDateWithWeekday(item.tr.at, { language, timeZone });
      byDay.set(day, [...(byDay.get(day) ?? []), item]);
    }
    return [...byDay];
  }, [guests, language, timeZone]);

  if (!days.length) return <EmptyState>{t('logi.noMovements')}</EmptyState>;
  return (
    <div className="space-y-5">
      {days.map(([day, items]) => (
        <section key={day}>
          <h3 className="mb-2 font-display text-xl">{day}</h3>
          <ul className="divide-y divide-gold-100 rounded-2xl border border-gold-200 bg-white">
            {items.map(({ guest, tr }) => (
              <li key={`${guest.id}-${tr.direction}`} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[90px_minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
                <p className="font-semibold tabular-nums">
                  {tr.direction === 'ARRIVAL' ? '🛬' : '🛫'} {formatEventTime(tr.at, { language, timeZone })}
                </p>
                <p>
                  <span className="font-medium">{guest.name}</span> {guest.isVip ? '⭐' : ''} · {tr.travellers} 👤
                  {guest.phone ? <span className="block text-xs text-stone-500">{guest.phone}</span> : null}
                </p>
                <p className="text-stone-600">
                  {MODE_ICON[tr.mode]} {[tr.carrier, tr.reference, tr.place].filter(Boolean).join(' · ')}
                  {tr.pickupRequested ? (
                    <span className="mt-0.5 block">
                      <Badge tone={tr.pickupNote ? 'success' : 'warning'}>🚐 {tr.direction === 'ARRIVAL' ? t('logi.pickup') : t('logi.drop')}</Badge> {tr.pickupNote}
                    </span>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SeatingTab({ eventId }: { eventId: string }) {
  const t = useT();
  const functions = useFunctions(eventId);
  const [functionId, setFunctionId] = useState<string>('');
  if (functions.isPending) return <Spinner label={t('common.loading')} />;
  const list = functions.data ?? [];
  if (!list.length) return <EmptyState>{t('logi.seating.noFunctions')}</EmptyState>;
  const selected = functionId || list[0]!.id;
  return (
    <div className="space-y-4">
      <label className="flex max-w-sm flex-col gap-1 text-sm font-medium">
        {t('logi.seating.function')}
        <Select value={selected} onChange={(e) => setFunctionId(e.target.value)}>
          {list.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      </label>
      <SeatingPlanner key={selected} eventId={eventId} functionId={selected} />
    </div>
  );
}
