"""Server-side live interpretation.

Two engines that run without the operator's browser:

* ``CascadeHub``: languages the realtime model does not offer. Each finished
  source sentence is translated as text (one Responses call for all those
  languages), spoken with a studio voice (text-to-speech) and streamed to the
  language rooms. Adds roughly 2-4 s compared with direct interpretation.
* ``ServerSession``: an RTMP/SRT stream (Zoom, Teams, Webex, OBS…) is pulled
  with ffmpeg and translated by OpenAI realtime translation sessions opened by
  the server itself, so the console can be closed. Source sentences also feed
  the cascade hub.

Everything that touches FastAPI state (rooms, events, usage, OpenAI calls) is
injected through ``Deps`` so the engines stay testable.
"""
import asyncio
import base64
import json
import logging
import time
from array import array
from dataclasses import dataclass, field
from typing import Awaitable, Callable

logger = logging.getLogger("translatebox.live")

WIRE_RATE = 16000          # listener PCM16 rate
OPENAI_RATE = 24000        # realtime translation input/output and TTS rate
FRAME_BYTES = 1280         # 40 ms at 16 kHz mono PCM16


class Resampler:
    """Stateful linear resampler for mono little-endian PCM16."""

    def __init__(self, src_rate: int, dst_rate: int):
        self.step = src_rate / dst_rate
        self.pos = 0.0
        self.prev = None

    def process(self, data: bytes) -> bytes:
        if self.step == 1:
            return data
        samples = array("h")
        samples.frombytes(data[: len(data) - len(data) % 2])
        if not samples:
            return b""
        buf = samples if self.prev is None else array("h", [self.prev]) + samples
        out = array("h")
        pos, last = self.pos, len(buf) - 1
        while pos < last:
            i = int(pos)
            frac = pos - i
            out.append(int(buf[i] + (buf[i + 1] - buf[i]) * frac))
            pos += self.step
        self.prev = buf[-1]
        self.pos = pos - last
        return out.tobytes()


class Pacer:
    """Sends audio to a room at real-time pace in 40 ms frames.

    TTS returns a whole sentence at once; listeners' jitter buffers would drop
    it. The pacer releases it frame by frame, keeping order between sentences.
    """

    MAX_BYTES = WIRE_RATE * 2 * 60  # one minute of backlog at most

    def __init__(self, send: Callable[[bytes], Awaitable[None]]):
        self.send = send
        self.buf = bytearray()
        self.task = None
        self.closed = False

    def push(self, data: bytes):
        if self.closed or not data:
            return
        self.buf += data
        if len(self.buf) > self.MAX_BYTES:
            del self.buf[: len(self.buf) - self.MAX_BYTES]
        if self.task is None or self.task.done():
            self.task = asyncio.create_task(self._run())

    @property
    def backlog_seconds(self) -> float:
        return len(self.buf) / (WIRE_RATE * 2)

    async def _run(self):
        deadline = time.monotonic()
        while self.buf and not self.closed:
            frame = bytes(self.buf[:FRAME_BYTES])
            del self.buf[:FRAME_BYTES]
            try:
                await self.send(frame)
            except Exception:  # a listener problem must not stop the stream
                logger.debug("pacer send failed", exc_info=True)
            deadline += len(frame) / (WIRE_RATE * 2)
            delay = deadline - time.monotonic()
            if delay > 0:
                await asyncio.sleep(delay)
            elif delay < -0.5:
                deadline = time.monotonic()

    def clear(self):
        self.buf.clear()

    def close(self):
        self.closed = True
        self.buf.clear()
        if self.task and not self.task.done():
            self.task.cancel()


class ServerPublisher:
    """Stands in for an operator websocket while the server publishes a room."""

    is_server = True

    async def send_json(self, _data):
        return None

    async def close(self, code: int = 1000):
        return None


@dataclass
class Deps:
    room: Callable[[str, str], dict]
    fanout: Callable[[dict, str, object], Awaitable[None]]
    status: Callable[[dict, bool], Awaitable[None]]
    captions_enabled: Callable[[str], bool]
    record_usage: Callable[[str, str, float], None]
    out_of_minutes: Callable[[str], bool]
    translate_many: Callable[[str, list], Awaitable[dict]]
    tts: Callable[[str, str, str], Awaitable[bytes]]
    save_transcript: Callable[[str, str, list], None]
    archive_enabled: Callable[[str], bool]
    realtime_connect: Callable[[], Awaitable[object]] = None
    session_update: Callable[[str, str], dict] = None
    ffmpeg_args: Callable[[], list] = None
    on_stopped: Callable[[str, str], None] = field(default=lambda eid, reason: None)


