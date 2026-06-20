// Style Match Result 第2段: 「買える言葉」=アプリ別検索ワードを生成する隔離ルート。
//   ⚠️ photos-structure を汚さない別ルート。STYLE_MATCH 体験からのみ呼ばれる。DB は触らない（ephemeral）。
//
// returns: { ok:true, keywords } / { ok:true, reason:"auth_required" } / { error }
//
// フロー: auth(cookie RLS) → signals 主軸(core/repeated)＋観察アイテム → LLM 1回で検索ワード強制JSON。
//   ⚠️ 事実(signals/items)は決定的・LLM は「自然な検索語化」だけ（タグ直結禁止はプロンプトで担保）。

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callClaudeJSON } from "@/lib/claude";
import {
  STYLE_MATCH_KEYWORDS_SYSTEM,
  buildStyleMatchKeywordsUserMessage,
  type StyleMatchKeywords,
} from "@/lib/prompts/style-match-keywords";
import type { MoodboardSignals } from "@/types/moodboard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface StyleMatchKeywordsRequest {
  signals?:     MoodboardSignals;
  items?:       string[];  // 観察アイテム名（任意・補助・vision.visualFacts.items の value）
  gender?:      string;    // 任意（"メンズ"/"レディース" 等・無ければ断定しない）
  targetStyle?: string;    // 任意（本人が寄せたい方向・自由文）
}

interface StyleMatchKeywordsResponse {
  ok:        boolean;
  keywords?: StyleMatchKeywords;
  reason?:   "auth_required" | "empty_signals";
}

// LLM 出力を string[] に正規化（型外・空・非配列を握りつぶす）。
function cleanList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return Array.from(
    new Set(v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean)),
  ).slice(0, 6);
}

export async function POST(request: NextRequest) {
  try {
    // 1) 認証（体験を本人に閉じる・DB は触らない）
    const supabase = createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      return NextResponse.json<StyleMatchKeywordsResponse>({ ok: true, reason: "auth_required" });
    }

    // 2) body（client 信頼は最小化）
    const body = await request.json() as StyleMatchKeywordsRequest;
    const signals = body.signals;
    const items = Array.isArray(body.items) ? body.items.filter((s): s is string => typeof s === "string") : [];
    const gender = typeof body.gender === "string" ? body.gender : undefined;
    const targetStyle = typeof body.targetStyle === "string" ? body.targetStyle : undefined;
    const hasCore = !!signals && Array.isArray(signals.signals)
      && signals.signals.some((s) => s.strength !== "accent");
    // 芯となる共通要素も観察アイテムも無ければ、検索ワードは作らない（無理に出して質を落とさない）。
    if (!hasCore && items.length === 0) {
      return NextResponse.json<StyleMatchKeywordsResponse>({ ok: true, reason: "empty_signals" });
    }

    // 3) LLM 1回（事実は渡すだけ・検索語化のみ・強制JSON）。質優先で既定 Sonnet。
    //    ⚠️ core/repeated（共通の芯）を主役・枚数付きで・items は補助としてビルダーが整形する。
    const userMessage = buildStyleMatchKeywordsUserMessage(
      signals ?? ({ schemaVersion: 1, imageCount: 0, signals: [] } as unknown as MoodboardSignals),
      { items, gender, targetStyle },
    );
    const raw = await callClaudeJSON<Partial<StyleMatchKeywords>>({
      systemPrompt: STYLE_MATCH_KEYWORDS_SYSTEM,
      userMessage,
      maxTokens:    1024,
      temperature:  0.3,
    });

    const keywords: StyleMatchKeywords = {
      zozo_rakuten:   cleanList(raw.zozo_rakuten),
      mercari_furugi: cleanList(raw.mercari_furugi),
      pinterest_en:   cleanList(raw.pinterest_en),
    };

    return NextResponse.json<StyleMatchKeywordsResponse>({ ok: true, keywords });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[style-match-keywords] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
