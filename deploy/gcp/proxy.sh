#!/usr/bin/env bash
# Re-render the Caddy config from the template, keeping the existing operator
# login, and keep it only if it validates and the site still behaves.
#
#   sudo bash /tmp/proxy.sh <domain> <public-ip>
#
# Expects /tmp/Caddyfile.template (deploy\gcp\deploy.ps1 -UpdateProxy uploads
# it). Unlike provision.sh this never sets a new password: the existing hash is
# read back from the live config. The old config is kept as a timestamped
# backup and restored automatically if a check fails.
set -euo pipefail

DOMAIN="${1:?domain required}"
PUBLIC_IP="${2:?public ip required}"
CONF=/etc/caddy/Caddyfile
TEMPLATE=/tmp/Caddyfile.template

[ -f "$TEMPLATE" ] || { echo "Missing $TEMPLATE" >&2; exit 1; }
[ -f "$CONF" ] || { echo "No existing $CONF. Run deploy.ps1 -Provision first." >&2; exit 1; }

# The operator hash is the word after "admin" inside basic_auth.
HASH="$(awk '/basic_auth/ { inside = 1 } inside && $1 == "admin" { print $2; exit }' "$CONF")"
case "$HASH" in
  '$2'*) ;; # bcrypt: $2a$ / $2b$ / $2y$
  *) echo "Could not read the existing operator login from $CONF." >&2; exit 1 ;;
esac

NEW="$(mktemp)"
trap 'rm -f "$NEW" "$TEMPLATE"' EXIT
sed -e "s|__DOMAIN__|$DOMAIN|g" -e "s|__PUBLIC_IP__|$PUBLIC_IP|g" -e "s|__ADMIN_HASH__|$HASH|g" "$TEMPLATE" > "$NEW"
caddy fmt --overwrite "$NEW"
caddy validate --config "$NEW" --adapter caddyfile >/dev/null
echo "   new config validates"

if cmp -s "$NEW" "$CONF"; then
  echo "   proxy already up to date"
  exit 0
fi

BACKUP="$CONF.bak-$(date -u +%Y%m%d-%H%M%S)"
cp -a "$CONF" "$BACKUP"
install -m 644 -o root -g root "$NEW" "$CONF"
systemctl reload caddy
sleep 2

# Ask the proxy itself (on this machine, skipping DNS) how it routes things.
code() { curl -sk -o /dev/null -w '%{http_code}' --max-time 10 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN$1" || true; }
ok=true
check() { # <path> <expected status> <what>
  local got; got="$(code "$1")"
  if [ "$got" = "$2" ]; then echo "   ok   $3 ($1 -> $got)"; else echo "   FAIL $3 ($1 -> $got, expected $2)" >&2; ok=false; fi
}
check /loan 401 'console needs the login'
check /api/demos 401 'demo management needs the login'
check /api/loan/calls 401 'call log needs the login'
check /loan/call/not-a-real-link 200 'loan link page is public'
check /d/not-a-real-link 200 'demo link page is public'
# A well-formed but unknown token must reach the app (404 from it), not the login.
check /api/loan/links/AAAAAAAAAAAAAAAAAAAAAA/public 404 'link info is public'
check '/api/loan/links/AAAAAAAAAAAAAAAAAAAAAA/result?call=conv_none' 404 'link result is public'

if [ "$ok" != "true" ]; then
  echo "!! A check failed. Restoring $BACKUP" >&2
  install -m 644 -o root -g root "$BACKUP" "$CONF"
  systemctl reload caddy
  exit 1
fi

# Keep the three newest backups.
ls -1t "$CONF".bak-* 2>/dev/null | tail -n +4 | xargs -r rm -f
echo "   proxy updated (previous config kept as $BACKUP)"
