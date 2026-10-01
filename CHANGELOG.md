# Changelog

## 1.0.0 — first production release (1 October 2026)

The first version meant for real hosts and guests. Deploy it by pushing the tag `v1.0.0` (the deploy workflow sends `v*` tags to production) after working through the [go-live checklist](docs/deployment.md#go-live-checklist).

### For hosts and guests

- Events of any kind (weddings first, and birthdays, griha pravesh, pujas, corporate and community events) with functions, guest groups and per-function access, so every guest sees only what they are invited to.
- 73 templates from one catalog, identical locally and in production: 53 invitation websites (including the illustrated 3D and *Signature* collections with openings and music), 17 video invitations and 3 cards.
- **One link to share.** Public, private-link and secret-link events show their link on the overview and the Invitations page, with Copy and Share on WhatsApp, and take registrations from it by default, so hosts no longer add guests before sharing. Invite-only and group-only events still use personal invitations, and say so. Secret links expire (a week after the event unless the host picks another date) and can be replaced; an expired link tells the visitor to ask the host for a new one ([ADR-035](docs/decisions.md#adr-035-link-modes-share-one-link-and-take-registrations-by-default-secret-links-expire-2026-10-01)).
- **Inviting team members by email.** Hosts add anyone by email and role. People without an account get a link and a 6-digit code, enter the code, choose their name and password, and are on the team; the code never expires but works once. Waiting invitations can be sent again or cancelled ([ADR-036](docs/decisions.md#adr-036-team-members-are-invited-by-email-with-a-one-use-code-2026-10-01)).
- **The dashboard follows the role.** Each team member sees only the sections and actions of their role; a photographer sees only Photos and can only upload. A section outside someone's role says so, and refused actions read "You do not have permission to do that" instead of "Something went wrong".
- **One album per event.** One upload link and QR code, one gallery and one live wall, with a folder per function (made automatically), General and the host's own folders. Photographers upload straight into a folder without waiting for approval; guests pick a folder (the current function is preselected); the host chooses which folders the gallery and the wall show; the gallery has a tab per folder ([ADR-037](docs/decisions.md#adr-037-one-album-per-event-with-a-folder-per-function-2026-10-01)).
- Personal invitation links by WhatsApp and email, RSVPs per function with automatic reminders, public registration, stays, travel, pickups and seating, a live photo wall, event-day check-in, custom domains, and Razorpay upgrades.
- Email and Google sign-in with optional two-step sign-in; data export and account deletion.
- A redesigned website and dashboard ([web-design.md](docs/web-design.md)): a cinematic dark hero with a live 3D invitation stage, scroll-revealed sections, pointer-lit cards, 3D tilt, a custom cursor and smooth scrolling on marketing pages; a new dashboard shell, event header, grouped navigation, animated statistics and a checklist progress ring. Everything respects reduced motion and passes the accessibility audit.

### For the platform

- The Super Admin runs the site from the admin console: branding, SEO, trackers, custom code, Razorpay, SMTP, WhatsApp, Maps and custom domains are settings rows with encrypted, write-only secrets; staff and roles, users, orders, moderation and operations have their own pages.
- Exactly one Super Admin, enforced by the database; the seat is handed over, never assigned twice. Staff need two-step sign-in in production.
- The production `migrate` job seeds the same reference data and template catalog as development, creates the platform owner, and uploads Bulava's original music track (royalty-free, generated in-house).

### Security and operations

- Nonce-based CSP on private pages, a static policy on marketing pages, first-party httpOnly sessions, rate limits, audit logging and signed URLs for every stored file.
- Containers run as non-root with `no-new-privileges`; app containers and the migrate job drop every Linux capability; the stack publishes only `127.0.0.1:${BULAVA_HTTP_PORT}` so it can share a server behind its existing Nginx.
- Dependency audit clean for production dependencies; Sentry collects no personal data; CI runs lint, typecheck, app and image builds with a Trivy scan, `pnpm audit` and a gitleaks secret scan; the unit and end-to-end suites are kept out of the repository and run before each release.

### Known limits

- Remotion needs a paid company licence for companies with more than three employees before video rendering is used commercially.
- Hindi and Hinglish strings and the legal pages still need review by native speakers and counsel.
- SMS notifications are not sent yet (WhatsApp Business and email are).
