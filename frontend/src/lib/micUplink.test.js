import { beforeEach, test, expect, vi } from 'vitest';
import { MicUplink } from './micUplink';

let socket; let capture;
const createCapture = vi.fn(async (_ctx, _node, onFrame) => { capture = { onFrame, dispose: vi.fn() }; return capture; });
beforeEach(() => {
  createCapture.mockClear();
  global.WebSocket = class { constructor() { socket = this; this.readyState = 1; this.bufferedAmount = 0; } send = vi.fn(); close = vi.fn(); };
  global.AudioContext = class { state = 'running'; resume = vi.fn(); createMediaStreamSource() { return { connect: vi.fn() }; } createAnalyser() { return { fftSize: 0, connect: vi.fn(() => ({ connect: vi.fn() })), getFloatTimeDomainData: vi.fn() }; } createGain() { return { gain: {}, connect: vi.fn() }; } destination = {}; close = vi.fn(); };
  global.navigator.mediaDevices = { getUserMedia: vi.fn(async () => ({ getAudioTracks: () => [{ onended: null, stop: vi.fn() }], getTracks: () => [{ stop: vi.fn() }] })) };
});

test('sends mic frames after the server says ready and reconnects on drop', async () => {
  vi.useFakeTimers();
  const statuses = [];
  const up = new MicUplink({ eventId: 'ev1', token: 'tok', onStatus: (s) => statuses.push(s), createCapture });
  const pending = up.start({});
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  socket.onopen();
  expect(JSON.parse(socket.send.mock.calls[0][0])).toEqual({ type: 'auth', token: 'tok' });
  socket.onmessage({ data: JSON.stringify({ type: 'ready' }) });
  await pending;
  capture.onFrame(new ArrayBuffer(1280));
  expect(socket.send).toHaveBeenLastCalledWith(expect.any(ArrayBuffer));
  const first = socket;
  first.onclose({ code: 1006 });
  expect(statuses.at(-1)).toMatchObject({ connected: false });
  vi.advanceTimersByTime(1100);
  expect(socket).not.toBe(first);
  socket.onopen(); socket.onmessage({ data: JSON.stringify({ type: 'ready' }) });
  expect(statuses.at(-1)).toMatchObject({ connected: true });
  capture.onFrame(new ArrayBuffer(1280));
  expect(socket.send).toHaveBeenLastCalledWith(expect.any(ArrayBuffer));
  up.stop();
  expect(capture.dispose).toHaveBeenCalled();
  vi.useRealTimers();
});

test('takeover by another device is final', async () => {
  const statuses = [];
  const up = new MicUplink({ eventId: 'ev1', token: 'tok', onStatus: (s) => statuses.push(s), createCapture });
  const pending = up.start({});
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  socket.onopen(); socket.onmessage({ data: JSON.stringify({ type: 'ready' }) });
  await pending;
  socket.onclose({ code: 4409 });
  expect(statuses.at(-1)).toMatchObject({ ended: true });
  expect(up.stopped).toBe(true);
});

test('restarts the server session after the server comes back', async () => {
  vi.useFakeTimers();
  const restartSession = vi.fn(async () => {});
  const statuses = [];
  const up = new MicUplink({ eventId: 'ev1', token: 'tok', onStatus: (s) => statuses.push(s), createCapture, restartSession });
  const pending = up.start({});
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  socket.onopen(); socket.onmessage({ data: JSON.stringify({ type: 'ready' }) });
  await pending;
  const first = socket;
  first.onclose({ code: 4404 });
  expect(up.stopped).toBe(false);
  await vi.advanceTimersByTimeAsync(2100);
  expect(restartSession).toHaveBeenCalledTimes(1);
  expect(socket).not.toBe(first);
  socket.onopen(); socket.onmessage({ data: JSON.stringify({ type: 'ready' }) });
  expect(statuses.at(-1)).toMatchObject({ connected: true });
  up.stop();
  vi.useRealTimers();
});
