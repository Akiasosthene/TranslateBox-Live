import React from 'react';
import { useLocale } from '../context/LocaleContext';

const NAMES = [['fr', 'Français'], ['en', 'English'], ['es', 'Español'], ['pt', 'Português'], ['de', 'Deutsch']];

export function InterfaceLanguage() {
  const { language, setLanguage, t } = useLocale();
  return <select className="tb-interface-language" aria-label={t('Interface language')} value={language} onChange={event => setLanguage(event.target.value)}>
    {NAMES.map(([code, name]) => <option key={code} value={code} lang={code}>{name}</option>)}
  </select>;
}
