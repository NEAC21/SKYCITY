-- Meeting rooms. Run ONCE in the Supabase SQL Editor (after schema.sql). Safe to run again.
create table if not exists meeting_rooms (
  id uuid primary key default gen_random_uuid(),
  name jsonb not null,
  description jsonb not null default '{}'::jsonb,
  capacity int not null default 20 check (capacity > 0),
  amenities text[] not null default '{}',
  photos text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Time slots with their price, e.g. "Morning 08:00-12:00 = 5000"
create table if not exists meeting_slots (
  id uuid primary key default gen_random_uuid(),
  meeting_room_id uuid not null references meeting_rooms(id) on delete cascade,
  name jsonb not null,
  start_time time not null,
  end_time time not null,
  price numeric(10,2) not null check (price >= 0),
  active boolean not null default true,
  sort int not null default 0,
  check (end_time > start_time)
);

-- Choices: kind 'layout' = guest must pick one (U-shape, theatre...), kind 'extra' = guest can tick any (projector, lunch...)
create table if not exists meeting_options (
  id uuid primary key default gen_random_uuid(),
  meeting_room_id uuid not null references meeting_rooms(id) on delete cascade,
  name jsonb not null,
  kind text not null check (kind in ('layout','extra')),
  price numeric(10,2) not null default 0 check (price >= 0),
  price_type text not null default 'flat' check (price_type in ('flat','per_guest')),
  active boolean not null default true,
  sort int not null default 0
);

create table if not exists meeting_bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('MR' || upper(substr(md5(gen_random_uuid()::text), 1, 8))),
  meeting_room_id uuid not null references meeting_rooms(id),
  slot_name jsonb,
  event_date date not null,
  start_time time not null,
  end_time time not null,
  guests int not null default 1,
  guest_name text not null,
  guest_email text,
  guest_phone text,
  organization text,
  notes text,
  options jsonb not null default '[]'::jsonb,   -- copy of the chosen options and their prices at booking time
  total numeric(10,2) not null default 0,
  status text not null check (status in ('pending','confirmed','completed','cancelled','expired','blocked')),
  source text not null default 'online' check (source in ('online','reception')),
  payment_method text,
  payment_reference text,
  checkout_url text,
  hold_expires_at timestamptz,
  confirmation_sent boolean not null default false,
  refund_amount numeric(10,2) not null default 0,
  refund_status text not null default 'none' check (refund_status in ('none','due','paid')),
  created_by uuid,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check (end_time > start_time)
);
create index if not exists meeting_bookings_room_date on meeting_bookings (meeting_room_id, event_date);

alter table meeting_rooms enable row level security;
alter table meeting_slots enable row level security;
alter table meeting_options enable row level security;
alter table meeting_bookings enable row level security;

create or replace function is_meeting_busy(p_room uuid, p_date date, p_start time, p_end time, p_except uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from meeting_bookings b
    where b.meeting_room_id = p_room and b.event_date = p_date
      and b.id is distinct from p_except
      and b.start_time < p_end and b.end_time > p_start
      and (b.status in ('confirmed','blocked') or (b.status = 'pending' and b.hold_expires_at > now()))
  );
$$;

create or replace function create_meeting_booking(
  p_room uuid, p_date date, p_start time, p_end time, p_slot_name jsonb, p_guests int,
  p_name text, p_email text, p_phone text, p_org text, p_notes text, p_options jsonb, p_total numeric,
  p_source text, p_status text, p_hold_minutes int, p_method text, p_pay_ref text, p_by uuid
) returns meeting_bookings language plpgsql as $$
declare r meeting_bookings;
begin
  perform pg_advisory_xact_lock(7002);
  if is_meeting_busy(p_room, p_date, p_start, p_end, null) then raise exception 'SLOT_TAKEN'; end if;
  insert into meeting_bookings (meeting_room_id, slot_name, event_date, start_time, end_time, guests,
      guest_name, guest_email, guest_phone, organization, notes, options, total, status, source,
      payment_method, payment_reference, hold_expires_at, created_by)
  values (p_room, p_slot_name, p_date, p_start, p_end, p_guests,
      p_name, p_email, p_phone, p_org, p_notes, coalesce(p_options, '[]'::jsonb), p_total, p_status, p_source,
      p_method, p_pay_ref,
      case when p_status = 'pending' then now() + make_interval(mins => p_hold_minutes) end, p_by)
  returning * into r;
  return r;
end $$;

create or replace function confirm_meeting_booking(p_ref text, p_pay_ref text, p_method text)
returns meeting_bookings language plpgsql as $$
declare b meeting_bookings;
begin
  perform pg_advisory_xact_lock(7002);
  select * into b from meeting_bookings where reference = p_ref for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if b.status not in ('pending','expired') then return b; end if;
  if is_meeting_busy(b.meeting_room_id, b.event_date, b.start_time, b.end_time, b.id) then
    update meeting_bookings set status = 'cancelled', cancelled_at = now(), refund_amount = total,
      refund_status = 'due', payment_reference = p_pay_ref, payment_method = p_method,
      notes = coalesce(notes || ' | ', '') || 'Paid after hold expired; time no longer free'
      where id = b.id returning * into b;
    return b;
  end if;
  update meeting_bookings set status = 'confirmed', hold_expires_at = null,
    payment_reference = p_pay_ref, payment_method = p_method
    where id = b.id returning * into b;
  return b;
end $$;
