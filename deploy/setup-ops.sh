#!/usr/bin/env bash
# One-time production setup on the VPS, safe to re-run:
#   1. rotate the operator code (the old one stops working immediately)
#   2. install nightly backups and the 5-minute watchdog
#   3. install the outside-style health alert by email (if SMTP is configured in .env)
#   4. run one backup now and show the result
#
#   sudo bash /opt/translatebox/deploy/setup-ops.sh            # everything
#   sudo bash /opt/translatebox/deploy/setup-ops.sh --keep-code  # everything except the operator code
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/translatebox}"
cd "$APP_DIR"
[ -f .env ] || { echo "no .env in $APP_DIR"; exit 1; }

cp .env ".env.bak-$(date +%F-%H%M)"
chmod 600 .env.bak-* 2>/dev/null || true

if [[ "${1:-}" != "--keep-code" ]]; then
  NEW=$(openssl rand -hex 24)
  if grep -q '^OPERATOR_TOKEN=' .env; then
    sed -i "s|^OPERATOR_TOKEN=.*|OPERATOR_TOKEN=$NEW|" .env
  else
    echo "OPERATOR_TOKEN=$NEW" >> .env
  fi
  echo
  echo "=============================================================="
  echo " NEW OPERATOR CODE (copy it to your password manager now):"
  echo
  echo "   $NEW"
  echo
  echo " It is not printed anywhere else. The old code no longer works."
  echo "=============================================================="
  echo
fi

chmod +x deploy/backup.sh deploy/watchdog.sh deploy/healthalert.sh
echo '30 3 * * * root /opt/translatebox/deploy/backup.sh >> /var/log/syntova-backup.log 2>&1' > /etc/cron.d/syntova-backup
echo '*/5 * * * * root /opt/translatebox/deploy/watchdog.sh >> /var/log/syntova-watchdog.log 2>&1' > /etc/cron.d/syntova-watchdog
echo '*/10 * * * * root /opt/translatebox/deploy/healthalert.sh >> /var/log/syntova-healthalert.log 2>&1' > /etc/cron.d/syntova-healthalert
chmod 644 /etc/cron.d/syntova-*
echo "cron jobs installed: backup 03:30 nightly, watchdog every 5 min, health alert every 10 min"

docker compose up -d --wait
echo "containers restarted"

./deploy/backup.sh
echo
curl -fsS --max-time 10 http://127.0.0.1:8092/api/health | grep -q '"status":"ok"' && echo "health: ok" || echo "health: FAILED (check docker compose logs backend)"
