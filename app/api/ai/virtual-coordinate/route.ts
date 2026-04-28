import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callClaudeJSON } from "@/lib/claude";
import { buildVirtualCoordinatePrompt } from "@/lib/prompts/virtual-coordinate";
import { getSeasonJST } from "@/lib/utils/season";
import type {
  BodyProfile,
  VirtualCoordinateItem,
  VirtualCoordinateResponse,
  VirtualCoordinateRole,
} from "@/types/index";

const VALID_ROLES = new Set<VirtualCoordinateRole>(["main", "base", "accent"]);
const VALID_CATEGORIES = new Set([
  "tops", "bottoms", "outerwear", "jacket", "vest", "inner", "dress", "setup",
  "shoes", "bags", "accessories", "hat", "jewelry", "roomwear", "other",
]);
const MAX_ITEMS = 5;
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

function normalize(raw: Record<string, unknown>, scene: string, season: string): VirtualCoordinateResponse {
  const items = Array.isArray(raw.items)
    ? raw.items.slice(0, MAX_ITEMS).map(normalizeItem).filter((it) => it.name)
    : [];
  return {
    scene,
    season,
    concept:     asString(raw.concept),
    items,
    stylingTips: asStringArray(raw.stylingTips, MAX_STYLING_TIPS),
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

    const season = getSeasonJST();

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

    const systemPrompt = buildVirtualCoordinatePrompt(
      scene,
      season,
      concept ?? null,
      userData?.body_profile,
      userData?.style_preference,
      userData?.style_analysis,
      userData?.worldview,
    );

    const userMessage = concept?.trim()
      ? `シーン「${scene}」かつコンセプト「${concept.trim()}」で、季節に合った理想のコーデを5アイテムで提案してください。`
      : `シーン「${scene}」かつ${season}の季節に合った理想のコーデを5アイテムで提案してください。`;

    const raw = await callClaudeJSON<Record<string, unknown>>({
      systemPrompt,
      userMessage,
      maxTokens: 3500,
    });

    return NextResponse.json(normalize(raw, scene, season));
  } catch (err) {
    const message = err instanceof Error ? err.message : "理想コーデの生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
