'use client';

import { ScanLine } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, apiGet } from '@/lib/api';
import { errorMessage, I18nProvider, useT } from '@/lib/i18n';
import { QrScanner } from '@/components/checkin/qr-scanner';
import { Alert, Badge, Button, Checkbox, Spinner } from '@/components/ui/primitives';

interface Lookup {
  guest: { id: string; name: string; phone: string | null; notes: string | null; dietary: string | null };
  groups: Array<{ id: string; name: string }>;
  vip: boolean;
  stay: { hotelName: string; roomNumber: string | null } | null;
  functions: Array<{
    id: string;
    name: string;
    startsAt: string | null;
    tableLabel: string | null;
    seatLabel: string | null;
    rsvp: { status: string; attendeeCount: number } | null;
    checkedIn: Array<{ checkedInAt: string; headcount: number }>;
  }>;
}

function CheckIn() {
  const t = useT();
  const router = useRouter();
  const { code } = useParams<{ code: string }>();
  const [scanning, setScanning] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const [data, setData] = useState<Lookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [headcount, setHeadcount] = useState<Record<string, number>>({});
  const [reentry, setReentry] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    const lookup = await apiGet<Lookup>(`/events/${id}/check-ins/lookup/${code}`);
    setData(lookup);
    setHeadcount(Object.fromEntries(lookup.functions.map((f) => [f.id, Math.max(1, f.rsvp?.attendeeCount ?? 1)])));
  }, [code]);

  useEffect(() => {
    // A new pass (scanned from this page) starts clean.
    setData(null);
    setError(null);
    setMessage(null);
    setReentry(false);
    apiGet<{ eventId: string }>(`/check-in-codes/${code}`)
      .then(async ({ eventId: id }) => {
        setEventId(id);
        await load(id);
      })
      .catch(() => setError(t('checkin.notFound')));
  }, [code, load, t]);

  const checkIn = async (functionId: string) => {
    if (!eventId) return;
    setBusy(functionId);
    setError(null);
    setMessage(null);
    try {
      const res = await api<{ guestName: string }>(`/events/${eventId}/check-ins`, {
        method: 'POST',
        body: { code, functionId, headcount: headcount[functionId] ?? 1, allowReentry: reentry },
      });
      setMessage(t('checkin.done', { name: res.guestName }));
      await load(eventId);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="paper min-h-dvh px-4 py-8">
      <div className="mx-auto max-w-md">
        <p className="text-center text-xs font-semibold tracking-[0.3em] text-gold-600 uppercase">{t('checkin.title')}</p>
        {error ? (
          <div className="mt-6">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        {message ? (
          <div className="mt-6">
            <Alert tone="success">{message}</Alert>
          </div>
        ) : null}
        {!data && !error ? <Spinner label={t('common.loading')} /> : null}
        {data ? (
          <div className="mt-6 rounded-3xl border border-gold-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-display text-4xl">{data.guest.name}</h1>
              {data.vip ? <Badge tone="warning">⭐ {t('checkin.vip')}</Badge> : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.groups.map((g) => (
                <Badge key={g.id}>{g.name}</Badge>
              ))}
            </div>
            {data.guest.dietary ? <p className="mt-3 rounded-xl bg-green-50 p-3 text-sm font-medium text-green-900">🍽 {t('checkin.dietary', { dietary: data.guest.dietary })}</p> : null}
            {data.stay ? (
              <p className="mt-2 text-sm text-stone-700">
                🏨 {data.stay.roomNumber ? t('checkin.stayRoom', { hotel: data.stay.hotelName, room: data.stay.roomNumber }) : data.stay.hotelName}
              </p>
            ) : null}
            {data.guest.notes ? <p className="mt-3 rounded-xl bg-sand p-3 text-sm">{data.guest.notes}</p> : null}
            <h2 className="mt-6 text-sm font-semibold text-stone-600">{t('checkin.invitedTo')}</h2>
            <ul className="mt-2 space-y-3">
              {data.functions.map((fn) => {
                const last = fn.checkedIn[fn.checkedIn.length - 1];
                return (
                  <li key={fn.id} className="rounded-2xl border border-gold-200 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-2xl">{fn.name}</span>
                      {fn.rsvp ? <Badge tone={fn.rsvp.status === 'ATTENDING' ? 'success' : 'neutral'}>{t(`rsvp.status.${fn.rsvp.status}` as 'rsvp.status.ATTENDING')}</Badge> : null}
                    </div>
                    {fn.tableLabel ? (
                      <p className="mt-1 text-lg font-semibold text-brand-700">
                        {fn.seatLabel ? t('checkin.tableSeat', { table: fn.tableLabel, seat: fn.seatLabel }) : t('checkin.table', { table: fn.tableLabel })}
                      </p>
                    ) : null}
                    {last ? <p className="mt-1 text-sm font-medium text-amber-700">{t('checkin.already', { time: new Date(last.checkedInAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) })}</p> : null}
                    <div className="mt-3 flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        {t('checkin.headcount')}
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={headcount[fn.id] ?? 1}
                          onChange={(e) => setHeadcount({ ...headcount, [fn.id]: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
                          className="w-16 rounded-lg border border-stone-300 px-2 py-2 text-center"
                        />
                      </label>
                      <Button className="ml-auto rounded-full" disabled={busy !== null || (!!last && !reentry)} onClick={() => checkIn(fn.id)}>
                        {t('checkin.action')}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Checkbox className="mt-3" label={t('checkin.reentry')} checked={reentry} onChange={(e) => setReentry(e.target.checked)} />
          </div>
        ) : null}
        <Button variant="secondary" size="lg" className="mt-5 w-full rounded-full" onClick={() => setScanning(true)}>
          <ScanLine aria-hidden className="size-5" />
          {t('checkin.scan.next')}
        </Button>
      </div>
      {scanning ? (
        <QrScanner
          onClose={() => setScanning(false)}
          onCode={(next) => {
            setScanning(false);
            router.push(`/checkin/${next}`);
          }}
        />
      ) : null}
    </main>
  );
}

export default function CheckInPage() {
  return (
    <I18nProvider language="en">
      <CheckIn />
    </I18nProvider>
  );
}
