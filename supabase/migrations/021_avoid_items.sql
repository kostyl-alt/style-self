-- Sprint 47: 着たくない服（Q16）を保存するカラムを users に追加
--
-- 用途:
--   - /api/ai/analyze で診断完了時に Q16 の選択ラベルを保存する
--   - /api/products/match のスコアリングで NG ペナルティ（-30点）として参照
--   - /api/ai/coordinate のシステムプロンプトで「着たくない服は出さない」制約に使う
--
-- 既存ユーザーの値はデフォルトの空配列 '{}' になり、再診断するまで NG ペナルティは効かない。
-- これは下位互換のための仕様（移行は再診断ベース）。

alter table public.users
  add column if not exists avoid_items text[] default '{}'::text[];
