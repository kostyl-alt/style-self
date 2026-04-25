import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Database, Json } from "@/types/database";
import type { CoordinateAIResponse } from "@/types/index";

type CoordinateInsert = Database["public"]["Tables"]["coordinates"]["Insert"];

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const { data, error } = await supabase
      .from("coordinates")
      .select("id, color_story, belief_alignment, occasion, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20) as unknown as {
        data: { id: string; color_story: string; belief_alignment: string; occasion: string | null; created_at: string }[] | null;
        error: unknown;
      };

    if (error) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
    return NextResponse.json(data ?? []);
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

    const { coordinate, occasion } = await request.json() as {
      coordinate: CoordinateAIResponse;
      occasion: string;
    };

    const insertData: CoordinateInsert = {
      user_id: user.id,
      items: coordinate.items as unknown as Json,
      color_story: coordinate.colorStory,
      belief_alignment: coordinate.beliefAlignment,
      trend_note: coordinate.trendNote || null,
      occasion: occasion || null,
    };

    const { data, error } = await supabase
      .from("coordinates")
      .insert(insertData as never)
      .select("id")
      .single() as unknown as { data: { id: string } | null; error: unknown };

    if (error || !data) {
      return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch {
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}
