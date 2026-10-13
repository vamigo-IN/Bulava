'use client';

import { useState, type FormEvent } from 'react';
import { utcToZonedWallTime, zonedWallTimeToUtcIso } from '@bulava/localization';
import { CreateFunctionSchema, type VenueInput } from '@bulava/validation';
import { useT } from '@/lib/i18n';
import type { AccessMode, EventFunction, GuestGroup } from '@/lib/types';
import { Button, Checkbox, Field, Input, Select } from '@/components/ui/primitives';
import { VenueField, venueDraftFrom, venuePayload, type VenueDraft } from './venue-field';

const MODES: Array<AccessMode | 'INHERIT'> = ['INHERIT', 'INVITE_ONLY', 'GROUP_RESTRICTED', 'PRIVATE_LINK', 'SECRET_TOKEN', 'PUBLIC'];

/** A function has a start only (ADR-072): no end time is asked for or sent. */
export interface FunctionPayload {
  name: string;
  startsAt: string | null;
  /** The whole venue (the API replaces it), or null for none. */
  venue: VenueInput | null;
  accessMode: AccessMode | 'INHERIT';
  audienceGroupIds: string[];
}

/** Create/edit form. The time is entered in the event's time zone and sent as UTC. */
export function FunctionForm({
  eventId,
  initial,
  groups,
  timeZone,
  submitting,
  onSubmit,
  onCancel,
}: {
  eventId: string;
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
  const [venue, setVenue] = useState<VenueDraft>(() => venueDraftFrom(initial?.venue));
  const [accessMode, setAccessMode] = useState<AccessMode | 'INHERIT'>(initial?.accessMode ?? 'INHERIT');
  const [audience, setAudience] = useState<string[]>(initial?.audienceGroupIds ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const payload: FunctionPayload = {
      name,
      startsAt: startsAt ? zonedWallTimeToUtcIso(startsAt, timeZone) : null,
      venue: venuePayload(venue),
      accessMode,
      audienceGroupIds: audience,
    };
    const parsed = CreateFunctionSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
      return;
    }
    setErrors({});
    onSubmit(payload);
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('function.field.name')} error={errors.name}>
          {(p) => <Input {...p} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Sangeet" />}
        </Field>
        <Field label={t('function.field.startsAt')} hint={timeZone} error={errors.startsAt}>
          {(p) => <Input {...p} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />}
        </Field>
      </div>
      <VenueField
        eventId={eventId}
        value={venue}
        onChange={setVenue}
        errors={{
          name: errors['venue.name'] ? t('venue.nameRequired') : undefined,
          address: errors['venue.address'],
          spot: errors['venue.mapUrl'] ?? errors['venue.latitude'],
        }}
      />
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