class LangOutput:
    """One language room published by the server: audio pacing, captions, transcript."""

    def __init__(self, eid: str, lang: str, deps: Deps, meta: dict):
        self.eid, self.lang, self.deps = eid, lang, deps
        self.room = deps.room(eid, lang)
        self.meta = meta
        self.text = ""
        self.segment = ""
        self.segment_start = None
        self.segments = []
        self.labelled = None
        self.t0 = time.monotonic()
        self.resampler = Resampler(OPENAI_RATE, WIRE_RATE)
        self.pacer = Pacer(lambda frame: deps.fanout(self.room, "send_bytes", frame))

    async def open(self):
        self.room["operator"] = ServerPublisher()
        self.room["format"], self.room["rate"], self.room["init"] = "pcm16", WIRE_RATE, None
        self.room["meta"] = dict(self.meta)
        await self.deps.status(self.room, True)
        await self.deps.fanout(self.room, "send_json", {"type": "meta", **self.room["meta"]})

    async def close(self):
        self.pacer.close()
        self.end_segment()
        if isinstance(self.room.get("operator"), ServerPublisher):
            self.room["operator"] = None
            await self.deps.status(self.room, False)

    def audio24(self, pcm24: bytes):
        self.pacer.push(self.resampler.process(pcm24))

    async def caption(self, delta: str, speaker: str | None = None):
        if not delta:
            return
        if not self.segment:
            self.segment_start = time.monotonic()
            if speaker and speaker != self.labelled:
                self.labelled = speaker
                delta = f"{speaker}: {delta}"
        self.segment += delta
        self.text = (self.text + delta)[-20000:]
        await self.send_caption()

    async def send_caption(self):
        if self.deps.captions_enabled(self.eid):
            await self.deps.fanout(self.room, "send_json", {"type": "caption", "text": self.text[-6000:]})

    def end_segment(self, speaker: str | None = None):
        text = self.segment.strip()
        if text:
            start = (self.segment_start or time.monotonic()) - self.t0
            self.segments.append({"start": round(start * 1000), "end": round((time.monotonic() - self.t0) * 1000),
                                  "text": text[:4000], "speaker": speaker})
            self.segments = self.segments[-8000:]
            if self.text and not self.text.endswith("\n\n"):
                self.text += "\n\n"
        self.segment = ""
        self.segment_start = None

    def save(self):
        if self.segments and self.deps.archive_enabled(self.eid):
            try:
                self.deps.save_transcript(self.eid, self.lang, list(self.segments))
            except Exception:
                logger.exception("Could not archive %s transcript", self.lang)


