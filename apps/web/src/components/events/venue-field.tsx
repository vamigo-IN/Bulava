'use client';

import { ExternalLink, Loader2, LocateFixed, MapPin, MapPinned, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { placeIdFromMapUrl, type VenueInput } from '@bulava/validation';
import { ApiError } from '@/lib/api';
import { errorMessage, useT } from '@/lib/i18n';
import {
  embedMapUrl,
  mapsSearchUrl,
  newSessionToken,
  placeDetails,
  placesStatus,
  resolveMapLink,
  searchPlaces,
  type PlaceLocation,
  type PlaceSuggestion,
} from '@/lib/places';
import type { Venue } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button, Field, Input } from '@/components/ui/primitives';

/** What the venue field edits: text as typed, and the spot (from the search or a Google Maps link). */
export interface VenueDraft {
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  /** From Google; India until a place says otherwise. */
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Guests' directions: the chosen place's or the pasted pin's Google Maps link. */
  mapUrl: string | null;
}

export const EMPTY_VENUE: VenueDraft = { name: '', address: '', city: '', state: '', postalCode: '', country: null, latitude: null, longitude: null, mapUrl: null };

export function venueDraftFrom(venue: Venue | null | undefined): VenueDraft {
  if (!venue) return EMPTY_VENUE;
  return {
    name: venue.name,
    address: venue.address ?? '',
    city: venue.city ?? '',
    state: venue.state ?? '',
    postalCode: venue.postalCode ?? '',
    country: venue.country,
    latitude: venue.latitude,
    longitude: venue.longitude,
    mapUrl: venue.mapUrl,
  };
}

/** The venue to send (the whole of it: the API replaces the venue), or null when nothing was entered. */
export function venuePayload(d: VenueDraft): VenueInput | null {
  const hasSpot = d.latitude !== null && d.longitude !== null;
  if (!d.name.trim() && !d.address.trim() && !d.city.trim() && !hasSpot) return null;
  return {
    name: d.name,
    address: d.address,
    city: d.city,
    state: d.state,
    postalCode: d.postalCode,
    ...(d.country ? { country: d.country } : {}),
    latitude: hasSpot ? d.latitude : null,
    longitude: hasSpot ? d.longitude : null,
    mapUrl: d.mapUrl ?? '',
  } as VenueInput;
}

/** A place's address often starts with its own name ("Rambagh Palace, Bhawani Singh Rd…"): the name has its own field. */
function withoutName(address: string | null, name: string): string {
  if (!address) return '';
  const lead = name.trim().toLowerCase();
  return lead && address.toLowerCase().startsWith(`${lead}, `) ? address.slice(lead.length + 2) : address;
}

function fromPlace(d: VenueDraft, place: PlaceLocation, name: string): VenueDraft {
  return {
    ...d,
    name,
    address: withoutName(place.address, name),
    city: place.city ?? '',
    state: place.state ?? '',
    postalCode: place.postalCode ?? '',
    country: place.country,
    latitude: place.latitude,
    longitude: place.longitude,
    mapUrl: place.mapUrl,
  };
}

type SearchField = 'name' | 'address';

/**
 * A function's venue (ADR-072). The name is typed; typing it, or the address,
 * searches Google Maps (through the API, India first) and choosing a
 * suggestion fills the address, city, state, PIN code and the spot guests get
 * directions to. "Location not found" opens Google Maps for the host to drop
 * a pin and paste its link. A small map confirms the spot. Without venue
 * search (Maps off) the fields are plain, and a Google Maps link still sets
 * the spot.
 */
