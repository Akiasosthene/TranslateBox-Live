import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AudioLines, ChevronDown, X, Menu, Presentation, GraduationCap, Landmark, Globe, Users, MessageSquareText, Mic, Languages, Radio, Smartphone, Headphones, Captions, FileText, Sparkles, Monitor, UserRound, Video, Workflow, CircleHelp, QrCode, LayoutGrid, Circle, ShieldCheck, CircleCheck, ArrowRight, Plus, Check, Waypoints, MonitorPlay, Clapperboard, LayoutDashboard, BadgeCheck, Code2, CalendarClock, ListChecks } from "lucide-react";

const Icons = { AudioLines, ChevronDown, X, Menu, Presentation, GraduationCap, Landmark, Globe, Users, MessageSquareText, Mic, Languages, Radio, Smartphone, Headphones, Captions, FileText, Sparkles, Monitor, UserRound, Video, Workflow, CircleHelp, QrCode, LayoutGrid, Circle, ShieldCheck, CircleCheck, ArrowRight, Plus, Check, Waypoints, MonitorPlay, Clapperboard, LayoutDashboard, BadgeCheck, Code2, CalendarClock, ListChecks };
import { useLocale } from "../context/LocaleContext";
import { InterfaceLanguage } from "../components/InterfaceLanguage";
import { NAV, PRODUCTS, USECASES, CATEGORIES, COMMON, IMG } from "./content";
import "./site.css";
import { SyntoniaMark } from "../components/SyntoniaMark";

export const useCopy = (table) => {
  const { language } = useLocale();
  return table[language] || table.fr;
};
export const Icon = ({ name, size = 20, ...rest }) => {
  const C = Icons[name] || Icons.Circle;
  return <C size={size} aria-hidden="true" {...rest} />;
};
export const img = (key) => IMG[key] || key;

export function Logo() {
  return <Link to="/" className="ts-logo" aria-label="Syntonia"><SyntoniaMark /><span>synton<b>ia</b></span></Link>;
}

