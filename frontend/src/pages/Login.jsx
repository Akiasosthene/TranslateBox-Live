import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, KeyRound, ShieldCheck, Mail, Headphones } from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { BrandLogo } from "../components/BrandLogo";
import { InterfaceLanguage } from "../components/InterfaceLanguage";
import { API } from "../lib/api";
import { applyToken, fetchMe, passwordLogin } from "../lib/auth";

const safeNext = (value) => (value && value.startsWith("/") && !value.startsWith("//") ? value : "/present");

export default function Login() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [operatorCode, setOperatorCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(params.get("e") || "");
  const [busy, setBusy] = useState(false);
  const [sso, setSso] = useState(null);

  const finish = async (token, keep) => {
    const me = await fetchMe(token);
    if (!me) throw new Error(mode === "code" ? "Invalid operator access code." : "Sign-in expired. Try again.");
    applyToken(token, { remember: keep });
    navigate(next, { replace: true });
  };

  useEffect(() => {
    fetch(`${API}/auth/sso`).then((r) => (r.ok ? r.json() : null)).then((d) => setSso(d?.enabled ? d : null)).catch(() => {});
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const session = hash.get("sso");
    const failure = hash.get("sso_error") ? (decodeURIComponent(hash.get("sso_error")).replace(/^m=/, "") || "Sign-in failed.") : "";
    if (session || failure) history.replaceState(null, "", window.location.pathname + window.location.search);
    if (failure) setError(failure);
    if (session) { setBusy(true); finish(session, true).catch((e) => setError(e.message)).finally(() => setBusy(false)); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      if (mode === "code") { await finish(operatorCode.trim(), false); return; }
      const result = await passwordLogin({ email: email.trim(), password, code: needCode ? code : null });
      if (result.totpRequired) { setNeedCode(true); return; }
      await finish(result.token, remember);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <main className="tb-welcome min-h-screen">
      <nav className="tb-nav" aria-label={t("Navigation principale")}>
        <BrandLogo />
        <InterfaceLanguage />
      </nav>
      <section className="max-w-md mx-auto px-5 pb-16">
        <form onSubmit={submit} className="tb-login" data-testid="login-form">
          <span className="tb-eyebrow">{t("VOTRE ESPACE DE DIFFUSION")}</span>
          <h2>{t("Sign in")}</h2>
          <div role="tablist" className="flex gap-2 my-4">
            {[["email", "Email", Mail], ["code", "Operator code", KeyRound]].map(([key, label, Icon]) => (
              <button key={key} type="button" role="tab" aria-selected={mode === key} onClick={() => { setMode(key); setError(""); }} data-testid={`login-mode-${key}`}
                className={`flex-1 h-10 rounded-lg border text-sm font-semibold inline-flex items-center justify-center gap-2 ${mode === key ? "border-sky-500 bg-sky-50 text-sky-800" : "border-slate-200 text-slate-500"}`}><Icon size={15} />{t(label)}</button>
            ))}
          </div>
          {mode === "email" ? (
            <>
              <label htmlFor="login-email">{t("Email")}</label>
              <input id="login-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="login-email" />
              <label htmlFor="login-password">{t("Password")}</label>
              <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} data-testid="login-password" />
              {needCode && (
                <>
                  <label htmlFor="login-code">{t("Code from your authenticator app")}</label>
                  <input id="login-code" inputMode="numeric" autoComplete="one-time-code" autoFocus required value={code} onChange={(e) => setCode(e.target.value)} data-testid="login-code" placeholder="123456" />
                </>
              )}
              <label className="!flex items-center gap-2 !text-sm !font-normal"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="!w-4 !h-4" />{t("Stay signed in on this device")}</label>
            </>
          ) : (
            <>
              <label htmlFor="operator-token">{t("Code d’accès opérateur")}</label>
              <input id="operator-token" type="password" autoComplete="current-password" required value={operatorCode} onChange={(e) => setOperatorCode(e.target.value)} placeholder={t("Votre code confidentiel")} />
              <p className="text-xs text-slate-500">{t("The operator code gives owner access. It is never stored on this device.")}</p>
            </>
          )}
          <button disabled={busy} className="tb-primary" data-testid="login-submit">{busy ? t("Connexion…") : t("Sign in")}<ArrowRight size={18} /></button>
          {sso && <a className="tb-sso" data-testid="sso-button" href={`${API}/auth/sso/start`}><KeyRound size={17} />{t("Sign in with")} {sso.label}</a>}
          {error && <p role="alert" className="tb-login-error">{t(error)}</p>}
          <small><ShieldCheck size={15} />{t("Forgot your password? Ask an administrator to reset it.")}</small>
        </form>
        <p className="mt-6 text-center text-sm text-slate-300"><Headphones size={15} className="inline mr-1" />{t("Listener?")} <Link to="/join" className="underline">{t("Join a session with a code")}</Link></p>
      </section>
    </main>
  );
}
