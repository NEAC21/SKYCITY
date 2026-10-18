import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth';
export const PATCH = handle(async (req, { params }) => {
  await requireStaff(['admin']);
  const { status } = await req.json().catch(() => ({}));
  if (!['new', 'handled'].includes(status)) fail(400, 'Invalid status.');
  const { error } = await db().from('inquiries').update({ status }).eq('id', params.id);
  if (error) throw error;
  return json({ ok: true });
});
