# Changelog

## Unreleased

### Reliability and CI

- **CI on supported runtimes.** Every GitHub action is on its Node 24 release (Node 20 is deprecated on GitHub's runners). Runners are pinned to Ubuntu 24.04, so `ubuntu-latest` moving to Ubuntu 26 on 19 October 2026 can't change a build without a commit. pnpm's version now comes only from `packageManager`.
- **Steadier app builds.** The two Next.js apps download about 40 Google Fonts families while they build. Building them at the same time could trip Google's rate limit, which caused the occasional "App build failed; retrying" warning, so CI now builds them one after the other. A retry now shows its reason on the run page.
- **Error handling.**
  - The admin console has error and "page not found" screens, and the website has a last-resort error page for when its root layout fails.
  - The API and the workers log an unhandled promise rejection instead of exiting.
  - The worker's daily jobs (event lifecycle, purges of deleted events and accounts, stale uploads) log an item that fails and carry on with the rest.

### Consent, account deletion and payment history

- **Consent boxes.** Creating an account (with email or Google) and buying a plan each need a box the person ticks: Terms and Privacy at sign-up, and Terms and Refund policy at checkout. The boxes are never pre-ticked, and each consent is recorded with the version of the policy that was shown. Google sign-up works only from the sign-up page with the box ticked.
- **Deleting an account, with 30 days to change your mind.** Deleting needs the password (or typing DELETE for Google-only accounts). Events go offline at once. Signing in within 30 days offers **Restore my account**, which brings everything back. After 30 days the account and its events are erased, and the person gets a last email. Payment records, consent records and security logs are kept without contact details, as the law requires.
- **Payment history.** **Payments** in the account menu, and in Account settings, lists every plan bought with its status, amount and payment ID. Each payment opens its receipt.
- **Legal pages for Indian law.** The privacy policy and terms are rewritten around the DPDP Act and Rules, the IT Act with the SPDI and Intermediary Rules, and the Consumer Protection (E-Commerce) Rules. They now cover itemised notice and consent, rights and how to use them, breach reporting, children's data, content rules, takedown timelines and the Grievance Appellate Committee. There are two new pages: **Account deletion policy** and **Grievance redressal** (timelines, plus the National Consumer Helpline, e-Daakhil and the Data Protection Board).

### Policies, About and Contact, managed from the console

- **Finished pages.** About, Contact, the privacy policy, terms of service, refund and cancellation policy, shipping and delivery policy, and a new cookie policy replace the drafts. They are written in plain English for India's Digital Personal Data Protection Act, the IT Act and rules, and the consumer e-commerce rules. Everything they say about cookies, retention, security and refunds matches what the product does.
- **Pages in the admin console.** Content managers edit every page under **Website > Pages**, with a live preview, and can create new pages, keep them as drafts and choose their footer column. Built-in pages keep their address, stay published and can't be deleted.
- **Company details in one place.** The legal name, registered address and grievance officer (**SEO > Business details**) fill the policies and the contact page. Lines that need a detail stay hidden until it is entered.
- **One support address.** support@bulava.in is the default everywhere: footer, pages, contact form and replies.
- **Contact form and inbox.** The contact page has a form, and every message gets a reference number. Messages arrive in **Support > Messages** (new `contact.manage` permission, given to Support), where staff reply by email, set a status and keep internal notes. New messages are also emailed to the support address. Spam is deleted after 30 days, and other messages two years after they were last touched.
- **Footer text in the console.** The line under the logo, the description, the copyright line and an extra line (for example the CIN or GSTIN) are set under **Branding & contact > Footer**. The Company and Legal columns list the pages.

### Payment status page

After checkout, buyers land on a status page. It thanks them and shows the receipt once the payment is confirmed. While a confirmation is still pending, it keeps checking and asks them not to pay again. If a payment fails, it shows the reason and a **Try again** button. Retrying reopens the same Razorpay order, so nobody can be charged twice. Payment history and payment notifications link to this page.

### A cleaner templates gallery

Filters moved to a sidebar (a fold-out panel on phones), with a count next to each choice. Active filters show as chips you can remove one by one. The cards are shorter and quieter: the phone rises out of a stage tinted with the template's own colours, with its formats, colour palette, price and a demo button.

### A new look for the public site

The marketing pages and the sign-in screens have been redesigned in a soft 3D ("clay") style on a warm cream background, still in Bulava maroon and gold ([web-design.md](docs/web-design.md)).

- **Type.** Headings use Fraunces and text uses DM Sans. These are the only two fonts that preload.
- **3D buttons and cards.** Buttons are glossy and lift slightly on hover. Cards stand out from the page, and inputs look pressed in. All surfaces are lit from the same side.
- **One light canvas.** The home page no longer switches between dark and light sections. Only the pricing band and the footer stay dark. The header is a solid bar from the top of the page.
- **Template cards** work like product cards. Each shows its category and plan, its price and a "Live demo" button. On phones, the filter chips sit in rows you scroll sideways.
- **Content pages.** About and contact show their sections as numbered cards. Contact has one-tap email, call and WhatsApp tiles, taken from the site settings. Privacy, terms and refunds are laid out as one document with an "On this page" index, and the pages refresh every 5 minutes.
- **Shared parts.** The dashboard uses the same buttons and form fields. Its layouts are unchanged.

### Faster marketing pages

The home page scored 26 for performance in Lighthouse on a phone. It took 10.5 s to show its headline and blocked the main thread for 12 s. The main causes and their fixes:

- **Template galleries are images.** They used to be live renders: 28 previews made about 28,000 DOM elements and 4.9 MB of HTML. They are now pre-rendered WebP previews (about 20 KB each, lazy-loaded), and so are the hero phone and the posters of films and cards. The home page's HTML went from 483 KB to about 60 KB compressed, and its DOM from 30,800 to about 2,000 elements. `infrastructure/scripts/template-previews.mjs` regenerates them ([templates.md](docs/templates.md#marketing-previews)).
- **Trackers wait for the visitor.** Analytics and custom code load on the first scroll, tap or key press, or after 8 seconds, instead of during page load.
- **Smaller scripts.** The error page, the site header, the sign-in form and the dashboard shell no longer pull in the whole template engine (and with it Zod, about 450 KB). A card or the hero phone loads the engine only for a template that has no preview image yet. The home page no longer uses framer-motion.
- **The headline shows at once.** The hero title and subtitle rise into place without starting hidden.
- **Fewer font downloads.** The rupee sign now comes from two 1 KB fonts cut from the site's own fonts and inlined in the stylesheet, so it looks the same. Devanagari text in the interface uses the device's font. Together this replaces 295 KB of extra web-font subsets.

Lighthouse's mobile test of a local production build, against the production API, gave the following for the home page:

| Metric | Before | After |
|---|---|---|
| Performance score | 26 | 84 (runs ranged from 69 to 84 as the test machine's CPU load varied) |
| First contentful paint | 5.4 s | 1.8 s |
| Largest contentful paint | 10.5 s | 4.0 s |
| Total blocking time | 12.35 s | 0.11–0.6 s |
| Page weight | 2.7 MB | 0.6 MB |

`/templates` went from 1.1 MB to 250 KB of HTML.

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
