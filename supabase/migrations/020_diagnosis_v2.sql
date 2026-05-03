-- Sprint 42: パターン駆動診断のためのテーブル群
--
-- 1. diagnosis_sessions: 診断セッションの詳細記録（abandoned 含む全件）
-- 2. worldview_profiles: ユーザーごとの最新確定プロファイル（user_id 主キー）
-- 3. user_style_events:  学習用の行動イベントログ（クリック・保存・拒否など）
--
-- 既存テーブルとの関係:
-- - users.style_analysis は引き続き更新する（既存APIの後方互換）
-- - ai_history(type='diagnosis') は簡易参照として残す
-- - diagnosis_sessions が真のソース・オブ・トゥルース

create table if not exists public.diagnosis_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.users(id) on delete cascade,
  answers         jsonb not null,
  matched_pattern text,
  scores          jsonb,
  result          jsonb,
  completed       boolean not null default false,
  created_at      timestamptz not null default now()
);

create index diagnosis_sessions_user_idx
  on public.diagnosis_sessions (user_id, created_at desc);

alter table public.diagnosis_sessions enable row level security;

create policy "users own diagnosis_sessions"
  on public.diagnosis_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.worldview_profiles (
  user_id        uuid primary key references public.users(id) on delete cascade,
  pattern_id     text not null,
  pattern_name   text not null,
  result         jsonb not null,
  source_session uuid references public.diagnosis_sessions(id) on delete set null,
  updated_at     timestamptz not null default now()
);

alter table public.worldview_profiles enable row level security;

create policy "users own worldview_profile"
  on public.worldview_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.user_style_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete cascade,
  event_type  text not null,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

create index user_style_events_user_type_idx
  on public.user_style_events (user_id, event_type, created_at desc);

alter table public.user_style_events enable row level security;

create policy "users own user_style_events"
  on public.user_style_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