export function VenueField({
  eventId,
  value,
  onChange,
  errors = {},
}: {
  eventId: string;
  value: VenueDraft;
  onChange: (next: VenueDraft) => void;
  errors?: { name?: string; address?: string; spot?: string };
}) {
  const t = useT();
  const status = useQuery({ queryKey: ['events', eventId, 'places-status'], queryFn: () => placesStatus(eventId), staleTime: 300_000, retry: false });
  const [searchOff, setSearchOff] = useState<string | null>(null);
  const canSearch = Boolean(status.data?.search) && !searchOff;
  const hasSpot = value.latitude !== null && value.longitude !== null;

  const listId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState<SearchField | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<{ q: string; suggestions: PlaceSuggestion[] } | null>(null);
  const [highlight, setHighlight] = useState(-1);
  const [choosing, setChoosing] = useState(false);
  const session = useRef<string | null>(null);
  const cache = useRef(new Map<string, PlaceSuggestion[]>());
  const latest = useRef(0);

  const [pinOpen, setPinOpen] = useState(false);
  const [pinText, setPinText] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const q = query.trim();
  const searching = open && q.length >= 3 && results?.q !== q;
  const suggestions = results?.q === q ? results.suggestions : (results?.suggestions ?? []);

  // Search as the host types (a short pause first), each answer kept for the visit.
  useEffect(() => {
    if (!canSearch || !open || q.length < 3) return;
    const known = cache.current.get(q.toLowerCase());
    if (known) {
      setResults({ q, suggestions: known });
      return;
    }
    const ticket = ++latest.current;
    const timer = setTimeout(() => {
      session.current ??= newSessionToken();
      searchPlaces(eventId, q, session.current)
        .then(({ suggestions: found }) => {
          cache.current.set(q.toLowerCase(), found);
          if (ticket === latest.current) setResults({ q, suggestions: found });
        })
        .catch((err: unknown) => {
          if (ticket !== latest.current) return;
          setOpen(false);
          // Switched off or resting: the fields stay plain for this visit.
          if (err instanceof ApiError && err.code === 'PLACES_UNAVAILABLE') setSearchOff(errorMessage(t, err));
        });
    }, 280);
    return () => clearTimeout(timer);
  }, [canSearch, open, q, eventId, t]);

  const set = (patch: Partial<VenueDraft>) => onChange({ ...value, ...patch });

  const type = (field: SearchField, text: string) => {
    set({ [field]: text });
    // The name searches only until the venue has a spot: after that, typing it is just its name.
    const searches = canSearch && (field === 'address' || !hasSpot);
    setActive(field);
    setQuery(text);
    setHighlight(-1);
    setOpen(searches && text.trim().length >= 3);
  };

  const choose = async (s: PlaceSuggestion) => {
    setOpen(false);
    setChoosing(true);
    try {
      const place = await placeDetails(eventId, s.placeId, session.current);
      // Searched by name, or no name yet: the place's own name. Otherwise the host's.
      const name = active === 'name' || !value.name.trim() ? s.name : value.name;
      onChange(fromPlace(value, place, name));
    } catch (err) {
      setSearchOff(errorMessage(t, err));
    } finally {
      // A chosen place ends the search session.
      session.current = null;
      setChoosing(false);
    }
  };

  const notFound = () => {
    setOpen(false);
    session.current = null;
    const text = [value.name, value.address, value.city].map((s) => s.trim()).filter(Boolean).join(', ') || q;
    window.open(mapsSearchUrl(text), '_blank', 'noopener,noreferrer');
    setPinOpen(true);
  };

  const options = suggestions.length + 1;
  const pick = (index: number) => (index < suggestions.length ? void choose(suggestions[index]!) : notFound());

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % options);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? options - 1 : h - 1));
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault();
      pick(highlight);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  const applyPin = async () => {
    setPinBusy(true);
    setPinError(null);
    try {
      const found = await resolveMapLink(eventId, pinText);
      const place = found.place;
      // The host's own words stay; a place Google found fills only what is still empty.
      onChange({
        ...value,
        latitude: found.latitude,
        longitude: found.longitude,
        mapUrl: found.mapUrl,
        ...(place
          ? {
              address: value.address.trim() ? value.address : withoutName(place.address, value.name),
              city: value.city.trim() ? value.city : (place.city ?? ''),
              state: value.state.trim() ? value.state : (place.state ?? ''),
              postalCode: value.postalCode.trim() ? value.postalCode : (place.postalCode ?? ''),
              country: place.country ?? value.country,
            }
          : {}),
      });
      setPinOpen(false);
      setPinText('');
    } catch (err) {
      setPinError(errorMessage(t, err));
    } finally {
      setPinBusy(false);
    }
  };

  const optionId = (i: number) => `${listId}-option-${i}`;
  const combo = (field: SearchField) =>
    canSearch && (field === 'address' || !hasSpot)
      ? {
          role: 'combobox' as const,
          'aria-autocomplete': 'list' as const,
          'aria-expanded': open && active === field,
          'aria-controls': listId,
          'aria-activedescendant': open && active === field && highlight >= 0 ? optionId(highlight) : undefined,
          onKeyDown,
          onBlur: () => setOpen(false),
        }
      : {};

  const listbox = (field: SearchField) =>
    open && active === field ? (
      <div
        className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-2xl bg-white shadow-clay-raised ring-1 ring-gold-200 animate-fade-in-up"
        style={{ animationDuration: '0.18s' }}
        // Keeps the focus in the field while an option is clicked.
        onMouseDown={(e) => e.preventDefault()}
      >
        <ul id={listId} role="listbox" aria-label={t('venue.suggestions')} className="max-h-80 overflow-y-auto py-1.5">
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              id={optionId(i)}
              role="option"
              aria-selected={highlight === i}
              onClick={() => pick(i)}
              onMouseEnter={() => setHighlight(i)}
              className={cn('flex cursor-pointer items-start gap-3 px-4 py-2.5', highlight === i && 'bg-sand')}
            >
              <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-700" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{s.name}</span>
                {s.description ? <span className="block truncate text-xs text-stone-500">{s.description}</span> : null}
              </span>
            </li>
          ))}
          <li
            id={optionId(suggestions.length)}
            role="option"
            aria-selected={highlight === suggestions.length}
            onClick={() => pick(suggestions.length)}
            onMouseEnter={() => setHighlight(suggestions.length)}
            className={cn('flex cursor-pointer items-center gap-3 border-t border-gold-100 px-4 py-3 text-sm font-semibold text-brand-700', highlight === suggestions.length && 'bg-sand')}
          >
            <LocateFixed aria-hidden className="size-4 shrink-0" />
            {t('venue.notFound')}
          </li>
        </ul>
        <div className="flex items-center justify-between gap-3 border-t border-gold-100 bg-sand/50 px-4 py-1.5 text-[11px] text-stone-500">
          <span role="status" aria-live="polite">
            {searching ? t('venue.searching') : suggestions.length === 0 ? t('venue.noResults', { q }) : null}
          </span>
          {/* Places shown without a Google map name Google Maps (its terms). */}
          <span className="font-medium">{t('venue.attribution')}</span>
        </div>
      </div>
    ) : null;

  const spotPlaceId = placeIdFromMapUrl(value.mapUrl);

  return (
    <fieldset className="space-y-4">
      <legend className="mb-1 text-sm font-semibold text-stone-800">{t('venue.title')}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('function.field.venueName')} error={errors.name}>
          {(p) => (
            <div className="relative">
              <Input
                {...p}
                ref={nameRef}
                {...combo('name')}
                autoComplete="off"
                maxLength={160}
                value={value.name}
                placeholder={t('venue.namePlaceholder')}
                onChange={(e) => type('name', e.target.value)}
              />
              {listbox('name')}
            </div>
          )}
        </Field>
        <Field label={t('function.field.venueAddress')} hint={canSearch ? t('venue.searchHint') : undefined} error={errors.address}>
          {(p) => (
            <div className="relative">
              {canSearch ? <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-stone-400" /> : null}
              <Input
                {...p}
                ref={addressRef}
                {...combo('address')}
                autoComplete="off"
                maxLength={500}
                className={cn(canSearch && 'pl-10', choosing && 'pr-10')}
                value={value.address}
                placeholder={canSearch ? t('venue.addressPlaceholder') : t('venue.addressManualPlaceholder')}
                onChange={(e) => type('address', e.target.value)}
              />
              {choosing ? <Loader2 aria-hidden className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-brand-700" /> : null}
              {listbox('address')}
            </div>
          )}
        </Field>
      </div>
      {searchOff ? <p className="text-xs text-stone-500">{searchOff}</p> : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1">
          <Field label={t('venue.city')}>{(p) => <Input {...p} autoComplete="off" maxLength={120} value={value.city} onChange={(e) => set({ city: e.target.value })} />}</Field>
        </div>
        <Field label={t('venue.state')}>{(p) => <Input {...p} autoComplete="off" maxLength={120} value={value.state} onChange={(e) => set({ state: e.target.value })} />}</Field>
        <Field label={t('venue.postalCode')}>{(p) => <Input {...p} autoComplete="off" inputMode="numeric" maxLength={20} value={value.postalCode} onChange={(e) => set({ postalCode: e.target.value })} />}</Field>
      </div>

      {hasSpot ? (
        <SpotCard
          title={t('venue.pinned')}
          body={t('venue.pinnedHint')}
          actions={
            <>
              {value.mapUrl ? (
                <a href={value.mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700">
                  <ExternalLink aria-hidden className="size-3.5" />
                  {t('venue.openInMaps')}
                </a>
              ) : null}
              <Button variant="ghost" size="sm" onClick={() => set({ latitude: null, longitude: null, mapUrl: null })}>
                <X aria-hidden className="size-3.5" />
                {t('venue.removePin')}
              </Button>
            </>
          }
        >
          {status.data?.embedKey ? (
            <iframe
              title={t('venue.mapTitle', { name: value.name || value.address || t('venue.title') })}
              src={embedMapUrl(status.data.embedKey, { latitude: value.latitude!, longitude: value.longitude!, placeId: spotPlaceId })}
              loading="lazy"
              // Only the site's origin goes to Google (the key is restricted to it); never this page's address.
              referrerPolicy="origin"
              className="mt-3 aspect-[16/9] w-full rounded-xl border border-gold-200 bg-sand"
            />
          ) : null}
        </SpotCard>
      ) : !pinOpen ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-dashed border-gold-300 bg-white/50 px-4 py-3">
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-stone-600">{t('venue.noPin')}</p>
          <button type="button" onClick={notFound} className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
            <LocateFixed aria-hidden className="size-4" />
            {canSearch ? t('venue.notFound') : t('venue.pinFromMaps')}
          </button>
        </div>
      ) : null}
      {errors.spot ? <p className="text-sm text-red-700">{errors.spot}</p> : null}

      {pinOpen ? (
        <section aria-labelledby={`${listId}-pin`} className="clay-inset rounded-2xl p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 id={`${listId}-pin`} className="flex items-center gap-2 font-display text-lg leading-snug text-ink">
              <MapPinned aria-hidden className="size-5 shrink-0 text-brand-700" />
              {t('venue.pinTitle')}
            </h3>
            <button type="button" aria-label={t('venue.pinCancel')} onClick={() => setPinOpen(false)} className="grid size-9 shrink-0 place-items-center rounded-full text-stone-500 hover:bg-white hover:text-ink">
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <ol className="mt-3 space-y-2 text-sm leading-relaxed text-stone-700">
            <li className="flex gap-2.5">
              <Step n={1} />
              <span>
                {t('venue.pinStep1')}{' '}
                <a
                  href={mapsSearchUrl([value.name, value.address, value.city].map((s) => s.trim()).filter(Boolean).join(', ') || q)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-brand-700 underline decoration-gold-300 underline-offset-4 hover:decoration-brand-700"
                >
                  {t('venue.openMaps')}
                  <ExternalLink aria-hidden className="size-3.5" />
                </a>
              </span>
            </li>
            <li className="flex gap-2.5">
              <Step n={2} />
              <span>{t('venue.pinStep2')}</span>
            </li>
            <li className="flex gap-2.5">
              <Step n={3} />
              <span>{t('venue.pinStep3')}</span>
            </li>
          </ol>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Field label={t('venue.pinLink')} error={pinError ?? undefined}>
                {(p) => (
                  <Input
                    {...p}
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    maxLength={2000}
                    value={pinText}
                    placeholder={t('venue.pinLinkPlaceholder')}
                    onChange={(e) => setPinText(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter uses the link here instead of saving the whole function.
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (pinText.trim() && !pinBusy) void applyPin();
                      }
                    }}
                  />
                )}
              </Field>
            </div>
            <Button className={cn(pinError && 'sm:mb-7')} disabled={!pinText.trim() || pinBusy} onClick={() => void applyPin()}>
              {pinBusy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <MapPin aria-hidden className="size-4" />}
              {pinBusy ? t('venue.pinChecking') : t('venue.pinUse')}
            </Button>
          </div>
          <p className="mt-2 text-xs text-stone-500">{t('venue.pinTypeAddress')}</p>
        </section>
      ) : null}
    </fieldset>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-brand-700 shadow-clay-sm">
      {n}
    </span>
  );
}

function SpotCard({ title, body, actions, children }: { title: string; body: string; actions: ReactNode; children?: ReactNode }) {
  return (
    <div className="clay-inset rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden className="icon-3d size-9 shrink-0 rounded-xl">
            <MapPin className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{title}</p>
            <p className="text-xs text-stone-600">{body}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">{actions}</div>
      </div>
      {children}
    </div>
  );
}
