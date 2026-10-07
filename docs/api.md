# API

Base URL `/api/v1`. OpenAPI UI is at `/api/docs` when `SWAGGER_ENABLED` is on (the default outside production).

## Conventions

**Envelope.** Every response body has the same outer shape:

```json
{ "success": true, "data": { } }
{ "success": false, "error": { "code": "INVITATION_EXPIRED", "message": "This invitation has expired." }, "requestId": "42" }
```

Validation errors add `error.details: [{ "path": "phone", "message": "Enter a valid phone number" }]`. Stack traces and internal messages never reach clients.

**Rules that apply to every route:**

- Mutations from browsers must send `X-Bulava-CSRF: 1`.
- Ids are UUIDs. A malformed id returns 404.
- Tenant resources are nested under `/events/:eventId`. Non-members get 404.
- Rate limits are 120 requests per minute per IP by default. Auth routes allow 10, guest invitation views 60, and RSVPs 20. Limits are stored in Redis.

## Error codes

| Code | HTTP | Meaning |
|---|---|---|
| VALIDATION_FAILED | 400 | Body or query failed the shared Zod schema |
| UNAUTHENTICATED / SESSION_EXPIRED / INVALID_CREDENTIALS | 401 | |
| FORBIDDEN / CSRF_REJECTED / FUNCTION_NOT_AUTHORIZED | 403 | |
| NOT_FOUND / INVITATION_INVALID / EVENT_NOT_PUBLISHED | 404 | |
| CONFLICT / EMAIL_TAKEN / SYSTEM_GROUP_PROTECTED / FUNCTION_CLOSED | 409 | |
| INVITATION_EXPIRED / INVITATION_REVOKED / INVITATION_USAGE_EXCEEDED | 410 | |
| ATTENDEE_LIMIT_EXCEEDED / RSVP_ANSWER_INVALID / INVALID_REFERENCE / INVALID_EVENT_TYPE | 400 | |
| PIN_REQUIRED / PIN_INVALID / OTP_REQUIRED / OTP_INVALID | 401 | guest verification |
| INVITATION_REQUIRED | 403 | private event without an invitation |
| PLAN_LIMIT_REACHED / PLAN_UPGRADE_REQUIRED | 402 | entitlement limits ([payments.md](payments.md)) |
| TEMPLATE_NOT_AVAILABLE / CUSTOMIZATION_INVALID / UPLOAD_REJECTED / COUPON_INVALID / PAYMENT_VERIFICATION_FAILED | 400 | |
| REGISTRATION_NOT_AVAILABLE / REGISTRATION_INVALID | 400 | [registration.md](registration.md) |
| REGISTRATION_CLOSED / REGISTRATION_FULL / ALREADY_REGISTERED / ALREADY_CHECKED_IN / MEDIA_NOT_READY | 409 | |
| UPLOADS_CLOSED | 403 | |
| MFA_REQUIRED | 403 | staff route without a second factor ([authentication.md](authentication.md)) |
| MFA_INVALID / MFA_CHALLENGE_EXPIRED | 401 | wrong code, or the sign-in step expired |
| MFA_ALREADY_ENABLED | 409 | |
| MFA_NOT_ENABLED / REMINDER_INVALID | 400 | |
| REMINDER_TOO_SOON | 409 | an RSVP reminder went out in the last 12 hours |
| GOOGLE_UNAVAILABLE | 404 | Google sign-in is not configured |
| GOOGLE_FAILED | 401 | the Google flow failed (state, token or unverified email) |
| GOOGLE_LINK_REQUIRED / GOOGLE_ALREADY_LINKED | 409 | an account with this email exists (sign in and link Google), or this Google account belongs to someone else |
| GOOGLE_UNLINK_BLOCKED | 400 | set a password before disconnecting Google |
| DOMAIN_INVALID | 400 | not a usable domain (IP, reserved or Bulava's own name) |
| DOMAIN_TAKEN | 409 | another event holds this verified domain ([custom-domains.md](custom-domains.md)) |
| DOMAIN_UNAVAILABLE | 503 | no certificate source for customer domains is configured |
| SUPER_ADMIN_PROTECTED | 409 | the Super Admin cannot be suspended or re-roled; the role is only handed over ([authorization.md](authorization.md#platform-roles)) |
| WHATSAPP_UNAVAILABLE | 503 | WhatsApp sending is not set up (Integrations) |
| PAGE_SLUG_TAKEN / PAGE_PROTECTED | 409 | another site page has this address; built-in pages keep their address and layout, stay published and can't be deleted |
| ORDER_NOT_PAYABLE | 409 | the order was refunded, cancelled or granted, its plan was retired, or its event deleted |
| CONSENT_REQUIRED | 400 | a new account through Google without the sign-up page's ticked box |
| RESTORE_EXPIRED | 410 | the one-use restore token was used or expired; sign in again |
| EMAIL_UNAVAILABLE | 503 | a console reply needs email to be set up (Integrations) |
| RATE_LIMITED | 429 | |
| PAYMENTS_UNAVAILABLE / SERVICE_UNAVAILABLE | 503 | |
| INTERNAL_ERROR | 500 | |

The web app maps codes to translation keys `error.<CODE>`.

## Typical host flow

```http
POST /api/v1/auth/signup            {"name":"Riya","email":"riya@example.com","password":"…"}
POST /api/v1/events                 {"typeKey":"WEDDING","title":"Aman & Riya Wedding","language":"hi",
                                     "details":{"partnerOne":"Riya","partnerTwo":"Aman"},"applyDefaults":false}
POST /api/v1/events/:id/groups      {"name":"Friends"}
POST /api/v1/events/:id/functions   {"name":"Sangeet","startsAt":"2026-12-14T19:00:00+05:30",
                                     "accessMode":"GROUP_RESTRICTED","audienceGroupIds":["<friends>"]}
POST /api/v1/events/:id/guests      {"name":"Rahul","phone":"98765 43210","groupIds":["<friends>"]}
PUT  /api/v1/events/:id/guests/:guestId/functions
                                    {"assignments":[{"functionId":"<vip-dinner>","guestLimit":3}]}
POST /api/v1/events/:id/invitations/bulk  {"guestIds":["…"]}
PATCH /api/v1/events/:id            {"status":"ACTIVE"}
```

Invitation responses include `url` (`${WEB_ORIGIN}/invite/<token>`). Creating an invitation is idempotent per guest and scope: it returns `{ created: false }` with the existing link.

## Guest flow

```http
GET  /api/v1/public/invitations/:token
POST /api/v1/public/invitations/:token/rsvp
     {"responses":[{"functionId":"<wedding>","status":"ATTENDING","attendeeCount":2,"answers":{"meal":"veg"}},
                   {"functionId":"<sangeet>","status":"DECLINED"}],
      "message":"Congratulations!"}
```

The GET returns the event shell, the guest's name, and only the functions the guest may see. For each function it includes the attendee limit, RSVP state, and localized custom questions. The first GET marks the invitation `OPENED`. Every GET increments the token's use count, which is what enforces single-use links. Responses carry `Cache-Control: no-store` and `X-Robots-Tag: noindex`. Tokens are redacted from request logs.

## Other flows

| Flow | Routes | Docs |
|---|---|---|
| Design and templates | `GET /public/templates`, `GET/PUT /events/:id/design[/:output]`, `GET /events/:id/entitlements` | [templates.md](templates.md) |
| Public event pages | `GET /public/events/:slug`, `POST /public/events/:slug/pin`, `POST /public/events/:slug/register` | [registration.md](registration.md) |
| Registrations | `GET/PUT /events/:id/registration`, `GET /events/:id/registrations`, `POST /events/:id/registrations/:rid/decision` | [registration.md](registration.md) |
| Invitations by email and WhatsApp | `POST /events/:id/invitations/email`, `POST /events/:id/invitations/whatsapp`, `GET /events/:id/invitations/channels` | [notifications.md](notifications.md#whatsapp-business) |
| Photos | `/events/:id/album…` (the album, sub-albums, team uploads), `POST /events/:id/media/:itemId/{moderate,move}`, `/public/media-rooms/:code/{uploads,gallery}` | [media.md](media.md#the-event-album) |
| Sharing | `GET /events/:id/share-link`, `POST /events/:id/share-link/rotate`, `PUT /events/:id/share-link/expiry` | [authorization.md](authorization.md#link-modes-and-personal-modes) |
| Event team | `GET`/`POST /events/:id/members`, `PATCH`/`DELETE /events/:id/members/:memberId`, `POST /events/:id/members/invites/:inviteId/resend`, `DELETE /events/:id/members/invites/:inviteId`; the invited person: `GET /team-invites/:token`, `POST /team-invites/:token/{verify,accept,join}` (10 per minute) | [authorization.md](authorization.md#event-team) |
| Videos and cards | `GET/POST /events/:id/videos`, `…/:jobId/cancel`, `…/:jobId/download`, `GET /music` | [video-rendering.md](video-rendering.md) |
| Check-in | `/events/:id/check-ins/{lookup/:code,summary}`, `POST /events/:id/check-ins` | [qr-system.md](qr-system.md) |
| Payments | `POST /events/:id/orders` `{ planKey, couponCode?, acceptTerms: true }`, `POST /orders/:id/verify`, `GET /orders` (payment history), `GET /orders/:id` (status, the buyer's own orders), `POST /orders/:id/checkout` (retry or finish paying the same order), `POST /payments/razorpay/webhook` | [payments.md](payments.md#payment-status-page) |
| Account | `POST /auth/signup` `{ name, email, password, acceptTerms: true }`; `DELETE /users/me` `{ password }` or `{ confirm: "DELETE" }` (schedules erasure in 30 days); `POST /auth/login` may answer `{ restoreRequired, restoreToken, deleteAt }`; `POST /auth/restore` `{ token }` | [authentication.md](authentication.md#hosts-users) |
| Site pages and contact | public `GET /public/pages`, `GET /public/pages/:slug`, `POST /public/contact` (4 per 10 minutes per IP); staff `/admin/pages` (`page.manage`), `/admin/contact-messages` (`contact.manage`) | [below](#site-pages-and-the-contact-inbox) |
| Admin | `/admin/*` (see below for staff, settings and orders) | [template-studio.md](template-studio.md), [authorization.md](authorization.md#platform-roles) |
| Privacy | `GET /users/me/export`, `DELETE /users/me` | [security.md](security.md) |


## Added in this release

| Area | Routes |
|---|---|
| Two-step sign-in | `POST /auth/login/mfa`; `GET /auth/mfa`; `POST /auth/mfa/setup`, `/auth/mfa/enable`, `/auth/mfa/disable`, `/auth/mfa/recovery-codes` |
| Stay, travel, seating | `GET /events/:id/logistics`; `PUT /events/:id/logistics/settings`; `PUT /events/:id/guests/:guestId/logistics`; `GET`/`PUT /events/:id/functions/:functionId/seating`; exports `travel`, `stays`, `seating`; guest `POST /public/invitations/:token/travel` |
| Live photo wall | `PATCH /events/:id/album` with `liveWallEnabled`; `POST /events/:id/album/wall/rotate`; public `GET /public/walls/:token` and `/qr.svg` |
| Reminders | `GET`/`PUT /events/:id/reminders`; `POST /events/:id/reminders/rsvp/send-now` |
| Google sign-in | `GET /auth/providers`; `GET /auth/google/start?next=`; `GET /auth/google/callback`; `POST /auth/google/link`, `/auth/google/unlink`; `PUT /auth/password` (set or change) |
| Custom domains | `GET`/`PUT`/`DELETE /events/:id/domain`; `POST /events/:id/domain/check`; public `GET /public/domains/resolve?host=` |
| Design photos | `POST /events/:id/media/design-uploads` (signed upload for a photo placed in a template); `POST …/design-uploads/:itemId/complete`; `GET …/design-uploads/:itemId` (processing status). All need `event.update`. |
| Template retirement (staff) | `GET /admin/templates?deleted=true`; `DELETE /admin/templates/:id` (soft delete); `POST /admin/templates/:id/restore` |
| Painted artwork | public `GET /public/template-assets/:assetId?w=` (302 to a signed URL for approved, licensed art in a published template; `Cache-Control: public, max-age=1800`); staff `POST /admin/assets/urls` `{ ids }` (signed preview URLs for Template Studio, `template.manage`) and `POST /admin/assets/:id/renditions` (re-make web renditions, `asset.manage`) |

### Super Admin, staff, settings and orders

Staff routes answer 404 to anyone whose role lacks the permission, so the admin surface is not advertised. Permissions per role: [authorization.md](authorization.md#platform-roles).

| Routes | Permission | Notes |
|---|---|---|
| `GET /admin/users?q=&role=&status=` | `admin.read` | `role` is a platform role, or `STAFF` for everyone but `USER` |
| `GET /admin/users/:id` | `admin.read` | profile: account, counts, events with their plan and the templates used, current paid access, sessions, last 40 audit entries; `orders` and payment totals only with `billing.read` (otherwise `null`) |
| `PATCH /admin/users/:id` `{ status?, platformRole? }` | `user.manage`; roles and staff accounts need `staff.manage` | `SUPER_ADMIN` is never assignable, and the Super Admin is protected (`SUPER_ADMIN_PROTECTED`) |
| `POST /admin/users/:id/sessions/revoke` | `user.manage` (staff: `staff.manage`) | signs the person out everywhere |
| `POST /admin/users/:id/mfa/reset` `{ password, code? }` | `staff.manage` | the caller confirms with their password and, if they use it, an authenticator code |
| `GET /admin/staff` | `staff.manage` | staff with their two-step status, and the permissions of every role |
| `POST /admin/staff/transfer-super-admin` `{ userId, password, code? }` | `staff.manage` | the caller becomes `PLATFORM_ADMIN` and the target `SUPER_ADMIN`, in one transaction |
| `POST /admin/users/:id/grants` `{ planKey, eventId?, note }` | `plan.grant` | complimentary upgrade: a zero-amount `ADMIN_GRANT` order with the same entitlements as a purchase; `eventId` for per-event plans only |
| `POST /admin/orders/:id/revoke` `{ note }` | `plan.grant` | ends a complimentary upgrade's entitlements now (409 if it was already revoked) |
| `GET /admin/orders?status=&kind=&q=&userId=` | `billing.read` | `status` also accepts `ABANDONED` (unpaid after an hour; `CREATED` then means within the first hour). Each order has a readable `state`; `totals` sums customer purchases by status |
| `POST /admin/orders/:id/refund` | `payment.refund` | purchases only; complimentary upgrades are revoked instead |
| `GET /admin/settings` | `settings.manage` | every group with its source (`admin`, `environment`, `default`), secret status (`set` and the last four characters, never the value) and last check; storage (read-only) |
| `PUT /admin/settings/:group` `{ value, secrets }` | `settings.manage` | groups `site`, `seo`, `tracking`, `code`, `payments`, `email`, `whatsapp`, `maps`, `domains`; the group is replaced whole. In `secrets` a string sets, `null` clears and a missing key keeps |
| `POST /admin/settings/checks/:target` `{ to? }` | `settings.manage` | live test of `payments`, `email` (sends a real email through the worker), `whatsapp` (`to` also sends Meta's `hello_world`), `maps`, `domains` or `storage` |
| `POST /admin/settings/site-assets` `{ kind, contentType, sizeBytes }`, `POST …/site-assets/complete` `{ kind, storageKey }`, `DELETE …/site-assets/:kind` | `settings.manage` | logo, favicon and share image: a signed upload, then the stored object's type and size are checked before it is used |
| public `GET /public/site-config` | none | branding, SEO, trackers, header and footer code, and the extra CSP sources public pages need; never secrets. `Cache-Control: public, max-age=60` |
| public `GET /public/site-assets/:kind` | none | 302 to a signed URL of the logo, favicon or share image (signed per hour, so browsers can cache it) |

### Site pages and the contact inbox

| Routes | Permission | Notes |
|---|---|---|
| public `GET /public/pages` | none | published pages for the footer and sitemap: `slug`, `title`, `footerGroup` (`COMPANY`, `LEGAL` or null), `sortOrder`, `updatedAt` |
| public `GET /public/pages/:slug` | none | a published page: `title`, `description`, `layout` (`DOCUMENT`, `CARDS`, `CONTACT`) and `sections` `[{ heading, body }]`; 404 for drafts. The body markup and `{placeholders}` are parsed by `parsePageBody` in `@bulava/validation` |
| `GET /admin/pages`, `GET /admin/pages/:id` | `page.manage` | every page with its public `url` |
| `POST /admin/pages`, `PUT /admin/pages/:id` | `page.manage` | the whole page (`SitePageInputSchema`); built-in pages keep `slug` and `layout` and stay `PUBLISHED` (`PAGE_PROTECTED`) |
| `DELETE /admin/pages/:id` | `page.manage` | pages staff created only |
| public `POST /public/contact` `{ name, email, phone?, topic, message, website? }` | none | returns `{ reference }`. Saves the message and emails the support address (reply-to: the sender). `website` is a hidden field: when filled, nothing is saved |
| `GET /admin/contact-messages?status=&q=&cursor=` | `contact.manage` | 50 at a time, newest first; `q` matches the reference, name, email or text |
| `GET /admin/contact-messages/counts`, `GET /admin/contact-messages/:id` | `contact.manage` | counts by status; one message with its replies |
| `PATCH /admin/contact-messages/:id` `{ status?, note? }` | `contact.manage` | the note is internal and stays out of the audit log |
| `POST /admin/contact-messages/:id/replies` `{ body, resolve }` | `contact.manage` | emails the sender with their message quoted (reply-to: the support address) and keeps the reply; `EMAIL_UNAVAILABLE` until email is set up |
| `DELETE /admin/contact-messages/:id` | `contact.manage` | spam, or a sender's erasure request |

`GET /users/me` also returns `hasPassword`, `googleLinked` and `mfaEnabled`. `PUT /events/:id/design/:output` and `POST /events/:id/videos` accept the wider customization (placed photos, font pairing, opening, effect, hidden sections) and reject photos that are not approved images of the event (`CUSTOMIZATION_INVALID`).

Details: [authentication.md](authentication.md), [logistics.md](logistics.md), [media.md](media.md#live-photo-wall), [notifications.md](notifications.md#automatic-reminders), [custom-domains.md](custom-domains.md), [templates.md](templates.md#customization).
