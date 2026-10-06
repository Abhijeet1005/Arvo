<#
  Deploy a Next.js (or plain Node) app to the Pi.

  Builds locally (the Pi is too weak/slow to run `next build` reliably),
  copies only the production output over SSH, writes a systemd service from
  the template, and restarts it. Re-run any time to redeploy.

  Usage (from the project's own folder, e.g. this "support agent" repo):
    powershell -File deploy\raspi\deploy-app.ps1 -Name arvo -Port 3000
  Then open http://raspi.local:3000/ from any device on the local network.

  Requires next.config.js to have:  output: 'standalone'
#>
param(
  [Parameter(Mandatory)] [string]$Name,
  [Parameter(Mandatory)] [int]$Port,
  [string]$ProjectDir = (Get-Location).Path,
  # mDNS ("raspi.local") is occasionally flaky on Windows and fails to
  # resolve for a few minutes at a time; pass -PiHost with a working address
  # (e.g. an fe80::...%<ifIndex> link-local address) if that happens.
  [string]$PiHost = "raspi.local",
  [string]$PiUser = "raspi",
  [string]$KeyPath = "$env:USERPROFILE\.ssh\id_ed25519_raspi",
  # This Pi doesn't have passwordless sudo, so the one step that needs root
  # (writing the systemd unit) needs it. Prompted securely if not passed.
  [System.Security.SecureString]$PiSudoPassword
)

if (-not $PiSudoPassword) {
  $PiSudoPassword = Read-Host -Prompt "Sudo password for $PiUser@$PiHost" -AsSecureString
}
$pwPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($PiSudoPassword))
$pwFile = New-TemporaryFile
[IO.File]::WriteAllText($pwFile.FullName, "$pwPlain`n", [Text.UTF8Encoding]::new($false))
$pwPlain = $null # clear the plaintext copy as soon as it's on disk (gitignored temp file, deleted at the end)

$ErrorActionPreference = 'Stop'
function Say($msg) { Write-Host "== $msg" -ForegroundColor Cyan }

# mDNS resolution for "*.local" names is flaky on Windows and sometimes fails
# for a few minutes even when the Pi is fine — retry a few times before
# giving up, rather than failing the whole (slow) deploy over a transient
# resolver hiccup.
if ($PiHost -like '*.local') {
  $resolved = $false
  for ($i = 0; $i -lt 5; $i++) {
    try { [System.Net.Dns]::GetHostAddresses($PiHost) | Out-Null; $resolved = $true; break }
    catch { Start-Sleep -Seconds 3 }
  }
  if (-not $resolved) {
    throw "Could not resolve '$PiHost'. Pass -PiHost with a working IPv6 link-local address instead (see Get-NetNeighbor), or try again in a minute."
  }
}

# ---- 1. Build locally --------------------------------------------------
Say "Building $Name"
Push-Location $ProjectDir
try {
  npm run build
} finally {
  Pop-Location
}

$standalone = Join-Path $ProjectDir ".next\standalone"
if (-not (Test-Path $standalone)) {
  throw "No .next/standalone found. Add `"output: 'standalone'`" to next.config.js and rebuild."
}

# ---- 2. Package the output ---------------------------------------------
Say "Packaging"
$stage = Join-Path $env:TEMP "deploy-$Name"
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $stage | Out-Null
Copy-Item "$standalone\*" $stage -Recurse
# Standalone builds need .next/static and the public/ folder copied in manually.
if (Test-Path "$ProjectDir\.next\static") {
  New-Item -ItemType Directory -Path "$stage\.next\static" -Force | Out-Null
  Copy-Item "$ProjectDir\.next\static\*" "$stage\.next\static" -Recurse
}
if (Test-Path "$ProjectDir\public") {
  Copy-Item "$ProjectDir\public" "$stage\public" -Recurse
}

$archive = "$env:TEMP\$Name.tar.gz"
Remove-Item $archive -Force -ErrorAction SilentlyContinue
Push-Location $stage
try {
  tar -czf $archive .
} finally {
  Pop-Location
}
$sizeMb = [Math]::Round((Get-Item $archive).Length / 1MB, 1)
Say "Archive ready ($sizeMb MB)"

# ---- 3. Ship it ----------------------------------------------------------
# One connection per hop, generous timeouts: this link can be slow, and a
# short timeout looks like a hang when the transfer is just still running.
$sshOpts = @('-i', $KeyPath, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20')
$target = "$PiUser@$PiHost"

function Invoke-OnPi([string]$command) {
  & ssh @sshOpts $target $command
  if ($LASTEXITCODE -ne 0) { throw "Remote command failed ($LASTEXITCODE): $command" }
}

# For commands that need sudo: pipes the password in via stdin (sudo -S),
# rather than requiring an interactive TTY that SSH-from-a-script doesn't have.
function Invoke-OnPiWithSudo([string]$command) {
  $sshArgs = $sshOpts -join ' '
  & cmd /c "ssh $sshArgs $target `"$command`" < `"$($pwFile.FullName)`""
  if ($LASTEXITCODE -ne 0) { throw "Remote sudo command failed ($LASTEXITCODE): $command" }
}

