from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from fastapi.responses import JSONResponse, StreamingResponse, RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import asyncio
import json
import secrets
import time
import logging
import hashlib
import base64
import re
from datetime import datetime, timezone
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal
from pydantic import BaseModel, Field
import httpx
import anyio
from event_store import EventStore, KVStore


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# OpenAI Realtime Translation configuration
OPENAI_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/translations/client_secrets"
REALTIME_MODEL = os.environ.get("OPENAI_REALTIME_MODEL", "gpt-realtime-translate")
INPUT_TRANSCRIPTION_MODEL = "gpt-realtime-whisper"

# Studio voices: translated text re-voiced with OpenAI text-to-speech.
OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech"
TTS_MODEL = os.environ.get("OPENAI_TTS_MODEL", "gpt-4o-mini-tts")
STUDIO_VOICES = {
    "alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx",
    "sage", "shimmer", "verse", "marin", "cedar",
}
TTS_RATE_MAX = int(os.environ.get("TTS_RATE_LIMIT_MAX", "300"))
# Post-session AI summaries (Responses API).
OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
SUMMARY_MODEL = os.environ.get("OPENAI_SUMMARY_MODEL", "gpt-6-luna")
SUMMARY_MAX_BODY = int(os.environ.get("SUMMARY_MAX_BODY_BYTES", "600000"))
LARGE_BODY_BYTES = int(os.environ.get("LARGE_BODY_BYTES", "400000"))
USAGE_CAP_MINUTES = float(os.environ.get("USAGE_CAP_MINUTES", "0"))  # 0 = no monthly cap
LANGUAGE_NAMES = {
    "en": "English", "es": "Spanish", "pt": "Portuguese", "fr": "French", "ja": "Japanese",
    "ru": "Russian", "zh": "Chinese", "de": "German", "ko": "Korean", "hi": "Hindi",
    "id": "Indonesian", "vi": "Vietnamese", "it": "Italian",
}
_http_client: "httpx.AsyncClient | None" = None


def _http() -> "httpx.AsyncClient":
    """One pooled client: keep-alive to OpenAI saves a TLS handshake per sentence."""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=5.0),
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10, keepalive_expiry=60),
        )
    return _http_client

# The 13 output languages supported by gpt-realtime-translate.
SUPPORTED_OUTPUT_LANGUAGES = {
    "en", "es", "pt", "fr", "ja", "ru", "zh", "de", "ko", "hi", "id", "vi", "it",
}

# Abuse controls for operator sessions and public listener connections.
MAX_INSTRUCTIONS_LEN = int(os.environ.get("MAX_INSTRUCTIONS_LEN", "6000"))
MAX_BODY_BYTES = int(os.environ.get("MAX_BODY_BYTES", "32768"))  # 32 KB
RATE_LIMIT_MAX = int(os.environ.get("SESSION_RATE_LIMIT_MAX", "20"))
RATE_LIMIT_WINDOW = int(os.environ.get("SESSION_RATE_LIMIT_WINDOW", "60"))  # seconds
_rate_buckets = defaultdict(deque)


def _client_ip(request: Request) -> str:
    # Only Uvicorn may resolve forwarding headers, from trusted proxies.
    return request.client.host if request.client else "unknown"


def _rate_limited(ip: str, maximum: int = RATE_LIMIT_MAX) -> bool:
    now = time.monotonic()
    for key, entries in list(_rate_buckets.items()):
        if not entries or now - entries[-1] > RATE_LIMIT_WINDOW:
            del _rate_buckets[key]
    if ip not in _rate_buckets and len(_rate_buckets) >= 10000:
        return True
    bucket = _rate_buckets[ip]
    while bucket and now - bucket[0] > RATE_LIMIT_WINDOW:
        bucket.popleft()
    if len(bucket) >= maximum:
        return True
    bucket.append(now)
    return False

@asynccontextmanager
async def lifespan(_app):
    yield
    if _http_client is not None:
        await _http_client.aclose()


app = FastAPI(title="TranslateBox Live API", docs_url=None, redoc_url=None, lifespan=lifespan)


# Operator sessions created by single sign-on (OIDC). Kept in memory only:
# a backend restart signs SSO operators out.
SSO_SESSIONS = {}  # token -> {"email": str, "exp": float}
SSO_SESSION_TTL = int(os.environ.get("SSO_SESSION_HOURS", "12")) * 3600


def _sso_enabled() -> bool:
    return all(os.environ.get(k) for k in ("OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET"))


def _sso_session(supplied: str):
    if not supplied.startswith("Bearer "):
        return None
    now = time.time()
    for token in [t for t, v in SSO_SESSIONS.items() if v["exp"] < now]:
        SSO_SESSIONS.pop(token, None)
    return SSO_SESSIONS.get(supplied[7:])


def require_operator(request: Request):
    if _rate_limited("auth:" + _client_ip(request), 120):
        raise HTTPException(429, "Too many requests. Try again shortly.")
    expected = os.environ.get("OPERATOR_TOKEN", "")
    if len(expected) < 32 and not _sso_enabled():
        raise HTTPException(503, "Operator access is not configured on the server.")
    supplied = request.headers.get("authorization", "")
    if len(expected) >= 32 and secrets.compare_digest(supplied.encode(), ("Bearer " + expected).encode()):
        return
    if _sso_session(supplied):
        return
    raise HTTPException(401, "Operator access required.")

api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("translatebox")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response




