import { HttpStatus } from '@nestjs/common';

/** Stable, client-facing error codes. The web app maps these to translation keys (error.<CODE>). */
export const ErrorCode = {
  VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
  BAD_REQUEST: HttpStatus.BAD_REQUEST,
  UNAUTHENTICATED: HttpStatus.UNAUTHORIZED,
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  SESSION_EXPIRED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  CSRF_REJECTED: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  EMAIL_TAKEN: HttpStatus.CONFLICT,
  PHONE_TAKEN: HttpStatus.CONFLICT,
  /** An account made from a WhatsApp number alone must be secured (code, or email and password) before it publishes or pays. */
  ACCOUNT_UNVERIFIED: HttpStatus.FORBIDDEN,
  /** WhatsApp codes need the WhatsApp Business integration and an approved authentication template. */
  PHONE_OTP_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  /** A WhatsApp code for a number saved, but never confirmed, on an account that signs in another way. */
  PHONE_UNCONFIRMED: HttpStatus.CONFLICT,
  /** Signing up, adding an email or resetting a password needs email set up under Integrations. */
  EMAIL_CODES_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  /** A code step that expired, was used, or ran out of attempts: start again. */
  VERIFICATION_EXPIRED: HttpStatus.GONE,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  INVALID_EVENT_TYPE: HttpStatus.BAD_REQUEST,
  UNSUPPORTED_LANGUAGE: HttpStatus.BAD_REQUEST,
  INVALID_REFERENCE: HttpStatus.BAD_REQUEST,
  SYSTEM_GROUP_PROTECTED: HttpStatus.CONFLICT,
  INVITATION_INVALID: HttpStatus.NOT_FOUND,
  INVITATION_EXPIRED: HttpStatus.GONE,
  INVITATION_REVOKED: HttpStatus.GONE,
  INVITATION_USAGE_EXCEEDED: HttpStatus.GONE,
  EVENT_NOT_PUBLISHED: HttpStatus.NOT_FOUND,
  FUNCTION_NOT_AUTHORIZED: HttpStatus.FORBIDDEN,
  FUNCTION_CLOSED: HttpStatus.CONFLICT,
  ATTENDEE_LIMIT_EXCEEDED: HttpStatus.BAD_REQUEST,
  RSVP_ANSWER_INVALID: HttpStatus.BAD_REQUEST,
  PLAN_LIMIT_REACHED: HttpStatus.PAYMENT_REQUIRED,
  PLAN_UPGRADE_REQUIRED: HttpStatus.PAYMENT_REQUIRED,
  TEMPLATE_NOT_AVAILABLE: HttpStatus.BAD_REQUEST,
  CUSTOMIZATION_INVALID: HttpStatus.BAD_REQUEST,
  INVITATION_REQUIRED: HttpStatus.FORBIDDEN,
  PIN_REQUIRED: HttpStatus.UNAUTHORIZED,
  PIN_INVALID: HttpStatus.UNAUTHORIZED,
  OTP_REQUIRED: HttpStatus.UNAUTHORIZED,
  OTP_INVALID: HttpStatus.UNAUTHORIZED,
  UPLOAD_REJECTED: HttpStatus.BAD_REQUEST,
  UPLOADS_CLOSED: HttpStatus.FORBIDDEN,
  UPLOAD_NEEDS_INVITATION: HttpStatus.FORBIDDEN,
  MEDIA_NOT_READY: HttpStatus.CONFLICT,
  PAYMENTS_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  PAYMENT_VERIFICATION_FAILED: HttpStatus.BAD_REQUEST,
  ORDER_NOT_PAYABLE: HttpStatus.CONFLICT,
  COUPON_INVALID: HttpStatus.BAD_REQUEST,
  ALREADY_CHECKED_IN: HttpStatus.CONFLICT,
  REGISTRATION_NOT_AVAILABLE: HttpStatus.BAD_REQUEST,
  REGISTRATION_CLOSED: HttpStatus.CONFLICT,
  REGISTRATION_FULL: HttpStatus.CONFLICT,
  REGISTRATION_INVALID: HttpStatus.BAD_REQUEST,
  ALREADY_REGISTERED: HttpStatus.CONFLICT,
  MEMBER_NOT_REGISTERED: HttpStatus.NOT_FOUND,
  EVENT_LINK_EXPIRED: HttpStatus.GONE,
  TEAM_INVITE_INVALID: HttpStatus.NOT_FOUND,
  TEAM_INVITE_CODE_INVALID: HttpStatus.UNAUTHORIZED,
  TEAM_INVITE_LOCKED: HttpStatus.GONE,
  TEAM_INVITE_SIGN_IN: HttpStatus.CONFLICT,
  TEAM_INVITE_WRONG_ACCOUNT: HttpStatus.FORBIDDEN,
  MFA_REQUIRED: HttpStatus.FORBIDDEN,
  MFA_INVALID: HttpStatus.UNAUTHORIZED,
  MFA_CHALLENGE_EXPIRED: HttpStatus.UNAUTHORIZED,
  MFA_ALREADY_ENABLED: HttpStatus.CONFLICT,
  MFA_NOT_ENABLED: HttpStatus.BAD_REQUEST,
  REMINDER_INVALID: HttpStatus.BAD_REQUEST,
  GOOGLE_UNAVAILABLE: HttpStatus.NOT_FOUND,
  DOMAIN_INVALID: HttpStatus.BAD_REQUEST,
  DOMAIN_TAKEN: HttpStatus.CONFLICT,
  DOMAIN_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  GOOGLE_FAILED: HttpStatus.UNAUTHORIZED,
  GOOGLE_LINK_REQUIRED: HttpStatus.CONFLICT,
  GOOGLE_ALREADY_LINKED: HttpStatus.CONFLICT,
  GOOGLE_UNLINK_BLOCKED: HttpStatus.BAD_REQUEST,
  REMINDER_TOO_SOON: HttpStatus.CONFLICT,
  SUPER_ADMIN_PROTECTED: HttpStatus.CONFLICT,
  WHATSAPP_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  CONSENT_REQUIRED: HttpStatus.BAD_REQUEST,
  RESTORE_EXPIRED: HttpStatus.GONE,
  PAGE_SLUG_TAKEN: HttpStatus.CONFLICT,
  PAGE_PROTECTED: HttpStatus.CONFLICT,
  /** A home page pick that is not published, or not the kind of template its section shows. */
  SHOWCASE_TEMPLATE_UNFIT: HttpStatus.BAD_REQUEST,
  EMAIL_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  /** Digital cards are switched off in the settings. */
  CARDS_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  /** A card's saved session is gone (cleaned up after a month untouched): start from the template again. */
  CARD_SESSION_EXPIRED: HttpStatus.GONE,
  /** The card's image is still being made, or making it failed. */
  CARD_NOT_READY: HttpStatus.CONFLICT,
  /** A watermark-free download without paying needs a plan that covers it. */
  CARD_PLAN_REQUIRED: HttpStatus.FORBIDDEN,
  SERVICE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
} as const;

export type ErrorCode = keyof typeof ErrorCode;

export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.status = ErrorCode[code];
  }

  static notFound(what = 'Resource'): AppError {
    return new AppError('NOT_FOUND', `${what} not found.`);
  }

  static forbidden(message = 'You do not have permission to do that.'): AppError {
    return new AppError('FORBIDDEN', message);
  }
}
