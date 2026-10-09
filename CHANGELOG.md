# Changelog

## Unreleased

### 513 new illustrated invitations

- **Designs for every occasion**, each an illustrated theme in several layouts with a card for every function:
  - **194 for weddings**: Rajasthani palaces with elephants (*Rajwada*, *Gulabi*, *Panna*), peacock gardens (*Mayur*), South Indian temples (*Kanchi*, *Kerala*), nikah nights of lanterns and domes (*Mehtab*, *Zardozi*), an Anand Karaj (*Laavan*), a Bengali biye (*Sindoor*), Marathi, Gujarati and Banarasi weddings (*Paithani*, *Bandhani*, *Banaras*), church and garden weddings (*Rosewood*, *Lily*), and modern looks in silver, black and gold, sage, blush, terracotta, lavender and ivory.
  - **103 for the other wedding days and anniversaries**: engagements and rokas, haldi, mehendi, sangeet, reception, and golden, silver and ruby anniversaries.
  - **96 birthdays**: unicorns, dinosaurs, rockets, teddies and cupcakes for children, the birthday girl and boy, first birthdays, milestone parties in black and gold or neon, and a sixtieth or seventy-fifth with the kalash and diyas.
  - **120 for families and festivals**: godh bharai, valaikappu and baby showers, namkaran and mundan, griha pravesh, pujas and upanayanam, Diwali, Eid, Holi, Christmas, Navratri and Pongal.
- **New illustrations**: eight couples (Hindu, after the varmala, Sikh, nikah, South Indian, Christian, Bengali, and a couple married for decades), the bride and groom as portraits, a girl and a boy, a baby in a cradle, a mother-to-be, a stork, a teddy, a unicorn, a dinosaur, a rocket, a cupcake, a doli, a dhol, a bowl of haldi and a champagne toast.
- **A Playful font pairing** (Baloo 2 and Pacifico) for children's invitations; any design can switch to it.
- **Photo frames never look empty**: until you add a photo, a frame shows the art or your monogram.
- **Galleries stay quick** with ten times the designs: the design picker and the gallery load each design's full details only when they show it live.
- **Template releases sync themselves.** Every deploy brings new and changed templates live, including changes to a template's tier, tags or order (staff edits in the console are kept). `seed.js --templates-only --dry-run` previews what a release will change.
- **One command to update the server**: `bash infrastructure/scripts/deploy-server.sh` checks out the release, pulls its images, shows the template changes, backs up, starts the stack, waits for the health checks and frees old images.

### Photo privacy, entry passes and a tidier setup

- **Only your team adds photos.** The album link and QR code now open the gallery, where anyone can see and download the photos; nobody can upload with them. Your team (co-hosts and photographers) uploads from the Photos page. To let invited guests add photos from their invitation, turn on *Invited guests can add photos*.
- **The live wall shows a gallery QR code**, *Scan to see and download the photos*, instead of an upload code.
- **Entry passes are your choice.** Invitations show a QR entry pass only when you turn on *Entry with QR passes* on the Check-in page.
- **Scan passes with your phone.** The check-in desk has a camera scanner, and *Scan the next guest* keeps the line moving. Typing the code still works.
- **+91 by default.** Phone and WhatsApp number fields start with India's code; pick another country if needed.
- **Empty functions stay hidden.** Functions without a date no longer appear on the invitation. The Functions step is ticked once a function has a date, time and venue, and the Functions page marks the ones guests cannot see yet.
- **No public link before publishing.** The public page's link appears once you publish. After that, preview links lead to the public page.

### Illustrated cards

- **Nine new invitations designed like printed cards:**
  - *Shahi Gajraj*: a gilded jharokha guarded by two elephants.
  - *Mor Pankh*: a peacock in a watercolour garden.
  - *Kovil Mani*: temple bells, jasmine and a gopuram at dusk.
  - *Noor Mahal*: lanterns, a crescent moon and a skyline of domes.
  - *Eternal Bloom*: roses and doves.
  - *Mehendi Rang*: a hand painted with henna.
  - *Cake & Candles*, for birthdays.
  - *Twinkle Star*, for baby showers and naming ceremonies.
  - *Shubh Griha*, for housewarmings.

  Each has a phone and a desktop design, a card for every function and three colour presets.
