import React from 'react';
import { Link } from 'react-router-dom';
import { AudioLines } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';

export function BrandLogo({ compact = false, to = '/' }) {
  const { t } = useLocale();
  return <Link to={to} className={`tb-brand${compact ? ' tb-brand-compact' : ''}`} aria-label={to === '/' ? `TranslateBox — ${t('Back to home')}` : 'TranslateBox'} title={to === '/' ? t('Back to home') : 'TranslateBox'}>
    <AudioLines aria-hidden="true" />
    <span>Translate<span className="tb-cyan">Box</span><small>{t('LIVE INTERPRETATION')}</small></span>
  </Link>;
}
