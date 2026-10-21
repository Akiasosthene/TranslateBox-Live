"""Minute packs sold through Stripe Checkout.

Configuration (environment):
  STRIPE_SECRET_KEY      sk_live_... or sk_test_...
  STRIPE_WEBHOOK_SECRET  whsec_... from the webhook endpoint in the Stripe dashboard
  MINUTE_PACKS           "300:price_abc:49,1000:price_def:149" -> minutes:stripe price id:display price (any currency text)

Flow: the portal lists the packs; the user clicks one; the backend creates a Checkout
Session with the user's id in client_reference_id; Stripe redirects back to the portal;
Stripe calls the webhook; the webhook verifies the signature and credits the minutes once.
No card data ever touches this server.
"""
import hashlib
import hmac
import os
import time

import httpx

STRIPE_API = "https://api.stripe.com/v1"


def enabled() -> bool:
    return bool(os.environ.get("STRIPE_SECRET_KEY") and packs())


def packs() -> list[dict]:
    out = []
    for item in (os.environ.get("MINUTE_PACKS") or "").split(","):
        parts = [p.strip() for p in item.split(":")]
        if len(parts) < 2 or not parts[0].isdigit() or not parts[1]:
            continue
        out.append({"minutes": int(parts[0]), "price_id": parts[1], "display": parts[2] if len(parts) > 2 else ""})
    return out


def pack_for(price_id: str) -> dict | None:
    return next((p for p in packs() if p["price_id"] == price_id), None)


async def create_checkout(client: httpx.AsyncClient, *, price_id: str, user_id: str, email: str | None, success_url: str, cancel_url: str) -> str:
    """Returns the hosted Checkout URL."""
    pack = pack_for(price_id)
    if not pack:
        raise ValueError("Unknown pack")
    form = {
        "mode": "payment",
        "line_items[0][price]": price_id,
        "line_items[0][quantity]": "1",
        "client_reference_id": user_id,
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata[minutes]": str(pack["minutes"]),
        "metadata[user_id]": user_id,
    }
    if email:
        form["customer_email"] = email
    resp = await client.post(f"{STRIPE_API}/checkout/sessions", data=form,
                             auth=(os.environ["STRIPE_SECRET_KEY"], ""), timeout=20.0)
    if resp.status_code >= 400:
        raise RuntimeError(f"Stripe refused the checkout ({resp.status_code})")
    return resp.json()["url"]


def verify_signature(payload: bytes, header: str, secret: str, tolerance: int = 300, now: float | None = None) -> bool:
    """Stripe-Signature: t=<unix>,v1=<hex>[,v1=<hex>...]"""
    try:
        parts = dict(p.split("=", 1) for p in header.split(",") if "=" in p)
        ts = int(parts["t"])
    except (ValueError, KeyError, AttributeError):
        return False
    if abs((now if now is not None else time.time()) - ts) > tolerance:
        return False
    expected = hmac.new(secret.encode(), f"{ts}.".encode() + payload, hashlib.sha256).hexdigest()
    sigs = [p.split("=", 1)[1] for p in header.split(",") if p.strip().startswith("v1=")]
    return any(hmac.compare_digest(expected, s.strip()) for s in sigs)


def sign(payload: bytes, secret: str, ts: int | None = None) -> str:
    """Builds a Stripe-Signature header (used by tests and the Stripe CLI format)."""
    ts = ts or int(time.time())
    mac = hmac.new(secret.encode(), f"{ts}.".encode() + payload, hashlib.sha256).hexdigest()
    return f"t={ts},v1={mac}"
