import React, { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, CircleCheck, Plus, Check } from "lucide-react";
import { SiteLayout, useCopy, Icon, img } from "../site/SiteLayout";
import { PRODUCTS, PRODUCT_ALIASES, USECASES, UC_PRODUCTS, FEATURES, COMMON, HOME, HOW, SECURITY_PAGE, DEMO, NAV, PRICING, LEGAL, LEGAL_UPDATED } from "../site/content";
import { API } from "../lib/api";
import { useLocale } from "../context/LocaleContext";

const Faq = ({ items }) => <div className="ts-faq">{items.map(([q, a]) => <details key={q}><summary>{q}<Plus size={20} /></summary><p>{a}</p></details>)}</div>;

const Tile = ({ p }) => <Link to={`/produits/${p.slug}`} className="ts-tile"><span><Icon name={p.icon} size={22} /></span><h3>{p.name}</h3><p>{p.short}</p></Link>;

function PageHero({ crumbs, eyebrow, title, lead, image, ctas = true }) {
  const nav = useCopy(NAV);
  const phone = image === "phone" || image === "captions";
  return (
    <section className="ts-page-hero">
      <div className="ts-wrap ts-page-grid">
        <div>
          {crumbs && <p className="ts-crumbs">{crumbs.map(([to, label], i) => <span key={label}>{i > 0 && " / "}{to ? <Link to={to}>{label}</Link> : label}</span>)}</p>}
          {eyebrow && <span className="ts-eyebrow">{eyebrow}</span>}
          <h1 className="ts-h1">{title}</h1>
          <p className="ts-lead">{lead}</p>
          {ctas && <div className="ts-ctas"><Link to="/demo" className="ts-btn ts-btn-primary">{nav.demo}<ArrowRight size={18} /></Link></div>}
        </div>
        {image && <div className={`ts-page-img ${phone ? "phone" : ""}`}><img src={img(image)} alt="" /></div>}
      </div>
    </section>
  );
}

const CtaBand = () => {
  const h = useCopy(HOME);
  return <section className="ts-section"><div className="ts-wrap"><div className="ts-cta"><h2>{h.cta.title}</h2><Link to="/demo" className="ts-btn ts-btn-white">{h.cta.button}<ArrowRight size={18} /></Link></div></div></section>;
};

export function ProductPage() {
  const { slug } = useParams();
  const products = useCopy(PRODUCTS);
  const c = useCopy(COMMON);
  const nav = useCopy(NAV);
  if (PRODUCT_ALIASES[slug]) return <Navigate to={`/produits/${PRODUCT_ALIASES[slug]}`} replace />;
  const p = products.find((x) => x.slug === slug);
  if (!p) return <Navigate to="/produits" replace />;
  return (
    <SiteLayout title={p.title} description={p.lead}>
      <PageHero crumbs={[["/", "Syntova"], ["/produits", nav.products], [null, p.name]]} title={p.title} lead={p.lead} image={p.image} />
      <section className="ts-section soft"><div className="ts-wrap"><h2 className="ts-h2">{c.features}</h2><div className="ts-feats">{p.features.map(([t, d]) => <div key={t}><CircleCheck size={20} /><span><b>{t}</b><p>{d}</p></span></div>)}</div></div></section>
      <section className="ts-section"><div className="ts-wrap"><h2 className="ts-h2 ts-center">{c.faq}</h2><Faq items={p.faq} /></div></section>
      <section className="ts-section soft"><div className="ts-wrap"><h2 className="ts-h2">{c.related}</h2><div className="ts-tiles">{products.filter((x) => x.slug !== slug).slice(0, 4).map((x) => <Tile key={x.slug} p={x} />)}</div></div></section>
      <CtaBand />
    </SiteLayout>
  );
}

export function ProductsIndex() {
  const products = useCopy(PRODUCTS);
  const h = useCopy(HOME);
  const nav = useCopy(NAV);
  return (
    <SiteLayout title={nav.products} description={h.bundle.lead}>
      <PageHero eyebrow={nav.products} title={h.bundle.title} lead={h.bundle.lead} image="screen" />
      <section className="ts-section soft"><div className="ts-wrap"><div className="ts-tiles">{products.map((p) => <Tile key={p.slug} p={p} />)}</div></div></section>
      <CtaBand />
    </SiteLayout>
  );
}

