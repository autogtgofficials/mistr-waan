-- Week 2: booking_notes for ops/garage commentary on a booking,
-- plus the booking-photos Storage bucket + RLS policies.
--
-- booking_notes is a separate table (not the audit log) because the notes
-- are user-facing data — ops needs to see them in the dashboard, the garage
-- needs to read instructions, etc. Audit log is for compliance/debug only.

create table booking_notes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  author text not null,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index booking_notes_booking_idx on booking_notes(booking_id, created_at desc);

alter table booking_notes enable row level security;
-- No anon policies. Server-side service-role only.

-- Storage bucket for booking photos. Private — signed URLs minted server-side.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'booking-photos',
  'booking-photos',
  false,
  8 * 1024 * 1024, -- 8 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;