class CascadeHub:
    """Text translation + studio voice for languages without direct interpretation."""

    MAX_QUEUE = 6

    def __init__(self, eid: str, langs: list, deps: Deps, voice: str = "marin", style: str = "", idle_timeout: float = 180):
        self.eid, self.langs, self.deps = eid, list(langs), deps
        self.voice, self.style = voice, style
        self.outputs = {lang: LangOutput(eid, lang, deps, {"mode": "studio", "voice": voice.title(), "pipeline": "text"}) for lang in self.langs}
        self.queue: asyncio.Queue = asyncio.Queue()
        self.worker = None
        self.ticker = None
        self.last_activity = time.monotonic()
        self.idle_timeout = idle_timeout
        self.running = False
        self.speaker = None
        self.errors = 0

    async def start(self):
        if self.running:
            return
        self.running = True
        for out in self.outputs.values():
            await out.open()
        self.worker = asyncio.create_task(self._work())
        self.ticker = asyncio.create_task(self._tick())

    def ping(self):
        self.last_activity = time.monotonic()

    def submit(self, text: str, speaker: str | None = None):
        text = (text or "").strip()
        if not self.running or not text:
            return False
        self.ping()
        if self.queue.qsize() >= self.MAX_QUEUE:  # falling behind: drop the oldest sentence
            try:
                self.queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
        self.queue.put_nowait((text[:2000], speaker))
        return True

    async def _work(self):
        while self.running:
            text, speaker = await self.queue.get()
            try:
                translations = await self.deps.translate_many(text, self.langs)
            except Exception:
                self.errors += 1
                logger.warning("Cascade translation failed", exc_info=True)
                continue
            async def speak(lang):
                out = self.outputs[lang]
                line = (translations.get(lang) or "").strip()
                if not line:
                    return
                await out.caption(line, speaker)
                out.end_segment(speaker)
                await out.send_caption()
                try:
                    pcm = await self.deps.tts(line, self.voice, self.style)
                    out.audio24(pcm)
                except Exception:
                    self.errors += 1
                    logger.warning("Cascade voice failed for %s", lang, exc_info=True)
            await asyncio.gather(*(speak(lang) for lang in self.langs))

    async def _tick(self):
        started = time.monotonic()
        last_save = started
        while self.running:
            await asyncio.sleep(5)
            now = time.monotonic()
            if now - started >= 30:
                for lang in self.langs:
                    self.deps.record_usage(self.eid, lang, now - started)
                started = now
                if self.deps.out_of_minutes(self.eid):
                    asyncio.create_task(self.stop("minutes"))
                    return
            if now - last_save >= 60:
                last_save = now
                for out in self.outputs.values():
                    out.save()
            if now - self.last_activity > self.idle_timeout:
                asyncio.create_task(self.stop("idle"))
                return

    def status(self) -> dict:
        return {"running": self.running, "languages": self.langs, "queued": self.queue.qsize(), "errors": self.errors,
                "backlog_seconds": {lang: round(o.pacer.backlog_seconds, 1) for lang, o in self.outputs.items()}}

    async def stop(self, reason: str = "stopped"):
        if not self.running:
            return
        self.running = False
        for task in (self.worker, self.ticker):
            if task and task is not asyncio.current_task():
                task.cancel()
        for out in self.outputs.values():
            out.save()
            await out.close()
        self.deps.on_stopped(self.eid, "cascade:" + reason)


class RealtimeLink:
    """One OpenAI realtime translation session (one output language) over WebSocket."""

    def __init__(self, session: "ServerSession", lang: str, primary: bool):
        self.session, self.lang, self.primary = session, lang, primary
        self.out = LangOutput(session.eid, lang, session.deps, {"mode": "original", "voice": None})
        self.inbox: asyncio.Queue = asyncio.Queue(maxsize=50)
        self.task = None
        self.state = "starting"
        self.source = ""
        self.source_start = None
        self.connected_once = False

    def feed(self, pcm24: bytes):
        try:
            self.inbox.put_nowait(pcm24)
        except asyncio.QueueFull:  # network stall: drop the oldest audio, keep up with the speaker
            try:
                self.inbox.get_nowait()
                self.inbox.put_nowait(pcm24)
            except (asyncio.QueueEmpty, asyncio.QueueFull):
                pass

    async def run(self):
        await self.out.open()
        backoff = 1
        while self.session.running:
            try:
                ws = await self.session.deps.realtime_connect()
            except Exception as exc:
                self.state = "error"
                logger.warning("Realtime connect failed (%s): %s", self.lang, type(exc).__name__)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30)
                continue
            backoff = 1
            try:
                update = self.session.deps.session_update(self.lang, self.session.instructions)
                for param in self.session.rejected_params:
                    node = update
                    keys = param.split(".")
                    for key in keys[:-1]:
                        node = node.get(key) if isinstance(node, dict) else None
                    if isinstance(node, dict):
                        node.pop(keys[-1], None)
                await ws.send(json.dumps(update))
                self.state = "live"
                self.connected_once = True
                sender = asyncio.create_task(self._send(ws))
                try:
                    async for raw in ws:
                        await self._event(json.loads(raw), ws)
                finally:
                    sender.cancel()
            except Exception as exc:
                logger.info("Realtime session %s ended: %s", self.lang, type(exc).__name__)
            finally:
                try:
                    await ws.close()
                except Exception:
                    pass
            if self.session.running:
                self.state = "reconnecting"
                await asyncio.sleep(1)
        await self.out.close()

    async def _send(self, ws):
        while True:
            chunk = await self.inbox.get()
            await ws.send(json.dumps({"type": "session.input_audio_buffer.append", "audio": base64.b64encode(chunk).decode()}))

    async def _event(self, ev: dict, ws):
        kind = ev.get("type", "")
        speaker = self.session.speaker
        if kind == "session.output_audio.delta":
            self.out.audio24(base64.b64decode(ev.get("delta") or ""))
        elif kind == "session.output_transcript.delta":
            await self.out.caption(ev.get("delta") or "", speaker)
            await self.session.notify_console({"type": "caption", "lang": self.lang, "text": self.out.text[-3000:]})
        elif kind == "session.output_transcript.completed":
            self.out.end_segment(speaker)
            await self.out.send_caption()
        elif kind == "session.input_transcript.delta" and self.primary:
            if not self.source:
                self.source_start = time.monotonic()
            self.source += ev.get("delta") or ""
            await self.session.notify_console({"type": "source", "text": self.source[-2000:]})
        elif kind == "session.input_transcript.completed" and self.primary:
            text = (self.source or ev.get("transcript") or "").strip()
            self.source = ""
            if text:
                self.session.source_segment(text, self.source_start)
        elif kind == "error":
            err = ev.get("error") or {}
            code = err.get("code") or err.get("type")
            param = err.get("param") or ""
            logger.warning("Realtime error (%s): %s param=%s: %s", self.lang, code, param, (err.get("message") or "")[:200])
            if code in ("unknown_parameter", "invalid_value") and param.startswith("session."):
                # Drop the rejected field and send the update again, so the
                # language and the other settings still apply.
                update = self.session.deps.session_update(self.lang, self.session.instructions)
                node = update
                keys = param.split(".")
                for key in keys[:-1]:
                    node = node.get(key) if isinstance(node, dict) else None
                    if node is None:
                        break
                if isinstance(node, dict) and keys[-1] in node:
                    node.pop(keys[-1])
                    self.session.rejected_params.add(param)
                    if param not in self.session.resent:
                        self.session.resent.add(param)
                        await ws.send(json.dumps(update))


