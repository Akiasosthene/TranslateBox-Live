import React, { useState } from "react";
import { UserRound, X } from "lucide-react";
import { useLocale } from "../../context/LocaleContext";
import { useTranslationSession } from "../../context/TranslationContext";

// Who is speaking now: the name labels captions, the room screen and the
// transcripts at each speaker change. Names come from the event profile.
export const SpeakerBar = () => {
  const { t } = useLocale();
  const { speaker, setSpeaker, profile } = useTranslationSession();
  const [draft, setDraft] = useState("");
  const names = [...new Set(String(profile?.speakers || "").split(/[\n,;]+/).map((n) => n.replace(/\s*[-–(].*$/, "").trim()).filter((n) => n && n.length <= 80))].slice(0, 12);
  const pick = (name) => setSpeaker(name === speaker ? "" : name);
  return (
    <section data-testid="speaker-bar" className="rounded-2xl bg-white/80 dark:bg-[#121824]/70 border border-slate-200/70 dark:border-white/10 p-3 md:p-4 flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest font-mono text-slate-600 dark:text-slate-300 mr-1"><UserRound className="h-4 w-4 text-emerald-500" />{t("Speaker")}</span>
      {names.map((n) => (
        <button key={n} type="button" aria-pressed={n === speaker} onClick={() => pick(n)}
          className={`h-9 px-3 rounded-full border text-sm ${n === speaker ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-slate-300 dark:border-slate-700"}`}>{n}</button>
      ))}
      <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { setSpeaker(draft.trim().slice(0, 80)); setDraft(""); } }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={80} placeholder={t("Name of the speaker")} aria-label={t("Name of the speaker")} data-testid="speaker-input"
          className="h-9 w-44 rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-3 text-sm" />
      </form>
      {speaker && <button onClick={() => setSpeaker("")} className="h-9 px-3 rounded-lg text-sm text-slate-500 inline-flex items-center gap-1" data-testid="speaker-clear"><X className="h-4 w-4" />{speaker}</button>}
      <p className="basis-full text-xs text-slate-500">{t("Captions and transcripts show the name each time the speaker changes. Add names in Settings → Speakers.")}</p>
    </section>
  );
};
