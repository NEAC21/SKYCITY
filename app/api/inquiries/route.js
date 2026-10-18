import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { getSettings } from '@/lib/settings';
import { isDate } from '@/lib/booking';
import { sendEmail, esc } from '@/lib/email';
export const POST = handle(async (req) => {
  const b = await req.json().catch(() => ({}));
  if (b.website) return json({ ok: true }); // hidden field: only bots fill it
  const name = String(b.name || '').trim().slice(0, 120);
  const phone = String(b.phone || '').trim().slice(0, 40);
  const email = String(b.email || '').trim().toLowerCase().slice(0, 160);
  if (name.length < 2) fail(400, 'Enter your name.');
  if (!phone && !email) fail(400, 'Enter a phone number or an email so we can reply.');
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, 'Enter a valid email address.');
  const since = new Date(Date.now() - 3600e3).toISOString();
  const { count } = await db().from('inquiries').select('id', { count: 'exact', head: true }).gte('created_at', since);
  if ((count || 0) > 30) fail(429, 'Too many requests right now. Please call us.');
  const row = {
    name, phone: phone || null, email: email || null,
    event_type: String(b.eventType || '').trim().slice(0, 120) || null,
    event_date: isDate(b.eventDate) ? b.eventDate : null,
    guests: Number(b.guests) > 0 ? Math.floor(Number(b.guests)) : null,
    message: String(b.message || '').trim().slice(0, 2000) || null,
  };
  const { error } = await db().from('inquiries').insert(row);
  if (error) { console.error(error); fail(500, 'Could not send your inquiry. Please call us.'); }
  const s = await getSettings();
  if (s.email) {
    const rows = [['Name', row.name], ['Phone', row.phone], ['Email', row.email], ['Event', row.event_type], ['Date', row.event_date], ['Guests', row.guests], ['Message', row.message]]
      .filter(([, v]) => v).map(([k, v]) => `<p><b>${k}:</b> ${esc(v)}</p>`).join('');
    await sendEmail({ to: s.email, subject: `New event inquiry from ${row.name}`, html: `<div style="font-family:Arial,sans-serif">${rows}</div>` });
  }
  return json({ ok: true });
});
