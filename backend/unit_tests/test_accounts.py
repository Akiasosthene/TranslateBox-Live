import time

import pytest
from fastapi.testclient import TestClient

import accounts
import server

TOKEN = 'test-operator-' + 'x' * 32
AUTH = {'Authorization': 'Bearer ' + TOKEN}


@pytest.fixture(autouse=True)
def reset(monkeypatch):
    monkeypatch.setenv('OPERATOR_TOKEN', TOKEN)
    monkeypatch.setenv('OPENAI_API_KEY', 'sk-test-never-real')
    server.EVENTS.clear()
    server.ROOMS.clear()
    server._rate_buckets.clear()
    server.STORE.set('apikeys', [])
    server.STORE.set('users', [])
    server.STORE.set('leads', [])


@pytest.fixture
def client():
    with TestClient(server.app) as c:
        yield c


def make_user(client, role='presenter', minutes=None, email=None):
    email = email or f'{role}{time.time_ns()}@example.org'
    r = client.post('/api/users', headers=AUTH, json={'email': email, 'name': role.title(), 'role': role, 'minutes': minutes})
    assert r.status_code == 200, r.text
    body = r.json()
    login = client.post('/api/auth/login', json={'email': email, 'password': body['temporary_password']})
    assert login.status_code == 200, login.text
    return body['user'], {'Authorization': 'Bearer ' + login.json()['token']}, body['temporary_password']


def test_password_and_totp_helpers():
    h = accounts.hash_password('Sermon2026x')
    assert accounts.verify_password('Sermon2026x', h) and not accounts.verify_password('nope', h)
    assert accounts.password_problem('short') and not accounts.password_problem('Longer2026x')
    secret = accounts.new_totp_secret()
    now = 1_800_000_000
    code = accounts.totp_now(secret, now)
    step = accounts.totp_match(secret, code, at=now)
    assert step == now // 30
    assert accounts.totp_match(secret, code, last_counter=step, at=now) is None  # no replay
    # RFC 6238 test vector (SHA-1, T=59 -> 94287082, last 6 digits).
    rfc = __import__('base64').b32encode(b'12345678901234567890').decode()
    assert accounts.totp_now(rfc, 59) == '287082'


def test_login_roles_and_event_scoping(client):
    assert client.post('/api/auth/login', json={'email': 'x@example.org', 'password': 'wrong'}).status_code == 401
    alice, alice_h, _ = make_user(client)
    bob, bob_h, _ = make_user(client)
    me = client.get('/api/me', headers=alice_h).json()
    assert me['principal']['role'] == 'presenter' and me['user']['email'] == alice['email'] and 'pw_hash' not in me['user']
    ev = client.post('/api/events', headers=alice_h, json={'name': 'Alice'}).json()
    assert client.get('/api/events', headers=alice_h).json()['events'][0]['id'] == ev['id']
    assert client.get('/api/events', headers=bob_h).json()['events'] == []
    assert client.patch(f"/api/events/{ev['id']}", headers=bob_h, json={'name': 'x'}).status_code == 404
    assert client.post(f"/api/events/{ev['id']}/resume", headers=bob_h).status_code == 404
    admin_view = client.get('/api/events', headers=AUTH).json()['events']
    assert admin_view[0]['owner'] == alice['id'] and admin_view[0]['owner_name'] == 'Presenter'
    assert client.get('/api/users', headers=alice_h).status_code == 403
    client.post('/api/auth/logout', headers=alice_h)
    assert client.get('/api/me', headers=alice_h).status_code == 401


def test_admin_cannot_touch_owners_and_last_owner_kept(client):
    owner, owner_h, _ = make_user(client, role='owner')
    admin, admin_h, _ = make_user(client, role='admin')
    assert client.post('/api/users', headers=admin_h, json={'email': 'o2@example.org', 'role': 'owner'}).status_code == 403
    assert client.patch(f"/api/users/{owner['id']}", headers=admin_h, json={'disabled': True}).status_code == 403
    assert client.patch(f"/api/users/{owner['id']}", headers=AUTH, json={'role': 'admin'}).status_code == 400
    assert client.delete(f"/api/users/{owner['id']}", headers=AUTH).status_code == 400
    assert client.post('/api/users', headers=AUTH, json={'email': owner['email']}).status_code == 409
    disabled = client.patch(f"/api/users/{admin['id']}", headers=owner_h, json={'disabled': True}).json()
    assert disabled['disabled'] is True and client.get('/api/me', headers=admin_h).status_code == 401


