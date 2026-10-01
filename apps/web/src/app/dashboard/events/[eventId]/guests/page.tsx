'use client';

import { UtensilsCrossed } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useDeferredValue, useState, type FormEvent } from 'react';
import { CreateGuestSchema } from '@bulava/validation';
import { apiDelete, apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import { useFunctions, useGroups, useGuests, useInvalidateEvent } from '@/lib/queries';
import { Alert, Badge, Button, Card, Checkbox, EmptyState, Field, Input, Spinner } from '@/components/ui/primitives';
import { GuestAccessEditor } from '@/components/events/guest-access-editor';

export default function GuestsPage() {
  const t = useT();
  const { eventId } = useParams<{ eventId: string }>();
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const guests = useGuests(eventId, q);
  const groups = useGroups(eventId);
  const functions = useFunctions(eventId);
  const invalidate = useInvalidateEvent(eventId);

  const empty = { name: '', phone: '', email: '', dietary: '', isVip: false, groupIds: [] as string[] };
  const [form, setForm] = useState(empty);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = CreateGuestSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setFieldErrors({});
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/events/${eventId}/guests`, form);
      setForm(empty);
      await invalidate();
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (guestId: string) => {
    setError(null);
    try {
      await apiDelete(`/events/${eventId}/guests/${guestId}`);
      await invalidate();
    } catch (err) {
      setError(errorMessage(t, err));
    }
  };

  if (groups.isPending || functions.isPending) return <Spinner label={t('common.loading')} />;
  const items = guests.data?.pages.flatMap((p) => p.items) ?? [];
  const customGroups = groups.data?.filter((g) => g.kind === 'CUSTOM') ?? [];
  const groupName = new Map(groups.data?.map((g) => [g.id, g.name]));

  return (
    <div className="space-y-4">
      {error ? <Alert>{error}</Alert> : null}
      <Card>
        <h2 className="mb-3 font-semibold">{t('guest.add')}</h2>
        <form onSubmit={add} className="space-y-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('guest.field.name')} error={fieldErrors.name}>
              {(p) => <Input {...p} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
            </Field>
            <Field label={t('guest.field.phone')} error={fieldErrors.phone}>
              {(p) => (
                <Input
                  {...p}
                  type="tel"
                  inputMode="tel"
                  placeholder="98765 43210"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              )}
            </Field>
            <Field label={t('guest.field.email')} error={fieldErrors.email}>
              {(p) => (
                <Input
                  {...p}
                  type="email"
                  inputMode="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              )}
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
            <Checkbox label={`⭐ ${t('logi.vip')}`} checked={form.isVip} onChange={(e) => setForm({ ...form, isVip: e.target.checked })} />
            <Field label={t('logi.dietary')} hint={t('logi.dietaryHint')}>
              {(p) => <Input {...p} maxLength={200} value={form.dietary} onChange={(e) => setForm({ ...form, dietary: e.target.value })} />}
            </Field>
          </div>
          {customGroups.length ? (
            <div className="flex flex-wrap gap-x-5">
              {customGroups.map((g) => (
                <Checkbox
                  key={g.id}
                  label={g.name}
                  checked={form.groupIds.includes(g.id)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      groupIds: e.target.checked ? [...form.groupIds, g.id] : form.groupIds.filter((id) => id !== g.id),
                    })
                  }
                />
              ))}
            </div>
          ) : null}
          <Button type="submit" disabled={busy}>
            {busy ? t('common.saving') : t('guest.add')}
          </Button>
        </form>
      </Card>

      <Input type="search" placeholder={`${t('guest.title')}…`} value={search} onChange={(e) => setSearch(e.target.value)} />

      {guests.isPending ? (
        <Spinner label={t('common.loading')} />
      ) : items.length === 0 ? (
        <EmptyState>{t('guest.empty')}</EmptyState>
      ) : (
        <ul className="space-y-2">
          {items.map((guest) => {
            const visible = functions.data?.filter((fn) => guest.access[fn.id]?.allowed) ?? [];
            return (
              <li key={guest.id}>
                <Card className="p-3 sm:p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {guest.name} {guest.isVip ? <Badge tone="warning">⭐ {t('logi.vip')}</Badge> : null}
                      </p>
                      {guest.dietary ? (
                        <p className="flex items-center gap-1.5 text-xs text-green-800">
                          <UtensilsCrossed aria-hidden className="size-3.5" />
                          {guest.dietary}
                        </p>
                      ) : null}
                      <p className="text-sm text-stone-500">{[guest.phone, guest.email].filter(Boolean).join(' · ')}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {guest.groupIds.map((id) => (
                          <Badge key={id}>{groupName.get(id)}</Badge>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-stone-500">
                        {t('guest.field.functions')}: {visible.length ? visible.map((f) => f.name).join(', ') : t('common.none')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setOpen(open === guest.id ? null : guest.id)}>
                        {t('guest.assignFunctions')}
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => remove(guest.id)}>
                        {t('common.remove')}
                      </Button>
                    </div>
                  </div>
                  {open === guest.id ? (
                    <GuestAccessEditor
                      eventId={eventId}
                      guest={guest}
                      groups={groups.data ?? []}
                      functions={functions.data ?? []}
                      onSaved={invalidate}
                    />
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {guests.hasNextPage ? (
        <Button variant="secondary" onClick={() => guests.fetchNextPage()} disabled={guests.isFetchingNextPage}>
          {guests.isFetchingNextPage ? t('common.loading') : t('common.loadMore')}
        </Button>
      ) : null}
    </div>
  );
}
