-- Moodboard First Step 1: moodboard_analysis に brief（注釈付きMBの追加データ）を追加
--
-- 目的: 「服から始めない」構想の8段(人物/ストーリー/光/ロケ/色 等)を MB 解析に additive 保存する起点。
--   concept/story/person/lifestyle/hair/makeup/location/light/colorPalette を brief jsonb に内包する。
--   各値は { value, basis } で「観察(observed)/推測(inferred)」を機械可読に持つ(画像から確実でない値は inferred)。
--
-- 冪等性: add column if not exists で二重実行安全。既存テーブル・既存行は無変更
--   (default '{}' なので既存 analysis 行は空オブジェクトのまま＝従来出力に自然縮退)。
-- RLS は moodboard_analysis 既存ポリシーがそのまま適用(カラム追加のみ・ポリシー変更不要)。
-- 段階: Step 1 は brief を生成して保存するだけ(消費者ゼロ)。表示/コーデ/ブランドは無改修。

alter table public.moodboard_analysis
  add column if not exists brief jsonb not null default '{}'::jsonb;

comment on column public.moodboard_analysis.brief is
  '注釈付きMBの追加データ(jsonb)。concept / story / person / lifestyle / hair / makeup / location / light / colorPalette。各テキスト値は { value, basis: "observed"|"inferred" }、colorPalette は { main[], accent[], saturation, basis }。画像から確実でない値は basis="inferred"。固有店名・英語スラッグに依存しない日本語の注釈。';
