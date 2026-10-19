import asyncio
import time
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
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


@pytest.fixture
def client():
    with TestClient(server.app) as client:
        yield client


def event(client, **fields):
    response = client.post('/api/events', headers=AUTH, json=fields)
    assert response.status_code == 200, response.text
    return response.json()


def test_operator_required_and_fail_closed(client, monkeypatch):
    for path in ('/api/events', '/api/realtime-session'):
        assert client.post(path, json={}).status_code == 401
    assert client.get('/api/stats').status_code == 401
    assert client.get('/api/operator', headers=AUTH).status_code == 200
    monkeypatch.delenv('OPERATOR_TOKEN')
    assert client.post('/api/events', headers=AUTH, json={}).status_code == 503


def test_health_and_security_headers(client):
    response = client.get('/api/health')
    assert response.status_code == 200
    assert response.headers['x-content-type-options'] == 'nosniff'
    assert 'sk-test' not in response.text


def test_body_limit_before_json_validation(client):
    response = client.post('/api/realtime-session', content=b'x' * (server.MAX_BODY_BYTES + 1), headers=AUTH)
    assert response.status_code == 413
    # Event creation accepts a logo, so it has a larger, still bounded, limit.
    assert client.post('/api/events', content=b'x' * (server.LARGE_BODY_BYTES + 1), headers=AUTH).status_code == 413


def test_chunked_body_limit():
    async def run():
        async def chunks():
            yield b'x' * 20000
            yield b'y' * 20000
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url='http://test') as client:
            response = await client.post('/api/realtime-session', content=chunks(), headers=AUTH)
            assert response.status_code == 413
    asyncio.run(run())


def test_invalid_language_and_event_fields(client):
    assert client.post('/api/events', json={'target_language': 'xx'}, headers=AUTH).status_code == 400
    assert client.post('/api/events', json={'name': 'x' * 201}, headers=AUTH).status_code == 422
    assert client.post('/api/realtime-session', json={'instructions': 'x' * 6001}, headers=AUTH).status_code == 422


def test_ephemeral_allowlist_and_no_cache(client, monkeypatch):
    mint = AsyncMock(return_value=(httpx.Response(200, json={'value': 'ek_test', 'expires_at': 123, 'unexpected_secret': 'sk-test'}), False))
    monkeypatch.setattr(server, '_mint_session', mint)
    response = client.post('/api/realtime-session', json={'target_language': 'fr'}, headers=AUTH)
    assert response.status_code == 200
    assert response.json()['value'] == 'ek_test'
    assert response.headers['cache-control'] == 'no-store'
    assert 'sk-test' not in response.text
    assert mint.call_args.args[0]['session']['audio']['output']['language'] == 'fr'


@pytest.mark.parametrize('payload', [{'value': 'sk-private'}, {}, []])
def test_invalid_upstream_response(client, monkeypatch, payload):
    monkeypatch.setattr(server, '_mint_session', AsyncMock(return_value=(httpx.Response(200, json=payload), False)))
    assert client.post('/api/realtime-session', json={}, headers=AUTH).status_code == 502


def test_network_error_is_generic(client, monkeypatch):
    monkeypatch.setattr(server, '_mint_session', AsyncMock(side_effect=httpx.ConnectError('sensitive internal host')))
    response = client.post('/api/realtime-session', json={}, headers=AUTH)
    assert response.status_code == 502
    assert 'sensitive' not in response.text


def test_rate_limit_cannot_be_spoofed(client, monkeypatch):
    monkeypatch.setattr(server, '_mint_session', AsyncMock(return_value=(httpx.Response(200, json={'value': 'ek_test'}), False)))
    limit = server.RATE_LIMIT_MAX
    codes = [client.post('/api/realtime-session', json={}, headers={**AUTH, 'X-Forwarded-For': f'10.0.{i // 250}.{i % 250}'}).status_code for i in range(limit + 1)]
    assert codes == [200] * limit + [429]


def test_event_secret_not_public_and_ttl(client, monkeypatch):
    ev = event(client, pin='1234')
    response = client.get('/api/events/' + ev['id'])
    assert 'operator_token' not in response.text and '1234' not in response.text
    server.EVENTS[ev['id']]['created'] = time.time() - server.EVENT_TTL - 1
    assert client.get('/api/events/' + ev['id']).status_code == 404
    monkeypatch.setattr(server, 'MAX_EVENTS', 1)
    event(client)
    assert client.post('/api/events', json={}, headers=AUTH).status_code == 429


