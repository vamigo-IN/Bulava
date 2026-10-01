'use client';

import { ExternalLink, Tv } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, Checkbox } from '@/components/ui/primitives';
import { apiPatch, apiPost } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import type { EventAlbum } from '@/lib/types';

/** Switch the event album's live photo wall on or off, and share or replace its secret link. */
export function LiveWallControls({ eventId, room, onChanged }: { eventId: string; room: EventAlbum; onChanged: () => Promise<unknown> }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl bg-stone-50 p-3">
      <Checkbox
        label={
          <span className="inline-flex items-center gap-2">
            <Tv aria-hidden className="size-4 text-gold-600" />
            {t('wall.enable')}
          </span>
        }
        checked={room.liveWallEnabled}
        disabled={busy}
        onChange={(e) => void run(() => apiPatch(`/events/${eventId}/album`, { liveWallEnabled: e.target.checked }))}
      />
      <p className="pl-7 text-xs text-stone-500">
        {t('wall.hint')} {room.moderationMode === 'AUTO_APPROVE' ? t('wall.moderationTip') : null}
      </p>
      {error ? <Alert>{error}</Alert> : null}
      {room.liveWallEnabled && room.wallUrl ? (
        <div className="flex flex-wrap items-center gap-2 pl-7">
          <a href={room.wallUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-brand-700 px-3 text-xs font-semibold text-white hover:bg-brand-900">
            {t('wall.open')}
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
          <Button
            size="sm"
            variant="secondary"
            className="rounded-full"
            onClick={async () => {
              await navigator.clipboard.writeText(room.wallUrl!);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? t('common.copied') : t('wall.copy')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => window.confirm(t('wall.rotateConfirm')) && void run(() => apiPost(`/events/${eventId}/album/wall/rotate`))}
          >
            {t('wall.rotate')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
