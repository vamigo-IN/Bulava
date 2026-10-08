'use client';

import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from './api';
import type {
  Announcement,
  AttendanceRow,
  DesignState,
  EventAlbum,
  MediaItem,
  OrderRow,
  ShareLinkInfo,
  TeamList,
  Plan,
  TemplateSummaryLite,
  VideoJob,
} from './types';
import type {
  EventFunction,
  EventSummary,
  EventType,
  Guest,
  GuestGroup,
  Invitation,
  Language,
  RsvpRow,
  RsvpSummary,
  User,
} from './types';

export const keys = {
  me: ['me'] as const,
  eventTypes: ['meta', 'event-types'] as const,
  languages: ['meta', 'languages'] as const,
  events: ['events'] as const,
  event: (id: string) => ['events', id] as const,
  functions: (id: string) => ['events', id, 'functions'] as const,
  groups: (id: string) => ['events', id, 'groups'] as const,
  guests: (id: string, q = '') => ['events', id, 'guests', q] as const,
  invitations: (id: string) => ['events', id, 'invitations'] as const,
  rsvpSummary: (id: string) => ['events', id, 'rsvps', 'summary'] as const,
  rsvps: (id: string) => ['events', id, 'rsvps'] as const,
};

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => apiGet<User>('/users/me') });
export const useEventTypes = () =>
  useQuery({ queryKey: keys.eventTypes, queryFn: () => apiGet<EventType[]>('/meta/event-types'), staleTime: 300_000 });
export const useLanguages = () =>
  useQuery({ queryKey: keys.languages, queryFn: () => apiGet<Language[]>('/meta/languages'), staleTime: 300_000 });
export const useEvents = () => useQuery({ queryKey: keys.events, queryFn: () => apiGet<EventSummary[]>('/events') });
export const useEvent = (id: string) =>
  useQuery({ queryKey: keys.event(id), queryFn: () => apiGet<EventSummary>(`/events/${id}`) });
export const useFunctions = (id: string) =>
  useQuery({ queryKey: keys.functions(id), queryFn: () => apiGet<EventFunction[]>(`/events/${id}/functions`) });
export const useGroups = (id: string) =>
  useQuery({ queryKey: keys.groups(id), queryFn: () => apiGet<GuestGroup[]>(`/events/${id}/groups`) });
export const useInvitations = (id: string, enabled = true) =>
  useQuery({ queryKey: keys.invitations(id), queryFn: () => apiGet<Invitation[]>(`/events/${id}/invitations`), enabled });
export const useRsvpSummary = (id: string, enabled = true) =>
  useQuery({ queryKey: keys.rsvpSummary(id), queryFn: () => apiGet<RsvpSummary>(`/events/${id}/rsvps/summary`), enabled });
export const useRsvps = (id: string) =>
  useQuery({ queryKey: keys.rsvps(id), queryFn: () => apiGet<RsvpRow[]>(`/events/${id}/rsvps`) });

export function useGuests(eventId: string, q: string) {
  return useInfiniteQuery({
    queryKey: keys.guests(eventId, q),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '100' });
      if (q) params.set('q', q);
      if (pageParam) params.set('cursor', pageParam);
      return apiGet<{ items: Guest[]; nextCursor: string | null }>(`/events/${eventId}/guests?${params}`);
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** Invalidate everything under an event after a mutation. */
export function useInvalidateEvent(eventId: string) {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ['events', eventId] });
}

// ───── Design, media, video, updates, attendance, billing ─────

export const moreKeys = {
  design: (id: string) => ['events', id, 'design'] as const,
  videos: (id: string) => ['events', id, 'videos'] as const,
  album: (id: string) => ['events', id, 'album'] as const,
  albumItems: (id: string, albumId: string) => ['events', id, 'album', albumId, 'items'] as const,
  shareLink: (id: string) => ['events', id, 'share-link'] as const,
  team: (id: string) => ['events', id, 'members'] as const,
  approvedPhotos: (id: string) => ['events', id, 'approved-photos'] as const,
  announcements: (id: string) => ['events', id, 'announcements'] as const,
  attendance: (id: string) => ['events', id, 'attendance'] as const,
  orders: (id: string) => ['events', id, 'orders'] as const,
  catalog: (type: string, eventType: string) => ['catalog', type, eventType] as const,
  plans: ['meta', 'plans'] as const,
  notifications: ['notifications'] as const,
};