def test_operator_auth_and_duplicate_connection(client):
    ev = event(client)
    url = f"/api/ws/{ev['id']}?role=operator"
    with client.websocket_connect(url) as ws:
        ws.send_json({'token': 'wrong'})
        with pytest.raises(WebSocketDisconnect) as error:
            ws.receive_json()
        assert error.value.code == 4401
    with client.websocket_connect(url) as op:
        op.send_json({'token': ev['operator_token']})
        assert op.receive_json()['type'] == 'ready'
        assert op.receive_json()['count'] == 0
        with client.websocket_connect(url) as other:
            other.send_json({'token': ev['operator_token']})
            with pytest.raises(WebSocketDisconnect) as error:
                other.receive_json()
            assert error.value.code == 4409
        assert client.get('/api/events/' + ev['id']).json()['live'] is True
    assert client.get('/api/events/' + ev['id']).json()['live'] is False


def test_pin_origin_and_listener_limit(client, monkeypatch):
    ev = event(client, pin='1234')
    url = f"/api/ws/{ev['id']}"
    with client.websocket_connect(url, headers={'origin': 'https://evil.example'}) as ws:
        with pytest.raises(WebSocketDisconnect) as error:
            ws.receive_json()
        assert error.value.code == 4403
    with client.websocket_connect(url) as ws:
        ws.send_json({'pin': 'wrong'})
        with pytest.raises(WebSocketDisconnect) as error:
            ws.receive_json()
        assert error.value.code == 4401
    monkeypatch.setattr(server, 'MAX_LISTENERS', 1)
    with client.websocket_connect(url) as first:
        first.send_json({'pin': '1234'})
        assert first.receive_json()['live'] is False
        with client.websocket_connect(url) as second:
            second.send_json({'pin': '1234'})
            with pytest.raises(WebSocketDisconnect) as error:
                second.receive_json()
            assert error.value.code == 4429


def test_audio_caption_fanout_and_operator_disconnect(client):
    ev = event(client)
    url = f"/api/ws/{ev['id']}"
    with client.websocket_connect(url) as listener:
        listener.send_json({})
        assert listener.receive_json()['live'] is False
        with client.websocket_connect(url + '?role=operator') as op:
            op.send_json({'token': ev['operator_token']})
            assert op.receive_json()['type'] == 'ready'
            assert listener.receive_json()['live'] is True
            op.send_bytes(b'header')
            assert listener.receive_bytes() == b'header'
            with client.websocket_connect(url) as late:
                late.send_json({})
                assert late.receive_json()['live'] is True
                assert late.receive_bytes() == b'header'
                op.send_json({'type': 'caption', 'text': 'Bonjour'})
                assert late.receive_json()['text'] == 'Bonjour'
                assert listener.receive_json()['text'] == 'Bonjour'
        assert listener.receive_json()['live'] is False


def test_catalog_survives_restart_and_rotates_publishing_token(client, monkeypatch, tmp_path):
    from event_store import EventStore
    path = str(tmp_path / 'events.sqlite3')
    first = EventStore(path)
    monkeypatch.setattr(server, 'EVENTS', first)
    ev = event(client, pin='1234', target_language='fr')
    first.close()
    second = EventStore(path)
    monkeypatch.setattr(server, 'EVENTS', second)
    server.ROOMS.clear()
    assert client.get('/api/events/' + ev['id']).json()['target'] == 'fr'
    assert client.get('/api/events').status_code == 401
    listing = client.get('/api/events', headers=AUTH)
    assert listing.json()['events'][0]['id'] == ev['id']
    assert 'operator_token' not in listing.text
    response = client.post(f"/api/events/{ev['id']}/resume", headers=AUTH)
    assert response.status_code == 200
    assert response.headers['cache-control'] == 'no-store'
    token = response.json()['operator_token']
    assert token != ev['operator_token']
    assert token not in (tmp_path / 'events.sqlite3').read_bytes().decode('latin1')
    with client.websocket_connect(f"/api/ws/{ev['id']}?role=operator") as ws:
        ws.send_json({'token': ev['operator_token']})
        with pytest.raises(WebSocketDisconnect): ws.receive_json()
    with client.websocket_connect(f"/api/ws/{ev['id']}?role=operator") as ws:
        ws.send_json({'token': token})
        assert ws.receive_json()['type'] == 'ready'
        assert client.post(f"/api/events/{ev['id']}/resume", headers=AUTH).status_code == 409
    assert server._check_pin(ev['id'], '1234') is True
    second.pop(ev['id'])
    second.close()
    third = EventStore(path)
    assert not third
    third.close()


