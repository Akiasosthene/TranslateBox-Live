import { test, expect, vi } from 'vitest';
import { takeSpeakable, parseGlossary, applyGlossary, SpeechPipeline } from './speech';

test('splits on sentence ends once long enough', () => {
  expect(takeSpeakable('Yes. I think so. And then')).toEqual(['Yes. I think so.', ' And then']);
  expect(takeSpeakable('Hello')).toEqual([null, 'Hello']);
  expect(takeSpeakable('今日はいい天気です。明日も')).toEqual(['今日はいい天気です。', '明日も']);
});

test('long text without punctuation is cut at a comma', () => {
  const text = 'a'.repeat(100) + ', ' + 'b'.repeat(150);
  const [chunk, rest] = takeSpeakable(text);
  expect(chunk).toBe('a'.repeat(100) + ',');
  expect(rest.trim()).toBe('b'.repeat(150));
});

test('glossary replaces whole words, case-insensitively', () => {
  const rules = parseGlossary('Monkton => Moncton\nDFO = Fisheries and Oceans Canada\nnot a rule');
  expect(rules).toHaveLength(2);
  expect(applyGlossary('Welcome to monkton, says DFO.', rules)).toBe('Welcome to Moncton, says Fisheries and Oceans Canada.');
  expect(applyGlossary('DFOX stays', rules)).toBe('DFOX stays');
});

test('pipeline speaks sentences in order and only when enabled', async () => {
  const chunks = [];
  vi.stubGlobal('fetch', vi.fn(async (_url, opts) => {
    const text = JSON.parse(opts.body).text;
    return { ok: true, arrayBuffer: async () => new TextEncoder().encode(text.length % 2 ? text + ' ' : text).buffer };
  }));
  try {
    const p = new SpeechPipeline({ apiBase: '/api', onAudio: (b) => chunks.push(new TextDecoder().decode(b).trim()) });
    p.feed('Ignored while disabled. ');
    p.configure({ enabled: true, glossary: 'Monkton => Moncton' });
    p.feed('Welcome to Monkton everyone. Second');
    p.feed(' sentence here.');
    p.endSegment();
    await p.chain;
    expect(chunks).toEqual(['Welcome to Moncton everyone.', 'Second sentence here.']);
    expect(JSON.parse(fetch.mock.calls[0][1].body).voice).toBe('marin');
  } finally { vi.unstubAllGlobals(); }
});

test('an empty right-hand side blocks a word', () => {
  const rules = parseGlossary('darn =>\nfoo = ');
  expect(rules).toHaveLength(1);
  expect(applyGlossary('Well darn, that is it.', rules)).toBe('Well, that is it.');
});

test('glossary sections, sounds-like, boost terms and symbols', () => {
  const g = parseGlossary('[fr]\nMonkton -> Moncton\n[*]\nPorsche <porch, porsha>\nDFO => Pêches et Océans\ndarn ->\nC++ -> CPP\nBMH !!\n# comment');
  expect(g.boost).toEqual(['Porsche', 'BMH']);
  expect(applyGlossary('In monkton the porch, DFO said darn, C++ rocks.', g, 'fr')).toBe('In Moncton the Porsche, Pêches et Océans said, CPP rocks.');
  expect(applyGlossary('In monkton the porch.', g, 'en')).toBe('In monkton the Porsche.');
});

test('3000-term glossaries stay fast (single pass)', () => {
  const g = parseGlossary(Array.from({ length: 3000 }, (_, i) => `term${i} -> T${i}`).join('\n'));
  const text = 'hello term2999 and term5 '.repeat(200);
  const t = performance.now();
  for (let i = 0; i < 50; i++) applyGlossary(text, g, 'fr');
  expect(applyGlossary('term2999 term5 term50', g)).toBe('T2999 T5 T50');
  expect(performance.now() - t).toBeLessThan(400);
});
