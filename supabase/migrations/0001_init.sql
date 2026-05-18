-- NarPulse — initial schema
-- Run via `supabase db push` or paste into the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ============== OUTAGES ==============
create table public.outages (
  id uuid primary key default gen_random_uuid(),
  utility text not null check (utility in ('water','electricity','gas')),
  status text not null default 'active' check (status in ('planned','active','resolved')),
  area_name text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_m integer not null default 400,
  started_at timestamptz not null default now(),
  estimated_end timestamptz,
  resolved_at timestamptz,
  source text check (source in ('azersu','azerisiq','socar','manual')),
  source_url text,
  description text,
  created_at timestamptz not null default now()
);
create index on public.outages (status, started_at desc);

-- ============== SERVICE LOCATIONS + WAIT CHECK-INS ==============
create table public.service_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('asan','poliklinika','post','rih','bank')),
  lat double precision not null,
  lng double precision not null,
  address text,
  opens_at time,
  closes_at time
);

create table public.wait_checkins (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.service_locations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  wait_minutes integer not null check (wait_minutes between 0 and 240),
  reported_at timestamptz not null default now()
);
create index on public.wait_checkins (location_id, reported_at desc);

-- ============== SAFETY PINS ==============
create table public.safety_pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  lat double precision not null,
  lng double precision not null,
  category text not null check (category in ('crossing','lighting','traffic','sidewalk','other')),
  description text,
  photo_url text,
  upvotes integer not null default 0,
  status text not null default 'pending' check (status in ('pending','reviewed','resolved')),
  created_at timestamptz not null default now()
);
create index on public.safety_pins (status, upvotes desc);

create table public.pin_votes (
  pin_id uuid not null references public.safety_pins(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (pin_id, user_id)
);

-- Atomic upvote on vote insert
create or replace function public.handle_pin_vote()
returns trigger language plpgsql as $$
begin
  update public.safety_pins set upvotes = upvotes + 1 where id = new.pin_id;
  return new;
end; $$;

drop trigger if exists on_pin_vote_insert on public.pin_votes;
create trigger on_pin_vote_insert
  after insert on public.pin_votes
  for each row execute function public.handle_pin_vote();

-- ============== PROFILES + ROLES ==============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'resident' check (role in ('resident','admin')),
  display_name text,
  district text default 'Nərimanov'
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============== STORAGE ==============
insert into storage.buckets (id, name, public)
values ('safety-photos', 'safety-photos', true)
on conflict (id) do nothing;

create policy "safety-photos-public-read" on storage.objects
  for select using (bucket_id = 'safety-photos');
create policy "safety-photos-auth-insert" on storage.objects
  for insert with check (bucket_id = 'safety-photos' and auth.uid() is not null);

-- ============== RLS ==============
alter table public.outages enable row level security;
alter table public.service_locations enable row level security;
alter table public.wait_checkins enable row level security;
alter table public.safety_pins enable row level security;
alter table public.pin_votes enable row level security;
alter table public.profiles enable row level security;

create policy "outages_public_read" on public.outages for select using (true);
create policy "outages_admin_write" on public.outages for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

create policy "locations_public_read" on public.service_locations for select using (true);

create policy "checkins_public_read" on public.wait_checkins for select using (true);
create policy "checkins_auth_insert" on public.wait_checkins for insert with check (auth.uid() is not null);

create policy "pins_public_read" on public.safety_pins for select using (true);
create policy "pins_auth_insert" on public.safety_pins for insert with check (auth.uid() is not null);
create policy "pins_admin_update" on public.safety_pins for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

create policy "votes_auth_all" on public.pin_votes for all using (auth.uid() = user_id);
create policy "votes_public_read" on public.pin_votes for select using (true);

create policy "profiles_self_read" on public.profiles for select using (auth.uid() = id);
create policy "profiles_admin_read" on public.profiles for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- ============== REALTIME ==============
alter publication supabase_realtime add table public.outages;
alter publication supabase_realtime add table public.wait_checkins;
alter publication supabase_realtime add table public.safety_pins;
