import asyncio
import base64
import json
import time
from array import array

import pytest
from fastapi.testclient import TestClient

import ingest
import live_engine
import server

TOKEN = 'test-operator-' + 'x' * 32
AUTH = {'Authorization': 'Bearer ' + TOKEN}


def tone(n, rate=24000):
    import math
    return array('h', [int(8000 * math.sin(2 * math.pi * 440 * i / rate)) for i in range(n)]).tobytes()


def test_resampler_ratio_and_continuity():
    r = live_engine.Resampler(24000, 16000)
    out = b''.join(r.process(tone(2400)[i:i + 960]) for i in range(0, 4800, 960))
    assert abs(len(out) // 2 - 1600) <= 2
    samples = array('h'); samples.frombytes(out)
    assert max(abs(b - a) for a, b in zip(samples, samples[1:])) < 2500  # no clicks at chunk joins


def test_pacer_releases_in_real_time():
    async def run():
        sent = []
        pacer = live_engine.Pacer(lambda f: asyncio.sleep(0, sent.append((time.monotonic(), len(f)))))
        pacer.push(b'\0' * 1280 * 5)  # 200 ms
        t0 = time.monotonic()
        await asyncio.sleep(0.3)
        assert sum(n for _, n in sent) == 1280 * 5
        assert sent[-1][0] - t0 >= 0.15
        pacer.close()
    asyncio.run(run())


class FakeWS:
    def __init__(self, events):
        self.events, self.sent, self.closed = list(events), [], False

    async def send(self, data):
        self.sent.append(json.loads(data))

    def __aiter__(self):
        return self

    async def __anext__(self):
        await asyncio.sleep(0.02)
        if self.events:
            return json.dumps(self.events.pop(0))
        await asyncio.sleep(3600)

    async def close(self):
        self.closed = True


@pytest.fixture(autouse=True)
def reset(monkeypatch):
    monkeypatch.setenv('OPERATOR_TOKEN', TOKEN)
    monkeypatch.setenv('OPENAI_API_KEY', 'sk-test-never-real')
    server.EVENTS.clear(); server.ROOMS.clear(); server._rate_buckets.clear()
    server.STORE.set('users', []); server.SERVER_SESSIONS.clear(); server.CASCADES.clear()


def test_server_session_and_cascade_reach_listeners(monkeypatch):
    sockets = []
    pcm = base64.b64encode(tone(2400)).decode()

    async def fake_connect():
        ws = FakeWS([
            {'type': 'session.created'},
            {'type': 'session.input_transcript.delta', 'delta': 'Bonjour à tous.'},
            {'type': 'session.output_transcript.delta', 'delta': 'Hello everyone.'},
            {'type': 'session.output_audio.delta', 'delta': pcm},
            {'type': 'session.output_transcript.completed'},
            {'type': 'session.input_transcript.completed'},
        ])
        sockets.append(ws)
        return ws

    async def fake_translate(text, langs):
        return {lang: f'[{lang}] {text}' for lang in langs}

    async def fake_tts(text, voice, style):
        return tone(2400)

    monkeypatch.setattr(server, '_realtime_connect', fake_connect)
    monkeypatch.setattr(server, '_translate_many', fake_translate)
    monkeypatch.setattr(server, '_tts_pcm', fake_tts)
    monkeypatch.setattr(ingest, 'enabled', lambda: True)
    # A 3-second tone stands in for the RTMP stream.
    monkeypatch.setattr(ingest, 'ffmpeg_args', lambda key, rate=16000: ['ffmpeg', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=f=300:d=3', '-ac', '1', '-ar', str(rate), '-f', 's16le', 'pipe:1'])

    with TestClient(server.app) as client:
        ev = client.post('/api/events', headers=AUTH, json={'target_language': 'en', 'extra_languages': ['sw', 'ln'], 'captions': True, 'archive_transcripts': True}).json()
        assert ev['targets'] == ['en', 'sw', 'ln']
        with client.websocket_connect(f"/api/ws/{ev['id']}?lang=sw") as sw:
            sw.send_json({'type': 'auth'})
            assert sw.receive_json()['live'] is False
            started = client.post(f"/api/events/{ev['id']}/server/start", headers=AUTH, json={'voice': 'marin'})
            assert started.status_code == 200, started.text
            assert client.post(f"/api/events/{ev['id']}/server/start", headers=AUTH, json={}).status_code == 409
            got_caption = got_audio = False
            deadline = time.time() + 8
            while time.time() < deadline and not (got_caption and got_audio):
                msg = sw.receive()
                if msg.get('bytes'):
                    got_audio = True
                elif msg.get('text'):
                    data = json.loads(msg['text'])
                    if data.get('type') == 'caption' and '[sw] Bonjour' in data['text']:
                        got_caption = True
            assert got_caption and got_audio
        update = sockets[0].sent[0]
        assert update['type'] == 'session.update' and update['session']['audio']['output']['language'] == 'en'
        deadline = time.time() + 5
        while time.time() < deadline and not any(m['type'] == 'session.input_audio_buffer.append' for m in sockets[0].sent):
            time.sleep(0.1)
        appended = [m for m in sockets[0].sent if m['type'] == 'session.input_audio_buffer.append']
        assert appended and len(base64.b64decode(appended[0]['audio'])) == 4800  # 100 ms at 24 kHz
        status = client.get(f"/api/events/{ev['id']}/server", headers=AUTH).json()
        assert status['server']['running'] and status['cascade_languages'] == ['sw', 'ln']
        assert client.post(f"/api/events/{ev['id']}/server/stop", headers=AUTH).json()['stopped']
        assert client.get(f"/api/events/{ev['id']}/server", headers=AUTH).json()['server'] is None
        tx = client.get(f"/api/events/{ev['id']}/transcripts", headers=AUTH).json()['transcripts']
        assert {'en', 'sw', 'src'} <= {t['lang'] for t in tx}


def test_console_mode_cascade_segments(monkeypatch):
    async def fake_translate(text, langs):
        return {lang: text.upper() for lang in langs}

    async def fake_tts(text, voice, style):
        return tone(1200)

    monkeypatch.setattr(server, '_translate_many', fake_translate)
    monkeypatch.setattr(server, '_tts_pcm', fake_tts)
    with TestClient(server.app) as client:
        ev = client.post('/api/events', headers=AUTH, json={'target_language': 'fr', 'extra_languages': ['ar'], 'captions': True}).json()
        assert client.post(f"/api/events/{ev['id']}/cascade/segment", headers=AUTH, json={'text': 'x'}).status_code == 409
        assert client.post(f"/api/events/{ev['id']}/cascade/start", headers=AUTH, json={'voice': 'cedar'}).json()['languages'] == ['ar']
        with client.websocket_connect(f"/api/ws/{ev['id']}?lang=ar") as ar:
            ar.send_json({'type': 'auth'})
            assert ar.receive_json()['live'] is True
            client.post(f"/api/events/{ev['id']}/cascade/segment", headers=AUTH, json={'text': 'salut', 'speaker': 'Ana'})
            texts = []
            deadline = time.time() + 5
            while time.time() < deadline and not any('Ana: SALUT' in t for t in texts):
                msg = ar.receive()
                if msg.get('text'):
                    data = json.loads(msg['text'])
                    if data.get('type') == 'caption':
                        texts.append(data['text'])
            assert any('Ana: SALUT' in t for t in texts)
        assert client.post(f"/api/events/{ev['id']}/cascade/stop", headers=AUTH).json()['stopped']


def test_cascade_languages_only_as_extras(monkeypatch):
    with TestClient(server.app) as client:
        assert client.post('/api/events', headers=AUTH, json={'target_language': 'sw'}).status_code == 400
        assert client.post('/api/events', headers=AUTH, json={'target_language': 'en', 'extra_languages': ['xx']}).status_code == 400


def test_browser_source_feeds_server_session(monkeypatch):
    """Presenter's browser pushes mic PCM; the server translates and listeners receive audio."""
    sockets = []
    pcm = base64.b64encode(tone(2400)).decode()

    async def fake_connect():
        ws = FakeWS([{'type': 'session.created'}, {'type': 'session.output_transcript.delta', 'delta': 'Hello.'},
                     {'type': 'session.output_audio.delta', 'delta': pcm}, {'type': 'session.output_transcript.completed'}])
        sockets.append(ws)
        return ws
    monkeypatch.setattr(server, '_realtime_connect', fake_connect)
    monkeypatch.setattr(ingest, 'enabled', lambda: False)  # no RTMP needed for browser source

    with TestClient(server.app) as client:
        ev = client.post('/api/events', headers=AUTH, json={'target_language': 'en', 'captions': True}).json()
        started = client.post(f"/api/events/{ev['id']}/server/start", headers=AUTH, json={'source': 'browser'})
        assert started.status_code == 200, started.text
        assert started.json()['source'] == 'browser' and started.json()['audio'] is False
        with client.websocket_connect(f"/api/ws/{ev['id']}?lang=en") as listener:
            listener.send_json({'type': 'auth'})
            listener.receive_json()
            with client.websocket_connect(f"/api/ws/{ev['id']}?role=source") as src:
                src.send_json({'type': 'auth', 'token': ev['operator_token']})
                assert src.receive_json()['type'] == 'ready'
                frame = b'\0' * 1280  # 40 ms at 16 kHz
                for _ in range(10):
                    src.send_bytes(frame)
                src.send_json({'type': 'speaker', 'name': 'Claire'})
                src.send_json({'type': 'ping'})
                pong = src.receive_json()
                assert pong['type'] == 'pong' and pong['audio'] is True and pong['speaker'] == 'Claire'
                got_audio = False
                deadline = time.time() + 6
                while time.time() < deadline and not got_audio:
                    msg = listener.receive()
                    if msg.get('bytes'):
                        got_audio = True
                assert got_audio
            # audio appended to the realtime link in 100 ms chunks at 24 kHz
            appended = [m for m in sockets[0].sent if m['type'] == 'session.input_audio_buffer.append']
            assert appended and len(base64.b64decode(appended[0]['audio'])) == 4800
        # a wrong operator token is refused
        with pytest.raises(Exception):
            with client.websocket_connect(f"/api/ws/{ev['id']}?role=source") as bad:
                bad.send_json({'type': 'auth', 'token': 'nope'})
                bad.receive_json()
        assert client.post(f"/api/events/{ev['id']}/server/stop", headers=AUTH).json()['stopped']
