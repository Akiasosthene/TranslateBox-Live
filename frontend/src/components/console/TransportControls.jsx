import { useLocale } from '../../context/LocaleContext';
import React, { useEffect, useRef, useState } from "react";
import { Play, Square, Mic, MicOff, Volume2, VolumeX, RotateCcw, Radio, Cpu, Wifi } from "lucide-react";
import { useTranslationSession } from "../../context/TranslationContext";
import { StatusIndicator } from "../StatusIndicator";
import { SettingsDialog } from "../SettingsDialog";

const fmt = (s) => {
  const m = String(Math.floor(s / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  const h = Math.floor(s / 3600);
  return h > 0 ? `${String(h).padStart(2, "0")}:${m}:${sec}` : `${m}:${sec}`;
};

// Primary transport (start/stop/mute/restart) + compact live status readout.
export const TransportControls = () => {
  const { t } = useLocale();
  const {
    status, active, inputMuted, translationMuted, duration, metrics,
    start, stop, restart, toggleTranslationMute, toggleInputMute,
    pttEnabled, setPttEnabled, setMicMuted,
  } = useTranslationSession();
  const [talking, setTalking] = useState(false);
  const talkingRef = useRef(false);
  const talk = (on) => {
    if (!pttEnabled || !active || talkingRef.current === on) return;
    talkingRef.current = on; setTalking(on); setMicMuted(!on);
  };
  // Hold the space bar to talk, unless typing in a field.
  useEffect(() => {
    if (!pttEnabled || !active) return undefined;
    const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || "") || e.target?.isContentEditable;
    const down = (e) => { if (e.code === "Space" && !e.repeat && !typing(e)) { e.preventDefault(); talk(true); } };
    const up = (e) => { if (e.code === "Space" && !typing(e)) { e.preventDefault(); talk(false); } };
    const blur = () => talk(false);
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const micState = active ? (inputMuted ? "muted" : status.mic) : status.mic;
  const latency = metrics.avgLatencyMs ? (metrics.avgLatencyMs >= 1000 ? `${(metrics.avgLatencyMs / 1000).toFixed(1)}s` : `${metrics.avgLatencyMs}ms`) : "—";

  return (
    <section className="rounded-2xl bg-white/80 dark:bg-[#121824]/70 backdrop-blur-xl border border-slate-200/70 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/20 p-4 md:p-5 flex flex-col lg:flex-row items-center gap-4">
      {!active ? (
        <a href="#event" data-testid="prepare-broadcast-link" className="w-full lg:w-auto lg:flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg py-4 px-8 rounded-xl shadow-[0_0_30px_rgba(16,185,129,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center gap-3 justify-center min-h-[56px]"><Play className="h-6 w-6 fill-white" />{t("Prepare broadcast")}</a>
      ) : (
        <button data-testid="stop-translation-button" onClick={stop} className="w-full lg:w-auto lg:flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-lg py-4 px-8 rounded-xl shadow-[0_0_30px_rgba(239,68,68,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center gap-3 justify-center min-h-[56px]"><Square className="h-6 w-6 fill-white" />{t("STOP")}</button>
      )}

      <div className="flex items-center gap-2">
        <button data-testid="mute-input-button" onClick={toggleInputMute} disabled={!active} title={t("Mute input")} className={`h-12 w-12 flex items-center justify-center rounded-xl border transition-colors disabled:opacity-40 ${inputMuted ? "bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400" : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{inputMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button>
        <button data-testid="mute-translation-button" onClick={toggleTranslationMute} title={t("Mute translation")} className={`h-12 w-12 flex items-center justify-center rounded-xl border transition-colors ${translationMuted ? "bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400" : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{translationMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</button>
        <button data-testid="restart-translation-button" onClick={restart} disabled={!active} title={t("Restart")} className="h-12 w-12 flex items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"><RotateCcw className="h-5 w-5" /></button>
        <SettingsDialog />
      </div>

      <div className="flex flex-col items-center gap-1.5">
        {pttEnabled && active ? (
          <button data-testid="ptt-button" aria-pressed={talking}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); talk(true); }} onPointerUp={() => talk(false)} onPointerCancel={() => talk(false)} onContextMenu={(e) => e.preventDefault()}
            className={`select-none touch-none h-12 px-5 rounded-xl font-bold text-sm border-2 transition-colors ${talking ? "bg-emerald-500 border-emerald-500 text-white shadow-[0_0_24px_rgba(16,185,129,0.5)]" : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"}`}>
            {talking ? t("On air") : t("Hold to talk (Space)")}
          </button>
        ) : null}
        <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer" data-testid="ptt-toggle">
          <input type="checkbox" checked={pttEnabled} onChange={(e) => { setPttEnabled(e.target.checked); if (!e.target.checked) setMicMuted(false); }} className="h-3.5 w-3.5 accent-emerald-500" />
          {t("Push-to-talk")}
        </label>
      </div>

      <div className="lg:ml-auto flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <StatusIndicator name="Mic" icon={Mic} state={micState} testId="status-mic-dot" />
          <StatusIndicator name="OpenAI" icon={Cpu} state={status.openai} testId="status-openai-dot" />
          <StatusIndicator name={t("Live")} icon={Radio} state={status.translation} testId="status-translation-dot" />
          <StatusIndicator name="Net" icon={Wifi} state={status.network} testId="status-network-dot" />
        </div>
        <div className="text-right">
          <div data-testid="session-timer-display" className="text-xl font-mono font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(duration)}</div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400" title={t("Écart entre transcriptions, pas le délai audio")} data-testid="latency-display">~{latency} {t("text gap")}</div>
        </div>
      </div>
    </section>
  );
};
