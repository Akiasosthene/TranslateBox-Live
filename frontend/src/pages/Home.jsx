import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SiteLayout, useCopy, Icon, img } from "../site/SiteLayout";
import { HOME, PRODUCTS, USECASES, NAV } from "../site/content";

const STEP_ICONS = ["Mic", "Smartphone", "Headphones"];
const BENEFIT_ICONS = ["Globe", "Smartphone", "Languages", "ShieldCheck"];

export default function Home() {
  const h = useCopy(HOME);
  const products = useCopy(PRODUCTS);
  const usecases = useCopy(USECASES);
  const nav = useCopy(NAV);
  return (
    <SiteLayout title={h.hero.title} description={h.hero.lead}>
      <section className="ts-hero">
        <div className="ts-wrap ts-hero-grid">
          <div>
            <h1 className="ts-h1">{h.hero.title}</h1>
            <p className="ts-lead">{h.hero.lead}</p>
            <div className="ts-ctas">
              <Link to="/demo" className="ts-btn ts-btn-primary">{h.hero.cta}<ArrowRight size={18} /></Link>
              <Link to="/comment-ca-marche" className="ts-btn ts-btn-outline">{h.hero.cta2}</Link>
            </div>
          </div>
          <div className="ts-visual">
            <div className="ts-monitor"><img src={img("screen")} alt="" width="1600" height="900" /></div>
            <div className="ts-phone"><img src={img("captions")} alt="" width="390" height="844" /></div>
          </div>
        </div>
      </section>

      <section className="ts-section ts-tight">
        <div className="ts-wrap">
          <h2 className="ts-h2 ts-center">{h.life.title}</h2>
          <div className="ts-steps3">
            {h.life.cols.map((col, i) => (
              <article key={col.tag}>
                <span className="ts-step-icon"><Icon name={STEP_ICONS[i]} size={22} /></span>
                <h3>{col.tag}</h3>
                <ul>{col.items.map((x) => <li key={x}>{x}</li>)}</ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ts-section soft ts-tight">
        <div className="ts-wrap">
          <div className="ts-center"><h2 className="ts-h2">{h.bundle.title}</h2><p className="ts-lead">{h.bundle.lead}</p></div>
          <div className="ts-prodgrid">
            {products.map((p) => (
              <Link key={p.slug} to={`/produits/${p.slug}`} className="ts-prod">
                <span><Icon name={p.icon} size={20} /></span>
                <div><h3>{p.name}</h3><p>{p.short}</p></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="ts-section ts-tight">
        <div className="ts-wrap ts-split">
          <div className="ts-split-img"><div className="ts-phone"><img src={img("phone")} alt="" loading="lazy" width="390" height="844" /></div></div>
          <div>
            <h2 className="ts-h2">{h.benefits.title}</h2>
            <div className="ts-bens">
              {h.benefits.items.map(([t, p], i) => (
                <div key={t}><span><Icon name={BENEFIT_ICONS[i]} size={20} /></span><div><b>{t}</b><p>{p}</p></div></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="ts-section soft ts-tight">
        <div className="ts-wrap">
          <div className="ts-center"><h2 className="ts-h2">{h.usecases.title}</h2><p className="ts-lead">{h.usecases.lead}</p></div>
          <div className="ts-ucs">
            {usecases.map((u) => <Link key={u.slug} to={`/cas-usage/${u.slug}`}><Icon name={u.icon} size={18} />{u.name}</Link>)}
          </div>
          <p className="ts-center" style={{ marginTop: 22 }}><Link to="/cas-usage" className="ts-link">{nav.allUsecases}<ArrowRight size={16} /></Link></p>
        </div>
      </section>

      <section className="ts-section ts-tight">
        <div className="ts-wrap"><div className="ts-cta"><h2>{h.cta.title}</h2><Link to="/demo" className="ts-btn ts-btn-white">{h.cta.button}<ArrowRight size={18} /></Link></div></div>
      </section>
    </SiteLayout>
  );
}
