import React, { useEffect, useRef, useState } from "react";
import { STAGE_LINES } from "./content";

const OUTS = [["fr", "FR"], ["es", "ES"], ["sw", "SW"], ["ar", "AR"]];
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Hero illustration: the speaker's sentence appears word by word, then each
// language "types" its interpretation, like the real captions.
export function LiveStage({ speakerLabel = "Speaker · English", phoneLabel = "Your phone" }) {
  const [line, setLine] = useState(0);
  const [progress, setProgress] = useState(reduced() ? 1 : 0);
  const raf = useRef(0);
  useEffect(() => {
    if (reduced()) return undefined;
    let start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / 4200);
      setProgress(p);
      if (now - start > 6500) { start = now; setLine((l) => (l + 1) % STAGE_LINES.length); setProgress(0); }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);
  const item = STAGE_LINES[line];
  const words = item.src.split(" ");
  const spoken = words.slice(0, Math.ceil(words.length * Math.min(1, progress * 1.6))).join(" ");
  const part = (text, delay) => {
    const p = Math.max(0, Math.min(1, (progress - delay) / (1 - delay)));
    return text.slice(0, Math.round(text.length * p));
  };
  const typing = progress < 1;
  return (
    <div className="ts-stage" aria-hidden="true">
      <div className="ts-stage-card">
        <div className="ts-stage-top"><span className="ts-live"><i />LIVE</span><span>TranslateBox · 5 languages · 214 listeners</span></div>
        <div className="ts-speaker">
          <small>{speakerLabel}</small>
          <p>{spoken}</p>
          <div className="ts-wave">{Array.from({ length: 42 }, (_, i) => <i key={i} style={{ animationDelay: `${(i * 73) % 900}ms`, height: `${30 + ((i * 37) % 70)}%` }} />)}</div>
        </div>
        <div className="ts-outs">
          {OUTS.map(([code, label], i) => {
            const text = part(item.out[code], 0.2 + i * 0.08);
            return <div className="ts-out" key={code}><b>{label}</b><p dir={code === "ar" ? "rtl" : "ltr"}>{text}{typing && text.length < item.out[code].length && <span className="ts-caret" />}</p></div>;
          })}
        </div>
      </div>
      <div className="ts-phone">
        <small>{phoneLabel}</small>
        <strong>Sunday celebration</strong>
        <span className="ts-chip">EN</span><span className="ts-chip on">FR</span><span className="ts-chip">SW</span>
        <p>{part(item.out.fr, 0.2)}</p>
      </div>
    </div>
  );
}
