'use client';

import { useState } from 'react';
import { I18nProvider, useT } from '@/lib/i18n';
import type { GuestInvitationView } from '@/lib/types';
import { RsvpForm } from './rsvp-form';

/** RSVP form island inside a server-rendered template. */
export function RsvpIsland({ token, initialView, language }: { token: string; initialView: GuestInvitationView; language: string }) {
  const [view, setView] = useState(initialView);
  return (
    <I18nProvider language={language}>
      <RsvpForm token={token} view={view} onSaved={setView} bare />
    </I18nProvider>
  );
}

function PhotoRoomsInner({ rooms, token }: { rooms: GuestInvitationView['mediaRooms']; token: string }) {
  const t = useT();
  return (
    <ul className="mx-auto max-w-md space-y-3">
      {rooms.map((room) => (
        <li key={room.code} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--t-radius)] border border-[var(--t-secondary)]/40 bg-[var(--t-surface)] p-4">
          <span className="font-medium [font-family:var(--t-heading)] text-lg">{room.name}</span>
          <span className="flex gap-2">
            {room.uploadsEnabled ? (
              // The invitation token travels in the URL fragment, which browsers never send to servers.
              <a href={`/p/${room.code}#t=${token}`} className="inline-flex min-h-10 items-center rounded-full bg-[var(--t-primary)] px-4 text-sm font-semibold text-[var(--t-bg)]">
                {t('invite.photos.upload')}
              </a>
            ) : null}
            {room.canViewGallery ? (
              <a href={`/p/${room.code}/gallery#t=${token}`} className="inline-flex min-h-10 items-center rounded-full border border-[var(--t-primary)] px-4 text-sm font-semibold text-[var(--t-primary)]">
                {t('invite.photos.gallery')}
              </a>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PhotoRooms({ rooms, token, language }: { rooms: GuestInvitationView['mediaRooms']; token: string; language: string }) {
  return (
    <I18nProvider language={language}>
      <PhotoRoomsInner rooms={rooms} token={token} />
    </I18nProvider>
  );
}
