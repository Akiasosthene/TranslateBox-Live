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
import socket
import ipaddress
import string
import re
import smtplib
import ssl
from email.message import EmailMessage
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
import accounts
import ingest
import live_engine
import billing


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# OpenAI Realtime Translation configuration
# OPENAI_API_BASE lets a test point every HTTP call at a local stand-in.
OPENAI_API_BASE = os.environ.get("OPENAI_API_BASE", "https://api.openai.com").rstrip("/")
OPENAI_CLIENT_SECRETS_URL = OPENAI_API_BASE + "/v1/realtime/translations/client_secrets"
REALTIME_MODEL = os.environ.get("OPENAI_REALTIME_MODEL", "gpt-realtime-translate")
INPUT_TRANSCRIPTION_MODEL = "gpt-realtime-whisper"

# Studio voices: translated text re-voiced with OpenAI text-to-speech.
OPENAI_SPEECH_URL = OPENAI_API_BASE + "/v1/audio/speech"
TTS_MODEL = os.environ.get("OPENAI_TTS_MODEL", "gpt-4o-mini-tts")
STUDIO_VOICES = {
    "alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx",
    "sage", "shimmer", "verse", "marin", "cedar",
}
TTS_RATE_MAX = int(os.environ.get("TTS_RATE_LIMIT_MAX", "300"))
# Post-session AI summaries (Responses API).
OPENAI_RESPONSES_URL = OPENAI_API_BASE + "/v1/responses"
SUMMARY_MODEL = os.environ.get("OPENAI_SUMMARY_MODEL", "gpt-6-luna")
SUMMARY_MAX_BODY = int(os.environ.get("SUMMARY_MAX_BODY_BYTES", "600000"))
LARGE_BODY_BYTES = int(os.environ.get("LARGE_BODY_BYTES", "2500000"))
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

# Languages without direct realtime interpretation: translated as text and
# spoken with a studio voice on the server (adds about 2-4 s of delay).
CASCADE_LANGUAGES = {
    "ar": "Arabic", "sw": "Swahili", "ln": "Lingala", "ur": "Urdu", "ta": "Tamil", "pa": "Punjabi",
    "bn": "Bengali", "tr": "Turkish", "pl": "Polish", "nl": "Dutch", "uk": "Ukrainian", "ro": "Romanian",
    "el": "Greek", "cs": "Czech", "sv": "Swedish", "da": "Danish", "fi": "Finnish", "no": "Norwegian",
    "he": "Hebrew", "fa": "Persian", "th": "Thai", "ms": "Malay", "tl": "Filipino", "am": "Amharic",
    "yo": "Yoruba", "ha": "Hausa", "ig": "Igbo", "ht": "Haitian Creole", "rw": "Kinyarwanda", "so": "Somali",
    "zu": "Zulu", "hu": "Hungarian", "bg": "Bulgarian", "hr": "Croatian", "sr": "Serbian", "sk": "Slovak",
    "ne": "Nepali", "mr": "Marathi", "te": "Telugu", "gu": "Gujarati", "kn": "Kannada", "ml": "Malayalam",
}
LANGUAGE_NAMES.update(CASCADE_LANGUAGES)
# Live sentence translation needs a fast model: the time it takes is heard
# by every listener as delay.
CASCADE_MODEL = os.environ.get("OPENAI_CASCADE_MODEL", "") or "gpt-4.1-mini"

# The 13 output languages supported by gpt-realtime-translate.
SUPPORTED_OUTPUT_LANGUAGES = {
    "en", "es", "pt", "fr", "ja", "ru", "zh", "de", "ko", "hi", "id", "vi", "it",
}

# Abuse controls for operator sessions and public listener connections.
MAX_INSTRUCTIONS_LEN = int(os.environ.get("MAX_INSTRUCTIONS_LEN", "6000"))
MAX_BODY_BYTES = int(os.environ.get("MAX_BODY_BYTES", "32768"))  # 32 KB
# Each language opens its own session and all of them reconnect together after
# a network drop, so the per-IP budget must cover 5 languages retrying.
RATE_LIMIT_MAX = int(os.environ.get("SESSION_RATE_LIMIT_MAX", "90"))
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


# Signed-in sessions (password or single sign-on), persisted in the KV store
# as sha256(token) so a backend restart keeps people signed in.
SESSION_TTL = int(os.environ.get("SSO_SESSION_HOURS", "12")) * 3600
OWNER_PRINCIPAL = {"id": "owner", "role": "owner", "email": None, "name": "Operator code", "via": "code"}


def _sso_enabled() -> bool:
    return all(os.environ.get(k) for k in ("OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET"))


def _users() -> list:
    return list(STORE.get("users", []) or [])


def _save_users(users):
    STORE.set("users", users)


def _find_user(uid=None, email=None):
    for user in _users():
        if (uid and user["id"] == uid) or (email and user["email"] == email.lower()):
            return user
    return None


def _update_user(uid, **fields):
    users = _users()
    for i, user in enumerate(users):
        if user["id"] == uid:
            users[i] = {**user, **fields}
            _save_users(users)
            return users[i]
    return None


def _session_key(token: str) -> str:
    return "sess:" + hashlib.sha256(token.encode()).hexdigest()


def _new_session(uid: str, via: str) -> str:
    token = "tbs_" + secrets.token_urlsafe(32)
    STORE.set(_session_key(token), {"uid": uid, "via": via, "exp": time.time() + SESSION_TTL})
    return token


def _session_user(token: str):
    record = STORE.get(_session_key(token))
    if not record:
        return None
    if record["exp"] < time.time():
        STORE.delete_prefix(_session_key(token))
        return None
    user = _find_user(uid=record["uid"])
    if not user or user.get("disabled"):
        return None
    return {**user, "via": record.get("via", "password")}


def _principal(request: Request):
    supplied = request.headers.get("authorization", "")
    if not supplied.startswith("Bearer "):
        return None
    return _principal_from_token(supplied[7:])


def _principal_from_token(token: str):
    if not isinstance(token, str) or not token:
        return None
    expected = os.environ.get("OPERATOR_TOKEN", "")
    if len(expected) >= 32 and secrets.compare_digest(token.encode(), expected.encode()):
        return OWNER_PRINCIPAL
    if token.startswith("tbk_"):
        digest = hashlib.sha256(token.encode()).hexdigest()
        for key in STORE.get("apikeys", []) or []:
            if secrets.compare_digest(digest, key["hash"]):
                uid = key.get("user_id") or "owner"
                if uid != "owner":
                    user = _find_user(uid=uid)
                    if not user or user.get("disabled"):
                        return None
                role = key.get("role") or "admin"
                return {"id": uid, "role": role, "email": None, "name": key.get("name"), "via": "key"}
        return None
    if token.startswith("tbs_"):
        user = _session_user(token)
        if user:
            return {"id": user["id"], "role": user["role"], "email": user["email"], "name": user.get("name", ""), "via": user["via"]}
    return None


def _rank(principal) -> int:
    return accounts.ROLE_RANK.get((principal or {}).get("role"), 0)


def require_operator(request: Request):
    if _rate_limited("auth:" + _client_ip(request), 120):
        raise HTTPException(429, "Too many requests. Try again shortly.")
    expected = os.environ.get("OPERATOR_TOKEN", "")
    if len(expected) < 32 and not _sso_enabled() and not STORE.get("users"):
        raise HTTPException(503, "Operator access is not configured on the server.")
    principal = _principal(request)
    if not principal:
        raise HTTPException(401, "Operator access required.")
    request.state.principal = principal
    # Presenters only reach their own sessions.
    eid = request.path_params.get("eid")
    if eid and _rank(principal) < accounts.ROLE_RANK["admin"]:
        ev = EVENTS.get(eid)
        if ev and ev.get("owner") != principal["id"]:
            raise HTTPException(404, "Event expired or not found. Create a new event.")
    return principal


def require_admin(request: Request):
    principal = require_operator(request)
    if _rank(principal) < accounts.ROLE_RANK["admin"]:
        raise HTTPException(403, "Administrator access required.")
    return principal


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


@api_router.get("/operator")
async def operator_access(principal: dict = Depends(require_operator)):
    return {"status": "ok", "email": principal.get("email"), "role": principal["role"], "id": principal["id"], "name": principal.get("name")}


