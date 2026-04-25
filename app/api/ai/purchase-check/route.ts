import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callClaudeJSON } from "@/lib/claude";
import { PURCHASE_CHECK_PROMPT } from "@/lib/prompts/purchase";
import { validateAndFixPurchaseCheck } from "@/lib/validators/purchase-check";
import type { Database, Json } from "@/types/database";
import type {
  WardrobeItem,
  WardrobeCategory,
  WardrobeStatus,
  Season,
  PairingCandidate,
  ResolvedPairingGroup,
  ResolvedPairingCandidate,
  PurchaseCheckAIResponse,
  PurchaseCheckResponse,
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

    const { itemId } = await request.json() as { itemId: string };

    if (!itemId) {
      return NextResponse.json({ error: "アイテムIDが必要です" }, { status: 400 });
    }

    const { data: rows } = await supabase
      .from("wardrobe_items")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "アイテムが見つかりません" }, { status: 404 });
    }

    const allItems = rows.map(toWardrobeItem);
    const targetItem = allItems.find((i) => i.id === itemId);

    if (!targetItem) {
      return NextResponse.json({ error: "指定されたアイテムが見つかりません" }, { status: 404 });
    }

    const ownedItems = allItems.filter((i) => i.status === "owned" && i.id !== itemId);

    const { data: userData } = await supabase
      .from("users")
      .select("style_axis")
      .eq("id", user.id)
      .single() as unknown as { data: { style_axis: Json | null } | null };

    const ownedList = ownedItems.length > 0
      ? ownedItems.map((item) => [
          `- ID: ${item.id}`,
          `  名前: ${item.name}`,
          `  カテゴリ: ${item.category}`,
          `  色: ${item.color}${item.subColor ? ` / ${item.subColor}` : ""}`,
          `  素材: ${item.material ?? "未設定"}`,
          `  生地感: ${item.fabricTexture ?? "未設定"}`,
          `  シルエット: ${item.silhouette ?? "未設定"}`,
          `  テイスト: ${item.taste?.join("・") || "未設定"}`,
          `  ブランド: ${item.brand ?? "未設定"}`,
        ].join("\n")).join("\n\n")
      : "（なし）";

    const userMessage = [
      `スタイル軸: ${JSON.stringify(userData?.style_axis ?? "未設定")}`,
      ``,
      `検討中アイテム:`,
      `- ID: ${targetItem.id}`,
      `- 名前: ${targetItem.name}`,
      `- カテゴリ: ${targetItem.category}`,
      `- 色: ${targetItem.color}${targetItem.subColor ? ` / ${targetItem.subColor}` : ""}`,
      `- 素材: ${targetItem.material ?? "未設定"}`,
      `- 生地感: ${targetItem.fabricTexture ?? "未設定"}`,
      `- シルエット: ${targetItem.silhouette ?? "未設定"}`,
      `- テイスト: ${targetItem.taste?.join("・") || "未設定"}`,
      `- ブランド: ${targetItem.brand ?? "未設定"}`,
      ``,
      `手持ちアイテム（所有中のみ）:`,
      ownedList,
    ].join("\n");

    const rawResult = await callClaudeJSON<PurchaseCheckAIResponse>({
      systemPrompt: PURCHASE_CHECK_PROMPT,
      userMessage,
      maxTokens: 4096,
    });
    const aiResult = validateAndFixPurchaseCheck(rawResult);

    const itemMap = new Map(ownedItems.map((i) => [i.id, i]));

    const similarResolved = (aiResult.similarItems ?? [])
      .map((s) => {
        const item = itemMap.get(s.itemId);
        return item ? { item, reason: s.reason } : null;
      })
      .filter((x): x is { item: WardrobeItem; reason: string } => x !== null);

    const pairingGroupsResolved: ResolvedPairingGroup[] = (aiResult.pairingGroups ?? []).map((group) => {
      const resolvedCandidates: ResolvedPairingCandidate[] = (group.candidates ?? []).map((c: PairingCandidate) => ({
        source: c.source,
        item: c.itemId ? (itemMap.get(c.itemId) ?? null) : null,
        name: c.name,
        brand: c.brand,
        color: c.color,
        reasons: c.reasons,
      }));
      return {
        source: group.source,
        label: group.label,
        candidates: resolvedCandidates,
      };
    });

    const response: PurchaseCheckResponse = {
      result: aiResult,
      similarResolved,
      pairingGroupsResolved,
    };

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: `購入チェックに失敗しました: ${message}` }, { status: 500 });
  }
}
