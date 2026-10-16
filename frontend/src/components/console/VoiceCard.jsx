import { useLocale } from '../../context/LocaleContext';
import React from "react";
import { AudioLines, Mic2, Play, Loader2, Check } from "lucide-react";
import { useTranslationSession } from "../../context/TranslationContext";
import { STUDIO_VOICES, VOICE_STYLES } from "../../lib/speech";

const label = "text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono";
const input = "mt-1.5 w-full rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500";

// Voice selection: realtime translation voice, or a fixed studio voice.
export const VoiceCard = () => {
  const { t } = useLocale();
  const {
    voiceMode, setVoiceMode, studioVoice, setStudioVoice, voiceStyleKey, setVoiceStyleKey,
    customVoiceStyle, setCustomVoiceStyle, glossary, setGlossary, previewVoice, previewing,
  } = useTranslationSession();
  const studio = voiceMode === "studio";

  const modes = [
    { id: "original", icon: Mic2, title: "Translation voice", desc: "Follows the speaker's tone. Lowest delay." },
    { id: "studio", icon: AudioLines, title: "Studio voice", desc: "A fixed voice of your choice. About 1–2 s more delay." },
  ];

  return (
    <section data-testid="voice-card" className="rounded-2xl bg-white/80 dark:bg-[#121824]/70 backdrop-blur-xl border border-slate-200/70 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/20 p-4 md:p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className={label}>{t("Voice heard by listeners")}</p>
        <p className="text-xs text-slate-500">{t("Can be changed during a live session.")}</p>
      </div>

      <div role="radiogroup" aria-label={t("Voice heard by listeners")} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {modes.map(({ id, icon: Icon, title, desc }) => {
          const on = voiceMode === id;
          return (
            <button key={id} type="button" role="radio" aria-checked={on} data-testid={`voice-mode-${id}`} onClick={() => setVoiceMode(id)}
              className={`text-left rounded-xl border p-3.5 transition-colors flex gap-3 items-start ${on ? "border-emerald-500 bg-emerald-500/10" : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500"}`}>
              <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${on ? "text-emerald-500" : "text-slate-400"}`} />
              <span className="min-w-0">
                <span className="block font-semibold text-sm">{t(title)}</span>
                <span className="block text-xs text-slate-500 mt-0.5">{t(desc)}</span>
              </span>
            </button>
          );
        })}
      </div>

      {studio && (
        <div className="space-y-4 pt-1">
          <div>
            <p className={label}>{t("Studio voice")}</p>
            <div role="radiogroup" aria-label={t("Studio voice")} className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {STUDIO_VOICES.map((v) => {
                const on = studioVoice === v.id;
                return (
                  <button key={v.id} type="button" role="radio" aria-checked={on} data-testid={`studio-voice-${v.id}`} onClick={() => setStudioVoice(v.id)}
                    className={`text-left rounded-lg border px-3 py-2 transition-colors ${on ? "border-emerald-500 bg-emerald-500/10" : "border-slate-300 dark:border-slate-700 hover:border-slate-400"}`}>
                    <span className="flex items-center justify-between gap-2 font-semibold text-sm">{v.label}{on && <Check className="h-4 w-4 text-emerald-500" />}</span>
                    <span className="block text-[11px] text-slate-500 leading-snug">{t(v.hint)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <p className={label}>{t("Delivery style")}</p>
              <select data-testid="voice-style-select" value={voiceStyleKey} onChange={(e) => setVoiceStyleKey(e.target.value)} className={`${input} h-11`}>
                {Object.entries(VOICE_STYLES).map(([key, s]) => <option key={key} value={key}>{t(s.label)}</option>)}
                <option value="custom">{t("Custom")}</option>
              </select>
            </div>
            <button type="button" data-testid="voice-preview-button" onClick={previewVoice} disabled={previewing}
              className="h-11 px-4 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60">
              {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{t("Preview voice")}
            </button>
          </div>
          {voiceStyleKey === "custom" && (
            <textarea data-testid="voice-style-custom" value={customVoiceStyle} onChange={(e) => setCustomVoiceStyle(e.target.value.slice(0, 400))} rows={2}
              placeholder={t("Describe tone, pace and emotion, e.g. warm, unhurried, reassuring.")} className={`${input} py-2`} />
          )}
          <p className="text-xs text-slate-500">{t("Preview plays only on this device. Listeners are told the voice is AI-generated.")}</p>
        </div>
      )}

      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60">
        <p className={label}>{t("Corrections")}</p>
        <p className="text-xs text-slate-500 mt-1">{t("One per line: wrong => right. Leave the right side empty to hide a word. Applied to listener captions, the room screen, transcripts and the studio voice.")}</p>
        <textarea data-testid="glossary-input" value={glossary} onChange={(e) => setGlossary(e.target.value.slice(0, 4000))} rows={3}
          placeholder={"Breach Mender => Breach Mender House\nMonkton => Moncton"} className={`${input} py-2 font-mono`} />
      </div>
    </section>
  );
};
