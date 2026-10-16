// "Complete phrases only": hide the sentence still being spoken.
export function completeOnly(text) {
  const t = String(text || "");
  const m = t.match(/^[\s\S]*(?:[.!?…؟।]["»”’)]?(?=\s|$)|[。！？]|\n\n)/u);
  return m ? m[0].trimEnd() : "";
}
