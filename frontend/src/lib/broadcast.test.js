import { beforeEach, test, expect, vi } from 'vitest';
import { OperatorBroadcaster } from './broadcast';
let socket;
const program = { ctx: {}, output: {} };
let capture;
const createCapture = vi.fn(async (_ctx, _node, onFrame) => { capture = { onFrame, dispose: vi.fn() }; return capture; });
beforeEach(() => {
  createCapture.mockClear();
  global.WebSocket = class {
    constructor() { socket = this; this.readyState = 1; this.bufferedAmount = 0; }
    send = vi.fn(); close = vi.fn();
  };
});
const flush = () => new Promise((r) => setTimeout(r, 0));

test('waits for authenticated server ready before capturing PCM', async () => {
  const broadcaster = new OperatorBroadcaster('ws://localhost/api/ws/event', {token: 'secret', createCapture});
  const pending = broadcaster.start(program);
  socket.onopen();
  const auth = JSON.parse(socket.send.mock.calls[0][0]);
  expect(auth).toEqual({type: 'auth', token: 'secret', format: 'pcm16', rate: 16000});
  expect(createCapture).not.toHaveBeenCalled();
  socket.onmessage({data: JSON.stringify({type: 'ready'})});
  await pending;
  expect(createCapture).toHaveBeenCalledWith(program.ctx, program.output, expect.any(Function));
  const frame = new ArrayBuffer(1280);
  capture.onFrame(frame);
  expect(socket.send).toHaveBeenLastCalledWith(frame);
  broadcaster.stop();
  expect(capture.dispose).toHaveBeenCalled();
  expect(socket.close).toHaveBeenCalled();
});

test('drops frames under congestion instead of queueing delay', async () => {
  const broadcaster = new OperatorBroadcaster('ws://x', {createCapture});
  const pending = broadcaster.start(program);
  socket.onmessage({data: JSON.stringify({type: 'ready'})});
  await pending;
  socket.send.mockClear();
  socket.bufferedAmount = 512 * 1024;
  capture.onFrame(new ArrayBuffer(1280));
  expect(socket.send).not.toHaveBeenCalled();
  socket.bufferedAmount = 0;
  capture.onFrame(new ArrayBuffer(1280));
  expect(socket.send).toHaveBeenCalledTimes(1);
});

test('server rejection does not leave start pending', async () => {
  const broadcaster = new OperatorBroadcaster('ws://localhost/api/ws/event', {createCapture});
  const pending = broadcaster.start(program);
  socket.onclose({code: 4401});
  await expect(pending).rejects.toThrow('4401');
  expect(broadcaster.ws).toBe(null);
});

test('missing program audio is reported without opening a socket', async () => {
  socket = null;
  const broadcaster = new OperatorBroadcaster('ws://x', {createCapture});
  await expect(broadcaster.start({})).rejects.toThrow('Broadcast audio is not ready');
  expect(socket).toBe(null);
});

test('socket failure after startup reports an actionable stopped state', async () => {
  const onStatus = vi.fn();
  const broadcaster = new OperatorBroadcaster('ws://localhost/api/ws/event', {onStatus, createCapture});
  const pending = broadcaster.start(program);
  socket.onmessage({data: JSON.stringify({type: 'ready'})});
  await pending;
  await flush();
  socket.onerror();
  expect(onStatus).toHaveBeenCalledWith({live: false, error: 'Broadcast connection failed'});
  expect(broadcaster.capture).toBe(null);
  expect(socket.close).toHaveBeenCalled();
});

test('voice metadata and captions are sent as JSON', async () => {
  const broadcaster = new OperatorBroadcaster('ws://x', {createCapture});
  const pending = broadcaster.start(program);
  socket.onmessage({data: JSON.stringify({type: 'ready'})});
  await pending;
  broadcaster.sendMeta({mode: 'studio', voice: 'Marin'});
  broadcaster.sendCaption('Bonjour');
  const sent = socket.send.mock.calls.map(c => c[0]).filter(x => typeof x === 'string').map(JSON.parse);
  expect(sent).toContainEqual({type: 'meta', mode: 'studio', voice: 'Marin'});
  expect(sent).toContainEqual({type: 'caption', text: 'Bonjour'});
});
