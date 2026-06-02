-- Phase 4-a: moodboard_analysis に styling_axis（着こなし操作の軸）を追加
--
-- 目的: 「何を買うか」だけでなく「どう着るか＝スタイリング操作」を context object に保存し、
--   チャット短文回答で着こなし指示（丈/重心/レイヤード/崩し/違和感 等）を出せるようにする。
--   shopping_axis と対構造（買う軸／着る軸）。
--
-- 冪等性: add column if not exists で二重実行安全。既存テーブル・既存行は無変更
--   （default '{}' なので既存 analysis 行は空オブジェクトのまま＝従来出力に自然縮退）。
-- RLS は moodboard_analysis 既存ポリシーがそのまま適用（カラム追加のみ・ポリシー変更不要）。

alter table public.moodboard_analysis
  add column if not exists styling_axis jsonb not null default '{}'::jsonb;

comment on column public.moodboard_analysis.styling_axis is
  '着こなし操作の軸（jsonb）。layering / lengths / silhouetteBuild / colorBalance / materialMix / accessories / shoesConnection / hairMakeup / anomaly / mbStylingRules / avoidStyling 等。固有店名・英語スラッグに依存しない操作指針。';
