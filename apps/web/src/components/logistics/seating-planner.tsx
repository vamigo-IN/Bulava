'use client';

import { UtensilsCrossed } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { MessageKey } from '@bulava/localization';
import { Alert, Badge, Button, EmptyState, Input, Spinner } from '@/components/ui/primitives';
import { apiGet, apiPut } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import type { SeatingPlan } from './types';

type Draft = Record<string, { table: string; seat: string }>;

/** Table plan for one function: type a table (and seat) next to each invited guest. */
export function SeatingPlanner({ eventId, functionId }: { eventId: string; functionId: string }) {
  const t = useT();
  const plan = useQuery({
    queryKey: ['events', eventId, 'seating', functionId],
    queryFn: () => apiGet<SeatingPlan>(`/events/${eventId}/functions/${functionId}/seating`),
  });
  if (plan.isPending) return <Spinner label={t('common.loading')} />;
  if (!plan.data) return <Alert>{errorMessage(t, plan.error)}</Alert>;
  // Remount the editor when the saved plan changes so drafts start from the server state.
  return <SeatingEditor key={JSON.stringify(plan.data.seats)} eventId={eventId} plan={plan.data} onSaved={() => void plan.refetch()} />;
}

function SeatingEditor({ eventId, plan, onSaved }: { eventId: string; plan: SeatingPlan; onSaved: () => void }) {
  const t = useT();
  const [draft, setDraft] = useState<Draft>(() =>
    Object.fromEntries(plan.seats.map((s) => [s.guestId, { table: s.tableLabel, seat: s.seatLabel ?? '' }])),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const tables = useMemo(() => {
    const byTable = new Map<string, string[]>();
    for (const g of plan.guests) {
      const table = draft[g.id]?.table.trim();
      if (table) byTable.set(table, [...(byTable.get(table) ?? []), g.name]);
    }
    return [...byTable].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }));
  }, [draft, plan.guests]);
  const seated = tables.reduce((n, [, names]) => n + names.length, 0);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const seats = Object.entries(draft)
        .filter(([, v]) => v.table.trim())
        .map(([guestId, v]) => ({ guestId, tableLabel: v.table.trim(), seatLabel: v.seat.trim() }));
      await apiPut(`/events/${eventId}/functions/${plan.function.id}/seating`, { seats });
      setMessage({ tone: 'success', text: t('logi.seating.saved') });
      onSaved();
    } catch (err) {
      setMessage({ tone: 'danger', text: errorMessage(t, err) });
    } finally {
      setBusy(false);
    }
  }

  if (!plan.guests.length) return <EmptyState>{t('logi.seating.none')}</EmptyState>;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-3">
        <p className="text-sm text-stone-600">{t('logi.seating.hint')}</p>
        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
        <ul className="divide-y divide-gold-100 rounded-2xl border border-gold-200 bg-white">
          {plan.guests.map((g) => {
            const value = draft[g.id] ?? { table: '', seat: '' };
            const set = (patch: Partial<typeof value>) => setDraft((d) => ({ ...d, [g.id]: { ...value, ...patch } }));
            return (
              <li key={g.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {g.isVip ? '⭐ ' : ''}
                    {g.name}
                  </p>
                  <p className="flex flex-wrap gap-1.5 text-xs text-stone-500">
                    {g.rsvp ? <Badge tone={g.rsvp.status === 'ATTENDING' ? 'success' : 'neutral'}>{t(`rsvp.status.${g.rsvp.status}` as MessageKey)}{g.rsvp.status === 'ATTENDING' ? ` · ${g.rsvp.attendeeCount}` : ''}</Badge> : null}
                    {g.dietary ? (
                      <span className="inline-flex items-center gap-1">
                        <UtensilsCrossed aria-hidden className="size-3" />
                        {g.dietary}
                      </span>
                    ) : null}
                    {!g.invited ? <Badge tone="danger">{t('logi.seating.notInvited')}</Badge> : null}
                  </p>
                </div>
                <Input aria-label={`${t('logi.seating.table')} – ${g.name}`} placeholder={t('logi.seating.table')} maxLength={40} value={value.table} onChange={(e) => set({ table: e.target.value })} className="w-24" />
                <Input aria-label={`${t('logi.seating.seat')} – ${g.name}`} placeholder={t('logi.seating.seat')} maxLength={20} value={value.seat} onChange={(e) => set({ seat: e.target.value })} className="w-20" />
              </li>
            );
          })}
        </ul>
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? t('common.loading') : t('logi.seating.save')}
        </Button>
      </div>
      <aside className="space-y-2 lg:sticky lg:top-20 lg:self-start">
        <p className="text-sm font-medium">{t('logi.seating.tables', { tables: tables.length, seated, total: plan.guests.length })}</p>
        <ul className="space-y-2">
          {tables.map(([table, names]) => (
            <li key={table} className="rounded-xl border border-gold-200 bg-white p-3 text-sm">
              <p className="font-display text-lg lining-nums">
                {t('checkin.table', { table })} <span className="text-xs text-stone-500">({names.length})</span>
              </p>
              <p className="text-stone-600">{names.join(', ')}</p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
