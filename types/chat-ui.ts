// /ai チャット UI のメッセージ型(共有モジュール)。
// Step A: app/(app)/ai/page.tsx 内のインライン定義を抽出(無挙動変更)。
//   Step B で ChatSessionProvider(messages 持ち上げ)から参照するため、page と Provider の
//   双方が同じ型を import できる場所へ移す。EditorScorePayload は既に types/coordinate-reply に
//   集約済みの同形 interface があるためそれを再利用(重複を作らない)。
import type { CoordinateReply, EditorScorePayload } from "@/types/coordinate-reply";
import type { ProductCandidate } from "@/types/product-candidate";

export type { EditorScorePayload };

// D1-2a: overlay/intent のレスポンスで提示する suggestion(intent + ラベル)。
export interface SuggestionItem {
  intent: string;
  label:  string;
}

// /api/overlay/intent のレスポンス(MVP-1 範囲外 intent 用)。
export interface IntentResponse {
  ok:           boolean;
  intent?:      string;
  mode?:        string;
  params?:      Record<string, unknown>;
  confidence?:  number;
  suggestions?: SuggestionItem[];
  reason?:      "auth_required" | "empty_input";
}

// D1-2b': メッセージ型(設計案 B2.2)
// P1-C-1.5a 追加: kind:"reply"(会話 AI スタイリスト・自然文 + 補助 actions)
export type MessageContent =
  | { kind: "text";          text: string }                       // user 入力 or 簡素な assistant 応答
  | { kind: "image";         dataUrl?: string; storagePath?: string; caption?: string }  // 憧れ写真分析: user がアップした写真。dataUrl=ライブ表示の base64 or 解決済み署名URL(一時)・storagePath=private バケットの永続キー(Step3 で署名URL解決)。両方無し=テキスト fallback

  | { kind: "aspiration";    summary: string; sections?: { label: string; content: string }[] }   // 憧れ写真分析(要約常時表示 + 詳細セクションを「詳しく見る」で折り畳み・[[SECTION:key]] で分割済)
  | { kind: "intent-result"; result: IntentResponse }             // /api/overlay/intent のレスポンス(MVP-1 範囲外 intent 用)
  | { kind: "reply";         text: string; actions?: SuggestionItem[]; sessionIntent?: string; moodboardId?: string; editorScore?: EditorScorePayload; koRequestId?: string | null }  // /api/ai/stylist-chat の自然文応答(P1-C-1.5a・sessionIntent は会話継続性のため・L3 / C-2a: moodboardId / C-2c-1: editorScore で E-0c 凡庸脱却の判定スコアを保持 / ③-c-4: koRequestId で feedback 突合)
  | { kind: "coordinate_v2"; coordinate: CoordinateReply; actions?: SuggestionItem[]; sessionIntent?: string; moodboardId?: string; editorScore?: EditorScorePayload; koRequestId?: string | null }  // ★ H-4b1-b-1: 構造化コーデ応答(暫定 pre 表示・表示順7 component は H-4b1-b-2 / ③-c-4: koRequestId で feedback 突合)
  | { kind: "products"; candidates: ProductCandidate[]; queriesUsed: string[]; moodboardId: string; loading?: boolean; error?: string | null }  // ★ G-2b 案D: 実商品候補(coordinate_v2 と別メッセージで関心分離・/api/products/candidates 結果)
  | { kind: "loading";       mbCoordinate?: boolean }              // 「考えています…」/ C-2c-1: MB は段階表示
  | { kind: "error";         message: string };                   // 通信 / API エラー

export interface Message {
  id:        string;
  role:      "user" | "assistant";
  content:   MessageContent;
  createdAt: number;
}
