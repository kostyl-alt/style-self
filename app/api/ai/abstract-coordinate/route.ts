import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callClaudeJSON } from "@/lib/claude";
import {
  ABSTRACT_TO_DESIGN_PROMPT,
  ABSTRACT_COORDINATE_PROMPT,
} from "@/lib/prompts/abstract-coordinate";
import { validateAndFixCoordinate } from "@/lib/validators/coordinate";
import type { Database } from "@/types/database";
import type {
  WardrobeItem,
  WardrobeCategory,
  WardrobeStatus,
  Season,
  AbstractCoordinateRequest,
  AbstractToDesignResponse,
  CoordinateAIResponse,
  CoordinateItem,
  ResolvedCoordinateItem,
} from "@/types/index";

type WardrobeRow = Database["public"]["Tables"]["wardrobe_items"]["Row"];

function toWardrobeItem(row: WardrobeRow): WardrobeItem {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    category: row.category as WardrobeCategory,
    status: (row.status as WardrobeStatus) ?? "owned",
    worldviewScore: row.worldview_score,
    worldviewTags: (row.worldview_tags as string[] | null) ?? [],
    color: row.color,
    subColor: row.sub_color,
    material: row.material,
    fabricTexture: row.fabric_texture,
    brand: row.brand,
    seasons: (row.season as string[]).map((s) => s as Season),
    silhouette: row.silhouette,
    taste: (row.taste as string[] | null) ?? [],
    imageUrl: row.image_url,
    tags: row.tags,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const { abstractWords, theme } = await request.json() as AbstractCoordinateRequest;

    if (!abstractWords?.length && !theme) {
      return NextResponse.json({ error: "abstractWords または theme が必要です" }, { status: 400 });
    }

    // 手持ちアイテム取得（owned のみ）
    const { data: rows } = await supabase
      .from("wardrobe_items")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "owned")
      .order("created_at", { ascending: false });

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: "所有中のアイテムがありません。先にアイテムを登録してください。" },
        { status: 400 }
      );
    }

    const wardrobeItems = rows.map(toWardrobeItem);

    // Stage 1: 抽象語 → デザイン言語
    const inputWords = [
      ...(abstractWords ?? []),
      ...(theme ? [theme] : []),
    ];

    const stage1Message = `抽象語・テーマ: ${inputWords.join("、")}`;

    const designResult = await callClaudeJSON<AbstractToDesignResponse>({
      systemPrompt: ABSTRACT_TO_DESIGN_PROMPT,
      userMessage: stage1Message,
      maxTokens: 1024,
    });

    // Stage 2: デザイン言語 + 手持ちアイテム → コーデ提案
    const itemList = wardrobeItems
      .map((item) =>
        [
          `- ID: ${item.id}`,
          `名前: ${item.name}`,
          `カテゴリ: ${item.category}`,
          `色: ${item.color}${item.subColor ? `/${item.subColor}` : ""}`,
          item.material   ? `素材: ${item.material}` : null,
          item.silhouette ? `シルエット: ${item.silhouette}` : null,
          item.taste.length ? `テイスト: ${item.taste.join("/")}` : null,
        ].filter(Boolean).join(", ")
      )
      .join("\n");

    const stage2Message = [
      `元の抽象語: ${inputWords.join("、")}`,
      ``,
      `変換されたデザイン言語:`,
      JSON.stringify(designResult.translation, null, 2),
      ``,
      `手持ちアイテム（IDは必ず以下のリストから選ぶこと）:`,
      itemList,
    ].join("\n");

    const rawCoordinate = await callClaudeJSON<CoordinateAIResponse>({
      systemPrompt: ABSTRACT_COORDINATE_PROMPT,
      userMessage: stage2Message,
      maxTokens: 3500,
    });
    const coordinate = validateAndFixCoordinate(rawCoordinate);

    const itemMap = new Map(wardrobeItems.map((i) => [i.id, i]));
    const resolvedItems: ResolvedCoordinateItem[] = coordinate.items
      .reduce<ResolvedCoordinateItem[]>((acc, ci: CoordinateItem) => {
        const item = itemMap.get(ci.wardrobeItemId);
        if (item) acc.push({ item, role: ci.role, ...(ci.reason ? { reason: ci.reason } : {}) });
        return acc;
      }, []);

    return NextResponse.json({
      abstractWords: inputWords,
      designTranslation: designResult,
      coordinate,
      resolvedItems,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
