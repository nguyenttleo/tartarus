#!/usr/bin/env bash
# Download the WASI interpreter runtimes listed in runtimes.lock.
# Usage: runtimes/fetch-runtimes.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCK="$HERE/runtimes.lock"

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}';
  else shasum -a 256 "$1" | awk '{print $1}'; fi
}

[ -f "$LOCK" ] || { echo "missing $LOCK" >&2; exit 1; }

while IFS='|' read -r name url want; do
  name="$(echo "${name:-}" | xargs)"
  url="$(echo "${url:-}" | xargs)"
  want="$(echo "${want:-AUTO}" | xargs)"
  [ -z "$name" ] && continue
  case "$name" in \#*) continue ;; esac

  dest="$HERE/$name"
  if [ -f "$dest" ]; then
    echo "✓ $name already present"
  else
    echo "↓ $name ← $url"
    curl -fSL "$url" -o "$dest"
  fi

  got="$(sha256 "$dest")"
  if [ "$want" = "AUTO" ] || [ -z "$want" ]; then
    echo "  sha256=$got  (paste into runtimes.lock to pin)"
  elif [ "$got" != "$want" ]; then
    echo "  ✗ checksum mismatch for $name: got $got, want $want" >&2
    exit 1
  else
    echo "  ✓ checksum verified"
  fi
done < "$LOCK"

echo "runtimes ready in $HERE"
