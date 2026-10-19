'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, money, fmtDate, todayStr } from '@/lib/client';

const METHODS = [['cash', 'Cash'], ['telebirr', 'Telebirr'], ['bank_transfer', 'Bank transfer'], ['pos', 'POS card'], ['pay_at_checkin', 'Pay at the event']];
const hh = (s) => String(s).slice(0, 5);
const en = (o) => o?.en || '';

export default function MeetingDesk({ isAdmin }) {
  const [date, setDate] = useState(todayStr()), [rooms, setRooms] = useState([]), [rows, setRows] = useState([]);
  const [from, setFrom] = useState(todayStr()), [status, setStatus] = useState(''), [err, setErr] = useState(''), [draft, setDraft] = useState(null);
  const loadRooms = useCallback(async () => { try { setRooms((await api(`/api/meetings?date=${date}`)).rooms); } catch (e) { setErr(e.message); } }, [date]);
  const loadRows = useCallback(async () => {
    const qs = new URLSearchParams(Object.entries({ from, status }).filter(([, v]) => v)).toString();
    try { setRows((await api('/api/staff/meetings?' + qs)).bookings); } catch (e) { setErr(e.message); }
  }, [from, status]);
  useEffect(() => { loadRooms(); }, [loadRooms]);
  useEffect(() => { loadRows(); }, [loadRows]);
  const refresh = () => { loadRooms(); loadRows(); };
  const act = async (b, action) => {
    let refundAmount;
    if (action === 'cancel') {
      if (b.status === 'confirmed') { const v = window.prompt('Refund amount in ETB (0 for none):', '0'); if (v === null) return; refundAmount = Number(v); }
      else if (!window.confirm('Cancel this?')) return;
    }
    try { await api(`/api/staff/meetings/${b.id}`, { method: 'PATCH', body: { action, refundAmount } }); refresh(); } catch (e) { setErr(e.message); }
  };
  return (
    <>
      {err && <p className="err">{err}</p>}
      <div className="inline" style={{ marginBottom: 10 }}>
        <div className="field"><label>Date</label><input type="date" min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      {rooms.length === 0 && <p className="muted">No meeting rooms yet. The admin adds them in Admin → Meeting rooms.</p>}
      <div className="grid2">
        {rooms.map((r) => (
          <div className="card" key={r.id}>
            <h3 style={{ fontSize: 18 }}>{en(r.name)} <span className="muted" style={{ fontWeight: 400, fontSize: 14 }}>· up to {r.capacity}</span></h3>
            <div className="slots">
              {r.slots.map((s) => (
                <button key={s.id} className="slot" disabled={!s.available} onClick={() => setDraft({ room: r, slot: s, date })}>
                  <b>{en(s.name)}</b><small>{hh(s.start_time)}–{hh(s.end_time)} · {money(s.price)}{s.available ? '' : ' · taken'}</small>
                </button>))}
            </div>
          </div>))}
      </div>

      <h3 style={{ margin: '26px 0 10px' }}>Meeting bookings</h3>
      <div className="inline" style={{ marginBottom: 10 }}>
        <div className="field"><label>From date (clear to see all)</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field"><label>Status</label><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{['pending', 'confirmed', 'completed', 'cancelled', 'expired', 'blocked'].map((s) => <option key={s}>{s}</option>)}</select></div>
      </div>
      <div className="scroll"><table className="tbl"><thead><tr><th>Ref</th><th>Date and time</th><th>Room</th><th>Guest</th><th>Choices</th><th>Total</th><th>Status</th><th /></tr></thead><tbody>
        {rows.map((b) => (
          <tr key={b.id}><td>{b.reference}</td>
            <td>{fmtDate(b.event_date)}<br /><span className="muted">{hh(b.start_time)}–{hh(b.end_time)}</span></td>
            <td>{en(b.meeting_rooms?.name)}</td>
            <td><b>{b.guest_name}</b>{b.organization ? <><br />{b.organization}</> : null}<br /><span className="muted">{b.guest_phone} · {b.guests} people</span></td>
            <td style={{ maxWidth: 220 }}>{(b.options || []).map((o) => en(o.name)).join(', ') || '—'}</td>
            <td>{money(b.total)}<br /><span className="muted">{(b.payment_method || '').replace('_', ' ')}</span></td>
            <td>{b.status}{b.refund_status !== 'none' && <><br /><b style={{ color: 'var(--danger)' }}>Refund {b.refund_status}: {money(b.refund_amount)}</b></>}</td>
            <td style={{ whiteSpace: 'nowrap' }}>
              {b.status === 'confirmed' && <button className="btn sm ghost" onClick={() => act(b, 'complete')}>Done</button>}{' '}
              {['confirmed', 'pending', 'blocked'].includes(b.status) && (b.status !== 'blocked' || isAdmin) && <button className="btn sm danger" onClick={() => act(b, 'cancel')}>{b.status === 'blocked' ? 'Unblock' : 'Cancel'}</button>}
              {isAdmin && b.refund_status === 'due' && <button className="btn sm gold" onClick={() => act(b, 'refund_paid')}>Refund paid</button>}
            </td></tr>))}
      </tbody></table></div>
      {rows.length === 0 && <p className="muted">No meeting bookings found.</p>}
      {draft && <MeetingForm draft={draft} isAdmin={isAdmin} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); refresh(); }} />}
    </>
  );
}

