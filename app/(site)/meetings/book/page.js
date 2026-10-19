'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/components/AppProvider';
import { api, fmtDate } from '@/lib/client';

const hhmm = (s) => String(s).slice(0, 5);

function Inner() {
  const sp = useSearchParams();
  const roomId = sp.get('room'), date = sp.get('date'), slotId = sp.get('slot');
  const { t, tr, settings } = useApp();
  const [room, setRoom] = useState(null), [slot, setSlot] = useState(null), [state, setState] = useState('loading'), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [layout, setLayout] = useState(''), [extras, setExtras] = useState([]), [n, setN] = useState(10);
  const [f, setF] = useState({ name: '', email: '', phone: '', organization: '', notes: '' });
  useEffect(() => {
    if (!roomId || !date || !slotId) { setState('none'); return; }
    api(`/api/meetings?date=${date}`).then((d) => {
      const r = d.rooms.find((x) => x.id === roomId), s = r?.slots.find((x) => x.id === slotId);
      setRoom(r || null); setSlot(s || null); setN(Math.min(10, r?.capacity || 1));
      setState(r && s && s.available ? 'ok' : 'none');
    }).catch((e) => { setErr(e.message); setState('none'); });
  }, [roomId, date, slotId]);
  if (state === 'loading') return <div className="wrap pad"><p>{t('loading')}</p></div>;
  if (state === 'none') return <div className="wrap pad"><p>{err || t('no_rooms')}</p><Link className="btn" href="/meetings">{t('change_dates')}</Link></div>;

  const layouts = room.options.filter((o) => o.kind === 'layout'), exs = room.options.filter((o) => o.kind === 'extra');
  const amount = (o) => (o.price_type === 'per_guest' ? Number(o.price) * n : Number(o.price));
  const label = (o) => o.price_type === 'per_guest' ? t('mt_per_person', { price: Number(o.price).toLocaleString() }) : Number(o.price) > 0 ? t('mt_flat', { price: Number(o.price).toLocaleString() }) : t('mt_included');
  const chosen = [...layouts.filter((o) => o.id === layout), ...exs.filter((o) => extras.includes(o.id))];
  const total = Number(slot.price) + chosen.reduce((s, o) => s + amount(o), 0);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (layouts.length && !layout) { setErr(t('mt_layout')); return; }
    setBusy(true);
    try {
      const d = await api('/api/meetings/bookings', { method: 'POST', body: { roomId, slotId, date, guests: n, optionIds: chosen.map((o) => o.id), ...f } });
      window.location.href = d.checkoutUrl;
    } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="wrap" style={{ paddingTop: 40 }}>
      <h2 style={{ fontSize: 34, marginBottom: 24 }}>{t('mt_title')}</h2>
      <div className="two">
        <form className="card" onSubmit={submit}>
          <div className="field"><label htmlFor="at">{t('mt_attendees')} (max {room.capacity})</label><input id="at" type="number" min="1" max={room.capacity} required value={n} onChange={(e) => setN(Math.max(1, Math.min(room.capacity, Number(e.target.value) || 1)))} /></div>
          {layouts.length > 0 && <fieldset style={{ border: 0, padding: 0, margin: '0 0 14px' }}><legend style={{ fontWeight: 700, marginBottom: 4 }}>{t('mt_layout')}</legend>
            {layouts.map((o) => <label className="opt" key={o.id}><input type="radio" name="layout" checked={layout === o.id} onChange={() => setLayout(o.id)} /><span>{tr(o.name)}</span><span>{label(o)}</span></label>)}</fieldset>}
          {exs.length > 0 && <fieldset style={{ border: 0, padding: 0, margin: '0 0 14px' }}><legend style={{ fontWeight: 700, marginBottom: 4 }}>{t('mt_extras')}</legend>
            {exs.map((o) => <label className="opt" key={o.id}><input type="checkbox" checked={extras.includes(o.id)} onChange={(e) => setExtras(e.target.checked ? [...extras, o.id] : extras.filter((x) => x !== o.id))} /><span>{tr(o.name)}</span><span>{label(o)}</span></label>)}</fieldset>}
          <div className="field"><label htmlFor="n">{t('full_name')}</label><input id="n" required value={f.name} onChange={set('name')} autoComplete="name" /></div>
          <div className="field"><label htmlFor="o">{t('mt_org')}</label><input id="o" value={f.organization} onChange={set('organization')} autoComplete="organization" /></div>
          <div className="field"><label htmlFor="e">{t('email')}</label><input id="e" type="email" required value={f.email} onChange={set('email')} autoComplete="email" /></div>
          <div className="field"><label htmlFor="p">{t('phone')}</label><input id="p" type="tel" required value={f.phone} onChange={set('phone')} autoComplete="tel" /></div>
          <div className="field"><label htmlFor="x">{t('mt_notes')}</label><textarea id="x" value={f.notes} onChange={set('notes')} style={{ minHeight: 70 }} /></div>
          {err && <p className="err">{err}</p>}
          <button className="btn gold" disabled={busy} style={{ width: '100%' }}>{busy ? t('loading') : t('pay_now', { amount: total.toLocaleString() })}</button>
          <p className="note">{t('payment_note')}</p>
          <p className="note">{t('hold_note', { m: settings.hold_minutes })}</p>
        </form>
        <aside className="card">
          {room.photos?.[0] && <img src={room.photos[0]} alt={tr(room.name)} style={{ borderRadius: 12, marginBottom: 14, width: '100%', height: 180, objectFit: 'cover' }} />}
          <h3>{tr(room.name)}</h3>
          <dl className="sum" style={{ marginTop: 14 }}>
            <dt>{t('mt_event_date')}</dt><dd>{fmtDate(date)}</dd>
            <dt>{t('mt_time')}</dt><dd>{tr(slot.name)} · {hhmm(slot.start_time)}–{hhmm(slot.end_time)}</dd>
            <dt>{tr(slot.name)}</dt><dd>{Number(slot.price).toLocaleString()} ETB</dd>
            {chosen.map((o) => <div key={o.id}><dt>{tr(o.name)}</dt><dd>{amount(o).toLocaleString()} ETB</dd></div>)}
            <dt>{t('total')}</dt><dd style={{ fontSize: 22 }}>{total.toLocaleString()} ETB</dd>
          </dl>
          <p className="note">{t('policy', { h: settings.refund_hours, p: settings.refund_percent })}</p>
        </aside>
      </div>
    </div>
  );
}
export default function Page() { return <Suspense fallback={<div className="wrap pad">…</div>}><Inner /></Suspense>; }
