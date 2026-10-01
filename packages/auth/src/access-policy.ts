/**
 * Guest-facing access evaluation.
 *
 * Four independent inputs decide whether a viewer may see a function:
 *   1. FUNCTION        – its status and listing visibility
 *   2. ACCESS POLICY   – the effective mode (function override ?? event policy)
 *   3. AUDIENCE        – group-based audience + direct FunctionGuest assignment
 *   4. INVITATION SCOPE – an event-wide or function-specific invitation
 *
 * These functions are pure: callers load the facts, this module decides.
 * Every decision carries a machine-readable reason for logging and tests.
 */

export type AccessMode = 'PUBLIC' | 'PRIVATE_LINK' | 'INVITE_ONLY' | 'GROUP_RESTRICTED' | 'SECRET_TOKEN';
export type ListingVisibility = 'LISTED' | 'UNLISTED';
export type FunctionStatus = 'DRAFT' | 'SCHEDULED' | 'POSTPONED' | 'CANCELLED' | 'COMPLETED';

export interface PolicyFacts {
  mode: AccessMode;
  /** True when the policy has a PIN configured. */
  hasPin: boolean;
}

export interface FunctionFacts {
  id: string;
  status: FunctionStatus;
  visibility: ListingVisibility;
  /** Function's own policy, or null to inherit the event policy. */
  policy: PolicyFacts | null;
  audienceGroupIds: readonly string[];
}

export interface FunctionAssignmentFacts {
  allowed: boolean;
}

export type Viewer =
  | {
      kind: 'anonymous';
      /** PIN for a PRIVATE_LINK policy has been verified in this session. */
      pinVerified: boolean;
      /** The event's current, unexpired secret link was presented (SECRET_TOKEN). */
      linkVerified: boolean;
    }
  | {
      kind: 'guest';
      guestId: string;
      groupIds: readonly string[];
      /** Direct FunctionGuest rows for this guest, keyed by functionId. */
      assignments: ReadonlyMap<string, FunctionAssignmentFacts>;
      /** null = event-wide invitation; otherwise the only function it covers. */
      invitationFunctionId: string | null;
    };

export type AccessReason =
  | 'PUBLIC'
  | 'PRIVATE_LINK'
  | 'SECRET_LINK'
  | 'DIRECT_ASSIGNMENT'
  | 'GROUP_AUDIENCE'
  | 'FUNCTION_NOT_PUBLISHED'
  | 'OUTSIDE_INVITATION_SCOPE'
  | 'EXPLICITLY_DENIED'
  | 'NOT_IN_AUDIENCE'
  | 'NOT_IN_AUDIENCE_GROUP'
  | 'INVITATION_REQUIRED'
  | 'PIN_REQUIRED'
  | 'LINK_REQUIRED'
  | 'UNLISTED';

export interface AccessDecision {
  allowed: boolean;
  reason: AccessReason;
}

const allow = (reason: AccessReason): AccessDecision => ({ allowed: true, reason });
const deny = (reason: AccessReason): AccessDecision => ({ allowed: false, reason });

export function effectivePolicy(fn: Pick<FunctionFacts, 'policy'>, eventPolicy: PolicyFacts): PolicyFacts {
  return fn.policy ?? eventPolicy;
}

function inAudienceGroup(groupIds: readonly string[], audienceGroupIds: readonly string[]): boolean {
  if (groupIds.length === 0 || audienceGroupIds.length === 0) return false;
  const audience = new Set(audienceGroupIds);
  return groupIds.some((g) => audience.has(g));
}

/**
 * Link modes: the event is shared as one link (PUBLIC, PRIVATE_LINK, or the
 * expiring SECRET_TOKEN link), so hosts need not add guests first and people
 * may register themselves. INVITE_ONLY and GROUP_RESTRICTED need personal
 * invitations.
 */
export function isLinkMode(mode: AccessMode): boolean {
  return mode === 'PUBLIC' || mode === 'PRIVATE_LINK' || mode === 'SECRET_TOKEN';
}

