import { test, expect, vi } from 'vitest';
vi.mock('./api', () => ({ operatorFetch: vi.fn() }));
import { operatorFetch } from './api';
import { CaptionRelay, splitLines, localeFor } from './captionRelay';

test('splits long sentences into short caption lines', () => {
  const lines = splitLines('word '.repeat(60));
  expect(lines.length).toBeGreaterThan(1);
  lines.forEach((l) => expect(l.length).toBeLessThanOrEqual(110));
  expect(localeFor('fr')).toBe('fr-FR');
});

test('sends lines in order with increasing seq, per language', async () => {
  operatorFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true, status: 200 }) });
  const changes = [];
  const relay = new CaptionRelay({ apiBase: '/api', onChange: (l) => changes.push(l) });
  relay.add({ provider: 'zoom', url: 'https://wmcc.zoom.us/closedcaption?id=1', lang: 'fr' });
  relay.add({ provider: 'teams', url: 'https://api.captions.office.microsoft.com/cartcaption?meetingid=1&token=2', lang: 'es' });
  relay.push('fr', 'Bonjour à tous.');
  relay.push('fr', 'Deuxième phrase.');
  relay.push('de', 'Ignored');
  await relay.destinations[0].chain;
  const bodies = operatorFetch.mock.calls.map((c) => JSON.parse(c[1].body));
  expect(bodies.map((b) => [b.text, b.seq, b.lang, b.provider])).toEqual([['Bonjour à tous.', 0, 'fr-FR', 'zoom'], ['Deuxième phrase.', 1, 'fr-FR', 'zoom']]);
  expect(changes.at(-1)[0].sent).toBe(2);
});

test('reports a meeting that is not started', async () => {
  operatorFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: false, status: 404 }) });
  const relay = new CaptionRelay({ apiBase: '/api' });
  relay.add({ provider: 'teams', url: 'https://api.captions.office.microsoft.com/cartcaption?meetingid=1&token=2', lang: 'en' });
  relay.push('en', 'Hello');
  await relay.destinations[0].chain;
  expect(relay.list()[0].error).toMatch(/not started/);
});
