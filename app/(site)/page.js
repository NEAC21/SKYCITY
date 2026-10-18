'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/AppProvider';
import { api, todayStr, addDays } from '@/lib/client';
import { parseMap } from '@/lib/map';

const Ico = ({ children }) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
const Fork = () => <Ico><path d="M7 3v7M11 3v7M7 10a2 2 0 0 0 4 0M9 12v9M17 3c-2 2-3 5-3 8h3v10" /></Ico>;
const Cup = () => <Ico><path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8zM17 9h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2" /></Ico>;
const Check = () => <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor" /><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#1a1200" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;

function Gallery({ photos, alt, badge }) {
  const [i, setI] = useState(0);
  return (
    <div className="gal">
      {photos?.length ? <img src={photos[i]} alt={alt} loading="lazy" /> : <div className="ph" aria-hidden="true">{(alt || '?')[0]}</div>}
      {badge && <span className="badge">{badge}</span>}
      {photos?.length > 1 && (
        <div className="thumbs">
          {photos.map((p, k) => <button key={p} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`Photo ${k + 1}`}><img src={p} alt="" /></button>)}
        </div>
      )}
    </div>
  );
}

function Inquiry({ onClose }) {
  const { t } = useApp();
  const [f, setF] = useState({ name: '', phone: '', email: '', eventType: '', eventDate: '', guests: '', message: '', website: '' });
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api('/api/inquiries', { method: 'POST', body: f }); setDone(true); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <div className="modal" onClick={onClose}>
      <div className="card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 16 }}>{t('inq_title')}</h3>
        {done ? <><p className="ok">{t('inq_done')}</p><button className="btn" onClick={onClose}>{t('close')}</button></> : (
          <form onSubmit={submit}>
            <input name="website" value={f.website} onChange={set('website')} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }} />
            <div className="field"><label>{t('inq_name')}</label><input required value={f.name} onChange={set('name')} autoComplete="name" /></div>
            <div className="inline">
              <div className="field"><label>{t('phone')}</label><input type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" /></div>
              <div className="field"><label>{t('email')}</label><input type="email" value={f.email} onChange={set('email')} autoComplete="email" /></div>
            </div>
            <div className="field"><label>{t('inq_type')}</label><input value={f.eventType} onChange={set('eventType')} /></div>
            <div className="inline">
              <div className="field"><label>{t('inq_date')}</label><input type="date" min={todayStr()} value={f.eventDate} onChange={set('eventDate')} /></div>
              <div className="field"><label>{t('inq_guests')}</label><input type="number" min="1" value={f.guests} onChange={set('guests')} /></div>
            </div>
            <div className="field"><label>{t('inq_msg')}</label><textarea value={f.message} onChange={set('message')} /></div>
            {err && <p className="err">{err}</p>}
            <div className="pillrow"><button className="btn" disabled={busy}>{busy ? t('loading') : t('inq_send')}</button><button type="button" className="btn ghost" onClick={onClose}>{t('close')}</button></div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const { t, tr, c, settings } = useApp();
  const [inD, setIn] = useState(''), [outD, setOut] = useState(''), [guests, setGuests] = useState(2);
  const [types, setTypes] = useState(null), [searched, setSearched] = useState(false), [err, setErr] = useState(''), [minPrice, setMin] = useState(null), [inq, setInq] = useState(false);
  const today = todayStr();
  const map = parseMap(settings.map_url, settings.address);
  const load = async (q = '', first = false) => {
    try {
      const d = await api('/api/availability' + q); setTypes(d.types);
      if (first) { const p = d.types.map((x) => Number(x.price_per_night)).filter((n) => n > 0); setMin(p.length ? Math.min(...p) : null); }
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load('', true); }, []);
  const search = async (e) => {
    e.preventDefault(); setErr('');
    if (!inD || !outD || outD <= inD) { setErr(t('pick_dates')); return; }
    await load(`?in=${inD}&out=${outD}&guests=${guests}`); setSearched(true);
    document.getElementById('rooms')?.scrollIntoView({ behavior: 'smooth' });
  };
  const onIn = (v) => { setIn(v); if (!outD || outD <= v) setOut(addDays(v, 1)); };
  const focusDock = () => { document.getElementById('dock')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => document.getElementById('ci')?.focus(), 400); };
  const bg = settings.hero_image ? { backgroundImage: `url(${settings.hero_image})` } : undefined;
  const dining = (settings.content?.dining_photos || []).slice(0, 4);
  const hall = (settings.content?.events_photos || []).slice(0, 3);

  return (
    <>
      <section id="hero" className="hero" style={bg}>
        <div className="wrap">
          <span className="pill">★ {c('hero_badge')}</span>
          <h1>{c('hero_title1')}<br /><span className="grad">{c('hero_title2')}</span></h1>
          <p>{c('hero_text')}</p>
          <button className="btn big" onClick={focusDock}>{minPrice ? t('book_from', { price: `ETB ${minPrice.toLocaleString()}` }) : t('search')} →</button>
          <form id="dock" className="dock" onSubmit={search}>
            <div><label htmlFor="ci">{t('check_in')}</label><input id="ci" type="date" min={today} value={inD} onChange={(e) => onIn(e.target.value)} /></div>
            <div><label htmlFor="co">{t('check_out')}</label><input id="co" type="date" min={inD ? addDays(inD, 1) : today} value={outD} onChange={(e) => setOut(e.target.value)} /></div>
            <div><label htmlFor="gs">{t('guests')}</label><select id="gs" value={guests} onChange={(e) => setGuests(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}</select></div>
            <button className="btn">{t('search')}</button>
          </form>
        </div>
      </section>

      <div className="wrap">
        {err && <p className="err">{err}</p>}
        <section id="rooms" className="sec center">
          <h2>{c('rooms_title')}</h2>
          <p className="lead">{c('rooms_text')}</p>
          {!types && <p className="muted" style={{ marginTop: 24 }}>{t('loading')}</p>}
          {types && searched && !types.some((x) => x.available > 0) && <p style={{ marginTop: 24 }}>{t('no_rooms')}</p>}
          <div className="rooms" style={{ textAlign: 'left' }}>
            {(types || []).map((r) => {
              const n = r.available;
              const q = `?type=${r.id}&in=${inD}&out=${outD}&guests=${guests}`;
              return (
                <article className="room" key={r.id}>
                  <Gallery photos={r.photos} alt={tr(r.name)} badge={tr(r.badge)} />
                  <div className="body">
                    <h3>{tr(r.name)}</h3>
                    <p className="desc">{tr(r.description)}</p>
                    <div className="chips">
                      <span className="chip">{t('capacity', { n: r.capacity })}</span>
                      {(r.amenities || []).map((a) => <span className="chip" key={a}>{a}</span>)}
                    </div>
                    <div className="row">
                      <div className="price">{Number(r.price_per_night).toLocaleString()} ETB <small>/ {t('night')}</small></div>
                      {searched && n !== null && (n > 0
                        ? <span className={'tag' + (n <= 2 ? ' low' : '')}>{t('left', { n })}</span>
                        : <span className="tag out">{t('sold_out')}</span>)}
                    </div>
                    {searched && n > 0
                      ? <Link className="btn" href={'/book' + q}>{t('book_now')}</Link>
                      : !searched ? <button className="btn ghost" onClick={focusDock}>{t('pick_dates')}</button> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section id="dining" className="sec">
          <span className="label">{c('dining_label')}</span>
          <h2>{c('dining_title')}</h2>
          <p className="lead" style={{ marginTop: 14 }}>{c('dining_text')}</p>
          <div className="feats">
            <div className="feat"><Fork /><b>{c('dining_c1_title')}</b><small>{c('dining_c1_sub')}</small></div>
            <div className="feat"><Cup /><b>{c('dining_c2_title')}</b><small>{c('dining_c2_sub')}</small></div>
          </div>
          {dining.length > 0 && <div className="dphotos">{dining.map((p) => <img key={p} src={p} alt="" loading="lazy" />)}</div>}
        </section>

        <section id="events" className="sec">
          <div className={'events' + (hall.length ? '' : ' solo')}>
            <div className="txt">
              <span className="label">{c('events_label')}</span>
              <h2>{c('events_title')}</h2>
              <p className="lead" style={{ marginTop: 14 }}>{c('events_text')}</p>
              <ul className="bul"><li><Check />{c('events_b1')}</li><li><Check />{c('events_b2')}</li></ul>
              <button className="link" onClick={() => setInq(true)}>{c('events_cta')} →</button>
            </div>
            {hall.length > 0 && <div className={'collage' + (hall.length === 1 ? ' one' : '')}>{hall.map((p) => <img key={p} src={p} alt="" loading="lazy" />)}</div>}
          </div>
        </section>

        <section id="contact" className="sec">
          <h2>{t('contact_title')}</h2>
          <div className="contact">
            <div className="card">
              {settings.address && <p style={{ marginTop: 0 }}>{settings.address}</p>}
              {settings.phone && <p><a className="btn" href={`tel:${settings.phone}`}>☎ {t('call_us')}: {settings.phone}</a></p>}
              {settings.email && <p><a href={`mailto:${settings.email}`}>{settings.email}</a></p>}
              <p className="note">{t('check_in')} {settings.check_in_time} · {t('check_out')} {settings.check_out_time}</p>
            </div>
            {map && (
              <div>
                {map.embed && <iframe src={map.embed} loading="lazy" title="Map" />}
                {map.open && <p><a className="btn ghost" href={map.open} target="_blank" rel="noopener noreferrer">{t('directions')}</a></p>}
              </div>)}
          </div>
        </section>
      </div>
      {inq && <Inquiry onClose={() => setInq(false)} />}
    </>
  );
}
