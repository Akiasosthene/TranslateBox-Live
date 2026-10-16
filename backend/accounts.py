"""User accounts: password hashing, TOTP two-factor codes, persisted sessions.

Pure helpers with no FastAPI dependency so they are easy to test. Users live
in the KV store under "users" (a list of dicts); sessions under
"sess:<sha256(token)>".
"""
import base64
import hashlib
import hmac
import secrets
import struct
import time

ROLES = ("owner", "admin", "presenter")
ROLE_RANK = {"presenter": 1, "admin": 2, "owner": 3}
SCRYPT = {"n": 2 ** 14, "r": 8, "p": 1, "dklen": 32}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **SCRYPT)
    return "scrypt$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(digest).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_b64, digest_b64 = (stored or "").split("$")
        if scheme != "scrypt":
            return False
        digest = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt_b64), **SCRYPT)
        return hmac.compare_digest(digest, base64.b64decode(digest_b64))
    except (ValueError, TypeError):
        return False


# A fixed hash so unknown emails cost the same time as wrong passwords.
DUMMY_HASH = hash_password(secrets.token_urlsafe(12))


def password_problem(password: str) -> str | None:
    if len(password) < 10:
        return "Use at least 10 characters."
    if len(password) > 200:
        return "Password too long."
    if password.lower() == password or password.upper() == password or not any(c.isdigit() for c in password):
        return "Mix upper- and lower-case letters and at least one digit."
    return None


# --- TOTP (RFC 6238, SHA-1, 30 s, 6 digits: Google/Microsoft Authenticator) ---

def new_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def _hotp(secret: str, counter: int) -> str:
    key = base64.b32decode(secret + "=" * (-len(secret) % 8), casefold=True)
    mac = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = mac[-1] & 0x0F
    code = (struct.unpack(">I", mac[offset:offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f"{code:06d}"


def totp_now(secret: str, at: float | None = None) -> str:
    return _hotp(secret, int((at if at is not None else time.time()) // 30))


def totp_match(secret: str, code: str, last_counter: int = -1, at: float | None = None) -> int | None:
    """Return the matched time step (±1 for clock drift), refusing replays."""
    code = "".join(ch for ch in str(code or "") if ch.isdigit())
    if len(code) != 6 or not secret:
        return None
    step = int((at if at is not None else time.time()) // 30)
    for counter in (step - 1, step, step + 1):
        if counter > last_counter and hmac.compare_digest(_hotp(secret, counter), code):
            return counter
    return None


def otpauth_uri(secret: str, email: str, issuer: str = "TranslateBox") -> str:
    from urllib.parse import quote
    return f"otpauth://totp/{quote(issuer)}:{quote(email)}?secret={secret}&issuer={quote(issuer)}&algorithm=SHA1&digits=6&period=30"


def public_user(user: dict) -> dict:
    hidden = {"pw_hash", "totp_secret", "totp_last", "totp_pending", "failed"}
    out = {k: v for k, v in user.items() if k not in hidden}
    out["totp_enabled"] = bool(user.get("totp_enabled"))
    balance = user.get("balance_seconds")
    out["minutes_balance"] = None if balance is None else round(balance / 60, 1)
    out["minutes_used"] = round((user.get("used_seconds") or 0) / 60, 1)
    out.pop("balance_seconds", None)
    out.pop("used_seconds", None)
    return out
