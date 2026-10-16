import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Headphones, Mic, MicOff, Radio, UserRound, Volume2 } from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { InterfaceLanguage } from "../components/InterfaceLanguage";
import { API } from "../lib/api";
import { WS_BASE, OperatorBroadcaster } from "../lib/broadcast";
import { createAudioContext, PcmPlayer, WIRE_RATE } from "../lib/pcmAudio";
import { getTarget } from "../lib/languages";

const CLOSE = { 4401: "Incorrect booth code.", 4403: "This language is not assigned to a human interpreter.", 4409: "Another interpreter is already on air for this language.", 4404: "Event not found." };

// Remote interpreter booth: hear the speaker (floor audio) and speak the
// interpretation into your own microphone. Your voice replaces the AI for
// your language. Use headphones so the floor audio does not reach your mic.
export default function Booth() {
  const { t } = useLocale();
  const { id } = useParams();
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [code, setCode] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("code") || "");
  const [lang, setLang] = useState("");
  const [joined, setJoined] = useState(false);
  const [floorLive, setFloorLive] = useState(false);
  const [onAir, setOnAir] = useState(false);
  const [muted, setMuted] = useState(false);
  const [listeners, setListeners] = useState(0);
  const [floorVolume, setFloorVolume] = useState(1);
  const [micLevel, setMicLevel] = useState(0);
  const [floorLevel, setFloorLevel] = useState(0);
  const ctxRef = useRef(null);
  const playerRef = useRef(null);
  const floorWsRef = useRef(null);
  const micRef = useRef(null); // {stream, gain, analyser}
  const castRef = useRef(null);
  const retryRef = useRef(null);
  const wantedRef = useRef(false);

  useEffect(() => {
    if (window.location.hash) history.replaceState(null, "", window.location.pathname);
    fetch(`${API}/events/${id}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error("Event not found."))))
      .then((d) => { setInfo(d); setLang((d.human || [])[0] || ""); })
      .catch((e) => setErr(e.message));
  }, [id]);

  const connectFloor = useCallback(function open() {
    if (!wantedRef.current) return;
    const ws = new WebSocket(`${WS_BASE}/api/ws/${id}?role=booth&lang=src`);
    ws.binaryType = "arraybuffer";
    floorWsRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: "auth", code }));
    ws.onmessage = ({ data }) => {
      if (typeof data === "string") {
        try { const m = JSON.parse(data); if (m.type === "status") { setFloorLive(!!m.live); setErr(""); if (!m.live) playerRef.current?.clear(); } } catch { /* ignore */ }
        return;
      }
      playerRef.current?.push(data);
    };
    ws.onclose = ({ code: c }) => {
      if (floorWsRef.current !== ws) return;
      floorWsRef.current = null; setFloorLive(false);
      if (CLOSE[c]) { setErr(CLOSE[c]); wantedRef.current = false; setJoined(false); return; }
      retryRef.current = setTimeout(open, 2000);
    };
  }, [id, code]);

  const leave = useCallback(() => {
    wantedRef.current = false;
    clearTimeout(retryRef.current);
    castRef.current?.stop(); castRef.current = null;
    if (floorWsRef.current) { floorWsRef.current.onclose = null; floorWsRef.current.close(); floorWsRef.current = null; }
    micRef.current?.stream.getTracks().forEach((tr) => tr.stop()); micRef.current = null;
    playerRef.current?.dispose(); playerRef.current = null;
    ctxRef.current?.close?.().catch(() => {}); ctxRef.current = null;
    setJoined(false); setOnAir(false); setFloorLive(false);
  }, []);
  useEffect(() => leave, [leave]);

  const join = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const ctx = createAudioContext();
      ctx.resume?.().catch(() => {});
      ctxRef.current = ctx;
      const player = new PcmPlayer(ctx, { inRate: WIRE_RATE, targetMs: 250, maxMs: 1500, onStats: (s) => setFloorLevel(Math.round((s.level || 0) * 50) / 50) });
      playerRef.current = player;
      await player.init();
      player.setVolume(floorVolume);
      // Clean voice capture: echo cancellation guards against headphone bleed.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      const src = ctx.createMediaStreamSource(stream);
      const gain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(gain); gain.connect(analyser);
      micRef.current = { stream, gain, analyser };
      wantedRef.current = true;
      setJoined(true);
      connectFloor();
    } catch (error) {
      leave();
      setErr(error?.name === "NotAllowedError" ? "Microphone access was denied. Allow it and try again." : (error?.message || "Audio could not start."));
    }
  };

  useEffect(() => {
    if (!joined) return undefined;
    let raf;
    const data = new Uint8Array(512);
    const loop = () => {
      const a = micRef.current?.analyser;
      if (a) {
        a.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        setMicLevel(Math.min(1, Math.sqrt(sum / data.length) * 3));
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [joined]);

  const goOnAir = async () => {
    setErr("");
    const b = new OperatorBroadcaster(`${WS_BASE}/api/ws/${id}?role=interpreter&lang=${encodeURIComponent(lang)}`, {
      auth: { code },
      onCount: (count) => setListeners(count),
      onStatus: (s) => { setOnAir(false); if (s.error) setErr(s.error); },
    });
    castRef.current = b;
    try {
      await b.start({ ctx: ctxRef.current, output: micRef.current.gain });
      b.sendMeta({ mode: "human", voice: null });
      setOnAir(true);
    } catch (error) {
      castRef.current = null;
      const m = String(error.message).match(/\((\d{4})\)/);
      setErr(m && CLOSE[m[1]] ? CLOSE[m[1]] : error.message);
    }
  };
  const goOffAir = () => { castRef.current?.stop(); castRef.current = null; setOnAir(false); setListeners(0); };
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    micRef.current?.gain.gain.setTargetAtTime(next ? 0 : 1, ctxRef.current.currentTime, 0.01);
  };

  const human = info?.human || [];
  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex justify-center px-5 py-10">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-sky-300 flex items-center gap-2"><UserRound className="h-4 w-4" />{t("Interpreter booth")}</p>
          <InterfaceLanguage />
        </div>
        <h1 className="text-2xl font-extrabold">{info?.name || "…"}</h1>
        {err && <p role="alert" className="text-rose-300 text-sm" data-testid="booth-error">{t(err)}</p>}
        {info && human.length === 0 && <p className="text-amber-300">{t("This event has no language assigned to a human interpreter.")}</p>}

        {!joined ? (
          human.length > 0 && (
            <form onSubmit={join} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <label className="block text-sm">{t("Booth code")}
                <input value={code} onChange={(e) => setCode(e.target.value)} required autoComplete="off" data-testid="booth-code-input"
                  className="mt-1 w-full h-12 rounded-xl bg-white/5 border border-white/10 px-4 font-mono tracking-widest" />
              </label>
              <div role="radiogroup" aria-label={t("Your language")} className="flex flex-wrap gap-2">
                {human.map((l) => (
                  <button type="button" key={l} role="radio" aria-checked={l === lang} onClick={() => setLang(l)}
                    className={`rounded-full border px-4 h-10 text-sm ${l === lang ? "border-sky-400 bg-sky-500/15" : "border-white/15 text-slate-300"}`}>{getTarget(l).flag} {getTarget(l).native}</button>
                ))}
              </div>
              <p className="flex items-start gap-2 text-sm text-slate-400"><Headphones className="h-4 w-4 mt-0.5 shrink-0" />{t("Wear headphones: the speaker's voice must not reach your microphone.")}</p>
              <button className="w-full h-14 rounded-2xl bg-sky-500 text-[#04131F] font-extrabold text-lg" data-testid="booth-join">{t("Enter the booth")}</button>
            </form>
          )
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-3">
              <p className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><Volume2 className="h-4 w-4" />{t("Speaker (floor)")}</span>
                <span className={floorLive ? "text-emerald-300" : "text-slate-500"}>{floorLive ? t("Live") : t("Waiting for speaker…")}</span>
              </p>
              <div className="h-2 rounded bg-white/10 overflow-hidden"><div className="h-full bg-emerald-400 transition-[width] duration-100" style={{ width: `${Math.min(100, floorLevel * 600)}%` }} /></div>
              <input aria-label={t("Floor volume")} type="range" min="0" max="1.5" step="0.05" value={floorVolume} onChange={(e) => { const v = +e.target.value; setFloorVolume(v); playerRef.current?.setVolume(v); }} className="w-full accent-emerald-400" />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
              <p className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><Mic className="h-4 w-4" />{t("Your microphone")} · {getTarget(lang).flag} {lang.toUpperCase()}</span>
                {onAir && <span className="font-mono text-xs text-slate-400">{listeners} {t("listeners")}</span>}
              </p>
              <div className="h-2 rounded bg-white/10 overflow-hidden"><div className={`h-full transition-[width] duration-75 ${muted ? "bg-slate-500" : "bg-sky-400"}`} style={{ width: `${Math.round(micLevel * 100)}%` }} /></div>
              <div className="flex gap-3">
                {onAir
                  ? <button onClick={goOffAir} className="flex-1 h-14 rounded-2xl bg-rose-600 font-extrabold inline-flex items-center justify-center gap-2" data-testid="booth-off-air"><Radio className="h-5 w-5" />{t("ON AIR · tap to stop")}</button>
                  : <button onClick={goOnAir} className="flex-1 h-14 rounded-2xl bg-sky-500 text-[#04131F] font-extrabold inline-flex items-center justify-center gap-2" data-testid="booth-on-air"><Radio className="h-5 w-5" />{t("Go on air")}</button>}
                <button onClick={toggleMute} aria-pressed={muted} aria-label={t("Cough button")} className={`h-14 w-14 rounded-2xl border inline-flex items-center justify-center ${muted ? "border-amber-400 bg-amber-500/15 text-amber-300" : "border-white/20"}`}>{muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button>
              </div>
              <p className="text-xs text-slate-500">{t("Listeners of this language hear you while you are on air. Use the mic button to cough or speak to a colleague.")}</p>
            </div>
            <button onClick={leave} className="text-sm text-slate-400 underline">{t("Leave the booth")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