@api_router.post("/auth/logout")
async def logout(request: Request):
    supplied = request.headers.get("authorization", "")
    if supplied.startswith("Bearer tbs_"):
        STORE.delete_prefix(_session_key(supplied[7:]))
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
    return RedirectResponse(_public_origin() + "/login#sso_error=" + urlencode({"m": message})[2:], status_code=302)


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
    if info.get("email_verified") is False or not (_sso_allowed(email) or _find_user(email=email or "-")):
        logger.info("SSO refused for an account outside OIDC_ALLOWED")
        return _sso_fail("This account is not allowed to operate TranslateBox.")
    email = email.lower()
    user = _find_user(email=email)
    if user is None:
        role = os.environ.get("OIDC_DEFAULT_ROLE", "presenter")
        user = _create_user(email, info.get("name") or email.split("@")[0], role if role in accounts.ROLES else "presenter", None)
    if user.get("disabled"):
        return _sso_fail("This account is not allowed to operate TranslateBox.")
    session = _new_session(user["id"], "sso")
    logger.info("SSO operator signed in")
    return RedirectResponse(_public_origin() + "/login#sso=" + session, status_code=302)


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


@api_router.post("/realtime-session")
async def create_realtime_session(req: SessionRequest, request: Request, principal: dict = Depends(require_operator)):
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

    _check_balance(principal)
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

MAX_LISTENERS = int(os.environ.get("MAX_LISTENERS", "300"))
WS_RATE_LIMIT_MAX = int(os.environ.get("WS_RATE_LIMIT_MAX", "2000"))  # WebSocket handshakes per IP per minute
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
        _charge_minutes(EVENTS[eid].get("owner"), seconds)


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
    start_at: str | None = Field(default=None, max_length=40)
    duration_minutes: int = Field(default=0, ge=0, le=1440)
    labels: list[str] = Field(default_factory=list, max_length=10)
    pinned: bool = False
    archive_transcripts: bool = False


def _clean_labels(labels):
    return [l.strip()[:40] for l in labels if isinstance(l, str) and l.strip()][:10]


def _check_start(start_at):
    if not start_at:
        return None
    try:
        return datetime.fromisoformat(start_at.replace("Z", "+00:00")).isoformat()
    except ValueError:
        raise HTTPException(400, "Invalid start date and time.")


def _new_code() -> str:
    """Short session code typed by attendees: 4 letters + 4 digits (e.g. QFTR4821)."""
    used = {ev.get("code") for ev in EVENTS.values()}
    letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"  # no I/O, easy to read aloud
    while True:
        code = "".join(secrets.choice(letters) for _ in range(4)) + "".join(secrets.choice(string.digits) for _ in range(4))
        if code not in used:
            return code


def _event_end_ts(ev) -> float:
    end = ev["created"]
    if ev.get("start_at"):
        try:
            end = max(end, datetime.fromisoformat(ev["start_at"]).timestamp() + 60 * (ev.get("duration_minutes") or 0))
        except ValueError:
            pass
    return end


def _check_logo(logo):
    if logo and not LOGO_RE.match(logo):
        raise HTTPException(400, "The logo must be a PNG, JPEG or WebP image under 220 KB.")
    return logo or None


def _resolve_targets(primary: str, extra: list) -> list:
    targets = [_resolve_target_language(primary)]
    for lang in extra:
        lang = (lang or "").lower()
        if lang not in CASCADE_LANGUAGES:
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
        if time.time() - _event_end_ts(event) > EVENT_TTL and not busy and not event.get("pinned"):
            _drop_event(eid)


def _drop_event(eid):
    EVENTS.pop(eid, None)
    for key in [k for k in ROOMS if k.startswith(eid + ":")]:
        ROOMS.pop(key, None)
    STORE.delete_prefix(f"tx:{eid}:")
    STORE.delete_prefix(f"txindex:{eid}")


@api_router.post("/events")
async def create_event(body: EventCreate, principal: dict = Depends(require_operator)):
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
        "code": _new_code(),
        "start_at": _check_start(body.start_at),
        "duration_minutes": body.duration_minutes,
        "labels": _clean_labels(body.labels),
        "pinned": body.pinned,
        "archive": body.archive_transcripts,
        "peak_listeners": 0,
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
        "owner": principal["id"],
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
    if not ev.get("code"):
        ev = {**ev, "code": _new_code()}
        EVENTS[eid] = ev
    return {
        "code": ev["code"], "start_at": ev.get("start_at"), "duration_minutes": ev.get("duration_minutes", 0),
        "labels": list(ev.get("labels") or []), "pinned": bool(ev.get("pinned")), "archive": bool(ev.get("archive")),
        "name": ev["name"], "organization": ev["organization"], "target": ev["target"],
        "targets": _targets(eid), "channels": channels, "human": list(ev.get("human") or []),
        "logo": ev.get("logo"), "sponsor": ev.get("sponsor", ""), "summaries": dict(ev.get("summaries") or {}),
        "captions": ev["captions"], "pin_protected": ev["pin_hash"] is not None,
        "live": any(c["live"] for c in channels), "listeners": sum(c["listeners"] for c in channels),
        "max_listeners": MAX_LISTENERS,
        "created": ev["created"],
        "expires_at": None if ev.get("pinned") else _event_end_ts(ev) + EVENT_TTL,
    }


@api_router.get("/events")
async def list_events(principal: dict = Depends(require_operator)):
    _prune_events()
    admin = _rank(principal) >= accounts.ROLE_RANK["admin"]
    owners = {u["id"]: u.get("name") or u["email"] for u in _users()} if admin else {}
    return {"events": [{"id": eid, **_public_event(eid), "usage": EVENTS[eid].get("usage") or {},
                        "archive": bool(EVENTS[eid].get("archive")), "peak_listeners": EVENTS[eid].get("peak_listeners", 0),
                        "transcripts": _transcript_index(eid), "owner": EVENTS[eid].get("owner"),
                        "owner_name": owners.get(EVENTS[eid].get("owner")) or ("Operator code" if EVENTS[eid].get("owner") in (None, "owner") else None)}
                       for eid in sorted(EVENTS, key=lambda eid: EVENTS[eid]["created"], reverse=True)
                       if admin or EVENTS[eid].get("owner") == principal["id"]]}


@api_router.get("/join/{code}")
async def join_by_code(code: str, request: Request):
    """Attendees type the short session code instead of scanning the QR code."""
    if _rate_limited("join:" + _client_ip(request), 60):
        raise HTTPException(429, "Too many attempts. Wait a minute.")
    _prune_events()
    wanted = re.sub(r"[^A-Z0-9]", "", code.upper())
    for eid, ev in EVENTS.items():
        if ev.get("code") == wanted:
            return {"id": eid}
    raise HTTPException(404, "No session with this code.")


class EventUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    organization: str | None = Field(default=None, max_length=200)
    start_at: str | None = Field(default=None, max_length=40)
    duration_minutes: int | None = Field(default=None, ge=0, le=1440)
    labels: list[str] | None = Field(default=None, max_length=10)
    pinned: bool | None = None
    archive_transcripts: bool | None = None
    captions: bool | None = None


@api_router.patch("/events/{eid}", dependencies=[Depends(require_operator)])
async def update_event(eid: str, body: EventUpdate):
    ev = dict(_require_event(eid))
    if body.name is not None:
        ev["name"] = body.name or "Live Interpretation"
    if body.organization is not None:
        ev["organization"] = body.organization
    if body.start_at is not None:
        ev["start_at"] = _check_start(body.start_at)
    if body.duration_minutes is not None:
        ev["duration_minutes"] = body.duration_minutes
    if body.labels is not None:
        ev["labels"] = _clean_labels(body.labels)
    if body.pinned is not None:
        ev["pinned"] = body.pinned
    if body.archive_transcripts is not None:
        ev["archive"] = body.archive_transcripts
    if body.captions is not None:
        ev["captions"] = body.captions
    EVENTS[eid] = ev
    return {"id": eid, **_public_event(eid), "archive": bool(ev.get("archive"))}


