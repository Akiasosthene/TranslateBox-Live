import { describe, it, expect } from "vitest";
import { parseCSV, csvObjects, toCSV } from "./csv";
import { SegmentRecorder, toTimedText, withSpeakers } from "./transcript";

describe("csv", () => {
  it("parses quotes, escaped quotes, semicolons and BOM", () => {
    expect(parseCSV('﻿a,b\n"x, y","say ""hi"""\n')).toEqual([["a", "b"], ["x, y", 'say "hi"']]);
    expect(csvObjects("Name;Languages\nCulte;en fr\n")).toEqual([{ name: "Culte", languages: "en fr" }]);
  });
  it("neutralises formulas on export", () => {
    expect(toCSV([["=1+1", "ok"]])).toBe("'=1+1,ok");
  });
});

describe("speaker-aware transcripts", () => {
  it("labels speaker changes and timestamps with an offset", () => {
    let now = 1000;
    const r = new SegmentRecorder(() => now);
    r.delta("Hello", "Ana"); now = 3000; r.end();
    r.delta("Again", "Ana"); now = 5000; r.end();
    now = 65000; r.delta("Bonjour", "Luc"); r.end();
    const segs = r.all();
    expect(withSpeakers(segs).map((s) => s.text)).toEqual(["Ana: Hello", "Again", "Luc: Bonjour"]);
    expect(toTimedText(segs, { offsetMs: 10000 })).toBe("[00:00:10] Ana: Hello\n\n[00:00:12] Again\n\n[00:01:14] Luc: Bonjour");
    expect(r.text()).toContain("Luc: Bonjour");
  });
});
