# Authorization

Two independent systems decide access.

1. **Host-side RBAC.** Who can manage an event. It is based on `EventMember.role` and granular permissions.
2. **Guest-side access policy.** Which functions a guest or visitor may see and RSVP to. It is based on the access policy, the audience, and the invitation scope.

Both live in `packages/auth` as pure functions with no I/O, so they are unit tested exhaustively.

## Host RBAC

Code checks permissions, never role names. `@RequireEventPermission('guest.write')` on a route makes `EventPermissionGuard` do the following:

1. Validate `:eventId` from the URL. The body is never trusted for identity.
2. Load the caller's `EventMember` row for that event, excluding soft-deleted events.
3. Return **404** if the caller is not a member, so event ids cannot be probed. Return **403** if the role lacks the permission.
4. Attach `EventAccessContext` for services, which then scope every query with `eventId`.

| Permission | OWNER | ADMIN | CO_HOST | FUNCTION_MGR | GUEST_MGR | MEDIA_MGR | PHOTOGRAPHER |
|---|---|---|---|---|---|---|---|
| event.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| event.update / publish | ✓ | ✓ | ✓ | | | | |
| event.delete | ✓ | | | | | | |
| member.manage, payment.read, audit.read | ✓ | ✓ | | | | | |
| function.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| function.manage | ✓ | ✓ | ✓ | ✓ (own functions) | | | |
| guest.read | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| guest.write, group.manage | ✓ | ✓ | ✓ | | ✓ | | |
| invitation.read / send / revoke | ✓ | ✓ | ✓ | | ✓ | | |
| rsvp.read | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| rsvp.write | ✓ | ✓ | ✓ | | ✓ | | |
| media.view / upload | ✓ | ✓ | ✓ | view | | ✓ | ✓ |
| media.delete / moderate | ✓ | ✓ | ✓ | | | ✓ | |

## Platform roles

Staff access to the admin console is a separate system: `User.platformRole` maps to platform permissions in `packages/auth/src/permissions.ts`, and staff routes are decorated with `@RequirePlatformPermission(...)`. `PlatformPermissionGuard` re-reads the role from the database on every request, so a role change or suspension applies to the very next request, and it answers 404 (not 403) to anyone without the permission, so the admin surface is not advertised. Platform roles never bypass event tenancy: staff see customer data only through the admin routes.

| Permission | Support | Content manager | Finance manager | Platform admin | Super Admin |
|---|---|---|---|---|---|
| `admin.read`: open the console, look up accounts and events | ✓ | ✓ | ✓ | ✓ | ✓ |
| `billing.read`: payments, revenue, payment history | ✓ | | ✓ | ✓ | ✓ |
| `media.moderate` | ✓ | ✓ | | ✓ | ✓ |
| `template.manage`, `asset.manage`, `content.manage` | | ✓ | | ✓ | ✓ |
| `pricing.manage`, `payment.refund` | | | ✓ | ✓ | ✓ |
| `user.manage`: suspend customers, sign them out | | | | ✓ | ✓ |
| `plan.grant`: complimentary upgrades | | | | | ✓ |
| `settings.manage`: site settings and integrations | | | | | ✓ |
| `staff.manage`: staff roles, two-step resets, the handover | | | | | ✓ |

`USER` (every customer) has no platform permissions.

**Exactly one Super Admin.** A partial unique index (`users_one_super_admin_key`, over a constant, limited to `SUPER_ADMIN` rows) makes a second one impossible whatever the code does. The role is never assigned through the API (`ASSIGNABLE_PLATFORM_ROLES` leaves it out); it changes hands with `POST /admin/staff/transfer-super-admin`, which needs the Super Admin's password and, when they use two-step sign-in, a code, and demotes them to `PLATFORM_ADMIN` in the same transaction. When staff two-step sign-in is required, only someone with it turned on can take over. The seed makes `ADMIN_EMAIL` the Super Admin only while there is none, so a deploy never takes the role back. For recovery on the server, `pnpm admin:set-role <email> SUPER_ADMIN --replace` moves it and signs both people out.

**Protected accounts.** The Super Admin cannot be suspended or re-roled through the console, and only the Super Admin changes staff roles, suspends staff, signs staff out or resets their two-step sign-in, so other staff cannot act on the Super Admin at all. Nobody suspends, re-roles or resets their own account from the admin routes. Role changes, handovers, two-step resets, sign-outs, complimentary upgrades and settings changes are written to the audit log.

## Guest access policy

Four inputs, kept in separate models:

| Input | Model |
|---|---|
| Function | `EventFunction.status`, `visibility` (LISTED/UNLISTED) |
| Access policy | `AccessPolicy.mode`, owned by the event (required) or the function (optional override) |
| Audience | `FunctionAudienceGroup` (groups), `FunctionGuest` (direct assignment, `allowed=false` = explicit deny) |
| Invitation scope | `Invitation.functionId` (null = event-wide) |

### Decision order (`evaluateFunctionAccess`)

1. `DRAFT` function → deny (`FUNCTION_NOT_PUBLISHED`). Cancelled functions stay visible so guests learn of the cancellation.
2. Anonymous viewer: listed + `PUBLIC` → allow. Listed + `PRIVATE_LINK` → allow once the PIN (if set) is verified. Listed + `SECRET_TOKEN` → allow with the event's current, unexpired secret link (`linkVerified`), otherwise deny (`LINK_REQUIRED`). Everything else → deny.
3. Guest with a function-specific invitation for a different function → deny (`OUTSIDE_INVITATION_SCOPE`).
4. Explicit deny (`FunctionGuest.allowed=false`) → deny, overriding everything.
5. By effective mode:
   - `PUBLIC`, `PRIVATE_LINK`, `SECRET_TOKEN`: listed → allow; unlisted → needs assignment or audience group.
   - `INVITE_ONLY`: direct assignment or audience-group membership.
   - `GROUP_RESTRICTED`: audience-group membership only.

