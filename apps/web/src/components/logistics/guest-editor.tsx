'use client';

import { useState, type FormEvent } from 'react';
import type { MessageKey } from '@bulava/localization';
import { utcToZonedWallTime, zonedWallTimeToUtcIso } from '@bulava/localization';
import { Alert, Button, Checkbox, Field, Input, Select } from '@/components/ui/primitives';
import { apiPut } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { TRAVEL_MODES, type LogisticsGuest, type Stay, type Travel, type TravelMode } from './types';

interface StayDraft {
  hotelName: string;
  roomNumber: string;
  roomType: string;
  address: string;
  mapUrl: string;
  checkInAt: string;
  checkOutAt: string;
  notes: string;
}

interface TravelDraft {
  mode: TravelMode;
  carrier: string;
  reference: string;
  at: string;
  place: string;
  travellers: string;
  pickupRequested: boolean;
  pickupNote: string;
}

const wall = (iso: string | null, tz: string) => (iso ? utcToZonedWallTime(iso, tz) : '');
const utc = (value: string, tz: string) => (value ? zonedWallTimeToUtcIso(value, tz) : null);

function stayDraft(s: Stay | null, tz: string): StayDraft | null {
  if (!s) return null;
  return {
    hotelName: s.hotelName,
    roomNumber: s.roomNumber ?? '',
    roomType: s.roomType ?? '',
    address: s.address ?? '',
    mapUrl: s.mapUrl ?? '',
    checkInAt: wall(s.checkInAt, tz),
    checkOutAt: wall(s.checkOutAt, tz),
    notes: s.notes ?? '',
  };
}

function travelDraft(t: Travel | null, tz: string): TravelDraft | null {
  if (!t) return null;
  return {
    mode: t.mode,
    carrier: t.carrier ?? '',
    reference: t.reference ?? '',
    at: wall(t.at, tz),
    place: t.place ?? '',
    travellers: String(t.travellers),
    pickupRequested: t.pickupRequested,
    pickupNote: t.pickupNote ?? '',
  };
}

const EMPTY_STAY: StayDraft = { hotelName: '', roomNumber: '', roomType: '', address: '', mapUrl: '', checkInAt: '', checkOutAt: '', notes: '' };
const emptyTravel = (): TravelDraft => ({ mode: 'FLIGHT', carrier: '', reference: '', at: '', place: '', travellers: '1', pickupRequested: false, pickupNote: '' });

