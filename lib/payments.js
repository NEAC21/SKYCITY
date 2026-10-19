import { db } from './supabase';
import { verifyPayment } from './chapa';
import { notify, notifyMeeting } from './email';
// Asks Chapa whether this booking was paid. Safe to call many times.
async function settleMeeting(reference) {
  const { data: b } = await db().from('meeting_bookings').select('*').eq('reference', reference).maybeSingle();
  if (!b) return null;
  if (!['pending', 'expired'].includes(b.status)) return b;
  const v = await verifyPayment(reference);
  if (!v || String(v.status).toLowerCase() !== 'success' || v.currency !== 'ETB' || Number(v.amount) < Number(b.total)) return b;
  const { data: c, error } = await db().rpc('confirm_meeting_booking', { p_ref: reference, p_pay_ref: v.reference || reference, p_method: v.method || 'chapa' });
  if (error) throw error;
  const { data: claim } = await db().from('meeting_bookings').update({ confirmation_sent: true }).eq('id', c.id).eq('confirmation_sent', false).select().maybeSingle();
  if (claim) await notifyMeeting(c.status === 'confirmed' ? 'confirmed' : 'late', c);
  return c;
}

export async function settleBooking(reference) {
  if (String(reference).startsWith('MR')) return settleMeeting(reference);
  const { data: b } = await db().from('bookings').select('*').eq('reference', reference).maybeSingle();
  if (!b) return null;
  if (!['pending', 'expired'].includes(b.status)) return b;
  const v = await verifyPayment(reference);
  if (!v || String(v.status).toLowerCase() !== 'success' || v.currency !== 'ETB' || Number(v.amount) < Number(b.total)) return b;
  const { data: c, error } = await db().rpc('confirm_booking', { p_ref: reference, p_pay_ref: v.reference || reference, p_method: v.method || 'chapa' });
  if (error) throw error;
  const { data: claim } = await db().from('bookings').update({ confirmation_sent: true }).eq('id', c.id).eq('confirmation_sent', false).select().maybeSingle();
  if (claim) await notify(c.status === 'confirmed' ? 'confirmed' : 'late', c);
  return c;
}
