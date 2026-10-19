'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/AppProvider';
import { api, todayStr } from '@/lib/client';

const hhmm = (s) => String(s).slice(0, 5);

function Photo({ photos, alt }) {
  const [i, setI] = useState(0);
  return (
    <div className="gal">
      {photos?.length ? <img src={photos[i]} alt={alt} loading="lazy" /> : <div className="ph" aria-hidden="true">{(alt || '?')[0]}</div>}
      {photos?.length > 1 && <div className="thumbs">{photos.map((p, k) => <button key={p} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`Photo ${k + 1}`}><img src={p} alt="" /></button>)}</div>}
    </div>
  );
}

export default function Meetings() {
  const { t, tr } = useApp();
  const [date, setDate] = useState(''), [rooms, setRooms] = useState(null), [pick, setPick] = useState({}), [err, setErr] = useState('');
  useEffect(() => {
    api('/api/meetings' + (date ? `?date=${date}` : '')).then((d) => { setRooms(d.rooms); setPick({}); setErr(''); }).catch((e) => setErr(e.message));
  }, [date]);
  return (
    <div className="wrap" style={{ paddingTop: 44 }}>
      <h2 style={{ fontSize: 'clamp(28px,4.6vw,42px)' }}>{t('mt_title')}</h2>
      <p className="muted" style={{ fontSize: 18, maxWidth: '60ch' }}>{t('mt_text')}</p>
      <div className="card" style={{ maxWidth: 360, margin: '22px 0' }}>
        <label htmlFor="md" style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>{t('mt_date')}</label>
        <input id="md" type="date" min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {err && <p className="err">{err}</p>}
      {!rooms ? <p className="muted">{t('loading')}</p> : rooms.length === 0 ? <p>{t('mt_none')}</p> : (
        <div className="rooms" style={{ marginTop: 10 }}>
          {rooms.map((r) => (
            <article className="room" key={r.id}>
              <Photo photos={r.photos} alt={tr(r.name)} />
              <div className="body">
                <h3>{tr(r.name)}</h3>
                <p className="desc">{tr(r.description)}</p>
                <div className="chips"><span className="chip">{t('mt_capacity', { n: r.capacity })}</span>{(r.amenities || []).map((a) => <span className="chip" key={a}>{a}</span>)}</div>
                <b style={{ marginTop: 6 }}>{date ? t('mt_pick_slot') : t('mt_choose_date')}</b>
                <div className="slots">
                  {r.slots.map((s) => (
                    <button key={s.id} className={'slot' + (pick[r.id] === s.id ? ' on' : '')} disabled={!date || !s.available} onClick={() => setPick({ ...pick, [r.id]: s.id })}>
                      <b>{tr(s.name)}</b>
                      <small>{hhmm(s.start_time)}–{hhmm(s.end_time)} · {Number(s.price).toLocaleString()} ETB{date && !s.available ? ` · ${t('mt_taken')}` : ''}</small>
                    </button>))}
                </div>
                {pick[r.id] && <Link className="btn" href={`/meetings/book?room=${r.id}&date=${date}&slot=${pick[r.id]}`}>{t('mt_continue')} →</Link>}
              </div>
            </article>))}
        </div>)}
    </div>
  );
}
