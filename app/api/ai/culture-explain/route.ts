import { NextRequest, NextResponse } from "next/server";
import { callClaudeJSON } from "@/lib/claude";
import { CULTURE_EXPLAIN_SYSTEM_PROMPT } from "@/lib/prompts/culture-explain";
import type {
  CulturalAffinities,
  CultureExplainResponse,
  CultureExplanationItem,
} from "@/types/index";

interface RequestBody {
  worldviewName?:       string;
  patternId?:           string;
  culturalAffinities?:  CulturalAffinities;
  avoidImpressions?:    string[];
  avoidItems?:          string[];
  idealSelf?:           string;
  unconsciousTendency?: string;
}

function ensureItem(raw: unknown, fallbackItem: string): CultureExplanationItem {
  if (raw && typeof raw === "object") {
    const obj = raw as { item?: unknown; reason?: unknown };
    const item   = typeof obj.item === "string" && obj.item.trim() ? obj.item.trim() : fallbackItem;
    const reason = typeof obj.reason === "string" ? obj.reason.trim() : "";
    return { item, reason };
  }
  return { item: fallbackItem, reason: "" };
}

// 入力で渡された項目数・順序に合わせて出力を整える。
// Claude が項目を落としたり順序を変えても、入力の順序を保つ。
function normalizeCategory(
  inputs: string[] | undefined,
  rawList: unknown,
): CultureExplanationItem[] {
  const list = Array.isArray(rawList) ? rawList : [];
  return (inputs ?? []).map((name, idx) => ensureItem(list[idx], name));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RequestBody;
    const cultural = body.culturalAffinities;
    if (!cultural
      || (cultural.music?.length ?? 0) === 0
      && (cultural.films?.length ?? 0) === 0
      && (cultural.fragrance?.length ?? 0) === 0
    ) {
      return NextResponse.json({ error: "culturalAffinities が必要です" }, { status: 400 });
    }

    const userMessage = [
      "[ユーザーの世界観]",
      `worldviewName: ${body.worldviewName ?? "未設定"}`,
      `patternId: ${body.patternId ?? "未設定"}`,
      body.idealSelf            ? `idealSelf: ${body.idealSelf}` : "",
      body.unconsciousTendency  ? `unconsciousTendency: ${body.unconsciousTendency}` : "",
      "",
      "[避けたい印象（avoidImpressions / Q2）]",
      (body.avoidImpressions ?? []).length > 0 ? body.avoidImpressions!.join("、") : "なし",
      "",
      "[着たくない服（avoidItems / Q16）]",
      (body.avoidItems ?? []).length > 0 ? body.avoidItems!.join("、") : "なし",
      "",
      "[説明対象のカルチャー項目（順序維持で全件返すこと）]",
      `music: ${(cultural.music ?? []).join("、") || "—"}`,
      `films: ${(cultural.films ?? []).join("、") || "—"}`,
      `fragrance: ${(cultural.fragrance ?? []).join("、") || "—"}`,
    ].filter((l) => l !== "").join("\n");

    const raw = await callClaudeJSON<{
      music?: unknown; films?: unknown; fragrance?: unknown;
    }>({
      systemPrompt: CULTURE_EXPLAIN_SYSTEM_PROMPT,
      userMessage,
      maxTokens: 2000,
    });

    const response: CultureExplainResponse = {
      music:     normalizeCategory(cultural.music,     raw.music),
      films:     normalizeCategory(cultural.films,     raw.films),
      fragrance: normalizeCategory(cultural.fragrance, raw.fragrance),
    };

    return NextResponse.json(response);
  } catch (err) {
    console.warn("[culture-explain] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "カルチャー解説の生成に失敗しました" }, { status: 500 });
  }
}
