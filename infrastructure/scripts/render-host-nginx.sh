#!/usr/bin/env bash
# Prints Bulava's site for the server's own Nginx, filled in from .env.production.
# Review the output, then install it (docs/deployment.md):
#
#   bash infrastructure/scripts/render-host-nginx.sh > /tmp/bulava.site
#   sudo cp /tmp/bulava.site /etc/nginx/sites-available/bulava
#   sudo ln -s /etc/nginx/sites-available/bulava /etc/nginx/sites-enabled/bulava
#   sudo nginx -t && sudo systemctl reload nginx
#
# Reads only BULAVA_DOMAIN, BULAVA_ADMIN_DOMAIN, BULAVA_API_DOMAIN, BULAVA_WWW and
# BULAVA_HTTP_PORT; the rest of the file (secrets) is never loaded.
set -euo pipefail

cd "$(dirname "$0")/../.."
ENV_FILE="${ENV_FILE:-.env.production}"
TEMPLATE="infrastructure/nginx/host/bulava.site.conf"
[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE" >&2; exit 1; }

value() {
  # Last assignment wins, as in Docker Compose; surrounding quotes are dropped.
  grep -E "^$1=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/" || true
}
hostname_ok() { [[ "$1" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ && "$1" == *.* ]]; }

domain="$(value BULAVA_DOMAIN)"
admin="$(value BULAVA_ADMIN_DOMAIN)"
api="$(value BULAVA_API_DOMAIN)"
www="$(value BULAVA_WWW)"
port="$(value BULAVA_HTTP_PORT)"
port="${port:-18090}"

for name in "$domain" "$admin" "$api"; do
  hostname_ok "$name" || { echo "Set BULAVA_DOMAIN, BULAVA_ADMIN_DOMAIN and BULAVA_API_DOMAIN to lower-case host names in $ENV_FILE (got '$name')." >&2; exit 1; }
done
[[ "$port" =~ ^[0-9]{2,5}$ ]] || { echo "BULAVA_HTTP_PORT must be a port number (got '$port')." >&2; exit 1; }

names="$domain"
[ "${www:-true}" = "false" ] || names="$names www.$domain"
names="$names $admin $api"

sed -e "s/__BULAVA_SERVER_NAMES__/$names/" -e "s/__BULAVA_HTTP_PORT__/$port/g" "$TEMPLATE"

certbot_args=""
for name in $names; do certbot_args="$certbot_args -d $name"; done
{
  echo
  echo "# Next, once DNS for these names points at this server:"
  echo "#   sudo certbot --nginx --redirect$certbot_args"
} >&2