@api_router.post("/events/{eid}/clone")
async def clone_event(eid: str, principal: dict = Depends(require_operator)):
    ev = _require_event(eid)
    if len(EVENTS) >= MAX_EVENTS:
        raise HTTPException(429, "Event capacity reached. Try again later.")
    body = EventCreate(
        name=f"{ev['name']} (copy)"[:200], organization=ev["organization"], target_language=ev["target"],
        extra_languages=_targets(eid)[1:], human_languages=list(ev.get("human") or []), captions=ev["captions"],
        logo=ev.get("logo"), sponsor=ev.get("sponsor", ""), duration_minutes=ev.get("duration_minutes", 0),
        labels=list(ev.get("labels") or []), archive_transcripts=bool(ev.get("archive")),
    )
    response = await create_event(body, principal)
    created = json.loads(response.body)
    if ev.get("pin_hash"):
        EVENTS[created["id"]] = {**EVENTS[created["id"]], "pin_hash": ev["pin_hash"]}
    return JSONResponse({**created, **_public_event(created["id"])}, headers={"Cache-Control": "no-store"})


@api_router.delete("/events/{eid}", dependencies=[Depends(require_operator)])
async def delete_event(eid: str):
    _require_event(eid)
    if any(r["operator"] for r in _event_rooms(eid)):
        raise HTTPException(409, "Stop the broadcast before deleting this event.")
    _drop_event(eid)
    return {"deleted": eid}


# ---------------------------------------------------------------------------
# Transcript archive (opt-in per event). The operator's browser uploads the
# timed segments; they are kept until the event is deleted or expires.
# ---------------------------------------------------------------------------
class Segment(BaseModel):
    start: float = Field(ge=0)
    end: float = Field(ge=0)
    text: str = Field(max_length=4000)
    speaker: str | None = Field(default=None, max_length=80)


class TranscriptUpload(BaseModel):
    segments: list[Segment] = Field(max_length=8000)
    source_lang: str | None = Field(default=None, max_length=10)


TX_LANGS = set(LANGUAGE_NAMES) | {"src"}


def _transcript_index(eid):
    index = STORE.get(f"txindex:{eid}", {}) or {}
    return [{"lang": lang, **meta} for lang, meta in sorted(index.items())]


def _save_transcript(eid, lang, segments, translated_from=None):
    STORE.set(f"tx:{eid}:{lang}", segments)
    index = STORE.get(f"txindex:{eid}", {}) or {}
    index[lang] = {"segments": len(segments), "updated": time.time(), "translated_from": translated_from}
    STORE.set(f"txindex:{eid}", index)


@api_router.put("/events/{eid}/transcripts/{lang}", dependencies=[Depends(require_operator)])
async def upload_transcript(eid: str, lang: str, body: TranscriptUpload):
    ev = _require_event(eid)
    lang = lang.lower()
    if lang not in TX_LANGS:
        raise HTTPException(400, "Unknown transcript language.")
    if not ev.get("archive"):
        raise HTTPException(403, "Transcript archiving is off for this event.")
    _save_transcript(eid, lang, [s.model_dump() for s in body.segments])
    return {"lang": lang, "segments": len(body.segments)}


@api_router.get("/events/{eid}/transcripts", dependencies=[Depends(require_operator)])
async def list_transcripts(eid: str):
    _require_event(eid)
    return {"transcripts": _transcript_index(eid)}


@api_router.get("/events/{eid}/transcripts/{lang}", dependencies=[Depends(require_operator)])
async def get_transcript(eid: str, lang: str):
    _require_event(eid)
    segments = STORE.get(f"tx:{eid}:{lang.lower()}")
    if segments is None:
        raise HTTPException(404, "No transcript for this language.")
    return JSONResponse({"lang": lang.lower(), "segments": segments}, headers={"Cache-Control": "no-store"})


@api_router.delete("/events/{eid}/transcripts/{lang}", dependencies=[Depends(require_operator)])
async def delete_transcript(eid: str, lang: str):
    _require_event(eid)
    lang = lang.lower()
    STORE.delete_prefix(f"tx:{eid}:{lang}")
    index = STORE.get(f"txindex:{eid}", {}) or {}
    index.pop(lang, None)
    STORE.set(f"txindex:{eid}", index)
    return {"transcripts": _transcript_index(eid)}


class TranslateRequest(BaseModel):
    to: str = Field(max_length=10)


async def _translate_texts(texts, language, api_key):
    payload = {
        "model": SUMMARY_MODEL,
        "instructions": (
            f"Translate each string of the JSON array 'items' into {language}. Return JSON "
            "{\"items\": [...]} with exactly the same number of strings, in the same order. "
            "Keep speaker names, numbers and proper nouns. Translate faithfully; do not summarize."
        ),
        "input": json.dumps({"items": texts}, ensure_ascii=False),
        "text": {"format": {"type": "json_schema", "name": "translation", "strict": True, "schema": {
            "type": "object", "additionalProperties": False,
            "properties": {"items": {"type": "array", "items": {"type": "string"}}}, "required": ["items"]}}},
        "store": False,
    }
    resp = await _http().post(OPENAI_RESPONSES_URL, headers=_openai_headers(api_key), json=payload, timeout=180.0)
    if resp.status_code >= 400:
        logger.error("OpenAI transcript translation error %s", resp.status_code)
        _raise_upstream(resp.status_code, _upstream_code(resp.content), "translation model")
    try:
        items = json.loads(_response_text(resp.json()))["items"]
    except (ValueError, KeyError, TypeError):
        items = None
    if not isinstance(items, list) or len(items) != len(texts):
        raise HTTPException(502, "The translation came back incomplete. Try again.")
    return [str(x) for x in items]


@api_router.post("/events/{eid}/transcripts/{lang}/translate", dependencies=[Depends(require_operator)])
async def translate_transcript(eid: str, lang: str, body: TranslateRequest, request: Request):
    """Translate an archived transcript, keeping its timing (Wordly 'translate transcript')."""
    _require_event(eid)
    if _rate_limited("txtranslate:" + _client_ip(request), 10):
        raise HTTPException(429, "Too many translation requests. Wait a minute.")
    to = body.to.lower()
    if to not in LANGUAGE_NAMES:
        raise HTTPException(400, "Unknown target language.")
    segments = STORE.get(f"tx:{eid}:{lang.lower()}")
    if not segments:
        raise HTTPException(404, "No transcript for this language.")
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(503, "The translation service is not configured on the server.")
    out = []
    try:
        for i in range(0, len(segments), 80):
            chunk = segments[i:i + 80]
            translated = await _translate_texts([s["text"] for s in chunk], LANGUAGE_NAMES[to], api_key)
            out += [{**s, "text": t} for s, t in zip(chunk, translated)]
    except httpx.RequestError as exc:
        logger.error("Network error reaching translation model: %s", type(exc).__name__)
        raise HTTPException(502, "The translation could not be completed. Try again shortly.")
    _save_transcript(eid, to, out, translated_from=lang.lower())
    return {"transcripts": _transcript_index(eid)}


# ---------------------------------------------------------------------------
# Developer API keys: named bearer keys equivalent to the operator code.
# ---------------------------------------------------------------------------
def require_key_admin(request: Request):
    """API keys cannot list, mint or revoke keys: only a signed-in person can."""
    principal = require_operator(request)
    if principal.get("via") == "key":
        raise HTTPException(403, "API keys cannot manage API keys.")
    return principal


class KeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)


def _api_keys():
    return STORE.get("apikeys", []) or []


def _visible_keys(principal):
    keys = _api_keys()
    if _rank(principal) < accounts.ROLE_RANK["admin"]:
        keys = [k for k in keys if k.get("user_id") == principal["id"]]
    return [{k: v for k, v in key.items() if k != "hash"} for key in keys]


@api_router.get("/keys")
async def list_keys(principal: dict = Depends(require_key_admin)):
    return {"keys": _visible_keys(principal)}


@api_router.post("/keys")
async def create_key(body: KeyCreate, principal: dict = Depends(require_key_admin)):
    keys = _api_keys()
    if len(keys) >= 50:
        raise HTTPException(400, "At most 50 API keys. Revoke one first.")
    secret = "tbk_" + secrets.token_urlsafe(32)
    # A key acts as its creator, never above administrator.
    role = "admin" if _rank(principal) >= accounts.ROLE_RANK["admin"] else principal["role"]
    entry = {"id": secrets.token_hex(6), "name": body.name.strip(), "created": time.time(), "last4": secret[-4:],
             "user_id": principal["id"], "role": role, "hash": hashlib.sha256(secret.encode()).hexdigest()}
    STORE.set("apikeys", keys + [entry])
    return JSONResponse({"key": secret, **{k: v for k, v in entry.items() if k != "hash"}}, headers={"Cache-Control": "no-store"})


