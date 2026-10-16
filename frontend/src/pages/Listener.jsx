import { HeadphoneTest } from '../components/HeadphoneTest';
import { HomeLink } from '../components/HomeLink';
import { InterfaceLanguage } from '../components/InterfaceLanguage';
import { useLocale } from '../context/LocaleContext';
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Markdownish } from "../components/Markdownish";
import { Play, Pause, Volume2, Wifi, WifiOff, Headphones, Sparkles, Square, UserRound, FileText, HelpCircle, Download, Contrast } from "lucide-react";
import { WS_BASE } from "../lib/broadcast";
import { createAudioContext, PcmPlayer, WIRE_RATE } from "../lib/pcmAudio";
import { API } from "../lib/api";
import { getTarget } from "../lib/languages";
import { completeOnly } from "../lib/captions";

const RETRY_DELAYS = [1000, 2000, 4000, 8000];
const readPref = (key, fallback) => { try { const v = localStorage.getItem(key); return v === null ? fallback : v === "1"; } catch { return fallback; } };
const writePref = (key, on) => { try { localStorage.setItem(key, on ? "1" : "0"); } catch { /* optional */ } };

const CLOSE_MESSAGES = {
  4401: "Incorrect PIN.",
  4403: "This site is not allowed by the server.",
  4429: "Event capacity or connection limit reached. Try again shortly.",
  4404: "Event not found.",
};