@pytest.mark.parametrize('status,code,expected,message', [
    (401, None, 502, 'key is invalid'), (403, None, 502, 'cannot access'),
    (429, 'insufficient_quota', 402, 'insufficient credit'),
    (429, 'rate_limit_exceeded', 429, 'Wait one minute'), (500, None, 502, 'temporarily unavailable'),
])
def test_actionable_upstream_errors_without_leaking_body(client, monkeypatch, status, code, expected, message):
    response = httpx.Response(status, json={'error': {'code': code, 'message': 'private upstream data sk-secret'}})
    monkeypatch.setattr(server, '_mint_session', AsyncMock(return_value=(response, False)))
    result = client.post('/api/realtime-session', json={}, headers=AUTH)
    assert result.status_code == expected
    assert message in result.json()['detail']
    assert 'sk-secret' not in result.text


@pytest.mark.parametrize("mode", ["near_field", "far_field"])
def test_noise_reduction_forwarded_to_openai(client, monkeypatch, mode):
    mint = AsyncMock(return_value=(httpx.Response(200, json={"value": "ek_test"}), False))
    monkeypatch.setattr(server, "_mint_session", mint)
    response = client.post("/api/realtime-session", headers=AUTH, json={"target_language": "fr", "noise_reduction": mode})
    assert response.status_code == 200
    assert mint.call_args.args[0]["session"]["audio"]["input"]["noise_reduction"] == {"type": mode}


def test_invalid_noise_reduction_rejected(client):
    assert client.post("/api/realtime-session", headers=AUTH, json={"noise_reduction": "invalid"}).status_code == 422


def _mock_speech(monkeypatch, handler):
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(server, '_http', lambda: client)
    return client


def test_studio_voice_streams_pcm_with_style(client, monkeypatch):
    seen = {}

    def handler(request):
        seen['url'] = str(request.url)
        seen['body'] = request.read()
        return httpx.Response(200, content=b'\x01\x00' * 300)

    _mock_speech(monkeypatch, handler)
    response = client.post('/api/tts', headers=AUTH, json={'text': 'Hello everyone.', 'voice': 'Marin', 'style': 'Calm'})
    assert response.status_code == 200
    assert response.content == b'\x01\x00' * 300
    assert response.headers['cache-control'] == 'no-store'
    assert seen['url'] == server.OPENAI_SPEECH_URL
    import json as _json
    body = _json.loads(seen['body'])
    assert body == {'model': server.TTS_MODEL, 'voice': 'marin', 'input': 'Hello everyone.', 'response_format': 'pcm', 'instructions': 'Calm'}


def test_studio_voice_requires_operator_and_valid_voice(client, monkeypatch):
    _mock_speech(monkeypatch, lambda request: httpx.Response(200, content=b''))
    assert client.post('/api/tts', json={'text': 'Hi', 'voice': 'marin'}).status_code == 401
    assert client.post('/api/tts', headers=AUTH, json={'text': 'Hi', 'voice': 'robot'}).status_code == 400
    assert client.post('/api/tts', headers=AUTH, json={'text': 'x' * 1201, 'voice': 'marin'}).status_code == 422


def test_studio_voice_upstream_errors_are_generic(client, monkeypatch):
    _mock_speech(monkeypatch, lambda request: httpx.Response(429, json={'error': {'code': 'insufficient_quota', 'message': 'sk-secret'}}))
    response = client.post('/api/tts', headers=AUTH, json={'text': 'Hi there', 'voice': 'cedar'})
    assert response.status_code == 402
    assert 'sk-secret' not in response.text


