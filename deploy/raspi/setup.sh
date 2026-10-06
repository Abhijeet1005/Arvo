#!/bin/sh
# Prepare a Raspberry Pi (3B+ or newer, 64-bit Raspberry Pi OS) to host Arvo.
#
#   scp -r deploy/raspi raspi@raspi.local:/tmp/arvo-setup
#   ssh raspi@raspi.local "sh /tmp/arvo-setup/setup.sh"
#
# If the Pi has no internet, put node-<version>-linux-arm64.tar.xz and
# SHASUMS256.txt (from nodejs.org/dist/<version>/) next to this script first.
#
# Safe to run again at any time; every step checks before it changes anything.
# What it sets up:
#   1. Wi-Fi that stays up: power saving off, reconnect retries forever
#   2. Logs that survive reboots (capped at 48 MB), to diagnose drop-outs
#   3. Node.js (official arm64 build) in /opt/node
#   4. /opt/arvo + arvo.service: starts the app on boot, restarts it on crash
#   5. arvo-netwatch: reconnects Wi-Fi / reboots if the router stops answering
# The hardware watchdog (reboot on a hang) is already on in Raspberry Pi OS.
set -eu

NODE_VERSION=v24.21.0 # LTS; matches the Node major used to build the app
HERE=$(cd "$(dirname "$0")" && pwd)
APP_USER=${APP_USER:-raspi}

say() { printf '\n== %s\n' "$*"; }

say "Wi-Fi: power saving off, always reconnect"
sudo tee /etc/NetworkManager/conf.d/90-arvo-wifi.conf >/dev/null <<'EOF'
# Arvo: keep Wi-Fi awake and always reconnect.
[main]
autoconnect-retries-default=0

[connection]
wifi.powersave=2
EOF
sudo nmcli general reload conf
[ -e /sys/class/net/wlan0 ] && sudo /usr/sbin/iw dev wlan0 set power_save off || true

say "Logs: persistent, capped"
sudo mkdir -p /etc/systemd/journald.conf.d /var/log/journal
sudo tee /etc/systemd/journald.conf.d/90-arvo-persistent.conf >/dev/null <<'EOF'
# Arvo: persistent, size-capped journal.
[Journal]
Storage=persistent
SystemMaxUse=48M
EOF
sudo systemd-tmpfiles --create --prefix /var/log/journal
sudo systemctl restart systemd-journald

say "Network watchdog"
sudo install -m 0755 "$HERE/arvo-netwatch.sh" /usr/local/sbin/arvo-netwatch
sudo install -m 0644 "$HERE/arvo-netwatch.service" "$HERE/arvo-netwatch.timer" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now arvo-netwatch.timer

say "Node.js $NODE_VERSION"
if [ "$(/opt/node/bin/node -v 2>/dev/null || true)" = "$NODE_VERSION" ]; then
  echo "already installed"
else
  base="https://nodejs.org/dist/$NODE_VERSION"
  file="node-$NODE_VERSION-linux-arm64.tar.xz"
  tmp=$(mktemp -d)
  if [ -f "$HERE/$file" ] && [ -f "$HERE/SHASUMS256.txt" ]; then
    # Copied over from the dev machine (works even if the Pi has no internet).
    cp "$HERE/$file" "$HERE/SHASUMS256.txt" "$tmp/"
  else
    curl -fsSL --retry 3 -o "$tmp/$file" "$base/$file"
    curl -fsSL --retry 3 -o "$tmp/SHASUMS256.txt" "$base/SHASUMS256.txt"
  fi
  (cd "$tmp" && grep " $file\$" SHASUMS256.txt | sha256sum -c -)
  sudo mkdir -p "/opt/node-$NODE_VERSION"
  sudo tar -xJf "$tmp/$file" -C "/opt/node-$NODE_VERSION" --strip-components=1 --no-same-owner
  sudo ln -sfn "/opt/node-$NODE_VERSION" /opt/node
  for b in node npm npx corepack; do sudo ln -sfn "/opt/node/bin/$b" "/usr/local/bin/$b"; done
  rm -rf "$tmp"
fi
echo "node $(/opt/node/bin/node -v), npm $(/opt/node/bin/npm -v)"

say "App home and service"
sudo mkdir -p /opt/arvo/app /opt/arvo/data
sudo chown -R "$APP_USER:$APP_USER" /opt/arvo
if [ ! -f /opt/arvo/.env ]; then
  sudo install -m 0600 -o "$APP_USER" -g "$APP_USER" /dev/null /opt/arvo/.env
  echo "# Arvo secrets (same keys as .env.local on the dev machine)" | sudo tee /opt/arvo/.env >/dev/null
fi
sudo install -m 0644 "$HERE/arvo.service" /etc/systemd/system/arvo.service
sudo systemctl daemon-reload
sudo systemctl enable arvo.service
if [ -f /opt/arvo/app/server.js ]; then sudo systemctl restart arvo.service; fi

say "Done"
echo "netwatch timer: $(systemctl is-active arvo-netwatch.timer)"
echo "arvo.service:   $(systemctl is-enabled arvo.service), $( [ -f /opt/arvo/app/server.js ] && systemctl is-active arvo.service || echo 'waiting for first deploy')"
echo "hw watchdog:    $(systemctl show -p RuntimeWatchdogUSec --value)"
