import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callClaudeJSON } from "@/lib/claude";
import { WARDROBE_COMPATIBILITY_PROMPT } from "@/lib/prompts/analyze";
import type { Database, Json } from "@/types/database";

type WardrobeInsert = Database["public"]["Tables"]["wardrobe_items"]["Insert"];
import type {
  WardrobeItem,
  WardrobeItemCreate,
  WardrobeCategory,
  WardrobeStatus,
  Season,
  WardrobeCompatibilityAIResponse,
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

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("wardrobe_items")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
    }

    return NextResponse.json((data ?? []).map(toWardrobeItem));
  } catch {
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = await request.json() as WardrobeItemCreate;

    const insertData: WardrobeInsert = {
      user_id: user.id,
      name: body.name,
      category: body.category,
      color: body.color,
      sub_color: body.subColor ?? null,
      material: body.material,
      fabric_texture: body.fabricTexture ?? null,
      brand: body.brand,
      season: body.seasons?.length ? body.seasons : ["all"],
      status: body.status ?? "owned",
      worldview_score: null,
      worldview_tags: null,
      silhouette: body.silhouette ?? null,
      taste: body.taste?.length ? body.taste : null,
      image_url: body.imageUrl,
      tags: body.tags ?? [],
      notes: body.notes,
    };

    const { data: row, error } = await supabase
      .from("wardrobe_items")
      .insert(insertData as never)
      .select()
      .single();

    if (error || !row) {
      return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 });
    }

    let item = toWardrobeItem(row);

    // スタイル軸との相性チェック
    let compatibility: WardrobeCompatibilityAIResponse | null = null;
    const { data: userData } = await supabase
      .from("users")
      .select("style_axis")
      .eq("id", user.id)
      .single() as { data: { style_axis: Json | null } | null };

    if (userData?.style_axis) {
      try {
        const userMessage = [
          `スタイル軸: ${JSON.stringify(userData.style_axis)}`,
          `追加アイテム:`,
          `- 名前: ${body.name}`,
          `- カテゴリ: ${body.category}`,
          `- 色: ${body.color}${body.subColor ? ` / サブカラー: ${body.subColor}` : ""}`,
          `- 素材: ${body.material ?? "未設定"}`,
          `- 生地感: ${body.fabricTexture ?? "未設定"}`,
          `- シルエット: ${body.silhouette ?? "未設定"}`,
          `- テイスト: ${body.taste?.join("・") || "未設定"}`,
        ].join("\n");

        compatibility = await callClaudeJSON<WardrobeCompatibilityAIResponse>({
          systemPrompt: WARDROBE_COMPATIBILITY_PROMPT,
          userMessage,
          maxTokens: 256,
        });

        if (compatibility) {
          await supabase
            .from("wardrobe_items")
            .update({
              worldview_score: compatibility.worldviewScore,
              worldview_tags: compatibility.worldviewTags,
            } as never)
            .eq("id", item.id);

          item = {
            ...item,
            worldviewScore: compatibility.worldviewScore,
            worldviewTags: compatibility.worldviewTags,
          };
        }
      } catch {
        // AI失敗時はスキップして登録だけ完了させる
      }
    }

    return NextResponse.json({ item, compatibility });
  } catch {
    return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id, status } = await request.json() as { id: string; status: string };

    if (!id || !status) {
      return NextResponse.json({ error: "IDとstatusが必要です" }, { status: 400 });
    }

    const { error } = await supabase
      .from("wardrobe_items")
      .update({ status } as never)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "IDが必要です" }, { status: 400 });
    }

    const { error } = await supabase
      .from("wardrobe_items")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
