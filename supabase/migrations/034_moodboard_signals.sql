-- 複数画像MB分析 Layer2: moodboard_analysis に signals（決定的集約シグナル）を追加
--
-- 目的: 「画像ごとの事実(Layer1 vision) → 全体の共通点を決定的に集約(Layer2) → board brief(Layer3)」の第2層。
--   moodboard_items.vision.styleSignals(STYLE_AXES実在タグに正規化済み)を画像横断で数え、
--   各タグに count(何枚に出たか) / imageIds(どの画像) / strength(core|repeated|accent) を付けて保存する。
--   ⚠️ 事実の集約は決定的(純関数 lib/utils/moodboard-aggregate.ts)・LLM由来の brief とはスキーマで分離。
--
-- 冪等性: add column if not exists で二重実行安全。既存テーブル・既存行は無変更
--   (default '{}' なので既存 analysis 行は空オブジェクトのまま＝従来挙動に縮退・誰も読まないので不変)。
-- RLS は moodboard_analysis 既存ポリシー(親 moodboards 経由)がそのまま適用(カラム追加のみ)。
-- 段階: Layer2 は集約して保存するだけ(消費者ゼロ)。board brief/Step2表示/coordinate/brand/チャットは無改修。

alter table public.moodboard_analysis
  add column if not exists signals jsonb not null default '{}'::jsonb;

comment on column public.moodboard_analysis.signals is
  '複数画像MB分析 Layer2 の決定的集約シグナル(jsonb)。schemaVersion / imageCount / signals[]。各 signal は { axis(color|material|silhouette|genre|culture), value(STYLE_AXES実在タグ), count(出現画像数), imageIds(根拠の画像id), strength(core=count>=2かつratio>=0.6 / repeated=count>=2かつratio>=0.3 / accent=それ未満。imageCount<2なら全accent) }。moodboard_items.vision.styleSignals を画像横断で集約した値で、LLM由来の brief とは別物。';
