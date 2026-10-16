# Running Syntova in production

Server: Hostinger VPS, app in `/opt/translatebox`, host nginx terminates HTTPS and
forwards `syntova.cloud` to the app on `127.0.0.1:8092`.

## Update

```bash
cd /opt/translatebox && git pull && docker compose up -d --build --wait
curl -s https://syntova.cloud/api/health
```

## Nightly backups

```bash
chmod +x /opt/translatebox/deploy/backup.sh
echo '30 3 * * * root /opt/translatebox/deploy/backup.sh >> /var/log/syntova-backup.log 2>&1' > /etc/cron.d/syntova-backup
/opt/translatebox/deploy/backup.sh          # run once now to check
ls -lh /root/syntova-backups
```

Archives older than 14 days are deleted. Copy one off the server every week, for example from
your computer: `scp root@76.13.48.98:/root/syntova-backups/syntova-*.tgz .`
Restore steps: `deploy/RESTORE.md`.

## Self-healing and monitoring

```bash
chmod +x /opt/translatebox/deploy/watchdog.sh
echo '*/5 * * * * root /opt/translatebox/deploy/watchdog.sh >> /var/log/syntova-watchdog.log 2>&1' > /etc/cron.d/syntova-watchdog
```

The watchdog restarts stuck containers. To be warned when the whole server is down, add a free
outside monitor (for example UptimeRobot or Better Stack) that checks
`https://syntova.cloud/api/health` every 5 minutes and looks for the word `ok`.

## Demo request emails

In `.env` (Hostinger mail shown; any SMTP works):

```
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=contact@syntova.cloud
SMTP_PASSWORD=...
SMTP_FROM=contact@syntova.cloud
LEADS_NOTIFY_TO=you@example.com
```

Then `docker compose up -d --wait`. A failed email never blocks the form; the request is still
saved in Portal → Requests.

## Logs

```bash
docker compose logs --tail=100 backend
docker compose logs --tail=100 web
tail -n 50 /var/log/syntova-backup.log /var/log/syntova-watchdog.log
```
