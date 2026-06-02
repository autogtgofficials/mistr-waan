-- 03_maintenance_rsa_services.sql — Blueprint-aligned service catalog
--
-- Adds Scheduled Maintenance (car + bike) and Roadside Assistance services
-- on top of the existing detailing/repairs/denting catalog. Fixed prices
-- where the cost is universal; is_quoted=true where it depends on parts /
-- vehicle / situation (periodic service, towing, blown tyre).

-- ────────────────────────────────────────────────────────────────────────────
-- Scheduled Maintenance — Car
-- ────────────────────────────────────────────────────────────────────────────

insert into services (id, bucket, name, base_price, duration_label, blurb, is_quoted, display_order, active) values
  ('car-oil-change',        'scheduled_maintenance', 'Car: Engine oil change',         1500, '45 min',   'Includes oil filter. Synthetic or mineral as per vehicle.', false, 10, true),
  ('car-air-filter',        'scheduled_maintenance', 'Car: Air filter replacement',     600, '15 min',   null,                                                        false, 20, true),
  ('car-brake-inspection',  'scheduled_maintenance', 'Car: Brake inspection',           300, '20 min',   'Pad wear check, fluid level, basic test drive.',            false, 30, true),
  ('car-battery-check',     'scheduled_maintenance', 'Car: Battery check',              200, '10 min',   'Load test + terminal cleaning.',                            false, 40, true),
  ('car-tyre-inspection',   'scheduled_maintenance', 'Car: Tyre inspection + rotation', 400, '30 min',   'Tread + pressure check; rotation if needed.',               false, 50, true),
  ('car-fluid-topup',       'scheduled_maintenance', 'Car: Fluid top-up',               500, '15 min',   'Coolant, washer, brake, power-steering fluids.',            false, 60, true),
  ('car-periodic-service',  'scheduled_maintenance', 'Car: Periodic service (full)',  null,  '2-3 hrs',  'Full health check + manufacturer-schedule service.',        true,  70, true),
  ('car-diagnostics',       'scheduled_maintenance', 'Car: Diagnostic scan (OBD)',      800, '20 min',   'Reads + clears engine codes; report shared on WhatsApp.',   false, 80, true);

-- ────────────────────────────────────────────────────────────────────────────
-- Scheduled Maintenance — Bike
-- ────────────────────────────────────────────────────────────────────────────

insert into services (id, bucket, name, base_price, duration_label, blurb, is_quoted, display_order, active) values
  ('bike-general-service',  'scheduled_maintenance', 'Bike: General service',         null, '1-2 hrs', 'Engine clean, chain, brakes, tuning. Parts extra.', true,  110, true),
  ('bike-oil-change',       'scheduled_maintenance', 'Bike: Engine oil change',        600, '20 min',  null,                                                false, 120, true),
  ('bike-brake-check',      'scheduled_maintenance', 'Bike: Brake check',              200, '15 min',  null,                                                false, 130, true),
  ('bike-chain-lube',       'scheduled_maintenance', 'Bike: Chain clean + lubrication',150, '15 min',  null,                                                false, 140, true),
  ('bike-tyre-check',       'scheduled_maintenance', 'Bike: Tyre check',               200, '15 min',  null,                                                false, 150, true),
  ('bike-battery-check',    'scheduled_maintenance', 'Bike: Battery check',            200, '10 min',  null,                                                false, 160, true);

-- ────────────────────────────────────────────────────────────────────────────
-- Roadside Assistance (RSA) — all dispatched immediately, ops calls customer
-- ────────────────────────────────────────────────────────────────────────────

insert into services (id, bucket, name, base_price, duration_label, blurb, is_quoted, display_order, active) values
  ('rsa-puncture',          'rsa', 'Tyre puncture repair',         300,  'On-site',   'Repair on-site if possible; tube replacement extra.',     false, 10, true),
  ('rsa-blown-tyre',        'rsa', 'Blown tyre replacement',      null,  'On-site',   'New / spare tyre fitment. Parts cost added at quote.',    true,  20, true),
  ('rsa-jump-start',        'rsa', 'Jump start',                   400,  '15 min',    'Battery jump on location.',                                false, 30, true),
  ('rsa-towing',            'rsa', 'Towing dispatch',             null,  'Variable',  'Tow truck to nearest workshop. Quoted by distance.',      true,  40, true),
  ('rsa-coolant-leak',      'rsa', 'Coolant leak / overheating',  null,  'Variable',  'On-site temporary fix or tow if severe.',                  true,  50, true),
  ('rsa-breakdown',         'rsa', 'Other breakdown',             null,  'Variable',  'Diagnosis on-site, fix or tow as required.',               true,  60, true);
