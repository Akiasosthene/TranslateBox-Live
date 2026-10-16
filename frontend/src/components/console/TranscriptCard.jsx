import { useLocale } from '../../context/LocaleContext';
import React, { useState } from "react";
import { FileText, Sparkles, Loader2, Copy, Download, Captions, AudioLines, Send, Undo2 } from "lucide-react";
import { Markdownish } from "../Markdownish";
import { TARGET_LANGUAGES } from "../../lib/languages";
import { useTranslationSession } from "../../context/TranslationContext";
import { toSRT, toVTT, toTimedText, withSpeakers, downloadText } from "../../lib/transcript";
import { applyGlossary, parseGlossary } from "../../lib/speech";

// After (or during) a session: download each language's transcript as text or
// subtitles, and create an AI summary of the key takeaways.
export const TranscriptCard = () => {
  const { t } = useLocale();
  const { transcripts, summarize, active, broadcasting, saveTranscripts, glossary, profile, eventInfo, targetText, sourceText, targetLang, publishSummary, unpublishSummary, dub, studioVoice, archiveNow, archiveState } = useTranslationSession();
  const [offset, setOffset] = useState(0);
  const [summaryLang, setSummaryLang] = useState("");
  const [dubbing, setDubbing] = useState(null); // {key, progress, controller}
  const [busy, setBusy] = useState("");
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  // Re-read recorders on each render; transcript text changes trigger renders.
  void targetText; void sourceText;
  const rules = parseGlossary(glossary);
  const rows = transcripts().filter((r) => !r.recorder.empty);
  const base = (profile.eventName || eventInfo?.name || "translatebox").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "translatebox";

  const fixed = (segments, lang) => segments.map((s) => ({ ...s, text: applyGlossary(s.text, rules, lang) }));
  const save = (row, kind) => {
    const segments = fixed(row.recorder.all(), row.lang);
    const name = `${base}-${row.lang}`;
    if (kind === "srt") downloadText(`${name}.srt`, toSRT(withSpeakers(segments)), "application/x-subrip");
    else if (kind === "vtt") downloadText(`${name}.vtt`, toVTT(withSpeakers(segments)), "text/vtt");
    else if (kind === "timed") downloadText(`${name}-timed.txt`, toTimedText(segments, { offsetMs: offset * 1000 }));
    else downloadText(`${name}.txt`, withSpeakers(segments).map((s) => s.text).join("\n\n"));
  };

  const makeSummary = async (row) => {
    setBusy(row.key); setError(""); setSummary(null); setCopied(false);
    try {
      const lang = summaryLang || (row.key === "source" ? targetLang : row.lang);
      const text = await summarize({ text: row.recorder.text(), lang });
      setSummary({ label: row.label, lang, text });
    } catch (e) { setError(e.message); }
    finally { setBusy(""); }
  };

  const makeDub = async (row) => {
    const controller = new AbortController();
    setDubbing({ key: row.key, progress: 0, controller }); setError("");
    try {
      const blob = await dub(row.recorder.all(), { lang: row.lang, signal: controller.signal, onProgress: (p) => setDubbing((d) => d && { ...d, progress: p }) });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${base}-${row.lang}-voice-${studioVoice}.wav`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { if (e.name !== "AbortError") setError(e.message); }
    finally { setDubbing(null); }
  };
  const published = eventInfo?.summaries || {};
  const publish = async () => {
    try { await publishSummary(summary.lang, summary.text); } catch (e) { setError(e.message); }
  };

  return (
    <section data-testid="transcript-card" className="rounded-2xl bg-white/80 dark:bg-[#121824]/70 backdrop-blur-xl border border-slate-200/70 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/20 p-4 md:p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-widest uppercase font-mono text-slate-700 dark:text-slate-200"><FileText className="h-4 w-4 text-emerald-500" />{t("Transcripts & summary")}</h2>
        {!saveTranscripts && <p className="text-xs text-slate-500">{t("Turn on “Save transcripts” in Settings to keep them after STOP.")}</p>}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{t("Transcripts appear here once translation starts. Download them as text or subtitles, or create an AI summary.")}</p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((row) => (
            <li key={row.key} className="py-2.5 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm min-w-[7rem]">{t(row.label)}</span>
              <span className="text-xs font-mono text-slate-500 mr-auto">{row.recorder.all().length} {t("segments")}</span>
              <button onClick={() => save(row, "txt")} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">TXT</button>
              <button onClick={() => save(row, "timed")} title={t("Text with [hh:mm:ss] timestamps")} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">TXT ⏱</button>
              <button onClick={() => save(row, "srt")} title={t("Subtitles for video")} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1"><Captions className="h-3.5 w-3.5" />SRT</button>
              <button onClick={() => save(row, "vtt")} title={t("Subtitles for video")} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">VTT</button>
              {row.key !== "source" && (
                dubbing?.key === row.key
                  ? <button onClick={() => dubbing.controller.abort()} className="h-9 px-3 rounded-lg border border-amber-500 text-amber-700 dark:text-amber-300 text-xs font-semibold inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />{Math.round(dubbing.progress * 100)}% · {t("Cancel")}</button>
                  : <button data-testid={`dub-${row.key}`} onClick={() => makeDub(row)} disabled={!!dubbing} title={t("Translated voice track (WAV) aligned to the session timing, with the studio voice")} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 disabled:opacity-40"><AudioLines className="h-3.5 w-3.5" />{t("Dubbed voice")}</button>
              )}
              <button data-testid={`summary-${row.key}`} onClick={() => makeSummary(row)} disabled={!!busy}
                className="h-9 px-3 rounded-lg border border-emerald-500 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-500/10 inline-flex items-center gap-1.5 disabled:opacity-50">
                {busy === row.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{t("AI summary")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 && (
        <label className="flex items-center gap-2 text-xs text-slate-500">
          {t("Summary language")}
          <select value={summaryLang} onChange={(e) => setSummaryLang(e.target.value)} className="h-8 rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-2 text-xs" data-testid="summary-language">
            <option value="">{t("Same as the transcript")}</option>
            {TARGET_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.flag} {t(l.name)}</option>)}
          </select>
        </label>
      )}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <label className="flex items-center gap-2">{t("Timestamp offset (s)")}
            <input type="number" step="1" value={offset} onChange={(e) => setOffset(Number(e.target.value) || 0)} data-testid="timestamp-offset" className="w-20 h-8 rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-2" />
          </label>
          {eventInfo?.archive && (
            <span className="flex items-center gap-2">
              <button onClick={() => archiveNow()} data-testid="archive-now" className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold">{t("Save to server now")}</button>
              {archiveState.error ? <span className="text-rose-500">{t(archiveState.error)}</span>
                : archiveState.at ? <span>{t("Archived at")} {new Date(archiveState.at).toLocaleTimeString()}</span>
                : <span>{t("Archived automatically every minute while broadcasting.")}</span>}
            </span>
          )}
        </div>
      )}
      {(active || broadcasting) && rows.length > 0 && <p className="text-xs text-slate-500">{t("A summary made during the session covers what has been said so far.")}</p>}
      {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}

      {summary && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 space-y-3" data-testid="summary-result">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-semibold">{t("AI summary")} · {t(summary.label)}</p>
            <div className="flex gap-2 flex-wrap">
              {eventInfo && (published[summary.lang] === summary.text
                ? <button onClick={() => unpublishSummary(summary.lang).catch((e) => setError(e.message))} className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"><Undo2 className="h-3.5 w-3.5" />{t("Remove from listener page")}</button>
                : <button data-testid="publish-summary" onClick={publish} className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"><Send className="h-3.5 w-3.5" />{t("Publish to listeners")}</button>)}
              <button onClick={async () => { try { await navigator.clipboard.writeText(summary.text); setCopied(true); } catch { setCopied(false); } }} className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"><Copy className="h-3.5 w-3.5" />{copied ? t("Copied") : t("Copy")}</button>
              <button onClick={() => downloadText(`${base}-summary-${summary.lang}.md`, summary.text, "text/markdown")} className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"><Download className="h-3.5 w-3.5" />.md</button>
            </div>
          </div>
          <Markdownish text={summary.text} />
          <p className="text-[11px] text-slate-500">{t("Generated by AI from a machine interpretation. Check names and figures before sharing.")}</p>
        </div>
      )}
    </section>
  );
};

