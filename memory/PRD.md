# TranslateBox Live — PRD

## Original Problem Statement
Production-quality MVP: real-time French speech → English speech interpretation web app running in Chrome/Safari on Android tablets, iPads, Windows, macOS. Press START, speak French, hear English through headphones. Uses OpenAI Realtime Translation API (`gpt-realtime-translate`) over WebRTC. Secure backend mints short-lived session credentials; permanent key never exposed to the browser. Tablet-first professional AV console UI, light/dark, PWA, hidden /debug page. No auth/billing/DB/multi-language/multi-listener in v1.

## User Choices
- OpenAI key configured LATER by user (currently empty).
- Model: `gpt-realtime-translate`.
- Default theme: Dark. Style: professional AV broadcast.
- /debug: free access via URL.

## Architecture
- **Backend (FastAPI)**: `POST /api/realtime-session` reads `OPENAI_API_KEY` and calls `https://api.openai.com/v1/realtime/translations/client_secrets` to mint an ephemeral client secret (with `OpenAI-Safety-Identifier`). Returns only the ephemeral `value`. `GET /api/health` reports key/model status. Key never leaves the server.
- **Frontend (React)**: `translationEngine.js` runs the WebRTC flow — getUserMedia → RTCPeerConnection → add mic track → `oai-events` data channel → POST SDP offer to `https://api.openai.com/v1/realtime/translations/calls` with the ephemeral secret → set remote answer → remote audio track plays translated English. Data-channel events `session.input_transcript.delta` (French) and `session.output_transcript.delta` (English) feed the live panels. Auto-reconnect (up to 3 attempts) on connection drop; a fresh ephemeral secret is minted on each reconnect (handles token expiry).
- **State**: `TranslationContext` (session state, transcripts, logs, raw events, status, timer, devices). `ThemeContext` (dark default, persisted).
- **PWA**: `manifest.json` + `service-worker.js` (app-shell cache; never caches `/api` or OpenAI traffic).

