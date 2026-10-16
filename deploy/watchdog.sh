#!/usr/bin/env bash
# Restarts the Syntova containers if the local health check fails twice in a row.
# This covers a stuck container; it cannot warn you if the whole server is down,
# so also use an outside monitor (see docs/OPERATIONS.md).
#
# Install (as root):
#   chmod +x /opt/translatebox/deploy/watchdog.sh
#   echo '*/5 * * * * root /opt/translatebox/deploy/watchdog.sh >> /var/log/syntova-watchdog.log 2>&1' > /etc/cron.d/syntova-watchdog
set -uo pipefail
APP_DIR="${APP_DIR:-/opt/translatebox}"
URL="${HEALTH_URL:-http://127.0.0.1:8092/api/health}"
check() { curl -fsS --max-time 10 "$URL" | grep -q '"status":"ok"'; }
check && exit 0
sleep 30
check && exit 0
echo "$(date -Is) health check failed twice, restarting containers"
cd "$APP_DIR" && docker compose up -d --wait
check && echo "$(date -Is) recovered" || echo "$(date -Is) still failing after restart"