def test_pcm_broadcast_has_no_header_cache_and_relays_voice_meta(client):
    ev = event(client)
    url = f"/api/ws/{ev['id']}"
    with client.websocket_connect(url + '?role=operator') as op:
        op.send_json({'token': ev['operator_token'], 'format': 'pcm16', 'rate': 16000})
        assert op.receive_json()['type'] == 'ready'
        op.send_json({'type': 'meta', 'mode': 'studio', 'voice': 'Marin', 'extra': 'ignored'})
        op.send_bytes(b'\x00\x01' * 640)
        with client.websocket_connect(url) as late:
            late.send_json({})
            status = late.receive_json()
            assert status['format'] == 'pcm16' and status['rate'] == 16000
            assert status['meta'] == {'mode': 'studio', 'voice': 'Marin'}
            op.send_bytes(b'\x02\x03' * 640)
            assert late.receive_bytes() == b'\x02\x03' * 640  # no stale frame replayed


def test_unknown_audio_format_rejected(client):
    ev = event(client)
    with client.websocket_connect(f"/api/ws/{ev['id']}?role=operator") as op:
        op.send_json({'token': ev['operator_token'], 'format': 'mp3'})
        with pytest.raises(WebSocketDisconnect) as error:
            op.receive_json()
        assert error.value.code == 4400


def _until(ws, predicate, limit=10):
    for _ in range(limit):
        message = ws.receive_json()
        if predicate(message):
            return message
    raise AssertionError('expected message not received')


def test_multilanguage_event_has_one_channel_per_language(client):
    ev = event(client, target_language='fr', extra_languages=['es', 'FR', 'de'])
    assert ev['targets'] == ['fr', 'es', 'de']
    assert [c['lang'] for c in ev['channels']] == ['fr', 'es', 'de']
    url = f"/api/ws/{ev['id']}"
    with client.websocket_connect(url + '?role=operator&lang=es') as op_es, \
         client.websocket_connect(url + '?role=operator&lang=fr') as op_fr:
        op_es.send_json({'token': ev['operator_token'], 'format': 'pcm16'})
        assert op_es.receive_json() == {'type': 'ready', 'lang': 'es'}
        op_fr.send_json({'token': ev['operator_token'], 'format': 'pcm16'})
        assert op_fr.receive_json()['lang'] == 'fr'
        with client.websocket_connect(url + '?lang=es') as listener:
            listener.send_json({})
            assert listener.receive_json()['live'] is True
            assert _until(op_es, lambda m: m.get('total') == 1) == {'type': 'listeners', 'count': 1, 'total': 1}
            assert _until(op_fr, lambda m: m.get('total') == 1) == {'type': 'listeners', 'count': 0, 'total': 1}
            op_fr.send_bytes(b'\x01\x00' * 640)
            op_es.send_bytes(b'\x02\x00' * 640)
            assert listener.receive_bytes() == b'\x02\x00' * 640
        info = client.get(f"/api/events/{ev['id']}").json()
        assert info['live'] is True and all(c['live'] for c in info['channels'] if c['lang'] in ('fr', 'es'))


def test_unknown_language_channel_and_language_cap(client):
    ev = event(client, target_language='en')
    with client.websocket_connect(f"/api/ws/{ev['id']}?lang=ja") as ws:
        with pytest.raises(WebSocketDisconnect) as error:
            ws.receive_json()
        assert error.value.code == 4404
    response = client.post('/api/events', headers=AUTH, json={'target_language': 'en', 'extra_languages': ['fr', 'es', 'de', 'it', 'pt']})
    assert response.status_code == 400


def test_caption_only_screen_gets_text_but_no_audio(client):
    ev = event(client)
    url = f"/api/ws/{ev['id']}"
    with client.websocket_connect(url + '?role=operator') as op:
        op.send_json({'token': ev['operator_token'], 'format': 'pcm16'})
        op.receive_json()
        with client.websocket_connect(url + '?audio=0') as screen, client.websocket_connect(url) as phone:
            screen.send_json({}); phone.send_json({})
            screen.receive_json(); phone.receive_json()
            op.send_bytes(b'\x00\x00' * 640)
            op.send_json({'type': 'caption', 'text': 'Bonjour'})
            assert phone.receive_bytes() == b'\x00\x00' * 640
            assert phone.receive_json()['text'] == 'Bonjour'
            assert screen.receive_json() == {'type': 'caption', 'text': 'Bonjour'}


