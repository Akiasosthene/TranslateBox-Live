import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, AudioLines, Headphones, Languages, Radio, Captions, MonitorSmartphone, FileText, Users, Video, Sparkles, ShieldCheck } from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { BrandLogo } from "../components/BrandLogo";
import { InterfaceLanguage } from "../components/InterfaceLanguage";

const FEATURES = [
  [Headphones, "Translated audio", "Each listener hears the speaker in their language, on their own phone, with headphones."],
  [Captions, "Live captions", "Large, high-contrast captions on phones, on the room screen and as a video overlay."],
  [Languages, "Several languages at once", "Up to five languages per session, with AI voices or your own human interpreters."],
  [Video, "Zoom, Teams, Webex, OBS", "Send a meeting or a stream to TranslateBox, and captions back to Zoom and Teams."],
  [FileText, "Transcripts and summaries", "Timed transcripts, subtitles (SRT, VTT), translation afterwards and AI summaries."],
  [Users, "Team and minutes", "Accounts with roles, two-factor sign-in, minutes per presenter and activity reports."],
];

// Public home page: attendees join with a code, organizers sign in.
export default function Home() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const join = (e) => { e.preventDefault(); if (clean.length >= 4) navigate(`/join/${clean}`); };
  return (
    <main className="tb-welcome">
      <nav className="tb-nav" aria-label={t("Navigation principale")}>
        <BrandLogo />
        <span className="hidden md:flex items-center gap-6">
          <a className="tb-nav-link" href="#features">{t("Features")}</a>
          <a className="tb-nav-link" href="#fonctionnement">{t("Comment ça marche")}</a>
          <Link className="tb-nav-link" to="/join">{t("Join a session")}</Link>
        </span>
        <InterfaceLanguage />
        <Link className="tb-nav-cta" to="/login" data-testid="home-signin">{t("Espace opérateur")}<ArrowRight size={16} /></Link>
      </nav>
      <section className="tb-hero">
        <div className="tb-intro">
          <span className="tb-pill"><span />{t("La traduction qui rassemble")}</span>
          <h1>{t("Une voix.")}<br /><em>{t("Plus de langues.")}</em><br />{t("Un même moment.")}</h1>
          <p>{t("Conférences, enseignements, rencontres : partagez votre message et permettez à chacun de le suivre dans sa langue, depuis son téléphone.")}</p>
          <Link className="tb-primary" to="/present">{t("Préparer une session")}<ArrowRight size={18} /></Link>
          <div className="tb-benefits"><span><Headphones size={17} />{t("Audio traduit")}</span><span><Languages size={17} />{t("Sous-titres en direct")}</span><span><MonitorSmartphone size={17} />{t("No app to install")}</span></div>
        </div>
        <div className="tb-access-wrap">
          <div className="tb-preview" aria-hidden="true">
            <div className="tb-preview-top"><span className="tb-dots">● ● ●</span><span>{t("Votre message voyage")}</span><AudioLines size={18} /></div>
            <div className="tb-language-path"><span>EN <small>{t("La voix source")}</small></span><ArrowRight /><span>FR <small>{t("La traduction")}</small></span></div>
            <div className="tb-wave">{Array.from({ length: 32 }, (_, i) => <i key={i} style={{ height: `${12 + ((i * 17) % 43)}px` }} />)}</div>
          </div>
          <form onSubmit={join} className="tb-login" data-testid="home-join">
            <span className="tb-eyebrow">{t("ATTENDEES")}</span>
            <h2>{t("Join a session")}</h2>
            <p>{t("Enter the code shown on the screen, or scan the QR code with your camera.")}</p>
            <label htmlFor="home-code">{t("Session code")}</label>
            <input id="home-code" value={clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean} onChange={(e) => setCode(e.target.value)} placeholder="ABCD-1234"
              autoCapitalize="characters" autoComplete="off" spellCheck={false} className="!text-center !text-2xl !font-mono !tracking-[0.25em]" data-testid="home-code" />
            <button className="tb-primary" disabled={clean.length < 4}>{t("Join")}<ArrowRight size={18} /></button>
            <small><ShieldCheck size={15} />{t("No account needed · audio is not recorded")}</small>
          </form>
        </div>
      </section>

      <section id="features" className="tb-how">
        <span className="tb-eyebrow">{t("EVERYTHING FOR MULTILINGUAL EVENTS")}</span>
        <h2>{t("From the microphone to every language.")}</h2>
        <div className="tb-step-grid tb-feature-grid">
          {FEATURES.map(([Icon, title, text]) => <article key={title}><div><Icon size={24} /><Sparkles size={14} /></div><h3>{t(title)}</h3><p>{t(text)}</p></article>)}
        </div>
      </section>

      <section id="fonctionnement" className="tb-how">
        <span className="tb-eyebrow">{t("SIMPLE, DU MICRO AU CASQUE")}</span>
        <h2>{t("Votre événement, dans leur langue.")}</h2>
        <div className="tb-step-grid">
          {[[Radio, "01", t("Préparez votre direct"), t("Choisissez la source audio et la langue de traduction dans votre console.")], [Languages, "02", t("Partagez votre événement"), t("Créez une session et transmettez son lien ou son QR code aux participants.")], [Headphones, "03", t("Écoutez, tout simplement"), t("Les auditeurs ouvrent le lien sur leur téléphone et lancent l’écoute au casque.")]].map(([Icon, number, title, description]) => <article key={number}><div><Icon size={24} /><span>{number}</span></div><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </section>
      <footer className="tb-footer"><strong>TranslateBox</strong><span>{t("Des voix différentes. Une expérience partagée.")}</span><Link to="/login" className="underline">{t("Espace opérateur")}</Link></footer>
    </main>
  );
}
