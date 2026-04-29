-- Sprint 39: AI履歴の統一テーブル
-- ユーザーが診断・相談・写真分析・理想コーデの過去履歴を見返して削除できるようにするための基盤。
--
-- 設計の特徴:
-- - 4タイプを1テーブルで扱う（type で discriminated）
-- - input/output/metadata は jsonb で柔軟性を持たせる
-- - 写真分析の base64 は input に含めない（DB肥大化防止）
-- - ハード削除（user_id ON DELETE CASCADE で連動）

create table if not exists public.ai_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  type        text not null check (type in (
    'diagnosis', 'consultation', 'look_analysis', 'virtual_coordinate'
  )),
  input       jsonb not null,
  output      jsonb not null,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- type 指定での履歴取得用（最頻ケース）
create index ai_history_user_type_idx
  on public.ai_history (user_id, type, created_at desc);

-- 全タイプ混合の履歴取得用（「すべて」フィルタの高速化）
create index ai_history_user_created_idx
  on public.ai_history (user_id, created_at desc);

alter table public.ai_history enable row level security;

create policy "users own ai_history"
  on public.ai_history for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
