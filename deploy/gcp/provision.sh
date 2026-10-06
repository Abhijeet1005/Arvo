#!/usr/bin/env bash
# One-time (idempotent) server setup for Arvo on a fresh Debian GCE VM.
#
#   sudo bash /tmp/provision.sh <domain> <public-ip>
#
# Expects these uploaded to /tmp first (deploy\gcp\deploy.ps1 does this):
#   /tmp/arvo.service            systemd unit for the app
#   /tmp/Caddyfile.template      reverse proxy + HTTPS + operator login
#   /tmp/arvo-admin-password     operator password (hashed here, then deleted)
#
# Stack: official Node.js binary (checksum-verified) + systemd + Caddy from
# Caddy's official apt repo (automatic Let's Encrypt HTTPS).
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

DOMAIN="${1:?domain required}"
PUBLIC_IP="${2:?public ip required}"
NODE_VERSION="${NODE_VERSION:-v24.13.0}"
PW_FILE=/tmp/arvo-admin-password
APT=(apt-get -y -qq -o DPkg::Lock::Timeout=600)

echo "== swap (keeps 'next build' safe on a 2 GB VM)"
if ! swapon --show=NAME --noheadings | grep -qx /swapfile; then
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
  fi
  swapon /swapfile
fi
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab

echo "== base packages"
"${APT[@]}" update
"${APT[@]}" install curl ca-certificates gnupg xz-utils >/dev/null

echo "== node $NODE_VERSION"
if [ "$(/opt/node/bin/node -v 2>/dev/null || true)" != "$NODE_VERSION" ]; then
  tmp="$(mktemp -d)"
  tarball="node-$NODE_VERSION-linux-x64.tar.xz"
  curl -fsSLo "$tmp/$tarball" "https://nodejs.org/dist/$NODE_VERSION/$tarball"
  curl -fsSLo "$tmp/SHASUMS256.txt" "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt"
  expected="$(awk -v f="$tarball" '$2 == f { print $1 }' "$tmp/SHASUMS256.txt")"
  actual="$(sha256sum "$tmp/$tarball" | cut -d' ' -f1)"
  if [ -z "$expected" ] || [ "$expected" != "$actual" ]; then
    echo "Node.js checksum mismatch — refusing to install." >&2
    exit 1
  fi
  rm -rf /opt/node
  mkdir -p /opt/node
  tar -xJf "$tmp/$tarball" -C /opt/node --strip-components=1
  rm -rf "$tmp"
fi
ln -sf /opt/node/bin/node /usr/local/bin/node
ln -sf /opt/node/bin/npm /usr/local/bin/npm
ln -sf /opt/node/bin/npx /usr/local/bin/npx
node -v

echo "== caddy"
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  "${APT[@]}" update
  "${APT[@]}" install caddy >/dev/null
fi
caddy version

echo "== app user + directories"
id arvo >/dev/null 2>&1 || useradd --system --home-dir /var/lib/arvo --shell /usr/sbin/nologin arvo
install -d -o arvo -g arvo -m 750 /var/lib/arvo /var/lib/arvo/next-cache
install -d -m 755 /opt/arvo /opt/arvo/releases
install -d -m 700 /etc/arvo
[ -f /etc/arvo/arvo.env ] || install -m 600 /dev/null /etc/arvo/arvo.env

echo "== systemd unit"
install -m 644 /tmp/arvo.service /etc/systemd/system/arvo.service
rm -f /tmp/arvo.service
systemctl daemon-reload
systemctl enable arvo.service >/dev/null

echo "== caddy config ($DOMAIN)"
if [ -f "$PW_FILE" ]; then
  HASH="$(caddy hash-password --plaintext "$(cat "$PW_FILE")")"
  shred -u "$PW_FILE" 2>/dev/null || rm -f "$PW_FILE"
  sed -e "s|__DOMAIN__|$DOMAIN|g" -e "s|__PUBLIC_IP__|$PUBLIC_IP|g" -e "s|__ADMIN_HASH__|$HASH|g" \
    /tmp/Caddyfile.template > /etc/caddy/Caddyfile
  rm -f /tmp/Caddyfile.template
  caddy fmt --overwrite /etc/caddy/Caddyfile
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
  systemctl reload caddy || systemctl restart caddy
else
  echo "   (no new password uploaded — keeping the existing Caddyfile)"
fi

# The customer page's server render fetches its own public API by hostname;
# resolve that hostname locally so the request stays on this machine.
grep -qE "^127\.0\.0\.1[[:space:]]+$DOMAIN\$" /etc/hosts || echo "127.0.0.1 $DOMAIN" >> /etc/hosts

echo "== provision complete"
