'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useT } from '@/lib/i18n';
import { useAttendance } from '@/lib/queries';
import { Button, Card, EmptyState, Input, Spinner } from '@/components/ui/primitives';

export default function CheckInDashboard() {
  const t = useT();
  const router = useRouter();
  const { eventId } = useParams<{ eventId: string }>();
  const attendance = useAttendance(eventId);
  const [code, setCode] = useState('');

  const open = (e: FormEvent) => {
    e.preventDefault();
    const clean = code.trim().split('/').pop() ?? '';
    if (/^[A-Za-z0-9]{8,24}$/.test(clean)) router.push(`/checkin/${clean}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl">{t('checkin.dash.title')}</h2>
        <p className="mt-1 max-w-2xl text-stone-600">{t('checkin.dash.subtitle')}</p>
      </div>
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
      <Card className="max-w-lg rounded-3xl">
        <form onSubmit={open} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-medium">
            {t('checkin.dash.manual')}
            <Input className="mt-1" value={code} onChange={(e) => setCode(e.target.value)} placeholder="https://bulava.in/checkin/…" />
          </label>
          <Button type="submit" className="rounded-full">
            {t('checkin.dash.open')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
