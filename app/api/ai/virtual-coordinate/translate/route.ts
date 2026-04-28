import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callClaudeJSON } from "@/lib/claude";
import { buildConceptTranslatePrompt } from "@/lib/prompts/concept-translate";
import { normalizeInterpretation } from "@/lib/prompts/normalize-interpretation";
import { getSeasonJST } from "@/lib/utils/season";
import type { BodyProfile, ConceptInterpretation } from "@/types/index";

interface TranslateResponse {
  scene:                 string;
  season:                string;
  concept:               string;
  conceptInterpretation: ConceptInterpretation;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const { scene, concept } = await request.json() as { scene: string; concept: string };
    if (!scene?.trim()) {
      return NextResponse.json({ error: "シーンを指定してください" }, { status: 400 });
    }
    if (!concept?.trim()) {
      return NextResponse.json({ error: "コンセプトを指定してください" }, { status: 400 });
    }

    const season = getSeasonJST();

    const { data: userData } = await supabase
      .from("users")
      .select("body_profile, style_preference")
      .eq("id", user.id)
      .single() as unknown as {
        data: {
          body_profile:     BodyProfile | null;
          style_preference: Record<string, unknown> | null;
        } | null;
      };

    const systemPrompt = buildConceptTranslatePrompt(
      concept.trim(),
      scene,
      season,
      userData?.body_profile,
      userData?.style_preference,
    );

    const raw = await callClaudeJSON<Record<string, unknown>>({
      systemPrompt,
      userMessage: `「${concept.trim()}」を${season}・${scene}向けのファッション要素に翻訳してください。`,
      maxTokens: 1500,
    });

    const response: TranslateResponse = {
      scene,
      season,
      concept: concept.trim(),
      conceptInterpretation: normalizeInterpretation(raw),
    };

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "コンセプトの翻訳に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
