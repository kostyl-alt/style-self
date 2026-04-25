import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import type { Trend, TrendCategory } from "@/types/index";

interface TrendRow {
  id: string;
  season: string;
  year: number;
  keyword: string;
  category: string;
  description: string;
  applicable_styles: string[];
  incompatible_styles: string[];
  adaptation_hint: string | null;
  display_order: number;
}

function rowToTrend(row: TrendRow): Trend {
  return {
    id: row.id,
    season: row.season,
    year: row.year,
    keyword: row.keyword,
    category: row.category as TrendCategory,
    description: row.description,
    applicableStyles: row.applicable_styles ?? [],
    incompatibleStyles: row.incompatible_styles ?? [],
    adaptationHint: row.adaptation_hint,
    displayOrder: row.display_order,
  };
}

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("trends")
      .select("id, season, year, keyword, category, description, applicable_styles, incompatible_styles, adaptation_hint, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true }) as unknown as {
        data: TrendRow[] | null;
        error: { message: string } | null;
      };

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ trends: (data ?? []).map(rowToTrend) });
  } catch {
    return NextResponse.json({ error: "トレンドの取得に失敗しました" }, { status: 500 });
  }
}
