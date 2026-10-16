import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SiteLayout, useCopy } from "../site/SiteLayout";
import { SECURITY_PAGE, NAV } from "../site/content";

export default function Security() {
  const c = useCopy(SECURITY_PAGE);
  const nav = useCopy(NAV);
  return (
    <SiteLayout>
      <section className="ts-page-hero ts-grain">
        <div className="ts-wrap"><span className="ts-kicker"><i />{nav.security}</span><h1 className="ts-h1">{c.title}</h1><p className="ts-lead">{c.lead}</p></div>
      </section>
      <section className="ts-section">
        <div className="ts-wrap">
          <div className="ts-sec-grid">{c.blocks.map(([t, p]) => <article className="ts-reveal" key={t}><h2>{t}</h2><p>{p}</p></article>)}</div>
          <p style={{ marginTop: 34 }}><Link className="ts-btn ts-btn-ink" to="/demo">{nav.demo}<ArrowRight size={16} /></Link></p>
        </div>
      </section>
    </SiteLayout>
  );
}
