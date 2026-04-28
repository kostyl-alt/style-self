import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callClaudeJSON } from "@/lib/claude";
import { buildVirtualConceptsPrompt } from "@/lib/prompts/virtual-coordinate";
import { getSeasonJST } from "@/lib/utils/season";
import type {
  BodyProfile,
  VirtualConceptCandidate,
  VirtualConceptsResponse,
} from "@/types/index";

const MAX_CONCEPTS = 3;

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function normalizeCandidate(raw: unknown): VirtualConceptCandidate {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    title:       asString(r.title),
    description: asString(r.description),
  };
}

function normalize(raw: Record<string, unknown>, scene: string, season: string): VirtualConceptsResponse {
  const concepts = Array.isArray(raw.concepts)
    ? raw.concepts.slice(0, MAX_CONCEPTS).map(normalizeCandidate).filter((c) => c.title)
    : [];
  return { scene, season, concepts };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const { scene } = await request.json() as { scene: string };
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

    const systemPrompt = buildVirtualConceptsPrompt(
      scene,
      season,
      userData?.body_profile,
      userData?.style_preference,
      userData?.style_analysis,
      userData?.worldview,
    );

    const raw = await callClaudeJSON<Record<string, unknown>>({
      systemPrompt,
      userMessage: `シーン「${scene}」かつ${season}に合うコンセプト候補を3案提案してください。`,
      maxTokens: 1500,
    });

    return NextResponse.json(normalize(raw, scene, season));
  } catch (err) {
    const message = err instanceof Error ? err.message : "コンセプト候補の生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
