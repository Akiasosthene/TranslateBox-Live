import { operatorFetch } from "./api";

// Sends finished caption lines to meeting platforms through the backend
// (/api/caption-relay): Zoom "API token" closed captions and Teams CART.
// Links contain meeting secrets, so they live only in this tab's memory.
export const RELAY_PROVIDERS = {
  zoom: { label: "Zoom", hint: "Zoom → Captions → Set up manual captioner → Copy API token" },
  teams: { label: "Microsoft Teams", hint: "Meeting options → Provide CART captions → Copy link" },
};

const LOCALES = { en: "en-US", fr: "fr-FR", es: "es-ES", pt: "pt-BR", de: "de-DE", it: "it-IT", ru: "ru-RU", zh: "zh-CN", ja: "ja-JP", ko: "ko-KR", hi: "hi-IN", id: "id-ID", vi: "vi-VN" };
export const localeFor = (lang) => LOCALES[lang] || "en-US";

// Each POST becomes one caption line; keep lines short (Teams: 80–120 chars).
export function splitLines(text, max = 110) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    if (!w) continue;
    if ((line + " " + w).trim().length > max && line) { lines.push(line); line = w; }
    else line = (line + " " + w).trim();
  }
  if (line) lines.push(line);
  return lines;
}

export class CaptionRelay {
  constructor({ apiBase, onChange = () => {} }) {
    this.apiBase = apiBase;
    this.onChange = onChange;
    this.destinations = [];
    this.nextId = 1;
  }
  add({ provider, url, lang }) {
    const d = { id: this.nextId++, provider, url: url.trim(), lang, seq: 0, sent: 0, error: "", chain: Promise.resolve() };
    this.destinations.push(d);
    this._emit();
    return d.id;
  }
  remove(id) { this.destinations = this.destinations.filter((d) => d.id !== id); this._emit(); }
  list() { return this.destinations.map(({ id, provider, lang, sent, error }) => ({ id, provider, lang, sent, error })); }
  _emit() { this.onChange(this.list()); }

  push(lang, text) {
    if (!text?.trim()) return;
    for (const d of this.destinations.filter((x) => x.lang === lang)) {
      for (const line of splitLines(text)) {
        d.chain = d.chain.then(() => this._send(d, line));
      }
    }
  }

  async _send(d, text) {
    if (!this.destinations.includes(d)) return;
    try {
      const res = await operatorFetch(`${this.apiBase}/caption-relay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: d.provider, url: d.url, text, lang: localeFor(d.lang), seq: d.seq++ }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) d.error = body.detail || `Error ${res.status}`;
      else if (!body.ok) d.error = body.status === 404 ? "Meeting not started or captions not enabled." : body.status === 401 ? "Link expired: copy a new one." : `${RELAY_PROVIDERS[d.provider].label} answered ${body.status}.`;
      else { d.error = ""; d.sent += 1; }
    } catch { d.error = "Network error."; }
    this._emit();
  }
}
