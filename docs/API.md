# TranslateBox HTTP API

Base URL: `https://<your-domain>/api`. All bodies are JSON. Times are Unix seconds unless noted; transcript segment times are milliseconds from the start of the session.

## Authentication

Operator endpoints need `Authorization: Bearer <token>` where the token is one of:

- the operator code (`OPERATOR_TOKEN`, 32+ characters),
- an SSO session token (after "Sign in with …"),
- a **sign-in session** `tbs_…` from `POST /api/auth/login` (email, password, optional 6-digit `code`) or single sign-on,
- an **API key** `tbk_…` created in **Portal → Account** (or `POST /api/keys`).

Roles: `owner`, `admin`, `presenter`. Presenters only see and act on their own sessions (other ids answer 404). The operator code acts as the owner. An API key acts as the person who created it (never above admin) and cannot list, create or revoke keys. Keys are stored hashed; the secret is shown once.

Public endpoints (no token): `GET /api/health`, `GET /api/events/{id}`, `GET /api/join/{code}`, the listener WebSocket.

## Sessions (events)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/events` | Create a session |
| `GET` | `/events` | List sessions with usage, peak listeners and archived transcripts |
| `GET` | `/events/{id}` | Public info (name, languages, code, live state) |
| `PATCH` | `/events/{id}` | Edit name, organization, `start_at`, `duration_minutes`, `labels`, `pinned`, `archive_transcripts` |
| `POST` | `/events/{id}/clone` | Duplicate (new id, new code, same settings and PIN) |
| `DELETE` | `/events/{id}` | Delete with its transcripts (409 while live) |
| `POST` | `/events/{id}/resume` | Get a new operator token to broadcast this session |
| `PUT` | `/events/{id}/branding` | `{logo, sponsor}` |
| `PUT` / `DELETE` | `/events/{id}/summaries[/{lang}]` | Publish/remove an AI summary on the listener page |
| `POST` | `/events/{id}/interpreter-code` | New booth code for human interpreters |
| `GET` | `/join/{code}` | Resolve a short session code (`ABCD1234`) to `{id}` |

`POST /events` body:

```json
{
  "name": "Annual conference",
  "organization": "My company",
  "target_language": "en",
  "extra_languages": ["fr", "es"],
  "human_languages": ["es"],
  "pin": null,
  "captions": true,
  "start_at": "2026-11-01T15:00:00Z",
  "duration_minutes": 90,
  "labels": ["Keynote"],
  "pinned": false,
  "archive_transcripts": true
}
```

Sessions expire 24 h after their scheduled end (or creation) unless `pinned`.

## Transcripts (opt-in archive)

Only for sessions with `archive_transcripts: true`. The operator console uploads every minute while broadcasting and when stopping.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/events/{id}/transcripts` | Index: `[{lang, segments, updated, translated_from}]` |
| `GET` | `/events/{id}/transcripts/{lang}` | `{lang, segments: [{start, end, text, speaker}]}` (`lang` = `src` for the original speech) |
| `PUT` | `/events/{id}/transcripts/{lang}` | Replace (`{segments}`; ≤ 8000 segments) |
| `DELETE` | `/events/{id}/transcripts/{lang}` | Delete one language |
| `POST` | `/events/{id}/transcripts/{lang}/translate` | `{to: "de"}` → translated copy with the same timing |

## Accounts

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/auth/login` | `{email, password, code?}` → `{token, user}`; 401 with `totp_required: true` when the 2FA code is needed |
| `POST` | `/auth/logout` | End the session |
| `GET` / `PATCH` | `/me` | Current principal and profile (`{name}`) |
| `POST` | `/me/password` | `{current, new}` (10+ chars, upper, lower, digit) |
| `POST` | `/me/2fa/setup` · `/me/2fa/enable` · `/me/2fa/disable` | Authenticator app (`otpauth://` URI), `{code}` |
| `GET` / `POST` | `/users` | Admin: list, create `{email, name, role, minutes}` → temporary password |
| `PATCH` / `DELETE` | `/users/{uid}` | Admin: `{name, role, disabled, minutes_balance, unlimited}` |
| `POST` | `/users/{uid}/reset` | Admin: new temporary password, 2FA off |
| `GET` | `/billing/packs` | Minute packs for sale and current balance |
| `POST` | `/billing/checkout` | `{price_id}` → `{url}` of the Stripe Checkout page |
| `POST` | `/billing/webhook` | Stripe webhook (signed), credits minutes |
| `POST` | `/minutes/transfer` | `{to, minutes, from_user?}` |
| `GET` | `/directory` | Colleagues with a minute balance (transfer targets) |

