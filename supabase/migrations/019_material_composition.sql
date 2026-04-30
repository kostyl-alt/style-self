-- Sprint 41.2: 素材混率の保持
--
-- material_composition は jsonb 配列で素材ごとの混率を持つ。
-- 例: [{"name": "ポリエステル", "percentage": 80}, {"name": "綿", "percentage": 20}]
--
-- normalized_materials（text[]）と並行して保持する：
--   - normalized_materials: フィルタ・マッチング検索用（軽量）
--   - material_composition: 表示用・将来分析用（混率まで含む詳細）

alter table public.external_products
  add column if not exists material_composition jsonb not null default '[]';

create index if not exists external_products_material_composition_gin_idx
  on public.external_products using gin (material_composition);
