import { synthesize, applyGlossary } from "./speech";

const RATE = 24000;

// Builds a translated voice track (WAV, 24 kHz mono) aligned to the timed
// transcript: each segment is voiced with the studio voice and placed at its
// original start time, or right after the previous one if speech runs long.
export async function dubSegments({ apiBase, segments, voice, style, rules, lang = "*", onProgress = () => {}, signal }) {
  const placed = [];
  let cursor = 0;
  for (let i = 0; i < segments.length; i++) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const seg = segments[i];
    const text = applyGlossary(seg.text, rules, lang).slice(0, 1200);
    if (!/[\p{L}\p{N}]/u.test(text)) continue;
    const pcm = await synthesize(apiBase, { text, voice, style }, signal);
    const at = Math.max(Math.round((seg.start / 1000) * RATE), cursor);
    placed.push({ at, pcm });
    cursor = at + pcm.length + Math.round(RATE * 0.15);
    onProgress((i + 1) / segments.length);
  }
  const total = cursor + RATE / 2;
  const samples = new Int16Array(total);
  for (const { at, pcm } of placed) samples.set(pcm.subarray(0, Math.max(0, total - at)), at);
  return wavBlob(samples, RATE);
}

export function wavBlob(samples, rate) {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  const bytes = samples.length * 2;
  str(0, "RIFF"); v.setUint32(4, 36 + bytes, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, bytes, true);
  return new Blob([header, samples.buffer], { type: "audio/wav" });
}
