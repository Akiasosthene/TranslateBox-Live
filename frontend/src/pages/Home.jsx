import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CircleCheck } from "lucide-react";
import { SiteLayout, useCopy, Icon, img } from "../site/SiteLayout";
import { HOME, PRODUCTS, USECASES } from "../site/content";

export default function Home() {
  const h = useCopy(HOME);
  const products = useCopy(PRODUCTS);
  const usecases = useCopy(USECASES);
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

      <section className="ts-section">
        <div className="ts-wrap">
          <h2 className="ts-h2 ts-center">{h.life.title}</h2>
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

      <section className="ts-section soft">
        <div className="ts-wrap">
          <div className="ts-center"><h2 className="ts-h2">{h.bundle.title}</h2><p className="ts-lead">{h.bundle.lead}</p></div>
          <div className="ts-tiles">
            {products.map((p) => <Link key={p.slug} to={`/produits/${p.slug}`} className="ts-tile"><span><Icon name={p.icon} size={22} /></span><h3>{p.name}</h3><p>{p.short}</p></Link>)}
          </div>
        </div>
      </section>

      <section className="ts-section">
        <div className="ts-wrap">
          <h2 className="ts-h2">{h.benefits.title}</h2>
          <div className="ts-benefits">
            <ul>{h.benefits.items.map(([t, p]) => <li key={t}><b>{t}</b><p>{p}</p></li>)}</ul>
            <div className="ts-ben-visual"><div className="ts-phone"><img src={img("phone")} alt="" loading="lazy" width="390" height="844" /></div></div>
          </div>
        </div>
      </section>

      <section className="ts-section soft">
        <div className="ts-wrap">
          <div className="ts-center"><h2 className="ts-h2">{h.usecases.title}</h2><p className="ts-lead">{h.usecases.lead}</p></div>
          <div className="ts-segments">
            {usecases.map((u) => <Link key={u.slug} to={`/cas-usage/${u.slug}`} className="ts-seg"><span><Icon name={u.icon} /></span><div><h3>{u.name}</h3><p>{u.title}</p></div></Link>)}
          </div>
        </div>
      </section>

      <section className="ts-section" id="faq">
        <div className="ts-wrap">
          <h2 className="ts-h2 ts-center">{h.features.title}</h2>
          <div className="ts-qa">
            {h.features.items.map(([q, a, label, to]) => <article key={q}><h3>{q}</h3><p>{a}</p><Link to={to} className="ts-link">{label}<ArrowRight size={16} /></Link></article>)}
          </div>
        </div>
      </section>

      <section className="ts-section" style={{ paddingTop: 0 }}>
        <div className="ts-wrap"><div className="ts-cta"><h2>{h.cta.title}</h2><Link to="/demo" className="ts-btn ts-btn-white">{h.cta.button}<ArrowRight size={18} /></Link></div></div>
      </section>
    </SiteLayout>
  );
}
