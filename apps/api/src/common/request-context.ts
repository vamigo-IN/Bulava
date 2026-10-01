import type { Request } from 'express';
import type { EventPermission, EventRole, PlatformRole } from '@bulava/auth';

export interface AuthUser {
  id: string;
  platformRole: PlatformRole;
  /** How the request authenticated. */
  via: 'cookie' | 'bearer';
  /** The session passed two-step verification at sign-in. */
  mfa: boolean;
}

export interface EventAccessContext {
  eventId: string;
  userId: string;
  role: EventRole;
  permissions: readonly EventPermission[];
  /** For FUNCTION_MANAGER: functions they may manage; empty = all. */
  functionIds: readonly string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  eventAccess?: EventAccessContext;
}
