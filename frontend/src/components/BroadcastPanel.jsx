import { useLocale } from '../context/LocaleContext';
import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Link } from "react-router-dom";
import { Users, Play, Square, X, UserRound, ImagePlus, Gauge, Mic, MicOff } from "lucide-react";
import { LanguageCombobox } from "./LanguageCombobox";
import { TARGET_LANGUAGES, SOURCE_LANGUAGES, CASCADE_LANGUAGES, getTarget, isCascade } from "../lib/languages";
import { useTranslationSession } from "../context/TranslationContext";

export const BroadcastPanel = () => {
  const { t } = useLocale();
  const {
    eventInfo, createEvent, startEvent, stopEvent, restartBroadcast,
    savedEvents, catalogError, catalogLoading, refreshEvents, resumeEvent, newEvent,
    listeners, broadcasting, active, captionsToListeners, setCaptionsToListeners, status, level, metrics,
    targetLang, extraLangs, setExtraLangs, channels, primaryListeners,
    humanLangs, setHumanLangs, rotateInterpreterCode, fetchUsage, cascadeLive,
    sourceLang, setSourceLang, setTargetLang, duration, toggleInputMute, inputMuted,
    engineMode, simple, startSimple, stopSimple,
  } = useTranslationSession();
  const serverMode = engineMode === "server";
  // In simple mode the server owns the session: "live" means the mic uplink is running.
  const live = serverMode ? simple.running : broadcasting;
  const engineActive = serverMode ? simple.running : active;
  const [logo, setLogo] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [archive, setArchive] = useState(false);
  const [usage, setUsage] = useState(null);
  useEffect(() => { fetchUsage().then(setUsage).catch(() => setUsage(null)); }, [fetchUsage, broadcasting]);
  const toggleHuman = (code) => setHumanLangs((cur) => (cur || []).includes(code) ? cur.filter((l) => l !== code) : [...(cur || []), code]);
  const boothUrl = eventInfo ? `${window.location.origin}/e/${eventInfo.id}/booth` : "";
  const MAX_EXTRA = 4;
  const chosenExtras = (extraLangs || []).filter((l) => l !== targetLang);
  const toggleExtra = (code) => setExtraLangs((cur) => {
    const list = (cur || []).filter((l) => l !== targetLang);
    return list.includes(code) ? list.filter((l) => l !== code) : list.length >= MAX_EXTRA ? list : [...list, code];
  });
  const screenUrl = eventInfo ? `${window.location.origin}/e/${eventInfo.id}/screen` : "";
  const eventLangs = eventInfo ? (eventInfo.targets || [eventInfo.target]) : [];
  const channelState = (lang, i) => {
    if (serverMode) {
      const st = simple.server?.languages?.[lang];
      const casc = simple.server?.cascade;
      if (st) return { live: st.state === "live", listeners: st.listeners || 0, state: st.state };
      if (casc && isCascade(lang)) return { live: simple.running, listeners: eventInfo?.channels?.find((x) => x.lang === lang)?.listeners || 0, state: "cascade" };
      return { live: false, listeners: eventInfo?.channels?.find((x) => x.lang === lang)?.listeners || 0, state: simple.running ? "starting" : "idle" };
    }
    if (i === 0) return { live: broadcasting, listeners: primaryListeners, state: broadcasting ? "live" : "idle" };
    if (isCascade(lang)) { const c = eventInfo?.channels?.find((x) => x.lang === lang); return { live: broadcasting && cascadeLive, listeners: c?.listeners || 0, state: "cascade" }; }
    if ((eventInfo?.human || []).includes(lang)) return { live: false, listeners: eventInfo.channels?.find((c) => c.lang === lang)?.listeners || 0, state: "human" };
    const ch = channels.find((c) => c.lang === lang);
    return { live: ch?.state === "live", listeners: ch?.listeners || 0, state: ch?.state || "idle" };
  };

  const [name, setName] = useState(t("Live Interpretation"));
  const [org, setOrg] = useState("");
  const [pin, setPin] = useState("");
  const [qr, setQr] = useState("");
  const [fs, setFs] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const listenUrl = eventInfo ? `${window.location.origin}/e/${eventInfo.id}` : "";

  useEffect(() => {
    if (listenUrl) QRCode.toDataURL(listenUrl, { width: 512, margin: 4 }).then(setQr).catch(() => {});
  }, [listenUrl]);

  const doCreate = async () => { setBusy(true); setError(""); try { await createEvent({ name, organization: org, pin, logo, sponsor, archive }); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const doStart = async () => { setBusy(true); setError(""); try { await (serverMode ? startSimple : startEvent)({ name, organization: org, pin, logo, sponsor, archive }); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const doStop = () => (serverMode ? stopSimple() : stopEvent());

  const fmt = (sec) => { const h = Math.floor(sec / 3600); const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0"); const x = String(sec % 60).padStart(2, "0"); return h ? `${h}:${m}:${x}` : `${m}:${x}`; };
  const field = "h-11 w-full rounded-xl bg-slate-50 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-3 text-sm";
  const TONES = {
    emerald: "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    violet: "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    sky: "border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  };
  const chip = (on, tone = "emerald") => `px-3 py-1.5 rounded-full border text-sm transition-colors disabled:opacity-40 ${on ? TONES[tone] : "border-slate-300 dark:border-slate-700 hover:border-slate-400"}`;
  const soft = "text-sm font-semibold text-slate-600 dark:text-slate-300 underline-offset-4 hover:underline disabled:opacity-40";

  return (
    <section className="rounded-3xl bg-white dark:bg-[#121824] border border-slate-200 dark:border-white/10 shadow-sm p-5 md:p-7 space-y-5" data-testid="broadcast-panel">
      {!eventInfo ? (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">{t("New session")}</h2>
            <p className="text-sm text-slate-500 mt-1">{t("Choose the languages, then start. The QR code appears right away.")}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-semibold mb-1.5">{t("Speaker's language")}</p>
              <LanguageCombobox options={SOURCE_LANGUAGES} value={sourceLang} onChange={setSourceLang} disabled={active} testId="source-language-select" />
            </div>
            <div>
              <p className="text-sm font-semibold mb-1.5">{t("Main listener language")}</p>
              <LanguageCombobox options={TARGET_LANGUAGES} value={targetLang} onChange={setTargetLang} disabled={active} testId="target-language-select" />
            </div>
          </div>

          <div className="space-y-2" data-testid="extra-languages">
            <p className="text-sm font-semibold">{t("Other languages")} <span className="font-normal text-slate-500">· {t("up to 4")}</span></p>
            <div className="flex flex-wrap gap-2">
              {TARGET_LANGUAGES.filter((l) => l.code !== targetLang).map((l) => {
                const on = chosenExtras.includes(l.code);
                return <button key={l.code} type="button" aria-pressed={on} data-testid={`extra-lang-${l.code}`} onClick={() => toggleExtra(l.code)} disabled={!on && chosenExtras.length >= MAX_EXTRA} className={chip(on)}>{l.flag} {t(l.name)}</button>;
              })}
            </div>
            <details className="text-sm" data-testid="cascade-languages" open={chosenExtras.some(isCascade)}>
              <summary className="cursor-pointer text-sm text-slate-500">{t("More languages")} (+{CASCADE_LANGUAGES.length})</summary>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CASCADE_LANGUAGES.map((l) => {
                  const on = chosenExtras.includes(l.code);
                  return <button key={l.code} type="button" aria-pressed={on} data-testid={`extra-lang-${l.code}`} onClick={() => toggleExtra(l.code)} disabled={!on && chosenExtras.length >= MAX_EXTRA} className={chip(on, "violet")}>{t(l.name)}</button>;
                })}
              </div>
              <p className="mt-1 text-xs text-slate-500">{t("These languages arrive a few seconds later, read by a studio voice.")}</p>
            </details>
          </div>

          <input aria-label={t("Event name")} maxLength={200} data-testid="event-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Event name")} className={field} />

          {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

          <button data-testid="start-event-button" onClick={doStart} disabled={busy} className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-extrabold flex items-center justify-center gap-2 shadow-[0_10px_30px_-10px_rgba(16,185,129,0.7)] disabled:opacity-50">
            <Play className="h-5 w-5 fill-white" />{busy ? t("Starting…") : t("Start session")}
          </button>

          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <details className="text-sm flex-1 min-w-[240px]">
              <summary className="cursor-pointer font-semibold text-slate-600 dark:text-slate-300">{t("Session options")}</summary>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input aria-label={t("Organization")} maxLength={200} data-testid="event-org-input" value={org} onChange={(e) => setOrg(e.target.value)} placeholder={t("Organization")} className={field} />
                <input aria-label={t("Listener PIN")} type="password" maxLength={64} data-testid="event-pin-input" value={pin} onChange={(e) => setPin(e.target.value)} placeholder={t("PIN (optional)")} className={field} />
                <label className="inline-flex items-center gap-2 h-11 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-sm cursor-pointer" data-testid="branding-fields">
                  {logo ? <img src={logo} alt="" className="h-7 w-7 object-contain" /> : <ImagePlus className="h-4 w-4" />}
                  {logo ? t("Change logo") : t("Add a logo")}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { setLogo(await shrinkLogo(f)); } catch (err) { setError(err.message); } } }} />
                </label>
                <input aria-label={t("Sponsor or thank-you line")} maxLength={160} value={sponsor} onChange={(e) => setSponsor(e.target.value)} placeholder={t("Sponsor or thank-you line (optional)")} className={field} />
                <label className="sm:col-span-2 flex items-start gap-2 cursor-pointer" data-testid="archive-toggle">
                  <input type="checkbox" checked={archive} onChange={(e) => setArchive(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-500" />
                  <span>{t("Keep transcripts on the server")}</span>
                </label>
                {chosenExtras.filter((c) => !isCascade(c)).length > 0 && (
                  <div className="sm:col-span-2 space-y-1.5" data-testid="human-languages">
                    <p className="text-xs text-slate-500">{t("Languages handled by a human interpreter")}</p>
                    <div className="flex flex-wrap gap-2">
                      {chosenExtras.filter((c) => !isCascade(c)).map((code) => {
                        const human = (humanLangs || []).includes(code);
                        return <button key={code} type="button" aria-pressed={human} data-testid={`human-lang-${code}`} onClick={() => toggleHuman(code)} className={chip(human, "sky")}>{getTarget(code).flag} {code.toUpperCase()} · {human ? t("Human interpreter") : t("AI")}</button>;
                      })}
                    </div>
                  </div>
                )}
                <button data-testid="create-event-button" onClick={doCreate} disabled={busy} className="sm:col-span-2 h-10 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold disabled:opacity-50">{t("Create without starting")}</button>
              </div>
            </details>
            {savedEvents.length > 0 && (
              <details className="text-sm flex-1 min-w-[240px]">
                <summary className="cursor-pointer font-semibold text-slate-600 dark:text-slate-300">{t("Resume a saved session")} ({savedEvents.length})</summary>
                {catalogError && <p role="alert" className="text-rose-500 mt-2">{catalogError}</p>}
                <ul className="mt-2 max-h-56 overflow-auto space-y-2">
                  {savedEvents.map((event) => <li key={event.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate">{event.name} · {(event.targets || [event.target]).map((l) => l.toUpperCase()).join(" · ")}</span>
                    <button disabled={busy || active || event.live} onClick={async () => { setBusy(true); setError(""); try { await resumeEvent(event.id); } catch (e) { setError(e.message); } finally { setBusy(false); } }} className="shrink-0 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold disabled:opacity-40">{t("Resume")}</button>
                  </li>)}
                </ul>
                <button onClick={refreshEvents} disabled={catalogLoading || busy} className={`${soft} mt-2`}>{catalogLoading ? t("Loading…") : t("Refresh")}</button>
              </details>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-start">
          {qr && <button onClick={() => setFs(true)} title={t("Show QR code full screen")} className="mx-auto"><img data-testid="event-qr" src={qr} alt="QR" className="h-52 w-52 rounded-2xl bg-white p-2 border border-slate-200" /></button>}
          <div className="min-w-0 space-y-4" id="share">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${live ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>
                <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />{live ? (serverMode && !simple.connected ? t("Reconnecting…") : t("LIVE")) : t("Ready")}
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold" data-testid="listeners-count"><Users className="h-4 w-4 text-sky-500" />{serverMode ? Object.values(simple.server?.languages || {}).reduce((n, l) => n + (l.listeners || 0), 0) : listeners} {t("listeners")}</span>
              {active && !serverMode && <span className="font-mono text-sm text-slate-500" data-testid="session-timer-display">{fmt(duration)}</span>}
              {serverMode && simple.running && <span className={`text-xs font-semibold ${level.peak > 0.02 ? "text-emerald-600" : "text-amber-600"}`}>{level.peak > 0.02 ? t("Microphone signal") + " ✓" : t("No microphone signal")}</span>}
            </div>
            <div>
              <p className="text-xl font-extrabold truncate">{eventInfo.name}</p>
              {eventInfo.code && <p className="text-sm text-slate-500" data-testid="session-code">{t("Session code")}: <b className="font-mono text-lg tracking-[0.2em] text-slate-900 dark:text-slate-100">{eventInfo.code}</b> · {window.location.host}/join</p>}
            </div>
            <ul className="flex flex-wrap gap-2" data-testid="event-channels">
              {eventLangs.map((lang, i) => {
                const c = channelState(lang, i);
                return <li key={lang} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${c.live ? "border-emerald-500 bg-emerald-500/10" : c.state === "error" ? "border-rose-500" : "border-slate-300 dark:border-slate-700"}`}>
                  {c.state === "human" ? <UserRound className="h-3.5 w-3.5 text-sky-500" /> : <span className={`h-2 w-2 rounded-full ${c.live ? "bg-emerald-500" : c.state === "starting" ? "bg-amber-400 animate-pulse" : c.state === "error" ? "bg-rose-500" : "bg-slate-400"}`} />}
                  {getTarget(lang).flag} {lang.toUpperCase()} <span className="font-mono text-xs text-slate-500">{c.listeners}</span>
                </li>;
              })}
            </ul>

            {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

            <div className="flex flex-wrap gap-2">
              {!live ? (
                <button data-testid="start-event-button" onClick={doStart} disabled={busy} className="flex-1 min-w-[200px] h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-extrabold flex items-center justify-center gap-2 disabled:opacity-50"><Play className="h-5 w-5 fill-white" />{busy ? t("Starting…") : t("Start session")}</button>
              ) : (
                <button data-testid="stop-event-button" onClick={doStop} className="flex-1 min-w-[200px] h-14 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-lg font-extrabold flex items-center justify-center gap-2"><Square className="h-5 w-5 fill-white" />{t("Stop")}</button>
              )}
              {engineActive && (
                <button data-testid="mute-input-button" onClick={toggleInputMute} className={`h-14 px-5 rounded-2xl border-2 font-bold flex items-center gap-2 ${inputMuted ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-slate-300 dark:border-slate-700"}`}>
                  {inputMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}{inputMuted ? t("Mic off") : t("Mic on")}
                </button>
              )}
            </div>
            {!live && <p role="status" className="text-sm text-slate-500">{t("Press Start: phones receive audio only while the session is live.")}</p>}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <button className={soft} onClick={async () => { try { await navigator.clipboard.writeText(listenUrl); setCopyStatus("Link copied"); } catch { setCopyStatus("Copy the event link above manually."); } }}>{t("Copy listener link")}</button>
              <a data-testid="room-screen-link" href={screenUrl} target="_blank" rel="noreferrer" className={soft}>{t("Room screen")}</a>
              <button data-testid="qr-fullscreen-button" onClick={() => setFs(true)} className={soft}>{t("Full-screen QR")}</button>
              <button onClick={newEvent} disabled={busy || engineActive || live} className={soft}>{t("New session")}</button>
            </div>
            {copyStatus && <p role="status" className="text-sm text-slate-500">{t(copyStatus)}</p>}
            <a data-testid="event-listen-url" href={listenUrl} target="_blank" rel="noreferrer" className="block text-xs font-mono text-slate-400 truncate">{listenUrl}</a>

            <label className="flex items-center gap-2 cursor-pointer" data-testid="listener-captions-toggle">
              <input type="checkbox" checked={captionsToListeners} onChange={(e) => setCaptionsToListeners(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
              <span className="text-sm">{t("Show captions to listeners")}</span>
            </label>

            {(eventInfo.human || []).length > 0 && (
              <div className="rounded-xl border border-sky-500/40 bg-sky-500/5 p-3 text-sm space-y-1.5" data-testid="booth-info">
                <p className="font-semibold flex items-center gap-2"><UserRound className="h-4 w-4 text-sky-500" />{t("Interpreter booth")} · {(eventInfo.human || []).map((l) => l.toUpperCase()).join(", ")}</p>
                <p className="font-mono text-xs break-all">{boothUrl}</p>
                {eventInfo.interpreter_code
                  ? <p>{t("Booth code")}: <b className="font-mono tracking-wider" data-testid="booth-code">{eventInfo.interpreter_code}</b></p>
                  : <button className="underline" onClick={() => rotateInterpreterCode().catch((e) => setError(e.message))}>{t("Create a new booth code")}</button>}
              </div>
            )}
          </div>
        </div>
      )}

      <details className="text-sm border-t border-slate-100 dark:border-slate-800 pt-3" data-testid="technical-details">
        <summary className="cursor-pointer text-slate-500">{t("Technical details")}</summary>
        <div className="mt-2 space-y-1 text-slate-600 dark:text-slate-300" data-testid="audio-route">
          <p>{t("Microphone signal")}: {t(active && level.peak > 0.02 ? "Detected" : "Waiting")}</p>
          <p>{t("Translated audio track")}: {t(active && ["active", "muted"].includes(status.outputAudio) ? "Received" : "Waiting")}</p>
          <p>{t("Translation engine")}: {serverMode ? t("Server (recommended)") : t("This browser")}</p>
          <p>{t("Broadcast connection")}: {t(live ? (serverMode && !simple.connected ? "Reconnecting…" : "Connected") : "Stopped")}</p>
          {!serverMode && <p>OpenAI: {status.openai === "connected" ? t("CONNECTED") : "—"}</p>}
          {serverMode && simple.server && <p>{t("Server audio")}: {simple.server.audio ? t("Received") : t("Waiting")} · {Object.entries(simple.server.languages || {}).map(([l, x]) => `${l.toUpperCase()} ${x.state}`).join(" · ")}</p>}
          {usage && <p data-testid="usage-line"><Gauge className="inline h-3.5 w-3.5 mr-1" />{t("AI broadcast time this month")}: <b className="font-mono">{usage.total_minutes} min</b>{usage.cap_minutes ? <> / {usage.cap_minutes} min</> : null}</p>}
          <Link to="/debug" className={`${soft} block`} data-testid="debug-nav-link">{t("Diagnostic log")}</Link>
          {eventInfo && !serverMode && <button data-testid="restart-broadcast-button" onClick={() => restartBroadcast().catch(e => setError(e.message))} disabled={!broadcasting} className={`${soft} mt-1`}>{t("Restart broadcast")}</button>}
        </div>
      </details>

      {fs && qr && (
        <div className="fixed inset-0 z-[70] bg-[#0A0D14] flex flex-col items-center justify-center p-6" data-testid="qr-fullscreen">
          <button onClick={() => setFs(false)} className="absolute top-6 right-6 text-slate-300"><X className="h-7 w-7" /></button>
          <p className="text-emerald-400 font-mono uppercase tracking-[0.35em] mb-8">{t("Scan to listen")}</p>
          <img src={qr} alt="QR" className="h-72 w-72 bg-white p-3 rounded-2xl" />
          {eventInfo?.code && <p className="mt-6 font-mono text-3xl tracking-[0.3em] text-white">{eventInfo.code}</p>}
          <p className="mt-3 font-mono text-slate-300">{window.location.host}/join</p>
        </div>
      )}
    </section>
  );
};

// Resize an uploaded logo so it travels with the event (max ~220 KB).
async function shrinkLogo(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error("This image could not be read.")); i.src = url; });
    for (const size of [360, 260, 180]) {
      const scale = Math.min(1, size / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/webp", 0.85);
      const out = data.startsWith("data:image/webp") ? data : canvas.toDataURL("image/png");
      if (out.length < 220000) return out;
    }
    throw new Error("This logo is too large. Use a simpler image.");
  } finally { URL.revokeObjectURL(url); }
}
