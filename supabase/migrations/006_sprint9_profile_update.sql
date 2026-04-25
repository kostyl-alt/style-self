-- ---- Sprint 9 改善: users テーブルに詳細身体情報カラムを追加 ----

alter table public.users
  add column if not exists upper_body_thickness text,   -- 上半身の厚み: thin / normal / thick
  add column if not exists muscle_type          text,   -- 筋肉感・肉付き: slim / standard / muscular / solid
  add column if not exists leg_length           text,   -- 脚の見え方: long / normal / short
  add column if not exists preferred_fit        text,   -- 目指すサイズ感: tight / just / relaxed / oversized
  add column if not exists style_impression     text,   -- 見せたい印象: sharp / neutral / soft / presence
  add column if not exists emphasize_parts      text[], -- 強調したい部位（複数選択）
  add column if not exists hide_parts           text[], -- 隠したい部位（複数選択）
  add column if not exists fit_recommendation   text;   -- AI生成の推奨サイズ感コメント
