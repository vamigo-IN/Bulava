# The preview desk

Customers who would rather have their invitation made for them ask for a preview. A **preview provider** designs the invitation website, the card or the video invitation with their names, dates and functions, shares it, and the customer gets a link on WhatsApp to their own preview page. Paying once makes the designs theirs: they move into the customer's account, ready to publish, download and share ([ADR-076](decisions.md)).

```
customer asks (/get-preview)          admin enters a customer from outside (console)
            \                                   /
             └──────► request (PV-XXXXXX) ◄────┘
                         │  the open queue, or given to a provider
                         ▼
             provider takes it (/dashboard/desk)
             designs in the editors: website · card · film
                         │  share
                         ▼
   WhatsApp + email: "your preview is ready" ──► /look/<token>
                         │  Make it yours: plan checkout, or the card's price
                         ▼
            paid ──► the designs move into the customer's account
```

## People

| Who | Role / permission | Where | Does |
|---|---|---|---|
| Customer | none (no account needed to ask) | `/get-preview`, `/look/<token>`, dashboard | asks, sees the previews, asks for changes, owns them |
| Preview provider | `PREVIEW_PROVIDER` (`preview.work`) | dashboard → **Preview desk** | takes requests, designs, shares |
| Admin | Platform Admin, Super Admin (`preview.work`, `preview.manage`) | console → **Previews**, and the desk | enters customers from outside, assigns work, sets offers and coupons, closes requests, adds and removes providers |

Preview providers are made only by an admin, in the console's Previews page (*Add a preview provider*: a name and an email, a WhatsApp number or both). An existing customer account takes the role; staff with another role are refused (change them in Staff & roles). A new account belongs to its email or number until a code proves it at the first sign-in (like the quick start's accounts), and gets a welcome email with the way to the desk. The desk is a staff route: in production it asks for two-step sign-in, and the desk says so with the way to turn it on. Removing the role, or suspending the account, puts the provider's open requests back in the queue (`RELEASED` on their timelines); whoever takes each gets what was started.

Providers never reach the console (`admin.read`), and their own events and cards stay apart from the previews they make.

## Requests

`preview_requests` (with `preview_items` and `preview_activities`):

| Field | |
|---|---|
| `reference` | `PV-` and six letters and digits (no 0, O, 1 or I), for people to read out |
| `source` | `WEBSITE` (the form) or `STAFF` (the console) |
| `name`, `phone` (E.164), `email` (optional) | the customer: shown in full only to whoever has the request |
| `eventTypeKey`, `details`, `title`, `date`, `venue`, `city`, `functions`, `language` | the celebration, as the occasion's details schema has it (`couple`: partnerOne and partnerTwo; `honoree`: name; else a title) |
| `wants` | `WEBSITE`, `CARD`, `FILM` |
| `templateKey` | a design they liked (from a template page's *Or let our designers make it for you*) |
| `assigneeId` | the provider who has it |
| `offerPlanKey`, `offerCouponCode` | what owning it costs (below) |
| `tokenHash`, `linkVersion` | the customer page's link (below) |
| `views`, `firstViewedAt`, `lastViewedAt` | visits to the customer's page, once per visitor and half hour |
| `ownerId`, `ownedAt`, `orderId`, `cardOrderId` | who owns the designs, and how |

The form (`POST /public/preview-requests`, rate limited) needs the one unticked box (the Terms, the Privacy Policy and being contacted about the request, recorded as a `preview_contact` consent with the policy versions); a hidden field quietly drops what bots send. A number with an open request gets that request's reference back, its new wishes added and noted on the timeline (`ASKED_AGAIN`). Staff requests (`POST /admin/previews/requests`) take the same fields, the confirmation that the customer agreed to be contacted (`contactConsent`, recorded as `staff-confirmed`), and optionally a provider, an offer and a coupon.

### Statuses

| Status | Meaning |
|---|---|
| `NEW` | waiting in the queue |
| `ASSIGNED` | a provider has it |
| `IN_PROGRESS` | a preview was started |
| `SENT` | at least one preview is shared with the customer |
| `CHANGES_REQUESTED` | the customer asked for changes from their page |
| `OWNED` | the customer owns the designs |
| `CLOSED`, `CANCELLED` | over (admins only; admins can reopen) |

The open queue is every open request (`NEW` to `CHANGES_REQUESTED`) without a provider. Taking one is first come, first served (`PREVIEW_TAKEN` for the second).

## Making previews

On a request's page in the desk, *New preview* picks what to make and a design for the occasion (the customer's liked design first; cards from the designs that make cards):

