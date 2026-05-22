-- 01_services.sql — Service catalog seed
-- Detailing services have fixed prices (matches apps/user-pwa/src/lib/mock/services.ts).
-- Repairs and Denting get placeholder base prices that ops will adjust per booking
-- (is_quoted = true). All three buckets seeded so the catalog isn't half-empty.

-- ────────────────────────────────────────────────────────────────────────────
-- Detailing (fixed price)
-- ────────────────────────────────────────────────────────────────────────────

insert into services (id, bucket, name, base_price, duration_label, blurb, is_quoted, display_order, active) values
  ('foam-wash',           'detailing', 'Foam wash',            500,   '30 min',   'Snow-foam exterior wash with soft-touch dry.',         false, 10, true),
  ('machine-polish',      'detailing', 'Machine polish',       2000,  '1 hr',     'Removes minor scratches and brings back the shine.',  false, 20, true),
  ('waxing',              'detailing', 'Waxing',               1500,  '45 min',   null,                                                   false, 30, true),
  ('ceramic-coating',     'detailing', 'Ceramic coating',      15000, 'Full day', '9H glass coating. Lasts 2–3 years with care.',        false, 40, true),
  ('interior-deep-clean', 'detailing', 'Interior deep clean',  1500,  '1 hr',     null,                                                   false, 50, true),
  ('seat-shampoo',        'detailing', 'Seat shampoo',         800,   '30 min',   null,                                                   false, 60, true),
  ('engine-bay-clean',    'detailing', 'Engine bay clean',     600,   '30 min',   null,                                                   false, 70, true),
  ('underbody-coat',      'detailing', 'Underbody coat',       2500,  '1 hr',     'Anti-rust coating for the chassis.',                   false, 80, true);

-- ────────────────────────────────────────────────────────────────────────────
-- Repairs (quoted — base_price is indicative; ops sets final per booking)
-- ────────────────────────────────────────────────────────────────────────────

insert into services (id, bucket, name, base_price, duration_label, blurb, is_quoted, display_order, active) values
  ('oil-change',          'repairs', 'Oil change',           1200, '45 min',  'Synthetic engine oil + filter.',     false, 110, true),
  ('brake-pad',           'repairs', 'Brake pads',           2500, '1 hr',    'Front pad replacement.',             true,  120, true),
  ('brake-disc',          'repairs', 'Brake disc',           5500, '1.5 hr',  null,                                 true,  130, true),
  ('battery-replace',     'repairs', 'Battery replacement',  4500, '30 min',  null,                                 true,  140, true),
  ('clutch-overhaul',     'repairs', 'Clutch overhaul',      9000, '4 hr',    null,                                 true,  150, true),
  ('ac-service',          'repairs', 'AC service',           2000, '1 hr',    'Gas top-up + filter check.',         true,  160, true),
  ('diagnostic-scan',     'repairs', 'OBD diagnostic scan',  500,  '20 min',  null,                                 false, 170, true),
  ('engine-tune',         'repairs', 'Engine tune-up',       3500, '2 hr',    null,                                 true,  180, true);

-- ────────────────────────────────────────────────────────────────────────────
-- Denting & Painting (quoted — ops sets final after seeing photos)
-- ────────────────────────────────────────────────────────────────────────────

insert into services (id, bucket, name, base_price, duration_label, blurb, is_quoted, display_order, active) values
  ('small-dent',          'denting', 'Small dent repair',    1500,  '2 hr',    'Pop-out + minor touch-up paint.',                  true, 210, true),
  ('panel-dent',          'denting', 'Panel dent repair',    4000,  '4 hr',    'Single panel — door, fender, hood.',               true, 220, true),
  ('scratch-removal',     'denting', 'Scratch removal',      1200,  '1 hr',    'Compounding + polish for surface scratches.',      true, 230, true),
  ('bumper-repair',       'denting', 'Bumper repair',        3500,  '3 hr',    null,                                               true, 240, true),
  ('full-paint',          'denting', 'Full body paint',      35000, '3 days',  'Including primer + clearcoat.',                    true, 250, true),
  ('panel-paint',         'denting', 'Single panel paint',   3500,  '1 day',   null,                                               true, 260, true);
