-- D1 Phase 2 ムードボード: moodboards / moodboard_items の新設
--
-- 【背景】
-- Phase 1 完成宣言(acb0b01)後、Sprint C(Phase 2)ムードボード本実装の基盤層。
-- ビジョン df36d82 MVP 優先 6 項目「商品画像・URL・ムードボードをチャットに渡す」
-- 直対応。本体 ac834bb L1042 で 026 確定済・L376 地雷 8 で is_public default false
-- (オプトイン公開)確定済。
--
-- 【設計の確定事項(本体 + Sprint C-1 設計案 60b8d87 §3 + Sprint C-2 段階1 設計案 664b661 §3.2 確定)】
-- - 判断1: moodboards / moodboard_items の 2 テーブル分離(MB = 複数画像コレクション)
-- - 判断2: is_public default false(★ 地雷 8 オプトイン公開・M3 posts は true 固定で別判断)
-- - 判断3: worldview snapshot 採用(将来 M4 マッチング素材化)
-- - 判断4: moodboard_items の RLS は親 moodboards 経由 EXISTS 判定(M3-1 二重ポリシー拡張)
--
-- 【変更内容】
-- 1. moodboards テーブル新設
-- 2. moodboard_items テーブル新設
-- 3. RLS 二重ポリシー × 2 テーブル(本人 FOR ALL + 公開行 SELECT)
-- 4. インデックス 3 本
-- 5. updated_at trigger(既存 public.handle_updated_at() 流用)
--
-- 【安全性 — M3-1 同型作法】
-- (a) 本人 FOR ALL は WITH CHECK も同条件で偽装更新を防ぐ
-- (b) 公開 SELECT は `to` 句省略 = anon + authenticated 両方
--     (public)/m/[id] が未ログイン閲覧できるための前提
-- (c) moodboard_items は親経由 EXISTS で本人 / 公開判定(子テーブル単独で穴を作らない)
-- (d) FK + ON DELETE CASCADE で整合性担保(MB 削除 → items 自動削除)
--
-- 【冪等性】
-- - create table if not exists / create index if not exists
-- - create policy は重複だとエラー → 再実行時は事前 drop policy 必要
--
-- 【ロールバック手順】
--   drop policy if exists "public moodboard_items readable by anyone" on public.moodboard_items;
--   drop policy if exists "users own moodboard_items" on public.moodboard_items;
--   drop policy if exists "public moodboards readable by anyone" on public.moodboards;
--   drop policy if exists "users own moodboards" on public.moodboards;
--   drop index if exists public.moodboard_items_board_order_idx;
--   drop index if exists public.moodboards_public_created_idx;
--   drop index if exists public.moodboards_user_created_idx;
--   drop trigger if exists moodboards_updated_at on public.moodboards;
--   drop table if exists public.moodboard_items;
--   drop table if exists public.moodboards;
--
-- 【Storage バケット】
-- 本 migration には Storage バケット(moodboard-images)の作成は含まれない。
-- 既存 post-images と同じ運用で Supabase Studio 手作業(★ 設計案 664b661 §4 手順書参照)。
--
-- 適用時の確認:
-- - 既存テーブル(users / posts / wardrobe_items / 他)は無変更
-- - moodboards / moodboard_items が空で作成される
-- - RLS は両テーブルで有効 + ポリシー各 2 本
-- - 本人は自分の MB を全権限操作可能・anon/他者は is_public=true のみ SELECT 可能

-- ---- 1. moodboards テーブル ----

create table if not exists public.moodboards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,

  -- MB メタ
  name        text not null,
  description text not null default '',

  -- ★ オプトイン公開(地雷 8 対策・M3 posts と異なる)
  is_public   boolean not null default false,

  -- 世界観 snapshot(将来 M4 同型マッチング素材化)
  worldview_tags     text[] not null default '{}',
  worldview_keywords text[] not null default '{}',
  worldview_name     text,

  -- カード表示用カバー画像(items 先頭を昇格 or 任意指定)
  cover_image_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.moodboards.is_public is
  'true なら anon 含め誰でも閲覧可能。★ MB はオプトイン公開(default false)・地雷 8 対策。';
comment on column public.moodboards.worldview_tags is
  '英語スラッグ snapshot(M4 マッチング素材・★ UI/reply には露出しない・三重防御 1)。';

-- ---- 2. moodboard_items テーブル ----

create table if not exists public.moodboard_items (
  id            uuid primary key default gen_random_uuid(),
  moodboard_id  uuid not null references public.moodboards(id) on delete cascade,

  -- 画像本体(Storage moodboard-images の public URL)
  image_url     text not null,

  -- 任意メタ
  caption       text not null default '',
  source_url    text,                       -- 参照元(楽天 / SNS 等)
  order_index   integer not null default 0, -- 並び替え用

  created_at timestamptz not null default now()
);

-- ---- 3. RLS 二重ポリシー(moodboards・M3-1 同型) ----

alter table public.moodboards enable row level security;

create policy "users own moodboards"
  on public.moodboards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "public moodboards readable by anyone"
  on public.moodboards for select
  using (is_public = true);

-- ---- 4. RLS 二重ポリシー(moodboard_items・親経由 EXISTS) ----

alter table public.moodboard_items enable row level security;

create policy "users own moodboard_items"
  on public.moodboard_items for all
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

create policy "public moodboard_items readable by anyone"
  on public.moodboard_items for select
  using (
    exists (
      select 1 from public.moodboards m
      where m.id = moodboard_id and m.is_public = true
    )
  );

-- ---- 5. インデックス ----

create index if not exists moodboards_user_created_idx
  on public.moodboards (user_id, created_at desc);

create index if not exists moodboards_public_created_idx
  on public.moodboards (created_at desc) where is_public = true;

create index if not exists moodboard_items_board_order_idx
  on public.moodboard_items (moodboard_id, order_index);

-- ---- 6. updated_at trigger(既存 public.handle_updated_at() 流用) ----

create trigger moodboards_updated_at
  before update on public.moodboards
  for each row execute function public.handle_updated_at();
