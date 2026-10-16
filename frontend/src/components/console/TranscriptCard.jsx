import { useLocale } from '../../context/LocaleContext';
import React, { useState } from "react";
import { FileText, Sparkles, Loader2, Copy, Download, Captions } from "lucide-react";
import { useTranslationSession } from "../../context/TranslationContext";
import { toSRT, toVTT, downloadText } from "../../lib/transcript";
import { applyGlossary, parseGlossary } from "../../lib/speech";

// After (or during) a session: download each language's transcript as text or
// subtitles, and create an AI summary of the key takeaways.
export const TranscriptCard = () => {
  const { t } = useLocale();
  const { transcripts, summarize, active, broadcasting, saveTranscripts, glossary, profile, eventInfo, targetText, sourceText, targetLang } = useTranslationSession();
  const [busy, setBusy] = useState("");
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  // Re-read recorders on each render; transcript text changes trigger renders.
  void targetText; void sourceText;
  const rules = parseGlossary(glossary);
  const rows = transcripts().filter((r) => !r.recorder.empty);
  const base = (profile.eventName || eventInfo?.name || "translatebox").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "translatebox";

  const fixed = (segments) => segments.map((s) => ({ ...s, text: applyGlossary(s.text, rules) }));
  const save = (row, kind) => {
    const segments = fixed(row.recorder.all());
    const name = `${base}-${row.lang}`;
    if (kind === "srt") downloadText(`${name}.srt`, toSRT(segments), "application/x-subrip");
    else if (kind === "vtt") downloadText(`${name}.vtt`, toVTT(segments), "text/vtt");
    else downloadText(`${name}.txt`, segments.map((s) => s.text).join("\n\n"));
  };

  const makeSummary = async (row) => {
    setBusy(row.key); setError(""); setSummary(null); setCopied(false);
    try {
      const lang = row.key === "source" ? targetLang : row.lang;
      const text = await summarize({ text: row.recorder.text(), lang });
      setSummary({ label: row.label, lang: row.lang, text });
    } catch (e) { setError(e.message); }
    finally { setBusy(""); }
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
              <button onClick={() => save(row, "srt")} title={t("Subtitles for video")} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1"><Captions className="h-3.5 w-3.5" />SRT</button>
              <button onClick={() => save(row, "vtt")} title={t("Subtitles for video")} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">VTT</button>
              <button data-testid={`summary-${row.key}`} onClick={() => makeSummary(row)} disabled={!!busy}
                className="h-9 px-3 rounded-lg border border-emerald-500 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-500/10 inline-flex items-center gap-1.5 disabled:opacity-50">
                {busy === row.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{t("AI summary")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {(active || broadcasting) && rows.length > 0 && <p className="text-xs text-slate-500">{t("A summary made during the session covers what has been said so far.")}</p>}
      {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}

      {summary && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 space-y-3" data-testid="summary-result">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-semibold">{t("AI summary")} · {t(summary.label)}</p>
            <div className="flex gap-2">
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

// Minimal, safe rendering of the summary's Markdown (headings, bullets, bold).
function Markdownish({ text }) {
  const inline = (line) => line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <React.Fragment key={i}>{part}</React.Fragment>);
  const blocks = [];
  let list = null;
  text.split("\n").forEach((raw, i) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    if (bullet) { (list ||= []).push(<li key={i}>{inline(bullet[1])}</li>); return; }
    if (list) { blocks.push(<ul key={`l${i}`} className="list-disc pl-5 space-y-1">{list}</ul>); list = null; }
    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) blocks.push(<h3 key={i} className="font-bold text-sm mt-2">{inline(h[1])}</h3>);
    else if (line.trim()) blocks.push(<p key={i}>{inline(line)}</p>);
  });
  if (list) blocks.push(<ul key="lend" className="list-disc pl-5 space-y-1">{list}</ul>);
  return <div className="text-sm leading-relaxed space-y-2 text-slate-800 dark:text-slate-100">{blocks}</div>;
}
