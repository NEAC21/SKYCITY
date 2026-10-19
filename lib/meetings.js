import { db } from './supabase';
import { fail } from './http';
import { getSettings } from './settings';
import { todayAddis, isDate, addDaysStr } from './booking';

export const hhmm = (t) => String(t || '').slice(0, 5);
const nowTime = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(11, 19);

export async function expireMeetingHolds() {
  await db().from('meeting_bookings').update({ status: 'expired' }).eq('status', 'pending').lt('hold_expires_at', new Date().toISOString());
}

export async function loadRooms({ activeOnly = true, id } = {}) {
  let q = db().from('meeting_rooms').select('*, meeting_slots(*), meeting_options(*)').order('created_at');
  if (activeOnly) q = q.eq('active', true);
  if (id) q = q.eq('id', id);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(({ meeting_slots, meeting_options, ...r }) => ({
    ...r,
    slots: (meeting_slots || []).filter((s) => !activeOnly || s.active).sort((a, b) => a.sort - b.sort || a.start_time.localeCompare(b.start_time)),
    options: (meeting_options || []).filter((o) => !activeOnly || o.active).sort((a, b) => a.sort - b.sort || String(a.name?.en).localeCompare(String(b.name?.en))),
  }));
}

export function validEventDate(d) {
  if (!isDate(d)) return 'Choose a valid date.';
  if (d < todayAddis()) return 'The date cannot be in the past.';
  if (d > addDaysStr(todayAddis(), 365)) return 'Please choose a date within the next year.';
  return null;
}

// Adds "available" to every slot for one date (a slot is free if no confirmed/held booking overlaps it and it has not started yet today)
export async function withAvailability(rooms, date) {
  if (!isDate(date)) return rooms.map((r) => ({ ...r, slots: r.slots.map((s) => ({ ...s, available: null })) }));
  await expireMeetingHolds();
  const { data } = await db().from('meeting_bookings').select('meeting_room_id,start_time,end_time').eq('event_date', date).in('status', ['confirmed', 'blocked', 'pending']);
  const busy = data || [], today = todayAddis(), now = nowTime();
  return rooms.map((r) => ({
    ...r,
    slots: r.slots.map((s) => ({
      ...s,
      available: !(date === today && s.start_time <= now) && !busy.some((b) => b.meeting_room_id === r.id && b.start_time < s.end_time && b.end_time > s.start_time),
    })),
  }));
}

// The server always works out the price itself from the database. It never trusts a price sent by the browser.
export function priceMeeting(room, slot, optionIds, guests) {
  const ids = Array.isArray(optionIds) ? [...new Set(optionIds)] : [];
  const picked = ids.map((id) => room.options.find((o) => o.id === id));
  if (picked.some((o) => !o)) fail(400, 'One of the chosen options is not available.');
  const hasLayouts = room.options.some((o) => o.kind === 'layout');
  if (hasLayouts && picked.filter((o) => o.kind === 'layout').length !== 1) fail(400, 'Choose one seating layout.');
  let total = Number(slot.price);
  const lines = picked.map((o) => {
    const amount = o.price_type === 'per_guest' ? Number(o.price) * guests : Number(o.price);
    total += amount;
    return { id: o.id, name: o.name, kind: o.kind, price: Number(o.price), price_type: o.price_type, amount };
  });
  return { total: Math.round(total * 100) / 100, lines };
}

