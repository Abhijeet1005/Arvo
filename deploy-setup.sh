#!/usr/bin/env bash
# Provisions the Arvo VM: Node 20, Caddy (auto-HTTPS), pm2, builds & runs the
# app, then registers the agent's webhook tools now that APP_URL is public.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

echo "=== [1/8] swap (protect the build on a small VM) ==="
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
fi

echo "=== [2/8] base packages + Node 20 ==="
sudo apt-get update -y -qq
sudo apt-get install -y -qq curl gnupg jq ca-certificates debian-keyring debian-archive-keyring apt-transport-https
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null
sudo apt-get install -y -qq nodejs
echo "node $(node -v)"

echo "=== [3/8] Caddy ==="
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y -qq
  sudo apt-get install -y -qq caddy
fi

echo "=== [4/8] unpack app to /opt/arvo ==="
sudo mkdir -p /opt/arvo
sudo tar -xzf "$HOME/arvo-deploy.tar.gz" -C /opt/arvo
sudo chown -R "$USER":"$USER" /opt/arvo
cd /opt/arvo

echo "=== [5/8] set APP_URL from this VM's public IP ==="
IP=$(curl -s -H "Metadata-Flavor: Google" "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip")
HOST="${IP}.sslip.io"
APP_URL="https://${HOST}"
touch .env.local
grep -v '^APP_URL=' .env.local > .env.tmp 2>/dev/null || true
echo "APP_URL=${APP_URL}" >> .env.tmp
mv .env.tmp .env.local
echo "APP_URL=${APP_URL}"

echo "=== [6/8] install deps + build ==="
npm install --no-audit --no-fund
npm run build

echo "=== [7/8] run via pm2 + Caddy reverse proxy (auto-HTTPS) ==="
sudo npm install -g pm2 >/dev/null 2>&1
pm2 delete arvo >/dev/null 2>&1 || true
pm2 start npm --name arvo -- start
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null 2>&1 || true
pm2 save >/dev/null 2>&1 || true

printf '%s {\n    reverse_proxy localhost:3000\n}\n' "$HOST" | sudo tee /etc/caddy/Caddyfile >/dev/null
sudo systemctl restart caddy

echo "=== [8/8] register the agent's tools (now that APP_URL is public) ==="
for i in $(seq 1 30); do curl -sf localhost:3000/api/agent >/dev/null 2>&1 && break; sleep 2; done
CFG=$(curl -s localhost:3000/api/agent | jq -c '.config')
if [ "$CFG" != "null" ] && [ -n "$CFG" ]; then
  curl -s -X POST localhost:3000/api/agent -H 'content-type: application/json' -d "$CFG" >/dev/null || true
fi
sleep 2
echo "--- registered tools (.agent.json) ---"
jq '.tools // "none yet"' /opt/arvo/.agent.json 2>/dev/null || echo "no .agent.json"
echo ""
echo "=== DONE ==="
echo "Public URL: ${APP_URL}"
