-- 複数画像MB分析 Step 1: moodboard_items に vision（画像ごとの構造化 observed facts）を追加
--
-- 目的: 「画像ごとの事実抽出 → 全体の共通点集約 → board-level brief」の3層構造の第1層。
--   画像追加時の per-image Vision(analyzeImage)の出力を構造化して保存する受け皿。
--   roles / visualFacts(colors/items/locations/lighting・各 basis+confidence) /
--   styleSignals(STYLE_AXES実在タグに正規化) / freeText を内包。
--   ⚠️ board-level brief(moodboard_analysis.brief)とは別物=混ぜない。集約とブランド接続は後段。
--
-- 冪等性: add column if not exists で二重実行安全。既存テーブル・既存行は無変更
--   (default '{}' なので既存 item 行は空オブジェクトのまま＝従来挙動に縮退・誰も読まないので不変)。
-- RLS は moodboard_items 既存ポリシー(親 moodboards 経由 EXISTS)がそのまま適用(カラム追加のみ)。
-- 段階: Step 1 は保存だけ(消費者なし)。集約/board brief/ブランド/表示は後段。

alter table public.moodboard_items
  add column if not exists vision jsonb not null default '{}'::jsonb;

comment on column public.moodboard_items.vision is
  '画像ごとの構造化 observed facts(jsonb)。schemaVersion / roles / primaryRole / visualFacts(colors/items/locations/lighting・各 value+basis(observed|inferred)+confidence) / styleSignals(colorTags/materialTags/silhouetteTags/genreTags/cultureTags=STYLE_AXES実在タグに正規化) / freeText(caption/notes)。board-level brief とは別物。固有店名・英語スラッグに依存しない日本語。';
