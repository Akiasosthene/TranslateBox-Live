import { createAudioContext, PcmPlayer } from "./pcmAudio";

// The operator's "program" output: what listeners hear and the operator
// monitors. It mixes the OpenAI translated voice ("original") with the studio
// voice synthesized sentence by sentence (TTS, 24 kHz PCM). Only one of the two
// is audible at a time, selected by the voice mode.
export class ProgramBus {
  constructor({ onLog } = {}) {
    this.onLog = onLog || (() => {});
    this.ctx = null;
    this.voiceMode = "original";
    this.monitorEl = null;
    this.remote = null;
    this.remoteSrc = null;
    this.remoteKeeper = null;
    this._ready = null;
  }

  ensure() {
    if (this._ready) return this._ready;
    this._ready = (async () => {
      const ctx = this.ctx = createAudioContext();
      if (ctx.state === "suspended") await ctx.resume().catch(() => {});
      this.bus = ctx.createGain();
      // Gentle compression evens out level jumps between sentences and voices.
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -20;
      this.comp.ratio.value = 3;
      this.comp.attack.value = 0.005;
      this.comp.release.value = 0.2;
      this.bus.connect(this.comp);
      this.original = ctx.createGain();
      this.original.connect(this.bus);
      this.speechGain = ctx.createGain();
      this.speechGain.connect(this.bus);
      this.dest = ctx.createMediaStreamDestination();
      this.comp.connect(this.dest);
      this.speech = await new PcmPlayer(ctx, { inRate: 24000, targetMs: 120, maxMs: 0, destination: this.speechGain }).init();
      this._applyMode();
      if (this.monitorEl) this._attachMonitor();
      if (this.remote) this._connectRemote(this.remote);
      this.onLog("info", "Program audio bus ready", { sampleRate: ctx.sampleRate });
    })().catch((e) => { this._ready = null; throw e; });
    return this._ready;
  }

  // The node listeners are fed from.
  get output() { return this.comp; }
  get hasSource() { return !!this.remoteSrc || this.voiceMode === "studio"; }

  attachMonitor(el) {
    this.monitorEl = el;
    if (this.dest) this._attachMonitor();
  }

  _attachMonitor() {
    if (!this.monitorEl) return;
    if (this.monitorEl.srcObject !== this.dest.stream) this.monitorEl.srcObject = this.dest.stream;
    this.monitorEl.play?.().catch(() => {});
  }

  setRemoteStream(stream) {
    this.remote = stream || null;
    if (this.remoteSrc) { try { this.remoteSrc.disconnect(); } catch { /* gone */ } this.remoteSrc = null; }
    if (this.remoteKeeper) { this.remoteKeeper.srcObject = null; this.remoteKeeper = null; }
    if (stream && this.original) this._connectRemote(stream);
  }

  _connectRemote(stream) {
    // Chrome only renders a remote WebRTC stream into Web Audio while a media
    // element is also consuming it. A muted element is enough.
    const keeper = new Audio();
    keeper.muted = true;
    keeper.srcObject = stream;
    keeper.play?.().catch(() => {});
    this.remoteKeeper = keeper;
    this.remoteSrc = this.ctx.createMediaStreamSource(stream);
    this.remoteSrc.connect(this.original);
  }

  setVoiceMode(mode) {
    this.voiceMode = mode === "studio" ? "studio" : "original";
    this._applyMode();
  }

  _applyMode() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const studio = this.voiceMode === "studio";
    this.original.gain.setTargetAtTime(studio ? 0 : 1, t, 0.05);
    this.speechGain.gain.setTargetAtTime(studio ? 1 : 0, t, 0.05);
    if (!studio) this.speech?.clear();
  }

  pushSpeech(buffer) { this.speech?.push(buffer); }
  clearSpeech() { this.speech?.clear(); }
}
