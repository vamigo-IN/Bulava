# Payments, plans and entitlements

Prices and limits are data. Admins change them in the console (Plans & coupons) without a deploy; code only reads feature keys.

## Plans and features

Seeded plans (editable): **Free** (₹0), **Standard** (₹999, one event), **Premium** (₹2,999, one event), **Studio** (₹5,999 per year, planners). Each plan has `PlanFeature` rows:

| Feature key | Meaning |
|---|---|
| `events.max` | events a user may own at once (archived and cancelled events do not count) |
| `functions.max`, `guests.max`, `media.photos.max` | per-event limits |
| `templates.maxTier` | 0 Free, 1 Standard, 2 Premium templates |
| `video.renders.max`, `video.hd` | render quota and full resolution |
| `branding.watermark` | "Made with Bulava" mark |
| `planner.workspace` | planner features (Studio) |

`limit: null` means unlimited; `enabled: false` switches a feature off.

## Entitlements

`EntitlementsService.forEvent(eventId)` computes what an event may do:

1. Start from the **Free plan's** features (the baseline for everyone).
2. Overlay **grants**: `Entitlement` rows created by paid orders, either for one event (event purchases) or for the owner (subscriptions such as Studio).
3. When several grants cover a feature, the more generous one wins.

Limits are enforced where the action happens (creating guests or functions, selecting templates, starting renders, uploading photos, registering). A limit returns `PLAN_LIMIT_REACHED` (402) and a locked template returns `PLAN_UPGRADE_REQUIRED`; the dashboard turns both into upgrade prompts.

## Checkout (Razorpay)

```text
Host → POST /events/:id/orders { planKey, couponCode? }
     → Order CREATED (amount from the plan and coupon; never from the client)
     → Razorpay order created with the gateway's REST API
Browser → Razorpay Checkout → { razorpay_order_id, razorpay_payment_id, razorpay_signature }
     → POST /orders/:id/verify
     → HMAC-SHA256(order_id|payment_id, key secret) checked in constant time
     → finalize(order)
Razorpay → POST /payments/razorpay/webhook  (raw body, X-Razorpay-Signature, webhook secret)
     → payment.captured / order.paid → finalize(order)
```

`finalize` is idempotent: it locks the order row (`SELECT … FOR UPDATE`), records the payment, marks the order `PAID`, increments the coupon's redemptions, and grants entitlements exactly once (keyed by the order). Whichever of the browser callback and the webhook arrives first wins; the other is a no-op. The webhook route reads the raw request body, so its signature is verified over the exact bytes Razorpay sent.

Without `RAZORPAY_KEY` and `RAZORPAY_SECRET` the checkout returns `PAYMENTS_UNAVAILABLE`; everything else still works.

## Consent at checkout

Every purchase needs the buyer's own tick of an unticked box ("I agree to the Terms of Service and the Refund and Cancellation Policy…"), as the Consumer Protection (E-Commerce) Rules, 2020 require: the upgrade page keeps its Pay buttons disabled until it is ticked, and `POST /events/:id/orders` (and `POST /orders`) refuse a request without `acceptTerms: true`. The order records `termsAcceptedAt`, and a `consents` row (`purchase_terms`, source `order:<id>`) keeps the versions of both policies the buyer saw. Complimentary upgrades need no consent.

## Payment history

`/dashboard/payments` (account menu → Payments, and Account settings) lists every order of the signed-in user from `GET /orders`: purchases and complimentary upgrades, with the plan, the event (kept by title after the event is deleted), the amount, the status and the Razorpay payment ID, and the total paid. Each row opens its receipt on the payment status page.

## Payment status page

Every checkout that gets as far as paying ends on `/dashboard/payments/:orderId` (a private page; `lib/checkout.ts` opens Razorpay for the upgrade page and for retries). It reads `GET /orders/:id`, which answers only the buyer, and shows one of:

| What the buyer sees | When |
|---|---|
| **Thank you** with the receipt (plan, event, amount, coupon, order and payment IDs) | the order is `PAID`; the event's data is refreshed and a template chosen before upgrading (`?template=`) is applied |
| **Confirming your payment** | Razorpay reported success but the browser's verification didn't finish (`?state=confirming`); the page checks every 3 seconds while the webhook settles it |
| **Your bank is taking a little longer** | still unconfirmed after 45 seconds; it keeps checking every 10 seconds and says the plan switches on by itself |
| **Your payment didn't go through**, with the bank's reason and **Try again** | the order is `FAILED`, or the buyer closed checkout after a failed attempt (`?state=failed`) |
| **Complete your payment** | an open order nobody has paid yet |
| **Refunded** / **Cancelled** | after a refund or a revoked grant |

**Try again** calls `POST /orders/:id/checkout`, which reopens Razorpay for the same gateway order (creating it if the first attempt failed before the gateway answered) and moves a `FAILED` order back to `CREATED`. Razorpay accepts several attempts on one order and captures at most one, so a retry can never charge twice, and a late webhook for an earlier attempt still finalises the order. The status page never decides that a payment succeeded; it only shows what the API recorded. Payment notifications link to it.

## Coupons

A coupon has either a percentage or an amount off, an optional maximum number of uses, and an optional validity window (end dates are inclusive of the whole day, IST). A coupon that brings the price to ₹0 completes the order without the gateway (provider `COUPON`).

## Refunds

Staff with `payment.refund` (finance managers, platform admins and the Super Admin) refund paid purchases from the console. The API refunds through the gateway, marks the order `REFUNDED`, and ends the order's entitlements immediately. Orders, payments and entitlements keep the event id as a plain value, so financial records survive event deletion and purging.

## Complimentary upgrades

The Super Admin can give a plan free of charge from a user's profile (`POST /admin/users/:id/grants`, `plan.grant`): a per-event plan for one of the person's events, or a yearly plan for the whole account, with a reason. It is recorded as an order of kind `ADMIN_GRANT` for ₹0, with a payment from provider `ADMIN`, the reason and who gave it, so it appears in payment history. It grants exactly the entitlements a purchase would, through the same code, and the customer gets the same in-app notification. Revoking it (`POST /admin/orders/:id/revoke`, with a reason) marks the order `CANCELLED` and ends its entitlements at once. Complimentary upgrades cannot be refunded, and they are left out of revenue totals.

## Payment states in the console

The console spells out what each order means: **Paid**, **Paid with coupon** (a 100% coupon), **Awaiting payment** (checkout started within the last hour), **Abandoned checkout** (unpaid after an hour), **Payment failed**, **Refunded**, **Complimentary**, **Revoked** (a complimentary upgrade that was taken back) and **Cancelled**. The orders list filters by state, by purchase or complimentary, and by customer, and totals customer purchases by status.

## Configuration

The Super Admin enters the Razorpay keys in the admin console (Integrations > Payments). They are stored encrypted and never shown again; *Test connection* checks that Razorpay accepts them and says whether they are live or test keys. Until Payments is first saved there, the API uses the environment:

```bash
RAZORPAY_KEY=rzp_live_…
RAZORPAY_SECRET=…
RAZORPAY_WEBHOOK_SECRET=…     # Razorpay dashboard → Webhooks → https://bulava.in/api/v1/payments/razorpay/webhook
```

Subscribe the webhook to `payment.captured`, `order.paid` and `payment.failed` (the last marks an order failed, so its status page offers a retry); the console shows the exact webhook URL. Switching payments off in the console stops new checkouts, while verification and webhooks for checkouts already started keep working.

## Testing

`apps/api/test/platform.e2e-spec.ts` uses a fake provider that keeps Razorpay's real HMAC verification. It covers the free-plan limits, a verified Premium purchase unlocking templates, forged signatures, the webhook, a 100% coupon, and refunds. `super-admin.e2e-spec.ts` covers complimentary upgrades (the same access as a purchase, no refund, revocation) and the orders list's states, filters and totals.

## Digital cards

Watermark-free cards are bought per card without an account ([cards.md](cards.md#paid-cards)). They use the same gateway, keys and webhook as plans: `PaymentsService.handleWebhook` hands gateway orders it does not know to the card orders (`onOtherPayment`), which settle them the same way (verified signature or webhook, idempotent under a row lock, amounts below the price refused). Card orders are `CardOrder` rows, not `Order`s: they have no user or plan, and their entitlement is the paid image itself. The price is the `cards` settings group (₹50 at least).