def test_two_factor_login(client):
    user, h, pw = make_user(client)
    setup = client.post('/api/me/2fa/setup', headers=h).json()
    assert setup['uri'].startswith('otpauth://totp/')
    assert client.post('/api/me/2fa/enable', headers=h, json={'code': '000000'}).status_code == 400
    assert client.post('/api/me/2fa/enable', headers=h, json={'code': accounts.totp_now(setup['secret'])}).json()['totp_enabled']
    server._rate_buckets.clear()
    need = client.post('/api/auth/login', json={'email': user['email'], 'password': pw})
    assert need.status_code == 401 and need.json()['totp_required'] is True
    server.STORE.set('users', [{**u, 'totp_last': -1} for u in server._users()])
    ok = client.post('/api/auth/login', json={'email': user['email'], 'password': pw, 'code': accounts.totp_now(setup['secret'])})
    assert ok.status_code == 200
    reset = client.post(f"/api/users/{user['id']}/reset", headers=AUTH).json()
    assert client.post('/api/auth/login', json={'email': user['email'], 'password': reset['temporary_password']}).status_code == 200


def test_password_change_rules(client):
    user, h, pw = make_user(client)
    assert client.post('/api/me/password', headers=h, json={'current': 'bad', 'new': 'Another2026x'}).status_code == 400
    assert client.post('/api/me/password', headers=h, json={'current': pw, 'new': 'weak'}).status_code == 400
    assert client.post('/api/me/password', headers=h, json={'current': pw, 'new': 'Another2026x'}).status_code == 200
    assert client.post('/api/auth/login', json={'email': user['email'], 'password': 'Another2026x'}).status_code == 200


def test_minutes_balance_transfer_and_enforcement(client, monkeypatch):
    alice, alice_h, _ = make_user(client, minutes=10)
    bob, bob_h, _ = make_user(client, minutes=0)
    assert client.post('/api/minutes/transfer', headers=alice_h, json={'to': bob['id'], 'minutes': 20}).status_code == 400
    moved = client.post('/api/minutes/transfer', headers=alice_h, json={'to': bob['id'], 'minutes': 4}).json()
    assert moved['to']['minutes_balance'] == 4 and moved['from']['minutes_balance'] == 6
    assert client.post('/api/minutes/transfer', headers=bob_h, json={'from_user': alice['id'], 'to': bob['id'], 'minutes': 1}).status_code == 403
    # Usage is charged to the event owner.
    ev = client.post('/api/events', headers=bob_h, json={}).json()
    server._record_usage(ev['id'], 'en', 240)
    me = client.get('/api/me', headers=bob_h).json()['user']
    assert me['minutes_balance'] == 0 and me['minutes_used'] == 4
    r = client.post('/api/realtime-session', headers=bob_h, json={'target_language': 'en'})
    assert r.status_code == 402
    # Admin grants more; unlimited flag removes the limit.
    assert client.patch(f"/api/users/{bob['id']}", headers=AUTH, json={'unlimited': True}).json()['minutes_balance'] is None


def test_presenter_api_keys_are_scoped(client):
    alice, alice_h, _ = make_user(client)
    key = client.post('/api/keys', headers=alice_h, json={'name': 'site'}).json()
    kh = {'Authorization': 'Bearer ' + key['key']}
    assert client.get('/api/me', headers=kh).json()['principal']['id'] == alice['id']
    assert client.get('/api/users', headers=kh).status_code == 403
    assert client.get('/api/keys', headers=kh).status_code == 403
    admin_key = client.post('/api/keys', headers=AUTH, json={'name': 'ops'}).json()
    assert [k['id'] for k in client.get('/api/keys', headers=alice_h).json()['keys']] == [key['id']]
    assert len(client.get('/api/keys', headers=AUTH).json()['keys']) == 2
    client.delete(f"/api/users/{alice['id']}", headers=AUTH)
    assert client.get('/api/me', headers=kh).status_code == 401
    assert admin_key['role'] == 'admin'


