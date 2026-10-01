# Custom domains

A host on the Premium or Studio plan can serve one event from their own domain, for example `amanweddsriya.com`. The domain opens the event's page, and new guest links (invitations, photo-album QR codes) use it. The plan feature is `domain.custom`. Each event can have one domain, and each domain can serve only one event at a time.

## Availability

Customer domains need HTTPS certificates for names Bulava does not own. The feature is on only when the platform has a way to get them:

| Setting | Certificates come from |
|---|---|
| `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ZONE_ID` | Cloudflare for SaaS (recommended) |
| `CUSTOM_DOMAIN_TLS=manual` | the operator, who installs a certificate for each customer domain (also used in development) |
| neither | nobody: the settings card says custom domains are coming soon, connecting answers `DOMAIN_UNAVAILABLE`, and the worker skips domain checks |

Without a certificate source, a domain would pass its DNS checks, go live, and move guests' links to an `https://` address that cannot connect. That is why the feature stays off. Cloudflare for SaaS does not require Bulava's main domain to move to Cloudflare: the SaaS zone can be a separate, inexpensive domain used only as the CNAME target for customers (for example `domains.<that-domain>`), while the main site keeps its own DNS and certbot certificate.

## How it works for the host

1. **Connect.** Event → Settings → *Your own domain*: the host enters the domain. It is normalised: lower case, punycode for Hindi and other IDN names, and any scheme, path or port is removed. IP addresses, reserved names (`localhost`, `.test`, `.example`, `.local` and so on) and Bulava's own hosts are refused with `DOMAIN_INVALID`.
2. **Add the DNS records** shown on the card:

   | Type | Name | Value | Purpose |
   |---|---|---|---|
   | `TXT` | `_bulava-challenge.<domain>` | `bulava-verify=<token>` | proves the host owns the domain; needed once, and hidden after it verifies |
   | `CNAME` | `<domain>` | `domains.bulava.in` (`CUSTOM_DOMAIN_TARGET`) | sends visitors to Bulava |
   | `A` (alternative) | `<domain>` | each address in `CUSTOM_DOMAIN_ADDRESSES` | for apex domains at DNS providers without CNAME flattening; shown only when configured |

