-- ---- wardrobe_items スキーマ更新 ----

-- season: text → text[]（CHECK制約を削除してから型変換）
alter table public.wardrobe_items
  drop constraint if exists wardrobe_items_season_check;

alter table public.wardrobe_items
  alter column season type text[]
  using array[season::text];

-- サブカラー
alter table public.wardrobe_items
  add column if not exists sub_color text;

-- 生地感・質感・編み
alter table public.wardrobe_items
  add column if not exists fabric_texture text;

-- シルエット
alter table public.wardrobe_items
  add column if not exists silhouette text;

-- テイスト
alter table public.wardrobe_items
  add column if not exists taste text;
