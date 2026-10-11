# Nginx

Two Nginx layers sit in front of the apps:

1. **The server's own Nginx** (the one that also serves other sites) terminates TLS with a certbot certificate and proxies Bulava's hostnames to `127.0.0.1:${BULAVA_HTTP_PORT}` (default 18090). Bulava adds one site file to it and nothing else.
2. **`bulava-nginx`**, the `nginx` service in `docker-compose.prod.yml`, routes by host name to web, admin and api on the internal network, and applies Bulava's rate limits, body limits and headers. It is versioned with the code.

```text
infrastructure/nginx/
  host/bulava.site.conf            the server's Nginx: TLS (certbot) and proxy to 127.0.0.1:<port>
  host/cloudflare-real-ip.conf     optional, for the host site when Cloudflare proxies Bulava
  nginx.conf                       bulava-nginx: http settings, gzip, limits, upstreams, log format, real IPs
  templates/bulava.conf.template   bulava-nginx: server blocks per host name (${BULAVA_*} from .env.production)
  snippets/proxy.conf              proxy headers, WebSocket upgrade, hidden upstream headers
  snippets/security-headers.conf   HSTS and nosniff
```

`infrastructure/scripts/render-host-nginx.sh` fills in the host site from `.env.production`. It reads only the domain and port settings, never the secrets, and prints the matching certbot command ([deployment.md](deployment.md#first-deployment)).

## Why two layers

On a server that already runs other sites, the server's Nginx must keep ports 80 and 443, its certbot certificates and its http-level settings. Bulava's host site is a single `server` block for Bulava's names, with no `upstream`, `map`, `limit_req_zone`, `log_format`, `ssl_session_cache` or `default_server`. Bulava's own zones, maps, upstreams and log format live only inside `bulava-nginx`, so no name can collide with another site's. The container is published only on `127.0.0.1`, so the only way in is through the server's Nginx.

## Host names

Set in `.env.production` (`BULAVA_DOMAIN`, `BULAVA_ADMIN_DOMAIN`, `BULAVA_API_DOMAIN`, `BULAVA_WWW`). The nginx image renders the template at start-up and substitutes only `BULAVA_*` variables (`NGINX_ENVSUBST_FILTER`), so Nginx's own `$variables` are untouched.

| Host | Routes to | Notes |
|---|---|---|
| `BULAVA_DOMAIN` | `/api/v1/*` → api; everything else → web | same-origin API keeps session cookies first-party |
| `www.BULAVA_DOMAIN` | 301 → `https://BULAVA_DOMAIN` | when `BULAVA_WWW` is not `false` |
| `BULAVA_ADMIN_DOMAIN` | `/api/v1/*` → api; everything else → admin | optional IP allowlist (commented) |
| `BULAVA_API_DOMAIN` | api | API clients and the Razorpay webhook; `/metrics` returns 404 |
| any other host (customer domains) | `/api/v1/admin/*` and `/api/v1/payments/*` → 404; `/api/v1/*` → api; everything else → web | `bulava-nginx`'s default server; it only receives customer domains once the server's Nginx forwards them ([custom-domains.md](custom-domains.md)) |

## Behaviour

- **TLS:** at the server's Nginx, with the certbot certificate and certbot's shared settings (`/etc/letsencrypt/options-ssl-nginx.conf`), like the other sites. `bulava-nginx` speaks plain HTTP on the loopback hop.
- **Real client IP:** the host site sends `X-Real-IP: $remote_addr` and replaces `X-Forwarded-For`, so a visitor cannot inject an address. `bulava-nginx` trusts `X-Real-IP` only from loopback and Docker's private ranges (`set_real_ip_from`), which is the only way to reach it. It passes `X-Forwarded-For: <client>` to the apps, and the API trusts the Docker network (`TRUST_PROXY=uniquelocal`), so rate limits and audit logs see the real visitor.
- **Scheme:** the apps always receive `X-Forwarded-Proto: https`, because every public request arrives over HTTPS.
- **Security headers:** `bulava-nginx` owns `Strict-Transport-Security` (two years, subdomains, preload) and `X-Content-Type-Options`, strips the upstream copies, and the host site passes them through. The applications set CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` and `noindex` per route (for example the private headers on `/invite`, `/p` and `/checkin`), because they know each route. The CSP of private pages carries a per-request nonce, so it must never be cached or rewritten in front of the apps.
- **Upstreams follow recreated containers:** web, admin and api are reached through upstreams that keep resolving their names with Docker's DNS (`resolver 127.0.0.11`, `server … resolve`, nginx 1.27.3 or newer). A container recreated by a deploy usually gets a new address; a plain `server admin:3001` keeps the address seen when `bulava-nginx` started and answers 502 for that host until it restarts. `nginx.conf` is mounted as a single file, so the container must be recreated, not restarted, to read a new copy: the deploy scripts do this whenever a release changes `infrastructure/nginx/`, and after a manual `git pull` run `up -d --force-recreate nginx`.
- **Limits:** `client_max_body_size 10m` in both layers (photos and videos upload directly to R2, so only JSON and CSV reach the app; the webhook is capped at 1 MB), 30 s body and 15 s header timeouts, 60 s upstream reads (120 s on the API host and in the host site, for exports).
- **Rate limiting:** per-IP `limit_req` (20 r/s for the API, 30 r/s for pages, with bursts) and `limit_conn` in `bulava-nginx`. The API adds its own Redis-backed limits for sign-in, OTP, PIN, RSVP and registration.
- **Health check:** `/nginx-health` answers only requests from `127.0.0.1` inside the container (Docker's check) and 404 for everyone else. `return` runs before `allow`/`deny` would, so the address is checked with `if`.
- **WebSockets:** `Upgrade`/`Connection` headers are forwarded inside `bulava-nginx` for future realtime features. The host site would need the same two headers the day a feature uses them.
- **Compression:** gzip for text, JSON, JS, CSS, SVG and fonts.
- **Logs:** `bulava-nginx` logs JSON to stdout with `$uri` (not `$request_uri`), so query strings never reach the logs. The host site turns its own access log off to avoid a second copy.

## Cloudflare in front

Optional. With the orange cloud on Bulava's records:

1. Copy `infrastructure/nginx/host/cloudflare-real-ip.conf` to `/etc/nginx/snippets/bulava-cloudflare-real-ip.conf` and uncomment its `include` in Bulava's host site. It applies at server level, so other sites are unaffected.
2. Use SSL mode **Full (strict)**. The certbot certificate stays valid behind Cloudflare. HTTP-01 renewals keep working, because Cloudflare forwards `/.well-known/acme-challenge/`.
3. Refresh the Cloudflare ranges occasionally (`https://www.cloudflare.com/ips/`).

## Validating changes

`bulava-nginx`, rendered exactly as in production:

```bash
docker run --rm \
  --add-host web:127.0.0.1 --add-host admin:127.0.0.1 --add-host api:127.0.0.1 \
  -e NGINX_ENVSUBST_FILTER='^BULAVA_' -e BULAVA_DOMAIN=bulava.in \
  -e BULAVA_ADMIN_DOMAIN=admin.bulava.in -e BULAVA_API_DOMAIN=api.bulava.in \
  -v "$PWD/infrastructure/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" \
  -v "$PWD/infrastructure/nginx/templates:/etc/nginx/templates:ro" \
  -v "$PWD/infrastructure/nginx/snippets:/etc/nginx/snippets:ro" \
  nginx:1.27-alpine nginx -t
```

On the server, the template is rendered when the container starts. A deploy (`deploy-server.sh` or the deploy workflow) recreates `bulava-nginx` whenever the release changes `infrastructure/nginx/`, because both label the container with that folder's git tree (`BULAVA_NGINX_CONFIG`); apply edits made by hand with `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --force-recreate nginx`. For the host site, always run `sudo nginx -t` before `sudo systemctl reload nginx`. A failed test leaves the running configuration, and every other site, untouched.