def test_ingest_info_and_mediamtx_auth(client, monkeypatch):
    monkeypatch.setenv('PUBLIC_ORIGIN', 'https://tb.example.org')
    alice, alice_h, _ = make_user(client)
    bob, bob_h, _ = make_user(client)
    ev = client.post('/api/events', headers=alice_h, json={}).json()
    info = client.get(f"/api/events/{ev['id']}/ingest", headers=alice_h).json()
    assert info['rtmp_url'] == 'rtmp://tb.example.org:1935/live' and len(info['stream_key']) >= 20
    assert client.get(f"/api/events/{ev['id']}/ingest", headers=bob_h).status_code == 404
    key = info['stream_key']
    ok = lambda body: client.post('/api/ingest/auth', json=body).status_code
    assert ok({'action': 'publish', 'path': f'live/{key}'}) == 200
    assert ok({'action': 'publish', 'path': 'live/guess'}) == 401
    assert ok({'action': 'read', 'path': f'live/{key}'}) == 401
    import ingest
    assert ok({'action': 'read', 'path': f'live/{key}', 'user': 'tb', 'password': ingest.read_password()}) == 200
    rotated = client.post(f"/api/events/{ev['id']}/ingest/rotate", headers=alice_h).json()
    assert rotated['stream_key'] != key and ok({'action': 'publish', 'path': f'live/{key}'}) == 401


def test_directory_lists_colleagues_with_balances(client):
    alice, alice_h, _ = make_user(client, minutes=5)
    bob, _, _ = make_user(client, minutes=0)
    make_user(client)  # unlimited: not a transfer target
    ids = [u['id'] for u in client.get('/api/directory', headers=alice_h).json()['users']]
    assert ids == [bob['id']]


def test_demo_requests_public_submit_admin_read(client):
    ok = client.post('/api/contact', json={'name': 'Ana', 'email': 'ana@example.org', 'organization': 'Église', 'message': 'Hello'})
    assert ok.status_code == 200
    assert client.post('/api/contact', json={'name': 'Bot', 'email': 'bot@example.org', 'website': 'spam.example'}).json() == {'ok': True}
    assert client.post('/api/contact', json={'name': 'x', 'email': 'nope'}).status_code == 400
    assert client.get('/api/leads').status_code == 401
    _, pres_h, _ = make_user(client)
    assert client.get('/api/leads', headers=pres_h).status_code == 403
    leads = client.get('/api/leads', headers=AUTH).json()['leads']
    assert [l['name'] for l in leads] == ['Ana'] and 'website' not in leads[0]
    assert client.patch(f"/api/leads/{leads[0]['id']}", headers=AUTH, json={'status': 'contacted'}).json()['leads'][0]['status'] == 'contacted'
    assert client.delete(f"/api/leads/{leads[0]['id']}", headers=AUTH).json()['leads'] == []


