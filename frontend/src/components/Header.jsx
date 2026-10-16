import { BrandLogo } from './BrandLogo';
import { InterfaceLanguage } from './InterfaceLanguage';
import { useLocale } from '../context/LocaleContext';
import React, { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Sun, Moon, Download, Bug, LogOut, Radio, CalendarClock, FileText, BarChart3, Users, UserRound } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { isAdmin, ROLE_LABEL } from "../lib/auth";

const NAV = [
  ["/present", "Present", Radio, false],
  ["/portal/sessions", "Sessions", CalendarClock, false],
  ["/portal/transcripts", "Transcripts", FileText, false],
  ["/portal/activity", "Activity", BarChart3, false],
  ["/portal/users", "Users", Users, true],
  ["/portal/account", "Account", UserRound, false],
];

export const Header = () => {
  const { t } = useLocale();
  const { theme, toggle } = useTheme();
  const { me, signOut } = useAuth();
  const navigate = useNavigate();
  const admin = isAdmin(me);
  const who = me?.user?.name || me?.user?.email || me?.principal?.name || "";
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const iconBtn =
    "inline-flex items-center justify-center h-10 w-10 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:border-slate-300 dark:hover:border-white/20 transition-colors";

  const link = ({ isActive }) => `inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${isActive ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"}`;
  const nav = NAV.filter(([, , , adminOnly]) => !adminOnly || admin);
  return (
    <header data-testid="app-header" className="sticky top-0 z-50 bg-slate-50/85 dark:bg-[#0A0D14]/80 backdrop-blur-xl border-b border-slate-200/70 dark:border-white/10">
      <div className="h-16 px-4 md:px-6 flex items-center justify-between gap-3">
        <BrandLogo compact to="/present" />
        <nav aria-label={t("Main menu")} className="hidden lg:flex items-center gap-1" data-testid="app-nav">
          {nav.map(([to, label, Icon]) => <NavLink key={to} to={to} className={link}><Icon className="h-4 w-4" />{t(label)}</NavLink>)}
        </nav>
        <div className="flex items-center gap-2">
          <InterfaceLanguage />
          {deferredPrompt && !installed && (
            <button data-testid="pwa-install-button" onClick={install} className={iconBtn} title={t("Install app")}><Download className="h-5 w-5" /></button>
          )}
          <Link data-testid="debug-nav-link" to="/debug" className={`${iconBtn} hidden md:inline-flex`} title={t("Debug console")}><Bug className="h-5 w-5" /></Link>
          <button data-testid="theme-toggle-button" onClick={toggle} className={iconBtn} title={t("Toggle theme")}>
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          {me && (
            <span className="hidden md:flex flex-col items-end leading-tight max-w-[12rem]" data-testid="who">
              <span className="text-sm font-semibold truncate max-w-full">{who}</span>
              <span className="text-[11px] text-slate-500">{t(ROLE_LABEL[me.principal.role] || me.principal.role)}</span>
            </span>
          )}
          <button onClick={async () => { await signOut(); navigate("/login", { replace: true }); }} className={iconBtn} title={t("Sign out")} data-testid="sign-out"><LogOut className="h-5 w-5" /></button>
        </div>
      </div>
      <nav aria-label={t("Main menu")} className="lg:hidden flex gap-1 overflow-x-auto px-3 pb-2 -mt-1">
        {nav.map(([to, label, Icon]) => <NavLink key={to} to={to} className={link}><Icon className="h-4 w-4" />{t(label)}</NavLink>)}
      </nav>
    </header>
  );
};
