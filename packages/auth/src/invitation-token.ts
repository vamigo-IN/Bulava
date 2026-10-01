/**
 * Pure validation of invitation token state. The caller looks the token up by
 * hash, then asks this module whether it may be used right now.
 */

export type InvitationTokenErrorCode =
  | 'INVITATION_REVOKED'
  | 'INVITATION_EXPIRED'
  | 'INVITATION_USAGE_EXCEEDED';

export interface TokenStateFacts {
  revokedAt: Date | null;
  expiresAt: Date | null;
  maxUses: number | null;
  useCount: number;
}

export interface InvitationStateFacts {
  status: 'ACTIVE' | 'SENT' | 'OPENED' | 'RESPONDED' | 'REVOKED' | 'EXPIRED';
  revokedAt: Date | null;
  expiresAt: Date | null;
}

export type TokenValidation = { ok: true } | { ok: false; code: InvitationTokenErrorCode };

export function validateInvitationToken(
  token: TokenStateFacts,
  invitation: InvitationStateFacts,
  now: Date = new Date(),
): TokenValidation {
  if (token.revokedAt || invitation.revokedAt || invitation.status === 'REVOKED') {
    return { ok: false, code: 'INVITATION_REVOKED' };
  }
  const expired =
    invitation.status === 'EXPIRED' ||
    (token.expiresAt !== null && token.expiresAt.getTime() <= now.getTime()) ||
    (invitation.expiresAt !== null && invitation.expiresAt.getTime() <= now.getTime());
  if (expired) return { ok: false, code: 'INVITATION_EXPIRED' };
  if (token.maxUses !== null && token.useCount >= token.maxUses) {
    return { ok: false, code: 'INVITATION_USAGE_EXCEEDED' };
  }
  return { ok: true };
}
