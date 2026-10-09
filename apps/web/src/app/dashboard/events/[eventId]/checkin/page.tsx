'use client';

import { useQuery } from '@tanstack/react-query';
import { ScanLine } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiGet, apiPut } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { can } from '@/lib/permissions';
import { useAttendance, useEvent } from '@/lib/queries';
import { checkInCodeFrom, QrScanner } from '@/components/checkin/qr-scanner';
import { Alert, Button, Card, Checkbox, EmptyState, Input, Spinner } from '@/components/ui/primitives';

export default function CheckInDashboard() {
  const t = useT();
  const router = useRouter();
  const { eventId } = useParams<{ eventId: string }>();
  const event = useEvent(eventId);
  const attendance = useAttendance(eventId);
  const settings = useQuery({ queryKey: ['events', eventId, 'check-in-settings'], queryFn: () => apiGet<{ entryPasses: boolean }>(`/events/${eventId}/check-ins/settings`) });
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passes = settings.data?.entryPasses ?? false;
  const canChange = can(event.data, 'event.update');

  const open = (e: FormEvent) => {
    e.preventDefault();
    const clean = checkInCodeFrom(code);
    if (clean) router.push(`/checkin/${clean}`);
  };

  const toggle = async (on: boolean) => {
    setSaving(true);
    setError(null);
    try {
      await apiPut(`/events/${eventId}/check-ins/settings`, { entryPasses: on });
      await settings.refetch();
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl">{t('checkin.dash.title')}</h2>
        <p className="mt-1 max-w-2xl text-stone-600">{t('checkin.dash.subtitle')}</p>
      </div>

      <Card className="max-w-2xl rounded-3xl">
        <h3 className="font-display text-2xl">{t('checkin.passes.title')}</h3>
        <p className="mt-1 text-sm leading-relaxed text-stone-600">{t('checkin.passes.body')}</p>
        {settings.isPending ? (
          <Spinner label={t('common.loading')} />
        ) : (
          <div className="mt-3">
            <Checkbox label={t('checkin.passes.toggle')} checked={passes} disabled={!canChange || saving} onChange={(e) => void toggle(e.target.checked)} />
            <p className="mt-1 text-xs text-stone-500">{passes ? t('checkin.passes.on') : t('checkin.passes.off')}</p>
          </div>
        )}
        {error ? (
          <div className="mt-3">
            <Alert>{error}</Alert>
          </div>
        ) : null}
      </Card>

      {passes ? (
        <Card className="max-w-2xl rounded-3xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-2xl">{t('checkin.scan.cta')}</h3>
              <p className="mt-1 text-sm text-stone-600">{t('checkin.scan.body')}</p>
            </div>
            <Button size="lg" className="rounded-full" onClick={() => setScanning(true)}>
              <ScanLine aria-hidden className="size-5" />
              {t('checkin.scan.open')}
            </Button>
          </div>
          <form onSubmit={open} className="mt-5 flex flex-col gap-3 border-t border-gold-100 pt-4 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-medium">
              {t('checkin.dash.manual')}
              <Input className="mt-1" value={code} onChange={(e) => setCode(e.target.value)} placeholder="https://bulava.in/checkin/…" />
            </label>
            <Button type="submit" variant="secondary" className="rounded-full">
              {t('checkin.dash.open')}
            </Button>
          </form>
        </Card>
      ) : null}

      {attendance.isPending ? (
        <Spinner label={t('common.loading')} />
      ) : attendance.data?.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {attendance.data.map((row) => {
            const pct = row.expectedHeadcount ? Math.min(100, Math.round((row.headcount / row.expectedHeadcount) * 100)) : 0;
            return (
              <li key={row.functionId ?? 'event'}>
                <Card className="rounded-3xl">
                  <h3 className="font-display text-2xl">{row.name}</h3>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="font-display text-5xl text-brand-700">{row.headcount}</span>
                    <span className="pb-2 text-stone-500">/ {row.expectedHeadcount}</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand">
                    <div className="h-full rounded-full bg-gradient-to-r from-gold-500 to-brand-700" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-2 text-sm text-stone-600">
                    {t('checkin.dash.arrived')} · {row.guestsCheckedIn} {t('checkin.dash.guests').toLowerCase()}
                  </p>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState>{t('function.empty')}</EmptyState>
      )}

      {scanning ? (
        <QrScanner
          onClose={() => setScanning(false)}
          onCode={(scanned) => {
            setScanning(false);
            router.push(`/checkin/${scanned}`);
          }}
        />
      ) : null}
    </div>
  );
}
