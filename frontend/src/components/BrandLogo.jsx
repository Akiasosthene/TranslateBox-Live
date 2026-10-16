import React from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { SyntovaMark } from './SyntovaMark';

export function BrandLogo({ compact = false, to = '/' }) {
  const { t } = useLocale();
  return <Link to={to} className={`tb-brand${compact ? ' tb-brand-compact' : ''}`} aria-label={to === '/' ? `Syntova — ${t('Back to home')}` : 'Syntova'} title={to === '/' ? t('Back to home') : 'Syntova'}>
    <SyntovaMark />
    <span>synt<span className="tb-cyan">ova</span><small>{t('LIVE INTERPRETATION')}</small></span>
  </Link>;
}
