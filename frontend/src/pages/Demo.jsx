import React, { useState } from "react";
import { SiteLayout, useCopy } from "../site/SiteLayout";
import { DEMO } from "../site/content";
import { API } from "../lib/api";
import { useLocale } from "../context/LocaleContext";

export default function Demo() {
  const c = useCopy(DEMO);
  const { language } = useLocale();
  const [f, setF] = useState({ name: "", email: "", organization: "", kind: c.types[0], size: c.sizes[1], languages: "", message: "", website: "" });
  const [state, setState] = useState({ busy: false, done: false, error: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, done: false, error: "" });
    try {
      const res = await fetch(`${API}/contact`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, lang: language }) });
      if (!res.ok) throw new Error(res.status === 429 ? (language === "fr" ? "Trop de demandes. Réessayez dans une minute." : "Too many requests. Try again in a minute.") : (language === "fr" ? "L’envoi a échoué. Réessayez." : "Sending failed. Please try again."));
      setState({ busy: false, done: true, error: "" });
    } catch (err) { setState({ busy: false, done: false, error: err.message }); }
  };
  return (
    <SiteLayout>
      <section className="ts-page-hero ts-grain">
        <div className="ts-wrap"><span className="ts-kicker"><i />TranslateBox</span><h1 className="ts-h1">{c.title}</h1><p className="ts-lead">{c.lead}</p></div>
      </section>
      <section className="ts-section">
        <div className="ts-wrap" style={{ maxWidth: 860 }}>
          {state.done ? <div className="ts-form"><p className="ts-ok" role="status" data-testid="demo-sent">{c.sent}</p></div> : (
            <form className="ts-form" onSubmit={submit} data-testid="demo-form">
              <label>{c.name}<input required maxLength={120} value={f.name} onChange={set("name")} autoComplete="name" /></label>
              <label>{c.email}<input required type="email" maxLength={200} value={f.email} onChange={set("email")} autoComplete="email" /></label>
              <label>{c.org}<input maxLength={160} value={f.organization} onChange={set("organization")} autoComplete="organization" /></label>
              <label>{c.type}<select value={f.kind} onChange={set("kind")}>{c.types.map((x) => <option key={x}>{x}</option>)}</select></label>
              <label>{c.size}<select value={f.size} onChange={set("size")}>{c.sizes.map((x) => <option key={x}>{x}</option>)}</select></label>
              <label>{c.languages}<input maxLength={200} value={f.languages} onChange={set("languages")} placeholder="FR, EN, ES, SW…" /></label>
              <label className="full">{c.message}<textarea maxLength={3000} value={f.message} onChange={set("message")} /></label>
              {/* Honeypot: hidden from people, filled by bots. */}
              <input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} style={{ position: "absolute", left: "-9999px" }} aria-hidden="true" />
              {state.error && <p className="ts-err" role="alert">{state.error}</p>}
              <div className="full" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <button className="ts-btn ts-btn-primary" disabled={state.busy} data-testid="demo-submit">{c.send}</button>
                <small style={{ color: "var(--muted)" }}>{c.privacy}</small>
              </div>
            </form>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}