class BodyLimitMiddleware:
    """Count actual bytes before FastAPI parses JSON, including chunked bodies."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in {"POST", "PUT", "PATCH"}:
            return await self.app(scope, receive, send)
        path = scope.get("path", "")
        if path == "/api/summary":
            limit = SUMMARY_MAX_BODY
        elif path.startswith("/api/events") or path == "/api/library":
            limit = LARGE_BODY_BYTES  # logos and the shared glossary library
        else:
            limit = MAX_BODY_BYTES
        chunks, size = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            size += len(message.get("body", b""))
            if size > limit:
                return await JSONResponse({"detail": "Request body too large."}, 413)(scope, receive, send)
            chunks.append(message.get("body", b""))
            if not message.get("more_body", False):
                break
        delivered = False
        async def replay():
            nonlocal delivered
            if delivered:
                return await receive()
            delivered = True
            return {"type": "http.request", "body": b"".join(chunks), "more_body": False}
        await self.app(scope, replay, send)


class SessionRequest(BaseModel):
    noise_reduction: Literal["near_field", "far_field"] = "near_field"
    target_language: str = Field(default="en", max_length=10)
    instructions: str | None = Field(default=None, max_length=MAX_INSTRUCTIONS_LEN)


@api_router.get("/")
async def root():
    return {"message": "TranslateBox Live API", "status": "ok"}


@api_router.get("/operator", dependencies=[Depends(require_operator)])
async def operator_access(request: Request):
    session = _sso_session(request.headers.get("authorization", ""))
    return {"status": "ok", "email": session["email"] if session else None}


@api_router.post("/auth/logout")
async def logout(request: Request):
    supplied = request.headers.get("authorization", "")
    if supplied.startswith("Bearer "):
        SSO_SESSIONS.pop(supplied[7:], None)
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Optional single sign-on for operators (OpenID Connect: Google, Microsoft
# Entra ID, Okta…). Configure OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET
# and OIDC_ALLOWED (emails and/or @domains). The operator code keeps working.
# ---------------------------------------------------------------------------
_oidc_discovery = {}
_sso_pending = {}  # state -> {"verifier", "exp"}


def _public_origin() -> str:
    return (os.environ.get("PUBLIC_ORIGIN") or (_cors_origins[0] if _cors_origins else "")).rstrip("/")


def _sso_allowed(email: str) -> bool:
    email = (email or "").lower()
    rules = [r.strip().lower() for r in os.environ.get("OIDC_ALLOWED", "").split(",") if r.strip()]
    return bool(email) and any(email == r or (r.startswith("@") and email.endswith(r)) for r in rules)


async def _oidc_config() -> dict:
    issuer = os.environ["OIDC_ISSUER"].rstrip("/")
    if _oidc_discovery.get("issuer") != issuer:
        resp = await _http().get(issuer + "/.well-known/openid-configuration", timeout=10.0)
        resp.raise_for_status()
        _oidc_discovery.clear()
        _oidc_discovery.update({**resp.json(), "issuer": issuer})
    return _oidc_discovery


def _sso_fail(message: str):
    return RedirectResponse(_public_origin() + "/#sso_error=" + urlencode({"m": message})[2:], status_code=302)


@api_router.get("/auth/sso")
async def sso_info():
    return {"enabled": _sso_enabled(), "label": os.environ.get("OIDC_LABEL", "Single sign-on")}


@api_router.get("/auth/sso/start")
async def sso_start(request: Request):
    if not _sso_enabled():
        raise HTTPException(404, "Single sign-on is not configured.")
    if _rate_limited("sso:" + _client_ip(request), 30):
        raise HTTPException(429, "Too many sign-in attempts. Try again shortly.")
    try:
        cfg = await _oidc_config()
    except (httpx.HTTPError, ValueError):
        return _sso_fail("Sign-in provider unreachable.")
    now = time.time()
    for key in [k for k, v in _sso_pending.items() if v["exp"] < now]:
        _sso_pending.pop(key, None)
    state, verifier = secrets.token_urlsafe(24), secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    _sso_pending[state] = {"verifier": verifier, "exp": now + 600}
    params = {
        "response_type": "code", "client_id": os.environ["OIDC_CLIENT_ID"],
        "redirect_uri": _public_origin() + "/api/auth/sso/callback", "scope": "openid email profile",
        "state": state, "code_challenge": challenge, "code_challenge_method": "S256",
        "nonce": secrets.token_urlsafe(16), "prompt": "select_account",
    }
    return RedirectResponse(cfg["authorization_endpoint"] + "?" + urlencode(params), status_code=302)


@api_router.get("/auth/sso/callback")
async def sso_callback(code: str = "", state: str = "", error: str = ""):
    if not _sso_enabled():
        raise HTTPException(404, "Single sign-on is not configured.")
    pending = _sso_pending.pop(state, None)
    if error or not code or not pending or pending["exp"] < time.time():
        return _sso_fail("Sign-in was cancelled or expired. Try again.")
    try:
        cfg = await _oidc_config()
        token_resp = await _http().post(cfg["token_endpoint"], data={
            "grant_type": "authorization_code", "code": code,
            "redirect_uri": _public_origin() + "/api/auth/sso/callback",
            "client_id": os.environ["OIDC_CLIENT_ID"], "client_secret": os.environ["OIDC_CLIENT_SECRET"],
            "code_verifier": pending["verifier"],
        }, headers={"Accept": "application/json"}, timeout=15.0)
        if token_resp.status_code >= 400:
            logger.warning("SSO token exchange failed %s", token_resp.status_code)
            return _sso_fail("Sign-in failed. Try again.")
        access = token_resp.json().get("access_token")
        info = (await _http().get(cfg["userinfo_endpoint"], headers={"Authorization": f"Bearer {access}"}, timeout=10.0)).json()
    except (httpx.HTTPError, ValueError, KeyError):
        return _sso_fail("Sign-in provider unreachable.")
    email = info.get("email") or info.get("preferred_username") or ""
    if info.get("email_verified") is False or not _sso_allowed(email):
        logger.info("SSO refused for an account outside OIDC_ALLOWED")
        return _sso_fail("This account is not allowed to operate TranslateBox.")
    session = secrets.token_urlsafe(32)
    SSO_SESSIONS[session] = {"email": email.lower(), "exp": time.time() + SSO_SESSION_TTL}
    logger.info("SSO operator signed in")
    return RedirectResponse(_public_origin() + "/#sso=" + session, status_code=302)


@api_router.get("/health")
async def health():
    return {
        "status": "ok",
        "openai_key_configured": bool(os.environ.get("OPENAI_API_KEY")),
        "model": REALTIME_MODEL,
        "tts_model": TTS_MODEL,
        "studio_voices": sorted(STUDIO_VOICES),
    }


def _enforce_session_abuse_controls(request: Request):
    """Additional session-minting rate limit."""
    if _rate_limited(_client_ip(request)):
        raise HTTPException(
            status_code=429,
            detail="Too many session requests. Please wait a moment and try again.",
        )
    content_length = request.headers.get("content-length")
    if content_length and content_length.isdigit() and int(content_length) > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="Request body too large.")


def _resolve_target_language(target_language: str) -> str:
    """Validate the requested output language against the model's supported set."""
    lang = (target_language or "en").lower()
    if lang not in SUPPORTED_OUTPUT_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported target language '{lang}'. Supported output languages: {sorted(SUPPORTED_OUTPUT_LANGUAGES)}",
        )
    return lang


