import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Join from "./Join";

afterEach(() => vi.restoreAllMocks());

describe("Join", () => {
  it("resolves a session code to the listener page", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "ev123" }), { status: 200 }));
    render(<MemoryRouter initialEntries={["/join"]}><Routes><Route path="/join" element={<Join />} /><Route path="/e/:id" element={<p>listener page</p>} /></Routes></MemoryRouter>);
    fireEvent.change(screen.getByTestId("join-code-input"), { target: { value: "abcd-1234" } });
    fireEvent.click(screen.getByTestId("join-submit"));
    await waitFor(() => expect(screen.getByText("listener page")).toBeTruthy());
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/join\/ABCD1234$/);
  });
  it("shows an error for an unknown code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 404 }));
    render(<MemoryRouter><Join /></MemoryRouter>);
    fireEvent.change(screen.getByTestId("join-code-input"), { target: { value: "ZZZZ9999" } });
    fireEvent.click(screen.getByTestId("join-submit"));
    expect((await screen.findByTestId("join-error")).textContent).toMatch(/No session/);
  });
});
