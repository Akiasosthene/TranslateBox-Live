import React from "react";

// Brand motif: three lines that start apart and settle on one wave.
const path = (offset, phase) => {
  let d = "";
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    const x = t * 1440;
    const conv = Math.pow(1 - Math.min(t / 0.75, 1), 1.8);
    const y = 160 + offset * conv + 38 * (0.4 + 0.6 * Math.min(t / 0.6, 1)) * Math.sin(Math.PI * 2 * 2 * t + phase * conv);
    d += `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d;
};
const LINES = [[-90, 1.2, "#7DD3FC"], [0, 0, "#1A73E8"], [90, -1.2, "#38BDF8"]];

export function Waves({ className = "" }) {
  return (
    <svg className={`ts-waves ${className}`} viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true">
      {LINES.map(([o, p, c], i) => <path key={i} d={path(o, p)} stroke={c} className={`w${i}`} />)}
    </svg>
  );
}
