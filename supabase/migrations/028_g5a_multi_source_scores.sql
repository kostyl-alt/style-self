-- Sprint G-5a(028): external_products に multi-source 本番価値カラムを追加(E-0g §3 核心・Layer 2 開始の必須前提)
--
-- 【背景】
-- E-0g(93d39ae)「multi-source product catalog・服好き感度」+ Sprint G-L2 設計調査(a08d36b)§F で確定。
-- Layer 1(楽天 = 技術検証・verify「出たよ・質は悪い」)完了後、Layer 2「服好きが欲しくなる商品」を
-- 出すための ★ ソース横断の品質/感度スコア基盤。
--
-- 【設計の確定事項(Sprint G-L2 §0/§F)】
-- - E-0g §3 希望 18 カラムの ★ 大半は既存(004 source/external_id/affiliate_url/image_url/brand/name/price/
--   normalized_* + 017 worldview_tags)→ 本 migration の新規は ★ 4 カラムのみ。
-- - 既存 14 カラム・楽天同期データは無変更(破損ゼロ)。
--
-- 【変更内容】
-- 1. style_tags text[](スタイルタグ・E-0a ベース・worldview_tags と別軸)
-- 2. source_quality_score  smallint 0-100(ソース信頼性・Sprint G-L2 §D: 楽天=90/ZOZO=85 等)
-- 3. image_quality_score   smallint 0-100(try-on 適合度・G-3b で評価)
-- 4. fashion_sensitivity_score smallint 0-100(★ E-0g 核心・服好き感度・G-7 で評価)
-- 5. 既存楽天データの source_quality_score を 90 で埋め戻し(他スコアは NULL = 未評価)
-- 6. composite index(候補抽出の感度/品質ソート用)
--
-- 【安全性】
-- - add column if not exists(冪等)・全て NULL 許容(NOT NULL 制約を課さない=既存行を壊さない)
-- - style_tags のみ default '{}'(配列の null 回避・既存 worldview_tags 慣習に合わせる)
-- - source_quality_score は楽天既存行のみ 90 埋め戻し(他カラムは NULL のまま=順次評価)
--
-- 【適用】★ ★ ★ 本ファイルは G-5a で ★ 作成のみ。Supabase への適用は ★ G-5b(別 sprint)。
--
-- 【ロールバック手順(G-5b 失敗時)】
--   drop index if exists public.external_products_quality_sensitivity_idx;
--   alter table public.external_products
--     drop column if exists fashion_sensitivity_score,
--     drop column if exists image_quality_score,
--     drop column if exists source_quality_score,
--     drop column if exists style_tags;
--
-- 【期待される結果】
-- - 既存 14 カラム・楽天同期データ 無変更
-- - +4 カラム追加(楽天行は source_quality_score=90・他 NULL)

-- ---- 1. +4 カラム ADD(冪等・NULL 許容)----
alter table public.external_products
  add column if not exists style_tags                text[]   not null default '{}',
  add column if not exists source_quality_score      smallint check (source_quality_score      between 0 and 100),
  add column if not exists image_quality_score       smallint check (image_quality_score       between 0 and 100),
  add column if not exists fashion_sensitivity_score smallint check (fashion_sensitivity_score between 0 and 100);

comment on column public.external_products.style_tags is
  'スタイルタグ(E-0a ベース・worldview_tags と別軸)。G-7 で評価・順次。';
comment on column public.external_products.source_quality_score is
  'ソース信頼性 0-100(Sprint G-L2 §D: 楽天=90/ZOZO=85 等)。';
comment on column public.external_products.image_quality_score is
  'try-on 適合度 0-100(G-3b で評価)。NULL=未評価。';
comment on column public.external_products.fashion_sensitivity_score is
  '★ E-0g 核心: 服好き感度 0-100(G-7 で LLM+ベースライン評価)。NULL=未評価。';

-- ---- 2. 既存楽天データの source_quality_score 埋め戻し(楽天=90・他スコアは NULL のまま)----
update public.external_products
set source_quality_score = 90
where source = 'rakuten' and source_quality_score is null;

-- ---- 3. インデックス(候補抽出の感度/品質ソート用・Sprint G v2 §D の総合スコア前提)----
create index if not exists external_products_quality_sensitivity_idx
  on public.external_products (source_quality_score desc, fashion_sensitivity_score desc);

-- ---- 4. style_tags の配列検索用 gin(018 normalized_colors 同型・将来のタグ絞り込み用)----
create index if not exists external_products_style_tags_idx
  on public.external_products using gin (style_tags);
