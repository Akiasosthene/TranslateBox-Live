import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, Copy, Download, FileText, KeyRound, Languages, Pin, PinOff, Play, Plus, RefreshCw, Trash2, Upload, BarChart3, Pencil, X } from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { useTranslationSession } from "../context/TranslationContext";
import { Header } from "../components/Header";
import { API, operatorFetch, responseError } from "../lib/api";
import { TARGET_LANGUAGES, getTarget } from "../lib/languages";
import { csvObjects, toCSV } from "../lib/csv";
import { UsersAdmin, AccountPage } from "./portal/Accounts";
import { LeadsAdmin } from "./portal/Leads";
import { useAuth } from "../context/AuthContext";
import { isAdmin } from "../lib/auth";
import { toSRT, toVTT, toTimedText, withSpeakers, downloadText } from "../lib/transcript";

const card = "rounded-2xl bg-white/80 dark:bg-[#121824]/70 border border-slate-200/70 dark:border-white/10 p-4 md:p-5";
const btn = "h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 disabled:opacity-40";
const input = "h-10 rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-3 text-sm";
const TITLES = { sessions: "Sessions", transcripts: "Transcripts", activity: "Activity", users: "Users", requests: "Demo requests", account: "Account" };

async function call(path, options, fallback) {
  const res = await operatorFetch(`${API}${path}`, options);
  if (!res.ok) throw new Error(await responseError(res, fallback));
  return res.status === 204 ? null : res.json();
}
const json = (method, body) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const minutes = (usage) => Math.round(Object.values(usage || {}).reduce((a, b) => a + b, 0) / 6) / 10;
const localInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const toIso = (local) => (local ? new Date(local).toISOString() : null);
const langList = (text) => String(text || "").toLowerCase().split(/[\s|/+,;]+/).map((x) => x.trim()).filter((x) => TARGET_LANGUAGES.some((l) => l.code === x));

// Operator portal (Wordly "Attend/Present portal" equivalents): schedule and
// manage sessions, retrieve archived transcripts, activity and API keys.
export default function Portal() {
  const { t } = useLocale();
  const { tab: tabParam } = useParams();
  const { me } = useAuth();
  const tab = TITLES[tabParam] && (!["users", "requests"].includes(tabParam) || isAdmin(me)) ? tabParam : "sessions";
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    try { setEvents((await call("/events", {}, "Could not load the sessions.")).events || []); setError(""); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0D14] text-slate-900 dark:text-slate-100">
      <Header />
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/present" className="h-10 w-10 rounded-lg border border-slate-300 dark:border-slate-700 grid place-items-center" aria-label={t("Back to the console")}><ArrowLeft className="h-5 w-5" /></Link>
            <h1 className="text-2xl font-extrabold">{t(TITLES[tab])}</h1>
          </div>
          {["sessions", "transcripts", "activity"].includes(tab) && <button onClick={refresh} className={btn} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />{t("Refresh")}</button>}
        </div>
        {error && <p role="alert" className="text-sm text-rose-500">{t(error)}</p>}
        {tab === "sessions" && <Sessions events={events} refresh={refresh} setError={setError} />}
        {tab === "transcripts" && <Transcripts events={events} refresh={refresh} setError={setError} />}
        {tab === "activity" && <Activity events={events} setError={setError} />}
        {tab === "users" && <UsersAdmin setError={setError} />}
        {tab === "requests" && <LeadsAdmin setError={setError} />}
        {tab === "account" && <AccountPage setError={setError} keys={<ApiKeys setError={setError} />} />}
      </main>
    </div>
  );
}