def _build_session_config(target_language: str, noise_reduction: str = "near_field") -> dict:
    return {
        "session": {
            "model": REALTIME_MODEL,
            "audio": {
                "input": {
                    "transcription": {"model": INPUT_TRANSCRIPTION_MODEL},
                    "noise_reduction": {"type": noise_reduction},
                },
                "output": {"language": target_language},
            },
        }
    }


def _upstream_code(body: bytes):
    try:
        return json.loads(body or b"{}").get("error", {}).get("code")
    except (ValueError, AttributeError):
        return None


def _raise_upstream(status_code: int, upstream_code, model_label: str = "translation model"):
    if status_code == 401:
        detail, status = "The server OpenAI key is invalid. Ask the administrator to replace it and restart the backend.", 502
    elif status_code == 403:
        detail, status = f"The server OpenAI project cannot access this {model_label}. Ask the administrator to check project permissions.", 502
    elif status_code == 402 or upstream_code == "insufficient_quota":
        detail, status = "The OpenAI project has insufficient credit or quota. Ask the administrator to check billing and usage limits.", 402
    elif status_code == 429:
        detail, status = "The translation service is receiving too many requests. Wait one minute before restarting.", 429
    else:
        detail, status = "The translation service is temporarily unavailable. Try again shortly.", 502
    raise HTTPException(status_code=status, detail=detail)


def _openai_headers(api_key: str) -> dict:
    # Bind the ephemeral secret to a stable, non-identifying operator hash.
    safety_id = hashlib.sha256(b"translatebox-live-operator").hexdigest()
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": safety_id,
    }


async def _mint_session(base_config: dict, instructions: str, headers: dict):
    """POST to OpenAI, attaching custom instructions when possible.

    gpt-realtime-translate may reject the `instructions` field, so we attempt it
    then gracefully fall back to the proven base config. Returns (resp, applied).
    """
    async def _post(config):
        return await _http().post(OPENAI_CLIENT_SECRETS_URL, headers=headers, json=config, timeout=20.0)

    if not instructions:
        return await _post(base_config), False

    with_instr = {"session": {**base_config["session"], "instructions": instructions}}
    resp = await _post(with_instr)
    if resp.status_code < 400:
        return resp, True
    if resp.status_code not in (400, 422):
        return resp, False
    logger.warning("Instructions not accepted by model (%s); retrying without them.", resp.status_code)
    return await _post(base_config), False


