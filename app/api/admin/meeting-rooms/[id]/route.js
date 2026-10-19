import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth';
import { syncChildren } from '@/lib/meetings';
import { clean } from '../route';
export const PUT = handle(async (req, { params }) => {
  await requireStaff(['admin']);
  const b = await req.json().catch(() => ({}));
  const row = clean(b);
  await syncChildren(params.id, b.slots, b.options);
  const { data, error } = await db().from('meeting_rooms').update(row).eq('id', params.id).select().single();
  if (error) throw error;
  return json({ room: data });
});
export const DELETE = handle(async (req, { params }) => {
  await requireStaff(['admin']);
  const { error } = await db().from('meeting_rooms').delete().eq('id', params.id);
  if (error) fail(409, 'This meeting room has bookings. Hide it instead of deleting it.');
  return json({ ok: true });
});
