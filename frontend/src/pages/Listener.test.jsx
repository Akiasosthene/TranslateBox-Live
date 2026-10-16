import React from 'react';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const players = [];
vi.mock('../lib/pcmAudio', () => ({
  WIRE_RATE: 16000,
  createAudioContext: vi.fn(() => ({ resume: vi.fn().mockResolvedValue(), close: vi.fn().mockResolvedValue() })),
  PcmPlayer: class {
    constructor(_ctx, opts) { this.opts = opts; this.push = vi.fn(); this.clear = vi.fn(); this.setPaused = vi.fn(); this.setVolume = vi.fn(); this.dispose = vi.fn(); players.push(this); }
    async init() { return this; }
  },
}));

import Listener from './Listener';

let sockets;
beforeEach(() => {
  sockets = []; players.length = 0;
  global.fetch = vi.fn().mockResolvedValue({ok: true, json: async () => ({name: 'Test event', target: 'fr', pin_protected: false, live: true})});
  global.WebSocket = class { constructor() { sockets.push(this); } close = vi.fn(); send = vi.fn(); };
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const renderPage = () => render(<MemoryRouter initialEntries={['/e/test']}><Routes><Route path="/e/:id" element={<Listener/>}/></Routes></MemoryRouter>);
const listen = async () => { await act(async () => { fireEvent.click(screen.getByText('LISTEN')); }); };

test('plays PCM frames through the jitter-buffered player', async () => {
  renderPage();
  await screen.findByText('Test event');
  expect(screen.getAllByText('Français').length).toBeGreaterThan(0);
  await listen();
  expect(players).toHaveLength(1);
  expect(players[0].opts).toMatchObject({ inRate: 16000, targetMs: 350, maxMs: 2500 });
  act(() => sockets[0].onopen());
  expect(sockets[0].send).toHaveBeenCalledWith(JSON.stringify({type: 'auth', pin: null}));
  act(() => sockets[0].onmessage({data: JSON.stringify({type: 'status', live: true, format: 'pcm16', rate: 16000, meta: {mode: 'studio', voice: 'Marin'}})}));
  const frame = new ArrayBuffer(1280);
  act(() => sockets[0].onmessage({data: frame}));
  expect(players[0].push).toHaveBeenCalledWith(frame);
  expect(screen.getByTestId('listener-ai-voice').textContent).toContain('Marin');
});

test('reconnects with backoff and stop cancels retry', async () => {
  renderPage();
  await screen.findByText('Test event');
  vi.useFakeTimers();
  await listen();
  expect(sockets.length).toBe(1);
  act(() => sockets[0].onclose({code: 1006}));
  act(() => vi.advanceTimersByTime(1000));
  expect(sockets.length).toBe(2);
  act(() => sockets[1].onclose({code: 1006}));
  act(() => vi.advanceTimersByTime(1500));
  expect(sockets.length).toBe(2);
  act(() => vi.advanceTimersByTime(600));
  expect(sockets.length).toBe(3);
  act(() => sockets[2].onclose({code: 1006}));
  fireEvent.click(screen.getByText('Stop'));
  act(() => vi.advanceTimersByTime(10000));
  expect(sockets.length).toBe(3);
  expect(players[0].dispose).toHaveBeenCalled();
});

test('status reflects buffering, playback and reconnection; captions resize without reconnecting', async () => {
  renderPage();
  await screen.findByText('Test event');
  await listen();
  act(() => sockets[0].onmessage({data: JSON.stringify({type: 'status', live: true, format: 'pcm16'})}));
  expect(screen.getByTestId('listener-status').textContent).toContain('Buffering audio');
  act(() => players[0].opts.onStats({playing: true, level: 0.1}));
  expect(screen.getByTestId('listener-status').textContent).toContain('Translation playing');
  act(() => sockets[0].onmessage({data: JSON.stringify({type: 'caption', text: 'Bonjour à tous'})}));
  fireEvent.change(screen.getByLabelText('Caption size'), {target: {value: '32'}});
  expect(screen.getByTestId('listener-caption').style.fontSize).toBe('32px');
  expect(sockets.length).toBe(1);
  act(() => sockets[0].onclose({code: 1006}));
  expect(screen.getByTestId('listener-status').textContent).toContain('Reconnecting');
  expect(players[0].clear).toHaveBeenCalled();
});

test('pause stops output and resumes from live', async () => {
  renderPage();
  await screen.findByText('Test event');
  await listen();
  fireEvent.click(screen.getByRole('button', {name: 'Pause audio'}));
  expect(players[0].setPaused).toHaveBeenLastCalledWith(true);
  expect(screen.getByTestId('listener-status').textContent).toContain('Audio paused');
  fireEvent.click(screen.getByRole('button', {name: 'Play audio'}));
  expect(players[0].setPaused).toHaveBeenLastCalledWith(false);
  expect(sockets.length).toBe(1);
});

test('wrong PIN stops retrying and asks for the PIN', async () => {
  renderPage();
  await screen.findByText('Test event');
  vi.useFakeTimers();
  await listen();
  act(() => sockets[0].onclose({code: 4401}));
  act(() => vi.advanceTimersByTime(10000));
  expect(sockets.length).toBe(1);
  expect(screen.getByTestId('listener-error').textContent).toContain('Incorrect PIN');
  expect(screen.getByTestId('listener-pin-input')).toBeTruthy();
});

test('multi-language event lets the listener pick and switch language', async () => {
  global.fetch = vi.fn().mockResolvedValue({ok: true, json: async () => ({name: 'Test event', target: 'fr', targets: ['fr', 'es'], pin_protected: false, live: true})});
  global.WebSocket = class { constructor(url) { this.url = url; sockets.push(this); } close = vi.fn(); send = vi.fn(); };
  renderPage();
  await screen.findByText('Test event');
  fireEvent.click(screen.getByTestId('listener-lang-es'));
  await listen();
  expect(sockets[0].url).toContain('lang=es');
  fireEvent.click(screen.getByTestId('listener-lang-fr'));
  expect(sockets.at(-1).url).toContain('lang=fr');
  expect(players[0].clear).toHaveBeenCalled();
});