@api_router.post("/realtime-session", dependencies=[Depends(require_operator)])
async def create_realtime_session(req: SessionRequest, request: Request):
    """Mint a short-lived OpenAI Realtime Translation client secret.

    The permanent OPENAI_API_KEY never leaves the server. The browser only
    receives the ephemeral `value` used to open a WebRTC translation call.
    """
    _enforce_session_abuse_controls(request)

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="The translation service is not configured on the server.",
        )

    if USAGE_CAP_MINUTES and _month_minutes() >= USAGE_CAP_MINUTES:
        raise HTTPException(402, "The monthly translation limit set by the administrator is reached. Raise USAGE_CAP_MINUTES to continue.")
    target_language = _resolve_target_language(req.target_language)
    session_config = _build_session_config(target_language, req.noise_reduction)
    headers = _openai_headers(api_key)
    instructions = (req.instructions or "").strip()[:MAX_INSTRUCTIONS_LEN]

    try:
        resp, instructions_applied = await _mint_session(session_config, instructions, headers)
    except httpx.RequestError as exc:
        logger.error("Network error reaching translation service: %s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="The translation service could not start a session. Try again shortly.")

    if resp.status_code >= 400:
        # Log only status: upstream bodies may contain sensitive information.
        logger.error("OpenAI session error %s", resp.status_code)
        _raise_upstream(resp.status_code, _upstream_code(resp.content))

    logger.info(
        "Minted ephemeral translation session (model=%s, target=%s, instructions_applied=%s)",
        REALTIME_MODEL, target_language, instructions_applied,
    )
    try:
        data = resp.json()
        value = data.get("value") or data.get("client_secret", {}).get("value")
        if not isinstance(value, str) or not value.startswith("ek_"):
            raise ValueError("Invalid client secret")
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(502, "Invalid translation service response. Try again shortly.")
    return JSONResponse(content={
        "value": value, "expires_at": data.get("expires_at"),
        "instructions_applied": instructions_applied,
    }, headers={"Cache-Control": "no-store"})


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1200)
    voice: str = Field(default="marin", max_length=20)
    style: str | None = Field(default=None, max_length=400)


@api_router.post("/tts", dependencies=[Depends(require_operator)])
async def studio_voice(req: TtsRequest, request: Request):
    """Stream one translated sentence as 24 kHz mono PCM16 in a fixed voice."""
    if _rate_limited("tts:" + _client_ip(request), TTS_RATE_MAX):
        raise HTTPException(429, "Too many studio voice requests. Switch to the translation voice or slow down.")
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(503, "The translation service is not configured on the server.")
    voice = req.voice.lower()
    if voice not in STUDIO_VOICES:
        raise HTTPException(400, f"Unknown voice '{voice}'.")
    text = req.text.strip()
    if not text:
        raise HTTPException(400, "Nothing to speak.")
    payload = {"model": TTS_MODEL, "voice": voice, "input": text, "response_format": "pcm"}
    style = (req.style or "").strip()
    if style:
        payload["instructions"] = style
    client = _http()
    try:
        upstream = await client.send(
            client.build_request("POST", OPENAI_SPEECH_URL, headers=_openai_headers(api_key), json=payload),
            stream=True,
        )
    except httpx.RequestError as exc:
        logger.error("Network error reaching speech service: %s", type(exc).__name__)
        raise HTTPException(502, "The studio voice could not start. Try again shortly.")
    if upstream.status_code >= 400:
        body = await upstream.aread()
        await upstream.aclose()
        logger.error("OpenAI speech error %s", upstream.status_code)
        _raise_upstream(upstream.status_code, _upstream_code(body), "speech model")

    async def relay():
        try:
            async for chunk in upstream.aiter_bytes():
                yield chunk
        except httpx.HTTPError as exc:
            logger.warning("Speech stream interrupted: %s", type(exc).__name__)
        finally:
            await upstream.aclose()

    return StreamingResponse(relay(), media_type="application/octet-stream", headers={
        "Cache-Control": "no-store", "X-Audio-Format": "pcm16; rate=24000; channels=1",
    })


class SummaryRequest(BaseModel):
    text: str = Field(min_length=20, max_length=200000)
    language: str = Field(default="en", max_length=10)
    title: str | None = Field(default=None, max_length=200)


def _response_text(data: dict) -> str:
    if isinstance(data.get("output_text"), str):
        return data["output_text"]
    parts = []
    for item in data.get("output") or []:
        for content in item.get("content") or [] if isinstance(item, dict) else []:
            if isinstance(content, dict) and content.get("type") in ("output_text", "text") and isinstance(content.get("text"), str):
                parts.append(content["text"])
    return "\n".join(parts).strip()


@api_router.post("/summary", dependencies=[Depends(require_operator)])
async def summarize(req: SummaryRequest, request: Request):
    """Summarize a finished session transcript. Nothing is stored server-side."""
    if _rate_limited("summary:" + _client_ip(request), 20):
        raise HTTPException(429, "Too many summary requests. Wait a minute and retry.")
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(503, "The translation service is not configured on the server.")
    language = LANGUAGE_NAMES.get(req.language.lower(), "English")
    instructions = (
        f"You summarize transcripts of live-interpreted events. Write in {language}. "
        "Use Markdown with these sections: '## Overview' (2-3 sentences), '## Key takeaways' (4-8 bullets), "
        "'## Next steps' (only if the speakers mention actions, dates or commitments), "
        "'## Notable quotes' (at most 3, copied exactly from the transcript). "
        "Use only what is in the transcript. Do not invent names, numbers or facts. "
        "The transcript comes from machine interpretation and may contain recognition errors; do not amplify them."
    )
    title = f"Event: {req.title}\n\n" if req.title else ""
    payload = {
        "model": SUMMARY_MODEL,
        "instructions": instructions,
        "input": f"{title}Transcript:\n{req.text}",
        "store": False,
    }
    try:
        resp = await _http().post(OPENAI_RESPONSES_URL, headers=_openai_headers(api_key), json=payload, timeout=120.0)
    except httpx.RequestError as exc:
        logger.error("Network error reaching summary service: %s", type(exc).__name__)
        raise HTTPException(502, "The summary could not be created. Try again shortly.")
    if resp.status_code >= 400:
        logger.error("OpenAI summary error %s", resp.status_code)
        _raise_upstream(resp.status_code, _upstream_code(resp.content), "summary model")
    try:
        summary = _response_text(resp.json())
    except ValueError:
        summary = ""
    if not summary:
        raise HTTPException(502, "The summary service returned no text. Try again shortly.")
    return JSONResponse({"summary": summary, "model": SUMMARY_MODEL}, headers={"Cache-Control": "no-store"})


