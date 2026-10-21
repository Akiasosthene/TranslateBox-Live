import React, { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, KeyRound, Plus, RotateCcw, ShieldCheck, Trash2, UserPlus, ArrowRightLeft, Infinity as InfinityIcon } from "lucide-react";
import { useLocale } from "../../context/LocaleContext";
import { useAuth } from "../../context/AuthContext";
import { API, operatorFetch, responseError } from "../../lib/api";
import { ROLE_LABEL } from "../../lib/auth";

const card = "rounded-2xl bg-white/80 dark:bg-[#121824]/70 border border-slate-200/70 dark:border-white/10 p-4 md:p-5";
const btn = "h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 disabled:opacity-40";
const input = "h-10 rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-3 text-sm";
const primary = "h-10 px-4 rounded-lg bg-emerald-600 text-white text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50";

async function call(path, options, fallback) {
  const res = await operatorFetch(`${API}${path}`, options);
  if (!res.ok) throw new Error(await responseError(res, fallback));
  return res.json();
}
const json = (method, body) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const minutesText = (u, t) => (u.minutes_balance === null || u.minutes_balance === undefined ? t("Unlimited") : `${u.minutes_balance} min`);

function Secret({ label, value, onDone }) {
  const { t } = useLocale();
  return (
    <div className="rounded-lg border border-amber-400 bg-amber-500/10 p-3 space-y-2" data-testid="secret-box">
      <p className="text-sm font-semibold">{t(label)}</p>
      <code className="block break-all font-mono text-sm">{value}</code>
      <div className="flex gap-2">
        <button className={btn} onClick={() => navigator.clipboard?.writeText(value).catch(() => {})}><Copy className="h-3.5 w-3.5" />{t("Copy")}</button>
        <button className={btn} onClick={onDone}>{t("Done")}</button>
      </div>
    </div>
  );
}

