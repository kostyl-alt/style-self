-- ---- Sprint 9: users テーブルに身体情報カラムを追加 ----

alter table public.users
  add column if not exists height          integer,       -- 身長（cm）
  add column if not exists weight          integer,       -- 体重（kg）任意
  add column if not exists body_type       text,          -- 骨格タイプ: straight / wave / natural / unknown
  add column if not exists body_tendency   text,          -- 体型傾向: upper / lower / balanced / slim / solid
  add column if not exists weight_center   text,          -- 重心: upper / lower / balanced
  add column if not exists shoulder_width  text;          -- 肩幅: wide / normal / narrow
