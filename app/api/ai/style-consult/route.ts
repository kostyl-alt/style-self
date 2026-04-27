import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callClaudeJSON } from "@/lib/claude";
import { buildStyleConsultPrompt } from "@/lib/prompts/style-consult";
import type { StyleConsultResponse, BodyProfile } from "@/types/index";

function validateAdjustments(raw: Record<string, unknown>): StyleConsultResponse["adjustments"] {
  const fields = ["silhouette", "length", "weightCenter", "color", "material", "shoes", "accessories", "sizing"] as const;
  const result = {} as StyleConsultResponse["adjustments"];
  for (const f of fields) {
    result[f] = typeof raw[f] === "string" ? (raw[f] as string) : "";
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const { consultation } = await request.json() as { consultation: string };
    if (!consultation?.trim()) {
      return NextResponse.json({ error: "相談内容を入力してください" }, { status: 400 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("body_profile, style_preference, style_analysis")
      .eq("id", user.id)
      .single() as unknown as {
        data: {
          body_profile:    BodyProfile | null;
          style_preference: Record<string, unknown> | null;
          style_analysis:  Record<string, unknown> | null;
        } | null;
      };

    const systemPrompt = buildStyleConsultPrompt(
      userData?.body_profile,
      userData?.style_preference,
      userData?.style_analysis,
    );

    const raw = await callClaudeJSON<Record<string, unknown>>({
      systemPrompt,
      userMessage: `【相談内容】\n${consultation}`,
      maxTokens: 2500,
    });

    const response: StyleConsultResponse = {
      analysis:       typeof raw.analysis === "string" ? raw.analysis : "",
      adjustments:    validateAdjustments((raw.adjustments ?? {}) as Record<string, unknown>),
      keyPoints:      Array.isArray(raw.keyPoints)    ? (raw.keyPoints as string[])    : [],
      itemsToFind:    Array.isArray(raw.itemsToFind)  ? (raw.itemsToFind as string[])  : [],
      avoidPoints:    Array.isArray(raw.avoidPoints)  ? (raw.avoidPoints as string[])  : [],
      preferenceNote: typeof raw.preferenceNote === "string" ? raw.preferenceNote : "",
    };

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "相談の処理に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
