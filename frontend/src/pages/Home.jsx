import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Plus, Headphones, Captions, Monitor, UserRound, FileText, Sparkles, AudioLines, Server, MicOff, Archive, ShieldCheck } from "lucide-react";
import { SiteLayout, useCopy } from "../site/SiteLayout";
import { LiveStage } from "../site/LiveStage";
import { HOME, SOLUTIONS } from "../site/content";
import { TARGET_LANGUAGES, CASCADE_LANGUAGES } from "../lib/languages";
import { useLocale } from "../context/LocaleContext";

const PRODUCT_ICONS = [Headphones, Captions, Monitor, UserRound, FileText, Sparkles, AudioLines];
const SEC_ICONS = [Server, MicOff, Archive, ShieldCheck];

function JoinBox({ copy }) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return (
    <form className="ts-join" data-testid="home-join" onSubmit={(e) => { e.preventDefault(); if (clean.length >= 4) navigate(`/join/${clean}`); }}>
      <input aria-label={copy.ctaJoin} value={clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean} onChange={(e) => setCode(e.target.value)} placeholder={copy.codePlaceholder} autoComplete="off" spellCheck={false} data-testid="home-code" />
      <button className="ts-btn ts-btn-ghost" style={{ padding: "10px 16px" }} disabled={clean.length < 4}>{copy.ctaJoin}<ArrowRight size={16} /></button>
    </form>
  );
}

function Solutions() {
  const sols = useCopy(SOLUTIONS);
  const [active, setActive] = useState(0);
  const s = sols[active];
  return (
    <div className="ts-sol">
      <div className="ts-sol-tabs" role="tablist">
        {sols.map((x, i) => <button key={x.slug} role="tab" aria-selected={i === active} onClick={() => setActive(i)}>{x.name}</button>)}
      </div>
      <div className="ts-sol-panel" key={s.slug} role="tabpanel">
        <h3>{s.title}</h3>
        <p>{s.text}</p>
        <ul>{s.points.map((p) => <li key={p}><Check size={18} />{p}</li>)}</ul>
        <Link className="ts-btn ts-btn-ink" to={`/solutions#${s.slug}`}>{s.name}<ArrowRight size={16} /></Link>
      </div>
    </div>
  );
}

