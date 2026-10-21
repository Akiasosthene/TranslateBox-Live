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
  sermon: { label: "Keynote", text: "Speak with conviction and warmth, like an interpreter for a keynote speaker. Keep emphasis and rhythm, stay clear and natural." },
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

// Glossary (Wordly-compatible syntax, plus ours). One rule per line:
//   [fr]                  section: following rules apply to French only ([*] = all)
//   wrong -> right        replace (also =>, → or =)
//   word ->               block: remove the word
//   Term <sound, alike>   "sounds like": these spellings become Term
//   Term !!               preferred term (sent to the model as vocabulary)
// Applied to captions, the room screen, transcripts and the studio voice.
// The realtime voice itself cannot be edited.
const WORDY = /^[\p{L}\p{N}].*[\p{L}\p{N}]$|^[\p{L}\p{N}]$/u;

const TOKEN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
const phraseKey = (str) => (str.match(TOKEN) || []).join(" ").toLowerCase();

// Word-based terms use a phrase lookup (fast with thousands of terms);
// terms with symbols (C++, R&D…) use one combined regular expression.
function compileEntries(entries) {
  const phrases = new Map();
  const other = new Map();
  let maxWords = 1;
  for (const e of entries) {
    if (WORDY.test(e.from) && phraseKey(e.from)) {
      const key = phraseKey(e.from);
      phrases.set(key, e.to);
      maxWords = Math.max(maxWords, key.split(" ").length);
    } else other.set(e.from.toLowerCase(), e.to);
  }
  const otherRe = other.size ? new RegExp(`(?:${[...other.keys()].sort((a, b) => b.length - a.length).map(escapeRe).join("|")})`, "giu") : null;
  return { phrases, maxWords, other, otherRe };
}

function applyCompiled(text, c) {
  let out = text;
  if (c.phrases.size) {
    const tokens = [...out.matchAll(TOKEN)].map((m) => ({ s: m.index, e: m.index + m[0].length, w: m[0].toLowerCase() }));
    const parts = [];
    let cursor = 0;
    for (let i = 0; i < tokens.length; i++) {
      let hit = null;
      for (let n = Math.min(c.maxWords, tokens.length - i); n >= 1 && !hit; n--) {
        const last = tokens[i + n - 1];
        let ok = true;
        for (let k = i; k < i + n - 1; k++) if (!/^\s+$/.test(out.slice(tokens[k].e, tokens[k + 1].s))) { ok = false; break; }
        if (!ok) continue;
        const key = n === 1 ? tokens[i].w : tokens.slice(i, i + n).map((t) => t.w).join(" ");
        if (c.phrases.has(key)) hit = { n, end: last.e, to: c.phrases.get(key) };
      }
      if (hit) {
        parts.push(out.slice(cursor, tokens[i].s), hit.to);
        cursor = hit.end;
        i += hit.n - 1;
      }
    }
    parts.push(out.slice(cursor));
    out = parts.join("");
  }
  if (c.otherRe) out = out.replace(c.otherRe, (m) => c.other.get(m.toLowerCase()) ?? m);
  return out;
}

function makeGlossary(entries, boost) {
  const cache = new Map();
  const hasBlock = entries.some((e) => !e.to);
  return {
    entries, boost, length: entries.length,
    apply(text, lang = "*") {
      if (!text || !entries.length) return text;
      const key = lang || "*";
      if (!cache.has(key)) cache.set(key, compileEntries(entries.filter((e) => e.lang === "*" || e.lang === key)));
      const out = applyCompiled(text, cache.get(key));
      return hasBlock ? out.replace(/[ \t]{2,}/g, " ").replace(/ ([,.;:!?])/g, "$1") : out;
    },
  };
}

export function parseGlossary(text) {
  const entries = [];
  const boost = [];
  let section = "*";
  for (const raw of (text || "").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const sec = line.match(/^\[([a-z]{2,3}|\*)\]$/i);
    if (sec) { section = sec[1].toLowerCase(); continue; }
    const sounds = line.match(/^(.+?)\s*<([^>]+)>\s*!*$/);
    if (sounds) {
      const term = sounds[1].trim();
      for (const alias of sounds[2].split(",").map((a) => a.trim()).filter(Boolean)) entries.push({ from: alias, to: term, lang: section });
      boost.push(term);
      continue;
    }
    const rule = line.match(/^(.+?)\s*(->|=>|→|=)\s*(.*?)$/);
    if (rule) {
      if (!rule[3] && rule[2] === "=") continue;
      entries.push({ from: rule[1].trim(), to: rule[3], lang: section });
      continue;
    }
    boost.push(line.replace(/\s*!+$/, ""));
  }
  return makeGlossary(entries, boost.slice(0, 3000));
}

export function applyGlossary(text, rules, lang = "*") {
  if (!text || !rules) return text;
  if (typeof rules.apply === "function") return rules.apply(text, lang);
  return text;
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

async function ttsRequest(apiBase, { text, voice, style, lang }, signal) {
  const res = await fetch(`${apiBase}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...operatorHeaders() },
    body: JSON.stringify({ text, voice, style, lang }),
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
    this.rules = null;
    this.lang = "*";
    this.enabled = false;
    this.buffer = "";
    this.chain = Promise.resolve();
    this.controller = new AbortController();
    this.failures = 0;
  }

  configure({ voice, style, glossary, enabled, lang }) {
    if (lang) this.lang = lang;
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
    const text = applyGlossary(raw, this.rules, this.lang).slice(0, 1200);
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
  const res = await ttsRequest(apiBase, { text: PREVIEW_TEXT[lang] || PREVIEW_TEXT.en, voice, style, lang });
  await streamPcm(res, (buf) => player.push(buf));
  setTimeout(() => player.dispose(), 9000);
}