export function UsersAdmin({ setError }) {
  const { t, language } = useLocale();
  const { me } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ email: "", name: "", role: "presenter", minutes: "" });
  const [secret, setSecret] = useState(null);
  const [busy, setBusy] = useState(false);
  const [transfer, setTransfer] = useState({ from: "", to: "", minutes: "" });
  const owner = me?.principal?.role === "owner";
  const load = useCallback(() => call("/users", {}, "Could not load the users.").then((d) => setUsers(d.users || [])).catch((e) => setError(e.message)), [setError]);
  useEffect(() => { load(); }, [load]);
  const run = async (fn) => { setBusy(true); setError(""); try { await fn(); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const create = (e) => {
    e.preventDefault();
    run(async () => {
      const d = await call("/users", json("POST", { email: form.email.trim(), name: form.name.trim(), role: form.role, minutes: form.minutes === "" ? null : Number(form.minutes) }), "Could not create the user.");
      setSecret({ label: `Temporary password for ${d.user.email}: share it privately; they change it after signing in.`, value: d.temporary_password });
      setForm({ email: "", name: "", role: "presenter", minutes: "" });
    });
  };
  const patch = (u, body) => run(() => call(`/users/${u.id}`, json("PATCH", body), "Could not save the user."));
  const setMinutes = (u) => {
    const value = window.prompt(t("Minutes available for this user (leave empty for unlimited):"), u.minutes_balance ?? "");
    if (value === null) return;
    patch(u, value.trim() === "" ? { unlimited: true } : { minutes_balance: Math.max(0, Number(value) || 0) });
  };
  return (
    <div className="space-y-4">
      {secret && <Secret label={secret.label} value={secret.value} onDone={() => setSecret(null)} />}
      <form onSubmit={create} className={`${card} grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_auto_auto_auto] gap-2 items-end`} data-testid="user-form">
        <label className="text-xs text-slate-500">{t("Email")}<input type="email" required className={`${input} w-full mt-1`} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="user-email" /></label>
        <label className="text-xs text-slate-500">{t("Name")}<input className={`${input} w-full mt-1`} maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="text-xs text-slate-500">{t("Role")}
          <select className={`${input} w-full mt-1`} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} data-testid="user-role">
            <option value="presenter">{t("Presenter")}</option><option value="admin">{t("Administrator")}</option>{owner && <option value="owner">{t("Owner")}</option>}
          </select>
        </label>
        <label className="text-xs text-slate-500 flex flex-col">{t("Minutes")}<input type="number" min="0" placeholder={t("Unlimited")} className={`${input} w-28 mt-1`} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} /></label>
        <button className={primary} disabled={busy} data-testid="user-create"><UserPlus className="h-4 w-4" />{t("Add")}</button>
      </form>
      <p className="text-xs text-slate-500">{t("Presenters see and run only their own sessions. Administrators manage everyone. Owners can also manage other owners.")}</p>

      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-sm" data-testid="user-table">
          <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500"><th className="py-2 pr-3">{t("User")}</th><th className="pr-3">{t("Role")}</th><th className="pr-3">{t("Minutes left")}</th><th className="pr-3">{t("Used")}</th><th className="pr-3">2FA</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={`border-t border-slate-200 dark:border-slate-800 ${u.disabled ? "opacity-50" : ""}`}>
                <td className="py-2 pr-3"><b>{u.name || u.email}</b><br /><span className="text-xs text-slate-500">{u.email}{u.last_login ? ` · ${t("last sign-in")} ${new Date(u.last_login * 1000).toLocaleDateString(language)}` : ""}</span></td>
                <td className="pr-3">
                  <select value={u.role} disabled={busy || (u.role === "owner" && !owner)} onChange={(e) => patch(u, { role: e.target.value })} className="h-8 rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-2 text-xs">
                    <option value="presenter">{t("Presenter")}</option><option value="admin">{t("Administrator")}</option>{(owner || u.role === "owner") && <option value="owner">{t("Owner")}</option>}
                  </select>
                </td>
                <td className="pr-3"><button className={btn} onClick={() => setMinutes(u)} disabled={busy}>{u.minutes_balance === null ? <InfinityIcon className="h-3.5 w-3.5" /> : null}{minutesText(u, t)}</button></td>
                <td className="pr-3 font-mono text-xs">{u.minutes_used} min</td>
                <td className="pr-3">{u.totp_enabled ? <ShieldCheck className="h-4 w-4 text-emerald-500" aria-label={t("On")} /> : <span className="text-xs text-slate-400">—</span>}</td>
                <td className="py-2 flex flex-wrap gap-1.5 justify-end">
                  <button className={btn} disabled={busy || u.id === me?.principal?.id} onClick={() => patch(u, { disabled: !u.disabled })}>{u.disabled ? t("Enable") : t("Disable")}</button>
                  <button className={btn} disabled={busy} title={t("New temporary password and two-factor reset")} onClick={() => run(async () => { const d = await call(`/users/${u.id}/reset`, { method: "POST" }, "Could not reset."); setSecret({ label: `New temporary password for ${u.email}:`, value: d.temporary_password }); })}><RotateCcw className="h-3.5 w-3.5" />{t("Reset")}</button>
                  <button className={`${btn} text-rose-600`} disabled={busy || u.id === me?.principal?.id} onClick={() => { if (window.confirm(t("Delete this user? Their sessions stay, visible to administrators."))) run(() => call(`/users/${u.id}`, { method: "DELETE" }, "Could not delete the user.")); }} aria-label={t("Delete")}><Trash2 className="h-3.5 w-3.5" /></button>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={6} className="py-4 text-sm text-slate-500">{t("No user yet. Add yourself first as owner, then sign in with your email.")}</td></tr>}
          </tbody>
        </table>
      </div>

      {users.length > 1 && (
        <form className={`${card} flex flex-wrap items-end gap-2`} onSubmit={(e) => { e.preventDefault(); run(async () => { await call("/minutes/transfer", json("POST", { from_user: transfer.from || null, to: transfer.to, minutes: Number(transfer.minutes) }), "The transfer failed."); setTransfer({ from: "", to: "", minutes: "" }); }); }} data-testid="transfer-form">
          <p className="basis-full text-sm font-semibold flex items-center gap-2"><ArrowRightLeft className="h-4 w-4 text-emerald-500" />{t("Transfer minutes")}</p>
          <select className={input} value={transfer.from} onChange={(e) => setTransfer({ ...transfer, from: e.target.value })} aria-label={t("From")}>
            <option value="">{t("From: grant new minutes")}</option>
            {users.filter((u) => u.minutes_balance !== null).map((u) => <option key={u.id} value={u.id}>{u.name || u.email} ({u.minutes_balance} min)</option>)}
          </select>
          <select className={input} required value={transfer.to} onChange={(e) => setTransfer({ ...transfer, to: e.target.value })} aria-label={t("To")}>
            <option value="">{t("To…")}</option>
            {users.filter((u) => u.minutes_balance !== null && u.id !== transfer.from).map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
          </select>
          <input type="number" min="1" required className={`${input} w-28`} placeholder="min" value={transfer.minutes} onChange={(e) => setTransfer({ ...transfer, minutes: e.target.value })} />
          <button className={primary} disabled={busy}>{t("Transfer")}</button>
        </form>
      )}
    </div>
  );
}

