-- 0001_init.sql — Mistr Waan initial schema
-- Per /Users/farhan/.claude/plans/ask-me-questions-all-velvety-bentley.md
-- All access is server-side via SUPABASE_SERVICE_ROLE_KEY; RLS is enabled but no
-- policies are added for the anon role. Customers/garages never hit Supabase
-- from the browser.

create extension if not exists "pgcrypto";  -- for gen_random_uuid()

-- ============================================================================
-- Enums
-- ============================================================================

create type booking_status as enum (
  'queued_for_call',
  'quoted',
  'awaiting_garage',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
  'declined_by_garage'
);

create type booking_bucket as enum ('detailing', 'repairs', 'denting');
create type payment_mode  as enum ('upi', 'cash');
create type payment_status as enum ('pending','authorized','captured','refunded','failed');
create type quote_source  as enum ('catalog_fixed','ops_manual','ops_adjusted');
create type notif_channel as enum ('whatsapp','sms','email');
create type notif_direction as enum ('outbound','inbound');
create type notif_state   as enum ('queued','sent','delivered','read','failed');
create type rating_target as enum ('garage','platform');
create type referral_state as enum ('pending','rewarded','expired');
create type garage_response as enum ('accept','decline');
create type actor_role    as enum ('customer','garage','ops','system','bot');
create type ops_role      as enum ('ops','admin');

-- ============================================================================
-- Helper trigger to keep updated_at fresh
-- ============================================================================

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- profiles — customers (1 per phone)
-- ============================================================================

