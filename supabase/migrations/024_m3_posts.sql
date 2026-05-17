-- ビジョンマップ MVP M3-1: 投稿テーブル posts の新設
--
-- 【背景】
-- M1(診断本番化)・M2(世界観プロフィール公開)完了後、③繋がる の最小基盤
-- として posts を新設する。ユーザーが自分の世界観に紐づいた投稿(画像 + caption)を
-- 作成・公開できる土台。M4(世界観マッチング)の素材にもなる。
--
-- 【設計の確定事項(オーナー確定・設計ドキュメント参照)】
-- - 判断1: 画像必須(MVP 仕様。EXIF 除去・サイズ/形式制限は M3-2 で実装)
-- - 判断2: is_public 列は持つが MVP は UI で選ばせず投稿時 true 固定
--           (将来「下書き」「フォロワー限定」で活用)
-- - 判断3: 投稿閲覧は /u/[userId]・/p/[postId]・/self 作成 UI の3箇所
-- - 世界観: スナップショット型(投稿時に worldview_tags 等をコピー・以後不変)
--
-- 【変更内容】
-- 1. posts テーブル新設
-- 2. RLS 二重ポリシー(M2-1 で確立した作法を再利用)
--    a) 本人 FOR ALL: author 自身は下書き含めて全行操作可
--    b) 公開行 SELECT: is_public=true 行は anon + authenticated が読める
-- 3. インデックス2本
--    a) (author_user_id, created_at desc): /u/[userId] の投稿一覧高速化
--    b) (created_at desc) where is_public=true: 公開フィード高速化(M4 用)
--
-- 【安全性 — M2-1 と同じ作法を厳守】
-- (a) 本人限定 FOR ALL は WITH CHECK も同条件で偽装更新を防ぐ
-- (b) 公開 SELECT は `to` 句省略 = anon + authenticated 両方
--     /p/[postId] 公開ページが未ログインでも閲覧できるため
-- (c) Supabase デフォルト GRANT(public schema 全テーブル)で anon/authenticated が
--     SELECT 可能。RLS が is_public=true 行のみに絞る(M2-1 と同じ二層)。
-- (d) author_user_id は users(id) FK + ON DELETE CASCADE
--     ユーザー削除で投稿も自動削除されるためデータ整合性を保つ
--
-- 【冪等性】
-- - create table if not exists
-- - create index if not exists
-- - create policy は重複だとエラー。再実行時は事前 drop policy が必要
--
-- 【ロールバック手順】
--   drop policy if exists "public posts readable by anyone" on public.posts;
--   drop policy if exists "users own posts" on public.posts;
--   drop index if exists public.posts_public_created_idx;
--   drop index if exists public.posts_author_created_idx;
--   drop table if exists public.posts;
--
-- 【Storage バケット】
-- 本 migration には posts.image_url が指す Storage バケットの作成は含まれない。
-- 既存 WARDROBE_BUCKET / KNOWLEDGE_BUCKET と同じ運用で、Supabase Studio で
-- "post-images" バケットを手動作成する必要がある(M3-1 作業3 で手順報告)。
--
-- 適用時の確認:
-- - 既存テーブル・ポリシー(users / worldview_profiles / 等)は無変更
-- - posts テーブルが空で作成される
-- - RLS は有効 + ポリシー2本
-- - 本人は自分の posts を全権限操作可能(本人 FOR ALL)
-- - anon/他者は is_public=true 行だけ SELECT 可能(公開行 SELECT)

-- ---- 1. posts テーブル ----

create table if not exists public.posts (
  id              uuid primary key default gen_random_uuid(),
  author_user_id  uuid not null references public.users(id) on delete cascade,

  -- 投稿コンテンツ
  image_url       text not null,
  caption         text not null default '',

  -- 世界観スナップショット(投稿時にコピー・以後不変)
  -- M4(世界観マッチング)で worldview_tags overlap 演算に使う
  worldview_tags     text[] not null default '{}',
  worldview_keywords text[] not null default '{}',
  worldview_name     text,           -- 投稿時の固有世界観名
  pattern_id         text,           -- 8 パターン legacy ユーザー用

  -- 公開制御(MVP は投稿時 true 固定で運用)
  is_public boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.posts.worldview_tags is
  '投稿時の英語スラッグ snapshot(例: ["dark","minimal"])。M4 マッチング素材。再診断後も不変。';
comment on column public.posts.is_public is
  'true なら anon 含め誰でも閲覧可能。MVP では投稿時 true 固定で運用。将来「下書き」「フォロワー限定」で活用。';

-- ---- 2. RLS 二重ポリシー(M2-1 と同じ作法) ----

alter table public.posts enable row level security;

-- 本人 FOR ALL: author 本人は下書き含めて自分の posts を全権限操作可
create policy "users own posts"
  on public.posts for all
  using (auth.uid() = author_user_id)
  with check (auth.uid() = author_user_id);

-- 公開行 SELECT: anon + authenticated 両方に is_public=true 行を開く
-- `to` 句省略 = default public ロール = anon + authenticated 両方に適用
-- /p/[postId] や /u/[userId] の投稿一覧が未ログイン閲覧できるための前提
create policy "public posts readable by anyone"
  on public.posts for select
  using (is_public = true);

-- ---- 3. インデックス ----

-- /u/[userId] の「この人の投稿」一覧用(author + 新着順)
create index if not exists posts_author_created_idx
  on public.posts (author_user_id, created_at desc);

-- 公開投稿の新着順(M4 マッチング・将来の全体フィード用)
-- WHERE is_public=true の partial index で容量を抑える
create index if not exists posts_public_created_idx
  on public.posts (created_at desc) where is_public = true;
