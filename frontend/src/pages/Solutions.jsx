import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { SiteLayout, useCopy } from "../site/SiteLayout";
import { SOLUTIONS, NAV } from "../site/content";
import { useLocale } from "../context/LocaleContext";

export default function Solutions() {
  const sols = useCopy(SOLUTIONS);
  const nav = useCopy(NAV);
  const { language } = useLocale();
  const fr = language === "fr";
  return (
    <SiteLayout>
      <section className="ts-page-hero ts-grain">
        <div className="ts-wrap">
          <span className="ts-kicker"><i />{nav.solutions}</span>
          <h1 className="ts-h1">{fr ? "Une seule voix. Toute votre communauté." : "One voice. Your whole community."}</h1>
          <p className="ts-lead">{fr ? "Églises, conférences, écoles, municipalités, associations et entreprises : TranslateBox s’adapte à la salle, à l’audience et à vos langues." : "Churches, conferences, schools, municipalities, associations and businesses: TranslateBox fits the room, the audience and your languages."}</p>
        </div>
      </section>
      <section className="ts-section">
        <div className="ts-wrap ts-sol-list">
          {sols.map((s) => (
            <article className="ts-sol-row ts-reveal" id={s.slug} key={s.slug}>
              <div><span className="ts-eyebrow">{s.name}</span><h2>{s.title}</h2><p>{s.text}</p><Link className="ts-btn ts-btn-ink" to="/demo" style={{ marginTop: 10 }}>{nav.demo}<ArrowRight size={16} /></Link></div>
              <ul>{s.points.map((p) => <li key={p}><Check size={18} color="#1f8fc9" />{p}</li>)}</ul>
            </article>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
}
