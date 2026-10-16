// Universal low-latency audio transport for TranslateBox.
//
// The operator taps its program bus with an AudioWorklet, resamples to 16 kHz
// mono and sends 40 ms Int16 frames over the broadcast WebSocket. Listeners
// play those frames with a second worklet that keeps a small jitter buffer.
// Plain Web Audio runs in Safari on iPhone/iPad as well as Chrome, Edge and
// Firefox, unlike WebM/Opus MediaSource playback.

export const WIRE_RATE = 16000;
export const FRAME_SAMPLES = 640; // 40 ms at 16 kHz

const WORKLET_SOURCE = `
class TbCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = options.processorOptions || {};
    this.outRate = o.outRate || 16000;
    this.frame = o.frameSamples || 640;
    this.step = sampleRate / this.outRate;
    this.pos = 0;
    this.prev = 0;
    this.buf = new Int16Array(this.frame);
    this.n = 0;
    this.enabled = true;
    this.port.onmessage = (e) => { if (e.data && 'enabled' in e.data) this.enabled = !!e.data.enabled; };
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!this.enabled) return true;
    const len = ch ? ch.length : 128;
    // Linear interpolation resampler with a fractional read position carried
    // across render quanta. Silence keeps the clock running when no input.
    while (this.pos < len) {
      const i = Math.floor(this.pos);
      const f = this.pos - i;
      const a = i === 0 ? this.prev : (ch ? ch[i - 1] : 0);
      const b = ch ? ch[i] : 0;
      let s = a + (b - a) * f;
      s = s < -1 ? -1 : s > 1 ? 1 : s;
      this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === this.frame) {
        const out = this.buf.buffer.slice(0);
        this.port.postMessage(out, [out]);
        this.n = 0;
      }
      this.pos += this.step;
    }
    this.pos -= len;
    this.prev = ch ? ch[len - 1] : 0;
    return true;
  }
}

class TbPlayer extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = options.processorOptions || {};
    this.inRate = o.inRate || 16000;
    this.ratio = this.inRate / sampleRate;
    this.cap = Math.ceil(this.inRate * 12);
    this.ring = new Float32Array(this.cap);
    this.r = 0; // read index (float, in input samples)
    this.w = 0; // write index (int)
    this.size = 0; // buffered input samples
    this.target = Math.round(this.inRate * (o.targetMs || 300) / 1000);
    this.maxBuf = o.maxMs ? Math.round(this.inRate * o.maxMs / 1000) : 0;
    this.buffering = true;
    this.paused = false;
    this.underruns = 0;
    this.dropped = 0;
    this.sumSq = 0; this.cnt = 0; this.tick = 0;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d instanceof ArrayBuffer) this.push(d);
      else if (d && d.type === 'pause') { this.paused = !!d.paused; if (this.paused) this.clear(); }
      else if (d && d.type === 'clear') this.clear();
      else if (d && d.type === 'config') {
        if (d.targetMs) this.target = Math.round(this.inRate * d.targetMs / 1000);
        if ('maxMs' in d) this.maxBuf = d.maxMs ? Math.round(this.inRate * d.maxMs / 1000) : 0;
      }
    };
  }
  clear() { this.r = 0; this.w = 0; this.size = 0; this.buffering = true; }
  push(ab) {
    if (this.paused) return;
    const pcm = new Int16Array(ab);
    for (let i = 0; i < pcm.length; i++) {
      if (this.size >= this.cap - 1) { this.r = (this.r + 1) % this.cap; this.size--; this.dropped++; }
      this.ring[this.w] = pcm[i] / 32768;
      this.w = (this.w + 1) % this.cap;
      this.size++;
    }
    // After a long network stall the backlog would keep the listener far
    // behind the speaker. Jump forward once, back to the target delay.
    if (this.maxBuf && this.size > this.maxBuf) {
      const skip = this.size - this.target;
      this.r = (Math.floor(this.r) + skip) % this.cap;
      this.size -= skip;
      this.dropped += skip;
    }
  }
  process(_inputs, outputs) {
    const out = outputs[0][0];
    if (this.buffering && this.size >= this.target) this.buffering = false;
    for (let i = 0; i < out.length; i++) {
      if (this.buffering || this.paused || this.size < 2) {
        if (!this.buffering && !this.paused) { this.buffering = true; this.underruns++; }
        out[i] = 0;
        continue;
      }
      const i0 = Math.floor(this.r) % this.cap;
      const i1 = (i0 + 1) % this.cap;
      const f = this.r - Math.floor(this.r);
      const s = this.ring[i0] + (this.ring[i1] - this.ring[i0]) * f;
      out[i] = s;
      this.sumSq += s * s; this.cnt++;
      const before = Math.floor(this.r);
      this.r += this.ratio;
      const consumed = Math.floor(this.r) - before;
      this.size -= consumed;
      if (this.r >= this.cap) this.r -= this.cap;
    }
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out);
    if (++this.tick >= 24) {
      this.tick = 0;
      this.port.postMessage({
        bufferedMs: Math.round(this.size / this.inRate * 1000),
        playing: !this.buffering && !this.paused,
        level: this.cnt ? Math.sqrt(this.sumSq / this.cnt) : 0,
        underruns: this.underruns, dropped: this.dropped,
      });
      this.sumSq = 0; this.cnt = 0;
    }
    return true;
  }
}
registerProcessor('tb-capture', TbCapture);
registerProcessor('tb-player', TbPlayer);
`;

