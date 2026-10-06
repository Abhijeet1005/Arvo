#!/bin/sh
# Arvo network watchdog — keeps the Pi reachable on the local network.
#
# Runs every minute (arvo-netwatch.timer) and checks the router. While the
# router doesn't answer, it escalates:
#   down 3 min  -> reconnect Wi-Fi                          (again every 10 min)
#   down 6 min  -> restart NetworkManager + Wi-Fi driver    (again every 10 min)
#   down 30 min -> reboot                                   (at most once an hour)
# Only the local router is checked, so an internet outage never triggers it.
set -u

STATE=/run/arvo-netwatch.fails # tmpfs: back to zero after every boot
log() { logger -t arvo-netwatch "$*"; }

# Undo anything an interrupted earlier run may have left behind.
if ! systemctl is-active --quiet NetworkManager; then
  log "NetworkManager was not running, starting it"
  systemctl start NetworkManager
  sleep 10
fi
if [ "$(nmcli radio wifi 2>/dev/null)" = "disabled" ]; then
  log "Wi-Fi radio was off, turning it on"
  nmcli radio wifi on
fi

gw=$(ip -4 route show default 2>/dev/null | awk '{print $3; exit}')
dev=$(ip -4 route show default 2>/dev/null | awk '{print $5; exit}')

reachable() {
  [ -n "$gw" ] || return 1
  ping -q -c 3 -W 2 "$gw" >/dev/null 2>&1 && return 0
  # Some routers ignore ping; an ARP reply proves the link just as well.
  arping -q -c 2 -w 4 -I "$dev" "$gw" >/dev/null 2>&1
}

fails=$(cat "$STATE" 2>/dev/null || echo 0)

if reachable; then
  [ "$fails" -gt 0 ] && log "network is back (router $gw answered after $fails failed checks)"
  rm -f "$STATE"
  exit 0
fi

fails=$((fails + 1))
echo "$fails" >"$STATE"
log "router ${gw:-(no default route)} not answering, check $fails"

# The Wi-Fi connection to bring back: the active one, else the first saved
# one that autoconnects.
wifi_conn() {
  nmcli -t -f NAME,TYPE connection show --active 2>/dev/null | awk -F: '$2=="802-11-wireless" {print $1; exit}'
}
saved_wifi_conn() {
  nmcli -t -f NAME,TYPE,AUTOCONNECT connection show 2>/dev/null | awk -F: '$2=="802-11-wireless" && $3=="yes" {print $1; exit}'
}

if [ "$fails" -ge 3 ] && [ $(((fails - 3) % 10)) -eq 0 ]; then
  conn=$(wifi_conn)
  [ -n "$conn" ] || conn=$(saved_wifi_conn)
  log "reconnecting Wi-Fi (${conn:-wlan0})"
  # "connection up" re-associates in one step; nothing is left switched off.
  if [ -n "$conn" ]; then nmcli -w 45 connection up "$conn" >/dev/null 2>&1; else nmcli -w 45 device connect wlan0 >/dev/null 2>&1; fi
elif [ "$fails" -ge 6 ] && [ $(((fails - 6) % 10)) -eq 0 ]; then
  log "restarting NetworkManager and reloading the Wi-Fi driver"
  systemctl stop NetworkManager
  for m in brcmfmac_wcc brcmfmac_cyw brcmfmac_bca brcmfmac; do modprobe -r "$m" 2>/dev/null; done
  sleep 2
  modprobe brcmfmac
  systemctl start NetworkManager
fi

if [ "$fails" -ge 30 ] && [ $((fails % 30)) -eq 0 ]; then
  if [ "$(cut -d. -f1 /proc/uptime)" -ge 3600 ]; then
    log "offline for $fails minutes, rebooting"
    sync
    systemctl reboot
  else
    log "offline for $fails minutes, but up less than an hour, so not rebooting yet"
  fi
fi
exit 0