function SessionForm({ initial, onSave, onCancel, busy }) {
  const { t } = useLocale();
  const [f, setF] = useState(() => ({
    name: initial?.name || "", organization: initial?.organization || "", start: localInput(initial?.start_at),
    duration: initial?.duration_minutes || 60, labels: (initial?.labels || []).join(", "), archive: !!initial?.archive,
    pinned: !!initial?.pinned, target: initial?.target || "en", extras: (initial?.targets || []).slice(1),
  }));
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const editing = !!initial?.id;
  const toggleExtra = (code) => setF((x) => ({ ...x, extras: x.extras.includes(code) ? x.extras.filter((c) => c !== code) : x.extras.length >= 4 ? x.extras : [...x.extras, code] }));
  const submit = (e) => {
    e.preventDefault();
    onSave({
      name: f.name.trim() || "Live Interpretation", organization: f.organization.trim(), start_at: toIso(f.start),
      duration_minutes: Math.max(0, Math.min(1440, Number(f.duration) || 0)), labels: f.labels.split(",").map((l) => l.trim()).filter(Boolean).slice(0, 10),
      archive_transcripts: f.archive, pinned: f.pinned,
      ...(editing ? {} : { target_language: f.target, extra_languages: f.extras.filter((c) => c !== f.target) }),
    });
  };
  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="session-form">
      <input className={input} value={f.name} onChange={set("name")} maxLength={200} placeholder={t("Event name")} aria-label={t("Event name")} data-testid="session-name" />
      <input className={input} value={f.organization} onChange={set("organization")} maxLength={200} placeholder={t("Organization")} aria-label={t("Organization")} />
      <label className="text-xs text-slate-500">{t("Start")}<input type="datetime-local" className={`${input} w-full mt-1`} value={f.start} onChange={set("start")} data-testid="session-start" /></label>
      <label className="text-xs text-slate-500">{t("Duration (minutes)")}<input type="number" min="0" max="1440" className={`${input} w-full mt-1`} value={f.duration} onChange={set("duration")} /></label>
      <input className={`${input} sm:col-span-2`} value={f.labels} onChange={set("labels")} placeholder={t("Labels, separated by commas (e.g. Keynote, Workshop)")} aria-label={t("Labels")} />
      {!editing && (
        <div className="sm:col-span-2 space-y-2">
          <label className="flex items-center gap-2 text-sm"><Languages className="h-4 w-4 text-emerald-500" />{t("Main language")}
            <select className={input} value={f.target} onChange={set("target")}>{TARGET_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.flag} {t(l.name)}</option>)}</select>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {TARGET_LANGUAGES.filter((l) => l.code !== f.target).map((l) => (
              <button type="button" key={l.code} aria-pressed={f.extras.includes(l.code)} onClick={() => toggleExtra(l.code)}
                className={`px-2.5 py-1 rounded-full border text-xs ${f.extras.includes(l.code) ? "border-emerald-500 bg-emerald-500/10" : "border-slate-300 dark:border-slate-700"}`}>{l.flag} {l.code.toUpperCase()}</button>
            ))}
          </div>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.archive} onChange={set("archive")} className="h-4 w-4 accent-emerald-500" />{t("Keep transcripts on the server")}</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.pinned} onChange={set("pinned")} className="h-4 w-4 accent-emerald-500" />{t("Pinned (never expires)")}</label>
      <div className="sm:col-span-2 flex gap-2">
        <button disabled={busy} className="h-10 px-4 rounded-lg bg-emerald-600 text-white text-sm font-bold disabled:opacity-50" data-testid="session-save">{editing ? t("Save") : t("Schedule the session")}</button>
        {onCancel && <button type="button" onClick={onCancel} className={btn}>{t("Cancel")}</button>}
      </div>
    </form>
  );
}

