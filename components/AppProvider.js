'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { DICT } from '@/lib/i18n';
const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);
export function AppProvider({ settings, children }) {
  const [lang, setLangState] = useState('en');
  useEffect(() => { const l = localStorage.getItem('lang'); if (l && DICT[l]) setLangState(l); }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = (l) => { setLangState(l); localStorage.setItem('lang', l); };
  const t = (k, v = {}) => {
    let s = (DICT[lang] && DICT[lang][k]) || DICT.en[k] || k;
    for (const x in v) s = s.split(`{${x}}`).join(String(v[x]));
    return s;
  };
  const tr = (o) => (o && (o[lang] || o.en)) || '';
  // Editable website text: the admin's text for this language, else the built-in default.
  const c = (k) => {
    const o = settings.content?.[k];
    const own = o && typeof o[lang] === 'string' && o[lang].trim();
    const s = own || (DICT[lang] && DICT[lang]['c_' + k]) || DICT.en['c_' + k] || '';
    return s.split('{name}').join(settings.name);
  };
  return <Ctx.Provider value={{ lang, setLang, t, tr, c, settings }}>{children}</Ctx.Provider>;
}
