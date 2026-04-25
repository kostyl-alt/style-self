-- ---- Sprint 7: wardrobe_items スキーマ更新 ----

-- taste: text → text[]（既に text[] の場合はスキップ）
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'wardrobe_items'
      and column_name  = 'taste'
      and data_type    = 'text'
  ) then
    alter table public.wardrobe_items
      alter column taste type text[]
      using nullif(array[taste::text], array['']::text[]);
  end if;
end $$;

-- status（所有状態）: owned / considering / wishlist / passed
alter table public.wardrobe_items
  add column if not exists status text not null default 'owned'
  check (status in ('owned', 'considering', 'wishlist', 'passed'));

-- worldview_score: 世界観整合スコア（1〜5）
alter table public.wardrobe_items
  add column if not exists worldview_score integer
  check (worldview_score between 1 and 5);

-- worldview_tags: 世界観タグ（例: ["クリーン", "ミニマル"]）
alter table public.wardrobe_items
  add column if not exists worldview_tags text[];
