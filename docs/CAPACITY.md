# Capacity

Measured on 2026-10-21 with `tools/loadtest.py` against the backend alone (no nginx, 2 vCPU
container, one language, 40 ms PCM frames). Listeners joined at 50 per second, like a crowd
scanning a QR code. Frames received below 100% reflect late joiners, not drops.

| Listeners | Failed | Audio gaps | Delay median / p95 | Backend CPU | RSS |
|---|---|---|---|---|---|
| 200 | 0 | 0 | 14 ms / 19 ms | 5% | 73 MB |
| 500 | 0 | 0 | 35 ms / 50 ms | 12% | 99 MB |

Each extra language roughly multiplies the fan-out work by the share of listeners on it, so a
500-person event with 3 languages is about the same cost as the 500-listener row.

Defaults: `MAX_LISTENERS=300` per event and `WS_RATE_LIMIT_MAX=2000` WebSocket handshakes per
IP per minute. The second matters: everyone in a venue shares one public IP, so the old limit of
120 per minute refused listeners once a room of 150 scanned the code or reconnected together.

Before a large event, run the test against the real server from a laptop on another network:

```bash
pip install websockets
python3 tools/loadtest.py --base https://syntova.cloud --token "$OPERATOR_CODE" --listeners 300 --seconds 60
```

Raise `MAX_LISTENERS` in `.env` if the number of attendees is higher, then `docker compose up -d --wait`.
The OpenAI side is unaffected by the number of listeners: one translation session per language, whatever the audience size.
