import { useLocale } from '../context/LocaleContext';
import React, { useState } from "react";
import { AlertTriangle, X, Maximize2, Minimize2, Globe, SlidersHorizontal } from "lucide-react";
import { useTranslationSession } from "../context/TranslationContext";
import { Header } from "../components/Header";
import { TranscriptPanel } from "../components/TranscriptPanel";
import { BroadcastPanel } from "../components/BroadcastPanel";
import { AudioControlCard } from "../components/console/AudioControlCard";
import { VoiceCard } from "../components/console/VoiceCard";
import { TranscriptCard } from "../components/console/TranscriptCard";
import { IntegrationsCard } from "../components/console/IntegrationsCard";
import { TransportControls } from "../components/console/TransportControls";
import { SpeakerBar } from "../components/console/SpeakerBar";
import { getTarget, sourceLabel } from "../lib/languages";

// One screen for the presenter: languages, Start, QR code. Everything else
// (audio input, voices, glossary, integrations, transcripts) is folded away.
export default function Console() {
  const { t } = useLocale();
  const { sourceText, targetText, error, active, targetLang, sourceLang, clearError, engineMode, setEngineMode, simple } = useTranslationSession();
  const [fullscreen, setFullscreen] = useState(false);
  const tgt = getTarget(targetLang);

  const panels = (
    <>
      <TranscriptPanel label={`${t("Original")} · ${sourceLabel(sourceLang)}`} badge={sourceLang === "auto" ? <Globe className="h-3.5 w-3.5" /> : sourceLang.slice(0, 3).toUpperCase()} accent="cyan" text={sourceText} active={active} panelTestId="original-transcript-panel" textTestId="original-transcript-text" />
      <TranscriptPanel label={`${t("Translation")} · ${tgt.name}`} badge={tgt.code.toUpperCase()} accent="emerald" text={targetText} active={active} panelTestId="translated-transcript-panel" textTestId="translated-transcript-text" />
    </>
  );

  return (
    <div className="tb-console min-h-screen bg-slate-100 dark:bg-[#0A0D14] text-slate-900 dark:text-slate-100 font-sans">
      <Header />

      {fullscreen && (
        <div className="fixed inset-0 z-[60] bg-slate-100 dark:bg-[#0A0D14] p-4 md:p-8 flex flex-col" data-testid="fullscreen-transcript">
          <div className="flex items-center justify-end mb-4">
            <button onClick={() => setFullscreen(false)} data-testid="exit-fullscreen-button" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700"><Minimize2 className="h-4 w-4" />{t("Exit")}</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">{panels}</div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-5">
        {error && (
          <div data-testid="error-banner" className="flex items-start gap-3 rounded-2xl border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="flex-1 text-sm font-medium">{t(error)}</p>
            <button onClick={clearError} data-testid="dismiss-error-button" className="shrink-0 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
          </div>
        )}

        <BroadcastPanel />

        {engineMode === "server" && simple.running && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="simple-transcripts">
            <TranscriptPanel label={`${t("Original")} · ${sourceLabel(sourceLang)}`} badge={sourceLang === "auto" ? <Globe className="h-3.5 w-3.5" /> : sourceLang.slice(0, 3).toUpperCase()} accent="cyan" text={simple.source || ""} active panelTestId="simple-source-panel" textTestId="simple-source-text" />
            <TranscriptPanel label={`${t("Translation")} · ${tgt.name}`} badge={tgt.code.toUpperCase()} accent="emerald" text={simple.caption || ""} active panelTestId="simple-target-panel" textTestId="simple-target-text" />
          </section>
        )}
        {active && (
          <section className="space-y-2">
            <div className="flex justify-end">
              <button data-testid="fullscreen-transcript-button" onClick={() => setFullscreen(true)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"><Maximize2 className="h-4 w-4" />{t("Fullscreen")}</button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{panels}</div>
          </section>
        )}

        <details className="group rounded-3xl bg-white dark:bg-[#121824] border border-slate-200 dark:border-white/10" data-testid="advanced-settings">
          <summary className="cursor-pointer list-none flex items-center gap-3 px-5 py-4 md:px-7">
            <SlidersHorizontal className="h-5 w-5 text-slate-500" />
            <span className="flex-1">
              <b className="block">{t("Advanced settings")}</b>
              <span className="text-sm text-slate-500">{t("Audio input, voice, glossary, automatic stop, Zoom/Teams, transcripts")}</span>
            </span>
            <span className="text-slate-400 group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="px-3 pb-4 md:px-5 space-y-4">
            <section className="rounded-2xl bg-white/80 dark:bg-[#121824]/70 border border-slate-200/70 dark:border-white/10 p-4 md:p-5 space-y-2" data-testid="engine-mode">
              <p className="text-sm font-semibold">{t("Where translation runs")}</p>
              <div role="radiogroup" className="inline-flex rounded-xl border border-slate-300 dark:border-slate-700 p-1 gap-1">
                {[["server", "Server (recommended)"], ["browser", "This browser"]].map(([k, label]) => (
                  <button key={k} type="button" role="radio" aria-checked={engineMode === k} disabled={active || simple.running} onClick={() => setEngineMode(k)} data-testid={`engine-${k}`}
                    className={`h-9 px-3 rounded-lg text-sm font-semibold disabled:opacity-50 ${engineMode === k ? "bg-emerald-600 text-white" : "text-slate-600 dark:text-slate-300"}`}>{t(label)}</button>
                ))}
              </div>
              <p className="text-xs text-slate-500">{t(engineMode === "server" ? "This device only sends the microphone. Translation keeps running if the laptop sleeps or the Wi-Fi drops." : "This browser talks to the AI itself and relays the audio. Keep the tab open and awake.")}</p>
            </section>
            <AudioControlCard hideLanguages />
            <TransportControls />
            <SpeakerBar />
            <VoiceCard />
            <IntegrationsCard />
            <TranscriptCard />
          </div>
        </details>

        <p className="text-center text-xs text-slate-400 dark:text-slate-600">{t("Audio is not recorded · use headphones to avoid echo")}</p>
      </main>
    </div>
  );
}
