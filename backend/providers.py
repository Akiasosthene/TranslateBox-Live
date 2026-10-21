"""Optional premium providers for the studio (text) pipeline.

Deepgram: streaming speech recognition with interim results and endpointing.
ElevenLabs: streaming text-to-speech (Flash) with stable, natural voices.

Both are used only when their API key is set; OpenAI remains the default
for every step, so the app keeps working without them.
"""
import logging
import os
import time
from urllib.parse import urlencode

import httpx

logger = logging.getLogger("translatebox.providers")

DEEPGRAM_WS = os.environ.get("DEEPGRAM_WS_URL", "wss://api.deepgram.com/v1/listen")
DEEPGRAM_MODEL = os.environ.get("DEEPGRAM_MODEL", "nova-3")
ELEVENLABS_API = os.environ.get("ELEVENLABS_API_BASE", "https://api.elevenlabs.io").rstrip("/")
ELEVENLABS_MODEL = os.environ.get("ELEVENLABS_MODEL", "eleven_flash_v2_5")
ELEVENLABS_DEFAULT_VOICE = os.environ.get("ELEVENLABS_VOICE_ID", "")


def deepgram_enabled() -> bool:
    return bool(os.environ.get("DEEPGRAM_API_KEY")) and os.environ.get("STT_PROVIDER", "deepgram") == "deepgram"


def elevenlabs_enabled() -> bool:
    return bool(os.environ.get("ELEVENLABS_API_KEY")) and os.environ.get("TTS_PROVIDER", "elevenlabs") == "elevenlabs"


def stt_provider() -> str:
    return "deepgram" if deepgram_enabled() else "openai"


def tts_provider() -> str:
    return "elevenlabs" if elevenlabs_enabled() else "openai"


async def deepgram_connect(rate: int = 24000, language: str = "multi"):
    """Open a Deepgram streaming session for PCM16 mono at `rate`."""
    from websockets.asyncio.client import connect
    params = {
        "model": DEEPGRAM_MODEL, "encoding": "linear16", "sample_rate": str(rate), "channels": "1",
        "language": language or "multi", "interim_results": "true", "smart_format": "true",
        "punctuate": "true", "endpointing": os.environ.get("DEEPGRAM_ENDPOINTING_MS", "300"),
        "utterance_end_ms": os.environ.get("DEEPGRAM_UTTERANCE_END_MS", "1000"), "vad_events": "true",
    }
    url = f"{DEEPGRAM_WS}?{urlencode(params)}"
    headers = {"Authorization": "Token " + os.environ.get("DEEPGRAM_API_KEY", "")}
    return await connect(url, additional_headers=headers, max_size=4 * 1024 * 1024, open_timeout=15, ping_interval=20)


async def elevenlabs_tts_stream(http: httpx.AsyncClient, text: str, voice_id: str, style: str = "", lang: str | None = None):
    """Yield PCM16 24 kHz chunks from ElevenLabs as they are synthesised."""
    voice_id = voice_id or ELEVENLABS_DEFAULT_VOICE
    if not voice_id:
        raise RuntimeError("no ElevenLabs voice configured")
    body = {"text": text[:2000], "model_id": ELEVENLABS_MODEL,
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "speed": 1.0}}
    if lang and len(lang) == 2 and ELEVENLABS_MODEL.startswith(("eleven_flash_v2_5", "eleven_turbo_v2_5", "eleven_v3")):
        body["language_code"] = lang
    url = f"{ELEVENLABS_API}/v1/text-to-speech/{voice_id}/stream?output_format=pcm_24000"
    headers = {"xi-api-key": os.environ.get("ELEVENLABS_API_KEY", ""), "Content-Type": "application/json"}
    async with http.stream("POST", url, headers=headers, json=body, timeout=30.0) as resp:
        if resp.status_code >= 400:
            raise RuntimeError(f"elevenlabs {resp.status_code}")
        carry = b""
        async for chunk in resp.aiter_bytes():
            data = carry + chunk
            if len(data) % 2:
                data, carry = data[:-1], data[-1:]
            else:
                carry = b""
            if data:
                yield data


_voices_cache = {"at": 0.0, "voices": []}


async def elevenlabs_voices(http: httpx.AsyncClient) -> list:
    """Voices available to the account: [{id, label, hint}], cached 10 minutes."""
    if time.monotonic() - _voices_cache["at"] < 600 and _voices_cache["voices"]:
        return _voices_cache["voices"]
    headers = {"xi-api-key": os.environ.get("ELEVENLABS_API_KEY", "")}
    resp = await http.get(f"{ELEVENLABS_API}/v1/voices", headers=headers, timeout=15.0)
    if resp.status_code >= 400:
        raise RuntimeError(f"elevenlabs voices {resp.status_code}")
    voices = []
    for v in (resp.json().get("voices") or []):
        labels = v.get("labels") or {}
        hint = ", ".join(x for x in (labels.get("gender"), labels.get("accent"), labels.get("description") or labels.get("use_case")) if x)
        voices.append({"id": v.get("voice_id"), "label": v.get("name") or v.get("voice_id"), "hint": hint[:60]})
    voices.sort(key=lambda x: x["label"].lower())
    _voices_cache.update(at=time.monotonic(), voices=voices)
    return voices