@api_router.delete("/keys/{key_id}")
async def revoke_key(key_id: str, principal: dict = Depends(require_key_admin)):
    admin = _rank(principal) >= accounts.ROLE_RANK["admin"]
    STORE.set("apikeys", [k for k in _api_keys() if not (k["id"] == key_id and (admin or k.get("user_id") == principal["id"]))])
    return {"keys": _visible_keys(principal)}


# ---------------------------------------------------------------------------
# Accounts: owner / admin / presenter, two-factor codes, minute balances.
# The operator code always acts as the owner (break-glass access).
# ---------------------------------------------------------------------------
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$")


def _temp_password() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
    while True:
        pw = "".join(secrets.choice(alphabet) for _ in range(14))
        if not accounts.password_problem(pw):
            return pw


def _create_user(email, name, role, minutes, password=None):
    users = _users()
    user = {"id": "u_" + secrets.token_hex(6), "email": email.lower(), "name": (name or "").strip()[:80], "role": role,
            "created": time.time(), "disabled": False, "pw_hash": accounts.hash_password(password) if password else None,
            "must_change": bool(password), "balance_seconds": None if minutes is None else max(0, minutes) * 60,
            "used_seconds": 0, "totp_enabled": False}
    _save_users(users + [user])
    return user


def _user_or_404(uid):
    user = _find_user(uid=uid)
    if not user:
        raise HTTPException(404, "User not found.")
    return user


def _owners(users=None):
    return [u for u in (users or _users()) if u["role"] == "owner" and not u.get("disabled")]


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=200)
    code: str | None = Field(default=None, max_length=12)


@api_router.post("/auth/login")
async def login(body: LoginRequest, request: Request):
    ip = _client_ip(request)
    email = body.email.strip().lower()
    if _rate_limited("login:" + ip, 20) or _rate_limited("login-email:" + email, 10):
        raise HTTPException(429, "Too many sign-in attempts. Wait a minute.")
    user = _find_user(email=email)
    stored = (user or {}).get("pw_hash") or accounts.DUMMY_HASH
    ok = await anyio.to_thread.run_sync(accounts.verify_password, body.password, stored)
    if not user or not ok or user.get("disabled") or not user.get("pw_hash"):
        raise HTTPException(401, "Incorrect email or password.")
    if user.get("totp_enabled"):
        if not body.code:
            return JSONResponse({"detail": "Enter the 6-digit code from your authenticator app.", "totp_required": True}, status_code=401)
        step = accounts.totp_match(user.get("totp_secret"), body.code, user.get("totp_last", -1))
        if step is None:
            raise HTTPException(401, "Incorrect or expired code.")
        _update_user(user["id"], totp_last=step)
    _update_user(user["id"], last_login=time.time())
    token = _new_session(user["id"], "password")
    return JSONResponse({"token": token, "user": accounts.public_user(_find_user(uid=user["id"]))}, headers={"Cache-Control": "no-store"})


@api_router.get("/me")
async def me(principal: dict = Depends(require_operator)):
    user = _find_user(uid=principal["id"])
    return {"principal": {k: principal.get(k) for k in ("id", "role", "email", "name", "via")},
            "user": accounts.public_user(user) if user else None, "users_exist": bool(STORE.get("users"))}


class MeUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=80)


@api_router.patch("/me")
async def update_me(body: MeUpdate, principal: dict = Depends(require_key_admin)):
    user = _user_or_404(principal["id"])
    if body.name is not None:
        user = _update_user(user["id"], name=body.name.strip())
    return accounts.public_user(user)


class PasswordChange(BaseModel):
    current: str = Field(default="", max_length=200)
    new: str = Field(min_length=1, max_length=200)


@api_router.post("/me/password")
async def change_password(body: PasswordChange, principal: dict = Depends(require_key_admin)):
    user = _user_or_404(principal["id"])
    if user.get("pw_hash") and not await anyio.to_thread.run_sync(accounts.verify_password, body.current, user["pw_hash"]):
        raise HTTPException(400, "The current password is incorrect.")
    problem = accounts.password_problem(body.new)
    if problem:
        raise HTTPException(400, problem)
    _update_user(user["id"], pw_hash=await anyio.to_thread.run_sync(accounts.hash_password, body.new), must_change=False)
    return {"status": "ok"}


class TotpCode(BaseModel):
    code: str = Field(min_length=6, max_length=12)


@api_router.post("/me/2fa/setup")
async def totp_setup(principal: dict = Depends(require_key_admin)):
    user = _user_or_404(principal["id"])
    secret = accounts.new_totp_secret()
    _update_user(user["id"], totp_pending=secret)
    return JSONResponse({"secret": secret, "uri": accounts.otpauth_uri(secret, user["email"])}, headers={"Cache-Control": "no-store"})


@api_router.post("/me/2fa/enable")
async def totp_enable(body: TotpCode, principal: dict = Depends(require_key_admin)):
    user = _user_or_404(principal["id"])
    step = accounts.totp_match(user.get("totp_pending"), body.code)
    if step is None:
        raise HTTPException(400, "Incorrect code. Check the time on your phone and try again.")
    _update_user(user["id"], totp_secret=user["totp_pending"], totp_pending=None, totp_enabled=True, totp_last=step)
    return {"totp_enabled": True}


@api_router.post("/me/2fa/disable")
async def totp_disable(body: TotpCode, principal: dict = Depends(require_key_admin)):
    user = _user_or_404(principal["id"])
    if accounts.totp_match(user.get("totp_secret"), body.code, user.get("totp_last", -1)) is None:
        raise HTTPException(400, "Incorrect or expired code.")
    _update_user(user["id"], totp_secret=None, totp_enabled=False)
    return {"totp_enabled": False}


class UserCreate(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    name: str = Field(default="", max_length=80)
    role: Literal["owner", "admin", "presenter"] = "presenter"
    minutes: float | None = Field(default=None, ge=0, le=10_000_000)


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=80)
    role: Literal["owner", "admin", "presenter"] | None = None
    disabled: bool | None = None
    minutes_balance: float | None = Field(default=None, ge=0, le=10_000_000)
    unlimited: bool | None = None


def _check_role_change(principal, target_role):
    if target_role == "owner" and principal["role"] != "owner":
        raise HTTPException(403, "Only an owner can create or edit owners.")


@api_router.get("/users")
async def list_users(principal: dict = Depends(require_admin)):
    return {"users": [accounts.public_user(u) for u in _users()]}


# ---------------------------------------------------------------------------
# Minute packs (Stripe Checkout). Nothing here handles card data.
# ---------------------------------------------------------------------------
class CheckoutRequest(BaseModel):
    price_id: str = Field(min_length=3, max_length=120)


@api_router.get("/billing/packs")
async def billing_packs(principal: dict = Depends(require_operator)):
    user = _find_user(uid=principal["id"])
    return {"enabled": billing.enabled(), "packs": [{"minutes": p["minutes"], "price_id": p["price_id"], "display": p["display"]} for p in billing.packs()],
            "balance_minutes": None if not user or user.get("balance_seconds") is None else round(user["balance_seconds"] / 60),
            "unlimited": bool(user and user.get("balance_seconds") is None)}


@api_router.post("/billing/checkout")
async def billing_checkout(body: CheckoutRequest, request: Request, principal: dict = Depends(require_operator)):
    if not billing.enabled():
        raise HTTPException(404, "Minute packs are not enabled on this server.")
    user = _find_user(uid=principal["id"])
    if not user:
        raise HTTPException(400, "Sign in with an email account to buy minutes.")
    if _rate_limited("checkout:" + principal["id"], 10):
        raise HTTPException(429, "Too many attempts. Try again in a minute.")
    origin = (os.environ.get("PUBLIC_ORIGIN") or str(request.base_url).rstrip("/"))
    try:
        url = await billing.create_checkout(_http(), price_id=body.price_id, user_id=user["id"], email=user.get("email"),
                                            success_url=f"{origin}/portal/account?paid=1", cancel_url=f"{origin}/portal/account?paid=0")
    except ValueError:
        raise HTTPException(400, "Unknown pack.")
    except Exception:
        logger.exception("Stripe checkout failed")
        raise HTTPException(502, "Payment service unavailable. Try again shortly.")
    return {"url": url}


