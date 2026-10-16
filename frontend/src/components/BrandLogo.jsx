import React from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { SyntoniaMark } from './SyntoniaMark';

export function BrandLogo({ compact = false, to = '/' }) {
  const { t } = useLocale();
  return <Link to={to} className={`tb-brand${compact ? ' tb-brand-compact' : ''}`} aria-label={to === '/' ? `Syntonia Live — ${t('Back to home')}` : 'Syntonia Live'} title={to === '/' ? t('Back to home') : 'Syntonia Live'}>
    <SyntoniaMark />
    <span>syntonia<span className="tb-cyan tb-live">live</span><small>{t('LIVE INTERPRETATION')}</small></span>
  </Link>;
}
