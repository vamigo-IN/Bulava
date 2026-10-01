'use client';

import { useState, type FormEvent } from 'react';
import { utcToZonedWallTime, zonedWallTimeToUtcIso } from '@bulava/localization';
import { CreateFunctionSchema } from '@bulava/validation';
import { useT } from '@/lib/i18n';
import type { AccessMode, EventFunction, GuestGroup } from '@/lib/types';
import { Button, Checkbox, Field, Input, Select } from '@/components/ui/primitives';

const MODES: Array<AccessMode | 'INHERIT'> = ['INHERIT', 'INVITE_ONLY', 'GROUP_RESTRICTED', 'PRIVATE_LINK', 'SECRET_TOKEN', 'PUBLIC'];

export interface FunctionPayload {
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  venue: { name: string; address?: string; city?: string } | null;
  accessMode: AccessMode | 'INHERIT';
  audienceGroupIds: string[];
}

/** Create/edit form. Times are entered in the event's time zone and sent as UTC. */
export function FunctionForm({
  initial,
  groups,
  timeZone,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: EventFunction;
  groups: GuestGroup[];
  timeZone: string;
  submitting: boolean;
  onSubmit: (payload: FunctionPayload) => void;
  onCancel?: () => void;
}) {
  const t = useT();
  const [name, setName] = useState(initial?.name ?? '');
  const [startsAt, setStartsAt] = useState(initial?.startsAt ? utcToZonedWallTime(initial.startsAt, timeZone) : '');
  const [endsAt, setEndsAt] = useState(initial?.endsAt ? utcToZonedWallTime(initial.endsAt, timeZone) : '');
  const [venueName, setVenueName] = useState(initial?.venue?.name ?? '');
  const [venueAddress, setVenueAddress] = useState(initial?.venue?.address ?? '');
  const [accessMode, setAccessMode] = useState<AccessMode | 'INHERIT'>(initial?.accessMode ?? 'INHERIT');
  const [audience, setAudience] = useState<string[]>(initial?.audienceGroupIds ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const payload: FunctionPayload = {
      name,
      startsAt: startsAt ? zonedWallTimeToUtcIso(startsAt, timeZone) : null,
      endsAt: endsAt ? zonedWallTimeToUtcIso(endsAt, timeZone) : null,
      venue: venueName.trim() ? { name: venueName, address: venueAddress || undefined } : null,
      accessMode,
      audienceGroupIds: audience,
    };
    const parsed = CreateFunctionSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0]?.toString() ?? '', i.message])));
      return;
    }
    setErrors({});
    onSubmit(payload);
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label={t('function.field.name')} error={errors.name}>
        {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="Sangeet" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('function.field.startsAt')} hint={timeZone} error={errors.startsAt}>
          {(p) => <Input {...p} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />}
        </Field>
        <Field label={t('function.field.endsAt')} error={errors.endsAt}>
          {(p) => <Input {...p} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('function.field.venueName')}>
          {(p) => <Input {...p} value={venueName} onChange={(e) => setVenueName(e.target.value)} />}
        </Field>
        <Field label={t('function.field.venueAddress')}>
          {(p) => <Input {...p} value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} />}
        </Field>
      </div>
      <Field label={t('function.field.accessMode')}>
        {(p) => (
          <Select {...p} value={accessMode} onChange={(e) => setAccessMode(e.target.value as AccessMode | 'INHERIT')}>
            {MODES.map((m) => (
              <option key={m} value={m}>
                {m === 'INHERIT' ? t('access.inherit') : t(`access.${m}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-stone-700">{t('function.field.audienceGroups')}</legend>
        <div className="grid gap-x-4 sm:grid-cols-2">
          {groups.map((g) => (
            <Checkbox
              key={g.id}
              label={g.name}
              checked={audience.includes(g.id)}
              onChange={(e) => setAudience(e.target.checked ? [...audience, g.id] : audience.filter((id) => id !== g.id))}
            />
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? t('common.saving') : initial ? t('common.save') : t('function.add')}
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