## Stream ingest

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/events/{id}/ingest` | RTMP URL, stream key, SRT address |
| `POST` | `/events/{id}/ingest/rotate` | New stream key |
| `POST` | `/ingest/auth` | Called by MediaMTX before each publish/read |

The console reads the stream on `wss://<domain>/api/ws/{id}?role=ingest` (first message `{"type":"auth","bearer":"<token>"}`): JSON `{type:"ingest", live}` and binary PCM16 16 kHz frames.

## Server-side live engines

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/events/{id}/server/start` | Translate on the server `{source: "ingest" \| "browser", voice_mode: "original" \| "studio", voice, style, instructions}`. `ingest` pulls the RTMP/SRT stream; `browser` expects microphone audio on the `source` WebSocket. `original` uses OpenAI's translation voice (it follows, and changes with, the speaker); `studio` speaks every language with one fixed voice through the text pipeline: clauses are translated as soon as they end, the next clause is translated while the previous one is spoken, and speech is streamed as it is synthesised (about 1–2 s more delay than the translation voice). `GET /server` reports `cascade.timing` (`translate_ms`, `first_audio_ms`) |
| `GET` | `/voices` | Studio voices offered to the console: `{provider: "openai" \| "elevenlabs", stt, voices: [{id, label, hint}]}` |
| `POST` | `/events/{id}/server/voice` | Change the studio voice or its style while the session runs `{voice, style}` |
| `GET` | `/events/{id}/server` | Status: running, audio, per-language state and listeners, text-pipeline queue |
| `POST` | `/events/{id}/server/speaker` | `{name}` speaker label for captions and transcripts |
| `POST` | `/events/{id}/server/stop` | Stop |
| `POST` | `/events/{id}/cascade/start` | Console mode: start the text-pipeline languages `{voice, style}` |
| `POST` | `/events/{id}/cascade/segment` | `{text, speaker}` one finished source sentence (empty text = keep-alive) |
| `POST` | `/events/{id}/cascade/stop` | Stop |

Text-pipeline ("cascade") languages: `ar sw ln ur ta pa bn tr pl nl uk ro el cs sv da fi no he fa th ms tl am yo ha ig ht rw so zu hu bg hr sr sk ne mr te gu kn ml` — allowed as extra languages only.

## Activity and settings

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/usage` | AI broadcast minutes this month, per language, and the cap |
| `GET` / `PUT` | `/library` | Saved glossaries `{glossaries: [{name, text}]}` |
| `POST` | `/caption-relay` | Forward one caption line: `{provider: "zoom" | "teams" | "webhook", url, text, lang, seq}` |
| `POST` | `/summary` | AI summary of a text `{text, language, title}` |
| `POST` | `/tts` | Studio voice (PCM 24 kHz) |

### Caption webhook

With `provider: "webhook"` the server POSTs to your **public HTTPS** URL (private, loopback and link-local addresses are refused):

```json
{"type": "caption", "text": "Welcome everyone", "lang": "en-US", "seq": 12, "sent_at": 1793520000.4}
```

Answer with any 2xx status.

## Presenter microphone WebSocket (simple mode)

`wss://<domain>/api/ws/{id}?role=source` — send `{"type":"auth","token":"<event operator token>"}`, wait for `{"type":"ready"}`, then send binary PCM16 mono 16 kHz frames (40 ms). JSON messages: `{"type":"speaker","name"}`, `{"type":"ping"}` → `pong` with the server status. The server pushes `{"type":"caption","lang","text"}` and `{"type":"source","text"}` so the console can show transcripts. A newer socket for the same event takes over (close 4409); close 4404 means the server session ended and must be started again.

## Listener WebSocket

`wss://<domain>/api/ws/{id}?role=listener&lang=fr[&audio=0]` — send `{"type":"auth","pin":null}` first. Messages: `status`, `meta`, `caption` (JSON) and binary PCM16 16 kHz mono frames (omitted with `audio=0`). Close codes: 4401 wrong PIN, 4403 origin not allowed, 4404 unknown event, 4429 capacity.

## Examples

```bash
KEY=tbk_...
curl -H "Authorization: Bearer $KEY" https://example.org/api/events
curl -X PATCH -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"pinned": true}' https://example.org/api/events/<id>
curl -H "Authorization: Bearer $KEY" https://example.org/api/events/<id>/transcripts/fr
```
