import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth';
import { createMeeting, expireMeetingHolds } from '@/lib/meetings';
import { notifyMeeting } from '@/lib/email';
export const dynamic = 'force-dynamic';
export const GET = handle(async (req) => {
  await requireStaff(); await expireMeetingHolds();
  const sp = new URL(req.url).searchParams;
  let q = db().from('meeting_bookings').select('*, meeting_rooms(name)').order('event_date').order('start_time').limit(300);
  if (sp.get('status')) q = q.eq('status', sp.get('status'));
  if (sp.get('from')) q = q.gte('event_date', sp.get('from'));
  const { data, error } = await q;
  if (error) throw error;
  return json({ bookings: data });
});
export const POST = handle(async (req) => {
  const staff = await requireStaff();
  const b = await req.json().catch(() => ({}));
  const block = !!b.block;
  if (block && staff.role !== 'admin') fail(403, 'Only the admin can block a room.');
  const name = block ? 'Blocked' : String(b.name || '').trim();
  if (!block && name.length < 2) fail(400, 'Enter the guest or company name.');
  const email = String(b.email || '').trim().toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, 'Enter a valid email or leave it empty.');
  const methods = ['cash', 'telebirr', 'bank_transfer', 'pos', 'pay_at_checkin'];
  const method = block ? null : (methods.includes(b.paymentMethod) ? b.paymentMethod : fail(400, 'Choose how the guest pays.'));
  const { booking } = await createMeeting({
    roomId: b.roomId, slotId: b.slotId, date: b.date, guests: b.guests, optionIds: b.optionIds,
    guest: { name, email, phone: String(b.phone || '').trim(), organization: String(b.organization || '').trim().slice(0, 160), notes: String(b.notes || '').trim().slice(0, 1000) },
    source: 'reception', status: block ? 'blocked' : 'confirmed', by: staff.id, method, payRef: String(b.paymentReference || '').trim(), block,
  });
  if (!block && email) await notifyMeeting('confirmed', booking);
  return json({ booking });
});
