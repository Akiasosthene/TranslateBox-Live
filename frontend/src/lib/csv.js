// Minimal RFC 4180 CSV: quoted fields, "" escapes, comma or semicolon.
export function parseCSV(text) {
  const src = String(text || "").replace(/^﻿/, "");
  const first = src.split(/\r?\n/, 1)[0] || "";
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === sep) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

// Rows → objects keyed by lower-case header.
export function csvObjects(text) {
  const [head, ...rows] = parseCSV(text);
  if (!head) return [];
  const keys = head.map((h) => h.trim().toLowerCase());
  return rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] || "").trim()])));
}

const cell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formulas in exported text.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
export const toCSV = (rows) => rows.map((r) => r.map(cell).join(",")).join("\r\n");