### Link modes and personal modes

`isLinkMode(mode)` splits the access modes in two. A host shares a **link mode** event with one link and needs no guest list; a **personal mode** event is reached only through each guest's own invitation.

| Mode | What the host shares (`GET /events/:id/share-link`) | Registration |
|---|---|---|
| `PUBLIC` | the event page, `/e/<slug>` (or the event's own domain) | open by default |
| `PRIVATE_LINK` | the event page; visitors also need the PIN when one is set | open by default |
| `SECRET_TOKEN` | the event page with a secret key, `/e/<slug>?k=<key>`, that expires | open by default |
| `INVITE_ONLY`, `GROUP_RESTRICTED` | nothing: add guests and send personal invitations | off |

Personal invitations work in every mode. "Open by default" means registration is switched on when the event is created in a link mode and when it moves from a personal mode to a link mode, and an event that never saved a setting is treated as open. Moving between link modes keeps the host's choice ([registration.md](registration.md)). The share link is shown on the overview and the Invitations page.

**Secret links.** The key is 256 random bits, stored on `AccessPolicy` as a SHA-256 hash (lookup) and AES-GCM ciphertext (so the host can copy it again), never in plain text. It expires a week after the event's last date, or 90 days after it was made when no date is set, and never more than a year ahead. The host can pick a new date within a year (`PUT /share-link/expiry`) or replace the link (`POST /share-link/rotate`); the old key stops working at once. Both need `event.update`, reading the link needs `invitation.read`, and both changes are audited. A copied event gets its own key. The web middleware moves `?k=` into an httpOnly cookie for that event (`bulava_link_<slug>`, `SameSite=Lax`, 90 days) and redirects to the clean address, so the key does not stay in the address bar or leak in a `Referer`. The API reads the key from the `x-bulava-link-key` header or that cookie. An expired key gets `EVENT_LINK_EXPIRED` (410) with a message to ask the host for a new link, and a wrong one is treated like no key at all (`INVITATION_REQUIRED`).

### Invitation tokens (`validateInvitationToken`)

A token is rejected when it or its invitation is revoked (`INVITATION_REVOKED`, 410), expired (`INVITATION_EXPIRED`, 410), or over its `maxUses` (`INVITATION_USAGE_EXCEEDED`, 410). Revocation wins over expiry. Unknown or malformed tokens return `INVITATION_INVALID` (404) without touching the database for malformed shapes.

Tokens are revoked automatically when the invitation is revoked or regenerated, when the guest is removed, when the function (for function-specific invitations) is deleted, or when the event is deleted.

### Attendee limits

The maximum attendees for a function is `max(FunctionGuest.guestLimit, plusOneAllowed ? 2 : 1)`, or 1 when access comes only from a group. Declines are stored with `attendeeCount = 0`.

## Guest verification

- **PIN** (`PRIVATE_LINK`): `POST /public/events/:slug/pin` checks the scrypt hash and returns a signed, time-limited pass, stored by the web app as an httpOnly cookie for that event only.
- **Secret link** (`SECRET_TOKEN`): the key in the shared link, described above.
- **OTP** (`requireOtp`): guests confirm a code sent to their email before seeing the invitation; codes are HMAC'd at rest, expire in 10 minutes and allow five attempts.
- **Public registration** uses the same gate as viewing a link-mode page ([registration.md](registration.md)).

## Event team

`/events/:id/members` manages co-hosts and staff (`member.manage`, held by OWNER and ADMIN). The host enters an email and a role:

- **The email has a Bulava account:** they join at once (`{ kind: 'MEMBER' }`) and get an in-app notification.
- **It does not:** an invitation is created (`{ kind: 'INVITED' }`) and emailed with a link and a 6-digit code. On `/team/join/<token>` they enter the code, then choose their name and password; the account is created with the email marked verified (receiving the code proved it), they join the team and are signed in. If an account with that email exists by then, they sign in with it instead and join with the code (`POST /team-invites/:token/join`, only as the invited email).

The code has no time limit but works once: joining marks the invitation `ACCEPTED`, and the link and code stop working. Five wrong codes lock it (`TEAM_INVITE_LOCKED`). The host sees waiting and locked invitations on the team card and can **send again** (a new link and code; the old ones stop working, and a locked invitation unlocks) or **cancel** it. Inviting the same email again replaces the earlier invitation. The link token (256 bits) and the code are stored only as hashes (the code as an HMAC bound to the invitation), and the email job is removed from the queue once sent, so neither is kept anywhere in plain text. Invitations, resends, cancellations, locks and joins are audited.

The OWNER cannot be changed or removed, only the OWNER can grant, change or remove ADMIN (or invite one), and nobody can change their own role. Removing a member ends their access on the next request.

For event-day check-in, add gate staff as **Guest manager** (`guest.write`).

### The dashboard follows the role

The API sends the caller's role and permissions with the event (`EventDto.role`, `EventDto.permissions`). The dashboard lists only the sections the role can use (`SECTION_PERMISSIONS` in `apps/web/src/lib/permissions.ts`), so a photographer sees only Photos and lands there, and actions inside a page (approving, folder settings, the live wall) appear only with their permission. Opening a section outside the role shows "This section is not part of your role" with a way to the sections they have, and a refused request (403) reads "You do not have permission to do that", never a generic error. This is presentation only: the API enforces every permission.

## Not yet implemented

- Ownership transfer between accounts.