const loaded = new WeakMap();

export async function loadWorklets(ctx) {
  if (!ctx.audioWorklet) throw new Error("This browser does not support live audio playback (AudioWorklet). Update the browser and try again.");
  if (!loaded.has(ctx)) {
    const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "application/javascript" }));
    loaded.set(ctx, ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url)));
  }
  return loaded.get(ctx);
}

export function createAudioContext() {
  const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctor) throw new Error("This browser does not support Web Audio.");
  return new Ctor({ latencyHint: "interactive" });
}

// Plays Int16 PCM frames with a jitter buffer. Create from a user gesture.
export class PcmPlayer {
  constructor(ctx, { inRate = WIRE_RATE, targetMs = 300, maxMs = 0, destination, onStats } = {}) {
    Object.assign(this, { ctx, inRate, targetMs, maxMs, destination: destination || ctx.destination, onStats, node: null, gain: null });
  }
  async init() {
    await loadWorklets(this.ctx);
    this.node = new AudioWorkletNode(this.ctx, "tb-player", {
      numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1],
      processorOptions: { inRate: this.inRate, targetMs: this.targetMs, maxMs: this.maxMs },
    });
    this.node.port.onmessage = (e) => this.onStats?.(e.data);
    this.gain = this.ctx.createGain();
    this.node.connect(this.gain).connect(this.destination);
    return this;
  }
  push(buffer) {
    if (!this.node || !buffer || buffer.byteLength < 2) return;
    const even = buffer.byteLength % 2 ? buffer.slice(0, buffer.byteLength - 1) : buffer;
    this.node.port.postMessage(even, [even]);
  }
  setVolume(v) { if (this.gain) this.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02); }
  setPaused(paused) { this.node?.port.postMessage({ type: "pause", paused }); }
  clear() { this.node?.port.postMessage({ type: "clear" }); }
  configure(cfg) { this.node?.port.postMessage({ type: "config", ...cfg }); }
  dispose() {
    try { this.node?.disconnect(); this.gain?.disconnect(); } catch { /* already disconnected */ }
    if (this.node) this.node.port.onmessage = null;
    this.node = null; this.gain = null;
  }
}

// Taps an AudioNode and emits 40 ms Int16 frames at 16 kHz.
export class PcmCapture {
  constructor(ctx, source, onFrame) { Object.assign(this, { ctx, source, onFrame, node: null, sink: null }); }
  async init() {
    await loadWorklets(this.ctx);
    this.node = new AudioWorkletNode(this.ctx, "tb-capture", {
      numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: "explicit",
      processorOptions: { outRate: WIRE_RATE, frameSamples: FRAME_SAMPLES },
    });
    this.node.port.onmessage = (e) => this.onFrame?.(e.data);
    // Anti-alias before decimating to 16 kHz so sibilants stay clean.
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 7200;
    this.filter.Q.value = 0.707;
    // The worklet must reach the destination to be pulled; keep it silent.
    this.sink = this.ctx.createGain();
    this.sink.gain.value = 0;
    this.source.connect(this.filter);
    this.filter.connect(this.node).connect(this.sink).connect(this.ctx.destination);
    return this;
  }
  setEnabled(enabled) { this.node?.port.postMessage({ enabled }); }
  dispose() {
    try { this.source.disconnect(this.filter); } catch { /* not connected */ }
    try { this.filter?.disconnect(); this.node?.disconnect(); this.sink?.disconnect(); } catch { /* already disconnected */ }
    if (this.node) this.node.port.onmessage = null;
    this.node = null; this.sink = null;
  }
}
