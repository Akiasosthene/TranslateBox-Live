import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Headphones } from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { InterfaceLanguage } from "../components/InterfaceLanguage";
import { API } from "../lib/api";

// Attendees type the short session code shown on the room screen (e.g.
// ABCD1234) instead of scanning the QR code.
export default function Join() {
  const { t } = useLocale();
  const { code: fromUrl } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(fromUrl || "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async (value) => {
    const clean = String(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length < 4) { setErr("Enter the session code."); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch(`${API}/join/${encodeURIComponent(clean)}`);
      if (res.status === 404) throw new Error("No session with this code.");
      if (res.status === 429) throw new Error("Too many attempts. Wait a minute.");
      if (!res.ok) throw new Error("The session could not be found. Try again.");
      const { id } = await res.json();
      navigate(`/e/${id}`, { replace: true });
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  useEffect(() => { if (fromUrl) go(fromUrl); }, [fromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const pretty = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex justify-center px-5 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="flex items-center justify-between">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-emerald-400 flex items-center gap-2"><Headphones className="h-4 w-4" />TranslateBox</p>
          <InterfaceLanguage />
        </div>
        <h1 className="text-3xl font-extrabold">{t("Join a session")}</h1>
        <form onSubmit={(e) => { e.preventDefault(); go(code); }} className="space-y-4">
          <label className="block text-sm text-slate-300">{t("Session code")}
            <input value={pretty.length > 4 ? `${pretty.slice(0, 4)}-${pretty.slice(4)}` : pretty} onChange={(e) => setCode(e.target.value)}
              autoFocus autoCapitalize="characters" autoComplete="off" spellCheck={false} inputMode="text" data-testid="join-code-input"
              placeholder="ABCD-1234" className="mt-2 w-full h-16 rounded-2xl bg-white/5 border border-white/15 px-5 text-3xl text-center font-mono tracking-[0.25em] uppercase" />
          </label>
          {err && <p role="alert" className="text-rose-300 text-sm" data-testid="join-error">{t(err)}</p>}
          <button disabled={busy} className="w-full h-14 rounded-2xl bg-emerald-500 text-[#04131F] font-extrabold text-lg disabled:opacity-50" data-testid="join-submit">{busy ? t("Connecting…") : t("Join")}</button>
        </form>
        <p className="text-sm text-slate-500">{t("The code is shown on the room screen and given by the organizer.")}</p>
      </div>
    </div>
  );
}