@api_router.post("/billing/webhook")
async def billing_webhook(request: Request):
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    payload = await request.body()
    if not secret or not billing.verify_signature(payload, request.headers.get("stripe-signature", ""), secret):
        raise HTTPException(400, "Invalid signature.")
    try:
        event = json.loads(payload)
    except ValueError:
        raise HTTPException(400, "Invalid payload.")
    if event.get("type") != "checkout.session.completed":
        return {"ok": True}
    session = event.get("data", {}).get("object", {}) or {}
    if session.get("payment_status") not in (None, "paid"):
        return {"ok": True}
    sid = session.get("id", "")
    done = list(STORE.get("billing_done", []) or [])
    if sid in done:
        return {"ok": True}  # Stripe retries deliveries; credit once
    meta = session.get("metadata") or {}
    uid = meta.get("user_id") or session.get("client_reference_id")
    try:
        minutes = int(meta.get("minutes") or 0)
    except ValueError:
        minutes = 0
    user = _find_user(uid=uid) if uid else None
    if not user or minutes <= 0:
        logger.warning("Stripe session %s: no matching user or minutes", sid)
        return {"ok": True}
    if user.get("balance_seconds") is not None:
        _update_user(user["id"], balance_seconds=user["balance_seconds"] + minutes * 60)
    purchases = list(STORE.get("billing_purchases", []) or [])
    purchases.append({"session": sid, "user": user["id"], "minutes": minutes, "at": time.time(),
                      "amount_total": session.get("amount_total"), "currency": session.get("currency")})
    STORE.set("billing_purchases", purchases[-5000:])
    STORE.set("billing_done", (done + [sid])[-5000:])
    logger.info("Credited %s minutes to %s", minutes, user["id"])
    return {"ok": True}


@api_router.get("/directory")
async def directory(principal: dict = Depends(require_key_admin)):
    """Colleagues a person can transfer minutes to (active accounts with a minute balance)."""
    return {"users": [{"id": u["id"], "name": u.get("name") or u["email"], "email": u["email"]}
                      for u in _users() if not u.get("disabled") and u.get("balance_seconds") is not None and u["id"] != principal["id"]]}


@api_router.post("/users")
async def create_user(body: UserCreate, principal: dict = Depends(require_admin)):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Enter a valid email address.")
    if _find_user(email=email):
        raise HTTPException(409, "A user with this email already exists.")
    if len(_users()) >= int(os.environ.get("MAX_USERS", "500")):
        raise HTTPException(400, "User limit reached.")
    _check_role_change(principal, body.role)
    password = _temp_password()
    user = _create_user(email, body.name, body.role, body.minutes, password)
    return JSONResponse({"user": accounts.public_user(user), "temporary_password": password}, headers={"Cache-Control": "no-store"})


@api_router.patch("/users/{uid}")
async def update_user(uid: str, body: UserUpdate, principal: dict = Depends(require_admin)):
    user = _user_or_404(uid)
    if user["role"] == "owner" or body.role == "owner":
        _check_role_change(principal, "owner")
    fields = {}
    if body.name is not None:
        fields["name"] = body.name.strip()
    if body.role is not None:
        fields["role"] = body.role
    if body.disabled is not None:
        if uid == principal["id"] and body.disabled:
            raise HTTPException(400, "You cannot disable your own account.")
        fields["disabled"] = body.disabled
    if body.unlimited:
        fields["balance_seconds"] = None
    elif body.minutes_balance is not None:
        fields["balance_seconds"] = body.minutes_balance * 60
    after = [{**u, **fields} if u["id"] == uid else u for u in _users()]
    if user["role"] == "owner" and not _owners(after):
        raise HTTPException(400, "Keep at least one active owner.")
    return accounts.public_user(_update_user(uid, **fields))


@api_router.delete("/users/{uid}")
async def delete_user(uid: str, principal: dict = Depends(require_admin)):
    user = _user_or_404(uid)
    if user["role"] == "owner":
        _check_role_change(principal, "owner")
        if len(_owners()) <= 1:
            raise HTTPException(400, "Keep at least one active owner.")
    if uid == principal["id"]:
        raise HTTPException(400, "You cannot delete your own account.")
    _save_users([u for u in _users() if u["id"] != uid])
    STORE.set("apikeys", [k for k in _api_keys() if k.get("user_id") != uid])
    return {"users": [accounts.public_user(u) for u in _users()]}


@api_router.post("/users/{uid}/reset")
async def reset_user(uid: str, principal: dict = Depends(require_admin)):
    """New temporary password and two-factor reset (lost phone)."""
    user = _user_or_404(uid)
    if user["role"] == "owner":
        _check_role_change(principal, "owner")
    password = _temp_password()
    _update_user(uid, pw_hash=accounts.hash_password(password), must_change=True, totp_enabled=False, totp_secret=None)
    return JSONResponse({"temporary_password": password}, headers={"Cache-Control": "no-store"})


class MinuteTransfer(BaseModel):
    to: str = Field(max_length=40)
    minutes: float = Field(gt=0, le=10_000_000)
    from_user: str | None = Field(default=None, max_length=40)


@api_router.post("/minutes/transfer")
async def transfer_minutes(body: MinuteTransfer, principal: dict = Depends(require_key_admin)):
    """Move minutes between accounts (Wordly 'transfer minutes')."""
    admin = _rank(principal) >= accounts.ROLE_RANK["admin"]
    source_id = body.from_user or principal["id"]
    if source_id != principal["id"] and not admin:
        raise HTTPException(403, "You can only transfer your own minutes.")
    target = _user_or_404(body.to)
    seconds = body.minutes * 60
    if source_id == "owner":
        source = None
    else:
        source = _user_or_404(source_id)
    if source is not None and source["balance_seconds"] is not None:
        if source["balance_seconds"] < seconds:
            raise HTTPException(400, "Not enough minutes to transfer.")
        _update_user(source["id"], balance_seconds=source["balance_seconds"] - seconds)
    elif not admin:
        raise HTTPException(400, "Unlimited accounts cannot transfer minutes.")
    if target["balance_seconds"] is not None:
        target = _update_user(target["id"], balance_seconds=target["balance_seconds"] + seconds)
    return {"to": accounts.public_user(target), "from": accounts.public_user(_find_user(uid=source_id)) if source else None}


def _charge_minutes(owner_id, seconds):
    if not owner_id or owner_id == "owner":
        return
    user = _find_user(uid=owner_id)
    if not user:
        return
    fields = {"used_seconds": round((user.get("used_seconds") or 0) + seconds, 1)}
    if user.get("balance_seconds") is not None:
        fields["balance_seconds"] = max(0.0, user["balance_seconds"] - seconds)
    _update_user(owner_id, **fields)


def _check_balance(principal):
    user = _find_user(uid=principal.get("id"))
    if user and user.get("balance_seconds") is not None and user["balance_seconds"] <= 0:
        raise HTTPException(402, "No translation minutes left on your account. Ask an administrator for more minutes.")


# ---------------------------------------------------------------------------
# Stream ingest (RTMP / RTMPS / SRT through MediaMTX)
# ---------------------------------------------------------------------------
def _ingest_key(eid):
    ev = EVENTS[eid]
    if not ev.get("ingest_key"):
        ev = {**ev, "ingest_key": secrets.token_urlsafe(18)}
        EVENTS[eid] = ev
    return ev["ingest_key"]


def _ingest_info(eid):
    host = os.environ.get("INGEST_PUBLIC_HOST") or urlsplit(_public_origin() or "http://localhost").hostname or "localhost"
    key = _ingest_key(eid)
    rtmp_port = os.environ.get("INGEST_RTMP_PORT", "1935")
    srt_port = os.environ.get("INGEST_SRT_PORT", "8890")
    rtmps_port = os.environ.get("INGEST_RTMPS_PORT", "")
    return {
        "enabled": ingest.enabled(),
        "rtmp_url": f"rtmp://{host}:{rtmp_port}/live", "stream_key": key,
        "rtmp_full": f"rtmp://{host}:{rtmp_port}/live/{key}",
        "rtmps_url": f"rtmps://{host}:{rtmps_port}/live" if rtmps_port else None,
        "srt_url": f"srt://{host}:{srt_port}?streamid=publish:live/{key}" if srt_port else None,
    }


