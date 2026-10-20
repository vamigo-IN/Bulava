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
| `INVITATION` | email, WhatsApp | guest | host clicks *Email invitations* or *Send on WhatsApp* (`POST /events/:id/invitations/email`, `…/whatsapp`); by email instead when WhatsApp cannot deliver it |
| `REGISTRATION_CONFIRMED` | email and WhatsApp | registrant | a registration is confirmed (at once, by the host, or from the waiting list): the event, when and where, and their own link |
| `EVENT_UPDATE` | email and WhatsApp | guests in the audience | a published announcement (each channel can be switched off) |
| `GALLERY_SHARED` | email and WhatsApp | guests with an invitation | the host's *Send to guests* on the Photos page, or the morning after the last function |
| `RSVP_RECEIVED` | in-app, email | host | a guest RSVPs |
| `REGISTRATION_RECEIVED` | in-app | host | someone registers on the public page |
| `REGISTRATION_UPDATE` | email | registrant | pending, waitlisted, declined or cancelled |
| `GUEST_REPLY` | in-app, email | host | a guest wrote to the WhatsApp number (the email at most once an hour per guest) |
| `RENDER_COMPLETE` | in-app | requester | a video or card finished rendering |
| `PAYMENT` | in-app | buyer | an order was paid, or the Super Admin gave a complimentary upgrade |
| `PLAN_PURCHASED` | email and WhatsApp | buyer | a purchase was paid: the receipt |
| `PAYMENT_FAILED` | email and WhatsApp | buyer | Razorpay reports a failed payment (at most every 6 hours per order) |
| `PAYMENT_PENDING` | email and WhatsApp | buyer | a checkout opened at the gateway is still unpaid 30 minutes later (once) |
| `RSVP_REMINDER` | WhatsApp or email | invited guests who have not replied | the host's scheduled time, or *Send reminder now* |
| `FUNCTION_REMINDER` | WhatsApp or email | guests who can attend the function and have not declined | N hours before each function |
| `PREVIEW_REQUESTED` | email and WhatsApp | someone who asked for a preview | their request arrived ([previews.md](previews.md#messages)) |
| `PREVIEW_READY` | email and WhatsApp | someone who asked for a preview | a preview was shared with them: the link to their page, a minute later so previews shared together go in one message |
| `PREVIEW_NEW`, `PREVIEW_ASSIGNED`, `PREVIEW_CHANGES`, `PREVIEW_REPLY`, `PREVIEW_OWNED`, `PREVIEW_WELCOME` | in-app (and email, but `NEW` and `OWNED`) | preview providers (admins while nobody has a request), owners | the preview desk's work |

"Email and WhatsApp" messages go by email to everyone with an address and on WhatsApp to everyone whose number reaches it (see [Follow-ups](#follow-ups)); "WhatsApp or email" messages take one channel per guest.

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
| WhatsApp Business | GetGabs (default) or Meta's Cloud API, with approved templates (Integrations > WhatsApp Business) | implemented |
| SMS | provider interface in `apps/worker/src/providers.ts` | not configured; rows are marked `SKIPPED` |
| Push | — | not started |

The worker builds providers from the Super Admin's settings and rebuilds one only when its settings change, so a change applies within about 15 seconds, without a restart. Without email settings, email rows are `SKIPPED` with "Email provider not configured", so nothing is silently lost. In development the compose `mailpit` service catches all mail at http://localhost:8025. Emails show the site name from Branding & contact in their header and footer.

Hosts can also share invitations themselves: the dashboard builds WhatsApp links (`wa.me`) with the guest's personal URL, which needs no provider.

## WhatsApp Business

The Super Admin connects the platform's WhatsApp Business number in Integrations → WhatsApp Business, through one of two providers ([ADR-042](decisions.md)):

- **GetGabs** (the default; [app.getgabs.com](https://app.getgabs.com), a Meta business partner). Its panel connects the number to Meta and holds the templates. Bulava needs the production **API key** (stored encrypted), the **sender number** connected in GetGabs, and optionally a **campaign ID** (GetGabs → Campaign Lists) so Bulava's messages appear in that campaign's report. Messages go to `POST https://app.getgabs.com/whatsappbusiness/send-templated-message`, Meta's template message body with the key, sender and campaign added.
- **Meta Cloud API** (direct): the phone number ID, a permanent system-user token (stored encrypted) and, for delivery statuses, the app secret and a webhook verify token.

Both send the same templates, approved by Meta (created in GetGabs → Templates, or in WhatsApp Manager) and named in the settings with their language, one per kind (`WHATSAPP_TEMPLATE_KINDS` in `@bulava/validation`; a kind without a template goes by email only):

| Kind | Body variables |
|---|---|
| `invitation` | `{{1}}` guest's name, `{{2}}` event, `{{3}}` personal invitation link |
| `reminder` | `{{1}}` guest's name, `{{2}}` event (function reminders: "function · event"), `{{3}}` personal invitation link |
| `registrationConfirmed` | `{{1}}` guest's name, `{{2}}` event, `{{3}}` date and time, `{{4}}` venue, `{{5}}` personal invitation link |
| `eventUpdate` | `{{1}}` guest's name, `{{2}}` event, `{{3}}` the update ("title: message", on one line), `{{4}}` personal invitation link |
| `galleryShared` | `{{1}}` guest's name, `{{2}}` event, `{{3}}` the album's link with the guest's key |
| `planPurchased` | `{{1}}` buyer's first name, `{{2}}` plan, `{{3}}` amount paid, `{{4}}` receipt link |
| `paymentFailed`, `paymentPending` | `{{1}}` buyer's first name, `{{2}}` plan, `{{3}}` link to finish the payment |
| `previewRequested` | `{{1}}` customer's first name, `{{2}}` the request's reference |
| `previewReady` | `{{1}}` customer's first name, `{{2}}` what was made ("your invitation website and card"), `{{3}}` the link to their preview page |
| `otp` | an *Authentication* template with a copy-code button: the six-digit code fills `{{1}}` and the button |

The suggested wording for each, ready to submit in GetGabs, is in [Template texts](#template-texts). Variables are never empty and never contain line breaks (WhatsApp refuses both): the worker flattens them and writes "See your invitation" when a function has no date or venue.

*Check connection* tests the provider. For GetGabs it opens a session with the API key, then looks up each template named in the settings: it must exist, be approved, be in the language Bulava sends, and have as many variables as Bulava fills (`WHATSAPP_TEMPLATE_VARIABLES`). For Meta it checks the token and the number, with its quality rating. Given a phone number, it also sends a real message through the worker, exactly as guests get them: the first template set, with sample details.

The **sign-in code** goes to hosts rather than guests, through the `whatsapp` queue without a notification row, for signing in with a WhatsApp number and for proving a number during the quick start. Without it, hosts sign in with email; nothing else changes ([authentication.md](authentication.md#quick-start-whatsapp-codes-and-provisional-accounts)). The quick start's preview link is shown on screen; it is no longer sent on WhatsApp.

- **Allowance.** Each plan has a per-event number of WhatsApp messages (`messaging.whatsapp.max`: Free none, Standard 300, Premium and Studio 1000 by default; edit them in Plans & coupons). Queued and sent messages count; skipped and failed ones do not. Pricing pages list the allowance only while WhatsApp is set up.
- **Sending invitations.** *Send on WhatsApp* on the Invitations page (`POST /events/:id/invitations/whatsapp`) queues one message per guest with a phone number (their event-wide link first), skips anyone messaged in the last 10 minutes, and stops at the allowance (`PLAN_UPGRADE_REQUIRED` on a plan without messages, `PLAN_LIMIT_REACHED` when used up). `GET /events/:id/invitations/channels` tells the page what is available and how much is used.
- **Reminders.** While a reminder template is set, RSVP and function reminders go on WhatsApp to guests with a phone number, as long as the allowance lasts, and by email to everyone else.
- **No overspending.** Host sends and the worker's reminder dispatch take the same per-event lock (`lockWhatsAppAllowance`, a transaction-scoped advisory lock) before counting what is left, so two at once cannot spend the same messages.
- **Failures.** A permanent error from the provider (wrong number, template or key; GetGabs reports some refusals with HTTP 200 and `status: false`) marks the notification and its delivery `FAILED` with the provider's message, and is not retried or charged. Rate limits and server errors fail the job, so the queue retries it with backoff.
- **Numbers not on WhatsApp** ([ADR-073](decisions.md)). When WhatsApp says a number cannot get messages (Meta's error 131026, "message undeliverable", or GetGabs' wording for it), at sending or later in a delivery report, the number is marked `UNREACHABLE` in `whatsapp_numbers` and skipped by every send for 60 days: invitations count it as *not on WhatsApp* (`skippedNotOnWhatsApp`), reminders and follow-ups go to the guest's email instead, and the worker skips rows already queued for it. An invitation or a reminder that WhatsApp could not deliver is written again as an email when the guest has an address (`whatsappEmailFallback`, once per message). Nothing waits on such a number, and its messages are not charged. Any message from the number makes it reachable again.
- **STOP and START.** A guest who sends STOP (or unsubscribe, opt out) is `OPTED_OUT`: no WhatsApp message of any kind goes to the number until it sends START (or subscribe, opt in). Their host is told, in the dashboard and by email.
- **Delivery status.** The invitations page shows whether each WhatsApp invitation was delivered and read. Meta pushes statuses to `POST /api/v1/whatsapp/webhook`, signed with the app secret (the `GET` handshake answers with the verify token). GetGabs reports a message's status only when asked (`/whatsappbusiness/getmessgageinfobyid`), so the worker's `whatsapp-status` task (every 10 minutes) asks about each invitation 5 minutes, 1 hour, 6 hours, 1 day and 3 days after sending. Reports only move a delivery forward (sent, delivered, read, or failed), because they can arrive out of order (`recordWhatsAppDelivery` in `@bulava/database`).
- **Delivery of other messages.** Updates, confirmations, the album and buyers' messages are read back from GetGabs only to learn that they failed (5 minutes and 1 hour after sending); Meta pushes their statuses to the same webhook. A failed one is marked `FAILED` (not charged) and its number handled as above.
- **GetGabs' chats webhook.** In GetGabs → Settings → Developer Tools, *Webhook URL for All Chats* takes `<site>/api/v1/whatsapp/getgabs?token=<webhook token>`. It brings guests' replies (below), STOP and START; a reply to an invitation or a tap on one of its buttons also marks the invitation read at once. Without it, GetGabs replies stay in GetGabs' own inbox. GetGabs does not sign its calls, so the address carries a secret token, generated in the console and shown in full only until it is saved. It travels in the query string, which Nginx does not log and the API's logs redact.

### Replies

Bulava's number never answers on its own: a guest's message goes to their host, and someone who asked for a preview reaches whoever is making it (the message answers a preview message, or the last message their number got was one; [previews.md](previews.md#messages)). `WhatsAppInboxService` finds the guest (the message it answers, by the provider's message id, else the guest this number last got a message as, in a live event within 30 days) and tells the event's owner: a `GUEST_REPLY` in the dashboard (the bell and the home page, with *Reply on WhatsApp*, a `wa.me` link that opens a chat with the guest from the host's own WhatsApp) and an email with the message and the same button, at most once an hour per guest. A message from a number Bulava cannot tie to a guest only updates the number's standing.

## Follow-ups

`MessagesService` (API) sends a message on every channel its person can get ([ADR-073](decisions.md)):

- **To guests** (`toGuests`): an email to each guest with an address, and the same message on WhatsApp to each whose number reaches it (not unreachable or opted out), while the kind's template is set and the event's plan has WhatsApp messages left, counted under the allowance lock. The confirmation of a registration, a host's update and the album go this way; the API answers with what went where (`delivery: { email, whatsapp, whatsappSkipped }`), which the dashboard shows.
- **To buyers** (`toBuyer`): an email to their address and WhatsApp to their confirmed number (`phoneVerifiedAt`), outside any event's allowance (the rows have no event): the receipt (`PLAN_PURCHASED`) when a purchase is paid, `PAYMENT_FAILED` when Razorpay reports a failed payment (claimed with `failedNoticeAt`, so at most once in 6 hours per order), and `PAYMENT_PENDING` from the worker.
- **To someone who asked for a preview** (`toPreviewCustomer`, [ADR-076](decisions.md)): an email when they gave one and WhatsApp to their number while the kind's template is set and the number reaches it, outside any allowance. The rows carry only the request's id (`previewRequestId`); the worker reads the number, the email and the link from the request when it sends.
- **Scheduled by the worker** (`apps/worker/src/follow-ups.ts`): `payment-follow-ups` (every 5 minutes) reminds a buyer once about a purchase checkout opened at the gateway 30 minutes to a day ago and still unpaid, unless they paid for another order since or were told it failed (`pendingNoticeAt`); `gallery-follow-ups` (hourly) sends the album to an event's guests the morning after its last function (from 09:00 to 20:00 in the event's time zone, within 7 days) when the album has an approved photo, the host left the message on (`autoShareGallery`) and has not sent the album since the last function began, the gallery is not private and the plan includes it, once per event (`galleryAutoSharedAt`).

At delivery the worker checks again: a payment reminder is dropped once the order is paid, the album once the gallery is private, an update once it is deleted.

### Template texts

Submit these in GetGabs → Templates (or WhatsApp Manager), category **Utility**, language English, then enter each name in the console. Meta refuses a template that starts or ends with a variable, so each has words around them.

| Name (suggested) | Body |
|---|---|
| `registration_confirmed` | Hello {{1}}, your place at {{2}} is confirmed. When: {{3}}. Where: {{4}}. Your personal invitation, with all the details and the hosts' updates: {{5}} Please keep this link to yourself. |
| `event_update` | Hello {{1}}, there is an update about {{2}}: {{3}} See the details on your invitation: {{4}} Thank you. |
| `event_album` | Hello {{1}}, the photos from {{2}} are in the album. See them and save your favourites here: {{3}} Enjoy the memories! |
| `plan_purchased` | Hello {{1}}, thank you! Your {{2}} plan is unlocked. You paid {{3}} once (GST included): nothing renews. Your receipt: {{4}} Happy celebrating! |
| `payment_failed` | Hello {{1}}, your payment for the {{2}} plan did not go through. If any money left your account, your bank returns it automatically. Try again here: {{3}} Your design and guests are safe. |
| `payment_pending` | Hello {{1}}, your {{2}} plan is waiting for payment. It takes a minute to finish here: {{3}} Your design and guests are saved. |
| `preview_requested` | Hello {{1}}, thank you for asking for a preview of your invitation. Our designer is working on it and will send your preview link here, usually within a day. Your reference is {{2}}. |
| `preview_ready` | Hello {{1}}, we have made {{2}} for you. See it here: {{3}} You can ask for changes or make it yours from that page. Please keep this link to yourself. |

A receipt for a fully discounted order says "₹0".

## Announcements

```http
POST /api/v1/events/:id/announcements
{ "title": "Venue changed", "body": "…", "audience": { "all": true }, "notifyByEmail": true, "notifyByWhatsApp": true }
```

Both channels are on by default: email to guests with an address, WhatsApp to guests whose number reaches it within the event's allowance ([Follow-ups](#follow-ups)). The response says how many got it each way.

Audiences: everyone, guests of specific functions, specific groups, or specific guests. Membership is evaluated with the same access rules as invitations (`AudienceService.announcementIncludes`), so a guest who cannot see a function never hears about it. Published announcements also appear on each guest's invitation page.

## Direct email (OTP)

One-time codes for invitation verification go through the `email` queue as a complete message and are not stored as notifications. Codes themselves are stored only as hashes.

## Running the worker

```bash
pnpm --filter @bulava/worker dev    # WORKER_CONCURRENCY (default 10); health on :4101
```
