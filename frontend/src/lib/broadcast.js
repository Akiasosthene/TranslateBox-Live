import { PcmCapture, WIRE_RATE } from './pcmAudio';
export { WS_BASE } from './api';

// Sends the operator's program audio to the backend hub as 16 kHz PCM frames.
// `program` is a ProgramBus (ctx + output node). Listeners play the frames
// with Web Audio, which works on iPhone/iPad Safari as well as desktop.
export class OperatorBroadcaster {
  constructor(wsUrl, { token, auth, onCount = () => {}, onStatus = () => {}, createCapture } = {}) {
    // `auth` replaces the operator token for interpreters ({ code }).
    Object.assign(this, { wsUrl, token, auth, onCount, onStatus, ws: null, capture: null, slowSince: 0 });
    this.createCapture = createCapture || ((ctx, node, onFrame) => new PcmCapture(ctx, node, onFrame).init());
  }

  start(program) {
    return new Promise((resolve, reject) => {
      if (!program?.ctx || !program.output) {
        reject(new Error('Broadcast audio is not ready. Start translation and retry.'));
        return;
      }
      const ws = this.ws = new WebSocket(this.wsUrl);
      ws.binaryType = 'arraybuffer';
      let ready = false;
      const fail = (message) => { clearTimeout(timer); this.stop(); this.onStatus({live: false, error: message}); reject(new Error(message)); };
      const timer = setTimeout(() => fail('Broadcast connection timed out'), 10000);
      ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', ...(this.auth || { token: this.token }), format: 'pcm16', rate: WIRE_RATE }));
      ws.onmessage = async ({ data }) => {
        let message;
        try { message = JSON.parse(data); } catch { return; }
        if (message.type === 'ready' && !ready) {
          ready = true;
          try {
            this.capture = await this.createCapture(program.ctx, program.output, (frame) => this._send(frame));
            if (this.ws !== ws) { this.capture?.dispose?.(); this.capture = null; return; }
            clearTimeout(timer); resolve();
          } catch (error) { fail(error.message || 'Audio capture failed'); }
        }
        if (message.type === 'listeners') this.onCount(message.count, message.total ?? message.count);
      };
      ws.onerror = () => fail('Broadcast connection failed');
      ws.onclose = ({ code }) => {
        clearTimeout(timer);
        this.stop();
        this.onStatus({ live: false, error: code === 4402 ? 'No translation minutes left on this account.' : ready ? 'Broadcast connection lost. Restart the broadcast.' : undefined });
        if (!ready) reject(new Error(`Broadcast rejected (${code})`));
      };
    });
  }

  _send(frame) {
    const ws = this.ws;
    if (!ws || ws.readyState !== 1) return;
    // Under congestion, drop frames rather than building a growing delay.
    if (ws.bufferedAmount > 256 * 1024) {
      if (!this.slowSince) this.slowSince = Date.now();
      if (Date.now() - this.slowSince > 8000) { this.stop(); this.onStatus({live: false, error: 'Broadcast connection too slow'}); }
      return;
    }
    this.slowSince = 0;
    ws.send(frame);
  }

  sendJson(message) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(message));
  }

  sendCaption(text) { this.sendJson({ type: 'caption', text: text.slice(-6000) }); }

  sendMeta(meta) { this.sendJson({ type: 'meta', ...meta }); }

  stop() {
    this.capture?.dispose?.();
    this.capture = null;
    if (this.ws) { this.ws.onclose = null; this.ws.onmessage = null; this.ws.close(); this.ws = null; }
  }
}