function MeetingForm({ draft, isAdmin, onClose, onSaved }) {
  const { room, slot, date } = draft;
  const layouts = room.options.filter((o) => o.kind === 'layout'), exs = room.options.filter((o) => o.kind === 'extra');
  const [f, setF] = useState({ name: '', phone: '', email: '', organization: '', notes: '', paymentMethod: 'cash', paymentReference: '', block: false });
  const [n, setN] = useState(Math.min(10, room.capacity)), [layout, setLayout] = useState(''), [extras, setExtras] = useState([]);
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const amount = (o) => (o.price_type === 'per_guest' ? Number(o.price) * n : Number(o.price));
  const chosen = [...layouts.filter((o) => o.id === layout), ...exs.filter((o) => extras.includes(o.id))];
  const total = Number(slot.price) + chosen.reduce((s, o) => s + amount(o), 0);
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!f.block && layouts.length && !layout) { setErr('Choose a seating layout.'); return; }
    setBusy(true);
    try { await api('/api/staff/meetings', { method: 'POST', body: { ...f, roomId: room.id, slotId: slot.id, date, guests: n, optionIds: chosen.map((o) => o.id) } }); onSaved(); }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="modal" onClick={onClose}><form className="card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
      <h3 style={{ marginBottom: 4 }}>{en(room.name)}</h3>
      <p className="muted" style={{ marginTop: 0 }}>{fmtDate(date)} · {en(slot.name)} {hh(slot.start_time)}–{hh(slot.end_time)}</p>
      {isAdmin && <label className="opt"><input type="checkbox" checked={f.block} onChange={set('block')} /><span>Block this time (maintenance, not a guest)</span></label>}
      {!f.block && <>
        <div className="field"><label>Number of people (max {room.capacity})</label><input type="number" min="1" max={room.capacity} value={n} onChange={(e) => setN(Math.max(1, Math.min(room.capacity, Number(e.target.value) || 1)))} /></div>
        {layouts.length > 0 && <div className="field"><label>Seating layout</label>{layouts.map((o) => <label className="opt" key={o.id}><input type="radio" name="lay" checked={layout === o.id} onChange={() => setLayout(o.id)} /><span>{en(o.name)}</span><span>{money(amount(o))}</span></label>)}</div>}
        {exs.length > 0 && <div className="field"><label>Extras</label>{exs.map((o) => <label className="opt" key={o.id}><input type="checkbox" checked={extras.includes(o.id)} onChange={(e) => setExtras(e.target.checked ? [...extras, o.id] : extras.filter((x) => x !== o.id))} /><span>{en(o.name)}</span><span>{money(amount(o))}</span></label>)}</div>}
        <p><b>Total: {money(total)}</b></p>
        <div className="field"><label>Guest or company name</label><input required value={f.name} onChange={set('name')} /></div>
        <div className="inline"><div className="field"><label>Phone</label><input value={f.phone} onChange={set('phone')} /></div><div className="field"><label>Email (optional)</label><input type="email" value={f.email} onChange={set('email')} /></div></div>
        <div className="inline">
          <div className="field"><label>Payment</label><select value={f.paymentMethod} onChange={set('paymentMethod')}>{METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div className="field"><label>Receipt / transaction no.</label><input value={f.paymentReference} onChange={set('paymentReference')} /></div>
        </div>
      </>}
      <div className="field"><label>Notes</label><textarea style={{ minHeight: 60 }} value={f.notes} onChange={set('notes')} /></div>
      {err && <p className="err">{err}</p>}
      <div className="pillrow"><button className="btn gold" disabled={busy}>{f.block ? 'Block time' : 'Confirm booking'}</button><button type="button" className="btn ghost" onClick={onClose}>Cancel</button></div>
    </form></div>
  );
}