def test_summary_uses_responses_api_without_storage(client, monkeypatch):
    seen = {}

    def handler(request):
        import json as _json
        seen['url'] = str(request.url)
        seen['body'] = _json.loads(request.read())
        return httpx.Response(200, json={'output': [{'type': 'message', 'content': [{'type': 'output_text', 'text': '## Overview\nOK'}]}]})

    _mock_speech(monkeypatch, handler)
    transcript = 'Bienvenue à tous. ' * 4000
    response = client.post('/api/summary', headers=AUTH, json={'text': transcript, 'language': 'fr', 'title': 'Talk'})
    assert response.status_code == 200, response.text
    assert response.json()['summary'] == '## Overview\nOK'
    assert seen['url'] == server.OPENAI_RESPONSES_URL
    assert seen['body']['store'] is False and seen['body']['model'] == server.SUMMARY_MODEL
    assert 'French' in seen['body']['instructions']
    assert client.post('/api/summary', json={'text': transcript}).status_code == 401


def test_caption_relay_targets_only_zoom_and_teams(client, monkeypatch):
    sent = []

    def handler(request):
        sent.append((str(request.url), request.read().decode(), request.headers['content-type']))
        return httpx.Response(200)

    _mock_speech(monkeypatch, handler)
    zoom = 'https://wmcc.zoom.us/closedcaption?id=1&ns=x&expire=9&signature=abc&seq=3'
    r = client.post('/api/caption-relay', headers=AUTH, json={'provider': 'zoom', 'url': zoom, 'text': 'Bonjour à tous', 'lang': 'fr-FR', 'seq': 7})
    assert r.json() == {'ok': True, 'status': 200}
    url, body, ctype = sent[-1]
    assert url.startswith('https://wmcc.zoom.us/closedcaption?') and 'seq=7' in url and 'lang=fr-FR' in url and url.count('seq=') == 1
    assert body == 'Bonjour à tous' and ctype.startswith('text/plain')
    teams = 'https://api.captions.office.microsoft.com/cartcaption?meetingid=m1&token=t1'
    assert client.post('/api/caption-relay', headers=AUTH, json={'provider': 'teams', 'url': teams, 'text': 'Hi', 'lang': 'en-US'}).json()['ok']
    assert 'lang=en-us' in sent[-1][0]
    for bad in ['https://evil.example/zoom.us', 'http://wmcc.zoom.us/closedcaption', 'https://zoom.us.evil.com/x', 'https://wmcc.zoom.us:8443/x']:
        assert client.post('/api/caption-relay', headers=AUTH, json={'provider': 'zoom', 'url': bad, 'text': 'x'}).status_code == 400
    assert client.post('/api/caption-relay', json={'provider': 'zoom', 'url': zoom, 'text': 'x'}).status_code == 401


def test_human_interpreter_booth_flow(client):
    ev = event(client, target_language='en', extra_languages=['es', 'fr'], human_languages=['fr', 'en'])
    assert ev['human'] == ['fr']  # the main language always stays with the AI
    code = ev['interpreter_code']
    url = f"/api/ws/{ev['id']}"
    with client.websocket_connect(url + '?role=operator&lang=src') as floor, \
         client.websocket_connect(url + '?role=booth&lang=src') as booth:
        floor.send_json({'token': ev['operator_token'], 'format': 'pcm16'})
        assert floor.receive_json()['type'] == 'ready'
        booth.send_json({'code': code})
        assert booth.receive_json()['live'] is True
        floor.send_bytes(b'\x05\x00' * 640)
        assert booth.receive_bytes() == b'\x05\x00' * 640
        with client.websocket_connect(url + '?role=interpreter&lang=fr') as interp, client.websocket_connect(url + '?lang=fr') as listener:
            interp.send_json({'code': code})
            assert interp.receive_json()['type'] == 'ready'
            interp.send_json({'type': 'meta', 'mode': 'human', 'voice': None})
            listener.send_json({})
            status = listener.receive_json()
            assert status['live'] is True and status['meta'] == {'mode': 'human', 'voice': None}
            interp.send_bytes(b'\x09\x00' * 640)
            assert listener.receive_bytes() == b'\x09\x00' * 640
    for role, lang, payload, expected in [('interpreter', 'fr', {'code': 'wrong'}, 4401), ('interpreter', 'es', {'code': code}, 4403),
                                          ('listener', 'src', {}, 4403), ('booth', 'fr', {'code': code}, 4400)]:
        with client.websocket_connect(f"{url}?role={role}&lang={lang}") as ws:
            ws.send_json(payload)
            with pytest.raises(WebSocketDisconnect) as error:
                ws.receive_json()
            assert error.value.code == expected
    assert server.EVENTS[ev['id']]['usage'].get('fr') is None  # human channels never count as AI usage
    rotated = client.post(f"/api/events/{ev['id']}/interpreter-code", headers=AUTH).json()['interpreter_code']
    assert rotated != code


