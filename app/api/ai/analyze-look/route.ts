import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callClaudeWithImage, type ImageMediaType } from "@/lib/claude";
import { buildAnalyzeLookPrompt } from "@/lib/prompts/analyze-look";
import { insertAiHistory } from "@/lib/utils/history-helper";
import type { BodyProfile, LookAnalysisResponse, StylePreference } from "@/types/index";

const VALID_MEDIA_TYPES = new Set<ImageMediaType>(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function normalize(raw: Record<string, unknown>): LookAnalysisResponse {
  const la  = (raw.lookAnalysis       ?? {}) as Record<string, unknown>;
  const pa  = (raw.personalAdaptation ?? {}) as Record<string, unknown>;
  return {
    lookAnalysis: {
      silhouette:     asString(la.silhouette),
      topBottomRatio: asString(la.topBottomRatio),
      weightCenter:   asString(la.weightCenter),
      lengthBalance:  asString(la.lengthBalance),
      colorScheme:    asString(la.colorScheme),
      keyElements:    asStringArray(la.keyElements),
      whyLooksGood:   asString(la.whyLooksGood),
    },
    personalAdaptation: {
      howToAdapt:     asString(pa.howToAdapt),
      adjustments:    asStringArray(pa.adjustments),
      itemsToFind:    asStringArray(pa.itemsToFind),
      avoidPoints:    asStringArray(pa.avoidPoints),
      preferenceNote: asString(pa.preferenceNote),
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const { base64, mediaType } = await request.json() as { base64: string; mediaType: string };
    if (!base64) {
      return NextResponse.json({ error: "画像データが必要です" }, { status: 400 });
    }

    const safeMediaType: ImageMediaType = VALID_MEDIA_TYPES.has(mediaType as ImageMediaType)
      ? (mediaType as ImageMediaType)
      : "image/jpeg";

    const { data: userData } = await supabase
      .from("users")
      .select("body_profile, style_preference")
      .eq("id", user.id)
      .single() as unknown as {
        data: {
          body_profile:     BodyProfile | null;
          style_preference: StylePreference | null;
        } | null;
      };

    const systemPrompt = buildAnalyzeLookPrompt(
      userData?.body_profile,
      userData?.style_preference,
    );

    const raw = await callClaudeWithImage<Record<string, unknown>>(
      systemPrompt,
      base64,
      safeMediaType,
      "この写真の比率・シルエット・重心・色を分析し、ユーザーの体型でどう再現するかを提案してください。顔・個人属性は分析対象外です。",
      3000,
    );

    const response = normalize(raw);

    // Sprint 39: 履歴保存（fire-and-forget・base64画像はDBに保存しない）
    await insertAiHistory(
      supabase,
      user.id,
      "look_analysis",
      { mediaType: safeMediaType },
      response,
      { imageProvided: true },
    );

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "画像分析に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
