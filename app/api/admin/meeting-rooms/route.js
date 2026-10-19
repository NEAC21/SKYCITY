import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth';
import { loadRooms, syncChildren } from '@/lib/meetings';
export const dynamic = 'force-dynamic';
export const clean = (b) => {
  const name = { en: String(b.name?.en || '').trim(), am: String(b.name?.am || '').trim(), om: String(b.name?.om || '').trim() };
  if (!name.en) fail(400, 'Enter the meeting room name in English.');
  return {
    name, description: { en: String(b.description?.en || ''), am: String(b.description?.am || ''), om: String(b.description?.om || '') },
    capacity: Math.max(1, Math.floor(Number(b.capacity) || 1)),
    amenities: (b.amenities || []).map((x) => String(x).trim()).filter(Boolean),
    photos: (b.photos || []).filter((x) => typeof x === 'string'), active: b.active !== false,
  };
};
export const GET = handle(async () => { await requireStaff(['admin']); return json({ rooms: await loadRooms({ activeOnly: false }) }); });
export const POST = handle(async (req) => {
  await requireStaff(['admin']);
  const b = await req.json().catch(() => ({}));
  const row = clean(b);
  const { data, error } = await db().from('meeting_rooms').insert(row).select().single();
  if (error) throw error;
  try { await syncChildren(data.id, b.slots, b.options); }
  catch (e) { await db().from('meeting_rooms').delete().eq('id', data.id); throw e; }
  return json({ room: data });
});
