#!/usr/bin/env bash
# Emails you when the public site stops answering, and again when it recovers.
# Uses the SMTP settings from .env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD,
# SMTP_FROM, LEADS_NOTIFY_TO). Does nothing if they are empty.
# This runs on the same server, so it cannot warn you if the whole machine is off:
# keep a free outside monitor too (UptimeRobot, Better Stack) on https://syntova.cloud/api/health
set -uo pipefail
APP_DIR="${APP_DIR:-/opt/translatebox}"
STATE=/var/lib/syntova-health.state
URL="${PUBLIC_HEALTH_URL:-https://syntova.cloud/api/health}"
set -a; . "$APP_DIR/.env" 2>/dev/null; set +a
[ -n "${SMTP_HOST:-}" ] && [ -n "${LEADS_NOTIFY_TO:-}" ] || exit 0

if curl -fsS --max-time 15 "$URL" | grep -q '"status":"ok"'; then now=up; else now=down; fi
prev=$(cat "$STATE" 2>/dev/null || echo up)
[ "$now" = "$prev" ] && exit 0
echo "$now" > "$STATE"

subject="Syntova is $( [ "$now" = down ] && echo DOWN || echo back up ) ($(date '+%Y-%m-%d %H:%M'))"
python3 - "$subject" <<'PY'
import os, smtplib, ssl, sys
from email.message import EmailMessage
m = EmailMessage(); m["Subject"] = sys.argv[1]; m["From"] = os.environ.get("SMTP_FROM") or os.environ["SMTP_USER"]; m["To"] = os.environ["LEADS_NOTIFY_TO"]
m.set_content(f"{sys.argv[1]}\nChecked: {os.environ.get('PUBLIC_HEALTH_URL','https://syntova.cloud/api/health')}\nThe watchdog restarts the containers automatically; if this persists, check: docker compose logs --tail=100 backend")
host = os.environ["SMTP_HOST"]; port = int(os.environ.get("SMTP_PORT") or 587); ctx = ssl.create_default_context()
s = smtplib.SMTP_SSL(host, port, timeout=20, context=ctx) if port == 465 else smtplib.SMTP(host, port, timeout=20)
with s:
    if port != 465: s.starttls(context=ctx)
    if os.environ.get("SMTP_USER"): s.login(os.environ["SMTP_USER"], os.environ.get("SMTP_PASSWORD", ""))
    s.send_message(m)
PY
echo "$(date -Is) $subject"