// Minute packs paid on Stripe's hosted page; the server credits the balance on the webhook.
function BuyMinutes({ user, setError, refreshMe }) {
  const { t } = useLocale();
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState("");
  const paid = new URLSearchParams(window.location.search).get("paid");
  useEffect(() => { call("/billing/packs", {}, "").then(setInfo).catch(() => setInfo(null)); }, []);
  useEffect(() => { if (paid === "1") { const id = setInterval(refreshMe, 3000); const stop = setTimeout(() => clearInterval(id), 30000); return () => { clearInterval(id); clearTimeout(stop); }; } return undefined; }, [paid, refreshMe]);
  if (!info?.enabled || info.unlimited) return null;
  const buy = async (p) => {
    setBusy(p.price_id); setError("");
    try { const d = await call("/billing/checkout", json("POST", { price_id: p.price_id }), "Could not start the payment."); window.location.href = d.url; }
    catch (e) { setError(e.message); setBusy(""); }
  };
  return (
    <section className={`${card} space-y-3`} data-testid="buy-minutes">
      <p className="text-sm font-semibold">{t("Buy minutes")}</p>
      {paid === "1" && <p className="text-sm text-emerald-600" role="status">{t("Thank you! Your minutes are being added; the balance updates within a few seconds.")}</p>}
      {paid === "0" && <p className="text-sm text-slate-500" role="status">{t("Payment cancelled. Nothing was charged.")}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {info.packs.map((p) => (
          <button key={p.price_id} onClick={() => buy(p)} disabled={!!busy} className="rounded-xl border border-slate-300 dark:border-slate-700 p-4 text-left hover:border-emerald-500 disabled:opacity-50" data-testid={`pack-${p.minutes}`}>
            <p className="text-2xl font-extrabold font-mono">{p.minutes} min</p>
            <p className="text-sm text-slate-500">{p.display || t("See price at checkout")}</p>
            <p className="mt-2 text-sm font-semibold text-emerald-600">{busy === p.price_id ? t("Redirecting…") : t("Buy")}</p>
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">{t("Secure payment on Stripe. Minutes are added to your account right after payment.")}</p>
    </section>
  );
}

export function AccountPage({ setError, keys }) {
  const { t } = useLocale();
  const { me, refreshMe } = useAuth();
  const user = me?.user;
  const [name, setName] = useState(user?.name || "");
  const [pw, setPw] = useState({ current: "", next: "" });
  const [msg, setMsg] = useState("");
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [give, setGive] = useState({ to: "", minutes: "" });
  const [colleagues, setColleagues] = useState([]);
  useEffect(() => {
    if (user?.minutes_balance > 0) call("/directory", {}, "").then((d) => setColleagues(d.users || [])).catch(() => setColleagues([]));
  }, [user?.minutes_balance]);
  const run = async (fn, ok) => { setError(""); setMsg(""); try { await fn(); if (ok) setMsg(t(ok)); await refreshMe(); } catch (e) { setError(e.message); } };
  if (!user) {
    return (
      <section className={`${card} space-y-2`}>
        <p className="text-sm">{t("You are signed in with the operator code (owner access). Create user accounts in Users, including one for yourself, to use personal sign-in, two-factor codes and minutes.")}</p>
        {keys}
      </section>
    );
  }
  const startSetup = () => run(async () => {
    const d = await call("/me/2fa/setup", { method: "POST" }, "Could not start two-factor setup.");
    setSetup({ ...d, qr: await QRCode.toDataURL(d.uri, { width: 220, margin: 1 }) });
  });
  return (
    <div className="space-y-4">
      {user.must_change && <p className="rounded-lg bg-amber-500/10 border border-amber-400 p-3 text-sm" role="status">{t("You signed in with a temporary password. Choose your own password below.")}</p>}
      {msg && <p className="text-sm text-emerald-600" role="status">{msg}</p>}
      <section className={`${card} grid grid-cols-1 md:grid-cols-3 gap-4`}>
        <div><p className="text-xs text-slate-500">{t("Email")}</p><p className="font-semibold break-all">{user.email}</p><p className="text-xs text-slate-500 mt-1">{t(ROLE_LABEL[user.role])}</p></div>
        <div><p className="text-xs text-slate-500">{t("Minutes left")}</p><p className="text-2xl font-extrabold font-mono" data-testid="my-minutes">{minutesText(user, t)}</p></div>
        <div><p className="text-xs text-slate-500">{t("Used")}</p><p className="text-2xl font-extrabold font-mono">{user.minutes_used} min</p></div>
      </section>

      <BuyMinutes user={user} setError={setError} refreshMe={refreshMe} />

      <form className={`${card} flex flex-wrap items-end gap-2`} onSubmit={(e) => { e.preventDefault(); run(() => call("/me", json("PATCH", { name }), "Could not save."), "Saved."); }}>
        <label className="text-xs text-slate-500 flex-1 min-w-[12rem]">{t("Display name")}<input className={`${input} w-full mt-1`} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <button className={primary}>{t("Save")}</button>
      </form>

      <form className={`${card} flex flex-wrap items-end gap-2`} onSubmit={(e) => { e.preventDefault(); run(async () => { await call("/me/password", json("POST", { current: pw.current, new: pw.next }), "Could not change the password."); setPw({ current: "", next: "" }); }, "Password changed."); }} data-testid="password-form">
        <p className="basis-full text-sm font-semibold">{t("Password")}</p>
        <input type="password" autoComplete="current-password" placeholder={t("Current password")} className={input} value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
        <input type="password" autoComplete="new-password" required placeholder={t("New password")} className={input} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} data-testid="new-password" />
        <button className={primary}>{t("Change")}</button>
        <p className="basis-full text-xs text-slate-500">{t("At least 10 characters with upper- and lower-case letters and a digit.")}</p>
      </form>

      <section className={`${card} space-y-3`} data-testid="twofa">
        <p className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-500" />{t("Two-factor sign-in")} · {user.totp_enabled ? t("On") : t("Off")}</p>
        {!user.totp_enabled && !setup && <button className={btn} onClick={startSetup} data-testid="twofa-setup"><KeyRound className="h-3.5 w-3.5" />{t("Turn on with an authenticator app")}</button>}
        {setup && (
          <div className="flex flex-wrap gap-4 items-start">
            <img src={setup.qr} alt={t("QR code for the authenticator app")} className="h-44 w-44 rounded-lg bg-white p-2" />
            <div className="space-y-2 text-sm">
              <p>{t("Scan with Google Authenticator, Microsoft Authenticator or 1Password, then enter the 6-digit code.")}</p>
              <p className="font-mono text-xs break-all text-slate-500">{setup.secret}</p>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await call("/me/2fa/enable", json("POST", { code }), "Incorrect code."); setSetup(null); setCode(""); }, "Two-factor sign-in is on."); }}>
                <input inputMode="numeric" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className={`${input} w-32 font-mono`} data-testid="twofa-code" />
                <button className={primary}>{t("Confirm")}</button>
              </form>
            </div>
          </div>
        )}
        {user.totp_enabled && (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await call("/me/2fa/disable", json("POST", { code }), "Incorrect code."); setCode(""); }, "Two-factor sign-in is off."); }}>
            <input inputMode="numeric" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className={`${input} w-32 font-mono`} />
            <button className={btn}>{t("Turn off")}</button>
          </form>
        )}
      </section>

      {user.minutes_balance !== null && user.minutes_balance > 0 && (
        <form className={`${card} flex flex-wrap items-end gap-2`} onSubmit={(e) => { e.preventDefault(); run(async () => { await call("/minutes/transfer", json("POST", { to: give.to, minutes: Number(give.minutes) }), "The transfer failed."); setGive({ to: "", minutes: "" }); }, "Minutes transferred."); }}>
          <p className="basis-full text-sm font-semibold">{t("Give minutes to a colleague")}</p>
          <select required className={`${input} flex-1 min-w-[14rem]`} value={give.to} onChange={(e) => setGive({ ...give, to: e.target.value })} aria-label={t("To")}>
            <option value="">{t("To…")}</option>
            {colleagues.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}
          </select>
          <input type="number" min="1" required placeholder="min" className={`${input} w-28`} value={give.minutes} onChange={(e) => setGive({ ...give, minutes: e.target.value })} />
          <button className={primary}><Plus className="h-4 w-4" />{t("Transfer")}</button>
        </form>
      )}
      {keys}
    </div>
  );
}
