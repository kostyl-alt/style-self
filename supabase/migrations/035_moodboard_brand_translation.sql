-- 複数画像MB分析 A2: moodboard_analysis に brand_translation（決定的ブランド翻訳）を追加
--
-- 目的: 「画像ごとの事実(Layer1 vision) → 全体の共通点を決定的に集約(Layer2 signals) →
--   board brief(Layer3) → 近いブランド/検索ワードへ翻訳(A2)」の最終層。
--   signals の主軸(core/repeated)を StyleFacts に変換し matchBrands(ローカル 105 辞書)に渡して
--   近いブランド候補(BrandMatch[])を得る + 主軸タグから決定的に検索ワードを組む。
--   ⚠️ ブランド/検索ワードはコードが決定的に組む(matchBrands + 純関数)・LLM は一切関与しない。
--      固有名の捏造を構造的に防ぐため LLM 由来の brief とはスキーマで分離する(signals と同じ思想)。
--
-- 冪等性: add column if not exists で二重実行安全。既存テーブル・既存行は無変更
--   (default '{}' なので既存 analysis 行は空オブジェクトのまま＝従来挙動に縮退・誰も読まないので不変)。
-- RLS は moodboard_analysis 既存ポリシー(親 moodboards 経由)がそのまま適用(カラム追加のみ)。
-- 段階: A2-1 は算出して保存するだけ(消費者ゼロ)。Step2 下段表示は A2-2。

alter table public.moodboard_analysis
  add column if not exists brand_translation jsonb not null default '{}'::jsonb;

comment on column public.moodboard_analysis.brand_translation is
  '複数画像MB分析 A2 の決定的ブランド翻訳(jsonb)。schemaVersion / brands(BrandMatch[]=name/score/matchedReasons/searchKeywords・上位5〜8) / searchKeywords(ブランド由来 + 主軸タグ組合せ)。signals の主軸(core/repeated)を StyleFacts に変換し matchBrands(ローカル 105 辞書)に渡した決定的計算値で、LLM 由来の brief とは別物(固有名の捏造を防ぐためコードが組む)。';