@api_router.get("/events/{eid}/ingest", dependencies=[Depends(require_operator)])
async def get_ingest(eid: str):
    _require_event(eid)
    return JSONResponse(_ingest_info(eid), headers={"Cache-Control": "no-store"})


@api_router.post("/events/{eid}/ingest/rotate", dependencies=[Depends(require_operator)])
async def rotate_ingest(eid: str):
    _require_event(eid)
    EVENTS[eid] = {**EVENTS[eid], "ingest_key": secrets.token_urlsafe(18)}
    return JSONResponse(_ingest_info(eid), headers={"Cache-Control": "no-store"})


class IngestAuth(BaseModel):
    user: str = ""
    password: str = ""
    action: str = ""
    path: str = ""
    protocol: str = ""
    ip: str = ""
    query: str = ""


@api_router.post("/ingest/auth")
async def ingest_auth(body: IngestAuth):
    """MediaMTX asks before every publish/read. Publish needs a live event's stream key."""
    path = body.path.strip("/")
    if not path.startswith("live/"):
        raise HTTPException(401, "Unknown path.")
    key = path[5:]
    if body.action == "publish":
        _prune_events()
        if any(secrets.compare_digest(key, ev.get("ingest_key") or "-") for ev in EVENTS.values()):
            return {"ok": True}
        raise HTTPException(401, "Unknown stream key.")
    if body.action == "read" and body.user == "tb" and secrets.compare_digest(body.password, ingest.read_password()):
        return {"ok": True}
    raise HTTPException(401, "Not allowed.")


async def _run_ingest(websocket: WebSocket, eid: str):
    stopped = asyncio.Event()
    key = _ingest_key(eid)

    async def send_status(live):
        await websocket.send_json({"type": "ingest", "live": live})

    async def watch_close():
        try:
            while True:
                msg = await websocket.receive()
                if msg["type"] == "websocket.disconnect":
                    break
        except Exception:
            pass
        stopped.set()

    watcher = asyncio.create_task(watch_close())
    try:
        await websocket.send_json({"type": "ingest", "live": False})
        await ingest.relay(key, websocket.send_bytes, send_status, stopped)
    except Exception:
        logger.info("Ingest relay ended for %s", eid)
    finally:
        stopped.set()
        watcher.cancel()


# ---------------------------------------------------------------------------
# Website demo requests ("Book a demo"), visible to administrators in the portal
# ---------------------------------------------------------------------------
class ContactRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=200)
    organization: str = Field(default="", max_length=160)
    kind: str = Field(default="", max_length=80)
    size: str = Field(default="", max_length=40)
    languages: str = Field(default="", max_length=200)
    message: str = Field(default="", max_length=3000)
    lang: str = Field(default="en", max_length=5)
    website: str = Field(default="", max_length=200)  # honeypot


@api_router.post("/contact")
async def contact(body: ContactRequest, request: Request):
    if _rate_limited("contact:" + _client_ip(request), 5):
        raise HTTPException(429, "Too many requests. Try again in a minute.")
    if body.website.strip():
        return {"ok": True}  # bot: pretend success, store nothing
    if not EMAIL_RE.match(body.email.strip().lower()):
        raise HTTPException(400, "Enter a valid email address.")
    leads = list(STORE.get("leads", []) or [])
    leads.append({"id": secrets.token_hex(6), "created": time.time(), "status": "new",
                  **{k: v.strip() for k, v in body.model_dump().items() if k != "website"}})
    STORE.set("leads", leads[-2000:])
    logger.info("New demo request")
    if _smtp_configured():
        asyncio.get_running_loop().run_in_executor(None, _send_lead_email, leads[-1])
    return {"ok": True}


def _smtp_configured() -> bool:
    return bool(os.environ.get("SMTP_HOST") and os.environ.get("LEADS_NOTIFY_TO"))


def _lead_email(lead: dict) -> EmailMessage:
    """Plain-text notification for one demo request (no HTML, no links built from user input)."""
    msg = EmailMessage()
    sender = os.environ.get("SMTP_FROM") or os.environ.get("SMTP_USER") or "no-reply@localhost"
    msg["From"] = sender
    msg["To"] = os.environ["LEADS_NOTIFY_TO"]
    name = re.sub(r"[\r\n]+", " ", lead.get("name", ""))[:120]
    org = re.sub(r"[\r\n]+", " ", lead.get("organization", ""))[:160]
    msg["Subject"] = f"Syntova demo request: {name}" + (f" ({org})" if org else "")
    reply = lead.get("email", "")
    if EMAIL_RE.match(reply.lower()):
        msg["Reply-To"] = reply
    rows = [("Name", "name"), ("Email", "email"), ("Organization", "organization"), ("Event type", "kind"),
            ("Attendees", "size"), ("Languages", "languages"), ("Site language", "lang")]
    body = "\n".join(f"{label}: {lead.get(key, '')}" for label, key in rows)
    body += "\n\nMessage:\n" + (lead.get("message") or "(none)")
    portal = (os.environ.get("PUBLIC_ORIGIN") or "").rstrip("/")
    if portal:
        body += f"\n\nAll requests: {portal}/portal/requests"
    msg.set_content(body)
    return msg


def _send_lead_email(lead: dict) -> None:
    host = os.environ.get("SMTP_HOST", "")
    port = int(os.environ.get("SMTP_PORT") or 587)
    user = os.environ.get("SMTP_USER", "")
    password = os.environ.get("SMTP_PASSWORD", "")
    try:
        msg = _lead_email(lead)
        ctx = ssl.create_default_context()
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=20, context=ctx)
        else:
            server = smtplib.SMTP(host, port, timeout=20)
            server.starttls(context=ctx)
        with server:
            if user:
                server.login(user, password)
            server.send_message(msg)
        logger.info("Demo request emailed")
    except Exception as exc:  # never break the website form because of mail
        logger.warning("Demo request email failed: %s", type(exc).__name__)


@api_router.get("/leads")
async def list_leads(principal: dict = Depends(require_admin)):
    return {"leads": list(reversed(STORE.get("leads", []) or []))}


class LeadUpdate(BaseModel):
    status: Literal["new", "contacted", "done"]


@api_router.patch("/leads/{lead_id}")
async def update_lead(lead_id: str, body: LeadUpdate, principal: dict = Depends(require_admin)):
    leads = [{**l, "status": body.status} if l["id"] == lead_id else l for l in STORE.get("leads", []) or []]
    STORE.set("leads", leads)
    return {"leads": list(reversed(leads))}


@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, principal: dict = Depends(require_admin)):
    leads = [l for l in STORE.get("leads", []) or [] if l["id"] != lead_id]
    STORE.set("leads", leads)
    return {"leads": list(reversed(leads))}


# ---------------------------------------------------------------------------
# Server-side engines: cascade languages and console-free stream translation
# ---------------------------------------------------------------------------
SERVER_SESSIONS = {}   # eid -> live_engine.ServerSession
CASCADES = {}          # eid -> live_engine.CascadeHub (console mode)


async def _tts_pcm(text: str, voice: str, style: str) -> bytes:
    api_key = os.environ.get("OPENAI_API_KEY", "")
    payload = {"model": TTS_MODEL, "voice": voice if voice in STUDIO_VOICES else "marin", "input": text[:1200], "response_format": "pcm"}
    if style:
        payload["instructions"] = style[:400]
    resp = await _http().post(OPENAI_SPEECH_URL, headers=_openai_headers(api_key), json=payload, timeout=30.0)
    if resp.status_code >= 400:
        raise RuntimeError(f"speech {resp.status_code}")
    return resp.content


