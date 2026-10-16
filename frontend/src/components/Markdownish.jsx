import React from "react";

// Minimal, safe rendering of the summary's Markdown (headings, bullets, bold).
export function Markdownish({ text, className = "text-slate-800 dark:text-slate-100" }) {
  const inline = (line) => line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <React.Fragment key={i}>{part}</React.Fragment>);
  const blocks = [];
  let list = null;
  text.split("\n").forEach((raw, i) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    if (bullet) { (list ||= []).push(<li key={i}>{inline(bullet[1])}</li>); return; }
    if (list) { blocks.push(<ul key={`l${i}`} className="list-disc pl-5 space-y-1">{list}</ul>); list = null; }
    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) blocks.push(<h3 key={i} className="font-bold text-sm mt-2">{inline(h[1])}</h3>);
    else if (line.trim()) blocks.push(<p key={i}>{inline(line)}</p>);
  });
  if (list) blocks.push(<ul key="lend" className="list-disc pl-5 space-y-1">{list}</ul>);
  return <div className={`text-sm leading-relaxed space-y-2 ${className}`}>{blocks}</div>;
}