def test_usage_branding_summaries_and_library(client, monkeypatch):
    ev = event(client, logo='data:image/png;base64,iVBORw0KGgo=', sponsor='Merci à BMH')
    assert ev['logo'].startswith('data:image/png') and ev['sponsor'] == 'Merci à BMH'
    assert client.post('/api/events', headers=AUTH, json={'logo': 'data:image/svg+xml;base64,PHN2Zz4='}).status_code == 400
    url = f"/api/ws/{ev['id']}"
    with client.websocket_connect(url + '?role=operator') as op:
        op.send_json({'token': ev['operator_token'], 'format': 'pcm16'})
        op.receive_json()
        time.sleep(0.05)
    usage = client.get('/api/usage', headers=AUTH).json()
    assert usage['minutes_by_language']['en'] >= 0 and usage['cap_minutes'] is None
    assert client.get('/api/events', headers=AUTH).json()['events'][0]['usage']['en'] > 0
    put = client.put(f"/api/events/{ev['id']}/summaries", headers=AUTH, json={'lang': 'fr', 'text': '## Points clés\n- Bienvenue'})
    assert put.json()['summaries'] == {'fr': '## Points clés\n- Bienvenue'}
    assert client.get(f"/api/events/{ev['id']}").json()['summaries']['fr'].startswith('## Points')
    assert client.delete(f"/api/events/{ev['id']}/summaries/fr", headers=AUTH).json()['summaries'] == {}
    assert client.put(f"/api/events/{ev['id']}/branding", headers=AUTH, json={'logo': None, 'sponsor': ''}).json()['logo'] is None
    lib = {'glossaries': [{'name': 'Église', 'text': 'Monkton => Moncton'}]}
    assert client.put('/api/library', headers=AUTH, json=lib).json() == lib
    assert client.get('/api/library', headers=AUTH).json() == lib
    assert client.get('/api/library').status_code == 401
    monkeypatch.setattr(server, 'USAGE_CAP_MINUTES', 0.0001)
    server.STORE.set(server._month_key(), {'en': 60})
    response = client.post('/api/realtime-session', headers=AUTH, json={'target_language': 'en'})
    assert response.status_code == 402 and 'monthly' in response.json()['detail']


def test_sso_flow_issues_operator_session_for_allowed_accounts(client, monkeypatch):
    monkeypatch.setenv('OIDC_ISSUER', 'https://login.example.com')
    monkeypatch.setenv('OIDC_CLIENT_ID', 'cid')
    monkeypatch.setenv('OIDC_CLIENT_SECRET', 'secret')
    monkeypatch.setenv('OIDC_ALLOWED', 'boss@bmh.org,@stat4research.com')
    monkeypatch.setenv('PUBLIC_ORIGIN', 'https://translate.example.org')
    server._oidc_discovery.clear()
    emails = iter(['team@stat4research.com', 'intruder@gmail.com'])

    def handler(request):
        path = request.url.path
        if path.endswith('openid-configuration'):
            return httpx.Response(200, json={'authorization_endpoint': 'https://login.example.com/auth', 'token_endpoint': 'https://login.example.com/token', 'userinfo_endpoint': 'https://login.example.com/me'})
        if path == '/token':
            body = request.read().decode()
            assert 'code_verifier=' in body and 'client_secret=secret' in body
            return httpx.Response(200, json={'access_token': 'at'})
        return httpx.Response(200, json={'email': next(emails), 'email_verified': True})

    _mock_speech(monkeypatch, handler)
    assert client.get('/api/auth/sso').json()['enabled'] is True
    for allowed in (True, False):
        start = client.get('/api/auth/sso/start', follow_redirects=False)
        assert start.status_code == 302 and start.headers['location'].startswith('https://login.example.com/auth?')
        state = dict(httpx.URL(start.headers['location']).params)['state']
        assert 'code_challenge_method=S256' in start.headers['location']
        done = client.get(f'/api/auth/sso/callback?code=c&state={state}', follow_redirects=False)
        location = done.headers['location']
        if allowed:
            assert location.startswith('https://translate.example.org/login#sso=')
            session = location.split('#sso=')[1]
            who = client.get('/api/operator', headers={'Authorization': 'Bearer ' + session}).json()
            assert who['email'] == 'team@stat4research.com'
            client.post('/api/auth/logout', headers={'Authorization': 'Bearer ' + session})
            assert client.get('/api/operator', headers={'Authorization': 'Bearer ' + session}).status_code == 401
        else:
            assert '#sso_error=' in location
    replay = client.get(f'/api/auth/sso/callback?code=c&state={state}', follow_redirects=False)
    assert '#sso_error=' in replay.headers['location']  # states are single-use