export async function createMeeting({ roomId, slotId, date, guests, optionIds, guest, source, status, by, method, payRef, block }) {
  const err = validEventDate(date); if (err) fail(400, err);
  const [room] = await loadRooms({ activeOnly: true, id: roomId });
  if (!room) fail(404, 'Meeting room not found.');
  const slot = room.slots.find((s) => s.id === slotId);
  if (!slot) fail(404, 'Time slot not found.');
  const n = Math.max(1, Math.floor(Number(guests) || 1));
  if (n > room.capacity) fail(400, `This room holds up to ${room.capacity} people.`);
  if (source === 'online' && date === todayAddis() && slot.start_time <= nowTime()) fail(400, 'This time has already started. Choose another time.');
  const { total, lines } = block ? { total: 0, lines: [] } : priceMeeting(room, slot, optionIds, n);
  const s = await getSettings();
  const { data, error } = await db().rpc('create_meeting_booking', {
    p_room: room.id, p_date: date, p_start: slot.start_time, p_end: slot.end_time, p_slot_name: slot.name, p_guests: n,
    p_name: guest.name, p_email: guest.email || null, p_phone: guest.phone || null, p_org: guest.organization || null, p_notes: guest.notes || null,
    p_options: lines, p_total: total, p_source: source, p_status: status, p_hold_minutes: Number(s.hold_minutes) || 10,
    p_method: method || null, p_pay_ref: payRef || null, p_by: by || null,
  });
  if (error) {
    if (error.message.includes('SLOT_TAKEN')) fail(409, 'Sorry, this time was just booked. Please choose another time.');
    console.error(error); fail(500, 'Could not save the booking.');
  }
  return { booking: data, room };
}

export function meetingRefund(b, s, now = Date.now()) {
  const hoursLeft = (Date.parse(`${b.event_date}T${b.start_time}+03:00`) - now) / 36e5;
  const eligible = hoursLeft >= Number(s.refund_hours);
  const percent = eligible ? Number(s.refund_percent) : 0;
  return { eligible, percent, amount: Math.round(Number(b.total) * percent) / 100, hoursLeft };
}

// ----- admin: replace a room's slots / options while keeping the ids that already exist
const t8 = (x) => (String(x).length === 5 ? x + ':00' : String(x));
const name3 = (n) => {
  const o = { en: String(n?.en || '').trim(), am: String(n?.am || '').trim(), om: String(n?.om || '').trim() };
  if (!o.en) fail(400, 'Every time slot and option needs an English name.');
  return o;
};
async function syncTable(table, roomId, rows) {
  const { data: existing } = await db().from(table).select('id').eq('meeting_room_id', roomId);
  const have = new Set((existing || []).map((r) => r.id));
  const keep = rows.filter((r) => r.id && have.has(r.id)).map((r) => r.id);
  let del = db().from(table).delete().eq('meeting_room_id', roomId);
  if (keep.length) del = del.not('id', 'in', `(${keep.join(',')})`);
  const { error: e1 } = await del; if (e1) throw e1;
  const old = rows.filter((r) => r.id && have.has(r.id));
  const fresh = rows.filter((r) => !(r.id && have.has(r.id))).map(({ id, ...r }) => r);
  if (old.length) { const { error } = await db().from(table).upsert(old); if (error) throw error; }
  if (fresh.length) { const { error } = await db().from(table).insert(fresh); if (error) throw error; }
}
export async function syncChildren(roomId, slots = [], options = []) {
  const S = (slots || []).map((s, i) => {
    const a = t8(s.start_time), b = t8(s.end_time);
    if (!/^\d{2}:\d{2}:\d{2}$/.test(a) || !/^\d{2}:\d{2}:\d{2}$/.test(b) || b <= a) fail(400, 'Each time slot needs a start time before its end time.');
    const price = Number(s.price); if (!(price >= 0)) fail(400, 'Enter a price for every time slot.');
    return { id: s.id, meeting_room_id: roomId, name: name3(s.name), start_time: a, end_time: b, price, active: s.active !== false, sort: i };
  });
  const O = (options || []).map((o, i) => {
    if (!['layout', 'extra'].includes(o.kind)) fail(400, 'Choose the type of every option.');
    if (!['flat', 'per_guest'].includes(o.price_type)) fail(400, 'Choose how every option is priced.');
    const price = Number(o.price || 0); if (!(price >= 0)) fail(400, 'Enter a valid option price.');
    return { id: o.id, meeting_room_id: roomId, name: name3(o.name), kind: o.kind, price, price_type: o.price_type, active: o.active !== false, sort: i };
  });
  await syncTable('meeting_slots', roomId, S);
  await syncTable('meeting_options', roomId, O);
}
