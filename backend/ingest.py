"""Stream ingest: RTMP/RTMPS/SRT published to MediaMTX, relayed as PCM16.

Zoom, Teams, Webex, YouTube Studio, Vimeo and OBS can push a meeting or a
stream to MediaMTX. The backend pulls the audio with ffmpeg (16 kHz mono
PCM16, 40 ms frames) and forwards it to the operator console, which feeds it
into translation exactly like a microphone.
"""
import asyncio
import hashlib
import os
import shutil

FRAME_BYTES = 1280  # 40 ms of 16 kHz mono PCM16


def internal_url() -> str:
    return os.environ.get("INGEST_INTERNAL_URL", "").rstrip("/")


def enabled() -> bool:
    return bool(internal_url()) and shutil.which(os.environ.get("FFMPEG_BIN", "ffmpeg")) is not None


def read_password() -> str:
    """Credential the backend uses to read streams from MediaMTX (derived, never shown)."""
    seed = os.environ.get("INGEST_READ_SECRET") or os.environ.get("OPERATOR_TOKEN", "") or "translatebox"
    return hashlib.sha256(("ingest-read:" + seed).encode()).hexdigest()[:32]


def ffmpeg_args(stream_key: str) -> list:
    src = f"{internal_url()}/live/{stream_key}?user=tb&pass={read_password()}"
    return [
        os.environ.get("FFMPEG_BIN", "ffmpeg"), "-nostdin", "-hide_banner", "-loglevel", "error",
        "-fflags", "nobuffer", "-flags", "low_delay", "-rw_timeout", "8000000",
        "-i", src, "-vn", "-sn", "-dn", "-ac", "1", "-ar", "16000", "-f", "s16le", "pipe:1",
    ]


async def relay(stream_key: str, send_bytes, send_status, stopped: asyncio.Event, retry_s: float = 3.0):
    """Pull the stream until `stopped` is set; reconnect while nobody publishes."""
    live = None
    while not stopped.is_set():
        proc = await asyncio.create_subprocess_exec(
            *ffmpeg_args(stream_key), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
        got_audio = False
        try:
            while not stopped.is_set():
                try:
                    chunk = await asyncio.wait_for(proc.stdout.readexactly(FRAME_BYTES), timeout=10)
                except asyncio.IncompleteReadError:
                    break
                except asyncio.TimeoutError:
                    break
                if not got_audio:
                    got_audio = True
                    if live is not True:
                        live = True
                        await send_status(True)
                await send_bytes(chunk)
        finally:
            if proc.returncode is None:
                proc.kill()
                try:
                    await asyncio.wait_for(proc.wait(), timeout=3)
                except asyncio.TimeoutError:
                    pass
        if live is not False:
            live = False
            await send_status(False)
        try:
            await asyncio.wait_for(stopped.wait(), timeout=retry_s)
        except asyncio.TimeoutError:
            pass