export const useDesign = (id: string) => useQuery({ queryKey: moreKeys.design(id), queryFn: () => apiGet<DesignState>(`/events/${id}/design`) });
/** Polls every 3 s only while a render is queued or in progress. */
export const useVideos = (id: string) =>
  useQuery({
    queryKey: moreKeys.videos(id),
    queryFn: () => apiGet<VideoJob[]>(`/events/${id}/videos`),
    refetchInterval: (q) => (q.state.data?.some((j) => j.status === 'QUEUED' || j.status === 'PROCESSING') ? 3000 : false),
  });
/** The event album with its sub-albums (created on first look). */
export const useAlbum = (id: string, enabled = true) => useQuery({ queryKey: moreKeys.album(id), queryFn: () => apiGet<EventAlbum>(`/events/${id}/album`), enabled });
/** A sub-album's photos; polls while photos are still processing. */
export const useAlbumItems = (id: string, albumId: string | null) =>
  useQuery({
    queryKey: moreKeys.albumItems(id, albumId ?? ''),
    queryFn: () => apiGet<MediaItem[]>(`/events/${id}/album/sub-albums/${albumId}/items`),
    enabled: !!albumId,
    refetchInterval: (q) => (q.state.data?.some((i) => i.status === 'PROCESSING') ? 4000 : false),
  });
/** The link to share (link modes) or a pointer to personal invitations. */
export const useShareLink = (id: string, enabled = true) => useQuery({ queryKey: moreKeys.shareLink(id), queryFn: () => apiGet<ShareLinkInfo>(`/events/${id}/share-link`), enabled });
export const useTeam = (id: string) => useQuery({ queryKey: moreKeys.team(id), queryFn: () => apiGet<TeamList>(`/events/${id}/members`) });
export const useApprovedPhotos = (id: string) => useQuery({ queryKey: moreKeys.approvedPhotos(id), queryFn: () => apiGet<MediaItem[]>(`/events/${id}/media/approved-photos`) });
export const useAnnouncements = (id: string) => useQuery({ queryKey: moreKeys.announcements(id), queryFn: () => apiGet<Announcement[]>(`/events/${id}/announcements`) });
export const useAttendance = (id: string) =>
  useQuery({ queryKey: moreKeys.attendance(id), queryFn: () => apiGet<AttendanceRow[]>(`/events/${id}/check-ins/summary`), refetchInterval: 10_000 });
export const useOrders = (id: string) => useQuery({ queryKey: moreKeys.orders(id), queryFn: () => apiGet<OrderRow[]>(`/events/${id}/orders`) });
export const usePlans = () => useQuery({ queryKey: moreKeys.plans, queryFn: () => apiGet<Plan[]>('/meta/plans'), staleTime: 300_000 });
export const useCatalog = (type: 'WEBSITE' | 'VIDEO' | 'DIGITAL_CARD', eventType: string) =>
  useQuery({
    queryKey: moreKeys.catalog(type, eventType),
    queryFn: () => apiGet<TemplateSummaryLite[]>(`/public/templates?type=${type}&eventType=${encodeURIComponent(eventType)}&include=definition`),
    staleTime: 300_000,
  });
/** Template summaries without their definitions: enough for previews and links (the home page). */
export const useTemplateList = (type: 'WEBSITE' | 'VIDEO' | 'DIGITAL_CARD', eventType?: string) =>
  useQuery({
    queryKey: ['templates', 'list', type, eventType ?? 'all'],
    queryFn: () => apiGet<TemplateSummaryLite[]>(`/public/templates?type=${type}${eventType ? `&eventType=${encodeURIComponent(eventType)}` : ''}`),
    staleTime: 300_000,
  });
export const useNotifications = () =>
  useQuery({
    queryKey: moreKeys.notifications,
    queryFn: () => apiGet<Array<{ id: string; type: string; payload: Record<string, unknown>; readAt: string | null; createdAt: string; eventId: string | null }>>('/notifications'),
    refetchInterval: 30_000,
  });
