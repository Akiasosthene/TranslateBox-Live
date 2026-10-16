import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AudioLines, Menu, X, ArrowRight } from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { InterfaceLanguage } from "../components/InterfaceLanguage";
import { NAV, FOOTER, SOLUTIONS } from "./content";
import "./site.css";

export const useCopy = (table) => {
  const { language } = useLocale();
  return table[language] || table.en;
};

// Fade sections in as they scroll into view.
export function useReveal() {
  const location = useLocation();
  useEffect(() => {
    const els = [...document.querySelectorAll(".ts-reveal:not(.in)")];
    if (!("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("in")); return undefined; }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [location.pathname]);
}

export function Logo() {
  return <Link to="/" className="ts-logo" aria-label="TranslateBox"><AudioLines aria-hidden="true" /><span>Translate<b>Box</b></span></Link>;
}

export function SiteLayout({ children, solidNav = false }) {
  const nav = useCopy(NAV);
  const foot = useCopy(FOOTER);
  const sols = useCopy(SOLUTIONS);
  const [solid, setSolid] = useState(solidNav);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useReveal();
  useEffect(() => {
    if (solidNav) return undefined;
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [solidNav]);
  useEffect(() => { setOpen(false); if (!location.hash) window.scrollTo(0, 0); }, [location.pathname, location.hash]);
  useEffect(() => {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }, [location.hash, location.pathname]);
  const links = [["/#product", nav.product], ["/solutions", nav.solutions], ["/#integrations", nav.integrations], ["/securite", nav.security], ["/#faq", nav.faq]];
  return (
    <div className="ts">
      <a href="#main" className="sr-only focus:not-sr-only">Skip to content</a>
      <header className={`ts-nav ${solid || open ? "is-solid" : ""}`}>
        <div className="ts-wrap ts-nav-in">
          <Logo />
          <nav className="ts-links" aria-label={nav.product}>
            {links.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => (isActive && !to.includes("#") ? "active" : "")}>{label}</NavLink>)}
          </nav>
          <div className="ts-nav-end">
            <span className="ts-hide-sm"><InterfaceLanguage /></span>
            <Link className="ts-btn ts-btn-ghost ts-hide-sm" to="/join">{nav.join}</Link>
            <Link className="ts-hide-sm" style={{ fontWeight: 700, fontSize: 14, padding: "0 8px" }} to="/login" data-testid="home-signin">{nav.signin}</Link>
            <Link className="ts-btn ts-btn-primary" to="/demo">{nav.demo}</Link>
            <button className="ts-menu-btn" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
          </div>
        </div>
        <div className={`ts-mobile ${open ? "open" : ""}`}>
          {links.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}
          <Link to="/join">{nav.join}</Link>
          <Link to="/login">{nav.signin}</Link>
          <div style={{ paddingTop: 12 }}><InterfaceLanguage /></div>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="ts-footer">
        <div className="ts-wrap">
          <div className="ts-footer-grid">
            <div><Logo /><p style={{ marginTop: 16 }}>{foot.tagline}</p><Link to="/demo" className="ts-btn ts-btn-ink" style={{ marginTop: 10 }}>{nav.demo}<ArrowRight size={16} /></Link></div>
            <div><h4>{foot.product}</h4><ul><li><Link to="/#product">{nav.product}</Link></li><li><Link to="/#integrations">{nav.integrations}</Link></li><li><Link to="/securite">{nav.security}</Link></li><li><Link to="/#faq">{nav.faq}</Link></li></ul></div>
            <div><h4>{nav.solutions}</h4><ul>{sols.map((s) => <li key={s.slug}><Link to={`/solutions#${s.slug}`}>{s.name}</Link></li>)}</ul></div>
            <div><h4>{foot.listeners}</h4><ul><li><Link to="/join">{nav.join}</Link></li><li><Link to="/login">{nav.signin}</Link></li><li><Link to="/demo">{nav.demo}</Link></li></ul></div>
          </div>
          <div className="ts-footer-end"><span>© {new Date().getFullYear()} TranslateBox. {foot.rights}</span><span>Moncton, NB · Canada</span></div>
        </div>
      </footer>
    </div>
  );
}
