import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callClaudeJSON } from "@/lib/claude";
import { buildVirtualCoordinatePrompt } from "@/lib/prompts/virtual-coordinate";
import { buildConceptTranslatePrompt } from "@/lib/prompts/concept-translate";
import { normalizeInterpretation } from "@/lib/prompts/normalize-interpretation";
import { getSeasonJST } from "@/lib/utils/season";
import { mergeRulesToInterpretation, rowToKnowledgeRule } from "@/lib/utils/knowledge-merge";
import { insertAiHistory } from "@/lib/utils/history-helper";
import type {
  BodyProfile,
  ConceptInterpretation,
  ConceptSource,
  KnowledgeRule,
  VirtualCoordinateItem,
  VirtualCoordinateResponse,
  VirtualCoordinateRole,
} from "@/types/index";
import type { SupabaseClient } from "@supabase/supabase-js";

const VALID_ROLES = new Set<VirtualCoordinateRole>(["main", "base", "accent"]);
const VALID_CATEGORIES = new Set([
  "tops", "bottoms", "outerwear", "jacket", "vest", "inner", "dress", "setup",
  "shoes", "bags", "accessories", "hat", "jewelry", "roomwear", "other",
]);
const MIN_ITEMS = 5;
const MAX_ITEMS = 7;
const MAX_STYLING_TIPS = 3;
const KNOWLEDGE_LOOKUP_LIMIT = 5;

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string").slice(0, max);
}

function normalizeRole(v: unknown): VirtualCoordinateRole {
  return typeof v === "string" && VALID_ROLES.has(v as VirtualCoordinateRole)
    ? (v as VirtualCoordinateRole)
    : "base";
}

function normalizeCategory(v: unknown): string {
  return typeof v === "string" && VALID_CATEGORIES.has(v) ? v : "other";
}

function normalizeItem(raw: unknown): VirtualCoordinateItem {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    role:         normalizeRole(r.role),
    category:     normalizeCategory(r.category),
    name:         asString(r.name),
    color:        asString(r.color),
    reason:       asString(r.reason),
    zozoKeyword:  asString(r.zozoKeyword) || asString(r.name),
    sizeNote:     asString(r.sizeNote),
    materialNote: asString(r.materialNote),
    alternative:  asString(r.alternative),
  };
}

function normalize(
  raw: Record<string, unknown>,
  scene: string,
  season: string,
  concept: string,
  conceptInterpretation: ConceptInterpretation,
  conceptSource: ConceptSource,
  matchedRuleKeywords: string[],
): VirtualCoordinateResponse {
  const items = Array.isArray(raw.items)
    ? raw.items.slice(0, MAX_ITEMS).map(normalizeItem).filter((it) => it.name)
    : [];
  return {
    scene,
    season,
    concept:               asString(raw.concept) || concept,
    conceptInterpretation,
    seasonNote:            asString(raw.seasonNote),
    whyThisCoordinate:     asString(raw.whyThisCoordinate),
    ngExample:             asString(raw.ngExample),
    items,
    stylingTips:           asStringArray(raw.stylingTips, MAX_STYLING_TIPS),
    conceptSource,
    matchedRuleKeywords,
  };
}

