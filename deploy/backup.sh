#!/usr/bin/env bash
# Nightly backup of Syntova data: a consistent copy of the SQLite database
# (accounts, sessions, transcripts, settings) plus the .env file.
# Keeps the last KEEP_DAYS days in BACKUP_DIR.
#
# Install (as root, on the server):
#   chmod +x /opt/translatebox/deploy/backup.sh
#   echo '30 3 * * * root /opt/translatebox/deploy/backup.sh >> /var/log/syntova-backup.log 2>&1' > /etc/cron.d/syntova-backup
#
# Restore: see deploy/RESTORE.md
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/translatebox}"
BACKUP_DIR="${BACKUP_DIR:-/root/syntova-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%F-%H%M)"
TARGET="$BACKUP_DIR/$STAMP"

mkdir -p "$TARGET"
chmod 700 "$BACKUP_DIR"
cd "$APP_DIR"

# SQLite online backup: safe while the app is running.
docker compose exec -T backend python - <<'PY'
import sqlite3
src = sqlite3.connect("/data/events.sqlite3")
dst = sqlite3.connect("/data/.syntova-backup.sqlite3")
with dst:
    src.backup(dst)
dst.close(); src.close()
PY
docker compose exec -T backend cat /data/.syntova-backup.sqlite3 > "$TARGET/events.sqlite3"
docker compose exec -T backend rm -f /data/.syntova-backup.sqlite3
# Refuse to keep an empty or broken copy.
python3 - "$TARGET/events.sqlite3" <<'PY'
import sqlite3, sys
con = sqlite3.connect(sys.argv[1])
assert con.execute("PRAGMA integrity_check").fetchone()[0] == "ok", "backup integrity check failed"
PY

cp .env "$TARGET/env"
git rev-parse HEAD > "$TARGET/git-commit" 2>/dev/null || true
chmod 600 "$TARGET"/*

tar -C "$BACKUP_DIR" -czf "$BACKUP_DIR/syntova-$STAMP.tgz" "$STAMP"
rm -rf "$TARGET"
chmod 600 "$BACKUP_DIR/syntova-$STAMP.tgz"

find "$BACKUP_DIR" -name 'syntova-*.tgz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) backup ok: $BACKUP_DIR/syntova-$STAMP.tgz ($(du -h "$BACKUP_DIR/syntova-$STAMP.tgz" | cut -f1))"
