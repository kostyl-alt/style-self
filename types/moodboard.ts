// D1 Phase 2 ムードボード 型定義
//
// 設計: docs/STYLE-SELF_D1_Sprint_C-2_段階2_API_設計調査.md(1c0a270)§5
// 段階1 基盤: supabase/migrations/026_d1_moodboards.sql(ec12f7b)
//
// 【スキーマ整合】
// - MoodboardRow / MoodboardItemRow は DB 列の snake_case を踏襲(types/database.ts と同型)
// - Input 型は API body 検証用(/api/moodboards 系 route で利用)
// - GET 詳細(items 含む)は MoodboardWithItems を返す

export interface MoodboardRow {
  id:               string;
  user_id?:         string;       // 本人取得時のみ(anon 取得時は含めない)
  name:             string;
  description:      string;
  is_public:        boolean;
  cover_image_url:  string | null;
  worldview_name:   string | null;
  created_at:       string;
  updated_at:       string;
}

export interface MoodboardItemRow {
  id:           string;
  image_url:    string;
  caption:      string;
  source_url:   string | null;
  order_index:  number;
  created_at:   string;
}

export interface MoodboardWithItems extends MoodboardRow {
  items: MoodboardItemRow[];
}

export interface CreateMoodboardInput {
  name:         string;
  description?: string;
  is_public?:   boolean;   // ★ default false(地雷 8 オプトイン公開)
}

export interface UpdateMoodboardInput {
  name?:             string;
  description?:      string;
  is_public?:        boolean;
  cover_image_url?:  string;
}

export interface AddMoodboardItemInput {
  image_url:    string;
  caption?:     string;
  source_url?:  string;
  order_index?: number;
}

export interface UpdateMoodboardItemInput {
  caption?:     string;
  order_index?: number;
}

// ---- v3: 画像自動分析 + 外部 URL 連携(設計 cd1b01a §2 §3)----

import type { EssentialCategory } from "@/lib/utils/moodboard-essentials";

export interface VisionAnalysisResult {
  categories:      EssentialCategory[];  // 必須要素 8 から 1-3 個
  caption:         string;               // 50 字以内・日本語
  dominant_colors: string[];             // hex 2-3 個
}

// ★ 複数画像MB分析 Step 1: 画像ごとの構造化 observed facts（per-image・moodboard_items.vision に保存）。
//   ⚠️ board-level brief(MoodboardBrief)とは別物＝混ぜない。集約(repeated/accent)とブランド接続は後段で vision を読む。
export type VisionBasis = "observed" | "inferred";
export type VisionConfidence = "high" | "medium" | "low";

export interface VisionFactEntry {
  value:      string;
  basis:      VisionBasis;
  confidence: VisionConfidence;
}

// 画像から見える事実（色/アイテム/場所/光）。色は基本 observed・確信が低いものや素材感等は inferred 混在。
export interface VisionFacts {
  colors:    VisionFactEntry[];
  items:     VisionFactEntry[];
  locations: VisionFactEntry[];
  lighting:  VisionFactEntry[];
}

// ⚠️ STYLE_AXES 実在タグに正規化したシグナル（集約/ブランドマッチング用・自由文は入れない）。
export interface VisionStyleSignals {
  colorTags:      string[];
  materialTags:   string[];
  silhouetteTags: string[];
  genreTags:      string[];
  cultureTags:    string[];
}

export interface MoodboardItemVision {
  schemaVersion: 1;
  roles:         string[];        // 複数 role 可（鏡自撮り=model/outfit/location/color/silhouette 同時等）
  primaryRole?:  string;
  visualFacts:   VisionFacts;
  styleSignals:  VisionStyleSignals;
  freeText:      { caption: string; notes: string[] };  // 表示/説明用（styleSignals と混ぜない）
}

export interface AnalyzeImageInput {
  image_url: string;  // moodboard-images bucket の public URL
}

export interface UrlAddInput {
  url: string;  // Pinterest / Instagram / Vogue の URL or 直接画像 URL
}

export interface AnalyzeItemResponse {
  item:     MoodboardItemRow;
  analysis: VisionAnalysisResult | null;  // Vision 失敗時は null(fallback)
}

export interface FromUrlItemResponse extends AnalyzeItemResponse {
  source_url: string;
}

// ---- Phase 1: board単位 context object（moodboard_analysis）----
// 設計: 長文プロンプト往復をやめ、MB を構造化データとして1回だけ解析・保存する起点。
// supabase/migrations/029_phase1_moodboard_analysis.sql と同型（snake_case 踏襲）。

// 買う判断軸（shopping_guidelines を独立させず shopping_axis jsonb に内包）。
// jsonb なので将来フィールド追加は後方互換。固有店名に依存しない指針を入れる。
export interface ShoppingAxis {
  where_to_look?: string[];   // どこで探すと良いか（店種・EC種別の指針）
  check_points?:  string[];   // 買う前に確認する点（素材/丈/シルエット等）
  avoid_when?:    string[];   // 見送る条件
}

// ★ Phase 4-a: 着こなし操作の軸（shopping_axis と対構造＝「買う軸／着る軸」）。
// jsonb なので将来フィールド追加は後方互換。固有店名・英語スラッグに依存しない「操作」指針。
export interface StylingAxis {
  layering?:        string[];   // レイヤードの組み方
  lengths?:         string[];   // 丈・袖・裾の扱い
  silhouetteBuild?: string[];   // シルエットの組み立て方
  colorBalance?:    string[];   // 色配分
  materialMix?:     string[];   // 素材の混ぜ方
  accessories?:     string[];   // 小物の置き方
  shoesConnection?: string[];   // 靴との接続
  hairMakeup?:      string[];   // 髪型・メイクとの接続
  anomaly?:         string[];   // 普通に見えないための違和感
  mbStylingRules?:  string[];   // MB由来の着こなしルール
  avoidStyling?:    string[];   // 避けるべき着方
}

