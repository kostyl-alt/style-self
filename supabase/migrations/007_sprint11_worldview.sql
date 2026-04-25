-- ---- Sprint 11: users テーブルに worldview jsonb カラムを追加 ----

alter table public.users
  add column if not exists worldview jsonb;

comment on column public.users.worldview is
  '世界観・信念軸。構造: { beliefs, targetPersona, stylePhilosophy, desiredImpression, avoidImpression }';
