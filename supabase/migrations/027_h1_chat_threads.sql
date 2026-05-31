-- Sprint H-1: 対話型 AI スタイリストの永続文脈基盤(chat_threads / messages / feedback / judgment_rules)
--
-- 【背景】
-- E-0e(0e7c8df)「プロンプト生成ツールではなく対話型 AI スタイリスト」宣言の実装基盤。
-- 設計: docs/STYLE-SELF_Sprint-H_対話型AIスタイリスト_実装設計調査.md(0771ea6)§B。
-- 現状 stylist-chat は client が history(N=3)を毎回送る方式で、サーバーに会話が永続化されない
-- (E-0e 問題3「履歴が残らない」の構造的根)。本 migration が Chat Thread 永続文脈の器を作る。
--
-- 【設計の確定事項(Sprint-H 設計調査 §B)】
-- - 判断1: 4 テーブル(chat_threads / messages / feedback / judgment_rules)を新設
-- - 判断2: FK は public.users(id) on delete cascade(既存 016 ai_history / 026 moodboards 慣習)
-- - 判断3: chat_threads.worldview_id は置かない(単独 worldview テーブル無し・moodboard snapshot /
--          worldview_profiles 1:1 から導出可能・冗長回避)
-- - 判断4: messages / feedback の RLS は親 chat_threads 経由 EXISTS 判定(026 moodboard_items 同型作法・
--          子テーブル単独で穴を作らない)
-- - 判断5: ai_history(016)は廃止せず併存(intent 別単発ログ=履歴タブ資産を温存・新 messages は thread ベース)
--
-- 【変更内容】
-- 1. chat_threads テーブル新設(添付 MB は moodboard_id nullable・MB 削除時は set null)
-- 2. messages テーブル新設(role check・attachments / metadata jsonb)
-- 3. feedback テーブル新設(対象 message・kind 自由文字列)
-- 4. judgment_rules テーブル新設(user 単位・priority 1-10・kind enum)
-- 5. RLS:chat_threads / judgment_rules は本人 FOR ALL、messages / feedback は親 thread 経由 EXISTS
-- 6. インデックス(一覧ソート・thread 走査・優先度ソート)
-- 7. updated_at trigger(既存 public.handle_updated_at() 流用・chat_threads のみ)
--
-- 【安全性 — 026 同型作法】
-- (a) 本人 FOR ALL は WITH CHECK も同条件で偽装更新を防ぐ
-- (b) messages / feedback は親経由 EXISTS で本人判定(子テーブル単独で穴を作らない)
-- (c) FK + ON DELETE CASCADE で整合性担保(thread 削除 → messages / feedback 自動削除)
-- (d) chat は私的のため moodboards のような公開 SELECT は設けない(将来スレッド共有時のみ追加)
--
-- 【冪等性】
-- - create table / index if not exists
-- - create policy は重複だとエラー → 再実行時は事前 drop policy 必要(下記ロールバック参照)
--
-- 【ロールバック手順】
--   drop trigger if exists chat_threads_updated_at on public.chat_threads;
--   drop policy if exists "users own judgment_rules" on public.judgment_rules;
--   drop policy if exists "users own feedback via thread" on public.feedback;
--   drop policy if exists "users own messages via thread" on public.messages;
--   drop policy if exists "users own chat_threads" on public.chat_threads;
--   drop index if exists public.judgment_rules_user_priority_idx;
--   drop index if exists public.feedback_thread_idx;
--   drop index if exists public.messages_thread_created_idx;
--   drop index if exists public.chat_threads_user_last_msg_idx;
--   drop table if exists public.judgment_rules;
--   drop table if exists public.feedback;
--   drop table if exists public.messages;
--   drop table if exists public.chat_threads;
--
-- 【期待される結果】
-- - 既存テーブル(users / moodboards / ai_history / 他)は無変更
-- - 4 テーブルが空で作成される・RLS 有効・本人のみ自分の thread とその子行を操作可能

-- ---- 1. chat_threads テーブル ----