def test_demo_request_email(monkeypatch):
    import server
    sent = []

    class FakeSMTP:
        def __init__(self, host, port, timeout=None):
            sent.append(("connect", host, port))
        def starttls(self, context=None):
            sent.append(("tls",))
        def login(self, user, password):
            sent.append(("login", user))
        def send_message(self, msg):
            sent.append(("msg", msg))
        def __enter__(self):
            return self
        def __exit__(self, *a):
            return False

    monkeypatch.setattr(server.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setenv("SMTP_HOST", "smtp.example.org")
    monkeypatch.setenv("SMTP_USER", "bot@example.org")
    monkeypatch.setenv("SMTP_PASSWORD", "x")
    monkeypatch.setenv("LEADS_NOTIFY_TO", "owner@example.org")
    lead = {"name": "Ana\r\nBcc: evil@example.org", "email": "ana@example.org", "organization": "Acme", "message": "Hi"}
    server._send_lead_email(lead)
    msg = [x for x in sent if x[0] == "msg"][0][1]
    assert msg["To"] == "owner@example.org"
    assert msg["Reply-To"] == "ana@example.org"
    assert "\n" not in msg["Subject"] and "Bcc" not in msg.keys()
    assert "Acme" in msg.get_content()
    assert ("tls",) in sent and ("login", "bot@example.org") in sent


def _login_user(client, monkeypatch):
    """Create a presenter with a 100-minute balance and return auth headers + user id."""
    r = client.post('/api/users', headers=AUTH, json={'email': 'buyer@example.org', 'name': 'Buyer', 'role': 'presenter', 'minutes': 100})
    assert r.status_code == 200, r.text
    temp = r.json()['temporary_password']
    r = client.post('/api/auth/login', json={'email': 'buyer@example.org', 'password': temp})
    assert r.status_code == 200, r.text
    tok = r.json()['token']
    uid = r.json()['user']['id']
    return {'Authorization': f'Bearer {tok}'}, uid


def test_billing_packs_and_checkout(client, monkeypatch):
    import server, billing
    monkeypatch.setenv('STRIPE_SECRET_KEY', 'sk_test_x')
    monkeypatch.setenv('MINUTE_PACKS', '300:price_small:49 $,1000:price_big:149 $')
    h, uid = _login_user(client, monkeypatch)
    packs = client.get('/api/billing/packs', headers=h).json()
    assert packs['enabled'] and packs['balance_minutes'] == 100 and [p['minutes'] for p in packs['packs']] == [300, 1000]

    class FakeResp:
        status_code = 200
        def json(self): return {'url': 'https://checkout.stripe.com/c/pay/cs_test_1'}
    captured = {}
    class FakeClient:
        async def post(self, url, data=None, auth=None, timeout=None):
            captured.update(url=url, data=data, auth=auth); return FakeResp()
    monkeypatch.setattr(server, '_http', lambda: FakeClient())
    r = client.post('/api/billing/checkout', headers=h, json={'price_id': 'price_big'})
    assert r.status_code == 200 and r.json()['url'].startswith('https://checkout.stripe.com/')
    assert captured['data']['metadata[minutes]'] == '1000' and captured['data']['client_reference_id'] == uid
    assert captured['auth'] == ('sk_test_x', '')
    assert client.post('/api/billing/checkout', headers=h, json={'price_id': 'price_nope'}).status_code == 400


def test_billing_webhook_credits_once(client, monkeypatch):
    import json as _json, billing
    monkeypatch.setenv('STRIPE_WEBHOOK_SECRET', 'whsec_test')
    h, uid = _login_user(client, monkeypatch)
    event = {'type': 'checkout.session.completed', 'data': {'object': {'id': 'cs_1', 'payment_status': 'paid', 'client_reference_id': uid,
             'metadata': {'user_id': uid, 'minutes': '300'}, 'amount_total': 4900, 'currency': 'cad'}}}
    body = _json.dumps(event).encode()
    bad = client.post('/api/billing/webhook', content=body, headers={'stripe-signature': 't=1,v1=deadbeef'})
    assert bad.status_code == 400
    sig = billing.sign(body, 'whsec_test')
    assert client.post('/api/billing/webhook', content=body, headers={'stripe-signature': sig}).status_code == 200
    assert client.get('/api/me', headers=h).json()['user']['minutes_balance'] == 400
    # Stripe retries: the same session must not credit twice.
    assert client.post('/api/billing/webhook', content=body, headers={'stripe-signature': sig}).status_code == 200
    assert client.get('/api/me', headers=h).json()['user']['minutes_balance'] == 400
    # Expired timestamp is refused.
    old = billing.sign(body, 'whsec_test', ts=1)
    assert client.post('/api/billing/webhook', content=body, headers={'stripe-signature': old}).status_code == 400
