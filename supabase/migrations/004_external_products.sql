-- ---- external_products: 楽天等の外部商品マスタ ----

create table if not exists public.external_products (
  id                    uuid primary key default uuid_generate_v4(),
  source                text not null,                   -- 'rakuten' 等
  external_id           text not null,                   -- 楽天itemCode
  product_url           text,
  affiliate_url         text,
  name                  text not null,
  brand                 text,
  price                 integer,
  image_url             text,
  normalized_category   text,
  normalized_color      text,
  normalized_material   text,
  normalized_silhouette text,
  normalized_taste      text[],
  is_available          boolean not null default true,
  imported_at           timestamptz not null default now(),
  synced_at             timestamptz,
  unique (source, external_id)
);

-- RLS は無効（管理者専用テーブル、service role のみ書き込み可）
alter table public.external_products enable row level security;

create policy "authenticated users can read external products"
  on public.external_products for select
  to authenticated
  using (true);

create index external_products_source_idx on public.external_products(source);
create index external_products_category_idx on public.external_products(normalized_category);
create index external_products_available_idx on public.external_products(is_available);
