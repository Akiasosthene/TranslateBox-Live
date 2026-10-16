import { test, expect, vi } from 'vitest';
vi.mock('./speech', async (orig) => ({ ...(await orig()), synthesize: vi.fn(async (_api, { text }) => new Int16Array(text.length * 2400).fill(1000)) }));
import { dubSegments } from './dubbing';
const read = (blob) => new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsArrayBuffer(blob); });

test('places voiced segments at their start times without overlap', async () => {
  const progress = [];
  const blob = await dubSegments({ apiBase: '/api', segments: [{ start: 0, end: 500, text: 'Hi' }, { start: 100, end: 900, text: 'Again' }, { start: 5000, end: 6000, text: 'Late' }], voice: 'marin', rules: [], onProgress: (p) => progress.push(p) });
  expect(blob.type).toBe('audio/wav');
  const raw = await read(blob);
  const buf = new DataView(raw);
  expect(String.fromCharCode(buf.getUint8(0), buf.getUint8(1), buf.getUint8(2), buf.getUint8(3))).toBe('RIFF');
  expect(buf.getUint32(24, true)).toBe(24000);
  const samples = new Int16Array(raw.slice(44));
  // "Hi" = 4800 samples from 0; "Again" pushed after it (+150 ms gap); "Late" at 5 s.
  expect(samples[0]).toBe(1000);
  expect(samples[4800 + 100]).toBe(0);
  expect(samples[4800 + 3600]).toBe(1000);
  expect(samples[5 * 24000 + 10]).toBe(1000);
  expect(progress.at(-1)).toBe(1);
});
