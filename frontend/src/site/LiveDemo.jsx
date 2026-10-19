import React, { useEffect, useRef, useState } from "react";
import { useLocale } from "../context/LocaleContext";

// Animated hero demo: one sentence from the speaker, typed as it is heard,
// then the same sentence appearing in three listener languages.
const LINES = [
  { en: "Welcome everyone to our annual conference.", fr: "Bienvenue à tous à notre conférence annuelle.", es: "Bienvenidos todos a nuestra conferencia anual.", pt: "Bem-vindos à nossa conferência anual.", de: "Willkommen zu unserer Jahreskonferenz." },
  { en: "Today we will share our plans for next year.", fr: "Aujourd'hui, nous partageons nos projets pour l'an prochain.", es: "Hoy compartiremos nuestros planes para el próximo año.", pt: "Hoje vamos compartilhar os nossos planos para o próximo ano.", de: "Heute stellen wir unsere Pläne für das nächste Jahr vor." },
  { en: "Questions are welcome at the end of each session.", fr: "Les questions sont les bienvenues à la fin de chaque séance.", es: "Las preguntas son bienvenidas al final de cada sesión.", pt: "As perguntas são bem-vindas no final de cada sessão.", de: "Fragen sind am Ende jeder Sitzung willkommen." },
];
const FLAGS = { en: "🇬🇧", fr: "🇫🇷", es: "🇪🇸", pt: "🇧🇷", de: "🇩🇪" };
const NAMES = { en: "English", fr: "Français", es: "Español", pt: "Português", de: "Deutsch" };
const LABELS = {
  fr: { live: "En direct", speaker: "Orateur", listeners: "auditeurs", title: "Conférence annuelle 2026" },
  en: { live: "Live", speaker: "Speaker", listeners: "listeners", title: "Annual conference 2026" },
  es: { live: "En directo", speaker: "Orador", listeners: "oyentes", title: "Conferencia anual 2026" },
  pt: { live: "Ao vivo", speaker: "Orador", listeners: "ouvintes", title: "Conferência anual 2026" },
  de: { live: "Live", speaker: "Sprecher", listeners: "Zuhörer", title: "Jahreskonferenz 2026" },
};

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function LiveDemo() {
  const { language } = useLocale();
  const l = LABELS[language] || LABELS.en;
  // The speaker talks in English; show the visitor's language first.
  const targets = [language === "en" ? "fr" : language, ...["es", "de", "pt", "fr"].filter((x) => x !== language && x !== "en")].slice(0, 3);
  const [line, setLine] = useState(0);
  const [typed, setTyped] = useState(reduced() ? LINES[0].en.length : 0);
  const [shown, setShown] = useState(reduced() ? 3 : 0);
  const [count, setCount] = useState(128);
  const timers = useRef([]);

  useEffect(() => {
    if (reduced()) return undefined;
    const text = LINES[line].en;
    const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms));
    setTyped(0); setShown(0);
    for (let i = 1; i <= text.length; i++) at(i * 38, () => setTyped(i));
    const done = text.length * 38;
    [0, 1, 2].forEach((k) => at(done + 350 + k * 380, () => setShown(k + 1)));
    at(done + 4200, () => { setLine((n) => (n + 1) % LINES.length); setCount((c) => c + 3 + Math.floor(Math.random() * 5)); });
    return clear;
  }, [line]);

  const text = LINES[line].en;
  return (
    <div className="ld" aria-hidden="true">
      <div className="ld-top">
        <span className="ld-live"><i />{l.live}</span>
        <span className="ld-title">{l.title}</span>
        <span className="ld-count">{count} {l.listeners}</span>
      </div>
      <div className="ld-speaker">
        <div className="ld-wave">{Array.from({ length: 18 }, (_, i) => <b key={i} style={{ animationDelay: `${(i % 6) * 0.11}s` }} />)}</div>
        <div>
          <small>{l.speaker} · {FLAGS.en} English</small>
          <p>{text.slice(0, typed)}<span className="ld-caret" /></p>
        </div>
      </div>
      <ul className="ld-rows">
        {targets.map((code, k) => (
          <li key={code} className={shown > k ? "on" : ""}>
            <span className="ld-lang">{FLAGS[code]} {NAMES[code]}</span>
            <p>{LINES[line][code]}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
