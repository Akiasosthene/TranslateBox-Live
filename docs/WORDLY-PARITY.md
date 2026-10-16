# Wordly vs TranslateBox — feature parity (V2.3, October 2026)

Clean-room comparison built from Wordly's **public** user guides and product pages. No Wordly code, app binary or private API was used.

Legend: ✅ equal or better · 🟡 partial · ❌ missing · ➕ TranslateBox only

## Attendees (listener)

| Wordly | TranslateBox | Status |
|---|---|---|
| Join by QR code or link | QR code, link, embeddable page (`?embed=1`) | ✅ |
| Join with a session code | `/join` + 8-character code on screen, console and listener page | ✅ |
| Choose language, switch live | Language buttons, live switch, remembered choice | ✅ |
| Audio + captions on the phone | PCM audio with jitter buffer, captions, volume, pause, lock-screen controls | ✅ |
| Caption size, dark/light | 3 sizes, high contrast | ✅ |
| "Complete phrases only" | "Complete sentences only" | ✅ |
| Download the transcript as an attendee | "Save text" of the captions received | 🟡 (no timing for listeners) |
| No app, no account | Same | ✅ |
| Help panel | Built-in help | ✅ |
| 50+ output languages | **13 output languages** (limit of `gpt-realtime-translate`); source language auto-detected | 🟡 **main remaining gap** |
| — | Headphone test, wake lock, human-interpreter label, published AI summary | ➕ |

## Presenters / operators

| Wordly | TranslateBox | Status |
|---|---|---|
| Present from a browser, choose microphone | Same + output device, ambient (far-field) mode, input test | ✅ |
| Speaker names | Speaker bar, names in captions, room screen and transcripts | ✅ |
| Pause / mute / push-to-talk | Mute, push-to-talk with configurable key, cough button for booths | ✅ |
| Glossary (terms, sounds-like, per language) | ~3000 terms, `[fr]` sections, `<sounds, like>`, `!!` preferred terms, hide words | ✅ |
| Choice of voice | 13 studio voices + style (sermon, interpreter…), original realtime voice | ✅ |
| Room display of captions | Room screen, multilingual screen (up to 4), OBS/vMix overlay | ✅ |
| Auto-stop | After N minutes and on silence | ✅ |
| — | Human interpreter booths mixed with AI languages | ➕ |
| — | Dubbed WAV voice track, AI summary published to listeners | ➕ |

## Administration

| Wordly | TranslateBox | Status |
|---|---|---|
| Schedule sessions (date, duration) | Portal → New session | ✅ |
| Labels, search | Labels, search by name/code/label | ✅ |
| Duplicate / delete sessions | Duplicate, delete, pin (never expires) | ✅ |
| Bulk upload (CSV) | CSV import + template | ✅ |
| Passcode | Listener PIN | ✅ |
| Stored transcripts, download later | Opt-in archive, TXT / timed TXT / SRT / VTT | ✅ |
| Translate a stored transcript | Translation keeping timing | ✅ |
| Timestamp offset | Offset in seconds on exports | ✅ |
| Usage / activity reports | Minutes per language and session, peak listeners, CSV | ✅ |
| User accounts, roles, transferable minutes | Owner / admin / presenter, minute balances and transfers, per-presenter sessions | ✅ |
| 2FA | Authenticator-app codes (TOTP) or SSO | ✅ |
| Developer API | HTTP API + API keys, [docs/API.md](API.md) | ✅ |

## Integrations

| Wordly | TranslateBox | Status |
|---|---|---|
| Zoom captions | Zoom API-token captions | ✅ |
| Microsoft Teams captions | Teams CART link | ✅ |
| OBS / vMix / streaming overlays | Transparent overlay page | ✅ |
| Event platforms (Cvent, Hopin…) via embed | Embeddable listener page, `EMBED_ORIGINS` | ✅ |
| Generic webhook / API | Caption webhook (public HTTPS only) | ✅ |
| Zoom / Teams / Meet **audio bot** (joins the meeting) | RTMP from Zoom, Teams, Webex instead (no bot); Meet not covered | 🟡 |
| RTMP/RTMPS ingest | RTMP, SRT, RTMPS (with certificate) through MediaMTX | ✅ |
| Native iOS / Android apps | Capacitor apps (Android APK from CI; iOS needs Mac + Apple account) + PWA | 🟡 |

## Remaining gaps and what they take

1. **More output languages** — depends on OpenAI's realtime translation model. Option: a second pipeline (speech-to-text → text translation → TTS) for languages the realtime model lacks, with ~2–4 s more delay.
2. **Meeting bots** — Zoom Meeting SDK / Teams bot framework / Google Meet Media API; needs app registration with each vendor.
3. **Multi-tenant organizations and billing** — several client organizations on one server, payments.
4. **Store publication** — signed Android release and iOS build on a Mac with an Apple Developer account.