// ★ Moodboard First Step 1: 注釈付きMBの追加データ（brief）。
//   各テキスト値は { value, basis } で「観察(observed)/推測(inferred)」を機械可読に持つ。
//   画像から確実でない値は basis="inferred"。Step 1 は board がテキスト(caption)ベースなので原則 inferred。
export type BriefBasis = "observed" | "inferred";

export interface BriefField {
  value: string;
  basis: BriefBasis;
}

// 色は構造化（メイン/差し色/彩度）。既存 colors[] は別途温存し、これは追加ビュー。
export interface ColorPalette {
  main:       string[];   // メインカラー（日本語名）
  accent:     string[];   // 差し色
  saturation: string;     // 彩度の傾向（例: 低彩度・無彩色寄り）
  basis:      BriefBasis;
}

// 9項目・各任意（確証が薄い項目は省略可）。
export interface MoodboardBrief {
  concept?:      BriefField;     // 世界観の短いラベル（3〜10字・詩的禁止）
  story?:        BriefField;     // 場面・物語（1〜2文）
  person?:       BriefField;     // ★ MB画像が描く理想像の人物（性別感/年齢感/体型/雰囲気）。ユーザー本人の体型(body_profile)とは別物
  lifestyle?:    BriefField;     // 生活/カルチャー像
  hair?:         BriefField;     // 髪型/長さ/質感
  makeup?:       BriefField;     // メイク系統
  location?:     BriefField;     // 場所/空間
  light?:        BriefField;     // 光の種類/時間帯/影/明暗
  colorPalette?: ColorPalette;
}

// ---- 複数画像MB分析 Layer2: 決定的集約シグナル（moodboard_analysis.signals）----
//   vision.styleSignals（STYLE_AXES 正規化済み）を画像横断で集約。⚠️ 事実の集約は決定的（純関数）・
//   LLM 由来の brief とはスキーマで分離する。Layer3 以降がこれを読む（現状 消費者ゼロ）。
export type SignalAxis = "color" | "material" | "silhouette" | "genre" | "culture";
export type SignalStrength = "core" | "repeated" | "accent";

export interface AggregatedSignal {
  axis:     SignalAxis;
  value:    string;        // STYLE_AXES 実在タグ
  count:    number;        // 何枚の画像に出たか
  imageIds: string[];      // どの画像に出たか（根拠を辿れる）
  strength: SignalStrength;
}

export interface MoodboardSignals {
  schemaVersion: 1;
  imageCount:    number;          // 集約に使った画像枚数
  signals:       AggregatedSignal[];
}

// ---- 複数画像MB分析 A2: 決定的ブランド翻訳（moodboard_analysis.brand_translation）----
//   signals の主軸（core/repeated）を StyleFacts に変換し matchBrands（ローカル 105 辞書）に渡した結果。
//   ⚠️ ブランド/検索ワードはコードが決定的に組む（matchBrands + 純関数）・LLM は一切関与しない。
//   固有名の捏造を防ぐため LLM 由来の brief とはスキーマで分離する（signals と同じ思想）。
//   brands は lib/knowledge/brand-match.ts の BrandMatch と同型（name/score/matchedReasons/searchKeywords）。
export interface BrandTranslationMatch {
  name:           string;
  score:          number;
  matchedReasons: string[];
  searchKeywords: string[];
}

export interface BrandTranslation {
  schemaVersion: 1;
  brands:        BrandTranslationMatch[];  // 近いブランド候補（上位 5〜8・スコア順）
  searchKeywords: string[];                // ブランド由来 + 主軸タグ組合せ（重複除去）
}

export interface MoodboardAnalysisRow {
  moodboard_id:   string;
  worldview_core: string;     // 世界観コア（1〜2文）
  colors:         string[];
  materials:      string[];
  silhouettes:    string[];
  mood:           string;     // 空気感
  ng_elements:    string[];
  shopping_axis:  ShoppingAxis;
  styling_axis:   StylingAxis;  // ★ Phase 4-a: 着こなし操作の軸
  brief:          MoodboardBrief;  // ★ Moodboard First Step 1: 注釈付きMBの追加データ（additive・消費者ゼロ）
  signals:        MoodboardSignals;  // ★ Layer2: 決定的集約（repeated/accent）・additive・消費者ゼロ・LLM 産物でない
  brand_translation: BrandTranslation;  // ★ A2: 決定的ブランド翻訳（signals主軸→matchBrands）・additive・消費者ゼロ・LLM 産物でない
  source:         string;     // 生成元（モデル名等）
  created_at:     string;
  updated_at:     string;
}

// LLM 出力（DBメタ抜き）。analyze API が callClaudeJSON で受け取る形。
// ⚠️ signals / brand_translation は LLM 産物でなく決定的計算値なので Omit する（LLM には作らせない）。
export type MoodboardAnalysisLLM =
  Omit<MoodboardAnalysisRow, "moodboard_id" | "source" | "created_at" | "updated_at" | "signals" | "brand_translation">;

export interface AnalyzeMoodboardResponse {
  analysis: MoodboardAnalysisRow;
}