export function UseCasePage() {
  const { slug } = useParams();
  const usecases = useCopy(USECASES);
  const products = useCopy(PRODUCTS);
  const c = useCopy(COMMON);
  const nav = useCopy(NAV);
  const u = usecases.find((x) => x.slug === slug);
  if (!u) return <Navigate to="/cas-usage" replace />;
  const picks = (UC_PRODUCTS[slug] || []).map((s) => products.find((p) => p.slug === s)).filter(Boolean);
  return (
    <SiteLayout title={u.title} description={u.lead}>
      <PageHero crumbs={[["/", "Syntova"], ["/cas-usage", nav.usecases], [null, u.name]]} eyebrow={u.name} title={u.title} lead={u.lead} image={slug === "formations" || slug === "accueil-du-public" ? "captions" : "screen"} />
      <section className="ts-section soft"><div className="ts-wrap"><h2 className="ts-h2">{c.needs}</h2><div className="ts-needs">{u.needs.map(([t, d]) => <article key={t}><h3>{t}</h3><p>{d}</p></article>)}</div></div></section>
      <section className="ts-section"><div className="ts-wrap"><h2 className="ts-h2">{c.included}</h2><div className="ts-tiles">{picks.map((p) => <Tile key={p.slug} p={p} />)}</div></div></section>
      <CtaBand />
    </SiteLayout>
  );
}

export function UseCasesIndex() {
  const usecases = useCopy(USECASES);
  const h = useCopy(HOME);
  const nav = useCopy(NAV);
  return (
    <SiteLayout title={nav.usecases} description={h.usecases.lead}>
      <PageHero eyebrow={nav.usecases} title={h.usecases.title} lead={h.usecases.lead} image="screen" />
      <section className="ts-section soft"><div className="ts-wrap"><div className="ts-segments">{usecases.map((u) => <Link key={u.slug} to={`/cas-usage/${u.slug}`} className="ts-seg"><span><Icon name={u.icon} /></span><div><h3>{u.name}</h3><p>{u.lead}</p></div></Link>)}</div></div></section>
      <CtaBand />
    </SiteLayout>
  );
}

export function FeaturesPage() {
  const f = useCopy(FEATURES);
  return (
    <SiteLayout title={f.title} description={f.lead}>
      <PageHero title={f.title} lead={f.lead} image="sessions" />
      <section className="ts-section soft"><div className="ts-wrap ts-fgroups">{f.groups.map(([icon, title, items]) => (
        <article className="ts-fgroup" key={title}><span><Icon name={icon} size={22} /></span><h2>{title}</h2><ul>{items.map((i) => <li key={i}><Check size={16} />{i}</li>)}</ul></article>
      ))}</div></section>
      <CtaBand />
    </SiteLayout>
  );
}

export function HowItWorks() {
  const w = useCopy(HOW);
  return (
    <SiteLayout title={w.title} description={w.lead}>
      <PageHero title={w.title} lead={w.lead} image="screen" />
      <section className="ts-section soft"><div className="ts-wrap"><div className="ts-how">{w.steps.map(([icon, t, d]) => <article key={t}><span><Icon name={icon} size={24} /></span><h3>{t}</h3><p>{d}</p></article>)}</div></div></section>
      <section className="ts-section"><div className="ts-wrap ts-demo"><div><h2 className="ts-h2">{w.cost.title}</h2><p className="ts-lead">{w.cost.text}</p></div><div className="ts-demo-card"><div className="ts-monitor"><img src={img("sessions")} alt="" loading="lazy" /></div></div></div></section>
      <CtaBand />
    </SiteLayout>
  );
}

export function FaqPage() {
  const h = useCopy(HOME);
  const products = useCopy(PRODUCTS);
  const c = useCopy(COMMON);
  return (
    <SiteLayout title={c.faq}>
      <PageHero title={c.faq} lead={h.hero.lead} ctas={false} />
      <section className="ts-section"><div className="ts-wrap"><Faq items={[...h.features.items.map(([q, a]) => [q, a]), ...products.flatMap((p) => p.faq)]} /></div></section>
      <CtaBand />
    </SiteLayout>
  );
}

export function SecurityPage() {
  const s = useCopy(SECURITY_PAGE);
  return (
    <SiteLayout title={s.title} description={s.lead}>
      <PageHero title={s.title} lead={s.lead} ctas={false} />
      <section className="ts-section soft"><div className="ts-wrap ts-sec-grid">{s.blocks.map(([t, p]) => <article key={t}><h2>{t}</h2><p>{p}</p></article>)}</div></section>
      <CtaBand />
    </SiteLayout>
  );
}