- **Foil, paper and illustrations for canvas designs.** Names can be stamped in metallic foil that catches the light. Cards can be printed on paper, linen, grain or a watercolour wash. The Canvas editor adds 28 full-colour illustrations and the illustrated scenes as layers, with previews in its add menu. Layers also get blend modes, soft shadows and glows, and radial gradients.
- **The inline countdown reads Hrs, Min and Sec.** It used to cut words to three letters, which also broke the Hindi labels.
- **Deploys no longer republish a catalog template over rounding noise** in its numbers.

### Codes at sign-up and sign-in, and Continue with WhatsApp

- **Sign-ups confirm the email first.** Creating an account with an email now sends a 6-digit code to it; the account is made once the code is entered. Until then nothing is saved, so nobody can take an address that isn't theirs.
- **A code with every password sign-in.** After the right password, a code goes to the account's email and finishes the sign-in. Accounts with an authenticator app keep using it instead. The email also says what to do if it wasn't you.
- **Forgot password?** The sign-in page now resets a password with a code sent by email. Other devices are signed out.
- **Continue with WhatsApp.** The sign-in and sign-up pages open with WhatsApp, then Google, then email. A code on WhatsApp signs in, or creates the account for a new number with just a name and the Terms box. The page shows when the message is sent and delivered. If the number isn't on WhatsApp, it offers Google or email and password instead.
- **Confirm your WhatsApp number.** A number added on the profile or at sign-up is confirmed with a code from the account page (or Sign-in & security) before it can sign in. Accounts made with WhatsApp add an email the same way, with a code.
- **The console asks for the emailed code too**, unless the staff account uses an authenticator app.
- **Six boxes for codes.** Code fields accept typing, pasting and the phone's suggested code, and send the code when the sixth digit arrives.

### Deploys no longer fill the server's disk

- **Old releases are cleaned up.** Every release brought new copies of each Bulava image and Docker kept them all, so the disk filled with each deploy. The deploy now keeps only the running release and the one before it (for a rollback), and removes unused build cache. `infrastructure/scripts/prune-docker.sh` does the same after a deploy by hand. It never touches containers, volumes or other sites' images.
- **Smaller log files.** Container logs are capped at 30 MB per container instead of 100 MB.

### A guided dashboard

- **Home.** A new Home tab greets the host with the next celebration's countdown, the event to pick up where they left off (with its progress and the one thing to do next), their events, numbers across them, recent activity and shortcuts. Before the first event it offers occasions to start from, how Bulava works, and designs to browse. My events lists every event with its design as the cover and filters for drafts, live and past events.
- **Creating an event in three short steps.** Pick the occasion from cards, add the names (the title fills itself), the day and the invitation language, then keep the functions you are having. A live invitation card follows along. Who can open the invitation is no longer asked here.
- **Choose who can open it when you publish.** Events start as one private link. Publishing opens a dialog with the choices explained as cards, the private link recommended, and then the link to copy or share on WhatsApp. Settings changes it afterwards.
- **What's next, on every page.** Each event page ends with the next step and its button, and a rail of every step (design, functions, guests, publish, share, replies). The sidebar ticks finished steps and shows the setup's progress, and the overview's checklist opens the next step with its explanation.
- **A roomier design page.** Designs are browsed in a full-screen window with plan and search filters, full names and previews, and the chosen one shown live with your names before you pick it. The editor's tabs have icons, and the save button tells you when there are unsaved changes.
- **An account area.** Profile, Sign-in & security, Payments and Privacy & data share one layout with a header showing how well the account is protected. Payments has totals and filters.

### WhatsApp through GetGabs, and Google sign-in from the console