# ==========================================================================
# V1 — Multi-listener broadcast (ONE OpenAI session -> many listeners)
# ==========================================================================
from fastapi import WebSocket, WebSocketDisconnect

MAX_LISTENERS = int(os.environ.get("MAX_LISTENERS", "30"))
MAX_EVENTS = int(os.environ.get("MAX_EVENTS", "100"))
EVENT_TTL = int(os.environ.get("EVENT_TTL_SECONDS", "86400"))
EVENTS = EventStore(os.environ.get("EVENTS_DB_PATH", str(ROOT_DIR / "data" / "events.sqlite3")))
MAX_LANGUAGES = int(os.environ.get("MAX_LANGUAGES_PER_EVENT", "5"))
# One room per (event, output language). Each room has its own operator
# channel (one OpenAI session) and its own listeners.
ROOMS = {}    # "eid:lang" -> {"operator", "listeners", "audio_off", "init", "format", "rate", "meta"}
AUDIO_FORMATS = {"pcm16": 16000, "webm": None}
SOURCE_LANG = "src"  # floor audio for human interpreters' booths
STORE = KVStore(EVENTS.connection)
LOGO_RE = re.compile(r"^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$")


def _month_key() -> str:
    return "usage:" + datetime.now(timezone.utc).strftime("%Y-%m")


def _month_minutes() -> float:
    return sum((STORE.get(_month_key(), {}) or {}).values()) / 60


def _record_usage(eid: str, lang: str, seconds: float):
    """Count broadcast time of AI channels (an estimate of OpenAI session time)."""
    if seconds <= 0:
        return
    month = STORE.get(_month_key(), {}) or {}
    month[lang] = round(month.get(lang, 0) + seconds, 1)
    STORE.set(_month_key(), month)
    if eid in EVENTS:
        usage = dict(EVENTS[eid].get("usage") or {})
        usage[lang] = round(usage.get(lang, 0) + seconds, 1)
        EVENTS[eid] = {**EVENTS[eid], "usage": usage}


def _targets(eid) -> list:
    ev = EVENTS.get(eid) or {}
    return list(ev.get("targets") or ([ev["target"]] if ev.get("target") else []))


def _room(eid, lang=None):
    lang = lang or (_targets(eid) or ["en"])[0]
    return ROOMS.setdefault(f"{eid}:{lang}", {
        "operator": None, "listeners": set(), "audio_off": set(), "init": None,
        "format": "pcm16", "rate": 16000, "meta": {}, "eid": eid, "lang": lang,
    })


def _event_rooms(eid):
    return [ROOMS[key] for key in [f"{eid}:{lang}" for lang in _targets(eid)] if key in ROOMS]


def _event_listener_count(eid) -> int:
    return sum(len(r["listeners"]) for r in _event_rooms(eid))


def _clean_meta(raw: dict) -> dict:
    voice = raw.get("voice")
    mode = raw.get("mode")
    return {
        "mode": mode if mode in ("original", "studio", "human") else "original",
        "voice": voice[:40] if isinstance(voice, str) else None,
    }


def _listener_status(room) -> dict:
    return {"type": "status", "live": bool(room["operator"]), "format": room["format"], "rate": room["rate"], "meta": room["meta"]}


class EventCreate(BaseModel):
    name: str = Field(default="Live Interpretation", max_length=200)
    organization: str = Field(default="", max_length=200)
    target_language: str = Field(default="en", max_length=10)
    extra_languages: list[str] = Field(default_factory=list, max_length=10)
    human_languages: list[str] = Field(default_factory=list, max_length=10)
    pin: str | None = Field(default=None, max_length=64)
    captions: bool = False
    logo: str | None = Field(default=None, max_length=300000)
    sponsor: str = Field(default="", max_length=160)


def _check_logo(logo):
    if logo and not LOGO_RE.match(logo):
        raise HTTPException(400, "The logo must be a PNG, JPEG or WebP image under 220 KB.")
    return logo or None


def _resolve_targets(primary: str, extra: list) -> list:
    targets = []
    for lang in [primary, *extra]:
        lang = _resolve_target_language(lang)
        if lang not in targets:
            targets.append(lang)
    if len(targets) > MAX_LANGUAGES:
        raise HTTPException(400, f"An event can offer at most {MAX_LANGUAGES} languages.")
    return targets


def _prune_events():
    for eid, event in list(EVENTS.items()):
        rooms = _event_rooms(eid)
        busy = any(r["operator"] or r["listeners"] for r in rooms)
        if time.time() - event["created"] > EVENT_TTL and not busy:
            EVENTS.pop(eid, None)
            for key in [k for k in ROOMS if k.startswith(eid + ":")]:
                ROOMS.pop(key, None)


