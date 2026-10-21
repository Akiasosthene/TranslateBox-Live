#!/usr/bin/env bash
# Store the premium provider API keys in .env without showing them on screen,
# then restart the app. Run on the server:  sudo bash deploy/set-keys.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE=.env
[ -f "$ENV_FILE" ] || { echo "No .env found in $(pwd)"; exit 1; }

set_key() {
  local name="$1" value="$2"
  [ -z "$value" ] && { echo "  $name: unchanged (nothing entered)"; return; }
  if grep -q "^${name}=" "$ENV_FILE"; then
    # replace in place without echoing the value
    python3 - "$ENV_FILE" "$name" "$value" <<'PY'
import sys
path, name, value = sys.argv[1:4]
lines = open(path).read().splitlines()
lines = [f"{name}={value}" if l.startswith(name + "=") else l for l in lines]
open(path, "w").write("\n".join(lines) + "\n")
PY
  else
    printf '%s=%s\n' "$name" "$value" >> "$ENV_FILE"
  fi
  echo "  $name: saved"
}

echo "Paste each key and press Enter (the key is not displayed). Leave empty to skip."
read -r -s -p "Deepgram API key: " DG; echo
read -r -s -p "ElevenLabs API key: " EL; echo
set_key DEEPGRAM_API_KEY "$DG"
set_key ELEVENLABS_API_KEY "$EL"
chmod 600 "$ENV_FILE"
unset DG EL

docker compose up -d --build --wait
echo
echo "Checks (1 = key present):"
echo "  Deepgram:   $(grep -c '^DEEPGRAM_API_KEY=.\+' "$ENV_FILE" || true)"
echo "  ElevenLabs: $(grep -c '^ELEVENLABS_API_KEY=.\+' "$ENV_FILE" || true)"
curl -fsS http://127.0.0.1:8092/api/health >/dev/null && echo "  health: ok" || echo "  health: FAILED"
