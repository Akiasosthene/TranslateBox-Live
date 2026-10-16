import { API, setOperatorToken } from "./api";

// Sign-in sessions (tbs_…) are kept across reloads; they expire on the server
// and can be revoked. The operator code is never stored.
const KEY = "tbl-session";
let token = "";

export function currentToken() { return token; }
export function applyToken(value, { remember = false } = {}) {
  token = value || "";
  setOperatorToken(token);
  try {
    if (remember && token.startsWith("tbs_")) localStorage.setItem(KEY, token);
    else if (!token) localStorage.removeItem(KEY);
  } catch { /* storage may be disabled */ }
}
export function storedToken() { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } }

export async function fetchMe(value = token) {
  const res = await fetch(`${API}/me`, { headers: { Authorization: `Bearer ${value}` } });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(res.status === 503 ? "Operator access unavailable. Check server configuration or try again shortly." : "The server could not be reached. Try again.");
  return res.json();
}

export async function signOut() {
  const value = token;
  applyToken("");
  try { localStorage.removeItem(KEY); } catch { /* optional */ }
  if (value.startsWith("tbs_")) await fetch(`${API}/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${value}` } }).catch(() => {});
}

export async function passwordLogin({ email, password, code }) {
  const res = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, code: code || null }) });
  const body = await res.json().catch(() => ({}));
  if (res.ok) return { token: body.token };
  if (body.totp_required) return { totpRequired: true };
  throw new Error(typeof body.detail === "string" ? body.detail : res.status === 429 ? "Too many sign-in attempts. Wait a minute." : "Sign-in failed. Try again.");
}

export const ROLE_LABEL = { owner: "Owner", admin: "Administrator", presenter: "Presenter" };
export const isAdmin = (me) => ["owner", "admin"].includes(me?.principal?.role);
