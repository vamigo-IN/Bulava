# Notifications and announcements

Every notification is a database row first and a delivery second. That makes delivery auditable, retryable and visible to hosts.

## Model

`NotificationsService.notify({ type, channel, eventId?, userId?, guestId?, payload })` creates a `Notification`:

- `IN_APP` rows are delivered immediately (the dashboard bell reads `GET /notifications`, and `POST /notifications/:id/read` marks them read).
- `EMAIL`, `SMS`, `WHATSAPP` and `PUSH` rows are `QUEUED` and a `notifications` job carries only the row id. The worker loads the row, renders the message and sends it through a provider, then marks it `SENT`, `SKIPPED` (with a reason) or `FAILED` for a retry.

Payloads never contain secrets. Invitation links are rebuilt by the worker from the encrypted token at send time, in memory only.

## Types

| Type | Channel(s) | Sent to | Trigger |
|---|---|---|---|
| `INVITATION` | email, WhatsApp | guest | host clicks *Email invitations* or *Send on WhatsApp* (`POST /events/:id/invitations/email`, `…/whatsapp`); a registration is confirmed |
| `EVENT_UPDATE` | email | guests in the audience | a published announcement with email on |
| `RSVP_RECEIVED` | in-app, email | host | a guest RSVPs |
| `REGISTRATION_RECEIVED` | in-app | host | someone registers on the public page |
| `REGISTRATION_UPDATE` | email | registrant | pending, waitlisted, declined or cancelled |
| `RENDER_COMPLETE` | in-app | requester | a video or card finished rendering |
| `PAYMENT` | in-app | buyer | an order was paid, or the Super Admin gave a complimentary upgrade |
| `RSVP_REMINDER` | WhatsApp or email | invited guests who have not replied | the host's scheduled time, or *Send reminder now* |
| `FUNCTION_REMINDER` | WhatsApp or email | guests who can attend the function and have not declined | N hours before each function |

`POST /events/:id/invitations/email` sends one email per guest with an address (their event-wide link first), records an `InvitationDelivery`, marks the invitation sent, and skips anyone emailed in the last 10 minutes so a double click cannot spam guests.

## Automatic reminders

Hosts set them on the RSVPs page (`GET`/`PUT /events/:id/reminders`, `POST /events/:id/reminders/rsvp/send-now`):

- **RSVP reminder** at a chosen time, to guests with an email (or a phone number, while WhatsApp reminders are set up) and a live invitation who have not replied at all. *Send reminder now* schedules it for the next minute and is refused within 12 hours of the last one (`REMINDER_TOO_SOON`), so guests are never spammed. A time older than 24 hours when the worker sees it (after an outage) is skipped.
- **Function reminders** 3, 12, 24 or 48 hours before each scheduled function, to guests who can attend it (the same `evaluateFunctionAccess` rules, through each of their invitations) and have not declined it or the event. Moving a function makes it due again for the new time.

The API only stores the schedule. The general worker's `reminders` job runs every minute: it claims each due reminder with a conditional update and creates the notification rows in the same transaction, so replicas and retries never send twice. It also re-queues `QUEUED` rows older than 10 minutes, in case a worker stopped between saving and queueing. At delivery the worker checks again (the guest may have replied, the function may have moved or been cancelled) and marks those rows `SKIPPED`. The emails are in the guest's language, with the date and time in the event's time zone, the venue and its map link.

Emails are localized to the guest's preferred language, falling back to the event language, and use an inline-styled layout that works in common email clients.

## Providers

| Channel | Provider | Status |
|---|---|---|
| Email | SMTP via nodemailer, set up in the admin console (Integrations > Email; `SMTP_*` variables until first saved there) | implemented |
| WhatsApp Business | Meta Cloud API with approved templates (Integrations > WhatsApp) | implemented |
| SMS | provider interface in `apps/worker/src/providers.ts` | not configured; rows are marked `SKIPPED` |
| Push | — | not started |

The worker builds providers from the Super Admin's settings and rebuilds one only when its settings change, so a change applies within about 15 seconds, without a restart. Without email settings, email rows are `SKIPPED` with "Email provider not configured", so nothing is silently lost. In development the compose `mailpit` service catches all mail at http://localhost:8025. Emails show the site name from Branding & contact in their header and footer.

Hosts can also share invitations themselves: the dashboard builds WhatsApp links (`wa.me`) with the guest's personal URL, which needs no provider.

## WhatsApp Business

The Super Admin connects the platform's WhatsApp Business number in Integrations: phone number ID, a permanent system-user token (stored encrypted), and the names of two templates approved in WhatsApp Manager, one for invitations and one for reminders. Both templates take the same body variables: `{{1}}` the guest's name, `{{2}}` the event (for function reminders, "function · event"), `{{3}}` the guest's personal invitation link. *Test connection* checks the token and number (with its quality rating) and can send Meta's `hello_world` sample to a phone.

Two more templates are for hosts rather than guests, and travel through the `whatsapp` queue without a notification row: a **preview link** template (`{{1}}` the host's first name, `{{2}}` the design's name, `{{3}}` the preview link) sent right after the template page's quick start, and a **sign-in code** template of Meta's *Authentication* category with a copy-code button (the six-digit code fills `{{1}}` and the button) for signing in with a WhatsApp number and for proving a number during the quick start. Without them, previews are not sent and hosts sign in with email; nothing else changes ([authentication.md](authentication.md#quick-start-whatsapp-codes-and-provisional-accounts)).

- **Allowance.** Each plan has a per-event number of WhatsApp messages (`messaging.whatsapp.max`: Free none, Standard 300, Premium and Studio 1000 by default; edit them in Plans & coupons). Queued and sent messages count; skipped and failed ones do not. Pricing pages list the allowance only while WhatsApp is set up.
- **Sending invitations.** *Send on WhatsApp* on the Invitations page (`POST /events/:id/invitations/whatsapp`) queues one message per guest with a phone number (their event-wide link first), skips anyone messaged in the last 10 minutes, and stops at the allowance (`PLAN_UPGRADE_REQUIRED` on a plan without messages, `PLAN_LIMIT_REACHED` when used up). `GET /events/:id/invitations/channels` tells the page what is available and how much is used.
- **Reminders.** While a reminder template is set, RSVP and function reminders go on WhatsApp to guests with a phone number, as long as the allowance lasts, and by email to everyone else.
- **No overspending.** Host sends and the worker's reminder dispatch take the same per-event lock (`lockWhatsAppAllowance`, a transaction-scoped advisory lock) before counting what is left, so two at once cannot spend the same messages.
- **Failures.** A permanent error from Meta (wrong number, template or token) marks the notification and its delivery `FAILED` with Meta's message, and is not retried or charged. Rate limits and server errors fail the job, so the queue retries it with backoff.

## Announcements

```http
POST /api/v1/events/:id/announcements
{ "title": "Venue changed", "body": "…", "audience": { "all": true } , "notifyByEmail": true }
```

Audiences: everyone, guests of specific functions, specific groups, or specific guests. Membership is evaluated with the same access rules as invitations (`AudienceService.announcementIncludes`), so a guest who cannot see a function never hears about it. Published announcements also appear on each guest's invitation page.

## Direct email (OTP)

One-time codes for invitation verification go through the `email` queue as a complete message and are not stored as notifications. Codes themselves are stored only as hashes.

## Running the worker

```bash
pnpm --filter @bulava/worker dev    # WORKER_CONCURRENCY (default 10); health on :4101
```
