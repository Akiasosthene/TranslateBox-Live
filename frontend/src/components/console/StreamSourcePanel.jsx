import React, { useEffect, useState } from "react";
import { Copy, Eye, EyeOff, RefreshCw, Radio, Server, Square, Play } from "lucide-react";
import { useLocale } from "../../context/LocaleContext";
import { useTranslationSession } from "../../context/TranslationContext";

const GUIDES = [
  ["Zoom", "Settings → Meeting → Allow livestreaming → Custom live streaming service. In the meeting: More → Live on Custom Live Streaming Service, paste the URL and the key."],
  ["Microsoft Teams", "The organizer adds the “Custom Streaming” app to the meeting, pastes the URL and the key, then Start streaming (your IT admin must enable the LiveStreamingMode policy)."],
  ["Webex", "Meeting → More → Start live streaming → Other streaming services, paste the URL and the key."],
  ["OBS / vMix / Restream", "Settings → Stream → Custom, server = URL, key = stream key. To reach YouTube or Vimeo too, multistream from OBS or Restream."],
  ["SRT (low delay)", "Use the SRT address as is (OBS: Settings → Stream → Custom, server = full SRT address, no key)."],
];

// Audio from a meeting or a stream instead of the local microphone.
export const StreamSourcePanel = () => {
  const { t } = useLocale();
  const { eventInfo, ingestInfo, streamState, rotateIngest, active, broadcasting, serverState, refreshServer, startServer, stopServer } = useTranslationSession();
  const [busy, setBusy] = useState(false);
  const running = !!serverState?.server?.running;
  useEffect(() => {
    if (!eventInfo) return undefined;
    refreshServer().catch(() => {});
    const iv = setInterval(() => refreshServer().catch(() => {}), running ? 4000 : 15000);
    return () => clearInterval(iv);
  }, [eventInfo, running, refreshServer]);
  const act = async (fn) => { setBusy(true); setErr(""); try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState("");
  const [err, setErr] = useState("");
  const copy = async (label, text) => { try { await navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(""), 1500); } catch { setCopied(""); } };
  if (!eventInfo) return <p className="text-sm text-amber-700 dark:text-amber-300" data-testid="stream-needs-event">{t("Create or resume an event first: the stream key belongs to the event.")}</p>;
  if (ingestInfo && !ingestInfo.enabled) return <p className="text-sm text-amber-700 dark:text-amber-300">{t("Stream input is not enabled on this server.")}</p>;
  const row = "flex flex-wrap items-center gap-2 text-sm";
  const code = "font-mono text-xs break-all rounded bg-slate-100 dark:bg-white/5 px-2 py-1";
  const btn = "h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1";
  return (
    <div className="rounded-xl border border-sky-500/40 bg-sky-500/5 p-3 space-y-2.5" data-testid="stream-panel">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Radio className={`h-4 w-4 ${streamState.live ? "text-emerald-500 animate-pulse" : "text-slate-400"}`} />
        {streamState.error ? <span className="text-rose-500">{t(streamState.error)}</span>
          : streamState.live ? t("Receiving the stream") : streamState.connected ? t("Waiting for the stream… start streaming from Zoom, Teams, Webex or OBS.") : t("Connecting…")}
      </p>
      {ingestInfo && (
        <>
          <div className={row}><span className="w-24 text-slate-500">{t("Server URL")}</span><code className={code}>{ingestInfo.rtmp_url}</code>
            <button className={btn} onClick={() => copy("url", ingestInfo.rtmp_url)}><Copy className="h-3.5 w-3.5" />{copied === "url" ? t("Copied") : t("Copy")}</button></div>
          <div className={row}><span className="w-24 text-slate-500">{t("Stream key")}</span><code className={code} data-testid="stream-key">{show ? ingestInfo.stream_key : "•".repeat(16)}</code>
            <button className={btn} onClick={() => setShow(!show)} aria-label={show ? t("Hide") : t("Show")}>{show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
            <button className={btn} onClick={() => copy("key", ingestInfo.stream_key)}><Copy className="h-3.5 w-3.5" />{copied === "key" ? t("Copied") : t("Copy")}</button>
            <button className={btn} disabled={active} onClick={() => rotateIngest().catch((e) => setErr(e.message))} title={t("New key: the old one stops working")}><RefreshCw className="h-3.5 w-3.5" />{t("New key")}</button></div>
          {ingestInfo.rtmps_url && <div className={row}><span className="w-24 text-slate-500">RTMPS</span><code className={code}>{ingestInfo.rtmps_url}</code></div>}
          {ingestInfo.srt_url && <div className={row}><span className="w-24 text-slate-500">SRT</span><code className={code}>{show ? ingestInfo.srt_url : ingestInfo.srt_url.replace(/live\/.*/, "live/••••")}</code>
            <button className={btn} onClick={() => copy("srt", ingestInfo.srt_url)}><Copy className="h-3.5 w-3.5" />{copied === "srt" ? t("Copied") : t("Copy")}</button></div>}
        </>
      )}
      <p className="text-xs text-slate-500">{t("Then press Start in the session card: the server pulls the stream and translates every language itself. This console can be closed.")}</p>
      {err && <p className="text-xs text-rose-500">{t(err)}</p>}
      <details className="text-xs text-slate-600 dark:text-slate-400">
        <summary className="cursor-pointer font-semibold">{t("How to send a meeting or a stream")}</summary>
        <ul className="mt-2 space-y-1.5">{GUIDES.map(([name, how]) => <li key={name}><b>{name}</b> — {t(how)}</li>)}</ul>
        <p className="mt-2">{t("The key is secret; anyone with it can send audio to this event.")}</p>
      </details>
    </div>
  );
};
