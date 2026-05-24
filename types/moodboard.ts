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
