-- LeisureLoop self-managed PostgreSQL foundation.
-- This is a NEW schema for the planned custom backend. It does not modify or
-- replace the live Supabase database. Apply only to a separate PostgreSQL DB.

create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  full_name text not null default '',
  account_type text not null default 'buyer'
    check (account_type in ('buyer','owner','admin')),
  owner_status text not null default 'not_applicable'
    check (owner_status in ('not_applicable','pending','approved','rejected')),
  email_verified_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_email_lowercase check (email = lower(email))
);
create unique index if not exists app_users_email_unique on app_users(email);

-- Store only SHA-256 hashes of high-entropy random session tokens.
create table if not exists app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  token_hash char(64) not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists app_sessions_user_idx on app_sessions(user_id);
create index if not exists app_sessions_expiry_idx on app_sessions(expires_at);

-- purpose is email_verification or password_reset. Tokens are one-time use.
create table if not exists app_email_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  purpose text not null check (purpose in ('email_verification','password_reset')),
  token_hash char(64) not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists app_email_tokens_user_purpose_idx
  on app_email_tokens(user_id, purpose, created_at desc);

create table if not exists venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app_users(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 3 and 120),
  category text not null default 'Other',
  description text not null default '',
  address text not null,
  city text not null,
  hourly_rate numeric(10,2) not null check (hourly_rate >= 0),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists venues_owner_idx on venues(owner_id);
create index if not exists venues_public_search_idx on venues(status, city, category);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete restrict,
  owner_id uuid not null references app_users(id) on delete restrict,
  customer_id uuid not null references app_users(id) on delete restrict,
  booking_date date not null,
  start_time time not null,
  duration_hours integer not null check (duration_hours between 1 and 24),
  group_size integer not null default 1 check (group_size between 1 and 100),
  customer_name text not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bookings_owner_idx on bookings(owner_id, status, created_at desc);
create index if not exists bookings_customer_idx on bookings(customer_id, created_at desc);
create index if not exists bookings_venue_date_idx on bookings(venue_id, booking_date);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references app_users(id) on delete cascade,
  booking_id uuid references bookings(id) on delete cascade,
  notification_type text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_idx
  on notifications(recipient_id, created_at desc);

create table if not exists admin_audit_log (
  id bigserial primary key,
  admin_id uuid references app_users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Never grant browser clients direct database access. All access goes through
-- authenticated server-side API routes with parameterized SQL and role checks.
