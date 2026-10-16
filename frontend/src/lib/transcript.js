// Timed transcript segments for subtitle export (SRT / WebVTT) and summaries.
// Kept only in this browser tab's memory.

const MAX_SEGMENTS = 5000;

export class SegmentRecorder {
  constructor(now = () => Date.now()) {
    this.now = now;
    this.reset();
  }
  reset() {
    this.t0 = null;
    this.segments = [];
    this.current = null;
  }
  begin() { if (this.t0 === null) this.t0 = this.now(); }
  delta(text) {
    if (!text) return;
    this.begin();
    if (!this.current) this.current = { start: this.now() - this.t0, end: 0, text: "" };
    this.current.text += text;
    this.current.end = this.now() - this.t0;
  }
  end() {
    if (!this.current) return;
    const seg = { ...this.current, text: this.current.text.trim() };
    seg.end = Math.max(seg.end, seg.start + 800);
    if (seg.text) this.segments.push(seg);
    if (this.segments.length > MAX_SEGMENTS) this.segments.shift();
    this.current = null;
  }
  // Include the segment still being spoken.
  all() {
    const live = this.current?.text.trim() ? [{ ...this.current, text: this.current.text.trim() }] : [];
    return [...this.segments, ...live];
  }
  text() { return this.all().map((s) => s.text).join("\n\n"); }
  get empty() { return this.all().length === 0; }
}

const pad = (n, w = 2) => String(n).padStart(w, "0");
function stamp(ms, sep) {
  const t = Math.max(0, Math.round(ms));
  const h = Math.floor(t / 3600000), m = Math.floor(t / 60000) % 60, s = Math.floor(t / 1000) % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(t % 1000, 3)}`;
}

// Long segments become several cues of ~2 lines so subtitles stay readable.
function cues(segments, maxChars = 84) {
  const out = [];
  for (const seg of segments) {
    const words = seg.text.split(/\s+/);
    const parts = [];
    let line = "";
    for (const w of words) {
      if ((line + " " + w).trim().length > maxChars && line) { parts.push(line.trim()); line = w; }
      else line += " " + w;
    }
    if (line.trim()) parts.push(line.trim());
    const span = Math.max(seg.end - seg.start, 800 * parts.length);
    const total = parts.reduce((a, p) => a + p.length, 0) || 1;
    let t = seg.start;
    for (const p of parts) {
      const d = span * (p.length / total);
      out.push({ start: t, end: t + d, text: p });
      t += d;
    }
  }
  return out;
}

export function toSRT(segments) {
  return cues(segments).map((c, i) => `${i + 1}\n${stamp(c.start, ",")} --> ${stamp(c.end, ",")}\n${c.text}\n`).join("\n");
}

export function toVTT(segments) {
  return "WEBVTT\n\n" + cues(segments).map((c) => `${stamp(c.start, ".")} --> ${stamp(c.end, ".")}\n${c.text}\n`).join("\n");
}

export function downloadText(filename, text, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