async def _tts_stream(text: str, voice: str, style: str):
    """Yield PCM16 24 kHz chunks as OpenAI synthesises them (studio voice)."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    payload = {"model": TTS_MODEL, "voice": voice if voice in STUDIO_VOICES else "marin", "input": text[:1200], "response_format": "pcm"}
    if style:
        payload["instructions"] = style[:400]
    async with _http().stream("POST", OPENAI_SPEECH_URL, headers=_openai_headers(api_key), json=payload, timeout=30.0) as resp:
        if resp.status_code >= 400:
            raise RuntimeError(f"speech {resp.status_code}")
        carry = b""
        async for chunk in resp.aiter_bytes():
            data = carry + chunk
            if len(data) % 2:  # keep whole 16-bit samples
                data, carry = data[:-1], data[-1:]
            else:
                carry = b""
            if data:
                yield data


async def _translate_many(text: str, langs: list) -> dict:
    api_key = os.environ.get("OPENAI_API_KEY", "")
    names = {lang: LANGUAGE_NAMES.get(lang, lang) for lang in langs}
    payload = {
        "model": CASCADE_MODEL,
        "instructions": ("You are a live interpreter. Translate the speaker's words into each requested language. "
                         "The text may be a fragment of a longer sentence: translate it as it is, never complete or "
                         "comment it. Natural spoken style, faithful, no additions, keep names and numbers. Languages: "
                         + ", ".join(f"{k} = {v}" for k, v in names.items())),
        "input": text,
        "text": {"format": {"type": "json_schema", "name": "live_translation", "strict": True, "schema": {
            "type": "object", "additionalProperties": False,
            "properties": {lang: {"type": "string"} for lang in langs}, "required": list(langs)}}},
        "store": False,
    }
    resp = await _http().post(OPENAI_RESPONSES_URL, headers=_openai_headers(api_key), json=payload, timeout=30.0)
    if resp.status_code >= 400:
        raise RuntimeError(f"translate {resp.status_code}")
    data = json.loads(_response_text(resp.json()))
    return {lang: str(data.get(lang, "")) for lang in langs}


def _realtime_session_update(lang: str, instructions: str) -> dict:
    # The translations WebSocket accepts only audio.input.noise_reduction,
    # audio.input.transcription and audio.output.language (OpenAI reference).
    # Instructions are a WebRTC-only feature; sending them here is rejected
    # with unknown_parameter and the language setting is lost with it.
    session = _build_session_config(lang, "far_field")["session"]
    session.pop("model", None)
    return {"type": "session.update", "session": session}


async def _realtime_connect():
    from websockets.asyncio.client import connect
    base = os.environ.get("OPENAI_REALTIME_WS_URL", "wss://api.openai.com/v1/realtime/translations")
    url = f"{base}?model={REALTIME_MODEL}"
    return await connect(url, additional_headers=_openai_headers(os.environ.get("OPENAI_API_KEY", "")),
                         max_size=8 * 1024 * 1024, open_timeout=15, ping_interval=20)


def _live_stopped(eid: str, reason: str):
    kind = reason.split(":", 1)[0]
    if kind == "server":
        SERVER_SESSIONS.pop(eid, None)
    elif kind == "cascade" and eid in CASCADES:
        CASCADES.pop(eid, None)
    logger.info("Live engine for %s stopped (%s)", eid, reason)


def _live_deps(eid: str) -> live_engine.Deps:
    return live_engine.Deps(
        room=_room, fanout=_fanout, status=_broadcast_status,
        captions_enabled=lambda e: bool((EVENTS.get(e) or {}).get("captions")),
        record_usage=_record_usage, out_of_minutes=_out_of_minutes,
        translate_many=_translate_many, tts=_tts_pcm,
        save_transcript=_save_transcript, archive_enabled=lambda e: bool((EVENTS.get(e) or {}).get("archive")),
        realtime_connect=_realtime_connect, session_update=_realtime_session_update, tts_stream=_tts_stream,
        ffmpeg_args=lambda: ingest.ffmpeg_args(_ingest_key(eid), rate=live_engine.OPENAI_RATE),
        on_stopped=_live_stopped,
    )


def _cascade_langs(eid):
    ev = EVENTS[eid]
    return [l for l in _targets(eid) if l in CASCADE_LANGUAGES and l not in (ev.get("human") or [])]


def _ai_langs(eid):
    ev = EVENTS[eid]
    return [l for l in _targets(eid) if l in SUPPORTED_OUTPUT_LANGUAGES and l not in (ev.get("human") or [])]


def _live_preflight(eid):
    _require_event(eid)
    if not os.environ.get("OPENAI_API_KEY"):
        raise HTTPException(503, "The translation service is not configured on the server.")
    if _out_of_minutes(eid):
        raise HTTPException(402, "No translation minutes left on this account. Ask an administrator for more minutes.")
    if USAGE_CAP_MINUTES and _month_minutes() >= USAGE_CAP_MINUTES:
        raise HTTPException(402, "The monthly translation limit set by the administrator is reached.")


class VoiceChoice(BaseModel):
    voice: str = Field(default="marin", max_length=20)
    style: str = Field(default="", max_length=400)


class ServerStart(VoiceChoice):
    instructions: str = Field(default="", max_length=MAX_INSTRUCTIONS_LEN)
    source: Literal["ingest", "browser"] = "ingest"
    # "original": OpenAI's translation voice, which follows (and changes with)
    # the speaker. "studio": one fixed voice for every language, text pipeline.
    voice_mode: Literal["original", "studio"] = "original"


@api_router.post("/events/{eid}/server/start", dependencies=[Depends(require_operator)])
async def server_start(eid: str, body: ServerStart):
    """Translate the event's RTMP/SRT stream on the server: the console can be closed."""
    _live_preflight(eid)
    if body.source == "ingest" and not ingest.enabled():
        raise HTTPException(400, "Stream input is not enabled on this server.")
    if eid in SERVER_SESSIONS or eid in CASCADES:
        raise HTTPException(409, "This event is already running on the server.")
    if any(r["operator"] is not None for r in _event_rooms(eid)):
        raise HTTPException(409, "This event is already broadcasting from a console. Stop it there first.")
    ai, cascade = _ai_langs(eid), _cascade_langs(eid)
    if not ai:
        raise HTTPException(400, "The main language must be interpreted directly.")
    if body.voice.lower() not in STUDIO_VOICES:
        raise HTTPException(400, f"Unknown voice '{body.voice}'.")
    if body.voice_mode == "studio":
        cascade = ai + [l for l in cascade if l not in ai]
    deps = _live_deps(eid)
    hub = live_engine.CascadeHub(eid, cascade, deps, body.voice.lower(), body.style, idle_timeout=10 ** 9) if cascade else None
    session = live_engine.ServerSession(eid, ai, hub, deps, instructions=body.instructions.strip(),
                                        idle_minutes=float(os.environ.get("SERVER_IDLE_MINUTES", "30")),
                                        booth_room=bool(EVENTS[eid].get("human")), source=body.source, voice_mode=body.voice_mode)
    SERVER_SESSIONS[eid] = session
    await session.start()
    return session.status()


@api_router.get("/events/{eid}/server", dependencies=[Depends(require_operator)])
async def server_status(eid: str):
    _require_event(eid)
    session = SERVER_SESSIONS.get(eid)
    cascade = CASCADES.get(eid)
    return {"server": session.status() if session else None, "cascade": cascade.status() if cascade else None,
            "cascade_languages": _cascade_langs(eid), "ingest": ingest.enabled()}


@api_router.post("/events/{eid}/server/stop", dependencies=[Depends(require_operator)])
async def server_stop(eid: str):
    _require_event(eid)
    session = SERVER_SESSIONS.get(eid)
    if session:
        await session.stop("operator")
    return {"stopped": bool(session)}


class SpeakerName(BaseModel):
    name: str = Field(default="", max_length=80)


@api_router.post("/events/{eid}/server/voice", dependencies=[Depends(require_operator)])
async def server_voice(eid: str, body: VoiceChoice):
    """Change the studio voice or its delivery style while the server session runs."""
    _require_event(eid)
    voice = body.voice.lower()
    if voice not in STUDIO_VOICES:
        raise HTTPException(400, f"Unknown voice '{body.voice}'.")
    session = SERVER_SESSIONS.get(eid)
    hub = session.cascade if session else CASCADES.get(eid)
    if hub is None:
        return {"applied": False}
    hub.voice, hub.style = voice, body.style
    for out in hub.outputs.values():
        out.meta["voice"] = voice.title()
        out.room["meta"] = dict(out.meta)
        await deps_fanout_meta(out)
    return {"applied": True, "voice": voice}


