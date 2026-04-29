import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callClaudeJSON, callClaudeWithImage, type ImageMediaType } from "@/lib/claude";
import { buildKnowledgeExtractPrompt } from "@/lib/prompts/knowledge-extract";
import { extractTextFromUrl } from "@/lib/utils/url-extract";
import { rowToKnowledgeSource, rowToKnowledgeRule } from "@/lib/utils/knowledge-merge";
import type { AnalyzeKnowledgeSourceResponse } from "@/types/index";

const ANALYZED_BY = "claude-sonnet-4-6";
const VALID_MEDIA_TYPES = new Set<ImageMediaType>(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_RULES_PER_SOURCE = 3;

interface ExtractedRule {
  concept_keyword:         string;
  aliases:                 string[];
  emotion:                 string;
  persona_image:           string;
  cultural_context:        string;
  era:                     string;
  philosophy:              string;
  recommended_colors:      string[];
  recommended_materials:   string[];
  recommended_silhouettes: string[];
  required_accessories:    string[];
  ng_elements:             string[];
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, max);
}

function normalizeExtractedRule(raw: unknown): ExtractedRule | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const keyword = asString(r.concept_keyword).trim().slice(0, 80);
  if (!keyword) return null;
  return {
    concept_keyword:         keyword,
    aliases:                 asStringArray(r.aliases, 5),
    emotion:                 asString(r.emotion),
    persona_image:           asString(r.persona_image),
    cultural_context:        asString(r.cultural_context),
    era:                     asString(r.era),
    philosophy:              asString(r.philosophy),
    recommended_colors:      asStringArray(r.recommended_colors, 6),
    recommended_materials:   asStringArray(r.recommended_materials, 5),
    recommended_silhouettes: asStringArray(r.recommended_silhouettes, 5),
    required_accessories:    asStringArray(r.required_accessories, 4),
    ng_elements:             asStringArray(r.ng_elements, 5),
  };
}

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mediaType: ImageMediaType }> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`画像の取得に失敗しました: HTTP ${res.status}`);
  const contentType = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
  const safeMediaType: ImageMediaType = VALID_MEDIA_TYPES.has(contentType as ImageMediaType)
    ? (contentType as ImageMediaType)
    : "image/jpeg";
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return { base64, mediaType: safeMediaType };
}

const IMAGE_LIKE_TYPES = new Set(["image", "book", "lookbook", "video"]);

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    // ソース取得
    const { data: sourceRow, error: sourceErr } = await supabase
      .from("knowledge_sources")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();

    if (sourceErr || !sourceRow) {
      return NextResponse.json({ error: "ソースが見つかりません" }, { status: 404 });
    }

    const source = rowToKnowledgeSource(sourceRow as unknown as Record<string, unknown>);

    if (source.isAnalyzed) {
      return NextResponse.json({ error: "既に分析済みです" }, { status: 409 });
    }

    const systemPrompt = buildKnowledgeExtractPrompt(source.title, source.sourceType);
    let raw: { rules?: unknown };

    // ---- ソースタイプ別の Claude 呼び出し ----
    const isImageLike = IMAGE_LIKE_TYPES.has(source.sourceType) && source.imageUrl;

    if (isImageLike && source.imageUrl) {
      // 画像分析
      const { base64, mediaType } = await fetchImageAsBase64(source.imageUrl);
      const userMsg = [
        `この画像（${source.sourceType}）からファッションコンセプトを最大3つ抽出してください。`,
        `タイトル: ${source.title}`,
        source.author ? `著者・撮影者: ${source.author}` : "",
        source.citationNote ? `出典: ${source.citationNote}` : "",
      ].filter(Boolean).join("\n");
      raw = await callClaudeWithImage<{ rules?: unknown }>(
        systemPrompt,
        base64,
        mediaType,
        userMsg,
        3000,
      );
    } else {
      // テキスト分析（memo / expert_note / url、または画像URL未指定の book / lookbook / video）
      let content = source.contentText ?? "";
      if (source.sourceType === "url") {
        if (!source.url) {
          return NextResponse.json({ error: "URLが登録されていません" }, { status: 400 });
        }
        try {
          content = await extractTextFromUrl(source.url);
        } catch (err) {
          const detail = err instanceof Error ? err.message : "unknown";
          return NextResponse.json({
            error: `URLの取得に失敗しました。本文をメモにコピペしてください。(${detail})`,
          }, { status: 400 });
        }
      }
      if (!content?.trim()) {
        return NextResponse.json({ error: "分析対象のテキストがありません" }, { status: 400 });
      }
      const userMsg = [
        `タイトル: ${source.title}`,
        source.author ? `著者: ${source.author}` : "",
        source.citationNote ? `出典: ${source.citationNote}` : "",
        "",
        "[本文]",
        content,
      ].filter(Boolean).join("\n");

      raw = await callClaudeJSON<{ rules?: unknown }>({
        systemPrompt,
        userMessage: userMsg,
        maxTokens:   3000,
      });
    }

    // ---- 抽出ルール正規化 ----
    const extracted: ExtractedRule[] = Array.isArray(raw.rules)
      ? raw.rules
          .map(normalizeExtractedRule)
          .filter((r): r is ExtractedRule => r !== null)
          .slice(0, MAX_RULES_PER_SOURCE)
      : [];

    if (extracted.length === 0) {
      return NextResponse.json({ error: "ルールを抽出できませんでした" }, { status: 422 });
    }

    // ---- knowledge_rules に一括INSERT ----
    const insertRows = extracted.map((r) => ({
      source_id:               source.id,
      user_id:                 user.id,
      concept_keyword:         r.concept_keyword,
      aliases:                 r.aliases,
      emotion:                 r.emotion || null,
      persona_image:           r.persona_image || null,
      cultural_context:        r.cultural_context || null,
      era:                     r.era || null,
      philosophy:              r.philosophy || null,
      recommended_colors:      r.recommended_colors,
      recommended_materials:   r.recommended_materials,
      recommended_silhouettes: r.recommended_silhouettes,
      required_accessories:    r.required_accessories,
      ng_elements:             r.ng_elements,
      weight:                  50,
      visibility:              "private",
      is_active:               true,
    }));

    const { data: insertedRows, error: insertErr } = await supabase
      .from("knowledge_rules")
      .insert(insertRows as never)
      .select();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // ---- ソースを「分析済み」に更新 ----
    const { data: updatedSource, error: updateErr } = await supabase
      .from("knowledge_sources")
      .update({
        is_analyzed: true,
        analyzed_at: new Date().toISOString(),
        analyzed_by: ANALYZED_BY,
      } as never)
      .eq("id", source.id)
      .select()
      .single();

    if (updateErr || !updatedSource) {
      return NextResponse.json({ error: "ソース更新に失敗しました" }, { status: 500 });
    }

    const response: AnalyzeKnowledgeSourceResponse = {
      source: rowToKnowledgeSource(updatedSource as unknown as Record<string, unknown>),
      rules:  ((insertedRows ?? []) as unknown as Record<string, unknown>[]).map(rowToKnowledgeRule),
    };

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI分析に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
