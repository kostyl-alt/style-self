// Sprint H-4b: 構造化コーデ応答(CoordinateReply)型定義
//
// 設計: docs/STYLE-SELF_Sprint-H-4b_出力UI7+5_MB_context_object化_細部設計調査.md(2f9886e)§D
//
// 【H-4b1-a スコープ】★ 型のみ・使用は H-4b1-b 以降(reply 構造化・route 応答・component 分解)。
// E-0e §12 の「表示順 7 + 折りたたみ 5」に対応。coordinate intent のみがこの形を返す
// (diagnose / closet / style-consult / brand-learn は従来プロース形式のまま)。

// 既存 EditorScorePayload(C-2c-1・app/(app)/ai/page.tsx と同形)を再掲(types に集約)
export interface EditorScorePayload {
  scores: {
    novelty: number; rarity: number; mb_translation: number; daily_use: number;
    photogenic: number; post_worthy: number; searchable: number; personal: number;
    whitespace: number; signature_anomaly: number;
  };
  total:            number;
  checks:           Record<string, "ok" | "ng">;
  verdict:          "pass" | "compromise" | "fail";
  reasonShort:      string;
  improvementHints: string;
  attempts:         1 | 2;
}

export interface CoordinateItem {
  category:    string;   // アウター / トップス / ボトムス / 靴 / 小物 / ヘア / メイク
  description: string;   // 丈 / 素材 / 光沢 / カット 等の具体
}

export interface MoodboardSource {
  imageIdx: number;
  caption:  string;
  mapping:  string;      // 反映先(どの要素にどう効いたか)
}

export interface QuickAction {
  label:  string;        // 表示名(例: もっと日常的に)
  prompt: string;        // クリック時に送信する本文
}

export interface ImageAnalysisEntry {
  imageIdx:        number;
  caption:         string;
  surfaceVsEssence: string;  // ★ E-0a 表面真似禁止: 表面 vs 本質
  translation:     string;   // 本質をどう翻訳したか
}

export interface Item11Entry {
  name:    string;   // 比率 / 素材 / 色 / カット / シルエット / ライン / 重量 / 構造 / 調和 / 機能 / テーマ
  content: string;
}

export interface KoRuleEntry {
  type:    string;   // decision_rule / failure_pattern / influence 等
  content: string;
}

export interface CoordinateVisualization {
  imageUrl:        string;
  generatedPrompt: string;
}

export interface PromptDebug {
  systemPrompt: string;
  userPrompt:   string;
}

// ★ Phase 2: 素材・色・丈・シルエットの「選ぶ条件」（行動可能・MB由来coordinateのみ付与）
export interface FitConditions {
  materials:   string[];
  colors:      string[];
  lengths:     string[];   // 丈
  silhouettes: string[];
}

// ★ 構造化コーデ応答本体(Message 判別共用体に "coordinate_v2" として追加予定 = H-4b1-b)
export interface CoordinateReply {
  type: "coordinate_v2";

  // ★ Phase 2: 行動可能フィールド（すべて optional・MB context object 経路でのみ付与）。
  //   直接コーデ / 旧 coordinate_v2 は未付与＝後方互換（UI は presence で出し分け）。
  findThese?:      string[];      // 探すべき服
  avoidThese?:     string[];      // 避ける服
  searchKeywords?: string[];      // 検索ワード（ZOZO/Instagram/店で使える短語）
  fitConditions?:  FitConditions; // 素材/色/丈/シルエット条件
  // ★ Phase 4-b: 「どう着るか＝操作」（アイテム名で終わらせない・順序付き）
  stylingMoves?:   string[];      // 着こなし操作（丈/腰位置/ベルト/裾のため/レイヤード/視線設計/崩し）
  signatureMove?:  string;        // 普通に見えないための「1点の違和感」

  // 表示順 7(① direction 〜 ⑦ 折りたたみは下記詳細群)
  direction:     string;              // ①
  summary:       string;              // ②
  items:         CoordinateItem[];    // ③
  sources:       MoodboardSource[];   // ④
  visualization?: CoordinateVisualization;  // ⑤(生成後に後付け)
  quickActions:  QuickAction[];       // ⑥ 固定
  customActions: QuickAction[];       // ⑥ 動的(LLM 1-2 個)

  // ⑦ 折りたたみ 5
  imageAnalysis: ImageAnalysisEntry[];  // a 参考画像の反映
  items11:       Item11Entry[];         // b 11項目
  editorScore?:  EditorScorePayload;    // c 品質評価
  koRules:       KoRuleEntry[];         // d Knowledge OS 参照ルール
  promptDebug:   PromptDebug;           // e 生成プロンプト
}
