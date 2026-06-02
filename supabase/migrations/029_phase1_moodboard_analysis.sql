-- Phase 1: moodboard_analysis（board単位の構造化解析 = context object）
--
-- 目的: ムードボードを長文プロンプトではなく構造化データとして 1 回だけ解析・保存し、
--   チャット短文化の起点にする。1 MB に 1 行（moodboard_id 主キー＝1:1）。
--   再解析は upsert で上書き（版管理なし・最小）。
--
-- 冪等性: create table / create policy ともに存在チェックで二重実行安全。
-- 既存テーブル（moodboards / moodboard_items / 他）は無変更。
--
-- RLS: moodboards / moodboard_items と同型。
--   本人は親 moodboards 経由 EXISTS で全権限。public は親 is_public=true 経由で SELECT 可能。

-- ---- 1. moodboard_analysis テーブル ----

create table if not exists public.moodboard_analysis (
  moodboard_id   uuid primary key references public.moodboards(id) on delete cascade,

  worldview_core text        not null default '',          -- 世界観コア（1〜2文）
  colors         text[]      not null default '{}',         -- 色
  materials      text[]      not null default '{}',         -- 素材
  silhouettes    text[]      not null default '{}',         -- シルエット・丈
  mood           text        not null default '',           -- 空気感
  ng_elements    text[]      not null default '{}',         -- 世界観に合わない/避ける要素
  shopping_axis  jsonb       not null default '{}'::jsonb,   -- 買う判断軸（shopping_guidelines を内包）

  source         text        not null default 'claude',     -- 生成元（モデル名等）
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.moodboard_analysis is
  'ムードボードの board単位 context object（世界観コア/色/素材/シルエット/空気感/NG/買う判断軸）。1 MB に 1 行・再解析で上書き。';
comment on column public.moodboard_analysis.shopping_axis is
  '買う判断軸（jsonb）。where_to_look / check_points / avoid_when 等。固有店名に依存しない普遍的指針。';

-- ---- 2. RLS（moodboards / moodboard_items と同型・親経由 EXISTS）----

alter table public.moodboard_analysis enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'moodboard_analysis'
      and policyname = 'users own moodboard_analysis'
  ) then
    create policy "users own moodboard_analysis"
      on public.moodboard_analysis for all
      using (
        exists (
          select 1 from public.moodboards m
          where m.id = moodboard_id and m.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.moodboards m
          where m.id = moodboard_id and m.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'moodboard_analysis'
      and policyname = 'public moodboard_analysis readable by anyone'
  ) then
    create policy "public moodboard_analysis readable by anyone"
      on public.moodboard_analysis for select
      using (
        exists (
          select 1 from public.moodboards m
          where m.id = moodboard_id and m.is_public = true
        )
      );
  end if;
end $$;