/** Edits one guest's VIP flag, dietary needs, stay, arrival and departure. */
export function GuestLogisticsEditor({
  eventId,
  guest,
  timeZone,
  onSaved,
  onCancel,
}: {
  eventId: string;
  guest: LogisticsGuest;
  timeZone: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [isVip, setVip] = useState(guest.isVip);
  const [dietary, setDietary] = useState(guest.dietary ?? '');
  const [stay, setStay] = useState<StayDraft | null>(stayDraft(guest.stay, timeZone));
  const [arrival, setArrival] = useState<TravelDraft | null>(travelDraft(guest.arrival, timeZone));
  const [departure, setDeparture] = useState<TravelDraft | null>(travelDraft(guest.departure, timeZone));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const travelBody = (d: TravelDraft | null) =>
    d
      ? {
          mode: d.mode,
          carrier: d.carrier,
          reference: d.reference,
          at: utc(d.at, timeZone),
          place: d.place,
          travellers: Math.max(1, Math.min(50, Number(d.travellers) || 1)),
          pickupRequested: d.pickupRequested,
          pickupNote: d.pickupNote,
        }
      : null;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPut(`/events/${eventId}/guests/${guest.id}/logistics`, {
        isVip,
        dietary: dietary.trim() || null,
        stay: stay
          ? {
              hotelName: stay.hotelName,
              roomNumber: stay.roomNumber,
              roomType: stay.roomType,
              address: stay.address,
              mapUrl: stay.mapUrl,
              checkInAt: utc(stay.checkInAt, timeZone),
              checkOutAt: utc(stay.checkOutAt, timeZone),
              notes: stay.notes,
            }
          : null,
        arrival: travelBody(arrival),
        departure: travelBody(departure),
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  const setS = (patch: Partial<StayDraft>) => setStay((s) => (s ? { ...s, ...patch } : s));

  return (
    <form onSubmit={save} className="space-y-5 rounded-2xl border border-gold-300 bg-ivory p-4">
      {error ? <Alert>{error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
        <Checkbox label={`⭐ ${t('logi.vip')}`} checked={isVip} onChange={(e) => setVip(e.target.checked)} />
        <Field label={t('logi.dietary')} hint={t('logi.dietaryHint')}>
          {(p) => <Input {...p} maxLength={200} value={dietary} onChange={(e) => setDietary(e.target.value)} />}
        </Field>
      </div>

      <fieldset className="space-y-3">
        <legend className="font-semibold">🏨 {t('logi.stay')}</legend>
        {stay ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t('logi.hotel')}>{(p) => <Input {...p} required maxLength={160} value={stay.hotelName} onChange={(e) => setS({ hotelName: e.target.value })} />}</Field>
              <Field label={t('logi.room')}>{(p) => <Input {...p} maxLength={40} value={stay.roomNumber} onChange={(e) => setS({ roomNumber: e.target.value })} />}</Field>
              <Field label={t('logi.roomType')}>{(p) => <Input {...p} maxLength={80} value={stay.roomType} onChange={(e) => setS({ roomType: e.target.value })} />}</Field>
              <Field label={t('logi.checkIn')}>{(p) => <Input {...p} type="datetime-local" value={stay.checkInAt} onChange={(e) => setS({ checkInAt: e.target.value })} />}</Field>
              <Field label={t('logi.checkOut')}>{(p) => <Input {...p} type="datetime-local" value={stay.checkOutAt} onChange={(e) => setS({ checkOutAt: e.target.value })} />}</Field>
              <Field label={t('logi.mapUrl')}>{(p) => <Input {...p} type="url" maxLength={1000} value={stay.mapUrl} onChange={(e) => setS({ mapUrl: e.target.value })} />}</Field>
            </div>
            <Field label={t('logi.address')}>{(p) => <Input {...p} maxLength={500} value={stay.address} onChange={(e) => setS({ address: e.target.value })} />}</Field>
            <Field label={t('logi.notes')}>{(p) => <Input {...p} maxLength={1000} value={stay.notes} onChange={(e) => setS({ notes: e.target.value })} />}</Field>
            <Button size="sm" variant="ghost" onClick={() => setStay(null)}>
              {t('logi.removeStay')}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setStay({ ...EMPTY_STAY })}>
            + {t('logi.addStay')}
          </Button>
        )}
      </fieldset>

      <TravelFields label={`🛬 ${t('logi.arrival')}`} addLabel={t('logi.addArrival')} atLabel={t('logi.arriveAt')} pickupLabel={t('logi.pickup')} value={arrival} onChange={setArrival} />
      <TravelFields label={`🛫 ${t('logi.departure')}`} addLabel={t('logi.addDeparture')} atLabel={t('logi.leaveAt')} pickupLabel={t('logi.drop')} value={departure} onChange={setDeparture} />

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? t('common.loading') : t('common.save')}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

function TravelFields({
  label,
  addLabel,
  atLabel,
  pickupLabel,
  value,
  onChange,
}: {
  label: string;
  addLabel: string;
  atLabel: string;
  pickupLabel: string;
  value: TravelDraft | null;
  onChange: (next: TravelDraft | null) => void;
}) {
  const t = useT();
  const set = (patch: Partial<TravelDraft>) => value && onChange({ ...value, ...patch });
  return (
    <fieldset className="space-y-3">
      <legend className="font-semibold">{label}</legend>
      {value ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('logi.mode')}>
              {(p) => (
                <Select {...p} value={value.mode} onChange={(e) => set({ mode: e.target.value as TravelMode })}>
                  {TRAVEL_MODES.map((m) => (
                    <option key={m} value={m}>
                      {t(`logi.mode.${m}` as MessageKey)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('logi.carrier')}>{(p) => <Input {...p} maxLength={80} value={value.carrier} onChange={(e) => set({ carrier: e.target.value })} />}</Field>
            <Field label={t('logi.reference')}>{(p) => <Input {...p} maxLength={40} value={value.reference} onChange={(e) => set({ reference: e.target.value })} />}</Field>
            <Field label={atLabel}>{(p) => <Input {...p} type="datetime-local" required value={value.at} onChange={(e) => set({ at: e.target.value })} />}</Field>
            <Field label={t('logi.place')}>{(p) => <Input {...p} maxLength={160} value={value.place} onChange={(e) => set({ place: e.target.value })} />}</Field>
            <Field label={t('logi.travellers')}>{(p) => <Input {...p} type="number" min={1} max={50} value={value.travellers} onChange={(e) => set({ travellers: e.target.value })} />}</Field>
          </div>
          <Checkbox label={pickupLabel} checked={value.pickupRequested} onChange={(e) => set({ pickupRequested: e.target.checked })} />
          {value.pickupRequested ? (
            <Field label={t('logi.pickupNote')} hint={t('logi.pickupNoteHint')}>
              {(p) => <Input {...p} maxLength={500} value={value.pickupNote} onChange={(e) => set({ pickupNote: e.target.value })} />}
            </Field>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
            {t('logi.remove')}
          </Button>
        </>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => onChange(emptyTravel())}>
          + {addLabel}
        </Button>
      )}
    </fieldset>
  );
}
