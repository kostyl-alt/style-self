// D1-1: 自然言語オーバーレイ・意図分類 API
//
// POST /api/overlay/intent
// body: { text: string }
// returns: { ok, intent, mode, params, confidence, suggestions[] } or { ok, reason }
//
// 【設計】docs/STYLE-SELF_D1_実装設計.md セクション 4.1
// 【スコープ】D1-1 は意図を判定して返すだけ。18 機能の実行配線は D1-2。
//
// 【セキュリティ / プライバシー】(設計書 4.4 不可侵境界線・厳守)
// - createSupabaseServerClient()(認証 client) のみ・service_role 使わない
// - 既存 DB を直接 SELECT/INSERT/UPDATE しない(本 API は intent 分類専用)
// - M2-3 / M4-2 / M3 プライバシー経路に一切干渉しない
// - worldview_tags 英語スラッグを返さない(intent 候補名は内部識別子・UI 表示用ではない)
// - 未認証は 401 でなく 200 + reason("auth_required") を返す(M3-4 fallback 思想)
//
// 【モデル】Haiku 4.5(M5-4a で lazy 化済 lib/claude.ts 経由)・¥0.001/件想定

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callClaudeJSON, HAIKU_MODEL } from "@/lib/claude";
import { OVERLAY_INTENT_PROMPT } from "@/lib/prompts/overlay-intent";

export const dynamic = "force-dynamic";

// 設計書 4.2 の intent 列挙 + 将来 2 つ + unknown(辞書外フィルタに使う)
const ALLOWED_INTENTS = new Set<string>([
  "diagnose", "worldview-profile", "coordinate", "style-consult",
  "virtual-coordinate", "product-match", "match-users", "match-posts",
  "create-post", "my-posts", "closet", "inspiration", "brand-learn",
  "culture", "saved", "history", "body-edit", "preference-edit",
  "moodboard", "tryon", "unknown",
]);
const ALLOWED_MODES = new Set<string>(["api", "navigate", "hybrid", "none"]);

interface SuggestionItem {
  intent: string;
  label:  string;
}

interface IntentResponse {
  ok:           boolean;
  intent?:      string;
  mode?:        string;
  params?:      Record<string, unknown>;
  confidence?:  number;
  suggestions?: SuggestionItem[];
  reason?:      "auth_required" | "empty_input";
}

interface ClaudeRaw {
  intent?:      unknown;
  mode?:        unknown;
  params?:      unknown;
  confidence?:  unknown;
  suggestions?: unknown;
}

function sanitizeSuggestions(raw: unknown): SuggestionItem[] {
  if (!Array.isArray(raw)) return [];
  const result: SuggestionItem[] = [];
  for (const s of raw) {
    if (s && typeof s === "object") {
      const obj = s as Record<string, unknown>;
      if (typeof obj.intent === "string" && typeof obj.label === "string"
          && ALLOWED_INTENTS.has(obj.intent)) {
        result.push({ intent: obj.intent, label: obj.label });
      }
    }
    if (result.length >= 3) break;
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      // 未認証は 200 + reason(設計書 M3-4 fallback 思想)
      return NextResponse.json<IntentResponse>({
        ok:     true,
        reason: "auth_required",
      });
    }

    const body = await request.json() as { text?: string };
    const text = (body.text ?? "").trim();
    if (text.length === 0) {
      return NextResponse.json<IntentResponse>({
        ok:     true,
        reason: "empty_input",
      });
    }

    const raw = await callClaudeJSON<ClaudeRaw>({
      systemPrompt: OVERLAY_INTENT_PROMPT,
      userMessage:  text,
      model:        HAIKU_MODEL,
      // ★ Sprint C-3 hotfix(384→768→1536 と段階的拡大):
      //   - 旧 384: 5 intent 短文判定用の元設定
      //   - 768(0cf6759): MB prompt 導入後 384 で truncation → 2x 拡大
      //   - 1536(本 commit・9e90926 案D 後): MB prompt が更に詳細化 968 chars 出力 →
      //     768 でも JSON 構造完成せず → さらに 2x 拡大で安全マージン
      //   既存 5 intent 短文判定への影響なし(LLM は必要分しか生成しない・課金は実出力分のみ)
      maxTokens:    1536,
    });

    // 辞書外を返した場合は unknown / none に丸める(プロンプト指示があっても防御)
    const intent = typeof raw.intent === "string" && ALLOWED_INTENTS.has(raw.intent)
      ? raw.intent
      : "unknown";
    const mode = typeof raw.mode === "string" && ALLOWED_MODES.has(raw.mode)
      ? raw.mode
      : "none";
    const params: Record<string, unknown> = (raw.params && typeof raw.params === "object" && !Array.isArray(raw.params))
      ? raw.params as Record<string, unknown>
      : {};
    const confidence = typeof raw.confidence === "number"
      ? Math.max(0, Math.min(1, raw.confidence))
      : 0;
    const suggestions = sanitizeSuggestions(raw.suggestions);

    return NextResponse.json<IntentResponse>({
      ok: true,
      intent,
      mode,
      params,
      confidence,
      suggestions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[overlay/intent] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