export function DemoPage() {
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
      if (!res.ok) throw new Error(res.status === 429 ? c.tooMany : c.failed);
      setState({ busy: false, done: true, error: "" });
    } catch (err) { setState({ busy: false, done: false, error: err.message || c.failed }); }
  };
  return (
    <SiteLayout title={c.title} description={c.lead}>
      <section className="ts-page-hero">
        <div className="ts-wrap ts-page-grid" style={{ alignItems: "start" }}>
          <div>
            <h1 className="ts-h1">{c.title}</h1>
            <p className="ts-lead">{c.lead}</p>
            <h3 className="ts-h3" style={{ marginTop: 30 }}>{c.includes}</h3>
            <ul className="ts-check" style={{ marginTop: 12 }}>{c.items.map((i) => <li key={i}><CircleCheck size={18} />{i}</li>)}</ul>
          </div>
          {state.done ? <div className="ts-form"><p className="ts-ok" role="status" data-testid="demo-sent">{c.sent}</p></div> : (
            <form className="ts-form" onSubmit={submit} data-testid="demo-form">
              <label>{c.name}<input required maxLength={120} value={f.name} onChange={set("name")} autoComplete="name" /></label>
              <label>{c.email}<input required type="email" maxLength={200} value={f.email} onChange={set("email")} autoComplete="email" /></label>
              <label className="full">{c.org}<input maxLength={160} value={f.organization} onChange={set("organization")} autoComplete="organization" /></label>
              <label>{c.type}<select value={f.kind} onChange={set("kind")}>{c.types.map((x) => <option key={x}>{x}</option>)}</select></label>
              <label>{c.size}<select value={f.size} onChange={set("size")}>{c.sizes.map((x) => <option key={x}>{x}</option>)}</select></label>
              <label className="full">{c.languages}<input maxLength={200} value={f.languages} onChange={set("languages")} placeholder="FR, EN, ES…" /></label>
              <label className="full">{c.message}<textarea maxLength={3000} value={f.message} onChange={set("message")} /></label>
              <input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} style={{ position: "absolute", left: "-9999px" }} aria-hidden="true" />
              {state.error && <p className="ts-err" role="alert">{state.error}</p>}
              <div className="full"><button className="ts-btn ts-btn-primary" disabled={state.busy} data-testid="demo-submit" style={{ width: "100%" }}>{c.send}</button><p style={{ color: "var(--muted)", fontSize: 13, margin: "10px 0 0" }}>{c.privacy}</p></div>
            </form>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}

export function PricingPage() {
  const p = useCopy(PRICING);
  return (
    <SiteLayout title={p.title} description={p.lead}>
      <section className="ts-page-hero"><div className="ts-wrap ts-center"><h1 className="ts-h1">{p.title}</h1><p className="ts-lead" style={{ margin: "16px auto 0" }}>{p.lead}</p></div></section>
      <section className="ts-section soft" style={{ paddingTop: 50 }}><div className="ts-wrap">
        <div className="ts-plans">{p.plans.map((x) => (
          <article key={x.id} className={`ts-plan ${x.id === "pro" ? "featured" : ""}`}>
            {x.id === "pro" && <span className="ts-plan-badge">{p.popular}</span>}
            <h2>{x.name}</h2><p>{x.tag}</p>
            <b className="ts-plan-price">{x.price || p.quote}</b>
            <ul>{x.items.map((i) => <li key={i}><Check size={16} />{i}</li>)}</ul>
            <Link to="/demo" className={`ts-btn ${x.id === "pro" ? "ts-btn-primary" : "ts-btn-outline"}`}>{p.cta}</Link>
          </article>
        ))}</div>
        <p className="ts-plan-note">{p.note}</p>
      </div></section>
      <CtaBand />
    </SiteLayout>
  );
}

function LegalPage({ which }) {
  const l = useCopy(LEGAL);
  const page = l[which];
  return (
    <SiteLayout title={page.title} description={page.lead}>
      <section className="ts-page-hero"><div className="ts-wrap" style={{ maxWidth: 860 }}><h1 className="ts-h1">{page.title}</h1><p className="ts-lead">{page.lead}</p><p className="ts-legal-date">{l.updated} {LEGAL_UPDATED}{l.note ? ` · ${l.note}` : ""}</p></div></section>
      <section className="ts-section" style={{ paddingTop: 30 }}><div className="ts-wrap ts-legal">{page.sections.map(([t, d]) => <article key={t}><h2>{t}</h2><p>{d}</p></article>)}</div></section>
    </SiteLayout>
  );
}
export const PrivacyPage = () => <LegalPage which="privacyPage" />;
export const TermsPage = () => <LegalPage which="termsPage" />;
