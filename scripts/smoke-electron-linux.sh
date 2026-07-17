#!/usr/bin/env bash
set -euo pipefail

mode="${1:?usage: smoke-electron-linux.sh <x11|wayland> <binary> <log>}"
binary="${2:?usage: smoke-electron-linux.sh <x11|wayland> <binary> <log>}"
log="${3:?usage: smoke-electron-linux.sh <x11|wayland> <binary> <log>}"
runtime_dir="$(mktemp -d)"
config_dir="$(mktemp -d)"
app_pid=""
weston_pid=""

cleanup() {
  if [[ -n "$app_pid" ]] && kill -0 "$app_pid" 2>/dev/null; then kill -TERM "$app_pid" 2>/dev/null || true; fi
  if [[ -n "$weston_pid" ]] && kill -0 "$weston_pid" 2>/dev/null; then kill -TERM "$weston_pid" 2>/dev/null || true; fi
  rm -rf "$runtime_dir" "$config_dir"
}
trap cleanup EXIT
chmod 700 "$runtime_dir"

if [[ "$mode" == "wayland" ]]; then
  export XDG_RUNTIME_DIR="$runtime_dir"
  weston --backend=headless-backend.so --socket=wayland-silfable-qa --idle-time=0 >"${log}.weston" 2>&1 &
  weston_pid=$!
  for _ in $(seq 1 30); do
    [[ -S "$runtime_dir/wayland-silfable-qa" ]] && break
    kill -0 "$weston_pid" 2>/dev/null || { cat "${log}.weston"; exit 1; }
    sleep 0.25
  done
  [[ -S "$runtime_dir/wayland-silfable-qa" ]]
  WAYLAND_DISPLAY=wayland-silfable-qa XDG_CONFIG_HOME="$config_dir" ELECTRON_OZONE_PLATFORM_HINT=wayland \
    "$binary" --no-sandbox --remote-debugging-port=9333 --enable-features=UseOzonePlatform --ozone-platform=wayland >"$log" 2>&1 &
else
  XDG_RUNTIME_DIR="$runtime_dir" XDG_CONFIG_HOME="$config_dir" ELECTRON_OZONE_PLATFORM_HINT=x11 \
    "$binary" --no-sandbox --remote-debugging-port=9333 --ozone-platform=x11 >"$log" 2>&1 &
fi
app_pid=$!

node scripts/assert-electron-renderer.mjs "http://127.0.0.1:9333"
kill -0 "$app_pid" 2>/dev/null || { cat "$log"; exit 1; }
echo "Electron $mode renderer and secure preload bridge passed smoke QA."