function Dropdown({ label, wide, mega, children, id, open, setOpen }) {
  const ref = useRef(null);
  return (
    <div ref={ref} onMouseEnter={() => setOpen(id)} onMouseLeave={() => setOpen(null)}>
      <button className="ts-menu-trigger" aria-expanded={open === id} aria-haspopup="true" onClick={() => setOpen(open === id ? null : id)}>
        {label}<Icons.ChevronDown size={16} />
      </button>
      {open === id && <div className={`ts-drop ${wide ? "wide" : ""} ${mega ? "mega" : ""}`} role="menu">{children}</div>}
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
  const cats = useCopy(CATEGORIES);
  const c = useCopy(COMMON);
  const groups = Object.keys(cats).map((k) => [k, cats[k], products.filter((p) => p.cat === k)]);
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
  const resources = [
    ["/fonctionnalites", "ListChecks", nav.features],
    ["/comment-ca-marche", "Workflow", nav.how],
    ["/faq", "CircleHelp", nav.faq],
    ["/securite", "ShieldCheck", nav.security],
    ["/join", "QrCode", nav.join],
  ];
  return (
    <div className="ts">
      <a href="#main" className="sr-only focus:not-sr-only">Skip to content</a>
      <div className="ts-announce">{nav.announce}<Link to="/produits/traduction">{nav.announceLink} →</Link></div>
      <header className="ts-header">
        <div className="ts-wrap ts-header-in">
          <Logo />
          <nav className="ts-menu" aria-label="Menu">
            <Dropdown id="p" label={nav.products} mega open={open} setOpen={setOpen}>
              {groups.map(([k, label, items]) => (
                <div key={k} className="ts-drop-col"><h6>{label}</h6>{items.map((p) => <Item key={p.slug} to={`/produits/${p.slug}`} icon={p.icon} title={p.name} />)}</div>
              ))}
              <div className="ts-drop-foot"><Link to="/produits" role="menuitem">{nav.allProducts} →</Link><Link to="/fonctionnalites" role="menuitem">{nav.features} →</Link></div>
            </Dropdown>
            <Dropdown id="u" label={nav.usecases} wide open={open} setOpen={setOpen}>
              {usecases.map((u) => <Item key={u.slug} to={`/cas-usage/${u.slug}`} icon={u.icon} title={u.name} />)}
              <Item to="/cas-usage" icon="LayoutGrid" title={nav.allUsecases} />
            </Dropdown>
            <Dropdown id="r" label={nav.resources} open={open} setOpen={setOpen}>
              {resources.map(([to, icon, label]) => <Item key={to} to={to} icon={icon} title={label} />)}
            </Dropdown>
          </nav>
          <div className="ts-header-end">
            <span className="hide-md"><InterfaceLanguage /></span>
            <Link to="/login" className="plain hide-md" data-testid="home-signin">{nav.login}</Link>
            <Link to="/join" className="ts-btn ts-btn-outline ts-btn-sm hide-md">{nav.tryIt}</Link>
            <Link to="/demo" className="ts-btn ts-btn-primary ts-btn-sm">{nav.demo}</Link>
            <button className="ts-burger" aria-label="Menu" aria-expanded={mobile} onClick={() => setMobile(!mobile)}>{mobile ? <Icons.X /> : <Icons.Menu />}</button>
          </div>
        </div>
        <div className={`ts-mobile ${mobile ? "open" : ""}`}>
          {groups.map(([k, label, items]) => (
            <React.Fragment key={k}><h5>{label}</h5>{items.map((p) => <Link key={p.slug} to={`/produits/${p.slug}`}>{p.name}</Link>)}</React.Fragment>
          ))}
          <h5>{nav.usecases}</h5>
          {usecases.map((u) => <Link key={u.slug} to={`/cas-usage/${u.slug}`}>{u.name}</Link>)}
          <h5>{nav.resources}</h5>
          {resources.map(([to, , label]) => <Link key={to} to={to}>{label}</Link>)}
          <Link to="/login">{nav.login}</Link>
          <div style={{ paddingTop: 10 }}><InterfaceLanguage /></div>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="ts-footer">
        <div className="ts-wrap">
          <div className="ts-footer-grid five">
            <div><Logo /><p style={{ marginTop: 14 }}>{c.footerTag}</p><Link to="/demo" className="ts-btn ts-btn-white ts-btn-sm" style={{ marginTop: 6 }}>{nav.demo}</Link></div>
            <div><h4>{cats.live}</h4><ul>{groups[0][2].concat(groups[1][2]).map((p) => <li key={p.slug}><Link to={`/produits/${p.slug}`}>{p.name}</Link></li>)}</ul></div>
            <div><h4>{nav.products}</h4><ul>{groups[2][2].concat(groups[3][2]).map((p) => <li key={p.slug}><Link to={`/produits/${p.slug}`}>{p.name}</Link></li>)}</ul></div>
            <div><h4>{nav.usecases}</h4><ul>{usecases.map((u) => <li key={u.slug}><Link to={`/cas-usage/${u.slug}`}>{u.name}</Link></li>)}</ul></div>
            <div><h4>{nav.resources}</h4><ul>{resources.map(([to, , label]) => <li key={to}><Link to={to}>{label}</Link></li>)}</ul></div>
            <div><h4>{c.company}</h4><ul><li><Link to="/demo">{nav.contact}</Link></li><li><Link to="/login">{nav.login}</Link></li><li><Link to="/join">{nav.tryIt}</Link></li></ul></div>
          </div>
          <div className="ts-footer-end"><span>© {new Date().getFullYear()} Syntonia. {c.rights}</span><span>{c.made}</span></div>
        </div>
      </footer>
    </div>
  );
}

// Product screenshot framed like a monitor or a phone.
export function Shot({ name, alt, kind }) {
  const phone = kind === "phone" || name === "phone" || name === "captions";
  return phone
    ? <div className="ts-phone" style={{ position: "relative", width: "100%", maxWidth: 300 }}><img src={img(name)} alt={alt} loading="lazy" width="390" height="844" /></div>
    : <div className="ts-monitor"><img src={img(name)} alt={alt} loading="lazy" /></div>;
}
