-- フェーズB Step 1: worldview_profiles の pattern_id / pattern_name を nullable に
--
-- 【背景】
-- analyze-v2(アプローチ2)は 8 パターンを使わず AI が世界観を毎回構築するため、
-- pattern_id を持たない。一方 worldview_profiles は 020_diagnosis_v2.sql で
-- 両カラムを NOT NULL として定義していたため、analyze-v2 の upsert が
-- not-null 違反で失敗し、result jsonb がユーザーに紐付かず永続化できていなかった。
--
-- 【変更内容】
-- - worldview_profiles.pattern_id   を NOT NULL → NULL 許容に変更
-- - worldview_profiles.pattern_name を NOT NULL → NULL 許容に変更
--   (pattern_name は analyze-v2 が worldviewName を入れているので緊急性は低いが、
--    将来 worldviewName 欠落時のフォールバックの自由度のため緩める)
--
-- 【安全性】
-- - 制約を緩めるだけの非破壊変更。既存データは全て NOT NULL 値を持っているので影響なし。
-- - if exists 等の必要はないが、本番/ステージング両方で再実行されても害がない設計。
--
-- 【ロールバック手順】
-- 必要であれば以下を実行(既存行に null が無いことを前提とする):
--   alter table public.worldview_profiles
--     alter column pattern_id   set not null;
--   alter table public.worldview_profiles
--     alter column pattern_name set not null;
-- ※ analyze-v2 で保存された行は pattern_id が null になっているはずなので、
--   ロールバック前に null 行を埋めるか削除する必要がある。

alter table public.worldview_profiles
  alter column pattern_id drop not null;

alter table public.worldview_profiles
  alter column pattern_name drop not null;
