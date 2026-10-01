# Public event registration

Events shared by one link (public, private link or secret link) let people register themselves (spec §89):

```text
Event page (from the shared link) → Register → Guest record → Registration → Confirmation (personal invitation)
```

Once confirmed, a registrant is an ordinary guest with an invitation link, so RSVP, photos, announcements and check-in all work unchanged.

## On by default for link-shared events

A host who shares one link should not have to add guests first, so registration starts **open** for link modes (`PUBLIC`, `PRIVATE_LINK`, `SECRET_TOKEN`; see [authorization.md](authorization.md#link-modes-and-personal-modes)):

- creating an event in a link mode switches registration on (`openRegistrationByDefault`, with the Registered guests group);
- moving an event from invite-only or group-only to a link mode switches it on again, even if it had been saved off;
- moving between link modes keeps the host's choice;
- a link-mode event that never saved a setting (made before this default) counts as open: the event page, the Registrations tab and the share card switch it on the first time they read it;
- copying an event applies the same rule to the copy.

Invite-only and group-only events never take registrations: their page needs a personal invitation. The host can still turn registration off at any time.

## Host settings

`PUT /events/:id/registration` (dashboard: Registrations tab):

| Setting | Meaning |
|---|---|
| `enabled` | accept registrations (only for link-mode events: `PUBLIC`, `PRIVATE_LINK`, `SECRET_TOKEN`) |
| `fields` | extra questions (text, number, yes/no, one choice, several choices), localized labels, required flag; name, email and mobile are always asked |
| `maxRegistrations` | confirmed places; empty = no cap beyond the plan's `guests.max` |
| `approvalRequired` | new registrations wait for the host |
| `waitlistEnabled` | when full, new registrations join a waiting list instead of being refused |
| `closesAt` | registration closes at this time (the event's time zone in the dashboard) |

Enabling registration creates a **Registered guests** group. Every registrant joins it (and All Guests), so hosts can target functions, announcements and galleries at registrants.

## What happens when someone registers

`POST /public/events/:slug/register` with `{ name, email?, phone?, answers, preferredLanguage?, consent: true }`:

1. The same gate as viewing the page: the event must be public, private-link with a valid PIN pass, or secret-link with the current key (the `x-bulava-link-key` header or the event's link cookie). Drafts return 404; invite-only events and a missing or wrong key return `INVITATION_REQUIRED`; an expired key returns `EVENT_LINK_EXPIRED`.
2. Registration must be enabled and open, and answers must match the configured fields (`REGISTRATION_INVALID` names the field).
3. Under a row lock on the event's settings (so concurrent registrations cannot oversell):
   - an email or phone already registered, or already on the guest list, returns `ALREADY_REGISTERED` (people already invited are told to use their own link; no link is ever handed out for an existing guest);
   - the plan's guest limit and the capacity decide the status: `PENDING` (approval required), `CONFIRMED`, `WAITLISTED`, or `REGISTRATION_FULL`.
4. The guest, the registration and a consent record (`event_registration`, versioned) are created. A confirmed registrant gets an event-wide invitation.
5. The registrant is emailed their invitation (confirmed) or a status update (pending, waitlisted). The host gets an in-app notification.

The response shows the registrant their own invitation link once, when confirmed. The endpoint is rate limited to 5 requests per minute per IP. Every step is audited.

## Host decisions

`POST /events/:id/registrations/:registrationId/decision` with `CONFIRM`, `WAITLIST`, `REJECT` or `CANCEL`:

| From | Allowed |
|---|---|
| `PENDING` | confirm, waitlist, reject |
| `WAITLISTED` | confirm, reject |
| `CONFIRMED` | cancel |

Confirming respects the cap (`REGISTRATION_FULL`). Rejecting or cancelling revokes the guest's invitation links. When a confirmed place frees up and approval is not required, the oldest waitlisted registrants are confirmed automatically and emailed. Raising the cap does the same.

## Public page

`GET /public/events/:slug` includes `registration: { open, fields, approvalRequired, spotsLeft, full, waitlist, closesAt }` (no personal data). The web page renders the form in the template's RSVP section, or below the invitation when the template has none, in the event's language.

## Tests

`apps/api/test/registration.e2e-spec.ts`: availability rules, consent and answer validation, capacity and waiting list, duplicates, cancellation with automatic promotion, approval flow and cap, PIN gating, closing time, tenant isolation and audit.

`apps/api/test/share-link.e2e-spec.ts`: the default per mode and on mode changes, registering through a secret link, expiry and replacement, copies, and older events without a setting.
