import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { Maximize2 } from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { WS_BASE } from "../lib/broadcast";
import { API } from "../lib/api";
import { getTarget } from "../lib/languages";

const RETRY_DELAYS = [1000, 2000, 4000, 8000];

// One caption-only listener connection per language.
function useCaptionStream(id, lang, pin, wanted, onFatal) {
  const [state, setState] = useState({ caption: "", live: false, connected: false, wasLive: false });
  const wsRef = useRef(null);
  const retryRef = useRef(null);
  const attemptRef = useRef(0);
  const fatalRef = useRef(onFatal);
  fatalRef.current = onFatal;
  useEffect(() => {
    if (!wanted || !lang) return undefined;
    let stopped = false;
    const connect = () => {
      const ws = new WebSocket(`${WS_BASE}/api/ws/${id}?role=listener&audio=0&lang=${encodeURIComponent(lang)}`);
      wsRef.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: "auth", pin: pin || null }));
      ws.onmessage = ({ data }) => {
        if (typeof data !== "string") return;
        let m; try { m = JSON.parse(data); } catch { return; }
        if (m.type === "status") { attemptRef.current = 0; setState((x) => ({ ...x, connected: true, live: !!m.live, wasLive: x.wasLive || !!m.live })); }
        if (m.type === "caption") setState((x) => ({ ...x, caption: m.text || "" }));
      };
      ws.onclose = ({ code }) => {
        if (stopped || wsRef.current !== ws) return;
        wsRef.current = null;
        setState((x) => ({ ...x, connected: false, live: false }));
        if (code === 4401) { fatalRef.current?.("Incorrect PIN."); return; }
        if (code === 4404) { fatalRef.current?.("Event not found."); return; }
        if (code === 4403) { fatalRef.current?.("This site is not allowed by the server."); return; }
        const delay = RETRY_DELAYS[Math.min(attemptRef.current++, RETRY_DELAYS.length - 1)];
        retryRef.current = setTimeout(connect, delay);
      };
    };
    setState({ caption: "", live: false, connected: false, wasLive: false });
    connect();
    return () => {
      stopped = true;
      clearTimeout(retryRef.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
    };
  }, [id, lang, pin, wanted]);
  return state;
}

const lastParagraphs = (caption, n) => caption.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).slice(-n);

function LangPanel({ id, lang, pin, wanted, onFatal, light, count }) {
  const { t } = useLocale();
  const s = useCaptionStream(id, lang, pin, wanted, onFatal);
  const paras = lastParagraphs(s.caption, 2);
  const l = getTarget(lang);
  return (
    <section className={`min-h-0 flex flex-col rounded-2xl p-5 ${light ? "bg-slate-100" : "bg-white/[0.04] border border-white/10"}`} data-testid={`screen-panel-${lang}`}>
      <p className="text-lg font-bold flex items-center gap-2"><span className="text-2xl">{l.flag}</span>{l.native}
        <span className={`ml-auto h-2.5 w-2.5 rounded-full ${s.live ? "bg-emerald-400" : "bg-slate-500"}`} /></p>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-end" aria-live="polite">
        {paras.length ? paras.map((p, i) => (
          <p key={`${i}-${p.slice(0, 10)}`} className={`font-semibold leading-snug ${i === paras.length - 1 ? "" : "opacity-50"}`}
            style={{ fontSize: count > 2 ? "clamp(20px, 2.2vw, 40px)" : "clamp(24px, 3vw, 52px)", marginTop: "0.3em" }}>{p.slice(-300)}</p>
        )) : <p className="text-slate-500">{s.wasLive && !s.live ? t("Paused") : s.connected ? t("Waiting for speaker…") : t("Connecting…")}</p>}
      </div>
    </section>
  );
}

