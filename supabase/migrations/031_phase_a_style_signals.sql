-- Phase A: 世界観育成の保存基盤。
--   写真相談（aspiration）のたびに、事実属性（色/シルエット/ジャンル候補/年代/ムード）を
--   日本語の事実タグで1行保存する。Phase B でこれを集計→/self に「現状の好みの傾向」として可視化する。
--   この段階では見た目は変えない（裏で保存されるだけ）。
--
-- プライバシー: attributes には worldview_tags 英語スラッグ（quiet/minimal/dark 等）を入れない。
--   日本語の事実タグのみ（三重防御と整合）。
-- RLS: 本人のみ読み書き（user_style_events 020 と同型 for all）。service role 不使用。
-- 既存テーブルは無変更（新規テーブル追加のみ）。user_style_events は別目的のため放置。

create table if not exists public.style_signals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  source      text not null default 'aspiration',  -- 由来（将来 'moodboard' 等に拡張可）
  attributes  jsonb not null,                       -- {colors,silhouettes,genres,eras,moods} 日本語事実タグのみ
  created_at  timestamptz not null default now()
);

create index if not exists style_signals_user_idx
  on public.style_signals (user_id, created_at desc);

alter table public.style_signals enable row level security;

create policy "users own style_signals"
  on public.style_signals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
