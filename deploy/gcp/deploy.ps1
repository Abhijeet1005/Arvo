<#
  Deploy Arvo to its Google Cloud VM (Mumbai, asia-south1).

  First deploy (VM already created):
    powershell -ExecutionPolicy Bypass -File deploy\gcp\deploy.ps1 -Provision -SyncEnv -SeedData
  Every later code update:
    powershell -ExecutionPolicy Bypass -File deploy\gcp\deploy.ps1

    -Provision  install/refresh Node, Caddy and the systemd unit, and set a
                NEW operator password (printed once, saved locally)
    -SyncEnv    copy ELEVENLABS_* values from .env.local to the server
    -SeedData   copy .agent.json to the server, only if it has none yet

  What it does: uploads only the source needed to build (never secrets),
  builds on the server (Linux), switches the live release, health-checks it,
  and rolls back automatically if the new release doesn't come up.

  Setup (once): say which Google Cloud account and project to use. They are
  personal, so they are not stored in the repository. Any one of:
    - create deploy\gcp\deploy.local.json (gitignored; copy deploy.local.example.json)
    - set ARVO_GCP_ACCOUNT and ARVO_GCP_PROJECT
    - pass -Account and -Project

  Infrastructure (created once with gcloud):
    VM        arvo-app  e2-small  Debian 13  asia-south1-a  (no service account)
    IP        arvo-ip   static, asia-south1
    firewall  arvo-allow-web  tcp:80,443 -> tag arvo-web
    SSH       user "deploy", key ~/.ssh/arvo_gcp_ed25519
#>
param(
  [switch]$Provision,
  [switch]$SyncEnv,
  [switch]$SeedData,
  [string]$Account = $env:ARVO_GCP_ACCOUNT,
  [string]$Project = $env:ARVO_GCP_PROJECT,
  [string]$Region = 'asia-south1',
  [string]$Zone = 'asia-south1-a',
  [string]$Instance = 'arvo-app',
  [string]$AddressName = 'arvo-ip',
  [string]$User = 'deploy',
  [string]$KeyPath = "$env:USERPROFILE\.ssh\arvo_gcp_ed25519",
  [string]$KnownHosts = "$env:USERPROFILE\.ssh\arvo_gcp_known_hosts",
  [string]$ProjectDir = (Resolve-Path "$PSScriptRoot\..\..").Path
)

$ErrorActionPreference = 'Stop'
function Say($msg) { Write-Host "== $msg" -ForegroundColor Cyan }
function Assert-Ok($what) { if ($LASTEXITCODE -ne 0) { throw "$what failed (exit $LASTEXITCODE)" } }
function Write-Lf($path, $text) { [IO.File]::WriteAllText($path, $text.Replace("`r`n", "`n"), [Text.UTF8Encoding]::new($false)) }

# Google Cloud account + project: -Account/-Project, then the environment,
# then the gitignored deploy.local.json next to this script.
$localConfig = Join-Path $PSScriptRoot 'deploy.local.json'
if ((-not $Account -or -not $Project) -and (Test-Path -LiteralPath $localConfig)) {
  $cfg = Get-Content -LiteralPath $localConfig -Raw | ConvertFrom-Json
  if (-not $Account) { $Account = $cfg.account }
  if (-not $Project) { $Project = $cfg.project }
}
if (-not $Account -or -not $Project) {
  throw 'Google Cloud account/project not set. Copy deploy\gcp\deploy.local.example.json to deploy\gcp\deploy.local.json and fill it in (or set ARVO_GCP_ACCOUNT / ARVO_GCP_PROJECT, or pass -Account / -Project).'
}

$gcloudScope = @("--project=$Project", "--account=$Account")

# ---- Target ---------------------------------------------------------------
$ip = (& gcloud compute addresses describe $AddressName --region=$Region @gcloudScope --format='value(address)')
Assert-Ok 'Looking up the static IP'
$ip = "$ip".Trim()
if (-not $ip) { throw "Static IP '$AddressName' not found in $Region." }
$domain = ($ip -replace '\.', '-') + '.sslip.io'
$target = "$User@$ip"

# Pin the server's SSH host key from Google's guest attributes (published by
# the VM itself) instead of trusting whatever answers on first connect.
$known = if (Test-Path $KnownHosts) { Get-Content $KnownHosts } else { @() }
if (-not ($known | Where-Object { $_ -like "$ip *" })) {
  Say "Pinning the server's SSH host key"
  $rows = & gcloud compute instances get-guest-attributes $Instance --zone=$Zone --query-path='hostkeys/' @gcloudScope --format='value(key,value)'
  Assert-Ok 'Reading host keys'
  $lines = @($rows | Where-Object { $_ } | ForEach-Object { $k, $v = $_ -split "`t", 2; "$ip $k $v" })
  if ($lines.Count -eq 0) { throw 'The VM has not published its host keys yet. Wait a minute after boot and retry.' }
  Add-Content -Path $KnownHosts -Value $lines -Encoding ascii
}

$common = @('-i', $KeyPath, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20',
  '-o', 'ServerAliveInterval=30', '-o', "UserKnownHostsFile=$KnownHosts", '-o', 'StrictHostKeyChecking=yes')
function Invoke-Remote([string]$command) { & ssh -n @common $target $command; Assert-Ok "Remote: $command" }
function Send-File([string]$local, [string]$remote) { & scp -q @common $local "${target}:$remote"; Assert-Ok "Upload $local" }

$staging = Join-Path $env:TEMP 'arvo-gcp-deploy'
Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $staging | Out-Null
$password = $null

