import { json, handle } from '@/lib/http';
import { loadRooms, withAvailability } from '@/lib/meetings';
export const dynamic = 'force-dynamic';
export const GET = handle(async (req) => {
  const date = new URL(req.url).searchParams.get('date');
  return json({ rooms: await withAvailability(await loadRooms(), date) });
});