## Model Limitation (important)
`gpt-realtime-translate` is translation-only and does **not** support custom instructions/prompt steering (no glossary, no voice/system-prompt). The requested "professional simultaneous interpreter" instruction cannot be sent to this model; interpreter behavior (translate, don't answer/summarize) is intrinsic to the model. Output language is set via `audio.output.language = "en"`; French input is auto-detected. Input transcription uses `gpt-realtime-whisper` to populate the French panel.

## Implemented (2026-06)
- Secure `/api/realtime-session` + `/api/health` (verified against live OpenAI).
- **Multi-language support**: source auto-detected (70+ input languages, selector default "Auto-detect"); target selectable from the 13 supported output languages (en, es, fr, de, it, pt, ru, zh, ja, ko, hi, id, vi). Backend validates target (case-insensitive) and sets `audio.output.language`; input uses `gpt-realtime-whisper` + `noise_reduction: near_field`. Selected target is sent to the backend on START; transcript labels + badge update dynamically; selectors disabled while active.
- WebRTC translation engine with reconnection + full error mapping.
- Tablet-first AV console, light/dark (dark default), PWA, generated icon, `/debug` diagnostics.
- Testing: iteration_1 (11/11), iteration_2 (live session mint OK), iteration_3 (multi-language 8/8 backend + 100% frontend). All pass.

## Known external blocker

## V1 (2026-06) — Multi-listener broadcast
- ONE OpenAI FR→EN session (operator) → ONE translated stream → MANY listeners via a backend WebSocket hub. Verified: 20/20 backend, single-session guarantee (`openai_sessions:1` with N listeners), fan-out, late-joiner cached init chunk, PIN(4401)/limit(4429, max 30)/unknown(4404) close codes, no `sk-` leak.
- Event creation (secure id, optional PIN hash, captions flag), QR + fullscreen, listener page `/e/:id` (LISTEN/play/pause/volume/status/auto-reconnect/optional captions), operator BroadcastPanel (CREATE/START/STOP EVENT, RESTART BROADCAST, listeners count), `/loadtest` + `/api/stats` (psutil), Docker (Dockerfile.backend + docker-compose.yml). All V0.5 preserved. Checkpoint: /app/.v05_backup.
- NOT measured here (need user's real run): CPU/RAM/bandwidth at 5/10/20/30 real listeners, 60-min stability. Tools provided. iOS Safari lacks MediaSource audio (fallback message shown).
- Live WebRTC session cannot fully establish: OpenAI `/v1/realtime/translations/calls` returns **429 insufficient_quota** — the account tied to `OPENAI_API_KEY` has no credits. The key IS valid (ephemeral secrets mint fine). Fix: add credits + ensure Tier 1+ access to `gpt-realtime-translate`. No code change required.

## V0.5 (2026-06) — Operator upgrade
- Directions FR→EN and EN→FR (segmented toggle; sets audio.output.language en/fr; source auto-detected).
- AUDIO SETUP: device selector, input status, live level meter + peak, TEST INPUT (meter only, no OpenAI, no feedback), experimental Tab/Screen capture (getDisplayMedia).
- Event Profile (name, org, speakers, vocab: names/acronyms/technical/biblical/places, additional) + Modes (General/Sermon/Academic/Business/Custom). Compiled into session instructions and sent to backend, which attaches them with graceful fallback (retry without) → `instructions_applied` flag. Included in exports.
- Operator dashboard: summary bar, 5 status dots (Audio Input/OpenAI/Translation/Output Audio/Network), START/STOP/MUTE INPUT/MUTE TRANSLATION/RESTART, translated-audio ON/MUTED.
- Live transcripts + FULLSCREEN; SessionInfo (duration, translated minutes, reconnect count, connection status, est. avg latency); estimated latency (source→translation event, labelled "Estimated").
- Reconnection (up to 5 attempts, RECONNECTING…/LIVE), device-disconnect notification.
- Privacy: SAVE TRANSCRIPTS default OFF (transcripts cleared on stop unless enabled). EXPORT TXT / PDF on demand.
- Expanded /debug (PC/ICE state, reconnects, latency, output audio, capture source); key never displayed.
- README.md added. Testing iteration_5: 12/12 backend, 100% frontend.

## V0.5 verification status
- LIVE END-TO-END CONFIRMED (2026-06, after credits funded): WebRTC session reaches `connected` in ~1.5-2.1s, `session.created` received, translated audio track received + playback started; EN and FR targets both connect; STOP→START works without reload; mute/latency/reconnect wired. Backend 22/22 pytest, security headers + no `sk-` leak + frontend info-disclosure fix all verified (iteration_8).
- Source is now a selectable combobox (Auto-detect default among 70+); Target selectable among the 13 output languages. Minimalist UI; advanced config (modes, event profile, save, export) in a Settings dialog.
- Remaining human step: on a real device, speak into the mic to confirm spoken transcript + heard audio (harness cannot produce speech, so transcripts are empty in automated tests only).
- Security confirmed: permanent key server-side only; browser uses only `ek_` ephemeral secrets.

## Backlog
- P0: End-to-end live verification once `OPENAI_API_KEY` is added (French→English audio + both transcripts).
- P1: Optional transcript export/save (privacy off by default), input/output level meters, latency readout in debug.
- P2: Sanitize upstream OpenAI error text for production; rate-limit session minting; additional language pairs.


## Code-quality cleanup (2026-06)
Applied code-review fixes without changing behavior:
- Security: replaced `document.write` (PDF export) with a Blob-URL + `print()` approach in SettingsDialog.jsx.
- Logging: added console logging to previously-empty catch blocks (broadcast.js, LoadTest.jsx, TranslationContext); cleanup catches documented with intent comments (translationEngine.js).
- React keys: Debug.jsx log/event lists now use stable `${ts}-${i}` keys.
- Refactor (behavior-preserving):
  - Backend `server.py`: `create_realtime_session` split into `_enforce_session_abuse_controls`/`_resolve_target_language`/`_build_session_config`/`_openai_headers`/`_mint_session`; `ws_broadcast` split into `_run_operator`/`_run_listener`/`_fanout_bytes`/`_fanout_text`.
  - Frontend: new `hooks/usePersistentState.js` (localStorage-backed prefs) and `hooks/useBroadcast.js` (event/broadcast state); `TranslationContext` slimmed and spreads `useBroadcast`; `Console.jsx` split into `components/console/AudioControlCard.jsx` + `TransportControls.jsx`.
- Deliberately NOT changed (with rationale): localStorage kept for preferences (no secrets stored → sessionStorage would only hurt UX); WebRTC/WebSocket init effect deps left eslint-disabled (adding deps risks reconnect loops); no further big-bang rewrites on the working realtime path.
- Verified: backend 31/31 pytest (incl. WS pin gating, listener limit, 4404, operator→listener fan-out); frontend regression iteration_11 = 100% (0 console errors, 0 React key warnings).

## V2 (2026-10) — Voices, universal listening, optimisation
- Listener audio: PCM 16 kHz mono frames (40 ms) captured by an AudioWorklet on the operator's program bus, relayed by the WebSocket hub, played by an AudioWorklet jitter buffer (350 ms target, 2.5 s cap). Replaces WebM/MediaSource so iPhone/iPad Safari can listen. No header cache, so late joiners start immediately.
- Program bus (operator): OpenAI translated voice and studio voice mixed through a light compressor; monitored on the operator's audio element (headphone routing kept) and broadcast. OpenAI reconnects swap the source inside the bus; the broadcast keeps running.
- Studio voices: `/api/tts` streams `gpt-4o-mini-tts` PCM (13 voices, delivery style). Translated text re-voiced sentence by sentence, requests overlap playback, audio stays in order. Live switching.
- Corrections glossary (`wrong => right`) applied to captions and studio voice.
- Listener page: redesigned, AI-voice disclosure with voice name, wake lock, Media Session, iOS audio session `playback`, exponential reconnect backoff.
- Listener bundle split from the operator console (≈93 kB gzip instead of ≈170 kB).
- Caddy: no compression and no buffering on streamed voice audio.
- Not yet verified on real devices: studio-voice latency, iPhone lock-screen behaviour, 30-listener load.

## V2.1 (2026-10) — Parity with hosted AI-interpretation tools
- Multi-language events: up to 5 output languages; one room per (event, language) on the server; one ExtraChannel per extra language on the operator (own OpenAI session, studio voice, captions, transcript). Listener language picker with live switching. Listener cap counts the whole event.
- Room screen `/e/:id/screen`: caption-only connection (`audio=0`, no audio bytes sent), large captions, QR code, caption language switch, wake lock.
- Timed transcripts per language with TXT/SRT/VTT export; `/api/summary` (Responses API, store=false, model `OPENAI_SUMMARY_MODEL`).
- Glossary block rule (`word =>`).
- Not built (out of scope for a self-hosted operator app): Zoom/Teams/Cvent integrations, CEA-608 caption encoder, SSO, workspaces, minute billing, human interpreters, post-event AI dubbing.

## V2.2 (2026-10) — Remaining hosted-platform features, self-hosted
- Push-to-talk (button + Space) gating every microphone channel.
- Caption relay to Zoom (API token, seq/lang) and Teams (CART link) through `/api/caption-relay`, host allowlist, no redirects followed.
- OBS/vMix overlay (`?overlay=1`), light room screen (`?theme=light`), embeddable listener page (`?embed=1`, Caddy `frame-ancestors` from `EMBED_ORIGINS` on `/e/*` only).
- Human interpreter booths: per-event booth code, floor feed on the `src` room (operator only publishes, booth only listens), `role=interpreter` publishes a human language, meta `mode: human`; no OpenAI session and no usage counted for human languages.
- Usage metering per event and month (SQLite kv), `USAGE_CAP_MINUTES` refuses new sessions, client-side automatic stop.
- Shared glossary library, event logo and sponsor line, published summaries, summary language choice, dubbed voice WAV from timed transcripts.
- Optional OIDC single sign-on (PKCE, state single-use, userinfo email allowlist), in-memory sessions.
- Still out of scope: CEA-608 hardware encoders, Zoom/Teams audio bots, billing/payments, per-user roles.
