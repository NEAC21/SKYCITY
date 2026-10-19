import { db } from './supabase';
import { getSettings } from './settings';
import { settleBooking } from './payments';
import { expireMeetingHolds, meetingRefund } from './meetings';
import { notifyMeeting } from './email';
const load = async (ref) => (await db().from('meeting_bookings').select('*, meeting_rooms(name)').eq('reference', ref).maybeSingle()).data;

export async function meetingLookup(ref, email) {
  await expireMeetingHolds();
  let b = await load(ref);
  if (!b || (b.guest_email || '') !== email) return null;
  if (['pending', 'expired'].includes(b.status)) { await settleBooking(ref); b = await load(ref); }
  const s = await getSettings();
  const r = b.status === 'confirmed' ? meetingRefund(b, s) : null;
  const holdLeft = b.status === 'pending' && b.hold_expires_at ? Math.max(0, Math.floor((Date.parse(b.hold_expires_at) - Date.now()) / 1000)) : 0;
  return {
    kind: 'meeting', reference: b.reference, status: b.status, room_name: b.meeting_rooms?.name, slot_name: b.slot_name,
    event_date: b.event_date, start_time: b.start_time, end_time: b.end_time, guests: b.guests, options: b.options || [], total: b.total,
    hold_seconds_left: holdLeft, checkout_url: holdLeft > 0 ? b.checkout_url : null,
    refund_amount: b.refund_amount, refund_status: b.refund_status,
    can_cancel: b.status === 'confirmed' && r.hoursLeft > 0,
    refund_preview: r && { eligible: r.eligible, percent: r.percent, amount: r.amount },
  };
}

// returns the refund amount, or a string error message
export async function cancelMeetingByGuest(ref, email) {
  const b = await load(ref);
  if (!b || (b.guest_email || '') !== email) return { error: 'Booking not found.', status: 404 };
  if (b.status !== 'confirmed') return { error: 'This booking cannot be cancelled online.', status: 400 };
  const r = meetingRefund(b, await getSettings());
  if (r.hoursLeft <= 0) return { error: 'The event time has passed. Please contact us.', status: 400 };
  const { data, error } = await db().from('meeting_bookings').update({
    status: 'cancelled', cancelled_at: new Date().toISOString(), refund_amount: r.amount, refund_status: r.amount > 0 ? 'due' : 'none',
  }).eq('id', b.id).eq('status', 'confirmed').select().single();
  if (error) return { error: 'This booking was already changed.', status: 409 };
  await notifyMeeting('cancelled', data);
  return { refund: data.refund_amount };
}
