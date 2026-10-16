import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import QRCode from "qrcode";
import { Maximize2 } from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { WS_BASE } from "../lib/broadcast";
import { API } from "../lib/api";
import { getTarget } from "../lib/languages";

const RETRY_DELAYS = [1000, 2000, 4000, 8000];

// Room display for a projector or TV: large live captions and a QR code to
// join. Connects as a caption-only listener (no audio is sent to it).
export default function Screen() {
  const { t } = useLocale();
  const { id } = useParams();
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [lang, setLang] = useState(null);
  const [pin, setPin] = useState("");
  const [connected, setConnected] = useState(false);
  const [live, setLive] = useState(false);
  const [caption, setCaption] = useState("");
  const [qr, setQr] = useState("");
  const [wanted, setWanted] = useState(false);
  const wsRef = useRef(null);
  const retryRef = useRef(null);
  const attemptRef = useRef(0);
  const scrollRef = useRef(null);
  const listenUrl = `${window.location.origin}/e/${id}`;

  useEffect(() => {
    fetch(`${API}/events/${id}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error("Event not found."))))
      .then((d) => { setInfo(d); setLang((d.targets || [d.target])[0]); setLive(d.live); if (!d.pin_protected) setWanted(true); })
      .catch((e) => setErr(e.message));
    QRCode.toDataURL(listenUrl, { width: 480, margin: 2 }).then(setQr).catch(() => {});
  }, [id, listenUrl]);

  const close = useCallback(() => {
    clearTimeout(retryRef.current);
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
  }, []);

  const open = useCallback(function connect() {
    close();
    const ws = new WebSocket(`${WS_BASE}/api/ws/${id}?role=listener&audio=0&lang=${encodeURIComponent(lang)}`);
    wsRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: "auth", pin: pin || null }));
    ws.onmessage = ({ data }) => {
      if (typeof data !== "string") return;
      let m; try { m = JSON.parse(data); } catch { return; }
      if (m.type === "status") { attemptRef.current = 0; setConnected(true); setLive(!!m.live); setErr(""); }
      if (m.type === "caption") setCaption(m.text || "");
    };
    ws.onclose = ({ code }) => {
      if (wsRef.current !== ws) return;
      wsRef.current = null; setConnected(false); setLive(false);
      if (code === 4401) { setErr("Incorrect PIN."); setWanted(false); return; }
      if (code === 4404) { setErr("Event not found."); setWanted(false); return; }
      const delay = RETRY_DELAYS[Math.min(attemptRef.current++, RETRY_DELAYS.length - 1)];
      retryRef.current = setTimeout(connect, delay);
    };
  }, [id, lang, pin, close]);

  useEffect(() => {
    if (!wanted || !lang) return undefined;
    open();
    return close;
  }, [wanted, lang, open, close]);

  useEffect(() => {
    let lock = null;
    const acquire = async () => { try { lock = await navigator.wakeLock?.request("screen"); } catch { /* optional */ } };
    acquire();
    const onVisible = () => { if (document.visibilityState === "visible") acquire(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); lock?.release?.().catch(() => {}); };
  }, []);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [caption]);

  const paragraphs = caption.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).slice(-3);
  const targets = info?.targets || (info?.target ? [info.target] : []);

  if (err && !info) return <div className="min-h-screen bg-black text-rose-300 grid place-items-center text-2xl">{t(err)}</div>;

  return (
    <div className="tb-screen h-screen bg-[#05070B] text-white flex flex-col overflow-hidden"
      style={{ paddingLeft: "max(32px, env(safe-area-inset-left))", paddingRight: "max(32px, env(safe-area-inset-right))" }}>
      <header className="flex items-start justify-between gap-8 pt-8">
        <div className="min-w-0">
          <p className="text-sm font-mono uppercase tracking-[0.35em] text-emerald-400 flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${live ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
            {live ? t("Live") : t("Waiting for speaker…")}
          </p>
          <h1 className="mt-3 text-4xl lg:text-5xl font-extrabold tracking-tight text-balance">{info?.name}</h1>
          {info?.organization && <p className="mt-1 text-xl text-slate-400">{info.organization}</p>}
          {targets.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label={t("Caption language")}>
              {targets.map((code) => (
                <button key={code} role="radio" aria-checked={code === lang} onClick={() => setLang(code)}
                  className={`rounded-full px-4 py-1.5 text-base border ${code === lang ? "border-emerald-400 bg-emerald-500/15" : "border-white/15 text-slate-400"}`}>
                  {getTarget(code).flag} {getTarget(code).native}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0 flex items-start gap-4">
          {qr && (
            <figure className="text-center">
              <img src={qr} alt={t("Scan to listen")} className="h-40 w-40 lg:h-48 lg:w-48 rounded-xl bg-white p-2" />
              <figcaption className="mt-2 text-sm text-slate-300">{t("Scan to listen")}<br /><span className="text-slate-500">{targets.map((c) => getTarget(c).flag).join(" ")}</span></figcaption>
            </figure>
          )}
          <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} aria-label={t("Fullscreen")} className="h-11 w-11 rounded-lg border border-white/15 grid place-items-center text-slate-300 hover:bg-white/5"><Maximize2 className="h-5 w-5" /></button>
        </div>
      </header>

      {info?.pin_protected && !wanted ? (
        <form className="m-auto flex gap-3" onSubmit={(e) => { e.preventDefault(); setErr(""); setWanted(true); }}>
          <input value={pin} onChange={(e) => setPin(e.target.value)} placeholder={t("Enter event PIN")} className="h-14 rounded-xl bg-white/10 px-5 text-2xl text-center tracking-widest" />
          <button className="h-14 px-6 rounded-xl bg-emerald-500 text-black font-bold text-xl">OK</button>
          {err && <p className="text-rose-300 self-center">{t(err)}</p>}
        </form>
      ) : (
        <main ref={scrollRef} className="flex-1 min-h-0 overflow-hidden flex flex-col justify-end pb-12 pt-6" aria-live="polite">
          {paragraphs.length ? paragraphs.map((p, i) => (
            <p key={`${i}-${p.slice(0, 12)}`} className={`font-semibold leading-[1.25] text-pretty ${i === paragraphs.length - 1 ? "text-white" : "text-slate-500"}`}
              style={{ fontSize: "clamp(32px, 4.4vw, 72px)", marginTop: "0.4em" }}>{p.slice(-420)}</p>
          )) : (
            <p className="text-3xl text-slate-500">{connected ? t("Captions appear here when the organizer enables them.") : t("Connecting…")}</p>
          )}
        </main>
      )}
    </div>
  );
}
