-- Sprint 41: 手動商品キュレーション基盤
--
-- external_products に世界観タグ・体型適性タグ等のキュレーション情報を追加。
-- product_concept_tags は商品とコンセプトの多対多関係（重み付き）。
--
-- 既存ファッション関連データは source='rakuten' のまま。
-- 管理者が新規登録する商品は source='manual' で source+external_id ユニーク。

-- ---- 1. external_products 拡張 ----

alter table public.external_products
  add column if not exists worldview_tags     text[] not null default '{}',
  add column if not exists body_compat_tags   text[] not null default '{}',
  add column if not exists curation_notes     text,
  add column if not exists curation_priority  integer not null default 0
                                              check (curation_priority between 0 and 100),
  add column if not exists curated_by         uuid references public.users(id) on delete set null,
  add column if not exists match_reason_template text;

-- worldview_tags / body_compat_tags の GIN インデックス（フィルタ高速化）
create index if not exists external_products_worldview_tags_idx
  on public.external_products using gin (worldview_tags);
create index if not exists external_products_body_compat_tags_idx
  on public.external_products using gin (body_compat_tags);

-- 優先度降順でのソート用（priority>0 の partial index）
create index if not exists external_products_curation_priority_idx
  on public.external_products (curation_priority desc) where curation_priority > 0;

-- source が manual の行のサブセット用
create index if not exists external_products_source_priority_idx
  on public.external_products (source, curation_priority desc);

-- ---- 2. product_concept_tags（商品×コンセプトの多対多） ----

create table if not exists public.product_concept_tags (
  product_id      uuid not null references public.external_products(id) on delete cascade,
  concept_keyword text not null,
  weight          integer not null default 50 check (weight between 1 and 100),
  created_at      timestamptz not null default now(),
  primary key (product_id, concept_keyword)
);

create index if not exists product_concept_tags_keyword_idx
  on public.product_concept_tags (concept_keyword);

alter table public.product_concept_tags enable row level security;

create policy "authenticated users can read product_concept_tags"
  on public.product_concept_tags for select
  to authenticated
  using (true);

-- 書き込みは service role 経由のみ（admin API から）。INSERT/UPDATE/DELETE ポリシーは作らない。

-- 補足:
-- source='manual' の external_id はサーバー側で UUID を自動採番する（crypto.randomUUID()）。
-- ソフト削除は is_available=false への UPDATE で行う（DELETE しない）。
-- product_concept_tags は ON DELETE CASCADE だが、ソフト削除時には削除されない。