@api_router.post("/events", dependencies=[Depends(require_operator)])
async def create_event(body: EventCreate):
    _prune_events()
    if len(EVENTS) >= MAX_EVENTS:
        raise HTTPException(429, "Event capacity reached. Try again later.")
    targets = _resolve_targets(body.target_language, body.extra_languages)
    target = targets[0]
    human = [lang.lower() for lang in body.human_languages if lang.lower() in targets[1:]]
    logo = _check_logo(body.logo)
    eid = secrets.token_urlsafe(12)
    token = secrets.token_urlsafe(32)
    interpreter_code = secrets.token_urlsafe(9)
    EVENTS[eid] = {
        "name": body.name or "Live Interpretation",
        "organization": body.organization or "",
        "target": target,
        "targets": targets,
        "human": human,
        "interpreter_hash": hashlib.sha256(interpreter_code.encode()).hexdigest(),
        "logo": logo,
        "sponsor": body.sponsor.strip(),
        "summaries": {},
        "usage": {},
        "operator_token_hash": hashlib.sha256(token.encode()).hexdigest(),
        "pin_hash": hashlib.sha256(body.pin.encode()).hexdigest() if body.pin else None,
        "captions": bool(body.captions),
        "created": time.time(),
    }
    _room(eid)
    logger.info("Event created %s", eid)
    return JSONResponse({"id": eid, "path": f"/e/{eid}", "operator_token": token, "interpreter_code": interpreter_code, **_public_event(eid)}, headers={"Cache-Control": "no-store"})


def _public_event(eid):
    ev = EVENTS.get(eid)
    if not ev:
        return None
    channels = []
    for lang in _targets(eid):
        room = ROOMS.get(f"{eid}:{lang}", {})
        channels.append({"lang": lang, "live": bool(room.get("operator")), "listeners": len(room.get("listeners", ()))})
    return {
        "name": ev["name"], "organization": ev["organization"], "target": ev["target"],
        "targets": _targets(eid), "channels": channels, "human": list(ev.get("human") or []),
        "logo": ev.get("logo"), "sponsor": ev.get("sponsor", ""), "summaries": dict(ev.get("summaries") or {}),
        "captions": ev["captions"], "pin_protected": ev["pin_hash"] is not None,
        "live": any(c["live"] for c in channels), "listeners": sum(c["listeners"] for c in channels),
        "max_listeners": MAX_LISTENERS,
        "created": ev["created"],
        "expires_at": ev["created"] + EVENT_TTL,
    }


@api_router.get("/events", dependencies=[Depends(require_operator)])
async def list_events():
    _prune_events()
    return {"events": [{"id": eid, **_public_event(eid), "usage": EVENTS[eid].get("usage") or {}} for eid in sorted(EVENTS, key=lambda eid: EVENTS[eid]["created"], reverse=True)]}


def _require_event(eid):
    _prune_events()
    if eid not in EVENTS:
        raise HTTPException(404, "Event expired or not found. Create a new event.")
    return EVENTS[eid]


@api_router.post("/events/{eid}/interpreter-code", dependencies=[Depends(require_operator)])
async def rotate_interpreter_code(eid: str):
    ev = _require_event(eid)
    code = secrets.token_urlsafe(9)
    EVENTS[eid] = {**ev, "interpreter_hash": hashlib.sha256(code.encode()).hexdigest()}
    return JSONResponse({"interpreter_code": code}, headers={"Cache-Control": "no-store"})


class BrandingUpdate(BaseModel):
    logo: str | None = Field(default=None, max_length=300000)
    sponsor: str = Field(default="", max_length=160)


@api_router.put("/events/{eid}/branding", dependencies=[Depends(require_operator)])
async def update_branding(eid: str, body: BrandingUpdate):
    ev = _require_event(eid)
    EVENTS[eid] = {**ev, "logo": _check_logo(body.logo), "sponsor": body.sponsor.strip()}
    return {"id": eid, **_public_event(eid)}


class PublishedSummary(BaseModel):
    lang: str = Field(max_length=10)
    text: str = Field(min_length=1, max_length=20000)


@api_router.put("/events/{eid}/summaries", dependencies=[Depends(require_operator)])
async def publish_summary(eid: str, body: PublishedSummary):
    """Opt-in: the operator publishes a summary that listeners can read on the event page."""
    ev = _require_event(eid)
    lang = body.lang.lower()
    if lang not in LANGUAGE_NAMES:
        raise HTTPException(400, "Unknown summary language.")
    summaries = {**(ev.get("summaries") or {}), lang: body.text}
    EVENTS[eid] = {**ev, "summaries": summaries}
    return {"summaries": summaries}


@api_router.delete("/events/{eid}/summaries/{lang}", dependencies=[Depends(require_operator)])
async def unpublish_summary(eid: str, lang: str):
    ev = _require_event(eid)
    summaries = {k: v for k, v in (ev.get("summaries") or {}).items() if k != lang.lower()}
    EVENTS[eid] = {**ev, "summaries": summaries}
    return {"summaries": summaries}


@api_router.get("/usage", dependencies=[Depends(require_operator)])
async def usage():
    month = STORE.get(_month_key(), {}) or {}
    return {
        "month": _month_key().split(":", 1)[1],
        "minutes_by_language": {k: round(v / 60, 1) for k, v in month.items()},
        "total_minutes": round(sum(month.values()) / 60, 1),
        "cap_minutes": USAGE_CAP_MINUTES or None,
    }


