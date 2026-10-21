# Running Syntova in production

Server: Hostinger VPS, app in `/opt/translatebox`, host nginx terminates HTTPS and
forwards `syntova.cloud` to the app on `127.0.0.1:8092`.

## Update

```bash
cd /opt/translatebox && git pull && docker compose up -d --build --wait
curl -s https://syntova.cloud/api/health
```

## One-time setup (does everything below)

```bash
sudo bash /opt/translatebox/deploy/setup-ops.sh
```

Rotates the operator code (printed once), installs the nightly backup, the watchdog and the
email health alert, restarts the containers and runs a first backup. Add `--keep-code` to keep
the current operator code.

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

## Selling minutes (Stripe)

1. In the Stripe dashboard create one Product per pack (for example "300 minutes") with a one-time
   price; copy each `price_...` id.
2. Add a webhook endpoint `https://syntova.cloud/api/billing/webhook` for the event
   `checkout.session.completed`; copy its signing secret `whsec_...`.
3. In `.env`:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   MINUTE_PACKS=300:price_abc:49 $,1000:price_def:149 $
   ```
   then `docker compose up -d --wait`.
4. Users with a minute balance see **Buy minutes** in Portal → Account. Payment happens on
   Stripe's page; the balance is credited when Stripe confirms, once per session even if the
   webhook is retried. Purchases are kept in the store under `billing_purchases`.

Test first with `sk_test_` keys and Stripe's test card 4242 4242 4242 4242.
