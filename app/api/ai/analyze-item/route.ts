import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callClaudeWithImage, type ImageMediaType } from "@/lib/claude";
import { ANALYZE_ITEM_SYSTEM_PROMPT } from "@/lib/prompts/analyze-item";
import { validateAndFixItemAnalysis } from "@/lib/validators/analyze-item";
import type { ItemAnalysisAIResponse } from "@/types/index";

const VALID_MEDIA_TYPES = new Set<ImageMediaType>(["image/jpeg", "image/png", "image/gif", "image/webp"]);

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

    const raw = await callClaudeWithImage<ItemAnalysisAIResponse>(
      ANALYZE_ITEM_SYSTEM_PROMPT,
      base64,
      safeMediaType,
    );
    const result = validateAndFixItemAnalysis(raw);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "画像解析に失敗しました" }, { status: 500 });
  }
}