create table if not exists public.chat_threads (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,

  -- スレッド表題(自動生成 or ユーザー編集)
  title           text not null default '',

  -- 添付ムードボード(context object・任意・MB 削除時は紐付け解除)
  moodboard_id    uuid references public.moodboards(id) on delete set null,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- 一覧ソート用(最新メッセージ時刻・送信のたびに API 側で更新)
  last_message_at timestamptz not null default now()
);

comment on column public.chat_threads.moodboard_id is
  '添付 MB(context object)。E-0e: MB は主役でなく AI が参照する文脈。削除時は set null で thread は残す。';
comment on column public.chat_threads.last_message_at is
  'スレッド一覧の降順ソート用。メッセージ送信のたび API 側で now() に更新する。';

-- ---- 2. messages テーブル ----

create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  thread_id    uuid not null references public.chat_threads(id) on delete cascade,

  role         text not null check (role in ('user', 'assistant')),
  content      text not null,

  -- 画像 / MB / コーデ案 等の添付(E-0e 出力 UI の inline 表示素材)
  attachments  jsonb,
  -- editorScore / intent / KO 参照 ID 等(折りたたみ詳細素材・PII は持たせない)
  metadata     jsonb,

  created_at   timestamptz not null default now()
);

-- ---- 3. feedback テーブル ----

create table if not exists public.feedback (
  id           uuid primary key default gen_random_uuid(),
  thread_id    uuid not null references public.chat_threads(id) on delete cascade,
  message_id   uuid references public.messages(id) on delete cascade,  -- 対象 assistant メッセージ

  -- 'like' | 'dislike' | 'more_x'(もっと寄せる)| 'change_item'(このアイテムだけ変える)等
  kind         text not null,
  content      text not null default '',

  created_at   timestamptz not null default now()
);

-- ---- 4. judgment_rules テーブル ----

create table if not exists public.judgment_rules (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.users(id) on delete cascade,

  -- 抽出された判断ルール(例:「不穏さを丸めない」)
  rule                     text not null,
  -- 抽出元スレッド(任意・スレッド削除後もルールは残す)
  extracted_from_thread_id uuid references public.chat_threads(id) on delete set null,

  priority                 integer not null default 5 check (priority between 1 and 10),
  kind                     text not null check (kind in ('preference', 'ng', 'style_rule')),

  created_at               timestamptz not null default now()
);

comment on column public.judgment_rules.rule is
  'E-0e: ユーザーの「好き/違う/もっと寄せる/日常化/このアイテムだけ変える」から抽出した永続ルール。次回生成に反映。';

-- ---- 5. RLS: chat_threads(本人 FOR ALL) ----

alter table public.chat_threads enable row level security;

create policy "users own chat_threads"
  on public.chat_threads for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---- 6. RLS: messages(親 chat_threads 経由 EXISTS・026 同型) ----

alter table public.messages enable row level security;

create policy "users own messages via thread"
  on public.messages for all
  using (
    exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and t.user_id = auth.uid()
    )
  );

-- ---- 7. RLS: feedback(親 chat_threads 経由 EXISTS) ----

alter table public.feedback enable row level security;

create policy "users own feedback via thread"
  on public.feedback for all
  using (
    exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and t.user_id = auth.uid()
    )
  );

-- ---- 8. RLS: judgment_rules(本人 FOR ALL) ----

alter table public.judgment_rules enable row level security;

create policy "users own judgment_rules"
  on public.judgment_rules for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---- 9. インデックス ----

-- スレッド一覧(本人・最新順)
create index if not exists chat_threads_user_last_msg_idx
  on public.chat_threads (user_id, last_message_at desc);

-- スレッド内メッセージの時系列取得(最頻ケース)
create index if not exists messages_thread_created_idx
  on public.messages (thread_id, created_at);

-- フィードバックのスレッド走査
create index if not exists feedback_thread_idx
  on public.feedback (thread_id);

-- 次回生成時の本人ルール取得(優先度降順)
create index if not exists judgment_rules_user_priority_idx
  on public.judgment_rules (user_id, priority desc);

-- ---- 10. updated_at trigger(既存 public.handle_updated_at() 流用・chat_threads のみ) ----

create trigger chat_threads_updated_at
  before update on public.chat_threads
  for each row execute function public.handle_updated_at();
