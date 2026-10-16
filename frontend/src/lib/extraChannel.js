import { TranslationEngine } from "./translationEngine";
import { SpeechPipeline, applyGlossary, parseGlossary } from "./speech";
import { OperatorBroadcaster, WS_BASE } from "./broadcast";
import { SegmentRecorder } from "./transcript";

// One additional output language for a multi-language event: its own OpenAI
// translation session (same microphone), its own studio voice and its own
// listener channel. The operator does not monitor it; listeners pick it.
export class ExtraChannel {
  constructor({ apiBase, lang, onChange = () => {}, onError = () => {}, onSegment = () => {} }) {
    this.lang = lang;
    this.onChange = onChange;
    this.onError = onError;
    this.onSegment = onSegment;
    this.segmentText = "";
    this.state = "idle";
    this.listeners = 0;
    this.text = "";
    this.captions = false;
    this.rules = null;
    this.speaker = "";
    this.labelled = "";
    this.recorder = new SegmentRecorder();
    this.speech = new SpeechPipeline({
      apiBase,
      onAudio: (buf) => this.engine.program.pushSpeech(buf),
      onError: (msg) => this.onError(`${lang.toUpperCase()}: ${msg}`),
    });
    this.engine = new TranslationEngine({
      apiBase,
      handlers: {
        onTranscript: ({ side, delta, segmentBreak }) => {
          if (side !== "target") return;
          if (segmentBreak) {
            this.speech.endSegment();
            this.recorder.end();
            if (this.segmentText.trim()) this.onSegment(this.lang, applyGlossary(this.segmentText.trim(), this.rules, this.lang));
            this.segmentText = "";
            if (this.text && !this.text.endsWith("\n\n")) this.text += "\n\n";
          } else {
            this.speech.feed(delta);
            this.recorder.delta(delta, this.speaker || null);
            let shown = delta || "";
            if (shown && !this.segmentText && this.speaker && this.labelled !== this.speaker) { this.labelled = this.speaker; shown = `${this.speaker}: ${shown}`; }
            this.segmentText += delta || "";
            this.text = (this.text + shown).slice(-20000);
          }
          this._sendCaption();
          this._emit();
        },
        onError: (msg) => { if (msg && !String(msg).startsWith("RECONNECTING")) this.onError(`${lang.toUpperCase()}: ${msg}`); },
        onStatus: (patch) => {
          if (patch.openai === "connected" && this.state === "starting") this._set("live");
          if (patch.openai === "error") this._set("error");
        },
      },
    });
    this.broadcaster = null;
  }

  _emit() { this.onChange(this); }
  _set(state) { this.state = state; this._emit(); }

  configure({ voiceMode, voice, voiceLabel, style, glossary, captions }) {
    this.engine.program.setVoiceMode(voiceMode);
    this.speech.configure({ enabled: voiceMode === "studio", voice, style, glossary, lang: this.lang });
    this.rules = parseGlossary(glossary);
    this.meta = voiceMode === "studio" ? { mode: "studio", voice: voiceLabel || voice } : { mode: "original", voice: null };
    this.broadcaster?.sendMeta(this.meta);
    if (captions !== undefined) { this.captions = captions; this._sendCaption(); }
  }

  _sendCaption() {
    this.broadcaster?.sendCaption(this.captions ? applyGlossary(this.text, this.rules, this.lang) : "");
  }

  async start({ event, deviceId, instructions, ambient }) {
    this._set("starting");
    this.text = "";
    this.labelled = "";
    this.recorder.reset();
    await this.engine.start({ deviceId, targetLanguage: this.lang, instructions, ambient });
    if (!this.engine.active) throw new Error("cancelled");
    await this.engine.programReady;
    const b = new OperatorBroadcaster(`${WS_BASE}/api/ws/${event.id}?role=operator&lang=${encodeURIComponent(this.lang)}`, {
      token: event.operator_token,
      onCount: (count) => { this.listeners = count; this._emit(); },
      onStatus: (status) => { if (status.error) { this.onError(`${this.lang.toUpperCase()}: ${status.error}`); this._set("error"); } },
    });
    this.broadcaster = b;
    await b.start(this.engine.program);
    b.sendMeta(this.meta || {});
    this._sendCaption();
    if (this.state === "starting") this._set(this.engine.pc ? "live" : "starting");
  }

  setSpeaker(name) { this.speaker = name || ""; }

  setInputMuted(muted) { this.engine.setInputMuted(muted); }

  stop() {
    this.broadcaster?.stop();
    this.broadcaster = null;
    this.speech.reset();
    this.recorder.end();
    this.engine.stop();
    this.listeners = 0;
    this._set("idle");
  }
}
