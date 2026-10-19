import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth';
import { notifyMeeting } from '@/lib/email';
export const PATCH = handle(async (req, { params }) => {
  const staff = await requireStaff();
  const { action, refundAmount } = await req.json().catch(() => ({}));
  const { data: b } = await db().from('meeting_bookings').select('*').eq('id', params.id).maybeSingle();
  if (!b) fail(404, 'Booking not found.');
  let patch;
  if (action === 'cancel') {
    if (!['confirmed', 'blocked', 'pending'].includes(b.status)) fail(400, 'This booking cannot be cancelled.');
    const amt = b.status === 'confirmed' ? Math.min(Math.max(Number(refundAmount) || 0, 0), Number(b.total)) : 0;
    patch = { status: 'cancelled', cancelled_at: new Date().toISOString(), refund_amount: amt, refund_status: amt > 0 ? 'due' : 'none' };
  } else if (action === 'complete') {
    if (b.status !== 'confirmed') fail(400, 'Only confirmed bookings can be completed.');
    patch = { status: 'completed' };
  } else if (action === 'refund_paid') {
    if (staff.role !== 'admin') fail(403, 'Only the admin can mark refunds as paid.');
    if (b.refund_status !== 'due') fail(400, 'No refund is due.');
    patch = { refund_status: 'paid' };
  } else fail(400, 'Unknown action.');
  const { data, error } = await db().from('meeting_bookings').update(patch).eq('id', b.id).select().single();
  if (error) throw error;
  if (action === 'cancel' && data.guest_email) await notifyMeeting('cancelled', data);
  return json({ booking: data });
});
