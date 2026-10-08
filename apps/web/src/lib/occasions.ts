import { Baby, BookOpen, Building2, Cake, CalendarHeart, Flame, Gem, GraduationCap, HeartHandshake, House, PartyPopper, Scissors, Sparkles, Star, Sunset, UsersRound, Wine, type LucideIcon } from 'lucide-react';

/**
 * Icons for the event types (rows in `event_types`). Presentation only: the
 * list, names and suggestions come from the database, and a type added later
 * gets the generic icon until one is chosen here.
 */
const ICONS: Record<string, LucideIcon> = {
  WEDDING: Gem,
  ENGAGEMENT: HeartHandshake,
  BIRTHDAY: Cake,
  ANNIVERSARY: Wine,
  BABY_SHOWER: Baby,
  NAMING_CEREMONY: Star,
  MUNDAN: Scissors,
  THREAD_CEREMONY: BookOpen,
  HOUSEWARMING: House,
  RELIGIOUS: Flame,
  FESTIVAL: PartyPopper,
  CORPORATE: Building2,
  SCHOOL_COLLEGE: GraduationCap,
  COMMUNITY: UsersRound,
  RETIREMENT: Sunset,
  CUSTOM: Sparkles,
};

export function occasionIcon(typeKey: string): LucideIcon {
  return ICONS[typeKey] ?? CalendarHeart;
}

/** "Engagement / Roka" -> "Engagement": the short form used in titles like "Riya & Aman's Engagement". */
export function occasionShortName(name: string): string {
  return name.split(/\s*[/(]/)[0]?.trim() || name;
}
