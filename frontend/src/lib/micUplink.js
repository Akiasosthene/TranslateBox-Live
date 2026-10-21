import { PcmCapture, createAudioContext } from "./pcmAudio";
import { WS_BASE } from "./api";

// Simple mode: the browser only sends microphone audio to the server, which
// runs every translation session itself. Survives tab throttling, Wi-Fi blips
// and laptop sleep: on any drop it reconnects and keeps sending.
const FINAL = { 4401: "Not authorized for this session.", 4404: "The server session has ended.", 4409: "Another device took over the microphone." };

export class MicUplink {
  constructor({ eventId, token, onStatus = () => {}, onLevel = () => {}, createCapture, restartSession = null }) {
    // restartSession(): async, asks the backend to start the server session again
    // (after a server restart). Up to 5 tries, then the session is reported ended.
    Object.assign(this, { eventId, token, onStatus, onLevel, restartSession, ws: null, stream: null, capture: null, stopped: true, attempt: 0, timer: null, ctx: null, pingTimer: null, restarts: 0 });
    this.createCapture = createCapture || ((ctx, node, onFrame) => new PcmCapture(ctx, node, onFrame).init());
  }

  async start({ deviceId, ambient } = {}) {
    this.stopped = false;
    this.ctx = createAudioContext();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    // No browser noise suppression or echo cancellation: in a venue they gate
    // the speaker's voice between words ("chopped" translation). The server
    // asks OpenAI for far-field noise reduction instead. Ambient mode also
    // drops automatic gain, for a mixer or PA feed at a fixed level.
    const proc = ambient
      ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      : { echoCancellation: false, noiseSuppression: false, autoGainControl: true };
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: deviceId ? { exact: deviceId } : undefined, ...proc }, video: false });
    const track = this.stream.getAudioTracks()[0];
    track.onended = () => { if (!this.stopped) this._restartMic({ deviceId, ambient }); };
    const node = this.ctx.createMediaStreamSource(this.stream);
    this.capture = await this.createCapture(this.ctx, node, (frame) => this._send(frame));
    this._meter(node);
    await this._open(true);
  }

  async _restartMic(opts) {
    try {
      this.capture?.dispose?.(); this.capture = null;
      this.stream?.getTracks().forEach((t) => t.stop());
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: opts.deviceId ? { exact: opts.deviceId } : undefined }, video: false });
      this.stream.getAudioTracks()[0].onended = () => { if (!this.stopped) this._restartMic(opts); };
      const node = this.ctx.createMediaStreamSource(this.stream);
      this.capture = await this.createCapture(this.ctx, node, (frame) => this._send(frame));
      this._meter(node);
      this.onStatus({ mic: "active" });
    } catch (e) {
      this.onStatus({ mic: "denied", error: "Microphone lost: " + e.message });
    }
  }

  _meter(node) {
    try {
      const an = this.ctx.createAnalyser(); an.fftSize = 512; node.connect(an);
      // Some browsers only process an analyser that reaches the destination; keep it silent.
      const mute = this.ctx.createGain(); mute.gain.value = 0; an.connect(mute).connect(this.ctx.destination);
      const buf = new Float32Array(an.fftSize);
      clearInterval(this.meterTimer);
      this.meterTimer = setInterval(() => {
        if (this.stopped) return;
        an.getFloatTimeDomainData(buf);
        let peak = 0; for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
        this.onLevel({ peak });
      }, 100);
    } catch { /* meter is optional */ }
  }

  _open(first) {
    return new Promise((resolve, reject) => {
      const ws = this.ws = new WebSocket(`${WS_BASE}/api/ws/${encodeURIComponent(this.eventId)}?role=source`);
      ws.binaryType = "arraybuffer";
      let ready = false;
      const timer = setTimeout(() => { if (!ready) { ws.onclose = null; ws.close(); if (first) reject(new Error("Server connection timed out")); else this._retry(); } }, 10000);
      ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token: this.token }));
      ws.onmessage = ({ data }) => {
        let m; try { m = JSON.parse(data); } catch { return; }
        if (m.type === "ready" && !ready) {
          ready = true; clearTimeout(timer); this.attempt = 0; this.restarts = 0;
          this.onStatus({ connected: true, mic: "active", error: null });
          clearInterval(this.pingTimer);
          this.pingTimer = setInterval(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ type: "ping" })); }, 5000);
          if (first) resolve();
        } else if (m.type === "pong") {
          this.onStatus({ server: m });
        } else if (m.type === "caption" || m.type === "source") {
          this.onStatus({ [m.type]: m });
        }
      };
      ws.onclose = ({ code }) => {
        clearTimeout(timer); clearInterval(this.pingTimer);
        if (this.ws !== ws || this.stopped) return;
        if (first && !ready) { reject(new Error(FINAL[code] || `Server refused the microphone (${code})`)); return; }
        if (code === 4404 && this.restartSession && this.restarts < 5) {
          this.restarts += 1;
          this.onStatus({ connected: false, error: "Server session ended, restarting…" });
          this.ws = null;
          clearTimeout(this.timer);
          this.timer = setTimeout(async () => {
            if (this.stopped) return;
            try { await this.restartSession(); this._open(false); }
            catch (e) { this.onStatus({ connected: false, error: e.message }); this._retry(); }
          }, Math.min(2000 * this.restarts, 10000));
          return;
        }
        if (FINAL[code]) { this.stop(); this.onStatus({ connected: false, error: FINAL[code], ended: true }); return; }
        this._retry();
      };
      ws.onerror = () => { /* onclose follows */ };
    });
  }

  _retry() {
    if (this.stopped) return;
    this.ws = null;
    const delay = Math.min(1000 * Math.pow(2, this.attempt), 10000);
    this.attempt += 1;
    this.onStatus({ connected: false, error: "Server connection lost, reconnecting…" });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { if (!this.stopped) this._open(false); }, delay);
  }

  _send(frame) {
    const ws = this.ws;
    if (!ws || ws.readyState !== 1 || this.muted) return;
    if (ws.bufferedAmount > 128 * 1024) return; // congested: drop rather than lag
    ws.send(frame);
  }

  setMuted(muted) { this.muted = muted; }
  setSpeaker(name) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify({ type: "speaker", name })); }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer); clearInterval(this.pingTimer); clearInterval(this.meterTimer);
    this.capture?.dispose?.(); this.capture = null;
    this.stream?.getTracks().forEach((t) => t.stop()); this.stream = null;
    if (this.ws) { this.ws.onclose = null; this.ws.onmessage = null; this.ws.close(); this.ws = null; }
    try { this.ctx?.close(); } catch { /* already closed */ }
    this.ctx = null;
  }
}
