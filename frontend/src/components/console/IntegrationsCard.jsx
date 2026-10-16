import { useLocale } from '../../context/LocaleContext';
import React, { useState } from "react";
import { Plug, Trash2, Copy, MonitorPlay, Code2, Video } from "lucide-react";
import { useTranslationSession } from "../../context/TranslationContext";
import { RELAY_PROVIDERS } from "../../lib/captionRelay";
import { getTarget } from "../../lib/languages";

const input = "h-10 rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-3 text-sm text-slate-800 dark:text-slate-100 min-w-0";

function CopyField({ label, value, testId }) {
  const { t } = useLocale();
  const [done, setDone] = useState(false);
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <div className="flex gap-2">
        <input readOnly value={value} data-testid={testId} onFocus={(e) => e.target.select()} className={`${input} flex-1 font-mono text-xs`} />
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* select manually */ } }}
          className="h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"><Copy className="h-3.5 w-3.5" />{done ? t("Copied") : t("Copy")}</button>
      </div>
    </div>
  );
}

// Meeting platforms and streaming: captions to Zoom / Teams, an OBS overlay,
// and embed code for event platforms (Cvent, websites).
export const IntegrationsCard = () => {
  const { t } = useLocale();
  const { eventInfo, targetLang, relayDestinations, addRelay, removeRelay, captionsToListeners } = useTranslationSession();
  const [provider, setProvider] = useState("zoom");
  const [url, setUrl] = useState("");
  const [lang, setLang] = useState("");
  const langs = eventInfo ? (eventInfo.targets || [eventInfo.target]) : [targetLang];
  const chosenLang = langs.includes(lang) ? lang : langs[0];
  const origin = window.location.origin;
  const id = eventInfo?.id;

  return (
    <section data-testid="integrations-card" className="rounded-2xl bg-white/80 dark:bg-[#121824]/70 backdrop-blur-xl border border-slate-200/70 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/20 p-4 md:p-5 space-y-5">
      <h2 className="flex items-center gap-2 text-sm font-bold tracking-widest uppercase font-mono text-slate-700 dark:text-slate-200"><Plug className="h-4 w-4 text-emerald-500" />{t("Integrations")}</h2>

      <div className="space-y-3">
        <p className="flex items-center gap-2 font-semibold text-sm"><Video className="h-4 w-4" />{t("Captions in Zoom or Teams")}</p>
        <p className="text-xs text-slate-500">{t("Paste the meeting's caption link. Each finished sentence is sent as a caption line. Attendees hear the audio through the listener link.")}</p>
        <form className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto_auto] gap-2" onSubmit={(e) => { e.preventDefault(); if (url.trim()) { addRelay({ provider, url, lang: chosenLang }); setUrl(""); } }}>
          <select aria-label={t("Platform")} value={provider} onChange={(e) => setProvider(e.target.value)} className={input} data-testid="relay-provider">
            {Object.entries(RELAY_PROVIDERS).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}
          </select>
          <input aria-label={t("Caption link")} type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className={input} data-testid="relay-url" />
          <select aria-label={t("Caption language")} value={chosenLang} onChange={(e) => setLang(e.target.value)} className={input}>
            {langs.map((l) => <option key={l} value={l}>{getTarget(l).flag} {l.toUpperCase()}</option>)}
          </select>
          <button className="h-10 px-4 rounded-lg border border-emerald-500 text-emerald-700 dark:text-emerald-300 text-sm font-semibold" data-testid="relay-add">{t("Connect")}</button>
        </form>
        <p className="text-[11px] text-slate-500">{t(RELAY_PROVIDERS[provider].hint)}</p>
        {relayDestinations.length > 0 && (
          <ul className="space-y-1.5" data-testid="relay-list">
            {relayDestinations.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2">
                <span className={`h-2 w-2 rounded-full ${d.error ? "bg-rose-500" : d.sent ? "bg-emerald-500" : "bg-slate-400"}`} />
                <span className="font-semibold">{RELAY_PROVIDERS[d.provider].label}</span>
                <span className="font-mono text-xs">{d.lang.toUpperCase()}</span>
                <span className="text-xs text-slate-500 truncate flex-1">{d.error ? t(d.error) : `${d.sent} ${t("lines sent")}`}</span>
                <button aria-label={t("Disconnect")} onClick={() => removeRelay(d.id)} className="text-slate-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {id ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800/60">
          <div className="space-y-2">
            <p className="flex items-center gap-2 font-semibold text-sm"><MonitorPlay className="h-4 w-4" />{t("Live stream overlay (OBS, vMix)")}</p>
            <CopyField label={t("Add as a browser source, 1920×1080")} value={`${origin}/e/${id}/screen?overlay=1&lang=${chosenLang}`} testId="overlay-url" />
            {!captionsToListeners && <p className="text-xs text-amber-700 dark:text-amber-300">{t("Turn on captions for listeners so the overlay shows text.")}</p>}
          </div>
          <div className="space-y-2">
            <p className="flex items-center gap-2 font-semibold text-sm"><Code2 className="h-4 w-4" />{t("Embed in a website or Cvent")}</p>
            <CopyField label={t("Embed code")} value={`<iframe src="${origin}/e/${id}?embed=1" title="Live interpretation" width="100%" height="640" style="border:0" allow="autoplay; screen-wake-lock"></iframe>`} testId="embed-code" />
            <p className="text-[11px] text-slate-500">{t("The site must be allowed in EMBED_ORIGINS on the server.")}</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">{t("Create an event to get the overlay link and embed code.")}</p>
      )}
    </section>
  );
};