class ServerSession:
    """Translate an ingest stream on the server for every language of an event."""

    def __init__(self, eid: str, ai_langs: list, cascade: CascadeHub | None, deps: Deps, instructions: str = "",
                 idle_minutes: float = 30, booth_room: bool = False, source: str = "ingest"):
        self.eid, self.deps, self.cascade = eid, deps, cascade
        # "ingest": pull the RTMP/SRT stream with ffmpeg. "browser": audio arrives
        # as PCM16 frames from the presenter's browser through feed_pcm().
        self.source = source
        self.feed_resampler = Resampler(WIRE_RATE, OPENAI_RATE)
        self.feed_buf = b""
        self.rejected_params: set = set()  # session.update fields OpenAI refused
        self.resent: set = set()
        self.feeder = None  # id of the socket currently allowed to push audio
        self.feeder_ws = None
        self.instructions = instructions
        self.links = [RealtimeLink(self, lang, primary=(i == 0)) for i, lang in enumerate(ai_langs)]
        self.running = False
        self.tasks = []
        self.audio_live = False
        self.last_audio = time.monotonic()
        self.idle_seconds = idle_minutes * 60
        self.speaker = None
        self.started_at = None
        self.source_segments = []
        self.booth = LangOutput(eid, "src", deps, {"mode": "floor", "voice": None}) if booth_room else None
        self.booth_resampler = Resampler(OPENAI_RATE, WIRE_RATE)
        self.stop_reason = None

    async def start(self):
        self.running = True
        self.started_at = time.time()
        if self.booth:
            await self.booth.open()
        if self.cascade:
            await self.cascade.start()
        self.tasks = [asyncio.create_task(link.run()) for link in self.links]
        self.tasks.append(asyncio.create_task(self._ingest()))
        self.tasks.append(asyncio.create_task(self._tick()))

    async def notify_console(self, message: dict):
        """Best-effort message to the presenter's browser (simple mode)."""
        ws = self.feeder_ws
        if ws is None:
            return
        try:
            await asyncio.wait_for(ws.send_json(message), timeout=1)
        except Exception:
            pass

    def source_segment(self, text: str, started: float | None):
        self.source_segments.append({"start": round(((started or time.monotonic()) - (self.started_mono or time.monotonic())) * 1000),
                                     "end": round((time.monotonic() - self.started_mono) * 1000), "text": text[:4000], "speaker": self.speaker})
        self.source_segments = self.source_segments[-8000:]
        if self.cascade:
            self.cascade.submit(text, self.speaker)

    @property
    def started_mono(self):
        if not hasattr(self, "_mono"):
            self._mono = time.monotonic()
        return self._mono

    def feed_pcm(self, pcm16: bytes):
        """Audio from the presenter's browser (PCM16 mono at WIRE_RATE)."""
        if not self.running:
            return
        self.audio_live = True
        self.last_audio = time.monotonic()
        self.feed_buf += self.feed_resampler.process(pcm16)
        chunk_bytes = OPENAI_RATE * 2 // 10  # 100 ms
        while len(self.feed_buf) >= chunk_bytes:
            chunk, self.feed_buf = self.feed_buf[:chunk_bytes], self.feed_buf[chunk_bytes:]
            for link in self.links:
                link.feed(chunk)
            if self.booth:
                self.booth.pacer.push(self.booth_resampler.process(chunk))

    async def _ingest(self):
        _ = self.started_mono
        if self.source == "browser":
            # Nothing to pull; just report "no audio" when the browser stops sending.
            while self.running:
                await asyncio.sleep(1)
                if self.audio_live and time.monotonic() - self.last_audio > 3:
                    self.audio_live = False
            return
        chunk_bytes = OPENAI_RATE * 2 // 10  # 100 ms
        while self.running:
            proc = await asyncio.create_subprocess_exec(*self.deps.ffmpeg_args(), stdout=asyncio.subprocess.PIPE,
                                                        stderr=asyncio.subprocess.DEVNULL)
            try:
                while self.running:
                    try:
                        chunk = await asyncio.wait_for(proc.stdout.readexactly(chunk_bytes), timeout=10)
                    except (asyncio.IncompleteReadError, asyncio.TimeoutError):
                        break
                    self.audio_live = True
                    self.last_audio = time.monotonic()
                    for link in self.links:
                        link.feed(chunk)
                    if self.booth:
                        self.booth.pacer.push(self.booth_resampler.process(chunk))
            finally:
                self.audio_live = False
                if proc.returncode is None:
                    proc.kill()
                    try:
                        await asyncio.wait_for(proc.wait(), timeout=3)
                    except asyncio.TimeoutError:
                        pass
            if self.running:
                await asyncio.sleep(1.5)

    async def _tick(self):
        started = time.monotonic()
        last_save = started
        while self.running:
            await asyncio.sleep(5)
            now = time.monotonic()
            if self.cascade:
                self.cascade.ping()
            if now - started >= 30:
                for link in self.links:
                    self.deps.record_usage(self.eid, link.lang, now - started)
                started = now
                if self.deps.out_of_minutes(self.eid):
                    asyncio.create_task(self.stop("minutes"))
                    return
            if now - last_save >= 60:
                last_save = now
                self._save()
            if now - self.last_audio > self.idle_seconds:
                asyncio.create_task(self.stop("idle"))
                return

    def _save(self):
        for link in self.links:
            link.out.save()
        if self.source_segments and self.deps.archive_enabled(self.eid):
            try:
                self.deps.save_transcript(self.eid, "src", list(self.source_segments))
            except Exception:
                logger.exception("Could not archive the source transcript")

    def status(self) -> dict:
        return {
            "running": self.running, "audio": self.audio_live, "started_at": self.started_at, "speaker": self.speaker, "source": self.source,
            "languages": {link.lang: {"state": link.state, "listeners": len(link.out.room["listeners"])} for link in self.links},
            "cascade": self.cascade.status() if self.cascade else None, "stop_reason": self.stop_reason,
        }

    async def stop(self, reason: str = "stopped"):
        if not self.running:
            return
        self.running = False
        self.stop_reason = reason
        current = asyncio.current_task()
        for task in self.tasks:
            if task is not current:
                task.cancel()
        await asyncio.gather(*(t for t in self.tasks if t is not current), return_exceptions=True)
        self._save()
        for link in self.links:
            await link.out.close()
        if self.booth:
            await self.booth.close()
        if self.cascade:
            await self.cascade.stop(reason)
        self.deps.on_stopped(self.eid, "server:" + reason)
