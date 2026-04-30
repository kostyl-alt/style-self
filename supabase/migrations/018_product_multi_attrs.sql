-- Sprint 41.1: 商品の複数属性化と8軸判断情報追加
--
-- 変更内容:
-- 1. normalized_color (text)      → normalized_colors (text[])
-- 2. normalized_material (text)   → normalized_materials (text[])
-- 3. axes (jsonb) を新設（8軸判断情報を構造的に保持）
--
-- 既存データ（楽天同期 80 件）は単要素配列に変換して保護する。
-- このマイグレーション実行と同時にコード側も配列フィールド対応に切り替える。

-- ---- 1. 新カラム ADD ----
alter table public.external_products
  add column if not exists normalized_colors    text[] not null default '{}',
  add column if not exists normalized_materials text[] not null default '{}',
  add column if not exists axes                 jsonb not null default '{}';

-- ---- 2. 既存データを配列にコピー（破壊的変更前の安全策） ----
update public.external_products
set normalized_colors = case
      when normalized_color is null or normalized_color = '' then array[]::text[]
      else array[normalized_color]
    end
where normalized_colors = '{}';

update public.external_products
set normalized_materials = case
      when normalized_material is null or normalized_material = '' then array[]::text[]
      else array[normalized_material]
    end
where normalized_materials = '{}';

-- ---- 3. 旧単数カラム DROP（コードを完全に切り替えてから実行） ----
alter table public.external_products
  drop column if exists normalized_color,
  drop column if exists normalized_material;

-- ---- 4. インデックス ----
create index if not exists external_products_colors_idx
  on public.external_products using gin (normalized_colors);
create index if not exists external_products_materials_idx
  on public.external_products using gin (normalized_materials);
create index if not exists external_products_axes_gin_idx
  on public.external_products using gin (axes);

-- 補足:
-- axes jsonb の想定構造:
--   {
--     "silhouetteType":  "Iライン" | "Aライン" | "Yライン" | "Oライン" | null,
--     "topBottomRatio":  string | null,        -- 単一商品では null になり得る
--     "lengthBalance":   string | null,
--     "shoulderLine":    string | null,
--     "weightCenter":    "upper" | "lower" | "balanced" | null,
--     "textureType":     string | null,
--     "seasonality":     string[]              -- ["春","夏"] 等
--   }
