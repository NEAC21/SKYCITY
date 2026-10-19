import { json, handle, fail } from '@/lib/http';
import { db } from '@/lib/supabase';
import { getSettings } from '@/lib/settings';
import { createMeeting } from '@/lib/meetings';
import { initPayment } from '@/lib/chapa';
export const POST = handle(async (req) => {
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || '').trim(), email = String(b.email || '').trim().toLowerCase(), phone = String(b.phone || '').trim();
  if (name.length < 2) fail(400, 'Enter your full name.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, 'Enter a valid email address.');
  if (phone.replace(/\D/g, '').length < 9) fail(400, 'Enter a valid phone number.');
  const { booking: bk } = await createMeeting({
    roomId: b.roomId, slotId: b.slotId, date: b.date, guests: b.guests, optionIds: b.optionIds,
    guest: { name, email, phone, organization: String(b.organization || '').trim().slice(0, 160), notes: String(b.notes || '').trim().slice(0, 1000) },
    source: 'online', status: 'pending',
  });
  const s = await getSettings();
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  try {
    const url = await initPayment({
      amount: bk.total, email, name, phone, txRef: bk.reference,
      returnUrl: `${site}/booking/${bk.reference}?e=${encodeURIComponent(email)}`,
      callbackUrl: `${site}/api/chapa/webhook`, title: s.name, description: `Meeting room ${bk.reference}`,
    });
    await db().from('meeting_bookings').update({ checkout_url: url }).eq('id', bk.id);
    return json({ reference: bk.reference, checkoutUrl: url });
  } catch (e) {
    console.error(e);
    await db().from('meeting_bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', bk.id);
    fail(502, 'Payment could not be started. Please try again.');
  }
});
