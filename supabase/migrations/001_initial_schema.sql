-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ---- users ----
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  style_axis jsonb,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users can read own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "users can update own profile"
  on public.users for update
  using (auth.uid() = id);

create policy "users can insert own profile"
  on public.users for insert
  with check (auth.uid() = id);

-- ---- wardrobe_items ----
create table if not exists public.wardrobe_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  category text not null check (category in ('tops','bottoms','outerwear','shoes','accessories','bags','other')),
  color text not null,
  material text,
  brand text,
  season text not null default 'all' check (season in ('spring','summer','autumn','winter','all')),
  image_url text,
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wardrobe_items enable row level security;

create policy "users can manage own wardrobe"
  on public.wardrobe_items for all
  using (auth.uid() = user_id);

create index wardrobe_items_user_id_idx on public.wardrobe_items(user_id);

-- ---- coordinates ----
create table if not exists public.coordinates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  items jsonb not null default '[]',
  color_story text not null,
  belief_alignment text not null,
  trend_note text,
  occasion text,
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.coordinates enable row level security;

create policy "users can manage own coordinates"
  on public.coordinates for all
  using (auth.uid() = user_id);

create index coordinates_user_id_idx on public.coordinates(user_id);

-- ---- updated_at trigger ----
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at
  before update on public.users
  for each row execute function public.handle_updated_at();

create trigger wardrobe_items_updated_at
  before update on public.wardrobe_items
  for each row execute function public.handle_updated_at();

-- ---- auto-create user profile on signup ----
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