try {
  # ---- 1. Provision (Node, Caddy, systemd, operator login) ----------------
  if ($Provision) {
    Say "Provisioning $Instance ($ip)"
    $bytes = New-Object byte[] 18
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $password = [Convert]::ToBase64String($bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=')
    $pwFile = Join-Path $staging 'arvo-admin-password'
    [IO.File]::WriteAllText($pwFile, $password, [Text.UTF8Encoding]::new($false))

    foreach ($name in 'provision.sh', 'arvo.service', 'Caddyfile.template') {
      $copy = Join-Path $staging $name
      Write-Lf $copy (Get-Content (Join-Path $PSScriptRoot $name) -Raw)
      Send-File $copy "/tmp/$name"
    }
    Send-File $pwFile '/tmp/arvo-admin-password'
    Remove-Item $pwFile -Force
    Invoke-Remote "chmod 600 /tmp/arvo-admin-password && sudo bash /tmp/provision.sh $domain $ip; rc=`$?; rm -f /tmp/provision.sh /tmp/arvo-admin-password; exit `$rc"

    $saveDir = Join-Path $env:LOCALAPPDATA 'Arvo'
    New-Item -ItemType Directory -Path $saveDir -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $saveDir 'gcp-operator-login.txt'), "https://$domain`nuser: admin`npassword: $password`n", [Text.UTF8Encoding]::new($false))
  }

  # ---- 2. Secrets: only what the app reads ---------------------------------
  if ($SyncEnv) {
    Say 'Syncing ELEVENLABS_* settings'
    $allowed = 'ELEVENLABS_API_KEY', 'ELEVENLABS_AGENT_ID', 'ELEVENLABS_VOICE_ID'
    $envLines = foreach ($line in Get-Content (Join-Path $ProjectDir '.env.local')) {
      if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*(\S.*?)\s*$' -and $allowed -contains $Matches[1]) { "$($Matches[1])=$($Matches[2])" }
    }
    if (-not ($envLines | Where-Object { $_ -like 'ELEVENLABS_API_KEY=*' })) { throw 'ELEVENLABS_API_KEY is not set in .env.local.' }
    $envFile = Join-Path $staging 'arvo.env'
    Write-Lf $envFile (($envLines -join "`n") + "`n")
    Send-File $envFile '/tmp/arvo.env'
    Remove-Item $envFile -Force
    Invoke-Remote 'sudo install -m 600 -o root -g root /tmp/arvo.env /etc/arvo/arvo.env; rc=$?; shred -u /tmp/arvo.env 2>/dev/null || rm -f /tmp/arvo.env; exit $rc'
  }

  # ---- 3. Data: seed once, never overwrite the server's copy ---------------
  if ($SeedData) {
    $exists = (& ssh -n @common $target 'sudo test -f /var/lib/arvo/agent.json && echo yes || echo no')
    Assert-Ok 'Checking server data'
    if ("$exists".Trim() -eq 'no') {
      Say 'Seeding agent settings and call history (.agent.json)'
      Send-File (Join-Path $ProjectDir '.agent.json') '/tmp/arvo-agent.json'
      Invoke-Remote 'sudo install -m 600 -o arvo -g arvo /tmp/arvo-agent.json /var/lib/arvo/agent.json; rc=$?; shred -u /tmp/arvo-agent.json 2>/dev/null || rm -f /tmp/arvo-agent.json; exit $rc'
    } else {
      Say 'Server already has its own .agent.json, leaving it untouched'
    }
  }

  # ---- 4. Source → build on the server → switch release ---------------------
  Say 'Packaging source'
  $include = @('app', 'components', 'lib', 'package.json', 'package-lock.json', 'next.config.js',
    'jsconfig.json', 'postcss.config.js', 'tailwind.config.js', 'public') |
    Where-Object { Test-Path (Join-Path $ProjectDir $_) }
  $archive = Join-Path $staging 'arvo-src.tar.gz'
  & tar -czf $archive -C $ProjectDir @include
  Assert-Ok 'Packaging'
  Say ("Uploading {0:N1} MB" -f ((Get-Item $archive).Length / 1MB))
  Send-File $archive '/tmp/arvo-src.tar.gz'
  $releaseScript = Join-Path $staging 'release.sh'
  Write-Lf $releaseScript (Get-Content (Join-Path $PSScriptRoot 'release.sh') -Raw)
  Send-File $releaseScript '/tmp/release.sh'

  Say 'Building and releasing on the server (a few minutes)'
  Invoke-Remote 'bash /tmp/release.sh; rc=$?; rm -f /tmp/release.sh; exit $rc'

  # ---- 5. Verify through the public HTTPS endpoint --------------------------
  Say "Checking https://$domain"
  $console = ''; $customer = ''
  for ($i = 0; $i -lt 30; $i++) {
    $console = (& curl.exe -s -o NUL -w '%{http_code}' --max-time 15 "https://$domain/loan")
    $customer = (& curl.exe -s -o NUL -w '%{http_code}' --max-time 15 "https://$domain/loan/call/not-a-real-link")
    if ($console -eq '401' -and $customer -eq '200') { break }
    Start-Sleep -Seconds 5
  }
  if ($console -ne '401' -or $customer -ne '200') {
    throw "Public check failed: console=$console (expected 401), customer page=$customer (expected 200)."
  }

  Write-Host ''
  Write-Host "Live: https://$domain/loan" -ForegroundColor Green
  if ($password) {
    Write-Host "Operator login: admin / $password" -ForegroundColor Yellow
    Write-Host "Saved to: $(Join-Path $env:LOCALAPPDATA 'Arvo\gcp-operator-login.txt')"
  }
} finally {
  Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
}
