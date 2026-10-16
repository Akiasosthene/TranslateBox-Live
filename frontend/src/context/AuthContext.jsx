import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { currentToken, fetchMe, signOut as doSignOut, storedToken, applyToken } from "../lib/auth";

const AuthCtx = createContext({ me: null, refreshMe: async () => {}, signOut: async () => {} });
export const useAuth = () => useContext(AuthCtx);

// Gate for the operator app: restores a remembered session, otherwise sends
// the person to /login and back to the page they wanted.
export function AuthGate({ children }) {
  const location = useLocation();
  const [state, setState] = useState({ loading: true, me: null, error: "" });
  const load = useCallback(async () => {
    let value = currentToken();
    if (!value) { value = storedToken(); if (value) applyToken(value); }
    if (!value) return setState({ loading: false, me: null, error: "" });
    try {
      const me = await fetchMe(value);
      if (!me) { applyToken(""); return setState({ loading: false, me: null, error: "" }); }
      setState({ loading: false, me, error: "" });
    } catch (e) { setState({ loading: false, me: null, error: e.message }); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const signOut = useCallback(async () => { await doSignOut(); setState({ loading: false, me: null, error: "" }); }, []);
  if (state.loading) return <div className="min-h-screen bg-[#0A0D14]" aria-busy="true" />;
  if (!state.me) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}${state.error ? `&e=${encodeURIComponent(state.error)}` : ""}`} replace />;
  }
  return <AuthCtx.Provider value={{ me: state.me, refreshMe: load, signOut }}>{children}</AuthCtx.Provider>;
}
