'use client';

import { useState, type FormEvent } from 'react';
import {
  formatEventDateWithWeekday,
  formatEventTime,
  utcToZonedWallTime,
  zonedWallTimeToUtcIso,
  type MessageKey,
} from '@bulava/localization';
import { Alert, Button, Checkbox, Field, Input, Select } from '@/components/ui/primitives';
import { apiPost } from '@/lib/api';
import { errorMessage, I18nProvider, useI18n } from '@/lib/i18n';
import type { GuestInvitationView, GuestTravel } from '@/lib/types';

type Mode = GuestTravel['mode'];
const MODES: Mode[] = ['FLIGHT', 'TRAIN', 'ROAD', 'BUS', 'OTHER'];
const ICON: Record<Mode, string> = { FLIGHT: '✈️', TRAIN: '🚆', ROAD: '🚗', BUS: '🚌', OTHER: '🧳' };

interface Draft {
  mode: Mode;
  carrier: string;
  reference: string;
  at: string;
  place: string;
  travellers: string;
  pickupRequested: boolean;
}

/** The guest's own stay, table and travel, plus a form to share travel plans when the host asks. */
function GuestLogisticsInner({ token, initialView }: { token: string; initialView: GuestInvitationView }) {
  const { t, language } = useI18n();
  const [view, setView] = useState(initialView);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const tz = view.event.timezone;
  const fmt = { language, timeZone: tz };
  const when = (iso: string) => `${formatEventDateWithWeekday(iso, fmt)}, ${formatEventTime(iso, fmt)}`;
  const { stay, arrival, departure, collectTravel } = view.logistics;
  const seats = view.functions.filter((f) => f.seat);

  const travelCard = (label: string, tr: GuestTravel, pickupKey: MessageKey) => (
    <div className="rounded-xl bg-stone-50 p-3">
      <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">{label}</p>
      <p className="mt-1 font-medium">
        {ICON[tr.mode]} {[tr.carrier, tr.reference].filter(Boolean).join(' ') || t(`invite.logistics.mode.${tr.mode}` as MessageKey)}
      </p>
      <p className="text-sm text-stone-600">
        {when(tr.at)}
        {tr.place ? ` · ${tr.place}` : ''}
        {tr.travellers > 1 ? ` · ${t('invite.logistics.travellers', { count: tr.travellers })}` : ''}
      </p>
      {tr.pickupNote ? (
        <p className="mt-1 text-sm font-medium text-green-800">🚐 {t('invite.logistics.arranged', { note: tr.pickupNote })}</p>
      ) : tr.pickupRequested ? (
        <p className="mt-1 text-sm text-stone-600">🚐 {t(pickupKey)}</p>
      ) : null}
    </div>
  );

  return (
    <section aria-labelledby="guest-logistics-heading" className="space-y-3 rounded-2xl bg-white p-5 text-stone-800 shadow-sm">
      <h2 id="guest-logistics-heading" className="text-center font-display text-xl text-brand-700">
        {t('invite.logistics.title')}
      </h2>
      {saved ? <Alert tone="success">{t('invite.logistics.saved')}</Alert> : null}

      {stay ? (
        <div className="rounded-xl bg-stone-50 p-3">
          <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">🏨 {t('invite.logistics.stay')}</p>
          <p className="mt-1 font-medium">
            {stay.hotelName}
            {stay.roomNumber ? ` · ${t('invite.logistics.room', { room: stay.roomNumber })}` : ''}
          </p>
          {stay.address ? <p className="text-sm text-stone-600">{stay.address}</p> : null}
          {stay.checkInAt ? <p className="text-sm text-stone-600">{t('invite.logistics.checkIn', { when: when(stay.checkInAt) })}</p> : null}
          {stay.checkOutAt ? <p className="text-sm text-stone-600">{t('invite.logistics.checkOut', { when: when(stay.checkOutAt) })}</p> : null}
          {stay.notes ? <p className="mt-1 text-sm">{stay.notes}</p> : null}
          {stay.mapUrl ? (
            <a href={stay.mapUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm font-medium text-brand-700 underline">
              {t('invite.logistics.map')}
            </a>
          ) : null}
        </div>
      ) : null}

      {seats.length ? (
        <div className="rounded-xl bg-stone-50 p-3">
          <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">🪑 {t('invite.logistics.seats')}</p>
          <ul className="mt-1 space-y-0.5">
            {seats.map((f) => (
              <li key={f.id}>
                <span className="font-medium">{f.name}</span>:{' '}
                {f.seat!.seatLabel
                  ? t('invite.logistics.seatWithSeat', { table: f.seat!.tableLabel, seat: f.seat!.seatLabel })
                  : t('invite.logistics.seat', { table: f.seat!.tableLabel })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!editing && arrival ? travelCard(`🛬 ${t('invite.logistics.arrival')}`, arrival, 'invite.logistics.pickupRequested') : null}
      {!editing && departure ? travelCard(`🛫 ${t('invite.logistics.departure')}`, departure, 'invite.logistics.dropRequested') : null}

      {collectTravel && view.event.status === 'ACTIVE' ? (
        editing ? (
          <TravelForm
            token={token}
            view={view}
            onCancel={() => setEditing(false)}
            onSaved={(next) => {
              setView(next);
              setEditing(false);
              setSaved(true);
            }}
          />
        ) : (
          <div className="text-center">
            {!arrival && !departure ? <p className="mb-2 text-sm text-stone-600">{t('invite.logistics.shareHint')}</p> : null}
            <Button
              variant="secondary"
              className="rounded-full"
              onClick={() => {
                setSaved(false);
                setEditing(true);
              }}
            >
              {arrival || departure ? t('invite.logistics.change') : t('invite.logistics.share')}
            </Button>
          </div>
        )
      ) : null}
    </section>
  );
}

function toDraft(tr: GuestTravel | null, tz: string): Draft | null {
  if (!tr) return null;
  return {
    mode: tr.mode,
    carrier: tr.carrier ?? '',
    reference: tr.reference ?? '',
    at: utcToZonedWallTime(tr.at, tz),
    place: tr.place ?? '',
    travellers: String(tr.travellers),
    pickupRequested: tr.pickupRequested,
  };
}

const emptyDraft = (): Draft => ({ mode: 'FLIGHT', carrier: '', reference: '', at: '', place: '', travellers: '1', pickupRequested: false });

function TravelForm({ token, view, onSaved, onCancel }: { token: string; view: GuestInvitationView; onSaved: (v: GuestInvitationView) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const tz = view.event.timezone;
  const [arrival, setArrival] = useState<Draft | null>(toDraft(view.logistics.arrival, tz) ?? emptyDraft());
  const [departure, setDeparture] = useState<Draft | null>(toDraft(view.logistics.departure, tz));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const body = (d: Draft | null) =>
    d
      ? {
          mode: d.mode,
          carrier: d.carrier,
          reference: d.reference,
          at: zonedWallTimeToUtcIso(d.at, tz),
          place: d.place,
          travellers: Math.max(1, Math.min(50, Number(d.travellers) || 1)),
          pickupRequested: d.pickupRequested,
        }
      : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSaved(await apiPost<GuestInvitationView>(`/public/invitations/${encodeURIComponent(token)}/travel`, { arrival: body(arrival), departure: body(departure) }));
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <Alert>{error}</Alert> : null}
      <Leg title={`🛬 ${t('invite.logistics.arrival')}`} add={t('invite.logistics.addArrival')} at={t('invite.logistics.arriveAt')} pickup={t('invite.logistics.needPickup')} value={arrival} onChange={setArrival} />
      <Leg title={`🛫 ${t('invite.logistics.departure')}`} add={t('invite.logistics.addDeparture')} at={t('invite.logistics.leaveAt')} pickup={t('invite.logistics.needDrop')} value={departure} onChange={setDeparture} />
      <div className="flex gap-2">
        <Button type="submit" className="rounded-full" disabled={busy || (!arrival && !departure && !view.logistics.arrival && !view.logistics.departure)}>
          {busy ? t('common.loading') : t('invite.logistics.save')}
        </Button>
        <Button variant="ghost" className="rounded-full" onClick={onCancel}>
          {t('invite.logistics.cancel')}
        </Button>
      </div>
    </form>
  );
}

function Leg({ title, add, at, pickup, value, onChange }: { title: string; add: string; at: string; pickup: string; value: Draft | null; onChange: (d: Draft | null) => void }) {
  const { t } = useI18n();
  const set = (patch: Partial<Draft>) => value && onChange({ ...value, ...patch });
  if (!value) {
    return (
      <Button size="sm" variant="secondary" className="rounded-full" onClick={() => onChange(emptyDraft())}>
        + {add}
      </Button>
    );
  }
  return (
    <fieldset className="space-y-3 rounded-xl border border-stone-200 p-3">
      <legend className="px-1 font-medium">{title}</legend>
      <Field label={t('invite.logistics.mode')}>
        {(p) => (
          <Select {...p} value={value.mode} onChange={(e) => set({ mode: e.target.value as Mode })}>
            {MODES.map((m) => (
              <option key={m} value={m}>
                {t(`invite.logistics.mode.${m}` as MessageKey)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('invite.logistics.carrier')}>{(p) => <Input {...p} maxLength={80} value={value.carrier} onChange={(e) => set({ carrier: e.target.value })} />}</Field>
        <Field label={t('invite.logistics.number')}>{(p) => <Input {...p} maxLength={40} value={value.reference} onChange={(e) => set({ reference: e.target.value })} />}</Field>
      </div>
      <Field label={at}>{(p) => <Input {...p} type="datetime-local" required value={value.at} onChange={(e) => set({ at: e.target.value })} />}</Field>
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <Field label={t('invite.logistics.place')}>{(p) => <Input {...p} maxLength={160} value={value.place} onChange={(e) => set({ place: e.target.value })} />}</Field>
        <Field label={t('invite.logistics.people')}>{(p) => <Input {...p} type="number" min={1} max={50} value={value.travellers} onChange={(e) => set({ travellers: e.target.value })} />}</Field>
      </div>
      <Checkbox label={pickup} checked={value.pickupRequested} onChange={(e) => set({ pickupRequested: e.target.checked })} />
      <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
        {t('invite.logistics.remove')}
      </Button>
    </fieldset>
  );
}

export function GuestLogistics({ token, initialView, language }: { token: string; initialView: GuestInvitationView; language: string }) {
  return (
    <I18nProvider language={language}>
      <GuestLogisticsInner token={token} initialView={initialView} />
    </I18nProvider>
  );
}

export { GuestLogisticsInner };
