import { useLocale } from '../context/LocaleContext';
import React from "react";
import { AlertTriangle, X, Globe, SlidersHorizontal } from "lucide-react";
import { useTranslationSession } from "../context/TranslationContext";
import { Header } from "../components/Header";
import { TranscriptPanel } from "../components/TranscriptPanel";
import { BroadcastPanel } from "../components/BroadcastPanel";
import { AudioControlCard } from "../components/console/AudioControlCard";
import { VoiceCard } from "../components/console/VoiceCard";
import { IntegrationsCard } from "../components/console/IntegrationsCard";
import { SpeakerBar } from "../components/console/SpeakerBar";
import { getTarget, sourceLabel } from "../lib/languages";

// One screen for the presenter: languages, Start, QR code. Everything else
// (audio input, voices, glossary, integrations, transcripts) is folded away.
export default function Console() {
  const { t } = useLocale();
  const { error, targetLang, sourceLang, clearError, simple } = useTranslationSession();
  const tgt = getTarget(targetLang);

  return (
    <div className="tb-console min-h-screen bg-slate-100 dark:bg-[#0A0D14] text-slate-900 dark:text-slate-100 font-sans">
      <Header />

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-5">
        {error && (
          <div data-testid="error-banner" className="flex items-start gap-3 rounded-2xl border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="flex-1 text-sm font-medium">{t(error)}</p>
            <button onClick={clearError} data-testid="dismiss-error-button" className="shrink-0 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
          </div>
        )}

        <BroadcastPanel />

        {simple.running && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="simple-transcripts">
            <TranscriptPanel label={`${t("Original")} · ${sourceLabel(sourceLang)}`} badge={sourceLang === "auto" ? <Globe className="h-3.5 w-3.5" /> : sourceLang.slice(0, 3).toUpperCase()} accent="cyan" text={simple.source || ""} active panelTestId="simple-source-panel" textTestId="simple-source-text" />
            <TranscriptPanel label={`${t("Translation")} · ${tgt.name}`} badge={tgt.code.toUpperCase()} accent="emerald" text={simple.caption || ""} active panelTestId="simple-target-panel" textTestId="simple-target-text" />
          </section>
        )}
        <details className="group rounded-3xl bg-white dark:bg-[#121824] border border-slate-200 dark:border-white/10" data-testid="advanced-settings">
          <summary className="cursor-pointer list-none flex items-center gap-3 px-5 py-4 md:px-7">
            <SlidersHorizontal className="h-5 w-5 text-slate-500" />
            <span className="flex-1">
              <b className="block">{t("Advanced settings")}</b>
              <span className="text-sm text-slate-500">{t("Audio input, speaker name, voice, Zoom/Teams")}</span>
            </span>
            <span className="text-slate-400 group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="px-3 pb-4 md:px-5 space-y-4">
            <AudioControlCard hideLanguages />
            <SpeakerBar />
            <VoiceCard />
            <IntegrationsCard />
          </div>
        </details>

        <p className="text-center text-xs text-slate-400 dark:text-slate-600">{t("Audio is not recorded · use headphones to avoid echo")}</p>
      </main>
    </div>
  );
}
