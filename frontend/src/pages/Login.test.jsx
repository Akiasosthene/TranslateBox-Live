import React from "react";
import { afterEach, test, expect, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Login from "./Login";

afterEach(() => { cleanup(); vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); try { localStorage.clear(); } catch { /* */ } });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const ui = (path = "/login?next=/portal/sessions") => render(
  <MemoryRouter initialEntries={[path]}><Routes><Route path="/login" element={<Login />} /><Route path="/portal/sessions" element={<p>portal page</p>} /><Route path="/present" element={<p>present page</p>} /></Routes></MemoryRouter>);

test("email sign-in asks for the two-factor code, then opens the requested page", async () => {
  let step = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opts) => {
    if (url.endsWith("/auth/sso")) return json({ enabled: false });
    if (url.endsWith("/auth/login")) {
      const body = JSON.parse(opts.body);
      step += 1;
      return body.code ? json({ token: "tbs_abc" }) : json({ detail: "Enter the code", totp_required: true }, 401);
    }
    if (url.endsWith("/me")) return json({ principal: { id: "u1", role: "presenter" }, user: { email: "a@b.org" } });
    return json({}, 404);
  });
  ui();
  fireEvent.change(screen.getByTestId("login-email"), { target: { value: "a@b.org" } });
  fireEvent.change(screen.getByTestId("login-password"), { target: { value: "Secret2026x" } });
  fireEvent.click(screen.getByTestId("login-submit"));
  fireEvent.change(await screen.findByTestId("login-code"), { target: { value: "123456" } });
  fireEvent.click(screen.getByTestId("login-submit"));
  await screen.findByText("portal page");
  expect(step).toBe(2);
  expect(localStorage.getItem("tbl-session")).toBe("tbs_abc");
});

test("operator code sign-in is never stored and SSO errors are shown", async () => {
  window.history.replaceState(null, "", "/login#sso_error=This+account+is+not+allowed");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opts) => {
    if (url.endsWith("/auth/sso")) return json({ enabled: true, label: "Microsoft" });
    if (url.endsWith("/me")) return opts.headers.Authorization === "Bearer good-code-0123456789012345678901234" ? json({ principal: { id: "owner", role: "owner" }, user: null }) : json({}, 401);
    return json({}, 404);
  });
  ui("/login");
  await waitFor(() => expect(screen.getByTestId("sso-button").getAttribute("href")).toBe("/api/auth/sso/start"));
  expect(screen.getByText(/not allowed/)).toBeTruthy();
  fireEvent.click(screen.getByTestId("login-mode-code"));
  fireEvent.change(document.getElementById("operator-token"), { target: { value: "good-code-0123456789012345678901234" } });
  fireEvent.click(screen.getByTestId("login-submit"));
  await screen.findByText("present page");
  expect(localStorage.getItem("tbl-session")).toBe(null);
});
