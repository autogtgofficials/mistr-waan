-- Phase 5 — Blueprint Alignment
--
-- Brings the schema in line with the Auto GTG MVP Chatbot blueprint:
--   1. Adds `scheduled_maintenance` + `rsa` to the booking_bucket enum
--      (additive — the existing detailing/repairs/denting buckets keep
--      working, customer wizard groups them under "Additional Services").
--   2. Adds vehicle context to bookings (type=car/bike, brand, model,
--      registration). Blueprint captures this on every booking.
--   3. Extends garages with the fields the 12-step mechanic onboarding
--      chatbot collects (onboarding_status, working_hours, weekly_off,
--      rsa_available, rsa_radius_km, pickup_available, verification_doc_path).
--   4. Creates a private `verification-docs` Storage bucket for the
--      Aadhaar / DL / Shop Reg / GST upload step.

alter type booking_bucket add value if not exists 'scheduled_maintenance';
alter type booking_bucket add value if not exists 'rsa';

create type vehicle_type as enum ('car', 'bike');

alter table bookings
  add column vehicle_type vehicle_type,
  add column vehicle_brand text,
  add column vehicle_model text,
  add column vehicle_registration text;

create type garage_onboarding_status as enum (
  'pending_verification', 'active', 'rejected', 'suspended'
);

alter table garages
  add column onboarding_status garage_onboarding_status default 'active',
  add column working_hours text,
  add column weekly_off text,
  add column rsa_available boolean default false,
  add column rsa_radius_km integer,
  add column pickup_available boolean default false,
  add column verification_doc_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-docs',
  'verification-docs',
  false,
  8 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do nothing;
