import { PcmCapture, WIRE_RATE } from './pcmAudio';
export { WS_BASE } from './api';

// Close codes after which retrying cannot help.
const FINAL_CODES = {
  4400: 'The server refused the broadcast settings.',
  4401: 'Broadcast authorization failed. Restart the broadcast.',
  4402: 'No translation minutes left on this account.',
  4403: 'This broadcast is not allowed.',
  4404: 'This event no longer exists.',
};

// Sends the operator's program audio to the backend hub as 16 kHz PCM frames.
// `program` is a ProgramBus (ctx + output node). Listeners play the frames
// with Web Audio, which works on iPhone/iPad Safari as well as desktop.
// Once live, a dropped connection (Wi-Fi blip, server restart, proxy timeout)
// is retried automatically until stop() is called.
export class OperatorBroadcaster {
  constructor(wsUrl, { token, auth, onCount = () => {}, onStatus = () => {}, createCapture, retryDelays } = {}) {
    // `auth` replaces the operator token for interpreters ({ code }).
    Object.assign(this, { wsUrl, token, auth, onCount, onStatus, ws: null, capture: null, slowSince: 0 });
    this.createCapture = createCapture || ((ctx, node, onFrame) => new PcmCapture(ctx, node, onFrame).init());
    this.retryDelays = retryDelays || [1000, 2000, 4000, 8000, 10000];
    this.stopped = false;
    this.attempt = 0;
    this.retryTimer = null;
  }

  start(program) {
    this.stopped = false;
    return new Promise((resolve, reject) => {
      if (!program?.ctx || !program.output) {
        reject(new Error('Broadcast audio is not ready. Start translation and retry.'));
        return;
      }
      this.program = program;
      this._open({ resolve, reject });
    });
  }

  _open(first) {
    const ws = this.ws = new WebSocket(this.wsUrl);
    ws.binaryType = 'arraybuffer';
    let ready = false;
    const fail = (message) => { clearTimeout(timer); this.stop(); this.onStatus({ live: false, error: message }); first.reject(new Error(message)); };
    const timer = setTimeout(() => {
      if (ready) return;
      if (first) fail('Broadcast connection timed out');
      else { ws.onclose = null; ws.close(); this._retry(); }
    }, 10000);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', ...(this.auth || { token: this.token }), format: 'pcm16', rate: WIRE_RATE }));
    ws.onmessage = async ({ data }) => {
      let message;
      try { message = JSON.parse(data); } catch { return; }
      if (message.type === 'ready' && !ready) {
        ready = true;
        clearTimeout(timer);
        this.attempt = 0;
        if (!this.capture) {
          try {
            this.capture = await this.createCapture(this.program.ctx, this.program.output, (frame) => this._send(frame));
            if (this.ws !== ws) { this.capture?.dispose?.(); this.capture = null; return; }
          } catch (error) {
            if (first) { fail(error.message || 'Audio capture failed'); return; }
          }
        }
        if (first) first.resolve();
        else this.onStatus({ live: true, reconnected: true });
      }
      if (message.type === 'listeners') this.onCount(message.count, message.total ?? message.count);
    };
    ws.onerror = () => { if (first && !ready) fail('Broadcast connection failed'); };
    ws.onclose = ({ code }) => {
      clearTimeout(timer);
      if (this.ws !== ws || this.stopped) return;
      if (first && !ready) {
        this.stop();
        this.onStatus({ live: false });
        first.reject(new Error(`Broadcast rejected (${code})`));
        return;
      }
      if (FINAL_CODES[code]) {
        this.stop();
        this.onStatus({ live: false, error: FINAL_CODES[code] });
        return;
      }
      this._retry();
    };
  }

  _retry() {
    if (this.stopped) return;
    this.ws = null;
    const delay = this.retryDelays[Math.min(this.attempt, this.retryDelays.length - 1)];
    this.attempt += 1;
    this.onStatus({ live: true, reconnecting: true, attempt: this.attempt, error: 'Broadcast connection lost, reconnecting…' });
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => { if (!this.stopped) this._open(null); }, delay);
  }

  _send(frame) {
    const ws = this.ws;
    if (!ws || ws.readyState !== 1) return;
    // Under congestion, drop frames rather than building a growing delay.
    if (ws.bufferedAmount > 256 * 1024) {
      if (!this.slowSince) this.slowSince = Date.now();
      if (Date.now() - this.slowSince > 8000) {
        // Start a fresh connection instead of ending the broadcast.
        this.slowSince = 0;
        ws.onclose = null; ws.onmessage = null; ws.close();
        this._retry();
      }
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
    this.stopped = true;
    clearTimeout(this.retryTimer);
    this.capture?.dispose?.();
    this.capture = null;
    if (this.ws) { this.ws.onclose = null; this.ws.onmessage = null; this.ws.close(); this.ws = null; }
  }
}
