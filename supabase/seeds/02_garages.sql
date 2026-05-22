-- 02_garages.sql — Sample garages for testing
-- Mirrors apps/user-pwa/src/lib/mock/garages.ts. Ops will replace with real
-- onboarded garages once the dashboard is wired.
-- Phone numbers are TEST values — replace with real WhatsApp-reachable numbers
-- before going live. For dev, set them all to the verified test recipient
-- (+91 7889686682) so garage WhatsApp Accept/Decline can be exercised
-- end-to-end with just one phone.

insert into garages (
  slug, owner_first_name, owner_last_name, shop_name, phone, whatsapp_phone,
  area, full_address, distance_km, rating, jobs_completed,
  service_buckets, earliest_slot, commission_pct, active
) values
  ('g-imran-k',  'Imran',  'Khan',  'Khan Auto Detailing',
    '+917889686682', '+917889686682',
    'Hyderpora area', 'Plot 14, Hyderpora Bypass, Srinagar — 190014',
    3, 4.8, 52, '{detailing,repairs}', 'Today 4 PM', 12, true),

  ('g-faisal-m', 'Faisal', 'Mir',   'Mir Motors',
    '+917889686682', '+917889686682',
    'Lal Chowk area', 'Shop 8, Residency Road, Lal Chowk, Srinagar — 190001',
    5, 4.6, 31, '{detailing,repairs,denting}', 'Today 6 PM', 12, true),

  ('g-bilal-a',  'Bilal',  'Ahmad', 'Bemina Body Works',
    '+917889686682', '+917889686682',
    'Bemina area',    'Industrial Estate Road, Bemina, Srinagar — 190018',
    6, 4.4, 0,  '{denting,detailing}', 'Tomorrow 10 AM', 12, true),

  ('g-aamir-s',  'Aamir',  'Shah',  'Shah Garage',
    '+917889686682', '+917889686682',
    'Rambagh area',   'Near Rambagh Bridge, Srinagar — 190008',
    4, 4.7, 88, '{repairs,detailing}', 'Today 5 PM', 12, true),

  ('g-rashid-b', 'Rashid', 'Bhat',  'Bhat Auto Care',
    '+917889686682', '+917889686682',
    'Sanatnagar area','Industrial Area, Sanatnagar, Srinagar — 190005',
    7, 4.5, 24, '{repairs,denting}', 'Tomorrow 9 AM', 12, true);
