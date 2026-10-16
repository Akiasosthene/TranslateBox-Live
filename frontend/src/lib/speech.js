import { operatorHeaders } from "./api";
import { createAudioContext, PcmPlayer } from "./pcmAudio";

// Studio voices: the realtime translation model picks its own timbre, so a
// fixed voice is produced by re-voicing the translated text sentence by
// sentence with OpenAI text-to-speech (24 kHz PCM, streamed).
export const STUDIO_VOICES = [
  { id: "marin", label: "Marin", hint: "Natural, warm · recommended" },
  { id: "cedar", label: "Cedar", hint: "Natural, deep · recommended" },
  { id: "coral", label: "Coral", hint: "Bright, friendly" },
  { id: "sage", label: "Sage", hint: "Calm, measured" },
  { id: "ash", label: "Ash", hint: "Clear, confident" },
  { id: "ballad", label: "Ballad", hint: "Soft, expressive" },
  { id: "verse", label: "Verse", hint: "Lively, expressive" },
  { id: "alloy", label: "Alloy", hint: "Neutral, balanced" },
  { id: "echo", label: "Echo", hint: "Steady, low" },
  { id: "shimmer", label: "Shimmer", hint: "Light, clear" },
  { id: "nova", label: "Nova", hint: "Warm, upbeat" },
  { id: "onyx", label: "Onyx", hint: "Deep, authoritative" },
  { id: "fable", label: "Fable", hint: "Storyteller" },
];

export const VOICE_STYLES = {
  interpreter: { label: "Interpreter", text: "Speak like a professional simultaneous interpreter: clear, natural, steady pace, warm but neutral. Never dramatize." },
  sermon: { label: "Sermon", text: "Speak with conviction and warmth, like an interpreter for a preacher. Keep emphasis and rhythm, stay clear and natural." },
  lecture: { label: "Lecture", text: "Speak calmly and precisely, like an interpreter at a scientific conference. Articulate numbers, names and technical terms." },
  gentle: { label: "Gentle", text: "Speak softly, slowly and reassuringly." },
};

