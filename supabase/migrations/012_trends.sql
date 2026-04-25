CREATE TABLE IF NOT EXISTS trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season text NOT NULL,
  year int NOT NULL,
  keyword text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  applicable_styles text[] DEFAULT '{}',
  incompatible_styles text[] DEFAULT '{}',
  adaptation_hint text,
  is_active boolean DEFAULT true,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Public read access (no auth required)
ALTER TABLE trends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trends_public_read" ON trends FOR SELECT USING (true);

-- Seed: 2025SS 5件
INSERT INTO trends (season, year, keyword, category, description, applicable_styles, incompatible_styles, adaptation_hint, display_order) VALUES
(
  '2025SS', 2025,
  'ゆったりしたシルエット',
  'silhouette',
  '肩から裾にかけてゆとりを持たせたオーバーサイズの服が主流。窮屈感をなくし、動きやすさと余裕感を両立。',
  ARRAY['ストリート', 'ラフ', 'ミニマル', 'ワーク'],
  ARRAY['きれいめ', 'フォーマル', 'タイトシルエット好き'],
  'トップスだけオーバーサイズにして、ボトムスはすっきりさせるとバランスが取りやすい',
  1
),
(
  '2025SS', 2025,
  'アースカラー・ベージュ系',
  'color',
  'ベージュ・テラコッタ・オリーブなど自然から採取した土の色が主役。穏やかで季節感のある配色。',
  ARRAY['ナチュラル', 'ミニマル', 'フレンチカジュアル', 'ワーク'],
  ARRAY['モード', '黒中心', 'ビビッドカラー好き'],
  '差し色として小物（バッグ・シューズ）だけアースカラーにするだけでも雰囲気が出る',
  2
),
(
  '2025SS', 2025,
  'デニム素材の復権',
  'material',
  'インディゴブルーから色落ちデニムまで、素材としてのデニムが再評価。ワンウォッシュの表情が特に注目。',
  ARRAY['カジュアル', 'ストリート', 'アメカジ', 'ワーク'],
  ARRAY['きれいめ', 'フォーマル', 'モード'],
  'デニムシャツを羽織りとして使うなど、主役でなく「素材の一枚」として取り入れると使いやすい',
  3
),
(
  '2025SS', 2025,
  'ミリタリー・ワークウェア',
  'detail',
  'カーゴポケット・ユーティリティベスト・ワークジャケットなど機能由来のディテールが街服に浸透。',
  ARRAY['ストリート', 'ワーク', 'アウトドア', 'ラフ'],
  ARRAY['フェミニン', 'きれいめ', 'ロマンチック'],
  'カーゴパンツ1本だけ取り入れて他をシンプルにまとめると、ミリタリー感を抑えられる',
  4
),
(
  '2025SS', 2025,
  'レイヤードスタイル',
  'silhouette',
  '複数のアイテムを重ねる着こなし。シャツの下にTシャツ・ジャケットの下にニットなど、層を意識したスタイリング。',
  ARRAY['ストリート', 'モード', 'ミックス', 'こなれ感'],
  ARRAY['シンプル好き', 'ミニマル', 'すっきり見せたい'],
  'まず2層だけ（例：シャツ×Tシャツ）から始めると取り入れやすい。3層以上は上級者向け',
  5
);
