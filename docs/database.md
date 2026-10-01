# Database

PostgreSQL 16 with Prisma 6. The schema is in `packages/database/prisma/schema.prisma`. The generated client is written to `packages/database/generated/client` so it ships with the package, and it is re-exported from `@bulava/database`.

## Conventions

- **Ids** are UUIDv7 (`@default(uuid(7))`). They are time-ordered for index locality and never sequential, so they are safe to expose. Cursor pagination orders by id.
- **Tenancy.** Every tenant-owned row carries `eventId`, directly or through its parent. Join tables such as `function_guests` and `guest_group_members` also carry `eventId` for cheap scoped queries.
- **Time.** Timestamps are UTC. `Event.timezone` (IANA, default `Asia/Kolkata`) is used for display and for converting host-entered wall-clock times.
- **Soft delete.** `deletedAt` on users, events, functions and guests. Deleting a function rewrites its slug (`slug~deleted~<id>`) so the name can be reused.
- **Emails** use `citext` for case-insensitive uniqueness.
- **Categories are data.** `event_types`, `languages`, `pricing_plans` and `plan_features` are rows seeded by `seedReferenceData`. Seeding is idempotent and never overwrites admin edits.

## Main tables (milestone 1)

| Table | Purpose | Key constraints and indexes |
|---|---|---|
| users | Hosts, staff, admins; platform role; encrypted TOTP secret and last used step; Google subject | unique email (citext), unique phone, unique googleSub; partial unique index: at most one `SUPER_ADMIN`; check: an enabled second factor has a secret |
| sessions | Refresh-token sessions; `mfa` when the sign-in passed two-step verification | unique tokenHash; userId, familyId |
| mfa_recovery_codes | One-time recovery codes (SHA-256 hashes) | unique (userId, codeHash) |
| events | One per celebration | unique slug, unique accessPolicyId; (ownerId, deletedAt), (visibility, status) |
| event_members | User ↔ event role | unique (eventId, userId) |
| access_policies | Access mode, PIN hash, OTP requirement | 1:1 with an event or a function |
| event_functions | Haldi, Sangeet, … | unique (eventId, slug); (eventId, sortOrder); check endsAt > startsAt |
| venues | Venue per function | eventId |
| guests | One row per person per event; VIP flag and dietary needs | (eventId, deletedAt), (eventId, phone), (eventId, email) |
| guest_stays / guest_travel | Where a guest stays; arrival and departure | stay unique per guest; travel unique (guestId, direction), (eventId, direction, at); checks: check-out after check-in, 1–50 travellers |
| seat_assignments | Table and seat per guest per function (not an access row) | PK (functionId, guestId); (eventId, functionId) |
| guest_groups | Family, Friends, All Guests (SYSTEM) | unique (eventId, slug) |
| guest_group_members | Guest ↔ group (M:N) | PK (groupId, guestId); guestId |
| function_audience_groups | Group-based audience | PK (functionId, groupId) |
| function_guests | Direct assignment / explicit deny, limit, RSVP mirror | PK (functionId, guestId); (eventId, rsvpStatus); check guestLimit ≥ 1 |
| invitations | Event-wide or function-specific | partial unique: one live event-wide and one live per function per guest |
| invitation_tokens | SHA-256 hash + AES-GCM ciphertext | unique tokenHash |
| rsvps | Event-level (functionId NULL) or per function | partial unique (guestId) WHERE functionId IS NULL; (guestId, functionId) WHERE NOT NULL |
| rsvp_questions / rsvp_answers | Custom localized questions | unique (eventId, key); unique (rsvpId, questionId) |
| audit_logs | who / what / target / when / where / result | (eventId, createdAt), (actorId, createdAt), (targetType, targetId) |
| templates / template_versions | catalog entries and immutable definitions | unique key; current version pointer; tier, badge, featured, sort order |
| event_template_selections | an event's website / video / card choice + customization | unique (eventId, output) |
| assets / asset_licenses / template_assets / music | design assets and tracks with licence metadata | unique storageKey; licence expiry for alerts |
| media_rooms / media_items | photo rooms and uploads; live-wall link hash and ciphertext | unique originalKey; unique wallTokenHash; (eventId, status); check: hash and ciphertext set together |
| event_domains | an event's custom domain: ownership token, status, certificate provider id, last check | unique eventId; hostname; partial unique (hostname) WHERE verifiedAt IS NOT NULL; check: hostname lower case, at most 253 characters |
| event_reminder_settings | RSVP reminder time and sent marker, hours before functions | PK eventId; rsvpReminderAt; check hours 1–168 (functions store `reminderSentFor`) |
| video_jobs / generated_videos | render jobs and outputs | (status, createdAt), eventId |
| qr_codes / check_ins | photo-room and check-in codes; attendance | unique code; (eventId, functionId) |
| announcements / notifications | updates and delivery records | (userId, readAt), eventId |
| pricing_plans / plan_features / coupons / orders / payments / entitlements | commerce; an order's `kind` is `PURCHASE` or `ADMIN_GRANT` (a complimentary upgrade, with its `note` and `grantedById`) | unique plan key, coupon code, provider order id; orders (status, createdAt) |
| platform_settings | the Super Admin's site settings and integrations, one row per group: values, AES-GCM encrypted secrets, the last connection test | PK key |
| event_registration_settings / registrations | public registration | registration unique per guest; (eventId, status, createdAt); check maxRegistrations > 0 |
| testimonials | real, consented reviews | check rating 1–5 |
| consents, otp_challenges, analytics_events, organizations, translations, languages, event_types | supporting data | |

Orders, entitlements and audit logs keep `eventId` as a plain column (no foreign key), so financial and audit history survives when an event is purged.

Partial unique indexes and check constraints are hand-written at the end of the migration files (for example `*_init` and `*_public_registration`), because Prisma cannot express them.

## Workflow

```bash
pnpm infra:up                                  # postgres + redis
pnpm db:migrate                                # prisma migrate dev (create/apply in development)
pnpm --filter @bulava/database migrate:create  # create a migration without applying, to hand-edit SQL
pnpm db:deploy                                 # apply migrations (CI / production)
pnpm db:seed                                   # reference data, template catalog, platform admin (ADMIN_EMAIL/ADMIN_PASSWORD)
pnpm --filter @bulava/database seed:templates  # also publish changed catalog definitions as new versions
pnpm admin:set-role <email> <ROLE> [--replace] # set a platform role; SUPER_ADMIN needs --replace while someone holds it
```

`prisma migrate dev` needs an interactive terminal when a migration drops data. In automation, generate the SQL instead and commit it as a new migration folder:

```bash
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
```

Never edit a production schema by hand. Every change is a migration committed to git.

## Lifecycle and retention

The general worker runs two daily jobs: events move `ACTIVE → COMPLETED` two days after their last function and `COMPLETED → ARCHIVED` after 180 days (`EVENT_COMPLETE_AFTER_DAYS`, `EVENT_ARCHIVE_AFTER_DAYS`), and soft-deleted events are purged permanently after `EVENT_RETENTION_DAYS` (default 30), including their photos and videos in storage. Each change is audited.

## Backups

Nightly encrypted `pg_dump` to a separate, versioned bucket, with a scripted restore test into a throwaway database (see [deployment.md](deployment.md#backups-and-restore-spec-71)). WAL archiving for point-in-time recovery can be added once traffic justifies it. The VPS disk is never the only copy.
