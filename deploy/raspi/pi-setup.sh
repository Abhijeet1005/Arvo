#!/bin/sh
# One-time Pi setup: Node.js + Caddy + the systemd plumbing to run several
# small Next.js/Node apps, each restarted on crash and on boot.
# Everything is copied in ahead of time — this script needs no internet.
#
# Usage on the Pi: sh /opt/bootstrap/pi-setup.sh
set -eu
BOOT=/opt/bootstrap
say() { printf '\n== %s\n' "$*"; }

say "Node.js"
if [ "$(/opt/node/bin/node -v 2>/dev/null || true)" = "v24.21.0" ]; then
  echo "already installed: $(/opt/node/bin/node -v)"
else
  expected=$(grep 'node-v24.21.0-linux-arm64.tar.xz$' "$BOOT/node.sha256" | cut -d' ' -f1)
  actual=$(sha256sum "$BOOT/node.tar.xz" | cut -d' ' -f1)
  [ "$expected" = "$actual" ] || { echo "checksum mismatch: expected $expected, got $actual" >&2; exit 1; }
  sudo mkdir -p /opt/node-v24.21.0
  sudo tar -xJf "$BOOT/node.tar.xz" -C /opt/node-v24.21.0 --strip-components=1 --no-same-owner
  sudo ln -sfn /opt/node-v24.21.0 /opt/node
  for b in node npm npx corepack; do sudo ln -sfn "/opt/node/bin/$b" "/usr/local/bin/$b"; done
fi
echo "node: $(/opt/node/bin/node -v)   npm: $(/opt/node/bin/npm -v)"

say "Caddy (reverse proxy)"
if [ -x /opt/caddy/caddy ]; then
  echo "already installed: $(/opt/caddy/caddy version)"
else
  sudo mkdir -p /opt/caddy
  tmp=$(mktemp -d)
  tar -xzf "$BOOT/caddy.tar.gz" -C "$tmp"
  sudo install -m 0755 "$tmp/caddy" /opt/caddy/caddy
  rm -rf "$tmp"
fi
if [ ! -f /opt/caddy/Caddyfile ]; then
  sudo install -m 0644 "$BOOT/Caddyfile" /opt/caddy/Caddyfile
fi
if [ ! -f /opt/caddy/apps.conf ]; then
  sudo install -m 0644 "$BOOT/apps.conf" /opt/caddy/apps.conf
fi
sudo install -m 0644 "$BOOT/caddy.service" /etc/systemd/system/caddy.service
sudo setcap 'cap_net_bind_service=+ep' /opt/caddy/caddy
sudo chown -R raspi:raspi /opt/caddy

say "App directory"
sudo mkdir -p /opt/apps
sudo chown raspi:raspi /opt/apps
sudo install -m 0644 "$BOOT/app.service.template" /opt/apps/app.service.template

say "Enable services"
sudo systemctl daemon-reload
sudo systemctl enable --now caddy.service

say "Done"
echo "caddy:  $(systemctl is-active caddy.service)"
echo "listening: $(sudo ss -tln | grep ':80 ' || echo 'not yet — check: systemctl status caddy')"
echo
echo "Next: use deploy/raspi/deploy-app.ps1 from the dev machine to ship an app."