class GlossaryEntry(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    text: str = Field(default="", max_length=4000)


class Library(BaseModel):
    glossaries: list[GlossaryEntry] = Field(default_factory=list, max_length=50)


@api_router.get("/library", dependencies=[Depends(require_operator)])
async def get_library():
    return STORE.get("library", {"glossaries": []})


@api_router.put("/library", dependencies=[Depends(require_operator)])
async def put_library(body: Library):
    data = body.model_dump()
    STORE.set("library", data)
    return data


class CaptionRelayRequest(BaseModel):
    provider: Literal["zoom", "teams"]
    url: str = Field(min_length=10, max_length=2000)
    text: str = Field(min_length=1, max_length=500)
    lang: str = Field(default="en-US", max_length=16)
    seq: int = Field(default=0, ge=0)


RELAY_HOSTS = {
    "zoom": re.compile(r"^([a-z0-9-]+\.)*zoom\.us$"),
    "teams": re.compile(r"^api\.captions\.office\.microsoft\.com$"),
}


def _relay_url(req: CaptionRelayRequest) -> str:
    parts = urlsplit(req.url.strip())
    host = (parts.hostname or "").lower()
    if parts.scheme != "https" or not RELAY_HOSTS[req.provider].match(host) or parts.port not in (None, 443):
        raise HTTPException(400, f"This is not a {req.provider.title()} caption link.")
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k not in ("seq", "lang")]
    if req.provider == "zoom":
        query += [("seq", str(req.seq)), ("lang", req.lang)]
    else:
        query += [("lang", req.lang.lower())]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), ""))


@api_router.post("/caption-relay", dependencies=[Depends(require_operator)])
async def caption_relay(req: CaptionRelayRequest, request: Request):
    """Forward one caption line to a Zoom (API token) or Teams (CART) meeting."""
    if _rate_limited("relay:" + _client_ip(request), 900):
        raise HTTPException(429, "Too many caption lines. Slow down.")
    url = _relay_url(req)
    try:
        resp = await _http().post(url, content=req.text.encode("utf-8"), headers={"Content-Type": "text/plain; charset=utf-8"}, timeout=10.0)
    except httpx.RequestError as exc:
        logger.warning("Caption relay network error: %s", type(exc).__name__)
        raise HTTPException(502, "The meeting caption service could not be reached.")
    return {"ok": resp.status_code < 300, "status": resp.status_code}


@api_router.post("/events/{eid}/resume", dependencies=[Depends(require_operator)])
async def resume_event(eid: str):
    _prune_events()
    if eid not in EVENTS:
        raise HTTPException(404, "Event expired or not found. Create a new event.")
    if any(r["operator"] is not None for r in _event_rooms(eid)):
        raise HTTPException(409, "This event is already broadcasting in another tab. Stop it there before resuming.")
    token = secrets.token_urlsafe(32)
    EVENTS[eid] = {**EVENTS[eid], "operator_token_hash": hashlib.sha256(token.encode()).hexdigest()}
    return JSONResponse({"id": eid, "path": f"/e/{eid}", "operator_token": token, **_public_event(eid)}, headers={"Cache-Control": "no-store"})


@api_router.get("/events/{eid}")
async def get_event(eid: str):
    _prune_events()
    info = _public_event(eid)
    if not info:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"id": eid, **info}


def _check_pin(eid, pin):
    ev = EVENTS.get(eid)
    if not ev or ev["pin_hash"] is None:
        return True
    return pin is not None and hashlib.sha256(pin.encode()).hexdigest() == ev["pin_hash"]


@api_router.get("/stats", dependencies=[Depends(require_operator)])
async def stats():
    import psutil
    return {
        "cpu_percent": psutil.cpu_percent(interval=None),
        "ram_percent": psutil.virtual_memory().percent,
        "openai_sessions": sum(bool(r.get("operator")) for r in ROOMS.values()),
        "total_listeners": sum(len(r["listeners"]) for r in ROOMS.values()),
        "events": [{"id": r["eid"], "lang": r["lang"], "listeners": len(r["listeners"]), "live": bool(r["operator"])} for r in ROOMS.values()],
        "max_listeners": MAX_LISTENERS,
    }


async def _notify_operator(eid):
    total = _event_listener_count(eid)
    for room in _event_rooms(eid):
        if room["operator"]:
            try:
                await asyncio.wait_for(room["operator"].send_json({"type": "listeners", "count": len(room["listeners"]), "total": total}), timeout=2)
            except Exception:
                pass


async def _broadcast_status(room, live):
    await _fanout(room, "send_json", {**_listener_status(room), "live": live})

async def _fanout(room, method, data):
    targets = list(room["listeners"])
    if method == "send_bytes":
        targets = [listener for listener in targets if listener not in room["audio_off"]]

    async def deliver(listener):
        try:
            await asyncio.wait_for(getattr(listener, method)(data), timeout=2)
        except Exception:
            room["listeners"].discard(listener)
            room["audio_off"].discard(listener)
            try:
                await asyncio.wait_for(listener.close(code=1013), timeout=1)
            except Exception:
                pass
    await asyncio.gather(*(deliver(listener) for listener in targets))


