# Skycity Hotel – website and online booking

Next.js 14 + Supabase (database and photos) + Chapa payments. English, አማርኛ and Afaan Oromo.

| Part | Address | Who |
|---|---|---|
| Public website (Overview, Rooms, Dining, Events, booking) | `/` | Guests |
| Reception desk | `/reception` | Receptionist and admin |
| Admin | `/admin` | Admin only |
| Staff sign-in | `/staff/login` | Staff |

## 1. Supabase (use a NEW project just for this hotel)
1. SQL Editor → New query → paste `supabase/schema.sql` → Run.
2. New query → paste `supabase/seed.sql` → Run (fills the hotel name, phone, colors and the two room types).
3. Create the first admin: in `seed.sql` the last block is commented out. Remove the `--`, set your email and password, run it.
4. Project settings → API: copy the **Project URL** (`https://xxxx.supabase.co`) and the **service_role** or **secret** key (`sb_secret_...`).

## 2. Vercel variables (Settings → Environment Variables, Production ticked)
| Name | Value |
|---|---|
| `SUPABASE_URL` | the Project URL (starts with `https://`) |
| `SUPABASE_SERVICE_ROLE_KEY` | the secret key |
| `NEXT_PUBLIC_SITE_URL` | the hotel's website address, no `/` at the end |
| `CHAPA_SECRET_KEY` | the hotel's own Chapa secret key |
| `JWT_SECRET` | any long random text |
| `RESEND_API_KEY`, `EMAIL_FROM` | for confirmation emails |

Redeploy after changing variables. In Chapa → Settings → Webhooks set `https://HOTEL-SITE/api/chapa/webhook`.

## 3. Fill the site (Admin)
- **Settings:** logo, Amharic name, home photo, phone, email, address, map link, check-in/out times, refund rules.
- **Room types:** photos, prices, labels. Set the Standard Executive price, then tick "Show on website".
- **Rooms:** add each room number.
- **Website content:** dining photos, events hall photos, and any text you want to change.
- **Event inquiries:** requests from the Events form appear here (and by email to the hotel email).

## Check-in QR code
- After payment the guest gets a QR code on their booking page and in the confirmation email.
- At reception: open `/reception` → **Verify guest QR code** → **Scan QR with camera** (the browser asks for camera permission; HTTPS is required, Vercel has it). The screen turns green when the booking is valid and paid, amber for a wrong date, red for cancelled, unpaid or fake codes. Press **Check in guest** to finish.
- If the camera is not available, type the code or the booking reference and press **Verify**.
- The code is signed with `JWT_SECRET`. If you change `JWT_SECRET`, old QR codes stop working, so keep it the same.
- After updating the code, run `npm install` (new packages: `qrcode`, `jsqr`).
