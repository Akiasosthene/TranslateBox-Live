# Restoring a Syntova backup

Backups are written by `deploy/backup.sh` to `/root/syntova-backups/syntova-YYYY-MM-DD-HHMM.tgz`.
Each archive holds `events.sqlite3` (all app data), `env` (settings and secrets) and `git-commit`.

```bash
cd /opt/translatebox
B=/root/syntova-backups/syntova-2026-10-17-0330.tgz   # pick the archive
mkdir -p /tmp/restore && tar -C /tmp/restore -xzf "$B"
D=$(ls -d /tmp/restore/*/)

VOL=$(docker volume ls -q | grep 'event_data$' | head -1)   # usually translatebox_event_data
docker compose stop backend
docker run --rm -v "$VOL":/data -v "$D":/in:ro alpine sh -c 'cp /in/events.sqlite3 /data/events.sqlite3 && rm -f /data/events.sqlite3-wal /data/events.sqlite3-shm' 
# Only if the .env was lost or damaged:
# cp "$D/env" .env
docker compose up -d --wait
rm -rf /tmp/restore
```

The backend is stopped while the file is replaced, so nothing writes to the database during the restore.
Copy the archives off the server from time to time (for example with `scp` to your computer):
a backup on the same disk does not survive the loss of the server.
