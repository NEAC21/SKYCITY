'use client';
import Link from 'next/link';
import { useApp } from './AppProvider';
export function LangSwitch() {
  const { lang, setLang } = useApp();
  return (
    <div className="lang" role="group" aria-label="Language">
      {[['en', 'EN'], ['am', 'አማ'], ['om', 'OM']].map(([k, l]) => (
        <button key={k} className={lang === k ? 'on' : ''} onClick={() => setLang(k)} aria-pressed={lang === k}>{l}</button>
      ))}
    </div>
  );
}
export default function SiteChrome({ children }) {
  const { t, settings } = useApp();
  return (
    <>
      <header className="hdr"><div className="wrap">
        <Link href="/" className="brand">
          {settings.logo && <img className="logo-img" src={settings.logo} alt="" />}
          <span><b>{settings.name}</b>{settings.name_local && <small>{settings.name_local}</small>}</span>
        </Link>
        <nav className="nav">
          <Link href="/#hero">{t('nav_overview')}</Link>
          <Link href="/#rooms">{t('nav_rooms')}</Link>
          <Link href="/#dining">{t('nav_dining')}</Link>
          <Link href="/#events">{t('nav_events')}</Link>
          <Link href="/meetings">{t('nav_meetings')}</Link>
          <Link href="/booking">{t('nav_booking')}</Link>
          <LangSwitch />
          {settings.phone && <a className="btn sm" href={`tel:${settings.phone}`}>☎ {t('call_reception')}</a>}
        </nav>
      </div></header>
      {children}
      <footer className="ftr"><div className="wrap">© {new Date().getFullYear()} {settings.name}. {t('footer_rights')}</div></footer>
    </>
  );
}
