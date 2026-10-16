import React from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { SyntoniaMark } from './SyntoniaMark';

export function BrandLogo({ compact = false, to = '/' }) {
  const { t } = useLocale();
  return <Link to={to} className={`tb-brand${compact ? ' tb-brand-compact' : ''}`} aria-label={to === '/' ? `Syntonia — ${t('Back to home')}` : 'Syntonia'} title={to === '/' ? t('Back to home') : 'Syntonia'}>
    <SyntoniaMark />
    <span>synton<span className="tb-cyan">ia</span><small>{t('LIVE INTERPRETATION')}</small></span>
  </Link>;
}
