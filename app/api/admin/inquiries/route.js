import { json, handle } from '@/lib/http';
import { db } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export const GET = handle(async () => {
  await requireStaff(['admin']);
  const { data } = await db().from('inquiries').select('*').order('created_at', { ascending: false }).limit(200);
  return json({ inquiries: data });
});