export const PREVIEW_TEXT = {
  en: "Hello everyone, welcome. This is the voice you will hear for the translation.",
  fr: "Bonjour à tous et bienvenue. Voici la voix que vous entendrez pour la traduction.",
  es: "Hola a todos y bienvenidos. Esta es la voz que escucharán para la traducción.",
  pt: "Olá a todos e bem-vindos. Esta é a voz que vocês ouvirão na tradução.",
  de: "Hallo zusammen und willkommen. Das ist die Stimme, die Sie für die Übersetzung hören.",
  it: "Ciao a tutti e benvenuti. Questa è la voce che sentirete per la traduzione.",
  ru: "Здравствуйте и добро пожаловать. Этот голос вы услышите в переводе.",
  zh: "大家好，欢迎。这是您将在翻译中听到的声音。",
  ja: "皆さん、ようこそ。これが通訳で聞こえる声です。",
  ko: "여러분 안녕하세요. 통역에서 듣게 될 목소리입니다.",
  hi: "सभी का स्वागत है। अनुवाद में आप यही आवाज़ सुनेंगे।",
  id: "Halo semuanya, selamat datang. Ini adalah suara yang akan Anda dengar untuk terjemahan.",
  vi: "Xin chào và chào mừng mọi người. Đây là giọng bạn sẽ nghe trong bản dịch.",
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// "wrong => right" (or "wrong = right") per line replaces a term;
// "word =>" with nothing after it removes (blocks) the word. Applied to
// studio-voice speech and listener captions; the realtime voice itself
// cannot be edited.
export function parseGlossary(text) {
  return (text || "").split("\n").map((line) => {
    const m = line.match(/^\s*(.+?)\s*(=>|→|=)\s*(.*?)\s*$/);
    if (!m || (!m[3] && m[2] === "=")) return null;
    const from = m[1];
    const edge = (c) => (/[\p{L}\p{N}]/u.test(c) ? "(?<![\\p{L}\\p{N}])" : "");
    const tail = (c) => (/[\p{L}\p{N}]/u.test(c) ? "(?![\\p{L}\\p{N}])" : "");
    try {
      return { re: new RegExp(edge(from[0]) + escapeRe(from) + tail(from[from.length - 1]), "giu"), to: m[3] };
    } catch { return null; }
  }).filter(Boolean);
}

export function applyGlossary(text, rules) {
  if (!text || !rules?.length) return text;
  const out = rules.reduce((acc, r) => acc.replace(r.re, r.to), text);
  // Removing a blocked word can leave doubled spaces or a space before punctuation.
  return rules.some((r) => !r.to) ? out.replace(/[ \t]{2,}/g, " ").replace(/ ([,.;:!?])/g, "$1") : out;
}

// Split streaming translated text into speakable chunks.
const SENTENCE_END = /(?:[.!?…;]["»”')\]]*(?=\s)|[。！？])/gu;
const DENSE_SCRIPT = /[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/u;
export function takeSpeakable(buffer, { minChars = 12, maxChars = 220 } = {}) {
  // CJK packs more meaning per character, so short sentences are complete.
  if (DENSE_SCRIPT.test(buffer)) { minChars = Math.min(minChars, 5); maxChars = Math.min(maxChars, 90); }
  for (const m of buffer.matchAll(SENTENCE_END)) {
    const cut = m.index + m[0].length;
    if (cut >= minChars) return [buffer.slice(0, cut).trim(), buffer.slice(cut)];
  }
  if (buffer.length > maxChars) {
    const window = buffer.slice(0, maxChars);
    let cut = Math.max(window.lastIndexOf(", "), window.lastIndexOf("، "), window.lastIndexOf("，"));
    if (cut < minChars) cut = window.lastIndexOf(" ");
    if (cut < minChars) cut = maxChars;
    return [buffer.slice(0, cut + 1).trim(), buffer.slice(cut + 1)];
  }
  return [null, buffer];
}

async function streamPcm(response, onChunk, signal) {
  if (!response.body?.getReader) { onChunk(await response.arrayBuffer()); return; }
  const reader = response.body.getReader();
  let carry = null;
  while (true) {
    if (signal?.aborted) { reader.cancel().catch(() => {}); return; }
    const { done, value } = await reader.read();
    if (done) break;
    let bytes = value;
    if (carry) { const merged = new Uint8Array(carry.length + bytes.length); merged.set(carry); merged.set(bytes, carry.length); bytes = merged; carry = null; }
    const even = bytes.length - (bytes.length % 2);
    if (even < bytes.length) carry = bytes.slice(even);
    if (even) onChunk(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + even));
  }
}

async function ttsRequest(apiBase, { text, voice, style }, signal) {
  const res = await fetch(`${apiBase}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...operatorHeaders() },
    body: JSON.stringify({ text, voice, style }),
    signal,
  });
  if (!res.ok) {
    let detail = "Studio voice unavailable.";
    try { detail = (await res.json()).detail || detail; } catch { /* non-JSON */ }
    throw new Error(detail);
  }
  return res;
}

export class SpeechPipeline {
  constructor({ apiBase, onAudio, onLog, onError, onSpoken } = {}) {
    Object.assign(this, { apiBase, onAudio, onLog: onLog || (() => {}), onError: onError || (() => {}), onSpoken: onSpoken || (() => {}) });
    this.voice = "marin";
    this.style = VOICE_STYLES.interpreter.text;
    this.rules = [];
    this.enabled = false;
    this.buffer = "";
    this.chain = Promise.resolve();
    this.controller = new AbortController();
    this.failures = 0;
  }

  configure({ voice, style, glossary, enabled }) {
    if (voice) this.voice = voice;
    if (style !== undefined) this.style = style;
    if (glossary !== undefined) this.rules = parseGlossary(glossary);
    if (enabled !== undefined) {
      if (this.enabled && !enabled) this.reset();
      this.enabled = enabled;
    }
  }

  feed(delta) {
    if (!this.enabled || !delta) return;
    this.buffer += delta;
    for (;;) {
      const [chunk, rest] = takeSpeakable(this.buffer);
      if (!chunk) break;
      this.buffer = rest;
      this._speak(chunk);
    }
  }

  endSegment() {
    if (!this.enabled) return;
    const rest = this.buffer.trim();
    this.buffer = "";
    if (rest) this._speak(rest);
  }

  reset() {
    this.controller.abort();
    this.controller = new AbortController();
    this.buffer = "";
    this.chain = Promise.resolve();
  }

  _speak(raw) {
    const text = applyGlossary(raw, this.rules).slice(0, 1200);
    if (!/[\p{L}\p{N}]/u.test(text)) return;
    const { signal } = this.controller;
    const started = performance.now();
    // Start the request now so it overlaps playback of earlier sentences;
    // the chain keeps audio in speaking order.
    const pending = ttsRequest(this.apiBase, { text, voice: this.voice, style: this.style }, signal);
    pending.catch(() => {});
    this.chain = this.chain.then(async () => {
      if (signal.aborted) return;
      try {
        const res = await pending;
        let first = true;
        await streamPcm(res, (buf) => {
          if (signal.aborted) return;
          if (first) { first = false; this.onLog("debug", "Studio voice first audio", { ms: Math.round(performance.now() - started), chars: text.length }); }
          this.onAudio?.(buf);
        }, signal);
        this.failures = 0;
        this.onSpoken(text);
      } catch (e) {
        if (signal.aborted || e.name === "AbortError") return;
        this.failures += 1;
        this.onLog("warn", "Studio voice sentence failed: " + e.message);
        if (this.failures >= 3) this.onError(e.message + " Switch back to the translation voice if the problem persists.");
      }
    });
  }
}

// Whole sentence as 24 kHz PCM16 (used for dubbing).
export async function synthesize(apiBase, { text, voice, style }, signal) {
  const res = await ttsRequest(apiBase, { text, voice, style }, signal);
  const parts = [];
  await streamPcm(res, (buf) => parts.push(new Int16Array(buf)), signal);
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Int16Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// One-off voice sample for the operator only (never broadcast).
let previewCtx = null;
export async function previewVoice(apiBase, { voice, style, lang }) {
  previewCtx = previewCtx || createAudioContext();
  if (previewCtx.state === "suspended") await previewCtx.resume();
  const player = await new PcmPlayer(previewCtx, { inRate: 24000, targetMs: 150 }).init();
  const res = await ttsRequest(apiBase, { text: PREVIEW_TEXT[lang] || PREVIEW_TEXT.en, voice, style });
  await streamPcm(res, (buf) => player.push(buf));
  setTimeout(() => player.dispose(), 9000);
}