// 知識ベースを検索して、ヒットしたルールをマージする。
// 入力 concept にマッチするキーワードを複数試行（例: 全文 + 個別単語）。
async function lookupKnowledgeRules(
  supabase: SupabaseClient,
  concept: string,
): Promise<KnowledgeRule[]> {
  // concept をスペース・読点・全角スペースで分割し、長さ2以上の語のみ採用
  const tokens = concept
    .split(/[\s　、。・／/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  // 全文も含めて検索（順序: 全文を先頭にすることで完全一致を優先）
  const queries = Array.from(new Set([concept.trim(), ...tokens]));

  console.log("[knowledge-lookup] concept input:", JSON.stringify(concept));
  console.log("[knowledge-lookup] queries:", queries);

  // 診断用: テーブルに admin 行が何件あるか確認
  const { count: adminCount, error: countError } = await supabase
    .from("knowledge_rules")
    .select("*", { count: "exact", head: true })
    .eq("visibility", "admin")
    .eq("is_active", true);
  if (countError) {
    console.error("[knowledge-lookup] count query error:", countError);
  } else {
    console.log(`[knowledge-lookup] visible admin rules in DB: ${adminCount ?? 0}`);
  }

  const allRows = new Map<string, Record<string, unknown>>();

  await Promise.all(
    queries.map(async (q) => {
      const [byKeyword, byAlias] = await Promise.all([
        supabase
          .from("knowledge_rules")
          .select("*")
          .ilike("concept_keyword", `%${q}%`)
          .order("weight", { ascending: false })
          .limit(KNOWLEDGE_LOOKUP_LIMIT),
        supabase
          .from("knowledge_rules")
          .select("*")
          .contains("aliases", [q])
          .order("weight", { ascending: false })
          .limit(KNOWLEDGE_LOOKUP_LIMIT),
      ]);
      const keywordRows = (byKeyword.data ?? []) as unknown as Record<string, unknown>[];
      const aliasRows   = (byAlias.data   ?? []) as unknown as Record<string, unknown>[];
      console.log(
        `[knowledge-lookup] q="${q}" byKeyword=${keywordRows.length} byAlias=${aliasRows.length}`,
        byKeyword.error ? `(byKeyword error: ${byKeyword.error.message})` : "",
        byAlias.error   ? `(byAlias error: ${byAlias.error.message})`   : "",
      );
      for (const row of keywordRows) allRows.set(row.id as string, row);
      for (const row of aliasRows)   allRows.set(row.id as string, row);
    }),
  );

  // 上限まで weight 降順で
  const rules = Array.from(allRows.values()).map(rowToKnowledgeRule);
  rules.sort((a, b) => b.weight - a.weight);
  const topRules = rules.slice(0, KNOWLEDGE_LOOKUP_LIMIT);
  console.log(
    `[knowledge-lookup] total unique rows=${allRows.size}, returning ${topRules.length}:`,
    topRules.map((r) => `${r.conceptKeyword}(w=${r.weight})`),
  );
  return topRules;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const { scene, concept } = await request.json() as { scene: string; concept?: string };
    if (!scene?.trim()) {
      return NextResponse.json({ error: "シーンを指定してください" }, { status: 400 });
    }
    if (!concept?.trim()) {
      return NextResponse.json({ error: "コンセプトを指定してください" }, { status: 400 });
    }

    const season = getSeasonJST();
    const trimmedConcept = concept.trim();

    const { data: userData } = await supabase
      .from("users")
      .select("body_profile, style_preference, style_analysis, worldview")
      .eq("id", user.id)
      .single() as unknown as {
        data: {
          body_profile:     BodyProfile | null;
          style_preference: Record<string, unknown> | null;
          style_analysis:   Record<string, unknown> | null;
          worldview:        Record<string, unknown> | null;
        } | null;
      };

    // ---- Stage 1: 知識ベース検索 → なければ Claude 翻訳にフォールバック ----
    let conceptInterpretation: ConceptInterpretation;
    let conceptSource: ConceptSource;
    let matchedRuleKeywords: string[] = [];

    const matchedRules = await lookupKnowledgeRules(supabase, trimmedConcept);
    if (matchedRules.length > 0) {
      conceptInterpretation = mergeRulesToInterpretation(matchedRules);
      conceptSource = "knowledge_base";
      matchedRuleKeywords = matchedRules.map((r) => r.conceptKeyword);
      console.log(`[virtual-coordinate] using knowledge_base. matched: ${matchedRuleKeywords.join(", ")}`);
    } else {
      console.log(`[virtual-coordinate] no DB match for "${trimmedConcept}", falling back to Claude Stage 1`);
      const translatePrompt = buildConceptTranslatePrompt(
        trimmedConcept,
        scene,
        season,
        userData?.body_profile,
        userData?.style_preference,
      );

      const rawInterp = await callClaudeJSON<Record<string, unknown>>({
        systemPrompt: translatePrompt,
        userMessage:  `「${trimmedConcept}」を${season}・${scene}向けのファッション要素に翻訳してください。`,
        maxTokens:    1500,
      });

      conceptInterpretation = normalizeInterpretation(rawInterp);
      conceptSource = "ai_generated";
    }
    console.log(`[virtual-coordinate] conceptSource=${conceptSource}, interpretation colors:`, conceptInterpretation.recommendedColors);

    // ---- Stage 3: コーデ設計 ----
    const coordPrompt = buildVirtualCoordinatePrompt(
      scene,
      season,
      trimmedConcept,
      conceptInterpretation,
      userData?.body_profile,
      userData?.style_preference,
      userData?.style_analysis,
      userData?.worldview,
    );

    const rawCoord = await callClaudeJSON<Record<string, unknown>>({
      systemPrompt: coordPrompt,
      userMessage:  `シーン「${scene}」、季節「${season}」、コンセプト「${trimmedConcept}」で、コンセプト解釈に厳格に従った理想のコーデを5〜7アイテムで設計してください。`,
      maxTokens:    4000,
    });

    const response = normalize(
      rawCoord,
      scene,
      season,
      trimmedConcept,
      conceptInterpretation,
      conceptSource,
      matchedRuleKeywords,
    );

    if (response.items.length < MIN_ITEMS) {
      console.warn(`virtual-coordinate: only ${response.items.length} items returned (expected ${MIN_ITEMS}-${MAX_ITEMS})`);
    }

    // Sprint 39: 履歴保存（fire-and-forget）
    await insertAiHistory(
      supabase,
      user.id,
      "virtual_coordinate",
      { scene, concept: trimmedConcept },
      response,
      { season, conceptSource, matchedRuleKeywords },
    );

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "理想コーデの生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
