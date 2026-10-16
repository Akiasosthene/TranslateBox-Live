# TranslateBox HTTP API

Base URL: `https://<your-domain>/api`. All bodies are JSON. Times are Unix seconds unless noted; transcript segment times are milliseconds from the start of the session.

## Authentication

Operator endpoints need `Authorization: Bearer <token>` where the token is one of:

- the operator code (`OPERATOR_TOKEN`, 32+ characters),
- an SSO session token (after "Sign in with …"),
- an **API key** `tbk_…` created in **Portal → API keys** (or `POST /api/keys`).

API keys can do everything an operator can, **except** list, create or revoke API keys. Keys are stored hashed; the secret is shown once. Revoke a key to cut access immediately.

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
  "name": "Sunday service",
  "organization": "My church",
  "target_language": "en",
  "extra_languages": ["fr", "es"],
  "human_languages": ["es"],
  "pin": null,
  "captions": true,
  "start_at": "2026-11-01T15:00:00Z",
  "duration_minutes": 90,
  "labels": ["Sunday"],
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