def test_session_code_scheduling_clone_and_delete(client):
    ev = event(client, name='Culte', start_at='2026-11-01T10:00:00-03:00', duration_minutes=90, labels=['église', ' ', 'dimanche'], pinned=True, pin='2468')
    assert len(ev['code']) == 8 and ev['code'][:4].isalpha() and ev['code'][4:].isdigit()
    assert ev['labels'] == ['église', 'dimanche'] and ev['pinned'] and ev['duration_minutes'] == 90
    assert client.get(f"/api/join/{ev['code'].lower()[:4]}-{ev['code'][4:]}").json() == {'id': ev['id']}
    assert client.get('/api/join/ZZZZ0000').status_code == 404
    assert client.post('/api/events', headers=AUTH, json={'start_at': 'tomorrow'}).status_code == 400
    upd = client.patch(f"/api/events/{ev['id']}", headers=AUTH, json={'name': 'Culte du soir', 'labels': ['soir'], 'archive_transcripts': True}).json()
    assert upd['name'] == 'Culte du soir' and upd['labels'] == ['soir'] and upd['archive'] is True
    clone = client.post(f"/api/events/{ev['id']}/clone", headers=AUTH).json()
    assert clone['id'] != ev['id'] and clone['code'] != ev['code'] and clone['name'] == 'Culte du soir (copy)' and clone['pin_protected']
    assert client.delete(f"/api/events/{clone['id']}", headers=AUTH).json() == {'deleted': clone['id']}
    assert client.get(f"/api/events/{clone['id']}").status_code == 404
    # pinned and future events are not pruned by age
    server.EVENTS[ev['id']] = {**server.EVENTS[ev['id']], 'created': time.time() - 10 * server.EVENT_TTL}
    server._prune_events()
    assert ev['id'] in server.EVENTS


def test_transcript_archive_and_translation(client, monkeypatch):
    ev = event(client, target_language='fr')
    seg = {'segments': [{'start': 0, 'end': 1500, 'text': 'Bonjour à tous.', 'speaker': 'Pasteur'}, {'start': 1600, 'end': 2500, 'text': 'Merci.'}]}
    assert client.put(f"/api/events/{ev['id']}/transcripts/fr", headers=AUTH, json=seg).status_code == 403  # opt-in
    client.patch(f"/api/events/{ev['id']}", headers=AUTH, json={'archive_transcripts': True})
    assert client.put(f"/api/events/{ev['id']}/transcripts/fr", headers=AUTH, json=seg).json() == {'lang': 'fr', 'segments': 2}
    assert client.get(f"/api/events/{ev['id']}/transcripts/fr").status_code == 401
    got = client.get(f"/api/events/{ev['id']}/transcripts/fr", headers=AUTH).json()['segments']
    assert got[0]['speaker'] == 'Pasteur' and got[1]['speaker'] is None

    def handler(request):
        import json as _json
        body = _json.loads(request.read())
        items = _json.loads(body['input'])['items']
        assert body['text']['format']['type'] == 'json_schema' and body['store'] is False
        return httpx.Response(200, json={'output_text': _json.dumps({'items': [f'EN:{t}' for t in items]})})

    _mock_speech(monkeypatch, handler)
    index = client.post(f"/api/events/{ev['id']}/transcripts/fr/translate", headers=AUTH, json={'to': 'en'}).json()['transcripts']
    assert {t['lang'] for t in index} == {'fr', 'en'} and next(t for t in index if t['lang'] == 'en')['translated_from'] == 'fr'
    en = client.get(f"/api/events/{ev['id']}/transcripts/en", headers=AUTH).json()['segments']
    assert en[0] == {'start': 0, 'end': 1500, 'text': 'EN:Bonjour à tous.', 'speaker': 'Pasteur'}
    listed = client.get('/api/events', headers=AUTH).json()['events'][0]
    assert listed['archive'] and len(listed['transcripts']) == 2
    client.delete(f"/api/events/{ev['id']}/transcripts/en", headers=AUTH)
    assert [t['lang'] for t in client.get(f"/api/events/{ev['id']}/transcripts", headers=AUTH).json()['transcripts']] == ['fr']
    client.delete(f"/api/events/{ev['id']}", headers=AUTH)
    assert server.STORE.get(f"tx:{ev['id']}:fr") is None


