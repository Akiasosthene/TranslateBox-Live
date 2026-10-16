import React from 'react';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
const players = [];
vi.mock('../lib/pcmAudio', () => ({
  WIRE_RATE: 16000,
  createAudioContext: vi.fn(() => ({ resume: vi.fn().mockResolvedValue(), close: vi.fn().mockResolvedValue(), currentTime: 0, createMediaStreamSource: () => ({ connect: vi.fn() }), createGain: () => ({ connect: vi.fn(), gain: { setTargetAtTime: vi.fn() } }), createAnalyser: () => ({ fftSize: 0, getByteTimeDomainData: vi.fn() }) })),
  PcmPlayer: class { constructor(_c, o) { this.opts = o; this.push = vi.fn(); this.clear = vi.fn(); this.setVolume = vi.fn(); this.dispose = vi.fn(); players.push(this); } async init() { return this; } },
  PcmCapture: class { async init() { return this; } dispose() {} },
}));
import Booth from './Booth';

let sockets;
beforeEach(() => {
  sockets = []; players.length = 0;
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ name: 'Culte', target: 'en', targets: ['en', 'fr'], human: ['fr'] }) });
  global.WebSocket = class { constructor(url) { this.url = url; this.readyState = 1; this.bufferedAmount = 0; sockets.push(this); } send = vi.fn(); close = vi.fn(); };
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) } });
  global.requestAnimationFrame = vi.fn(); global.cancelAnimationFrame = vi.fn();
});
afterEach(cleanup);

test('interpreter hears the floor and goes on air for their language', async () => {
  render(<MemoryRouter initialEntries={['/e/ev1/booth']}><Routes><Route path="/e/:id/booth" element={<Booth/>}/></Routes></MemoryRouter>);
  await screen.findByText('Culte');
  fireEvent.change(screen.getByTestId('booth-code-input'), { target: { value: 'secret-code' } });
  await act(async () => { fireEvent.click(screen.getByTestId('booth-join')); });
  expect(sockets[0].url).toContain('role=booth&lang=src');
  act(() => sockets[0].onopen());
  expect(JSON.parse(sockets[0].send.mock.calls[0][0])).toEqual({ type: 'auth', code: 'secret-code' });
  const frame = new ArrayBuffer(1280);
  act(() => sockets[0].onmessage({ data: frame }));
  expect(players[0].push).toHaveBeenCalledWith(frame);
  fireEvent.click(screen.getByTestId('booth-on-air'));
  const cast = sockets[1];
  expect(cast.url).toContain('role=interpreter&lang=fr');
  act(() => cast.onopen());
  expect(JSON.parse(cast.send.mock.calls[0][0])).toMatchObject({ type: 'auth', code: 'secret-code', format: 'pcm16' });
  await act(async () => { await cast.onmessage({ data: JSON.stringify({ type: 'ready' }) }); });
  await screen.findByTestId('booth-off-air');
  const meta = cast.send.mock.calls.map((c) => c[0]).filter((x) => typeof x === 'string').map(JSON.parse).find((m) => m.type === 'meta');
  expect(meta).toEqual({ type: 'meta', mode: 'human', voice: null });
});

test('a busy booth explains that another interpreter is on air', async () => {
  render(<MemoryRouter initialEntries={['/e/ev1/booth']}><Routes><Route path="/e/:id/booth" element={<Booth/>}/></Routes></MemoryRouter>);
  await screen.findByText('Culte');
  fireEvent.change(screen.getByTestId('booth-code-input'), { target: { value: 'c' } });
  await act(async () => { fireEvent.click(screen.getByTestId('booth-join')); });
  fireEvent.click(screen.getByTestId('booth-on-air'));
  await act(async () => { sockets[1].onclose({ code: 4409 }); });
  expect(screen.getByTestId('booth-error').textContent).toMatch(/Another interpreter/);
});
