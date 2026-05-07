import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callClaudeJSON } from "@/lib/claude";
import { buildCoordinateSystemPrompt } from "@/lib/prompts/coordinate";
import { getMaterialContext, getColorContext } from "@/lib/dictionaries/inject";
import { validateAndFixCoordinate } from "@/lib/validators/coordinate";
import type { Database } from "@/types/database";
import type {
  WardrobeItem,
  WardrobeCategory,
  WardrobeStatus,
  Season,
  CoordinateAIResponse,
  CoordinateItem,
  ResolvedCoordinateItem,
  CoordinateGenerateResponse,
  StylePreference,
  BodyProfile,
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

    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { scene, mood } = await request.json() as { scene: string; mood?: string };

    const { data: userData } = await supabase
      .from("users")
      .select("style_axis, worldview, height, weight, body_type, body_tendency, weight_center, shoulder_width, style_preference, body_profile, avoid_items")
      .eq("id", user.id)
      .single() as unknown as {
        data: {
          style_axis: unknown;
          worldview: unknown;
          height: number | null;
          weight: number | null;
          body_type: string | null;
          body_tendency: string | null;
          weight_center: string | null;
          shoulder_width: string | null;
          style_preference: unknown;
          body_profile: BodyProfile | null;
          avoid_items: string[] | null;
        } | null;
      };

    const { data: rows } = await supabase
      .from("wardrobe_items")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: "クローゼットにアイテムがありません。先にアイテムを登録してください。" },
        { status: 400 }
      );
    }

    const wardrobeItems = rows.map(toWardrobeItem);

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

    const bodyLines: string[] = [];
    if (userData) {
      const { height, weight, body_type, body_tendency, weight_center, shoulder_width } = userData;
      if (height)         bodyLines.push(`身長: ${height}cm`);
      if (weight)         bodyLines.push(`体重: ${weight}kg`);
      if (body_type)      bodyLines.push(`骨格: ${body_type}`);
      if (body_tendency)  bodyLines.push(`体型傾向: ${body_tendency}`);
      if (weight_center)  bodyLines.push(`重心: ${weight_center}`);
      if (shoulder_width) bodyLines.push(`肩幅: ${shoulder_width}`);
    }

    const userMessage = [
      `スタイル軸: ${JSON.stringify(userData?.style_axis ?? "未設定")}`,
      userData?.worldview ? `世界観・信念: ${JSON.stringify(userData.worldview)}` : "",
      bodyLines.length ? `身体情報: ${bodyLines.join(", ")}` : "",
      ``,
      `シーン: ${scene}`,
      mood ? `気分: ${mood}` : "",
      ``,
      `手持ちアイテム（IDを必ず上記のリストから選ぶこと）:`,
      itemList,
    ].filter((l) => l !== "").join("\n");

    const materials = Array.from(new Set(wardrobeItems.map((i) => i.material).filter((m): m is string => !!m)));
    const colors = Array.from(new Set(wardrobeItems.flatMap((i) => [i.color, i.subColor]).filter((c): c is string => !!c)));
    const stylePreference = userData?.style_preference as StylePreference | null | undefined;
    const bodyProfile     = userData?.body_profile ?? undefined;
    const avoidItems      = userData?.avoid_items ?? [];
    const systemPrompt = buildCoordinateSystemPrompt(
      getMaterialContext(materials),
      getColorContext(colors),
      stylePreference ?? undefined,
      bodyProfile,
      avoidItems,
      mood,
    );

    const rawCoordinate = await callClaudeJSON<CoordinateAIResponse>({
      systemPrompt,
      userMessage,
      maxTokens: 3500,
    });
    const coordinate = validateAndFixCoordinate(rawCoordinate);

    if (!coordinate.items || coordinate.items.length === 0) {
      return NextResponse.json(
        { error: "コーデアイテムが生成されませんでした。もう一度試してください。" },
        { status: 400 }
      );
    }

    const itemMap = new Map(wardrobeItems.map((i) => [i.id, i]));
    const resolvedItems: ResolvedCoordinateItem[] = coordinate.items
      .reduce<ResolvedCoordinateItem[]>((acc, ci: CoordinateItem) => {
        const item = itemMap.get(ci.wardrobeItemId);
        if (item) acc.push({ item, role: ci.role, ...(ci.reason ? { reason: ci.reason } : {}) });
        return acc;
      }, []);

    const response: CoordinateGenerateResponse = { coordinate, resolvedItems };
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: "コーデ生成に失敗しました" }, { status: 500 });
  }
}