async def deps_fanout_meta(out):
    try:
        await out.deps.fanout(out.room, "send_json", {"type": "meta", **out.room["meta"]})
    except Exception:
        logger.warning("Could not relay the new voice to listeners", exc_info=True)


@api_router.post("/events/{eid}/server/speaker", dependencies=[Depends(require_operator)])
async def server_speaker(eid: str, body: SpeakerName):
    _require_event(eid)
    name = body.name.strip() or None
    for target in (SERVER_SESSIONS.get(eid),):
        if target:
            target.speaker = name
    return {"speaker": name}


@api_router.post("/events/{eid}/cascade/start", dependencies=[Depends(require_operator)])
async def cascade_start(eid: str, body: VoiceChoice):
    """Console mode: the server voices the text-pipeline languages from the console's source sentences."""
    _live_preflight(eid)
    langs = _cascade_langs(eid)
    if not langs:
        return {"running": False, "languages": []}
    if eid in SERVER_SESSIONS:
        raise HTTPException(409, "This event is already running on the server.")
    hub = CASCADES.get(eid)
    if hub and hub.running:
        hub.voice, hub.style = body.voice.lower(), body.style
        hub.ping()
        return hub.status()
    hub = live_engine.CascadeHub(eid, langs, _live_deps(eid), body.voice.lower(), body.style,
                                 idle_timeout=float(os.environ.get("CASCADE_IDLE_SECONDS", "180")))
    CASCADES[eid] = hub
    await hub.start()
    return hub.status()


class CascadeSegment(BaseModel):
    text: str = Field(default="", max_length=2000)
    speaker: str | None = Field(default=None, max_length=80)


@api_router.post("/events/{eid}/cascade/segment", dependencies=[Depends(require_operator)])
async def cascade_segment(eid: str, body: CascadeSegment, request: Request):
    if _rate_limited("cascade:" + eid, 240):
        raise HTTPException(429, "Too many sentences. Slow down.")
    hub = CASCADES.get(eid)
    if not hub or not hub.running:
        raise HTTPException(409, "The text-pipeline languages are not running for this event.")
    if body.text.strip():
        hub.submit(body.text, (body.speaker or "").strip() or None)
    else:
        hub.ping()
    return {"queued": hub.queue.qsize()}


@api_router.post("/events/{eid}/cascade/stop", dependencies=[Depends(require_operator)])
async def cascade_stop(eid: str):
    hub = CASCADES.get(eid)
    if hub:
        await hub.stop("operator")
    return {"stopped": bool(hub)}


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


@api_router.get("/usage")
async def usage(principal: dict = Depends(require_operator)):
    month = STORE.get(_month_key(), {}) or {}
    user = _find_user(uid=principal["id"])
    return {
        "me": accounts.public_user(user) if user else None,
        "month": _month_key().split(":", 1)[1],
        "minutes_by_language": {k: round(v / 60, 1) for k, v in month.items()},
        "total_minutes": round(sum(month.values()) / 60, 1),
        "cap_minutes": USAGE_CAP_MINUTES or None,
    }


class GlossaryEntry(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    text: str = Field(default="", max_length=120000)


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
    provider: Literal["zoom", "teams", "webhook"]
    url: str = Field(min_length=10, max_length=2000)
    text: str = Field(min_length=1, max_length=500)
    lang: str = Field(default="en-US", max_length=16)
    seq: int = Field(default=0, ge=0)


RELAY_HOSTS = {
    "zoom": re.compile(r"^([a-z0-9-]+\.)*zoom\.us$"),
    "teams": re.compile(r"^api\.captions\.office\.microsoft\.com$"),
}


async def _public_https_host(url: str) -> str:
    """Webhooks may only reach public HTTPS hosts (no internal network, no SSRF)."""
    parts = urlsplit(url.strip())
    host = (parts.hostname or "").lower()
    if parts.scheme != "https" or not host or parts.username or parts.password:
        raise HTTPException(400, "The webhook must be an https:// address.")
    try:
        infos = await anyio.to_thread.run_sync(lambda: socket.getaddrinfo(host, parts.port or 443, proto=socket.IPPROTO_TCP))
    except socket.gaierror:
        raise HTTPException(400, "The webhook host could not be found.")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global or ip.is_multicast:
            raise HTTPException(400, "The webhook must point to a public internet address.")
    return url.strip()


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
    try:
        if req.provider == "webhook":
            url = await _public_https_host(req.url)
            resp = await _http().post(url, json={"type": "caption", "text": req.text, "lang": req.lang, "seq": req.seq, "sent_at": time.time()}, timeout=10.0)
        else:
            url = _relay_url(req)
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


def _out_of_minutes(eid) -> bool:
    owner = _find_user(uid=(EVENTS.get(eid) or {}).get("owner"))
    return bool(owner and owner.get("balance_seconds") is not None and owner["balance_seconds"] <= 0)


async def _run_source(websocket: WebSocket, eid: str):
    """Receive PCM16 (WIRE_RATE) from the presenter's browser for a server session.
    The newest socket wins: after a reconnect the stale one is dropped."""
    session = SERVER_SESSIONS.get(eid)
    if not session or not session.running or session.source != "browser":
        await websocket.close(code=4404)
        return
    me = id(websocket)
    session.feeder = me
    session.feeder_ws = websocket
    await websocket.send_json({"type": "ready"})
    try:
        while True:
            msg = await websocket.receive()
            if msg["type"] == "websocket.disconnect":
                break
            if not session.running:
                await websocket.close(code=4404)
                break
            if session.feeder != me:
                await websocket.close(code=4409)
                break
            if msg.get("bytes") is not None:
                if len(msg["bytes"]) > 65536:
                    continue
                session.feed_pcm(msg["bytes"])
            elif msg.get("text") is not None:
                try:
                    data = json.loads(msg["text"])
                except ValueError:
                    continue
                if isinstance(data, dict) and data.get("type") == "speaker":
                    session.speaker = (str(data.get("name") or "")[:80] or None)
                elif isinstance(data, dict) and data.get("type") == "ping":
                    await websocket.send_json({"type": "pong", **session.status()})
    except WebSocketDisconnect:
        pass
    finally:
        if session.feeder == me:
            session.feeder = None
            session.feeder_ws = None


async def _run_operator(websocket: WebSocket, eid: str, room, audio_format: str = "pcm16", rate: int = 16000, counts_usage: bool = True):
    started = time.monotonic()
    charge = counts_usage and room["lang"] != SOURCE_LANG
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
            # Charge minutes as they are used and stop when the account is empty.
            if charge and time.monotonic() - started >= 30:
                now = time.monotonic()
                _record_usage(eid, room["lang"], now - started)
                started = now
                if _out_of_minutes(eid):
                    await websocket.send_json({"type": "error", "detail": "No translation minutes left on this account."})
                    await websocket.close(code=4402)
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
        if charge:
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
    total = _event_listener_count(eid)
    if not booth and eid in EVENTS and total > EVENTS[eid].get("peak_listeners", 0):
        EVENTS[eid] = {**EVENTS[eid], "peak_listeners": total}
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
    # A whole venue shares one public IP (same Wi-Fi), so this budget must cover
    # every phone scanning the QR code at once, plus a mass reconnect after a
    # network blip. The per-event MAX_LISTENERS cap bounds the actual load.
    if _rate_limited("ws:" + _client_ip(websocket), WS_RATE_LIMIT_MAX):
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
    if role == "source":
        # The presenter's browser pushes microphone audio into the server session.
        token = auth.get("token", "")
        if not isinstance(token, str) or not secrets.compare_digest(hashlib.sha256(token.encode()).hexdigest(), EVENTS[eid]["operator_token_hash"]):
            await websocket.close(code=4401)
            return
        await _run_source(websocket, eid)
        return
    if role == "ingest":
        principal = _principal_from_token(auth.get("bearer", ""))
        if not principal or (_rank(principal) < accounts.ROLE_RANK["admin"] and EVENTS[eid].get("owner") != principal["id"]):
            await websocket.close(code=4401)
            return
        if not ingest.enabled():
            await websocket.close(code=4501)
            return
        await _run_ingest(websocket, eid)
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
