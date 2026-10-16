import { test, expect } from 'vitest';
import { SegmentRecorder, toSRT, toVTT } from './transcript';

test('records timed segments and exports SRT and WebVTT', () => {
  let now = 1000;
  const rec = new SegmentRecorder(() => now);
  rec.delta('Hello '); now = 2500; rec.delta('everyone.'); now = 3000; rec.end();
  now = 4000; rec.delta('Welcome');
  expect(rec.all().map(s => s.text)).toEqual(['Hello everyone.', 'Welcome']);
  const srt = toSRT(rec.all());
  expect(srt.startsWith('1\n00:00:00,000 --> 00:00:01,500\nHello everyone.\n')).toBe(true);
  expect(srt).toContain('2\n00:00:03,000 --> ');
  expect(toVTT(rec.all()).startsWith('WEBVTT\n\n00:00:00.000 --> 00:00:01.500\nHello everyone.')).toBe(true);
});

test('long segments are split into readable cues', () => {
  const words = Array.from({length: 60}, (_, i) => `word${i}`).join(' ');
  const cues = toSRT([{start: 0, end: 20000, text: words}]).trim().split('\n\n');
  expect(cues.length).toBeGreaterThan(3);
  for (const cue of cues) expect(cue.split('\n')[2].length).toBeLessThanOrEqual(84);
});
