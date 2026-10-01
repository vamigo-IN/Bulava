'use client';

import { useState } from 'react';
import { apiPut } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import type { EventFunction, Guest, GuestGroup } from '@/lib/types';
import { Alert, Badge, Button, Checkbox, Input, Select } from '@/components/ui/primitives';

type AssignmentMode = 'none' | 'invite' | 'block';

/**
 * Edits one guest's groups and direct function assignments, and shows the
 * effective access (computed server-side by the same evaluator guests are
 * checked with).
 */
export function GuestAccessEditor({
  eventId,
  guest,
  groups,
  functions,
  onSaved,
}: {
  eventId: string;
  guest: Guest;
  groups: GuestGroup[];
  functions: EventFunction[];
  onSaved: () => Promise<unknown>;
}) {
  const t = useT();
  const [groupIds, setGroupIds] = useState(guest.groupIds);
  const [assignments, setAssignments] = useState(() =>
    Object.fromEntries(
      functions.map((fn) => {
        const a = guest.assignments.find((x) => x.functionId === fn.id);
        const mode: AssignmentMode = !a ? 'none' : a.allowed ? 'invite' : 'block';
        return [fn.id, { mode, guestLimit: a?.guestLimit ?? 1 }];
      }),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiPut(`/events/${eventId}/guests/${guest.id}/groups`, { groupIds });
      await apiPut(`/events/${eventId}/guests/${guest.id}/functions`, {
        assignments: Object.entries(assignments)
          .filter(([, a]) => a.mode !== 'none')
          .map(([functionId, a]) => ({ functionId, allowed: a.mode === 'invite', guestLimit: a.guestLimit })),
      });
      await onSaved();
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 border-t border-stone-200 pt-4">
      {error ? <Alert>{error}</Alert> : null}
      <fieldset>
        <legend className="mb-1 text-sm font-medium">{t('guest.field.groups')}</legend>
        <div className="grid gap-x-4 sm:grid-cols-2">
          {groups.map((g) => (
            <Checkbox
              key={g.id}
              label={g.name}
              checked={groupIds.includes(g.id)}
              onChange={(e) => setGroupIds(e.target.checked ? [...groupIds, g.id] : groupIds.filter((id) => id !== g.id))}
            />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t('guest.assignFunctions')}</legend>
        <ul className="space-y-2">
          {functions.map((fn) => {
            const a = assignments[fn.id] ?? { mode: 'none' as AssignmentMode, guestLimit: 1 };
            const effective = guest.access[fn.id];
            return (
              <li key={fn.id} className="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[1fr_10rem_6rem]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm">{fn.name}</span>
                  {effective ? (
                    <Badge tone={effective.allowed ? 'success' : a.mode === 'block' ? 'danger' : 'neutral'}>
                      {effective.allowed
                        ? effective.reason === 'GROUP_AUDIENCE'
                          ? t('guest.viaGroup')
                          : t('common.yes')
                        : a.mode === 'block'
                          ? t('guest.denied')
                          : t('common.no')}
                    </Badge>
                  ) : null}
                </div>
                <Select
                  aria-label={fn.name}
                  value={a.mode}
                  onChange={(e) =>
                    setAssignments({ ...assignments, [fn.id]: { ...a, mode: e.target.value as AssignmentMode } })
                  }
                >
                  <option value="none">{t('common.none')}</option>
                  <option value="invite">{t('guest.assign.invite')}</option>
                  <option value="block">{t('guest.denied')}</option>
                </Select>
                <Input
                  aria-label={t('guest.field.guestLimit')}
                  className="col-span-2 sm:col-span-1"
                  type="number"
                  min={1}
                  max={50}
                  disabled={a.mode !== 'invite'}
                  value={a.guestLimit}
                  onChange={(e) =>
                    setAssignments({
                      ...assignments,
                      [fn.id]: { ...a, guestLimit: Math.max(1, Math.min(50, Number(e.target.value) || 1)) },
                    })
                  }
                />
              </li>
            );
          })}
        </ul>
      </fieldset>
      <Button onClick={save} disabled={busy}>
        {busy ? t('common.saving') : t('common.save')}
      </Button>
    </div>
  );
}