/** An anonymous viewer through a link mode: PIN (PRIVATE_LINK) or secret link (SECRET_TOKEN) checked. */
function anonymousLinkAccess(policy: PolicyFacts, viewer: Extract<Viewer, { kind: 'anonymous' }>): AccessDecision {
  switch (policy.mode) {
    case 'PUBLIC':
      return allow('PUBLIC');
    case 'PRIVATE_LINK':
      if (policy.hasPin && !viewer.pinVerified) return deny('PIN_REQUIRED');
      return allow('PRIVATE_LINK');
    case 'SECRET_TOKEN':
      return viewer.linkVerified ? allow('SECRET_LINK') : deny('LINK_REQUIRED');
    default:
      return deny('INVITATION_REQUIRED');
  }
}

/**
 * Can the viewer open the event shell (title, cover, description)?
 * Invitation-token viewers are authorized by the token itself, which the caller
 * validates with validateInvitationToken() before building a guest viewer.
 */
export function evaluateEventAccess(eventPolicy: PolicyFacts, viewer: Viewer): AccessDecision {
  if (viewer.kind === 'guest') return allow('DIRECT_ASSIGNMENT');
  return anonymousLinkAccess(eventPolicy, viewer);
}

/** Can the viewer see this function (its date, venue, RSVP)? */
export function evaluateFunctionAccess(
  fn: FunctionFacts,
  eventPolicy: PolicyFacts,
  viewer: Viewer,
): AccessDecision {
  if (fn.status === 'DRAFT') return deny('FUNCTION_NOT_PUBLISHED');

  const policy = effectivePolicy(fn, eventPolicy);

  if (viewer.kind === 'anonymous') {
    if (fn.visibility === 'UNLISTED') return deny('UNLISTED');
    return anonymousLinkAccess(policy, viewer);
  }

  // Guest holding a validated invitation.
  if (viewer.invitationFunctionId !== null && viewer.invitationFunctionId !== fn.id) {
    return deny('OUTSIDE_INVITATION_SCOPE');
  }

  const assignment = viewer.assignments.get(fn.id);
  // Explicit deny always wins over groups and open modes.
  if (assignment && !assignment.allowed) return deny('EXPLICITLY_DENIED');

  const viaGroup = inAudienceGroup(viewer.groupIds, fn.audienceGroupIds);

  switch (policy.mode) {
    // Link modes: a guest with an invitation (for example someone who
    // registered through the link) sees every listed function.
    case 'PUBLIC':
    case 'PRIVATE_LINK':
    case 'SECRET_TOKEN':
      if (fn.visibility === 'LISTED') return allow(policy.mode === 'PUBLIC' ? 'PUBLIC' : policy.mode === 'PRIVATE_LINK' ? 'PRIVATE_LINK' : 'SECRET_LINK');
      if (assignment?.allowed) return allow('DIRECT_ASSIGNMENT');
      if (viaGroup) return allow('GROUP_AUDIENCE');
      return deny('UNLISTED');

    case 'INVITE_ONLY':
      if (assignment?.allowed) return allow('DIRECT_ASSIGNMENT');
      if (viaGroup) return allow('GROUP_AUDIENCE');
      return deny('NOT_IN_AUDIENCE');

    case 'GROUP_RESTRICTED':
      // Strict: membership of an audience group is required; a direct
      // assignment alone is not enough (but an explicit deny still applies).
      if (viaGroup) return allow('GROUP_AUDIENCE');
      return deny('NOT_IN_AUDIENCE_GROUP');
  }
}

/** Convenience: filter a list of functions down to the ones the viewer may see. */
export function authorizedFunctions<T extends FunctionFacts>(
  functions: readonly T[],
  eventPolicy: PolicyFacts,
  viewer: Viewer,
): T[] {
  return functions.filter((fn) => evaluateFunctionAccess(fn, eventPolicy, viewer).allowed);
}