export default function Listener() {
  const { t } = useLocale();
  const { id } = useParams();
  const [search] = useSearchParams();
  const embed = search.get("embed") === "1";
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [pin, setPin] = useState("");
  const [needPin, setNeedPin] = useState(false);
  const [listening, setListening] = useState(false);
  const [live, setLive] = useState(false);
  const [conn, setConn] = useState("idle");
  const [caption, setCaption] = useState("");
  const [meta, setMeta] = useState({ mode: "original", voice: null });
  const [captionSize, setCaptionSize] = useState(() => {
    try { const size = Number(localStorage.getItem('tbl-caption-size')); return [18, 24, 32].includes(size) ? size : 24; } catch { return 24; }
  });
  const [playback, setPlayback] = useState("idle");
  const [volume, setVolume] = useState(1);
  const [paused, setPaused] = useState(false);
  const [level, setLevel] = useState(0);
  const [contrast, setContrast] = useState(() => readPref("tbl-contrast", false));
  const [complete, setComplete] = useState(() => readPref("tbl-complete", false));
  const [wasLive, setWasLive] = useState(false);
  useEffect(() => { if (live) setWasLive(true); }, [live]);

  const wsRef = useRef(null);
  const ctxRef = useRef(null);
  const playerRef = useRef(null);
  const retryRef = useRef(null);
  const attemptRef = useRef(0);
  const wantedRef = useRef(false);
  const pausedRef = useRef(false);
  const wakeRef = useRef(null);
  const captionRef = useRef(null);
  const [lang, setLang] = useState(null);
  const langRef = useRef(null);

  const closeSocket = useCallback(() => {
    clearTimeout(retryRef.current);
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const releaseAudio = useCallback(() => {
    playerRef.current?.dispose();
    playerRef.current = null;
    ctxRef.current?.close?.().catch(() => {});
    ctxRef.current = null;
    wakeRef.current?.release?.().catch(() => {});
    wakeRef.current = null;
  }, []);

  const stop = useCallback(() => {
    wantedRef.current = false;
    closeSocket();
    releaseAudio();
    setListening(false); setConn("idle"); setPlayback("idle"); setLevel(0);
  }, [closeSocket, releaseAudio]);

  useEffect(() => {
    const controller = new AbortController();
    setInfo(null); setErr("");
    fetch(`${API}/events/${id}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : Promise.reject(new Error("Event not found.")))
      .then(d => {
        setInfo(d); setNeedPin(d.pin_protected); setLive(d.live);
        const targets = d.targets || [d.target];
        let saved = null;
        try { saved = localStorage.getItem('tbl-listen-lang'); } catch { /* optional */ }
        const browser = (navigator.language || "").slice(0, 2).toLowerCase();
        const pick = [saved, browser].find((c) => c && targets.includes(c)) || targets[0];
        langRef.current = pick; setLang(pick);
      })
      .catch(e => { if (e.name !== "AbortError") setErr(e.message); });
    return () => { controller.abort(); wantedRef.current = false; closeSocket(); releaseAudio(); };
  }, [id, closeSocket, releaseAudio]);

  // Keep the screen awake while listening; phones otherwise lock and the
  // browser may suspend audio. Re-acquire when the page becomes visible.
  const keepAwake = useCallback(async () => {
    try { if (navigator.wakeLock && !wakeRef.current) { wakeRef.current = await navigator.wakeLock.request("screen"); wakeRef.current.addEventListener?.("release", () => { wakeRef.current = null; }); } }
    catch { /* Not granted: playback still works while the page stays open. */ }
  }, []);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !wantedRef.current) return;
      ctxRef.current?.resume?.().catch(() => {});
      keepAwake();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [keepAwake]);

  const connect = useCallback(function openStream() {
    closeSocket();
    if (!wantedRef.current) return;
    setConn("connecting");
    if (!pausedRef.current) setPlayback("buffering");
    const chosen = langRef.current ? `&lang=${encodeURIComponent(langRef.current)}` : "";
    const ws = new WebSocket(`${WS_BASE}/api/ws/${id}?role=listener${chosen}`);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;
    ws.onopen = () => { ws.send(JSON.stringify({ type: "auth", pin: pin || null })); };
    ws.onmessage = ({ data }) => {
      if (wsRef.current !== ws) return;
      if (typeof data === "string") {
        let m;
        try { m = JSON.parse(data); } catch { return; }
        if (m.type === "status") {
          attemptRef.current = 0;
          setConn("connected"); setLive(!!m.live); setErr("");
          if (m.meta) setMeta(m.meta);
          if (m.live && m.format && m.format !== "pcm16") {
            setErr("This event uses an older broadcast format. Ask the organizer to update TranslateBox.");
          }
          if (!m.live) playerRef.current?.clear();
        }
        if (m.type === "meta") setMeta({ mode: m.mode, voice: m.voice });
        if (m.type === "caption") setCaption(m.text || "");
        return;
      }
      playerRef.current?.push(data);
    };
    ws.onclose = ({ code }) => {
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      playerRef.current?.clear();
      setConn("disconnected"); setLive(false);
      if (CLOSE_MESSAGES[code]) {
        setErr(CLOSE_MESSAGES[code]); if (code === 4401) setNeedPin(true);
        wantedRef.current = false; setListening(false); releaseAudio(); setPlayback("idle");
        return;
      }
      if (wantedRef.current) {
        const delay = RETRY_DELAYS[Math.min(attemptRef.current, RETRY_DELAYS.length - 1)];
        attemptRef.current += 1;
        retryRef.current = setTimeout(openStream, delay);
      }
    };
    ws.onerror = () => setConn("disconnected");
  }, [id, pin, closeSocket, releaseAudio]);

  const listen = async () => {
    setErr(""); setCaption(""); pausedRef.current = false; setPaused(false);
    let ctx;
    try {
      // Created inside the tap so iOS and Chrome allow sound.
      ctx = createAudioContext();
      // iOS: play even when the ring/silent switch is on.
      try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch { /* Optional API */ }
      ctx.resume?.().catch(() => {});
      ctxRef.current = ctx;
      wantedRef.current = true; setListening(true);
      const player = new PcmPlayer(ctx, {
        inRate: WIRE_RATE, targetMs: 350, maxMs: 2500,
        onStats: (s) => {
          if (!wantedRef.current || pausedRef.current) return;
          setPlayback(s.playing ? "playing" : "buffering");
          setLevel(Math.round((s.level || 0) * 50) / 50);
        },
      });
      playerRef.current = player;
      await player.init();
      player.setVolume(volume);
    } catch (e) {
      wantedRef.current = false; setListening(false); releaseAudio();
      setErr(e?.message || "Unable to initialize audio playback.");
      return;
    }
    keepAwake();
    if ("mediaSession" in navigator && globalThis.MediaMetadata) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: info?.name || "Live Interpretation", artist: info?.organization || "TranslateBox", album: getTarget(info?.target || "en").native });
        navigator.mediaSession.setActionHandler("pause", () => togglePlay(true));
        navigator.mediaSession.setActionHandler("play", () => togglePlay(false));
      } catch { /* Optional API */ }
    }
    connect();
  };

  const chooseLang = (code) => {
    if (code === langRef.current) return;
    langRef.current = code; setLang(code);
    try { localStorage.setItem('tbl-listen-lang', code); } catch { /* optional */ }
    setCaption("");
    if (wantedRef.current) { playerRef.current?.clear(); attemptRef.current = 0; connect(); }
  };

  const togglePlay = (force) => {
    const next = typeof force === "boolean" ? force : !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    playerRef.current?.setPaused(next);
    ctxRef.current?.resume?.().catch(() => {});
    setPlayback(next ? "paused" : "buffering");
  };

  useEffect(() => {
    const el = captionRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [caption]);

  if (err && !info) {
    return <Shell embed={embed}><p className="text-rose-400 font-mono">{t(err)}</p></Shell>;
  }

  const target = getTarget(lang || info?.target || "en");
  const targets = info?.targets || (info?.target ? [info.target] : []);
  const picker = targets.length > 1 && (
    <div role="radiogroup" aria-label={t("Choose your language")} className="flex flex-wrap justify-center gap-2" data-testid="listener-languages">
      {targets.map((code) => {
        const l = getTarget(code); const on = code === lang;
        return <button key={code} role="radio" aria-checked={on} data-testid={`listener-lang-${code}`} onClick={() => chooseLang(code)}
          className={`inline-flex items-center gap-2 rounded-full border px-4 h-11 text-sm font-semibold transition-colors ${on ? "border-emerald-400 bg-emerald-500/15 text-emerald-200" : "border-white/15 text-slate-300 hover:border-white/30"}`}>
          <span className="text-lg leading-none">{l.flag}</span>{l.native}</button>;
      })}
    </div>
  );
  const statusText = t(!listening ? (live ? "Ready to listen" : "Waiting for speaker…")
    : conn === "disconnected" ? "Reconnecting…"
    : paused ? "Audio paused"
    : conn === "connecting" ? "Connecting…"
    : !live ? "Waiting for speaker…"
    : playback === "playing" ? "Translation playing" : "Buffering audio…");
  const glow = Math.min(1, level * 6);

  return (
    <Shell embed={embed}>
      <div className={`w-full max-w-md ${embed ? "pt-6" : "pt-16"} pb-10`}>
        <header className="text-center">
          {info?.logo && <img src={info.logo} alt={info.organization || ""} data-testid="listener-logo" className="mx-auto mb-4 max-h-16 max-w-[200px] object-contain" />}
          <p className="text-[11px] font-mono uppercase tracking-[0.35em] text-emerald-400/90">TranslateBox · {t("Live")}</p>
          <h1 className="mt-4 text-[28px] leading-tight font-extrabold text-slate-50 text-balance">{info?.name || t("Live Interpretation")}</h1>
          {info?.organization && <p className="text-slate-400 mt-1">{info.organization}</p>}
          {info?.start_at && !info.live && new Date(info.start_at) > new Date() && <p className="text-sm text-emerald-300 mt-2" data-testid="listener-start">{t("Starts")} {new Date(info.start_at).toLocaleString()}</p>}
          {info?.sponsor && <p className="text-xs text-slate-500 mt-2" data-testid="listener-sponsor">{info.sponsor}</p>}
          {targets.length > 1 ? (
            <div className="mt-5 space-y-2">
              <p className="text-xs uppercase tracking-widest text-slate-400">{t("Choose your language")}</p>
              {picker}
            </div>
          ) : (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5">
              <span className="text-xl leading-none">{target.flag}</span>
              <span className="text-sm font-semibold tracking-wide text-slate-200">{target.native}</span>
            </div>
          )}
        </header>

        <div className="mt-8 flex items-center justify-center gap-2" data-testid="listener-status" role="status" aria-live="polite">
          <span className={`h-2.5 w-2.5 rounded-full ${live ? "bg-emerald-400 shadow-[0_0_10px_2px_rgba(16,185,129,0.6)]" : "bg-slate-600"}`} />
          <span className="text-xs font-mono uppercase tracking-widest text-slate-300">{statusText}</span>
        </div>

        {!listening ? (
          <div className="mt-8 space-y-5">
            {needPin && (
              <input data-testid="listener-pin-input" value={pin} onChange={(e) => setPin(e.target.value)} placeholder={t("Enter event PIN")} inputMode="numeric" autoComplete="off"
                className="w-full h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-center text-slate-100 text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            )}
            <button data-testid="listener-listen-button" onClick={listen}
              className="w-full h-16 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-[#05140E] text-xl font-extrabold tracking-wide shadow-[0_10px_40px_-10px_rgba(16,185,129,0.7)] active:scale-[0.98] transition flex items-center justify-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300">
              <Headphones className="h-6 w-6" />{t("LISTEN")}</button>
            <p className="text-sm text-slate-400 text-center">{t("Tap LISTEN to connect and enable sound. Works on iPhone, Android and computers.")}</p>
            <HeadphoneTest />
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <div className="flex flex-col items-center">
              <div className="relative h-36 w-36 flex items-center justify-center">
                <span aria-hidden className="absolute inset-0 rounded-full bg-emerald-500/20 transition-transform duration-150 motion-reduce:transition-none"
                  style={{ transform: `scale(${playback === "playing" ? 0.82 + glow * 0.22 : 0.8})`, opacity: playback === "playing" ? 0.5 + glow * 0.5 : 0.25 }} />
                <span aria-hidden className="absolute inset-3 rounded-full border border-emerald-400/30" />
                <button aria-label={paused ? t("Play audio") : t("Pause audio")} data-testid="listener-playpause" onClick={() => togglePlay()}
                  className="relative h-24 w-24 rounded-full bg-emerald-500 hover:bg-emerald-400 text-[#05140E] flex items-center justify-center shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300">
                  {!paused ? <Pause className="h-9 w-9" /> : <Play className="h-9 w-9 fill-current ml-1" />}
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-slate-400" data-testid="listener-conn">
                {conn === "connected" ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-amber-400" />}
                {t({ connected: "Connected", disconnected: "Reconnecting…", connecting: "Connecting…", idle: "Stopped" }[conn])}
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <Volume2 className="h-5 w-5 text-slate-400 shrink-0" />
              <input aria-label="Volume" type="range" min="0" max="1" step="0.05" value={volume}
                onChange={(e) => { const v = +e.target.value; setVolume(v); playerRef.current?.setVolume(v); }}
                className="flex-1 accent-emerald-500" data-testid="listener-volume" />
              <button data-testid="listener-stop" onClick={stop} className="inline-flex items-center gap-1.5 px-3 h-10 rounded-lg border border-white/15 text-slate-200 text-sm hover:bg-white/5">
                <Square className="h-3.5 w-3.5" />{t("Stop")}</button>
            </div>

            {!live && conn === "connected" && (
              <p className="text-amber-300 text-sm text-center" data-testid="listener-paused">{wasLive ? t("The speaker has paused or the session has ended. Keep this page open: audio resumes automatically.") : t("Translation temporarily unavailable — resuming automatically…")}</p>
            )}

            <section aria-label={t("Captions")} className="space-y-2">
              <label className="flex items-center justify-between gap-3 text-sm text-slate-300">
                {t("Caption size")}
                <select aria-label={t("Caption size")} className="rounded-lg bg-slate-800 px-3 py-2 text-slate-100" value={captionSize} onChange={e => {
                  const size = Number(e.target.value); setCaptionSize(size);
                  try { localStorage.setItem('tbl-caption-size', String(size)); } catch { /* Optional preference storage. */ }
                }}>
                  <option value={18}>{t("Standard")}</option><option value={24}>{t("Large")}</option><option value={32}>{t("Extra large")}</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" aria-pressed={contrast} data-testid="listener-contrast" onClick={() => { setContrast(!contrast); writePref("tbl-contrast", !contrast); }}
                  className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs ${contrast ? "border-yellow-300 text-yellow-200" : "border-white/15 text-slate-300"}`}><Contrast className="h-3.5 w-3.5" />{t("High contrast")}</button>
                <button type="button" aria-pressed={complete} data-testid="listener-complete" onClick={() => { setComplete(!complete); writePref("tbl-complete", !complete); }}
                  className={`h-9 px-3 rounded-lg border text-xs ${complete ? "border-emerald-400 text-emerald-200" : "border-white/15 text-slate-300"}`}>{t("Complete sentences only")}</button>
                {caption && <button type="button" onClick={() => downloadCaptions(caption, info?.name, lang)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-white/15 text-xs text-slate-300"><Download className="h-3.5 w-3.5" />{t("Save text")}</button>}
              </div>
              {caption ? (
                <div ref={captionRef} style={{ fontSize: `${captionSize}px` }} data-testid="listener-caption"
                  className={`rounded-2xl p-4 text-left leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap ${contrast ? "bg-black border-2 border-yellow-300 text-yellow-100 font-semibold" : "bg-white/[0.04] border border-white/10 text-slate-100"}`}>
                  {complete ? (completeOnly(caption) || "…") : caption}
                </div>
              ) : <p className="text-sm text-slate-400">{t("Captions appear here when the organizer enables them.")}</p>}
            </section>
          </div>
        )}

        {err && <p className="mt-5 text-rose-400 text-sm text-center" data-testid="listener-error">{t(err)}</p>}

        {(() => {
          const summaries = info?.summaries || {};
          const text = summaries[lang] || summaries[info?.target] || Object.values(summaries)[0];
          return text ? (
            <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left" data-testid="listener-summary">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-300 mb-3"><FileText className="h-4 w-4" />{t("Event summary")}</h2>
              <Markdownish text={text} className="text-slate-200" />
              <p className="mt-3 text-[11px] text-slate-500">{t("Summary generated by AI and published by the organizer.")}</p>
            </section>
          ) : null;
        })()}

        <div className="mt-8 space-y-2 text-center">
          {meta?.mode === "human" ? (
            <p data-testid="listener-ai-voice" className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <UserRound className="h-3.5 w-3.5 text-sky-400" />{t("Human interpreter")}
            </p>
          ) : (
            <p data-testid="listener-ai-voice" className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              {meta?.mode === "studio" && meta.voice ? `${t("AI-generated voice")} · ${meta.voice}` : t("AI-generated voice")}
            </p>
          )}
          <p className="text-xs text-slate-500">{t("On iPhone, turn up the media volume. Keep this page open during the event.")}</p>
          <p className="text-[11px] text-slate-600 font-mono">{t("No account needed · audio is not recorded")}</p>
          {info?.archive && <p className="text-[11px] text-slate-500" data-testid="listener-archive-notice">{t("The organizer keeps a text transcript of this session.")}</p>}
          {info?.code && <p className="text-[11px] text-slate-500 font-mono">{t("Session code")} {info.code}</p>}
          <details className="mx-auto max-w-sm text-left rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400" data-testid="listener-help">
            <summary className="cursor-pointer flex items-center gap-1.5 text-slate-300"><HelpCircle className="h-3.5 w-3.5" />{t("Help")}</summary>
            <ul className="mt-2 space-y-1.5 list-disc pl-4">
              <li>{t("No sound: turn up the media volume, unmute the phone and tap LISTEN again.")}</li>
              <li>{t("Bluetooth headphones add a delay; wired headphones are faster.")}</li>
              <li>{t("Change language at any time with the buttons at the top.")}</li>
              <li>{t("Keep this page open; locking the phone may stop the sound on some devices.")}</li>
              <li>{t("Captions: use Caption size, High contrast or Complete sentences only.")}</li>
            </ul>
          </details>
        </div>
      </div>
    </Shell>
  );
}

const Shell = ({ children, embed }) => (
  <div className="tb-listener relative min-h-screen bg-[#0A0D14] text-slate-100 font-sans flex justify-center px-5"
    style={{ backgroundImage: "radial-gradient(900px 480px at 50% -12%, rgba(16,185,129,0.14), transparent 62%)", paddingLeft: "max(20px, env(safe-area-inset-left))", paddingRight: "max(20px, env(safe-area-inset-right))" }}>
    {!embed && <div className="absolute top-4 inset-x-4 flex items-center justify-between gap-3"><HomeLink /><InterfaceLanguage /></div>}
    {children}
  </div>
);

function downloadCaptions(text, name, lang) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${String(name || "captions").replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}-${lang || ""}.txt`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