def test_api_keys_authorize_and_revoke(client):
    created = client.post('/api/keys', headers=AUTH, json={'name': 'Site BMH'}).json()
    key = created['key']
    assert key.startswith('tbk_') and created['last4'] == key[-4:] and 'hash' not in created
    assert client.get('/api/events', headers={'Authorization': 'Bearer ' + key}).status_code == 200
    assert client.post('/api/keys', headers={'Authorization': 'Bearer ' + key}, json={'name': 'x'}).status_code == 403
    assert client.get('/api/events/' + event(client)['id'], headers={'Authorization': 'Bearer ' + key}).status_code == 200
    assert 'hash' not in client.get('/api/keys', headers=AUTH).json()['keys'][0]
    client.delete(f"/api/keys/{created['id']}", headers=AUTH)
    assert client.get('/api/events', headers={'Authorization': 'Bearer ' + key}).status_code == 401
    assert client.get('/api/events', headers={'Authorization': 'Bearer tbk_forged'}).status_code == 401


def test_webhook_relay_blocks_internal_addresses(client, monkeypatch):
    sent = []
    _mock_speech(monkeypatch, lambda request: (sent.append(request.read()), httpx.Response(204))[1])
    for bad in ['http://example.com/hook', 'https://127.0.0.1/hook', 'https://localhost/hook', 'https://10.0.0.5/x', 'https://169.254.169.254/latest']:
        assert client.post('/api/caption-relay', headers=AUTH, json={'provider': 'webhook', 'url': bad, 'text': 'x'}).status_code == 400, bad
    monkeypatch.setattr(server.socket, 'getaddrinfo', lambda *a, **k: [(2, 1, 6, '', ('93.184.216.34', 443))])
    ok = client.post('/api/caption-relay', headers=AUTH, json={'provider': 'webhook', 'url': 'https://hooks.example.org/tb', 'text': 'Bonjour', 'lang': 'fr-FR', 'seq': 3}).json()
    assert ok == {'ok': True, 'status': 204}
    import json as _json
    payload = _json.loads(sent[-1])
    assert payload['text'] == 'Bonjour' and payload['seq'] == 3 and payload['type'] == 'caption'


def test_peak_listeners_recorded(client):
    ev = event(client)
    with client.websocket_connect(f"/api/ws/{ev['id']}") as a, client.websocket_connect(f"/api/ws/{ev['id']}") as b:
        a.send_json({}); b.send_json({}); a.receive_json(); b.receive_json()
    assert client.get('/api/events', headers=AUTH).json()['events'][0]['peak_listeners'] == 2


def test_deleting_event_removes_archive_and_index(client):
    ev = client.post('/api/events', headers=AUTH, json={'archive_transcripts': True}).json()
    other = client.post('/api/events', headers=AUTH, json={'archive_transcripts': True}).json()
    seg = {'segments': [{'start': 0, 'end': 900, 'text': 'Hi', 'speaker': 'Ana'}]}
    for e in (ev, other):
        assert client.put(f"/api/events/{e['id']}/transcripts/en", headers=AUTH, json=seg).status_code == 200
    assert client.get(f"/api/events/{ev['id']}", headers=AUTH).json()['archive'] is True
    assert client.delete(f"/api/events/{ev['id']}", headers=AUTH).status_code == 200
    assert server.STORE.get(f"txindex:{ev['id']}") is None and server.STORE.get(f"tx:{ev['id']}:en") is None
    assert client.get(f"/api/events/{other['id']}/transcripts/en", headers=AUTH).json()['segments'][0]['speaker'] == 'Ana'