async def _run_operator(websocket: WebSocket, eid: str, room, audio_format: str = "pcm16", rate: int = 16000, counts_usage: bool = True):
    started = time.monotonic()
    room["operator"] = websocket
    room["init"] = None
    room["format"] = audio_format
    room["rate"] = rate
    room["meta"] = {}
    try:
        await websocket.send_json({"type": "ready", "lang": room["lang"]})
        await _broadcast_status(room, True)
        await _notify_operator(eid)
        while True:
            msg = await websocket.receive()
            if msg["type"] == "websocket.disconnect":
                break
            if msg.get("bytes") is not None:
                data = msg["bytes"]
                if len(data) > 262144:
                    await websocket.close(code=1009)
                    break
                if room["format"] == "webm" and room["init"] is None:
                    room["init"] = data  # legacy WebM: cache header segment for late joiners
                await _fanout(room, "send_bytes", data)
            elif msg.get("text") is not None:
                try:
                    caption = json.loads(msg["text"])
                    if not isinstance(caption, dict):
                        continue
                    if caption.get("type") == "meta":
                        room["meta"] = _clean_meta(caption)
                        await _fanout(room, "send_json", {"type": "meta", **room["meta"]})
                        continue
                    if caption.get("type") == "caption" and isinstance(caption.get("text"), str):
                        enabled = bool(caption["text"])
                        if EVENTS[eid]["captions"] != enabled:
                            EVENTS[eid] = {**EVENTS[eid], "captions": enabled}
                        await _fanout(room, "send_json", {"type": "caption", "text": caption["text"][-6000:]})
                except (ValueError, AttributeError):
                    pass
    except WebSocketDisconnect:
        pass
    finally:
        room["operator"] = None
        room["init"] = None
        if counts_usage and room["lang"] != SOURCE_LANG:
            try:
                _record_usage(eid, room["lang"], time.monotonic() - started)
            except Exception:  # usage is informative; never break teardown
                logger.exception("Could not record usage")
        with anyio.CancelScope(shield=True):
            await _broadcast_status(room, False)


async def _run_listener(websocket: WebSocket, eid: str, room, pin, wants_audio=True, booth=False):
    if not booth and not _check_pin(eid, pin):
        await websocket.close(code=4401)
        return
    if not booth and _event_listener_count(eid) >= MAX_LISTENERS:
        await websocket.close(code=4429)
        return
    room["listeners"].add(websocket)
    if not wants_audio:
        room["audio_off"].add(websocket)
    await _notify_operator(eid)
    try:
        await websocket.send_json(_listener_status(room))
        if room["init"]:
            await websocket.send_bytes(room["init"])
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        pass
    finally:
        room["listeners"].discard(websocket)
        room["audio_off"].discard(websocket)
        await _notify_operator(eid)


@app.websocket("/api/ws/{eid}")
async def ws_broadcast(websocket: WebSocket, eid: str, role: str = "listener", lang: str | None = None, audio: str = "1"):
    _prune_events()
    if eid not in EVENTS:
        await websocket.accept()
        await websocket.close(code=4404)
        return
    await websocket.accept()
    origin = websocket.headers.get("origin")
    if origin and origin not in _cors_origins:
        await websocket.close(code=4403)
        return
    if _rate_limited("ws:" + _client_ip(websocket), 120):
        await websocket.close(code=4429)
        return
    lang = (lang or _targets(eid)[0]).lower()
    if lang not in _targets(eid) and lang != SOURCE_LANG:
        await websocket.close(code=4404)
        return
    room = _room(eid, lang)
    try:
        auth = await asyncio.wait_for(websocket.receive_json(), timeout=10)
        if not isinstance(auth, dict):
            raise ValueError("Invalid authentication")
    except WebSocketDisconnect:
        return
    except (asyncio.TimeoutError, ValueError, KeyError):
        await websocket.close(code=4401)
        return
    if eid not in EVENTS:
        await websocket.close(code=4404)
        return
    def _code_ok(value):
        return isinstance(value, str) and bool(EVENTS[eid].get("interpreter_hash")) and secrets.compare_digest(
            hashlib.sha256(value.encode()).hexdigest(), EVENTS[eid]["interpreter_hash"])

    if role in ("interpreter", "booth"):
        if not _code_ok(auth.get("code")):
            await websocket.close(code=4401)
            return
        if role == "booth":
            if lang != SOURCE_LANG:
                await websocket.close(code=4400)
                return
            await _run_listener(websocket, eid, room, None, booth=True)
            return
        if lang not in (EVENTS[eid].get("human") or []):
            await websocket.close(code=4403)
            return
        if room["operator"] is not None:
            await websocket.close(code=4409)
            return
        room["operator"] = websocket
        await _run_operator(websocket, eid, room, "pcm16", 16000, counts_usage=False)
        return
    if lang == SOURCE_LANG and role != "operator":
        await websocket.close(code=4403)
        return
    if role == "operator":
        token = auth.get("token", "")
        if not isinstance(token, str) or not secrets.compare_digest(hashlib.sha256(token.encode()).hexdigest(), EVENTS[eid]["operator_token_hash"]):
            await websocket.close(code=4401)
            return
        if room["operator"] is not None:
            await websocket.close(code=4409)
            return
        audio_format = auth.get("format", "webm")
        if audio_format not in AUDIO_FORMATS:
            await websocket.close(code=4400)
            return
        rate = AUDIO_FORMATS[audio_format] or 48000
        # Reserve before any await to prevent simultaneous operator takeover.
        room["operator"] = websocket
        await _run_operator(websocket, eid, room, audio_format, rate)
    elif role == "listener":
        pin = auth.get("pin")
        if pin is not None and not isinstance(pin, str):
            await websocket.close(code=4401)
            return
        await _run_listener(websocket, eid, room, pin, wants_audio=audio != "0")
    else:
        await websocket.close(code=4400)


app.include_router(api_router)

app.add_middleware(BodyLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

# Authentication uses explicit bearer headers, not browser cookies.
_cors_origins = [o.strip().rstrip('/') for o in os.environ.get('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',') if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