- **A website or a film** is designed on a draft event the provider holds, made from the request: the occasion, the title from the names, the language, and the functions with their dates, times and venues (else the occasion's main function on the main date, at the venue). Its source is `preview_desk`: it is not in the provider's events, its pages are the design, functions, photos and video (with *Back to the request*), and changing its status is refused (`PREVIEW_HELD`): the customer publishes it once they own it. Each website or film gets its own event unless an event of the request has that one free, so two website designs are two events. The desk and the customer's page follow the design the event uses now.
- **A card** is a card session saved to the provider's account, the request's names, date, venue and functions filled in. *Design* opens it by its id in the card editor (`/cards/editor/<key>?card=<id>`), which shows the request's reference and *Back to the request* instead of *Download*. Downloading or buying it is refused (`PREVIEW_HELD`).

A draft nobody saw can be deleted (its card goes, its event too when no other preview uses it). A shared preview is taken back instead (*Take back*), and can be shared again.

## Sharing, and the customer's page

*Share with the customer* marks the preview `SHARED` and the request `SENT`, and tells the customer (below). The customer's page is `/look/<token>`:

- The token is an HMAC of the request's id and its link version (`previewLookToken`, `@bulava/auth`); the database keeps only its hash. *Replace the link* (the desk) raises the version: the old link stops working at once.
- The web app sends the token to the API in the `x-preview-look` header (`/public/looks`, `/public/looks/cards/:itemId`, `/public/looks/films/:itemId`, `/public/looks/view`, `/public/looks/changes`, `/looks/own`), never in an API path. The page is in `private-routes.ts` (nonce CSP, no trackers), never indexed, with no referrer.
- It shows only what was shared: each website drawn from its own opening with the customer's names (opening on its preview link, `/preview/<token>`, whose pill offers *Make it yours* rather than *Publish*), each card with its watermark (the only way a preview card is seen), each film played in the browser with its watermark. The customer's number and email are never on it.
- A bar along the foot: *Make it yours* with the price (one-time, GST included) and *Ask for changes*, whose words go to the provider by email and to their bell (`PREVIEW_CHANGES`, the request back to `CHANGES_REQUESTED`).
- Before anything is shared it says the preview is being made; once owned, that it is theirs (with the way to their dashboard); once closed, that it ended (with the way to ask again).

## Messages

| Type | To | Channels | When |
|---|---|---|---|
| `PREVIEW_REQUESTED` | customer | WhatsApp (`previewRequested`), email | a request is made (the form or the console) |
| `PREVIEW_READY` | customer | WhatsApp (`previewReady`), email | a preview is shared; *Send the link again* |
| `PREVIEW_NEW` | providers | in-app | a new request in the queue |
| `PREVIEW_ASSIGNED` | the provider | in-app, email | an admin gives them a request |
| `PREVIEW_CHANGES` | the provider (admins while nobody has it) | in-app, email | the customer asks for changes |
| `PREVIEW_REPLY` | the provider (admins while nobody has it) | in-app, email at most hourly | the customer answers on WhatsApp |
| `PREVIEW_OWNED` | the provider, the owner | in-app | the designs are owned |
| `PREVIEW_WELCOME` | a new provider | in-app, email | an admin adds them |

Customers' rows carry only the request's id (`payload.previewRequestId`, no account or guest): the worker reads the number, the email and the link from the request when it sends (`apps/worker/src/previews.ts`). So *your preview is ready* waits a minute after the first share and names everything shared by then (one message for previews shared together), says nothing once the previews were taken back or the request is owned or over, and a link replaced in between is the new one. *Send the link again* is refused within 10 minutes of the last (`PREVIEW_TOO_SOON`). WhatsApp goes only to a number that reaches it (not unreachable, not opted out), outside any event's allowance; a kind without its template goes by email only.

A customer's WhatsApp message answering a preview message, or sent after the last message their number got was one, goes to their provider (`WhatsAppInboxService`): on the request's timeline (`REPLIED`), in the bell with *Reply on WhatsApp* (a `wa.me` link from the provider's own WhatsApp), and by email at most once an hour. Bulava's number never answers by itself.

### Template texts

Submit these in GetGabs → Templates (or WhatsApp Manager), category **Utility**, English, then name them in the console (Integrations → WhatsApp Business):

| Kind | Name (suggested) | Body |
|---|---|---|
| `previewRequested` (2 variables) | `preview_requested` | Hello {{1}}, thank you for asking for a preview of your invitation. Our designer is working on it and will send your preview link here, usually within a day. Your reference is {{2}}. |
| `previewReady` (3 variables) | `preview_ready` | Hello {{1}}, we have made {{2}} for you. See it here: {{3}} You can ask for changes or make it yours from that page. Please keep this link to yourself. |

`{{1}}` is the customer's first name; `{{2}}` the reference, or what was made ("your invitation website and card"); `{{3}}` the link.

## The offer, and owning

Each request has an offer:

- **A plan** (`offerPlanKey`): set at the request to the cheapest public one-time plan that covers what was asked (an event, the liked design's tier, a film) and changeable on the desk (public plans; admins also hidden plans and a coupon). A website or a film is shared only with a plan as the offer.
- **Cards at the card price** (no plan): each card is bought on its own, at the price watermark-free cards sell for.

*Make it yours* needs a signed-in, secured account (`ACCOUNT_UNVERIFIED` otherwise; a visitor signs in and comes back to finish, `?own=1`):

- **A plan the account already has** that costs as much as the offer or more: the designs are theirs at once.
- **Otherwise the plan's checkout** (`/dashboard/checkout?plan=…&look=…&coupon=…`): quotes and the order carry the page's link (`look`); a plan bought from it must be the offered plan (`PREVIEW_ENDED` otherwise), a hidden plan included (the link is the offer). The order keeps the request (`orders.previewRequestId`).
- **A card**: which card (when there are several), an email for the receipt, the ticked terms, then Razorpay; the card order keeps the request (`card_orders.previewRequestId`), and the card's order page downloads it.

When the order is paid, in the transaction that settles it, `PreviewsService.claim` (under the request's row lock):

- **A plan**: each of the request's events changes hands (the buyer becomes its owner and only member, the provider leaves it; source `preview`, a new preview link) and every card of the request is saved in the buyer's account.
- **A card**: every card of the request is saved in the buyer's account (the others as drafts they can buy at the card price).
- The request is `OWNED` by the buyer, the provider and the buyer get a notification, and the payment page says the designs are in the account. Someone else paying afterwards (two checkouts open at once) owns nothing more: a card buyer keeps their paid card through its order; a plan buyer is refunded by staff (`BOUGHT_AGAIN` on the timeline).

The customer's dashboard lists the previews made for them (`GET /previews/mine`: asked for while signed in, owned, or for their confirmed WhatsApp number), with the way to each page or, once owned, to the invitation.

## Routes

| Route | Who | |
|---|---|---|
| `POST /public/preview-requests` | anyone | the form |
| `GET /public/looks`, `GET /public/looks/cards/:itemId`, `GET /public/looks/films/:itemId`, `POST /public/looks/view`, `POST /public/looks/changes` | the link (`x-preview-look`) | the customer's page |
| `POST /looks/own` | signed in, the link | make it yours |
| `GET /previews/mine` | signed in | previews made for the account |
| `GET /desk/summary`, `GET /desk/requests[?scope=mine\|open\|all&status&q&page]`, `GET /desk/requests/:id` | `preview.work` (`all`: `preview.manage`) | the desk |
| `POST /desk/requests/:id/take`, `…/release`, `PATCH …/status`, `PUT …/offer`, `POST …/notes` | `preview.work` | a request |
| `POST /desk/requests/:id/items`, `…/items/:itemId/share`, `…/withdraw`, `DELETE …/items/:itemId`, `POST …/send`, `POST …/link/rotate` | the request's provider, or `preview.manage` | previews and the link |
| `GET /admin/previews/requests[/:id]`, `POST /admin/previews/requests`, `POST …/:id/assign`, `PATCH …/:id/status`, `PUT …/:id/offer`, `POST …/:id/notes` | `preview.manage` | the console |
| `GET /admin/previews/providers`, `POST /admin/previews/providers`, `DELETE /admin/previews/providers/:id` | `preview.manage` | preview providers |

Closing, cancelling and reopening a request and changing its coupon are for `preview.manage`. Every change is on the request's timeline, and the security-relevant ones in the audit log (`preview.requested`, `preview.entered`, `preview.taken`, `preview.released`, `preview.assigned`, `preview.status_changed`, `preview.offer_changed`, `preview.shared`, `preview.link_replaced`, `preview.owned`, `preview.provider_added`, `preview.provider_removed`, `event.ownership_transferred`).

## Keeping

A preview card is kept while its request is open (the card retention leaves it alone), then like any card in an account. A held event stays with its request; deleting a draft website preview deletes its event when nothing else uses it.

## Testing

`apps/api/test/previews.e2e-spec.ts` (kept in the working copy, not committed) walks the whole desk against Postgres and Redis: the form (consent, bots, one request per number), providers made by an admin, the queue and taking, website and card previews (held, never published or downloaded, a second website a second event), sharing and its one message, the customer's page and its token, changes, owning through the offered plan (the event, its members and the card move, the order's page says so), a customer from outside who buys one card at the card price, and removing a provider. `apps/worker/src/previews.test.ts` covers the messages; `node_modules/.cache/standin/preview-checks.mjs` and `console-preview-checks.mjs` check the pages in Chrome against the stand-in API.
