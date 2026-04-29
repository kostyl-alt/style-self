import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { rowToAiHistory } from "@/lib/utils/history-helper";
import type { AiHistoryListResponse, AiHistoryType } from "@/types/index";

const VALID_TYPES = new Set<AiHistoryType>([
  "diagnosis", "consultation", "look_analysis", "virtual_coordinate",
]);

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const limitRaw = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
    const offsetRaw = Number(searchParams.get("offset") ?? 0);
    const limit = Math.min(Math.max(1, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT), MAX_LIMIT);
    const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);

    let query = supabase
      .from("ai_history")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (type && VALID_TYPES.has(type as AiHistoryType)) {
      query = query.eq("type", type);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    const response: AiHistoryListResponse = {
      histories: rows.map(rowToAiHistory),
    };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "履歴の取得に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
