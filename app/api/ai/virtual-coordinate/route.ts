import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callClaudeJSON } from "@/lib/claude";
import { buildVirtualCoordinatePrompt } from "@/lib/prompts/virtual-coordinate";
import { buildConceptTranslatePrompt } from "@/lib/prompts/concept-translate";
import { normalizeInterpretation } from "@/lib/prompts/normalize-interpretation";
import { getSeasonJST } from "@/lib/utils/season";
import type {
  BodyProfile,
  ConceptInterpretation,
  VirtualCoordinateItem,
  VirtualCoordinateResponse,
  VirtualCoordinateRole,
} from "@/types/index";

const VALID_ROLES = new Set<VirtualCoordinateRole>(["main", "base", "accent"]);
const VALID_CATEGORIES = new Set([
  "tops", "bottoms", "outerwear", "jacket", "vest", "inner", "dress", "setup",
  "shoes", "bags", "accessories", "hat", "jewelry", "roomwear", "other",
]);
const MIN_ITEMS = 5;
const MAX_ITEMS = 7;
const MAX_STYLING_TIPS = 3;

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
  };
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

    // ---- Stage 1: コンセプト翻訳 ----
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

    const conceptInterpretation = normalizeInterpretation(rawInterp);

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

    const response = normalize(rawCoord, scene, season, trimmedConcept, conceptInterpretation);

    // 最低アイテム数を満たさない場合は警告（クライアント側で扱う）
    if (response.items.length < MIN_ITEMS) {
      console.warn(`virtual-coordinate: only ${response.items.length} items returned (expected ${MIN_ITEMS}-${MAX_ITEMS})`);
    }

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "理想コーデの生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