// Room display for a projector or TV: large live captions and a QR code to
// join. Connects as a caption-only listener (no audio is sent to it).
export default function Screen() {
  const { t } = useLocale();
  const { id } = useParams();
  const [search] = useSearchParams();
  const overlay = search.get("overlay") === "1";
  const light = search.get("theme") === "light";
  const wantedLang = search.get("lang");
  const multi = (search.get("langs") || "").toLowerCase().split(/[,\s]+/).filter(Boolean);
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [lang, setLang] = useState(null);
  const [pin, setPin] = useState("");
  const [qr, setQr] = useState("");
  const [wanted, setWanted] = useState(false);
  const scrollRef = useRef(null);
  const listenUrl = `${window.location.origin}/e/${id}`;
  const fatal = useCallback((msg) => { setErr(msg); setWanted(false); }, []);

  useEffect(() => {
    fetch(`${API}/events/${id}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error("Event not found."))))
      .then((d) => {
        const targets = d.targets || [d.target];
        setInfo(d); setLang(targets.includes(wantedLang) ? wantedLang : targets[0]);
        if (!d.pin_protected) setWanted(true);
      })
      .catch((e) => setErr(e.message));
    QRCode.toDataURL(listenUrl, { width: 480, margin: 2 }).then(setQr).catch(() => {});
  }, [id, listenUrl, wantedLang]);

  // OBS / vMix browser sources need a transparent page.
  useEffect(() => {
    if (!overlay) return undefined;
    const els = [document.documentElement, document.body];
    const before = els.map((el) => el.style.background);
    els.forEach((el) => { el.style.background = "transparent"; });
    return () => els.forEach((el, i) => { el.style.background = before[i]; });
  }, [overlay]);

  const targetsAll = info?.targets || (info?.target ? [info.target] : []);
  const panels = multi.filter((l) => targetsAll.includes(l)).slice(0, 4);
  const { caption, live, connected, wasLive } = useCaptionStream(id, panels.length > 1 ? null : lang, pin, wanted, fatal);

  useEffect(() => {
    let lock = null;
    const acquire = async () => { try { lock = await navigator.wakeLock?.request("screen"); } catch { /* optional */ } };
    acquire();
    const onVisible = () => { if (document.visibilityState === "visible") acquire(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); lock?.release?.().catch(() => {}); };
  }, []);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [caption]);

  const paragraphs = lastParagraphs(caption, 3);
  const targets = info?.targets || (info?.target ? [info.target] : []);

  if (overlay) {
    const last = paragraphs.slice(-2);
    return (
      <div className="fixed inset-x-0 bottom-0 flex justify-center pb-[6vh] px-[6vw]" data-testid="screen-overlay" aria-live="polite">
        {last.length > 0 && (
          <div className="max-w-[1500px] rounded-2xl bg-black/70 px-8 py-5 text-center">
            {last.map((p, i) => (
              <p key={`${i}-${p.slice(0, 10)}`} className={`font-semibold leading-snug ${i === last.length - 1 ? "text-white" : "text-white/60"}`}
                style={{ fontSize: "clamp(28px, 3.2vw, 56px)", textShadow: "0 2px 6px rgba(0,0,0,.8)" }}>{p.slice(-220)}</p>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (err && !info) return <div className="min-h-screen bg-black text-rose-300 grid place-items-center text-2xl">{t(err)}</div>;

  return (
    <div className={`tb-screen h-screen flex flex-col overflow-hidden ${light ? "bg-white text-slate-900" : "bg-[#05070B] text-white"}`}
      style={{ paddingLeft: "max(32px, env(safe-area-inset-left))", paddingRight: "max(32px, env(safe-area-inset-right))" }}>
      <header className="flex items-start justify-between gap-8 pt-8">
        <div className="min-w-0">
          <p className="text-sm font-mono uppercase tracking-[0.35em] text-emerald-400 flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${live ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
            {live ? t("Live") : wasLive ? t("Paused · the session will resume shortly") : t("Waiting for speaker…")}
          </p>
          <div className="mt-3 flex items-center gap-5">
            {info?.logo && <img src={info.logo} alt="" className="max-h-20 max-w-[220px] object-contain" />}
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-balance">{info?.name}</h1>
          </div>
          {info?.organization && <p className="mt-1 text-xl text-slate-400">{info.organization}</p>}
          {info?.sponsor && <p className="mt-1 text-base text-slate-500">{info.sponsor}</p>}
          {targets.length > 1 && panels.length < 2 && (
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
              <figcaption className="mt-2 text-sm text-slate-300">{t("Scan to listen")}<br /><span className="text-slate-500">{targets.map((c) => getTarget(c).flag).join(" ")}</span>
                {info?.code && <><br /><span className="text-slate-400">{window.location.host}/join</span><br /><b className="font-mono text-lg tracking-[0.2em] text-white" data-testid="screen-code">{info.code}</b></>}</figcaption>
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
      ) : panels.length > 1 ? (
        <main className={`flex-1 min-h-0 grid gap-4 pb-8 pt-6 ${panels.length > 2 ? "grid-cols-2 grid-rows-2" : "grid-cols-2"}`} data-testid="screen-multi">
          {panels.map((l) => <LangPanel key={l} id={id} lang={l} pin={pin} wanted={wanted} onFatal={fatal} light={light} count={panels.length} />)}
        </main>
      ) : (
        <main ref={scrollRef} className="flex-1 min-h-0 overflow-hidden flex flex-col justify-end pb-12 pt-6" aria-live="polite">
          {paragraphs.length ? paragraphs.map((p, i) => (
            <p key={`${i}-${p.slice(0, 12)}`} className={`font-semibold leading-[1.25] text-pretty ${i === paragraphs.length - 1 ? (light ? "text-slate-900" : "text-white") : (light ? "text-slate-400" : "text-slate-500")}`}
              style={{ fontSize: "clamp(32px, 4.4vw, 72px)", marginTop: "0.4em" }}>{p.slice(-420)}</p>
          )) : (
            <p className="text-3xl text-slate-500">{connected ? t("Captions appear here when the organizer enables them.") : t("Connecting…")}</p>
          )}
        </main>
      )}
    </div>
  );
}