- **GetGabs for WhatsApp.** Integrations → WhatsApp Business now asks which provider sends: GetGabs (the default) or Meta's Cloud API. For GetGabs, enter the production API key, the sender number and, if you like, a campaign ID, so that Bulava's messages appear in that campaign's report. Templates, their variables, plan allowances and failure handling are unchanged.
- **Delivered and read, with GetGabs too.** GetGabs reports delivery only when asked, so the worker asks about each WhatsApp invitation 5 minutes, 1 hour, 6 hours, 1 day and 3 days after sending. With the optional chats webhook (the console generates its address), a guest's reply to an invitation marks it read at once.
- **A connection check that catches template mistakes.** For GetGabs, the check confirms the API key, then that each template exists, is approved, is in the language Bulava sends and has the right number of variables. The test message now goes through the worker with your own first template and sample details, for both providers, instead of Meta's hello_world.
- **Delivery statuses only move forward.** A late "delivered" report no longer turns a read invitation back into delivered. This also applies to Meta's webhook.
- **Google sign-in in the console.** The Super Admin sets up "Continue with Google" under Integrations → Google sign-in: the client ID and secret, the redirect URI to register in Google Cloud, an on/off switch, and a check that Google accepts the client. Changes apply without a restart. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are used only until the settings are first saved.
- **Fixed:** the Meta webhook address in the WhatsApp settings was blank.

### Preview before paying: the new way to start

- **Use this template, no sign-up wall.** On a template page, visitors enter their names, the date and a WhatsApp number and get a draft invitation with that design and a shareable preview link in under a minute. The account is made from the number alone; a password is not needed until they publish. The preview link also goes to their WhatsApp when the WhatsApp Business integration has a *preview link* template (Integrations → WhatsApp).
- **Preview links for every event.** Every event has a preview link (`/preview/<token>`): the invitation exactly as guests will see it, with a “Preview” mark, before publishing and whatever the access settings. The event page and the overview show it with copy, open, share-on-WhatsApp and *New preview link*. Family members opening it see a share button and “Make your own invitation”; the host sees *Edit design* and *Publish*.
- **Any design before paying.** A draft can use a Standard or Premium design and preview it with a watermark; the plan is checked when the event is published (and the design page says so), not when the design is saved.
- **Securing an account.** An account made from a number alone can design, preview and edit functions, but publishing, paying, sending invitations and adding team members ask it to be secured first: a code on WhatsApp, an email and password (**Secure my account**), or Google. The dashboard shows a banner until then.
- **Sign in with WhatsApp.** The sign-in page offers a one-time code on WhatsApp when the integration has an *authentication* template. Sign-up asks for an optional WhatsApp number and a separate, unticked box for updates on WhatsApp; the Account page edits both.
- **Fixed on phones.** The dashboard no longer grows wider than the screen on the photo album, video and overview pages (long links wrap or truncate), and the notifications panel opens inside the screen.

### Canvas templates: design freely in the Studio

- **Canvas sections.** A template page can now carry free-form designs: fixed artboards (a phone one, and optionally a desktop one) with layers placed anywhere: text in theme or fixed fonts, library images or the host's photos in arch, circle, leaf and other masks, shapes, the engine's ornaments (torans, marigolds, diyas, mandalas, lanterns…), icons, and widgets for a countdown, buttons (get directions, add to calendar, RSVP) and date/time/venue rows. A section can repeat once per function, which gives the card-per-event invitations. Designs scale to any screen without scripts, keep text readable against their background (WCAG AA; the checks report layers that opt out), animate layer by layer, and stop moving for reduced motion.
- **Canvas editor in Template Studio.** *Sections → Add section → canvas* opens a full-screen editor: drag, resize and rotate with snapping guides, a layer list with hide and lock, a properties panel for every layer kind, an image picker that also uploads new images with their licence, undo/redo and keyboard shortcuts. It edits the same draft as the Studio, so saving, checks and publishing are unchanged.
- **Two canvas templates.** Rose Arch (weddings and engagements) and Confetti Pop (birthdays and family celebrations) ship as examples, each with phone and desktop heroes and a card for every function. They appear in the gallery after the next seed.
- **Desktop previews at desktop width.** The template page's *Desktop* view and the Studio's desktop preview lay the page out at a laptop width and zoom it to the frame, so desktop layouts show as a visitor sees them instead of as a tablet.

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