export default function Home() {
  const c = useCopy(HOME);
  const { language } = useLocale();
  const fr = language === "fr";
  const direct = TARGET_LANGUAGES.map((l) => l.native);
  const more = CASCADE_LANGUAGES.map((l) => l.native);
  const rowA = [...direct, ...more.slice(0, 14)];
  const rowB = more.slice(14);
  return (
    <SiteLayout>
      <section className="ts-hero ts-grain">
        <div className="ts-wrap">
          <div className="ts-hero-grid">
            <div>
              <span className="ts-kicker"><i />{c.kicker}</span>
              <h1 className="ts-h1">{c.title.map((t) => <span key={t}>{t}</span>)}</h1>
              <p className="ts-lead">{c.lead}</p>
              <div className="ts-hero-ctas">
                <Link className="ts-btn ts-btn-primary" to="/demo">{c.ctaDemo}<ArrowRight size={16} /></Link>
                <JoinBox copy={c} />
              </div>
            </div>
            <LiveStage speakerLabel={fr ? "Orateur · anglais" : "Speaker · English"} phoneLabel={fr ? "Votre téléphone" : "Your phone"} />
          </div>
          <div className="ts-proof">{c.proof.map(([n, l]) => <div key={l}><b>{n}</b><span>{l}</span></div>)}</div>
        </div>
      </section>

      <section className="ts-section" id="product">
        <div className="ts-wrap ts-reveal">
          <span className="ts-eyebrow">{c.lifecycleKicker}</span>
          <h2 className="ts-h2">{c.lifecycleTitle}</h2>
          <div className="ts-life">
            {c.lifecycle.map((b) => (
              <article key={b.tag}><span className="tag">{b.tag}</span><h3>{b.title}</h3><ul>{b.items.map((i) => <li key={i}><Check size={16} />{i}</li>)}</ul></article>
            ))}
          </div>
        </div>
      </section>

      <section className="ts-section dark ts-grain">
        <div className="ts-wrap ts-reveal">
          <span className="ts-eyebrow">TranslateBox</span>
          <h2 className="ts-h2">{c.productsTitle}</h2>
          <div className="ts-bento">
            {c.products.map(([title, text], i) => { const Icon = PRODUCT_ICONS[i]; return <article key={title}><Icon /><h3>{title}</h3><p>{text}</p></article>; })}
          </div>
        </div>
      </section>

      <section className="ts-section">
        <div className="ts-wrap ts-reveal">
          <h2 className="ts-h2">{c.stepsTitle}</h2>
          <div className="ts-steps">{c.steps.map(([title, text], i) => <article key={title}><b>{i + 1}</b><h3>{title}</h3><p>{text}</p></article>)}</div>
        </div>
      </section>

      <section className="ts-section alt">
        <div className="ts-wrap ts-reveal">
          <span className="ts-eyebrow">{c.solutionsKicker}</span>
          <h2 className="ts-h2">{c.solutionsTitle}</h2>
          <Solutions />
        </div>
      </section>

      <section className="ts-section" id="integrations">
        <div className="ts-wrap ts-reveal">
          <h2 className="ts-h2">{c.integrationsTitle}</h2>
          <p className="ts-sub">{c.integrationsLead}</p>
          <div className="ts-int">{c.integrations.map((x) => <span key={x}>{x}</span>)}</div>
        </div>
      </section>

      <section className="ts-section dark ts-grain" id="languages">
        <div className="ts-wrap ts-reveal">
          <h2 className="ts-h2">{c.languagesTitle}</h2>
          <p className="ts-sub">{c.languagesLead}</p>
        </div>
        <div className="ts-marquee" aria-hidden="true">
          <div className="ts-marquee-row">{[...rowA, ...rowA].map((n, i) => <span key={i} className={direct.includes(n) ? "direct" : ""}>{n}</span>)}</div>
          <div className="ts-marquee-row rev">{[...rowB, ...rowB].map((n, i) => <span key={i}>{n}</span>)}</div>
        </div>
        <div className="ts-wrap ts-legend"><span><i className="direct" />{fr ? "Interprétation directe" : "Direct interpretation"}</span><span><i />{fr ? "Texte + voix studio" : "Text + studio voice"}</span></div>
      </section>

      <section className="ts-section" id="security">
        <div className="ts-wrap ts-reveal">
          <h2 className="ts-h2">{c.securityTitle}</h2>
          <div className="ts-sec">{c.security.map(([title, text], i) => { const Icon = SEC_ICONS[i]; return <article key={title}><Icon /><h3>{title}</h3><p>{text}</p></article>; })}</div>
          <p style={{ marginTop: 22 }}><Link to="/securite" style={{ fontWeight: 700, color: "#1f8fc9" }}>{fr ? "Tout sur la sécurité" : "Security in detail"} →</Link></p>
        </div>
      </section>

      <section className="ts-section alt" id="faq">
        <div className="ts-wrap ts-reveal">
          <h2 className="ts-h2">{c.faqTitle}</h2>
          <div className="ts-faq">{c.faq.map(([q, a]) => <details key={q}><summary>{q}<Plus /></summary><p>{a}</p></details>)}</div>
        </div>
      </section>

      <section className="ts-section">
        <div className="ts-wrap ts-reveal">
          <div className="ts-cta ts-grain">
            <div><h2>{c.ctaTitle}</h2><p>{c.ctaLead}</p></div>
            <div className="ts-cta-side">
              <Link className="ts-btn ts-btn-primary" to="/demo">{c.ctaDemo}<ArrowRight size={16} /></Link>
              <Link className="ts-btn ts-btn-ghost" to="/login">{fr ? "Espace organisateur" : "Organizer sign-in"}</Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
