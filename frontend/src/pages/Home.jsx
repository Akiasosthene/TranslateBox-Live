import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CircleCheck, ShieldCheck } from "lucide-react";
import { SiteLayout, useCopy, Icon, img } from "../site/SiteLayout";
import { HOME, PRODUCTS, SOLUTIONS, COMMON } from "../site/content";

export default function Home() {
  const h = useCopy(HOME);
  const products = useCopy(PRODUCTS);
  const solutions = useCopy(SOLUTIONS);
  const c = useCopy(COMMON);
  return (
    <SiteLayout>
      <section className="ts-hero">
        <div className="ts-wrap">
          <div className="ts-hero-grid">
            <div>
              <span className="ts-tagline">{h.hero.tagline}</span>
              <h1 className="ts-h1">{h.hero.title}</h1>
              <p className="ts-lead">{h.hero.lead}</p>
              <div className="ts-ctas">
                <Link to="/demo" className="ts-btn ts-btn-primary">{h.hero.cta}<ArrowRight size={18} /></Link>
                <Link to="/comment-ca-marche" className="ts-btn ts-btn-outline">{h.hero.cta2}</Link>
              </div>
              <div className="ts-slogans">
                {h.hero.slogans.map(([icon, title, text]) => <div key={title}><i><Icon name={icon} size={18} /></i><span><b>{title}</b><small>{text}</small></span></div>)}
              </div>
            </div>
            <div className="ts-visual">
              <div className="ts-monitor"><img src={img("screen")} alt={h.hero.title} width="1600" height="900" /></div>
              <div className="ts-phone"><img src={img("captions")} alt="" width="390" height="844" /></div>
            </div>
          </div>
          <div className="ts-icons">
            {h.icons.map(([icon, label, slug]) => <Link key={slug} to={`/produits/${slug}`}><span><Icon name={icon} /></span>{label}</Link>)}
          </div>
        </div>
      </section>

      <section className="ts-section navy" style={{ padding: "54px 0" }}>
        <div className="ts-wrap ts-stats">{h.stats.map(([n, l]) => <div key={l}><b>{n}</b><span>{l}</span></div>)}</div>
      </section>

      <section className="ts-section">
        <div className="ts-wrap">
          <div className="ts-center"><h2 className="ts-h2">{h.life.title}</h2><p className="ts-lead">{h.life.lead}</p></div>
          <div className="ts-cols">
            {h.life.cols.map((col) => (
              <article className="ts-col" key={col.tag}>
                <div className={`ts-col-img ${col.image === "captions" ? "phone" : ""}`}><img src={img(col.image)} alt="" loading="lazy" /></div>
                <div className="ts-col-body"><h3>{col.tag}</h3><ul className="ts-check">{col.items.map((i) => <li key={i}><CircleCheck size={18} />{i}</li>)}</ul></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="ts-wrap">
        <div className="ts-trust"><strong>{h.trust.title}</strong>{h.trust.items.map((t) => <span key={t}><ShieldCheck size={16} />{t}</span>)}</div>
      </div>

      <section className="ts-section">
        <div className="ts-wrap">
          <div className="ts-center"><h2 className="ts-h2">{h.bundle.title}</h2><p className="ts-lead">{h.bundle.lead}</p></div>
          <div className="ts-tiles">
            {products.map((p) => <Link key={p.slug} to={`/produits/${p.slug}`} className="ts-tile"><span><Icon name={p.icon} size={22} /></span><h3>{p.name}</h3><p>{p.short}</p></Link>)}
          </div>
        </div>
      </section>

      <section className="ts-section soft">
        <div className="ts-wrap">
          <h2 className="ts-h2">{h.benefits.title}</h2>
          <div className="ts-benefits">
            <ul>{h.benefits.items.map(([t, p]) => <li key={t}><b>{t}</b><p>{p}</p></li>)}</ul>
            <div className="ts-ben-visual"><div className="ts-phone"><img src={img("phone")} alt="" loading="lazy" width="390" height="844" /></div></div>
          </div>
        </div>
      </section>

      <section className="ts-section">
        <div className="ts-wrap">
          <div className="ts-center"><h2 className="ts-h2">{h.segments.title}</h2><p className="ts-lead">{h.segments.lead}</p></div>
          <div className="ts-segments">
            {solutions.map((s) => <Link key={s.slug} to={`/solutions/${s.slug}`} className="ts-seg"><span><Icon name={s.icon} /></span><div><h3>{s.name}</h3><p>{s.title}</p></div></Link>)}
          </div>
        </div>
      </section>

      <section className="ts-section soft" id="faq">
        <div className="ts-wrap">
          <div className="ts-center"><h2 className="ts-h2">{h.features.title}</h2></div>
          <div className="ts-qa">
            {h.features.items.map(([q, a, label, to]) => <article key={q}><h3>{q}</h3><p>{a}</p><Link to={to} className="ts-link">{label}<ArrowRight size={16} /></Link></article>)}
          </div>
        </div>
      </section>

      <section className="ts-section" style={{ paddingBottom: 40 }}>
        <div className="ts-wrap"><div className="ts-cta"><h2>{h.cta.title}</h2><Link to="/demo" className="ts-btn ts-btn-white">{h.cta.button}<ArrowRight size={18} /></Link></div></div>
      </section>

      <section className="ts-section">
        <div className="ts-wrap ts-demo">
          <div><h2 className="ts-h2">{h.demo.title}</h2><p className="ts-lead">{h.demo.lead}</p><ul className="ts-check" style={{ marginTop: 22 }}>{h.demo.items.map((i) => <li key={i}><CircleCheck size={18} />{i}</li>)}</ul><Link to="/demo" className="ts-btn ts-btn-primary" style={{ marginTop: 26 }}>{h.cta.button}</Link></div>
          <div className="ts-demo-card"><div className="ts-monitor"><img src={img("sessions")} alt="" loading="lazy" /></div><p style={{ margin: "16px 4px 0", color: "var(--muted)", fontSize: 14 }}>{c.allProducts} · <Link to="/produits" className="ts-link">{c.learnMore}</Link></p></div>
        </div>
      </section>
    </SiteLayout>
  );
}
