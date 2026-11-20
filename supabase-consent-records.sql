-- LeisureLoop consent evidence migration
-- Run this in the Supabase SQL Editor before enabling booking or venue submissions.
-- Stores only the user ID, consent purpose, policy versions and timestamp; no IP/device fingerprint.

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('account_registration','booking_request','venue_listing')),
  terms_version text,
  privacy_version text,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists user_consents_user_created_idx
  on public.user_consents(user_id, created_at desc);

alter table public.user_consents enable row level security;

drop policy if exists "Users can record their own consent" on public.user_consents;
create policy "Users can record their own consent"
  on public.user_consents for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can read their own consent records" on public.user_consents;
create policy "Users can read their own consent records"
  on public.user_consents for select to authenticated
  using (auth.uid() = user_id);

grant select, insert on public.user_consents to authenticated;

-- Capture signup consent metadata even when email confirmation means the
-- user does not yet have an authenticated browser session.
create or replace function public.capture_leisureloop_signup_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
begin
  if new.raw_user_meta_data ->> 'legal_terms_accepted' = 'true' then

    insert into public.user_consents
      (user_id, purpose, terms_version, privacy_version, accepted_at)
    values
      (
        new.id,
        'account_registration',
        new.raw_user_meta_data ->> 'legal_terms_version',
        new.raw_user_meta_data ->> 'privacy_notice_version',
        now()
      );
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_leisureloop_consent on auth.users;
create trigger on_auth_user_created_leisureloop_consent
  after insert on auth.users
  for each row execute procedure public.capture_leisureloop_signup_consent();
