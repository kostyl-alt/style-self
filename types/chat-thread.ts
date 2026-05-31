// Sprint H-1: 対話型 AI スタイリスト Chat Thread 型定義
//
// 設計: docs/STYLE-SELF_Sprint-H_対話型AIスタイリスト_実装設計調査.md(0771ea6)§B
// 段階1 基盤: supabase/migrations/027_h1_chat_threads.sql
//
// 【スキーマ整合】
// - *Row は DB 列の snake_case を踏襲(types/moodboard.ts と同型・types/database.ts には載せない方針)
// - types/database.ts は D1 世代テーブル(moodboards 等)を掲載しない手動部分集合のため、
//   本ファイルで Row 型を定義し、route 側の .insert()/.update() は `as never` で吸収(既存パターン)
// - Input 型は API body 検証用(Sprint H-2 の /api/threads 系 route で利用)

// ---- chat_threads ----

export interface ChatThreadRow {
  id:              string;
  user_id?:        string;          // 本人取得時のみ
  title:           string;
  moodboard_id:    string | null;   // 添付 MB(context object・任意)
  created_at:      string;
  updated_at:      string;
  last_message_at: string;          // 一覧降順ソート用
}

// ---- messages ----

export type MessageRole = "user" | "assistant";

export interface MessageRow {
  id:          string;
  thread_id:   string;
  role:        MessageRole;
  content:     string;
  attachments: MessageAttachments | null; // 画像 / MB / コーデ案 等
  metadata:    MessageMetadata | null;     // editorScore / intent / KO 参照 ID 等(折りたたみ詳細)
  created_at:  string;
}

// attachments / metadata は jsonb。実装の進行(H-4 / H-7)で拡張するため緩めに定義。
export interface MessageAttachments {
  images?:           string[];      // 生成画像 URL(C-1/C-2a/C-2g 着用イメージ)
  moodboard_id?:     string;        // メッセージ時点で参照した MB
  outfit?:           unknown;       // 生成コーデ案(H-4 で具体型化)
  products?:         unknown[];     // 商品候補(H-7)
  [key: string]:     unknown;
}

export interface MessageMetadata {
  intent?:       string;            // 自動判定した intent(ユーザーには非表示)
  editorScore?:  unknown;           // C-2c-1 エディタ AI 結果(折りたたみ表示)
  ko_rule_ids?:  string[];          // 参照した Knowledge OS ルール ID
  [key: string]: unknown;
}

// ---- feedback ----

// 'like' | 'dislike' | 'more_x'(もっと寄せる)| 'change_item'(このアイテムだけ変える)等。
// kind は自由文字列(将来種別が増えるため enum 化しない・DB も check 制約を課していない)。
export interface FeedbackRow {
  id:         string;
  thread_id:  string;
  message_id: string | null;        // 対象 assistant メッセージ
  kind:       string;
  content:    string;
  created_at: string;
}

// ---- judgment_rules ----

export type JudgmentRuleKind = "preference" | "ng" | "style_rule";

export interface JudgmentRuleRow {
  id:                       string;
  user_id?:                 string;
  rule:                     string;
  extracted_from_thread_id: string | null;
  priority:                 number;   // 1-10
  kind:                     JudgmentRuleKind;
  created_at:               string;
}

// ---- 集約ビュー(H-2 GET 詳細で返す想定) ----

export interface ChatThreadWithMessages extends ChatThreadRow {
  messages: MessageRow[];
}

// ---- API Input(H-2 で利用) ----

export interface CreateThreadInput {
  title?:       string;
  moodboard_id?: string;   // 添付 MB(任意)
}

export interface UpdateThreadInput {
  title?:        string;
  moodboard_id?: string | null;
}

export interface PostMessageInput {
  content:     string;
  attachments?: MessageAttachments;
  metadata?:    MessageMetadata;
}

export interface PostFeedbackInput {
  message_id?: string;
  kind:        string;
  content?:    string;
}
