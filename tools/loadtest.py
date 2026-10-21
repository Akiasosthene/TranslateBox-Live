#!/usr/bin/env python3
"""Load test for Syntova: one operator streams PCM to an event while N listeners
receive it. Reports delivered frames, gaps and end-to-end delay per listener.

Usage (against your server, from any computer with Python 3.10+ and `websockets`):
  pip install websockets
  python3 tools/loadtest.py --base https://syntova.cloud --token OPERATOR_CODE --listeners 200 --seconds 60

The event is created with name "Load test" and deleted at the end. Listeners
count toward the per-event limit (MAX_LISTENERS), raise it before testing.
Nothing is sent to OpenAI: the operator pushes silence frames directly to the hub.
"""
import argparse, asyncio, json, statistics, struct, time, urllib.request, urllib.error

RATE = 16000
FRAME_MS = 40
FRAME = b"\x00\x00" * (RATE * FRAME_MS // 1000)  # 40 ms of silence, PCM16 mono

def http(base, path, token, method="GET", body=None):
    req = urllib.request.Request(base + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read() or b"{}")

async def operator(ws_url, token, seconds, stats):
    import websockets
    async with websockets.connect(ws_url, max_size=None) as ws:
        await ws.send(json.dumps({"type": "auth", "token": token, "format": "pcm16", "rate": RATE}))
        ready = json.loads(await ws.recv())
        assert ready.get("type") == "ready", ready
        stats["start"] = time.time()
        n = int(seconds * 1000 / FRAME_MS)
        t0 = time.perf_counter()
        for i in range(n):
            # 8-byte timestamp prefix lets listeners measure delay; it is inaudible silence anyway.
            await ws.send(struct.pack("<d", time.time()) + FRAME[8:])
            stats["sent"] += 1
            await asyncio.sleep(max(0, t0 + (i + 1) * FRAME_MS / 1000 - time.perf_counter()))

async def listener(ws_url, idx, seconds, results):
    import websockets
    got = 0; delays = []; last = None; gaps = 0; err = None
    try:
        async with websockets.connect(ws_url, max_size=None, open_timeout=20) as ws:
            await ws.send(json.dumps({"type": "auth", "pin": None}))
            end = time.time() + seconds + 5
            while time.time() < end:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=5)
                except asyncio.TimeoutError:
                    if got: break
                    continue
                if isinstance(msg, (bytes, bytearray)):
                    got += 1
                    ts = struct.unpack("<d", msg[:8])[0]
                    if 1e9 < ts < 2e9: delays.append(time.time() - ts)
                    now = time.time()
                    if last and now - last > 0.5: gaps += 1
                    last = now
    except Exception as e:
        err = f"{type(e).__name__}: {e}"
    results.append({"idx": idx, "frames": got, "delays": delays, "gaps": gaps, "error": err})

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True, help="https://syntova.cloud")
    ap.add_argument("--token", required=True, help="operator code or tbs_/tbk_ token")
    ap.add_argument("--listeners", type=int, default=100)
    ap.add_argument("--seconds", type=int, default=30)
    ap.add_argument("--lang", default="fr")
    a = ap.parse_args()
    ws_base = a.base.replace("https://", "wss://").replace("http://", "ws://")
    ev = http(a.base, "/api/events", a.token, "POST", {"name": "Load test", "target_language": a.lang})
    eid = ev["id"]; tok = ev.get("operator_token") or a.token
    print(f"event {eid}, max_listeners={ev.get('max_listeners')}")
    stats = {"sent": 0}; results = []
    try:
        op = asyncio.create_task(operator(f"{ws_base}/api/ws/{eid}?role=operator&lang={a.lang}", tok, a.seconds, stats))
        await asyncio.sleep(1.5)
        tasks = []
        for i in range(a.listeners):
            tasks.append(asyncio.create_task(listener(f"{ws_base}/api/ws/{eid}?role=listener&lang={a.lang}", i, a.seconds, results)))
            await asyncio.sleep(0.02)  # 50 joins per second, like a crowd scanning a QR code
        await op
        await asyncio.gather(*tasks)
    finally:
        try: http(a.base, f"/api/events/{eid}", a.token, "DELETE")
        except Exception: pass
    ok = [r for r in results if not r["error"] and r["frames"]]
    failed = [r for r in results if r["error"] or not r["frames"]]
    all_delays = [d for r in ok for d in r["delays"]]
    print(f"\nsent {stats['sent']} frames in {a.seconds}s to {a.listeners} listeners")
    print(f"connected and receiving: {len(ok)}   failed: {len(failed)}")
    if failed[:3]: print("  e.g.", [f['error'] for f in failed[:3]])
    if ok:
        recv = [r["frames"] / stats["sent"] for r in ok]
        print(f"frames received per listener: median {statistics.median(recv)*100:.1f}%  min {min(recv)*100:.1f}%")
        print(f"listeners with audio gaps >0.5s: {sum(1 for r in ok if r['gaps'])}")
    if all_delays:
        all_delays.sort()
        p = lambda q: all_delays[int(q * (len(all_delays) - 1))] * 1000
        print(f"server delay operator→listener: median {p(.5):.0f} ms  p95 {p(.95):.0f} ms  max {all_delays[-1]*1000:.0f} ms")

if __name__ == "__main__":
    asyncio.run(main())
