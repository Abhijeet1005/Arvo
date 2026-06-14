# Arvo — Deployment & Operations

## Live instance

| Item | Value |
|---|---|
| Public URL | `https://34.126.212.229.sslip.io` |
| GCP project | `project-c0fdbb72-af5f-43c3-9c2` |
| VM name | `arvo-vm` |
| Zone | `asia-south2-c` (Delhi) |
| Static IP (reserved) | `34.126.212.229` — never changes across reboots or resume |
| ElevenLabs agent | `agent_9001ktpvxrm2fh78zssghrr93edy` |

---

## SSH into the VM

**Option A — gcloud (easiest):**
```bash
gcloud compute ssh arvo-vm --zone=asia-south2-c
```

**Option B — native OpenSSH (from Windows PowerShell):**
```powershell
ssh -i "$env:USERPROFILE\.ssh\google_compute_engine" `
    -o IdentitiesOnly=yes `
    -o StrictHostKeyChecking=no `
    Omen@34.126.212.229
```

---

## Check service health (once SSH'd in)

```bash
# Is the Next.js app process up?
pm2 status

# Recent app logs (errors, tool call hits, etc.)
pm2 logs arvo --lines 50

# Is Caddy (HTTPS proxy) running?
sudo systemctl status caddy

# Does the app respond locally?
curl -s localhost:3000/api/agent | jq .agentId

# Which ElevenLabs tools are registered?
jq '.tools' /opt/arvo/.agent.json

# Current env config
cat /opt/arvo/.env.local
```

All healthy: pm2 shows `arvo` = **online**, caddy = **active (running)**, curl returns the agentId.

---

## After suspending and resuming the VM

The static IP is reserved, so the public URL stays the same. pm2 and Caddy are both configured to start on boot, so they should come back automatically. If anything looks stuck, run this sequence:

```bash
# 1. Restart the Next.js app
pm2 restart arvo

# 2. Restart Caddy (HTTPS proxy)
sudo systemctl restart caddy

# 3. Confirm both are up
pm2 status
sudo systemctl status caddy --no-pager

# 4. Quick end-to-end check (wait ~10s for app to warm up first)
curl -s https://34.126.212.229.sslip.io/api/agent | jq .agentId
```

If `pm2 status` shows `arvo` as **errored** or **stopped**, check why before restarting:
```bash
pm2 logs arvo --lines 100
pm2 restart arvo
```

If pm2 itself isn't running at all (e.g. after a full VM reset):
```bash
cd /opt/arvo
pm2 start npm --name arvo -- start
pm2 save
```

---

## Deploy a code update

From your local machine (Windows PowerShell):

```powershell
# 1. Archive the project (excluding node_modules and .next)
tar -czf arvo-deploy.tar.gz `
  --exclude=node_modules --exclude=.next --exclude=".git" `
  -C "D:\Project\support agent" .

# 2. Upload to the VM
scp -i "$env:USERPROFILE\.ssh\google_compute_engine" `
    -o IdentitiesOnly=yes -o StrictHostKeyChecking=no `
    arvo-deploy.tar.gz Omen@34.126.212.229:/home/Omen/

# 3. SSH in and run the setup script (handles deps, build, pm2 restart, Caddy)
ssh -i "$env:USERPROFILE\.ssh\google_compute_engine" `
    -o IdentitiesOnly=yes -o StrictHostKeyChecking=no `
    Omen@34.126.212.229 "tr -d '\r' < ~/deploy-setup.sh > ~/s.sh && bash ~/s.sh"
```

The `deploy-setup.sh` script at the repo root handles everything: unpack → npm install → build → pm2 restart → Caddy config → re-register ElevenLabs tools.

---

## Stack overview

```
Internet (port 443)
  → Caddy  (auto-HTTPS via sslip.io + Let's Encrypt)
    → Next.js 15 prod server  (localhost:3000, run by pm2)
      → /opt/arvo   (app files)
      → /opt/arvo/.env.local  (ELEVENLABS_API_KEY, APP_URL, etc.)
      → /opt/arvo/.agent.json  (persisted agent config, tool IDs)
```

- **pm2** keeps the process alive and re-starts it on VM boot (`pm2 startup systemd`).
- **Caddy** handles TLS certificates automatically — no manual cert renewal needed.
- **sslip.io** maps `34.126.212.229.sslip.io` → `34.126.212.229` (no domain purchase needed).

---

## Before going to production

- [ ] **Rotate the ElevenLabs API key** — the current key was shared in chat history.
- [ ] **Move off the ElevenLabs free tier** — it is non-commercial and limited to ~15 min/month.
- [ ] **Add authentication** — the dashboard is currently public to anyone with the URL.
- [ ] **Set up monitoring** — consider `pm2 monitor` or a simple uptime check.