function Sessions({ events, refresh, setError }) {
  const { t, language } = useLocale();
  const navigate = useNavigate();
  const { resumeEvent, active, broadcasting } = useTranslationSession();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const run = async (fn) => { setBusy(true); setError(""); try { await fn(); await refresh(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q ? events.filter((e) => [e.name, e.code, e.organization, ...(e.labels || [])].join(" ").toLowerCase().includes(q)) : events;
    return [...list].sort((a, b) => (b.pinned - a.pinned) || String(a.start_at || "9").localeCompare(String(b.start_at || "9")));
  }, [events, filter]);

  const importCsv = (file) => run(async () => {
    const rows = csvObjects(await file.text());
    let ok = 0; const failed = [];
    for (const [i, r] of rows.slice(0, 100).entries()) {
      const langs = langList(r.languages || r.langues || r.language || "en");
      const start = r.start || r.start_at || r.date || r.debut || "";
      const iso = start ? new Date(start.replace(" ", "T")) : null;
      try {
        await call("/events", json("POST", {
          name: (r.name || r.nom || `Session ${i + 1}`).slice(0, 200), organization: (r.organization || r.organisation || "").slice(0, 200),
          target_language: langs[0] || "en", extra_languages: langs.slice(1, 5),
          start_at: iso && !Number.isNaN(iso.getTime()) ? iso.toISOString() : null,
          duration_minutes: Math.max(0, Math.min(1440, Number(r.duration || r.duree || 0) || 0)),
          labels: String(r.labels || r.etiquettes || "").split(/[|,]/).map((x) => x.trim()).filter(Boolean).slice(0, 10),
          archive_transcripts: /^(1|yes|oui|true)$/i.test(r.archive || ""),
        }), "Could not create the session.");
        ok++;
      } catch (e) { failed.push(`${i + 2}: ${e.message}`); }
    }
    setImportMsg(`${ok} ${t("sessions imported")}${failed.length ? ` · ${failed.length} ${t("errors")} (${t("line")} ${failed.slice(0, 3).join("; ")})` : ""}`);
  });

  const open = (ev) => run(async () => { await resumeEvent(ev.id); navigate("/present"); });

  return (
    <div className="space-y-4">
      <section className={`${card} space-y-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setCreating((c) => !c)} className="h-10 px-4 rounded-lg bg-emerald-600 text-white text-sm font-bold inline-flex items-center gap-2" data-testid="new-session"><Plus className="h-4 w-4" />{t("New session")}</button>
          <label className={`${btn} h-10 cursor-pointer`}><Upload className="h-3.5 w-3.5" />{t("Import CSV")}
            <input type="file" accept=".csv,text/csv" className="sr-only" data-testid="import-csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; }} />
          </label>
          <button className={`${btn} h-10`} onClick={() => downloadText("translatebox-sessions-template.csv", toCSV([["name", "start", "duration", "languages", "labels", "organization", "archive"], ["Annual conference", "2026-11-01 10:00", "90", "en fr es", "Keynote|Day 1", "My company", "yes"]]), "text/csv")}><Download className="h-3.5 w-3.5" />{t("CSV template")}</button>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("Search name, code or label")} className={`${input} ml-auto w-full sm:w-64`} aria-label={t("Search")} />
        </div>
        {importMsg && <p className="text-sm text-slate-500" role="status">{importMsg}</p>}
        {creating && <SessionForm busy={busy} onCancel={() => setCreating(false)} onSave={(body) => run(async () => { await call("/events", json("POST", body), "Could not create the session."); setCreating(false); })} />}
      </section>

      {shown.length === 0 && <p className="text-sm text-slate-500">{t("No session yet.")}</p>}
      <ul className="space-y-3" data-testid="session-list">
        {shown.map((ev) => (
          <li key={ev.id} className={card}>
            {editing === ev.id ? (
              <SessionForm initial={ev} busy={busy} onCancel={() => setEditing(null)} onSave={(body) => run(async () => { await call(`/events/${ev.id}`, json("PATCH", body), "Could not save the session."); setEditing(null); })} />
            ) : (
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-bold flex items-center gap-2 flex-wrap">
                    {ev.live && <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" aria-label={t("Live")} />}
                    {ev.name}
                    <span className="font-mono text-xs tracking-widest rounded bg-slate-200 dark:bg-white/10 px-2 py-0.5">{ev.code}</span>
                    {ev.pinned && <Pin className="h-3.5 w-3.5 text-amber-500" aria-label={t("Pinned")} />}
                  </p>
                  <p className="text-xs text-slate-500">
                    {(ev.targets || [ev.target]).map((l) => `${getTarget(l).flag} ${l.toUpperCase()}`).join(" · ")}
                    {ev.start_at && <> · {new Date(ev.start_at).toLocaleString(language)}</>}
                    {ev.duration_minutes ? <> · {ev.duration_minutes} min</> : null}
                    {" · "}{minutes(ev.usage)} {t("AI min")} · {t("peak")} {ev.peak_listeners || 0} {t("listeners")}
                    {ev.archive && <> · {t("transcripts archived")}</>}
                    {ev.owner_name && <> · {ev.owner_name}</>}
                  </p>
                  {ev.labels?.length > 0 && <p className="flex flex-wrap gap-1">{ev.labels.map((l) => <span key={l} className="text-[11px] rounded-full border border-slate-300 dark:border-slate-700 px-2">{l}</span>)}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className={btn} onClick={() => open(ev)} disabled={busy || ev.live || active || broadcasting} title={t("Open in the console")}><Play className="h-3.5 w-3.5" />{t("Open")}</button>
                  <button className={btn} onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/e/${ev.id}`).catch(() => {})}><Copy className="h-3.5 w-3.5" />{t("Link")}</button>
                  <button className={btn} onClick={() => setEditing(ev.id)} disabled={busy}><Pencil className="h-3.5 w-3.5" />{t("Edit")}</button>
                  <button className={btn} onClick={() => run(() => call(`/events/${ev.id}`, json("PATCH", { pinned: !ev.pinned }), "Could not save the session."))} disabled={busy} aria-label={ev.pinned ? t("Unpin") : t("Pin")}>{ev.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}</button>
                  <button className={btn} onClick={() => run(() => call(`/events/${ev.id}/clone`, { method: "POST" }, "Could not duplicate the session."))} disabled={busy} data-testid={`clone-${ev.id}`}><Copy className="h-3.5 w-3.5" />{t("Duplicate")}</button>
                  <button className={`${btn} text-rose-600 border-rose-400/60`} disabled={busy || ev.live} data-testid={`delete-${ev.id}`}
                    onClick={() => { if (window.confirm(t("Delete this session and its transcripts?"))) run(() => call(`/events/${ev.id}`, { method: "DELETE" }, "Could not delete the session.")); }}><Trash2 className="h-3.5 w-3.5" />{t("Delete")}</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Transcripts({ events, refresh, setError }) {
  const { t } = useLocale();
  const [busy, setBusy] = useState("");
  const [to, setTo] = useState({});
  const [offset, setOffset] = useState(0);
  const withTx = events.filter((e) => (e.transcripts || []).length > 0);
  const fetchSegments = async (ev, lang) => (await call(`/events/${ev.id}/transcripts/${lang}`, {}, "Could not load the transcript.")).segments || [];
  const save = async (ev, lang, kind) => {
    setError("");
    try {
      const segments = await fetchSegments(ev, lang);
      const name = `${(ev.name || "session").replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}-${lang}`;
      if (kind === "srt") downloadText(`${name}.srt`, toSRT(withSpeakers(segments)), "application/x-subrip");
      else if (kind === "vtt") downloadText(`${name}.vtt`, toVTT(withSpeakers(segments)), "text/vtt");
      else if (kind === "timed") downloadText(`${name}-timed.txt`, toTimedText(segments, { offsetMs: offset * 1000 }));
      else downloadText(`${name}.txt`, withSpeakers(segments).map((s) => s.text).join("\n\n"));
    } catch (e) { setError(e.message); }
  };
  const translate = async (ev, lang) => {
    const target = to[`${ev.id}:${lang}`];
    if (!target) return;
    setBusy(`${ev.id}:${lang}`); setError("");
    try { await call(`/events/${ev.id}/transcripts/${lang}/translate`, json("POST", { to: target }), "The translation failed."); await refresh(); }
    catch (e) { setError(e.message); }
    finally { setBusy(""); }
  };
  const remove = async (ev, lang) => {
    if (!window.confirm(t("Delete this transcript?"))) return;
    try { await call(`/events/${ev.id}/transcripts/${lang}`, { method: "DELETE" }, "Could not delete the transcript."); await refresh(); }
    catch (e) { setError(e.message); }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">{t("Transcripts are stored only for sessions with “Keep transcripts on the server”. They are deleted with the session.")}</p>
      <label className="flex items-center gap-2 text-sm text-slate-500">{t("Timestamp offset (s)")}<input type="number" value={offset} onChange={(e) => setOffset(Number(e.target.value) || 0)} className={`${input} w-24`} /></label>
      {withTx.length === 0 && <p className="text-sm text-slate-500">{t("No archived transcript yet.")}</p>}
      {withTx.map((ev) => (
        <section key={ev.id} className={`${card} space-y-2`}>
          <p className="font-bold">{ev.name} <span className="font-mono text-xs text-slate-500">{ev.code}</span></p>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {ev.transcripts.map((tx) => {
              const key = `${ev.id}:${tx.lang}`;
              return (
                <li key={tx.lang} className="py-2 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm min-w-[8rem]">{tx.lang === "src" ? t("Source") : `${getTarget(tx.lang).flag} ${t(getTarget(tx.lang).name)}`}</span>
                  <span className="text-xs text-slate-500 mr-auto">{tx.segments} {t("segments")}{tx.translated_from ? ` · ${t("translated from")} ${tx.translated_from.toUpperCase()}` : ""}</span>
                  {["txt", "timed", "srt", "vtt"].map((k) => <button key={k} className={btn} onClick={() => save(ev, tx.lang, k)}>{k === "timed" ? "TXT ⏱" : k.toUpperCase()}</button>)}
                  <select aria-label={t("Translate into")} value={to[key] || ""} onChange={(e) => setTo((x) => ({ ...x, [key]: e.target.value }))} className="h-9 rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-2 text-xs">
                    <option value="">{t("Translate into…")}</option>
                    {TARGET_LANGUAGES.filter((l) => l.code !== tx.lang).map((l) => <option key={l.code} value={l.code}>{l.flag} {t(l.name)}</option>)}
                  </select>
                  <button className={btn} disabled={!to[key] || !!busy} onClick={() => translate(ev, tx.lang)}>{busy === key ? t("Translating…") : t("Translate")}</button>
                  <button className={`${btn} text-rose-600`} onClick={() => remove(ev, tx.lang)} aria-label={t("Delete")}><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Activity({ events, setError }) {
  const { t, language } = useLocale();
  const [usage, setUsage] = useState(null);
  useEffect(() => { call("/usage", {}, "Usage unavailable.").then(setUsage).catch((e) => setError(e.message)); }, [setError]);
  const exportCsv = () => {
    const rows = [["session", "code", "owner", "created", "start", "languages", "ai_minutes", ...TARGET_LANGUAGES.map((l) => `min_${l.code}`), "peak_listeners", "labels"]];
    for (const ev of events) {
      rows.push([ev.name, ev.code, ev.owner_name || "", new Date(ev.created * 1000).toISOString(), ev.start_at || "", (ev.targets || []).join(" "), minutes(ev.usage),
        ...TARGET_LANGUAGES.map((l) => Math.round((ev.usage?.[l.code] || 0) / 6) / 10), ev.peak_listeners || 0, (ev.labels || []).join("|")]);
    }
    downloadText(`translatebox-activity-${new Date().toISOString().slice(0, 10)}.csv`, "﻿" + toCSV(rows), "text/csv");
  };
  return (
    <div className="space-y-4">
      <section className={`${card} space-y-2`}>
        <p className="text-sm font-semibold">{t("AI broadcast time this month")}: <b className="font-mono">{usage?.total_minutes ?? "—"} min</b>{usage?.cap_minutes ? ` / ${usage.cap_minutes} min` : ""}</p>
        {usage && <p className="flex flex-wrap gap-2 text-xs">{Object.entries(usage.minutes_by_language || {}).map(([l, m]) => <span key={l} className="rounded-full border border-slate-300 dark:border-slate-700 px-2 py-0.5">{getTarget(l).flag} {l.toUpperCase()} · {m} min</span>)}</p>}
        <button className={btn} onClick={exportCsv} data-testid="activity-csv"><Download className="h-3.5 w-3.5" />{t("Activity report (CSV)")}</button>
      </section>
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500"><th className="py-2 pr-3">{t("Session")}</th><th className="pr-3">{t("Created")}</th><th className="pr-3">{t("Languages")}</th><th className="pr-3 text-right">{t("AI min")}</th><th className="text-right">{t("Peak")}</th></tr></thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-2 pr-3">{ev.name} <span className="font-mono text-xs text-slate-500">{ev.code}</span></td>
                <td className="pr-3 text-xs">{new Date(ev.created * 1000).toLocaleDateString(language)}</td>
                <td className="pr-3 text-xs">{(ev.targets || []).map((l) => l.toUpperCase()).join(" ")}</td>
                <td className="pr-3 text-right font-mono">{minutes(ev.usage)}</td>
                <td className="text-right font-mono">{ev.peak_listeners || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApiKeys({ setError }) {
  const { t, language } = useLocale();
  const [keys, setKeys] = useState([]);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState("");
  const load = useCallback(() => call("/keys", {}, "Could not load the keys.").then((d) => setKeys(d.keys || [])).catch((e) => setError(e.message)), [setError]);
  useEffect(() => { load(); }, [load]);
  const create = async (e) => {
    e.preventDefault();
    try { const d = await call("/keys", json("POST", { name: name.trim() || "API key" }), "Could not create the key."); setFresh(d.key); setName(""); load(); }
    catch (err) { setError(err.message); }
  };
  const revoke = async (id) => {
    if (!window.confirm(t("Revoke this key? Apps using it stop working."))) return;
    try { setKeys((await call(`/keys/${id}`, { method: "DELETE" }, "Could not revoke the key.")).keys || []); } catch (e) { setError(e.message); }
  };
  const origin = window.location.origin;
  return (
    <div className="space-y-4">
      <section className={`${card} space-y-3`}>
        <p className="text-sm text-slate-500">{t("API keys let your own tools create sessions, read transcripts and activity. Treat them like passwords.")}</p>
        <form onSubmit={create} className="flex flex-wrap gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t("Key name (e.g. Company website)")} className={`${input} flex-1 min-w-[12rem]`} data-testid="key-name" />
          <button className="h-10 px-4 rounded-lg bg-emerald-600 text-white text-sm font-bold inline-flex items-center gap-2" data-testid="create-key"><Plus className="h-4 w-4" />{t("Create a key")}</button>
        </form>
        {fresh && (
          <div className="rounded-lg border border-amber-400 bg-amber-500/10 p-3 space-y-2" data-testid="fresh-key">
            <p className="text-sm font-semibold">{t("Copy this key now: it will not be shown again.")}</p>
            <code className="block break-all text-xs font-mono">{fresh}</code>
            <div className="flex gap-2">
              <button className={btn} onClick={() => navigator.clipboard?.writeText(fresh).catch(() => {})}><Copy className="h-3.5 w-3.5" />{t("Copy")}</button>
              <button className={btn} onClick={() => setFresh("")}><X className="h-3.5 w-3.5" />{t("Done")}</button>
            </div>
          </div>
        )}
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {keys.map((k) => (
            <li key={k.id} className="py-2 flex items-center gap-3 text-sm">
              <KeyRound className="h-4 w-4 text-slate-400" /><span className="font-semibold">{k.name}</span>
              <span className="font-mono text-xs text-slate-500">tbk_…{k.last4}</span>
              <span className="text-xs text-slate-500 mr-auto">{new Date(k.created * 1000).toLocaleDateString(language)}</span>
              <button className={`${btn} text-rose-600`} onClick={() => revoke(k.id)}>{t("Revoke")}</button>
            </li>
          ))}
        </ul>
      </section>
      <section className={`${card} space-y-2`}>
        <p className="text-sm font-semibold">{t("Example")}</p>
        <pre className="text-xs font-mono whitespace-pre-wrap break-all rounded-lg bg-slate-900 text-slate-100 p-3">{`curl -H "Authorization: Bearer tbk_…" ${origin}/api/events

curl -X POST -H "Authorization: Bearer tbk_…" -H "Content-Type: application/json" \\
  -d '{"name":"Annual conference","target_language":"en","extra_languages":["fr","es"],"start_at":"2026-11-01T15:00:00Z","archive_transcripts":true}' \\
  ${origin}/api/events

curl -H "Authorization: Bearer tbk_…" ${origin}/api/events/<id>/transcripts/fr`}</pre>
        <p className="text-xs text-slate-500">{t("Full reference: docs/API.md in the repository.")}</p>
      </section>
    </div>
  );
}
