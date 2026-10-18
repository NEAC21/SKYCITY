-- Run AFTER schema.sql. Fills the hotel details and the two room types from the current Skycity website.
-- Check the items marked CHECK, then change anything later in Admin.

update settings set data = jsonb_build_object(
  'name', 'Skycity Hotel',
  'name_local', 'ስካይሲቲ ሆቴል',
  'tagline', 'Premium comfort and stay',
  'phone', '0903969798',
  'brand_color', '#0B1120',
  'accent_color', '#FF9F0A',
  'check_in_time', '14:00',      -- CHECK
  'check_out_time', '11:00',     -- CHECK
  'hold_minutes', 10,
  'refund_percent', 80,
  'refund_hours', 48
) where id = 1;

insert into room_types (name, badge, description, price_per_night, capacity, amenities, active) values
(
  '{"en":"Executive Suite Rooms","am":"ኤግዚኪዩቲቭ ስዊት ክፍሎች","om":"Kutaalee Executive Suite"}',
  '{"en":"65 m² Space","am":"65 ካሬ ሜትር ስፋት","om":"Bal’ina m² 65"}',
  '{"en":"Perfect balance of ergonomic business workspaces combined seamlessly with serene, restorative premium luxury layouts and plush bedding.","am":"የሥራ ምቾትን ከተረጋጋ እና መንፈስን ከሚያድስ ቅንጡ አቀማመጥ እና ለስላሳ የአልጋ ልብስ ጋር በሚገባ ያጣመረ።","om":"Mijaa’ina hojii, bakka tasgabbaa’aa fi fayyadu, haala ol’aanaa fi uffata siree laafaa walitti makaa."}',
  5176, 2, array['King bed'], true
),
(
  '{"en":"Standard Executive Rooms","am":"ስታንዳርድ ኤግዚኪዩቲቭ ክፍሎች","om":"Kutaalee Standard Executive"}',
  '{"en":"Standard Luxury","am":"መደበኛ ቅንጦት","om":"Ol’aanaa Idilee"}',
  '{"en":"Pragmatic configurations loaded with high-speed internet areas, premium dynamic natural illumination, elegant design accents, and direct layout access.","am":"ፈጣን ኢንተርኔት፣ ብዙ የተፈጥሮ ብርሃን፣ ውብ የዲዛይን ማድመቂያዎች እና ቀጥተኛ መዳረሻ ያላቸው ተግባራዊ ክፍሎች።","om":"Kutaalee hojii-mijaa’oo interneetii saffisaa, ifa uumamaa baay’ee, miidhagina dizaayiniifi seensa kallattii qaban."}',
  0, 2, array['Breakfast included'], false   -- CHECK: the price was not on the website. Set it in Admin → Room types, then tick "Show on website".
);

-- Add your real room numbers. Example for rooms 101-105 as Executive Suites (remove the leading -- to run):
-- insert into rooms (number, room_type_id)
-- select n, (select id from room_types where name->>'en' = 'Executive Suite Rooms')
-- from unnest(array['101','102','103','104','105']) as n;

-- First admin (change the email and password, then run):
-- insert into staff (name, email, password_hash, role)
-- values ('Owner', 'owner@example.com', crypt('ChangeThisPassword1', gen_salt('bf', 10)), 'admin');
