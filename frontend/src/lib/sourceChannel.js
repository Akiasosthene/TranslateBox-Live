import { createAudioContext } from "./pcmAudio";
import { OperatorBroadcaster, WS_BASE } from "./broadcast";
import { getStreamInput } from "./streamInput";

// Sends the floor audio (the speaker's microphone, untranslated) to human
// interpreters' booths on the event's "src" channel. Never sent to listeners.
export class SourceChannel {
  constructor({ onError = () => {} } = {}) { this.onError = onError; this.ctx = null; this.stream = null; this.broadcaster = null; this.gain = null; }

  async start({ event, deviceId, ambient, source }) {
    const proc = ambient ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false } : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    this.stream = source === "stream"
      ? getStreamInput().stream()
      : await navigator.mediaDevices.getUserMedia({ audio: { deviceId: deviceId ? { exact: deviceId } : undefined, ...proc }, video: false });
    this.ctx = createAudioContext();
    if (this.ctx.state === "suspended") await this.ctx.resume().catch(() => {});
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.gain = this.ctx.createGain();
    src.connect(this.gain);
    const b = new OperatorBroadcaster(`${WS_BASE}/api/ws/${event.id}?role=operator&lang=src`, {
      token: event.operator_token,
      onStatus: (s) => { if (s.error) this.onError("Interpreter booth feed: " + s.error); },
    });
    this.broadcaster = b;
    await b.start({ ctx: this.ctx, output: this.gain });
  }

  setMuted(muted) { this.stream?.getAudioTracks().forEach((t) => { t.enabled = !muted; }); }

  stop() {
    this.broadcaster?.stop(); this.broadcaster = null;
    this.stream?.getTracks().forEach((t) => t.stop()); this.stream = null;
    this.ctx?.close?.().catch(() => {}); this.ctx = null;
  }
}
