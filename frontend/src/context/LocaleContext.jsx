import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { messages } from '../lib/messages';
import { attendeeMessages } from '../lib/messagesAttendee';

export const SUPPORTED_LANGUAGES = ['fr', 'en', 'es', 'pt', 'de'];
// App screens are translated in French and English; other languages fall back to English there.
const translate = (language, text) => attendeeMessages[text]?.[language] ?? messages[text]?.[language] ?? messages[text]?.en ?? text;
const initialLanguage = () => {
  try {
    const saved = localStorage.getItem('tbl-ui-language');
    if (SUPPORTED_LANGUAGES.includes(saved)) return saved;
  } catch { /* Storage can be disabled. */ }
  const browser = (typeof navigator !== 'undefined' && navigator.language || 'en').slice(0, 2).toLowerCase();
  return SUPPORTED_LANGUAGES.includes(browser) ? browser : 'en';
};
const LocaleContext = createContext({ language: 'en', setLanguage: () => {}, t: text => translate('en', text) });
export const useLocale = () => useContext(LocaleContext);

export function LocaleProvider({ children }) {
  const [language, setLanguage] = useState(initialLanguage);
  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem('tbl-ui-language', language); } catch { /* Storage can be disabled. */ }
  }, [language]);
  const t = useCallback(text => translate(language, text), [language]);
  return <LocaleContext.Provider value={{ language, setLanguage, t }}>{children}</LocaleContext.Provider>;
}
