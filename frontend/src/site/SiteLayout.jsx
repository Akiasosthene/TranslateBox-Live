import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, X, Menu, Presentation, GraduationCap, Landmark, Globe, Users, Mic, Languages, Radio, Smartphone, Headphones, Captions, FileText, Sparkles, Monitor, UserRound, Circle, ShieldCheck, CircleCheck, ArrowRight, Plus, Check, Waypoints, MonitorPlay, CalendarClock, AudioLines } from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { NAV, PRODUCTS, USECASES, COMMON, IMG, LANGS } from "./content";
import "./site.css";
import { SyntovaMark } from "../components/SyntovaMark";

const Icons = { ChevronDown, X, Menu, Presentation, GraduationCap, Landmark, Globe, Users, Mic, Languages, Radio, Smartphone, Headphones, Captions, FileText, Sparkles, Monitor, UserRound, Circle, ShieldCheck, CircleCheck, ArrowRight, Plus, Check, Waypoints, MonitorPlay, CalendarClock, AudioLines };

export const useCopy = (table) => {
  const { language } = useLocale();
  return table[language] || table.en;
};
export const Icon = ({ name, size = 20, ...rest }) => {
  const C = Icons[name] || Icons.Circle;
  return <C size={size} aria-hidden="true" {...rest} />;
};
export const img = (key) => IMG[key] || key;

export function Logo() {
  return <Link to="/" className="ts-logo" aria-label="Syntova"><SyntovaMark /><span>synt<b>ova</b></span></Link>;
}

function SiteLanguage() {
  const { language, setLanguage } = useLocale();
  const c = useCopy(COMMON);
  return (
    <label className="ts-lang"><Globe size={16} aria-hidden="true" />
      <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label={c.language}>
        {LANGS.map(([code, name]) => <option key={code} value={code} lang={code}>{name}</option>)}
      </select>
    </label>
  );
}

function Dropdown({ label, wide, children, id, open, setOpen }) {
  return (
    <div onMouseEnter={() => setOpen(id)} onMouseLeave={() => setOpen(null)}>
      <button className="ts-menu-trigger" aria-expanded={open === id} aria-haspopup="true" onClick={() => setOpen(open === id ? null : id)}>
        {label}<ChevronDown size={16} />
      </button>
      {open === id && <div className={`ts-drop ${wide ? "wide" : ""}`} role="menu">{children}</div>}
    </div>
  );
}

const Item = ({ to, icon, title, text }) => (
  <Link to={to} role="menuitem"><span><Icon name={icon} size={18} /></span><span><b>{title}</b>{text && <small>{text}</small>}</span></Link>
);

export function SiteLayout({ children }) {
  const nav = useCopy(NAV);
  const products = useCopy(PRODUCTS);
  const usecases = useCopy(USECASES);
  const c = useCopy(COMMON);
  const { language } = useLocale();
  const [open, setOpen] = useState(null);
  const [mobile, setMobile] = useState(false);
  const location = useLocation();
  useEffect(() => { setOpen(null); setMobile(false); }, [location.pathname, location.hash]);
  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) { setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 50); return; }
    }
    window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const resources = [["/fonctionnalites", "CircleCheck", nav.features], ["/comment-ca-marche", "Radio", nav.how], ["/faq", "Captions", nav.faq], ["/securite", "ShieldCheck", nav.security]];
  return (
    <div className="ts">
      <a href="#main" className="sr-only focus:not-sr-only">Skip to content</a>
      <header className="ts-header">
        <div className="ts-wrap ts-header-in">
          <Logo />
          <nav className="ts-menu" aria-label="Menu">
            <Dropdown id="p" label={nav.products} wide open={open} setOpen={setOpen}>
              {products.map((p) => <Item key={p.slug} to={`/produits/${p.slug}`} icon={p.icon} title={p.name} text={p.short} />)}
            </Dropdown>
            <Dropdown id="u" label={nav.usecases} open={open} setOpen={setOpen}>
              {usecases.map((u) => <Item key={u.slug} to={`/cas-usage/${u.slug}`} icon={u.icon} title={u.name} />)}
            </Dropdown>
            <Dropdown id="r" label={nav.resources} open={open} setOpen={setOpen}>
              {resources.map(([to, icon, label]) => <Item key={to} to={to} icon={icon} title={label} />)}
            </Dropdown>
          </nav>
          <div className="ts-header-end">
            <span className="hide-md"><SiteLanguage /></span>
            <Link to="/login" className="plain hide-md" data-testid="home-signin">{nav.login}</Link>
            <Link to="/demo" className="ts-btn ts-btn-primary ts-btn-sm">{nav.demo}</Link>
            <button className="ts-burger" aria-label="Menu" aria-expanded={mobile} onClick={() => setMobile(!mobile)}>{mobile ? <X /> : <Menu />}</button>
          </div>
        </div>
        <div className={`ts-mobile ${mobile ? "open" : ""}`}>
          <h5>{nav.products}</h5>
          {products.map((p) => <Link key={p.slug} to={`/produits/${p.slug}`}>{p.name}</Link>)}
          <h5>{nav.usecases}</h5>
          {usecases.map((u) => <Link key={u.slug} to={`/cas-usage/${u.slug}`}>{u.name}</Link>)}
          <h5>{nav.resources}</h5>
          {resources.map(([to, , label]) => <Link key={to} to={to}>{label}</Link>)}
          <Link to="/join">{nav.tryIt}</Link>
          <Link to="/login">{nav.login}</Link>
          <div style={{ paddingTop: 10 }}><SiteLanguage /></div>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="ts-footer">
        <div className="ts-wrap">
          <div className="ts-footer-grid">
            <div><Logo /><p style={{ marginTop: 14 }}>{c.footerTag}</p></div>
            <div><h4>{nav.products}</h4><ul>{products.map((p) => <li key={p.slug}><Link to={`/produits/${p.slug}`}>{p.name}</Link></li>)}</ul></div>
            <div><h4>{nav.usecases}</h4><ul>{usecases.map((u) => <li key={u.slug}><Link to={`/cas-usage/${u.slug}`}>{u.name}</Link></li>)}</ul></div>
            <div><h4>{nav.resources}</h4><ul>{resources.map(([to, , label]) => <li key={to}><Link to={to}>{label}</Link></li>)}</ul></div>
            <div><h4>{c.company}</h4><ul><li><Link to="/demo">{nav.contact}</Link></li><li><Link to="/join">{nav.tryIt}</Link></li><li><Link to="/login">{nav.login}</Link></li></ul></div>
          </div>
          <div className="ts-footer-end"><span>© {new Date().getFullYear()} Syntova. {c.rights}</span><span>{c.made}</span></div>
        </div>
      </footer>
    </div>
  );
}
