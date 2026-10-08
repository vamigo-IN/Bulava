import type { MessageKey } from '@bulava/localization';
import type { AccessMode, EventSummary } from './types';

/**
 * The path from a new event to a celebration in full swing, in the order a
 * host takes it. The overview's checklist, the "next step" bar under every
 * event page, the sidebar's ticks and the home page all read it from here, so
 * they never disagree. Plain functions: server and client components may use it.
 */
export type SetupStepKey = 'design' | 'functions' | 'guests' | 'publish' | 'share' | 'rsvps';

export interface SetupStep {
  key: SetupStepKey;
  /** The event page where the step is done ('' is the overview, where publishing lives). */
  section: string;
  title: MessageKey;
  /** One or two words, for the step rail. */
  short: MessageKey;
  body: MessageKey;
  /** The button that takes the host there. */
  action: MessageKey;
  done: boolean;
  /** Does not hold up "what's next" (guests for an event shared by one link register themselves). */
  optional: boolean;
}

export interface SetupFacts {
  status: EventSummary['status'];
  accessMode: AccessMode;
  designChosen: boolean;
  functions: number;
  guests: number;
  /** Any invitation sent or shared (email, WhatsApp, the host's own link). */
  invitationsSent: boolean;
  /** Replies received across functions. */
  responses: number;
}

/** Modes where everyone gets the same link (and may register), rather than a personal invitation. */
export const LINK_MODES: ReadonlySet<AccessMode> = new Set<AccessMode>(['PUBLIC', 'PRIVATE_LINK', 'SECRET_TOKEN']);

export function setupSteps(f: SetupFacts): SetupStep[] {
  const link = LINK_MODES.has(f.accessMode);
  const published = f.status !== 'DRAFT';
  return [
    { key: 'design', section: '/design', title: 'dash.step.design', short: 'dash.step.design.short', body: 'dash.step.design.body', action: 'dash.step.design.action', done: f.designChosen, optional: false },
    { key: 'functions', section: '/functions', title: 'dash.step.functions', short: 'dash.step.functions.short', body: 'dash.step.functions.body', action: 'dash.step.functions.action', done: f.functions > 0, optional: false },
    {
      key: 'guests',
      section: '/guests',
      title: 'dash.step.guests',
      short: 'dash.step.guests.short',
      body: link ? 'dash.step.guests.bodyLink' : 'dash.step.guests.body',
      action: 'dash.step.guests.action',
      done: f.guests > 0,
      optional: link,
    },
    { key: 'publish', section: '', title: 'dash.step.publish', short: 'dash.step.publish.short', body: 'dash.step.publish.body', action: 'dash.step.publish.action', done: published, optional: false },
    {
      key: 'share',
      section: '/invitations',
      title: link ? 'dash.step.shareLink' : 'dash.step.send',
      short: link ? 'dash.step.shareLink.short' : 'dash.step.send.short',
      body: link ? 'dash.step.shareLink.body' : 'dash.step.send.body',
      action: link ? 'dash.step.shareLink.action' : 'dash.step.send.action',
      // A link cannot tell when it was shared; people registering from it (guests) or invitations sent can.
      done: f.invitationsSent || (link && published && f.guests > 0),
      optional: false,
    },
    { key: 'rsvps', section: '/rsvps', title: 'dash.step.rsvps', short: 'dash.step.rsvps.short', body: 'dash.step.rsvps.body', action: 'dash.step.rsvps.action', done: f.responses > 0, optional: false },
  ];
}

/** The first step still to do, skipping optional ones; null once everything is done. */
export function nextStep(steps: SetupStep[]): SetupStep | null {
  return steps.find((s) => !s.done && !s.optional) ?? null;
}

/** How many steps are done, counting an optional step only once it is. */
export function progressOf(steps: SetupStep[]): { done: number; total: number } {
  return { done: steps.filter((s) => s.done).length, total: steps.length };
}

/** Facts known from the event summary alone (the home page, where per-event queries would be too many). */
export function summaryFacts(event: EventSummary): SetupFacts {
  return {
    status: event.status,
    accessMode: event.accessMode,
    designChosen: event.design !== null,
    functions: event.counts.functions,
    guests: event.counts.guests,
    invitationsSent: false,
    responses: 0,
  };
}
