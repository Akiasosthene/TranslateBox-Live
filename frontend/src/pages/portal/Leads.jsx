import React, { useCallback, useEffect, useState } from "react";
import { Download, Mail, Trash2 } from "lucide-react";
import { useLocale } from "../../context/LocaleContext";
import { API, operatorFetch, responseError } from "../../lib/api";
import { toCSV } from "../../lib/csv";
import { downloadText } from "../../lib/transcript";

const card = "rounded-2xl bg-white/80 dark:bg-[#121824]/70 border border-slate-200/70 dark:border-white/10 p-4 md:p-5";
const btn = "h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5";

// Demo requests sent from the public website.
export function LeadsAdmin({ setError }) {
  const { t, language } = useLocale();
  const [leads, setLeads] = useState([]);
  const call = useCallback(async (path, options) => {
    const res = await operatorFetch(`${API}${path}`, options);
    if (!res.ok) throw new Error(await responseError(res, "Could not load the requests."));
    setLeads((await res.json()).leads || []);
  }, []);
  useEffect(() => { call("/leads").catch((e) => setError(e.message)); }, [call, setError]);
  const status = (l, value) => call(`/leads/${l.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: value }) }).catch((e) => setError(e.message));
  const exportCsv = () => downloadText(`translatebox-requests-${new Date().toISOString().slice(0, 10)}.csv`, "﻿" + toCSV([
    ["date", "name", "email", "organization", "type", "size", "languages", "message", "status"],
    ...leads.map((l) => [new Date(l.created * 1000).toISOString(), l.name, l.email, l.organization, l.kind, l.size, l.languages, l.message, l.status]),
  ]), "text/csv");
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-sm text-slate-500 mr-auto">{t("Requests sent from “Book a demo” on the website.")}</p>
        <button className={btn} onClick={exportCsv} disabled={!leads.length}><Download className="h-3.5 w-3.5" />CSV</button>
      </div>
      {leads.length === 0 && <p className="text-sm text-slate-500">{t("No request yet.")}</p>}
      {leads.map((l) => (
        <article key={l.id} className={`${card} space-y-2`} data-testid="lead">
          <div className="flex flex-wrap items-center gap-2">
            <b>{l.name}</b><span className="text-sm text-slate-500">{l.organization}</span>
            <span className="text-xs text-slate-400 ml-auto">{new Date(l.created * 1000).toLocaleString(language)}</span>
          </div>
          <p className="text-xs text-slate-500">{[l.kind, l.size, l.languages].filter(Boolean).join(" · ")}</p>
          {l.message && <p className="text-sm whitespace-pre-wrap">{l.message}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <a className={btn} href={`mailto:${encodeURIComponent(l.email)}?subject=${encodeURIComponent("TranslateBox demo")}`}><Mail className="h-3.5 w-3.5" />{l.email}</a>
            <select value={l.status} onChange={(e) => status(l, e.target.value)} className="h-9 rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-2 text-xs">
              <option value="new">{t("New")}</option><option value="contacted">{t("Contacted")}</option><option value="done">{t("Done")}</option>
            </select>
            <button className={`${btn} text-rose-600`} aria-label={t("Delete")} onClick={() => { if (window.confirm(t("Delete this request?"))) call(`/leads/${l.id}`, { method: "DELETE" }).catch((e) => setError(e.message)); }}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </article>
      ))}
    </div>
  );
}