3. **Wait or press *Check now*.** The domain goes **Live** once all three checks pass:
   1. the TXT record holds the token;
   2. the name CNAMEs to the target, or all of its A records are Bulava's;
   3. the certificate provider reports an active certificate.

   The card explains what is still missing, using these codes:

   | `lastError` | Meaning |
   |---|---|
   | `TXT_MISSING` | the ownership record is not visible yet |
   | `ROUTING_MISSING` | the domain does not point to Bulava |
   | `SSL_PENDING` | DNS is fine and the certificate is being issued (usually minutes) |
   | `PROVIDER_ERROR` | the certificate service did not answer; retried automatically |
   | `EXPIRED` | not verified within 7 days; the host can fix the records and check again |
   | `TAKEN` | another event holds this name (see [Ownership and squatting](#ownership-and-squatting)) |

4. **Remove** at any time. The certificate is released and links go back to `bulava.in`.

## What the domain serves

The Next.js middleware (`apps/web/src/middleware.ts`) looks at the `Host` header. Main-site hosts (`bulava.in`, `www.`, internal names and IPs) are served as usual. Any other host is looked up through `GET /api/v1/public/domains/resolve?host=` (cached for 60 seconds, 30 for misses). Only ACTIVE domains of events that have not been deleted resolve.

| Path on the customer domain | Result |
|---|---|
| `/` | the event page (rewritten to `/e/<slug>`), under the strict nonce CSP |
| `/e/<slug>` | 308 to `/` |
| `/invite/<token>`, `/p/<code>`, `/healthz` | served as on the main site |
| anything else (pricing, login, dashboard, other events) | 307 to the same path on `bulava.in` |
| unknown host | 404 "This site is not available." |

The domain is an alias for the event's pages, and those pages apply the same status rules as on the main site: a draft's page is not found, its invitations say "not available yet", and archived pages stay readable. Links therefore behave the same on both hosts, and links that already went out on `bulava.in` keep working.

`EventLinksService` (API) decides where guest links point: the event's ACTIVE domain, otherwise `WEB_ORIGIN`. Invitations, their re-copy links, emails and reminders, photo-album upload links and QR codes, and the live wall's upload QR all use it. The wall itself stays on `bulava.in`. Its per-event cache lasts 30 seconds and is cleared whenever the domain changes.

Guests post RSVPs, travel details and photos from the customer domain. The CSRF guard allows an `Origin` that is an ACTIVE customer domain with the main site's scheme and port. Staff (`/api/v1/admin/`) and payment (`/api/v1/payments/`) endpoints return 404 on customer domains in `bulava-nginx`. Host sessions never reach customer domains, because the session cookies belong to `bulava.in`.

## Ownership and squatting

- **Unverified claims never block anyone.** Any number of events may claim the same name while it is unverified, each with its own token, so nobody can reserve a domain they do not own. Only one claim per hostname can be verified at a time; a partial unique index enforces this (`event_domains_hostname_verified_key`).
- **A working domain cannot be taken.** While a verified claim is working, a new claim is refused with `DOMAIN_TAKEN`. An older pending claim whose TXT record also appears gets `TAKEN` and stays pending.
- **A lapsed domain changes hands.** If the verified claim has been switched off (`FAILED`) or its event deleted, a new claim that proves ownership takes over. The old claim loses its verification and certificate, and shows `TAKEN`.

## Re-checks

The general worker runs the `domains` task every 10 minutes (`checkDueDomains`, 100 per run):

- **Pending** domains are checked on every run. They are given up after 7 days (`FAILED`, `EXPIRED`).
- **Active** domains are re-checked daily. After **three failed checks in a row** (the TXT record is only needed once, so these are routing failures), the domain is switched off (`FAILED`), stops resolving, and links fall back to `bulava.in`. A domain that lapses or is pointed elsewhere can never serve an event for long.
- **Failed** domains are checked only when the host presses *Check now*.

When an event is purged, the worker removes its hostname from the certificate provider, and the row is deleted with the event.

## Operator setup (production, Cloudflare for SaaS)

Customer domains need TLS certificates for names Bulava does not own. The API speaks to **Cloudflare for SaaS** (custom hostnames) when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID` are set.

1. In the `bulava.in` zone, enable **SSL/TLS → Custom Hostnames** (Cloudflare for SaaS).
2. Create a proxied DNS record `domains.bulava.in` pointing to the server, and set it as the **fallback origin**. Customers CNAME to this name.
3. Create an API token with **Zone → SSL and Certificates → Edit** (custom hostnames) on the `bulava.in` zone only. Put it, with the zone id, into `.env.production`:

   ```bash
   CUSTOM_DOMAIN_TARGET=domains.bulava.in
   CLOUDFLARE_API_TOKEN=...
   CLOUDFLARE_ZONE_ID=...
   # optional, for apex domains at DNS providers without CNAME flattening
   CUSTOM_DOMAIN_ADDRESSES=
   ```

4. Customer hostnames are unknown in advance, so the server's Nginx needs a catch-all for them. `bulava-nginx`'s default server already handles them ([nginx.md](nginx.md)), but on a server shared with other sites, port 443's default server belongs to everyone. Give customer domains a listener of their own on the server's Nginx instead, for example `listen 8443 ssl default_server;` with a certificate for `domains.bulava.in`, proxying to `127.0.0.1:${BULAVA_HTTP_PORT}`. Then add a Cloudflare Origin Rule that sends custom-hostname traffic to port 8443. Cloudflare terminates TLS with the customer's certificate. Allow port 8443 **only from Cloudflare's ranges** in the firewall, so nobody can bypass the edge with a forged `Host` header. On a dedicated server, port 443's default server can do this job instead.
5. Custom hostnames are billed per hostname above the plan's allowance; watch the count in the Cloudflare dashboard.

Without Cloudflare settings, `ManualHostnameProvider` treats TLS as the operator's job: a domain goes live after the DNS checks, and certificates must be provided some other way (for example Caddy on-demand TLS in front of Nginx). This mode suits development and self-hosting.

| Variable | Default | Notes |
|---|---|---|
| `CUSTOM_DOMAIN_TARGET` | `domains.<WEB_ORIGIN host>` | CNAME target shown to hosts; also refused as a customer domain |
| `CUSTOM_DOMAIN_ADDRESSES` | empty | comma-separated IPs accepted as A records |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID` | empty | enable Cloudflare for SaaS; set both or neither |
| `CLOUDFLARE_API_BASE` | Cloudflare API v4 | tests only |

The API reads these for on-demand checks and the worker reads them for the periodic pass, so both containers need them. `.env.production` is shared through `env_file`.

## Development and testing

- `apps/api/test/domains.e2e-spec.ts` replaces the DNS resolver and the certificate provider (`DNS_RESOLVER`, `HOSTNAME_PROVIDER`). It covers plan gating, hostname rules, the three checks, guest links and posting from the domain, squatting, takeover refusal, a lapsed domain changing hands, the worker's switch-off and removal.
- `packages/domains` unit tests cover hostname normalisation and the Cloudflare client.
- **In the browser**, map a test hostname to the dev server with Chrome's `--host-resolver-rules="MAP riya-aman.in [::1]"` and mark its row ACTIVE in the database.
- **Dev-only redirect quirk:** Next.js turns redirects whose origin equals its own (`http://localhost:3000`) into relative redirects. Redirects from a customer domain to the main site then loop in development. To test that path, build the web app with a distinct origin (for example `WEB_ORIGIN=http://bulava.local:3000` plus a host-resolver rule for `bulava.local`). Production is unaffected, because the main site and customer domains never share an origin.