Say "Uploading to the Pi"
Invoke-OnPi "mkdir -p /opt/apps/$Name"
& cmd /c "ssh $($sshOpts -join ' ') $target `"cat > /tmp/$Name.tar.gz`" < `"$archive`""
if ($LASTEXITCODE -ne 0) { throw "Upload failed ($LASTEXITCODE)" }

Say "Verifying transfer"
$localHash = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLower()
$remoteHash = (& ssh @sshOpts $target "sha256sum /tmp/$Name.tar.gz | cut -d' ' -f1").Trim()
if ($localHash -ne $remoteHash) {
  throw "Checksum mismatch after upload (local $localHash vs remote $remoteHash). Re-run the script."
}

# ---- 4. Extract + service on the Pi --------------------------------------
Say "Installing on the Pi"
$remoteScript = @"
set -e
rm -rf /opt/apps/$Name.new
mkdir -p /opt/apps/$Name.new
tar -xzf /tmp/$Name.tar.gz -C /opt/apps/$Name.new
rm -f /tmp/$Name.tar.gz
# Keep any existing .env for this app (secrets aren't part of the archive).
[ -f /opt/apps/$Name/.env ] && cp /opt/apps/$Name/.env /opt/apps/$Name.new/.env || true
rm -rf /opt/apps/$Name.old
[ -d /opt/apps/$Name ] && mv /opt/apps/$Name /opt/apps/$Name.old || true
mv /opt/apps/$Name.new /opt/apps/$Name
rm -rf /opt/apps/$Name.old
sed -e 's/__NAME__/$Name/g' -e 's/__PORT__/$Port/g' /opt/apps/app.service.template | sudo tee /etc/systemd/system/$Name.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now $Name.service
sudo systemctl restart $Name.service
sleep 2
systemctl is-active $Name.service
"@
# Write the script to a file on the Pi first, then run it with a single
# `sudo -S sh file` (not piped) so sudo's password read isn't competing with
# the script text for the same stdin — piping a script into `sh` consumes
# stdin as the script source, leaving nothing for an interactive prompt.
$scriptFile = Join-Path $env:TEMP "$Name-install.sh"
[IO.File]::WriteAllText($scriptFile, $remoteScript.Replace("`r`n", "`n"), [Text.UTF8Encoding]::new($false))
& cmd /c "ssh $($sshOpts -join ' ') $target `"cat > /tmp/$Name-install.sh`" < `"$scriptFile`""
if ($LASTEXITCODE -ne 0) { throw "Could not upload the install script." }
Invoke-OnPiWithSudo "sudo -S sh /tmp/$Name-install.sh; rm -f /tmp/$Name-install.sh"

# ---- 5. Route it through Caddy -------------------------------------------
# Caddy alone listens on :80 (the port a browser hits with no port number);
# each app gets a path prefix and keeps its own internal port private, so an
# app never needs to claim a public port for itself. Reachable from any
# device on the network with no DNS/hosts-file setup.
# (Two things that looked simpler and weren't: per-app hostnames, e.g.
# arvo.local — this Pi only advertises its own name over mDNS, and other
# devices can't resolve an invented hostname without a hosts-file entry
# pointing at a real IP, which this Pi doesn't reliably have since IPv4
# doesn't work on it; and per-app public ports — that just moves the same
# collision risk from hostnames to port numbers.)
Say "Adding the Caddy route for /$Name/"
$marker = "# arvo-route:$Name"
$caddyBlock = @"

$marker
handle_path /$Name/* {
	reverse_proxy 127.0.0.1:$Port
}
"@.Replace("`r`n", "`n")
$caddyB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($caddyBlock))
Invoke-OnPi "grep -qF '$marker' /opt/caddy/apps.conf 2>/dev/null || (echo $caddyB64 | base64 -d | tee -a /opt/caddy/apps.conf >/dev/null)"
Invoke-OnPiWithSudo "/opt/caddy/caddy fmt --overwrite /opt/caddy/Caddyfile 2>/dev/null; sudo -S systemctl restart caddy.service"

Remove-Item $pwFile.FullName -Force -ErrorAction SilentlyContinue
Say "Done — http://raspi.local/$Name/ (on the local network)"
