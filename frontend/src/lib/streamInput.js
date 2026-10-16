import { API, WS_BASE, operatorHeaders, operatorFetch, responseError } from "./api";
import { createAudioContext, PcmPlayer } from "./pcmAudio";

const RETRY = [1000, 2000, 4000, 8000];

// Audio from an RTMP / RTMPS / SRT stream (Zoom, Teams, Webex, OBS, YouTube…)
// relayed by the server as 16 kHz PCM. It becomes a MediaStream that the
// translation engines use exactly like a microphone.
export class StreamInput {
  constructor({ eventId, onStatus = () => {}, onLevel = () => {} }) {
    Object.assign(this, { eventId, onStatus, onLevel, ctx: null, dest: null, player: null, ws: null, retry: null, attempt: 0, wanted: false, live: false });
  }

  async start() {
    this.wanted = true;
    this.ctx = createAudioContext();
    if (this.ctx.state === "suspended") await this.ctx.resume().catch(() => {});
    this.dest = this.ctx.createMediaStreamDestination();
    this.player = new PcmPlayer(this.ctx, { inRate: 16000, targetMs: 200, maxMs: 1500, destination: this.dest, onStats: (s) => this.onLevel(s.level || 0) });
    await this.player.init();
    this._connect();
  }

  _connect() {
    if (!this.wanted) return;
    const ws = new WebSocket(`${WS_BASE}/api/ws/${encodeURIComponent(this.eventId)}?role=ingest`);
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: "auth", bearer: (operatorHeaders().Authorization || "").slice(7) }));
    ws.onmessage = ({ data }) => {
      if (typeof data === "string") {
        try {
          const m = JSON.parse(data);
          if (m.type === "ingest") { this.attempt = 0; this.live = !!m.live; if (!m.live) this.player?.clear(); this.onStatus({ connected: true, live: this.live }); }
        } catch { /* ignore */ }
        return;
      }
      this.player?.push(data);
    };
    ws.onclose = ({ code }) => {
      if (this.ws !== ws) return;
      this.ws = null; this.live = false;
      if (code === 4401) { this.wanted = false; this.onStatus({ connected: false, live: false, error: "Not allowed to read this stream." }); return; }
      if (code === 4501) { this.wanted = false; this.onStatus({ connected: false, live: false, error: "Stream input is not enabled on this server." }); return; }
      this.onStatus({ connected: false, live: false });
      this.retry = setTimeout(() => this._connect(), RETRY[Math.min(this.attempt++, RETRY.length - 1)]);
    };
  }

  // Each consumer gets its own cloned track so stopping one leaves the others.
  stream() {
    if (!this.dest) throw new Error("NO_AUDIO_INPUT::Start the stream input first.");
    return new MediaStream(this.dest.stream.getAudioTracks().map((t) => t.clone()));
  }

  stop() {
    this.wanted = false;
    clearTimeout(this.retry);
    if (this.ws) { this.ws.onclose = null; this.ws.close(); this.ws = null; }
    this.player?.dispose(); this.player = null;
    this.dest = null;
    this.ctx?.close?.().catch(() => {}); this.ctx = null;
    this.live = false;
  }
}

let current = null;
export const getStreamInput = () => current;
export function setStreamInput(input) { if (current && current !== input) current.stop(); current = input; }

export async function fetchIngest(eventId, rotate = false) {
  const res = await operatorFetch(`${API}/events/${encodeURIComponent(eventId)}/ingest${rotate ? "/rotate" : ""}`, rotate ? { method: "POST" } : {});
  if (!res.ok) throw new Error(await responseError(res, "Stream details unavailable."));
  return res.json();
}
