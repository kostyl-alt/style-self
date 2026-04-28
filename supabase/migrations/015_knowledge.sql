-- Sprint 37: 知識ベース機能の基盤テーブル
-- AIが自由生成するのではなく、信頼できる一次情報と判断ルールを参照して
-- 根拠あるコーデ提案を出すための基盤。

-- ---- 1. knowledge_sources（情報源） ----
create table if not exists public.knowledge_sources (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.users(id) on delete set null,
  title           text not null,
  source_type     text not null check (source_type in (
    'url', 'memo', 'image', 'book', 'video', 'lookbook', 'expert_note'
  )),
  url             text,
  content_text    text,
  image_url       text,
  author          text,
  citation_note   text,
  summary         text,
  visibility      text not null default 'private'
                  check (visibility in ('private', 'public', 'admin')),
  is_analyzed     boolean not null default false,
  analyzed_at     timestamptz,
  analyzed_by     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.knowledge_sources enable row level security;

create policy "users read own + public sources"
  on public.knowledge_sources for select
  using (
    visibility = 'public'
    or visibility = 'admin'
    or auth.uid() = user_id
  );

create policy "users insert own sources"
  on public.knowledge_sources for insert
  with check (auth.uid() = user_id);

create policy "users update own sources"
  on public.knowledge_sources for update
  using (auth.uid() = user_id);

create policy "users delete own sources"
  on public.knowledge_sources for delete
  using (auth.uid() = user_id);

create trigger knowledge_sources_updated_at
  before update on public.knowledge_sources
  for each row execute function public.handle_updated_at();

create index knowledge_sources_user_id_idx
  on public.knowledge_sources(user_id);
create index knowledge_sources_visibility_idx
  on public.knowledge_sources(visibility);

-- ---- 2. knowledge_rules（判断ルール） ----
create table if not exists public.knowledge_rules (
  id                       uuid primary key default gen_random_uuid(),
  source_id                uuid references public.knowledge_sources(id) on delete cascade,
  user_id                  uuid references public.users(id) on delete set null,
  concept_keyword          text not null,
  aliases                  text[] not null default '{}',
  emotion                  text,
  persona_image            text,
  cultural_context         text,
  era                      text,
  philosophy               text,
  recommended_colors       text[] not null default '{}',
  recommended_materials    text[] not null default '{}',
  recommended_silhouettes  text[] not null default '{}',
  required_accessories     text[] not null default '{}',
  ng_elements              text[] not null default '{}',
  weight                   integer not null default 50
                           check (weight between 1 and 100),
  visibility               text not null default 'private'
                           check (visibility in ('private', 'public', 'admin')),
  is_active                boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.knowledge_rules enable row level security;

create policy "users read own + public rules"
  on public.knowledge_rules for select
  using (
    is_active and (
      visibility = 'public'
      or visibility = 'admin'
      or auth.uid() = user_id
    )
  );

create policy "users insert own rules"
  on public.knowledge_rules for insert
  with check (auth.uid() = user_id);

create policy "users update own rules"
  on public.knowledge_rules for update
  using (auth.uid() = user_id);

create policy "users delete own rules"
  on public.knowledge_rules for delete
  using (auth.uid() = user_id);

create trigger knowledge_rules_updated_at
  before update on public.knowledge_rules
  for each row execute function public.handle_updated_at();

-- 検索高速化用インデックス
create index knowledge_rules_keyword_idx
  on public.knowledge_rules using gin (to_tsvector('simple', concept_keyword));
create index knowledge_rules_aliases_idx
  on public.knowledge_rules using gin (aliases);
create index knowledge_rules_active_idx
  on public.knowledge_rules (is_active) where is_active;
create index knowledge_rules_visibility_idx
  on public.knowledge_rules (visibility);
create index knowledge_rules_concept_keyword_lower_idx
  on public.knowledge_rules (lower(concept_keyword));

-- 補足:
-- visibility='admin' のルール/ソースは Supabase Studio (service role) で投入する。
-- service role は RLS をバイパスするため、admin 値が直接書き込める。
-- 通常ユーザーは RLS により private/public のみ作成可能（admin への昇格は service role 経由）。