create table profiles (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  first_name text default 'User',
  language text default 'en',
  referral_code text unique,
  referred_by uuid references profiles(id) on delete set null,
  loyalty_points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create index profiles_phone_idx on profiles(phone);
create index profiles_referral_code_idx on profiles(referral_code);
create index profiles_referred_by_idx on profiles(referred_by);

create trigger profiles_touch_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ============================================================================
-- mechanics — migrated from apps/ops/data/mechanics.json
-- Same rich shape so the existing ops viewer keeps working.
-- ============================================================================

create table mechanics (
  id text primary key,
  source text,
  source_id text,
  osm_type text,
  name text not null,
  shop_name text,
  phones text[] not null default '{}',
  email text,
  website text,
  address text,
  area text,
  area_source text,
  lat double precision,
  lng double precision,
  services text[] not null default '{}',
  opening_hours text,
  osm_rating numeric,
  review_count integer,
  onboarding_status text not null default 'not_contacted',
  notes text,
  outreach_outcome text,
  detailed_services text[] default '{}',
  pricing jsonb,
  coverage_areas text[] default '{}',
  business_profile jsonb,
  call_log jsonb default '[]'::jsonb,
  next_follow_up_at timestamptz,
  next_follow_up_note text,
  tags text[] default '{}',
  raw_tags jsonb,
  reverse_geocode jsonb,
  scraped_at timestamptz,
  last_updated_at timestamptz not null default now()
);

create index mechanics_area_idx on mechanics(area);
create index mechanics_onboarding_status_idx on mechanics(onboarding_status);
create index mechanics_services_idx on mechanics using gin(services);

create trigger mechanics_touch_updated_at
  before update on mechanics
  for each row execute function set_updated_at();

-- ============================================================================
-- garages — onboarded shops (links back to a mechanics row when applicable)
-- ============================================================================

create table garages (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  owner_first_name text not null,
  owner_last_name text not null,
  shop_name text not null,
  phone text not null,
  whatsapp_phone text,
  area text not null,
  full_address text not null,
  lat double precision,
  lng double precision,
  distance_km numeric,
  rating numeric not null default 0,
  jobs_completed integer not null default 0,
  service_buckets booking_bucket[] not null default '{}',
  earliest_slot text,
  commission_pct numeric not null default 12,
  active boolean not null default true,
  mechanic_id text references mechanics(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index garages_area_idx on garages(area);
create index garages_service_buckets_idx on garages using gin(service_buckets);
create index garages_active_idx on garages(active);
create index garages_phone_idx on garages(phone);

create trigger garages_touch_updated_at
  before update on garages
  for each row execute function set_updated_at();

-- ============================================================================
-- services — catalog (detailing fixed price, repairs+denting quoted)
-- ============================================================================

create table services (
  id text primary key,
  bucket booking_bucket not null,
  name text not null,
  base_price integer not null,
  duration_label text,
  blurb text,
  is_quoted boolean not null default false,
  display_order integer not null default 0,
  active boolean not null default true
);

create index services_bucket_idx on services(bucket);
create index services_active_idx on services(active);

-- ============================================================================
-- bookings — replaces sessionStorage mw_mock_jobs
-- ============================================================================

create table bookings (
  id uuid primary key default gen_random_uuid(),
  short_id text unique not null,
  profile_id uuid not null references profiles(id) on delete restrict,
  bucket booking_bucket not null,
  service_ids text[] not null default '{}',
  garage_id uuid references garages(id) on delete set null,
  slot_date date,
  slot_time time,
  slot_label text not null,
  payment_mode payment_mode not null,
  total integer,
  base_total integer,
  status booking_status not null default 'queued_for_call',
  symptoms jsonb,
  denting jsonb,
  cancellation_reason text,
  rating_value smallint check (rating_value between 1 and 5),
  rating_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  queued_for_call_at timestamptz not null default now(),
  quoted_at timestamptz,
  assigned_at timestamptz,
  in_progress_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);

create index bookings_profile_id_idx on bookings(profile_id);
create index bookings_garage_id_idx on bookings(garage_id);
create index bookings_status_idx on bookings(status);
create index bookings_bucket_idx on bookings(bucket);
create index bookings_created_at_idx on bookings(created_at desc);
create index bookings_short_id_idx on bookings(short_id);

create trigger bookings_touch_updated_at
  before update on bookings
  for each row execute function set_updated_at();

-- ============================================================================
-- quotes — every change to bookings.total leaves a trail
-- ============================================================================

create table quotes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  amount integer not null,
  source quote_source not null,
  note text,
  set_by_actor text,
  created_at timestamptz not null default now()
);

create index quotes_booking_id_idx on quotes(booking_id);
create index quotes_created_at_idx on quotes(created_at desc);

-- ============================================================================
-- booking_photos — for repairs + denting intake (storage = Supabase Storage)
-- ============================================================================

create table booking_photos (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  storage_path text not null,
  mime_type text,
  size_bytes integer,
  uploaded_at timestamptz not null default now()
);

create index booking_photos_booking_id_idx on booking_photos(booking_id);

-- ============================================================================
-- payments — Razorpay order + payment metadata
-- ============================================================================

create table payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete restrict,
  mode payment_mode not null,
  amount integer not null,
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  razorpay_signature text,
  status payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  captured_at timestamptz,
  raw_payload jsonb
);

create index payments_booking_id_idx on payments(booking_id);
create index payments_status_idx on payments(status);
create index payments_razorpay_order_id_idx on payments(razorpay_order_id);

-- ============================================================================
-- ratings — one row per booking, separate from bookings.rating_value
-- ============================================================================

create table ratings (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique not null references bookings(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  garage_id uuid not null references garages(id) on delete cascade,
  target rating_target not null default 'garage',
  score smallint not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index ratings_garage_id_idx on ratings(garage_id);
create index ratings_profile_id_idx on ratings(profile_id);

-- ============================================================================
-- referrals
-- ============================================================================

create table referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id) on delete cascade,
  referee_id uuid references profiles(id) on delete set null,
  code text not null,
  booking_id uuid references bookings(id) on delete set null,
  reward_amount integer not null default 200,
  state referral_state not null default 'pending',
  created_at timestamptz not null default now(),
  rewarded_at timestamptz
);

create index referrals_referrer_id_idx on referrals(referrer_id);
create index referrals_referee_id_idx on referrals(referee_id);
create index referrals_code_idx on referrals(code);

-- ============================================================================
-- notifications_outbox — every WhatsApp send + inbound
-- ============================================================================

create table notifications_outbox (
  id uuid primary key default gen_random_uuid(),
  channel notif_channel not null,
  direction notif_direction not null,
  to_phone text,
  from_phone text,
  booking_id uuid references bookings(id) on delete set null,
  template_name text,
  variables jsonb,
  body text,
  provider text,
  provider_message_id text,
  state notif_state not null default 'queued',
  state_detail text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  raw_payload jsonb
);

create index notifications_booking_id_idx on notifications_outbox(booking_id);
create index notifications_provider_message_id_idx on notifications_outbox(provider_message_id);
create index notifications_to_phone_idx on notifications_outbox(to_phone);
create index notifications_state_idx on notifications_outbox(state);
create index notifications_created_at_idx on notifications_outbox(created_at desc);

-- ============================================================================
-- ops_users — shared-login bootstrap + invite-only seats
-- ============================================================================

create table ops_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role ops_role not null default 'ops',
  invited_by uuid references ops_users(id) on delete set null,
  invite_token text,
  invite_accepted_at timestamptz,
  last_login_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index ops_users_email_idx on ops_users(email);
create index ops_users_active_idx on ops_users(active);

-- ============================================================================
-- Aggregate update — when a rating is added, recompute garage.rating + jobs_completed
-- ============================================================================

create or replace function recompute_garage_rating() returns trigger as $$
begin
  update garages g
  set rating = coalesce((select avg(score) from ratings r where r.garage_id = g.id), 0),
      jobs_completed = (select count(*) from bookings b where b.garage_id = g.id and b.status = 'completed')
  where g.id = new.garage_id;
  return new;
end;
$$ language plpgsql;

create trigger ratings_recompute_on_insert
  after insert on ratings
  for each row execute function recompute_garage_rating();

-- ============================================================================
-- RLS — enable on every table; no anon policies (service-role only)
-- ============================================================================

alter table profiles            enable row level security;
alter table mechanics           enable row level security;
alter table garages             enable row level security;
alter table services            enable row level security;
alter table bookings            enable row level security;
alter table quotes              enable row level security;
alter table booking_photos      enable row level security;
alter table payments            enable row level security;
alter table ratings             enable row level security;
alter table referrals           enable row level security;
alter table notifications_outbox enable row level security;
alter table ops_users           enable row level security;
