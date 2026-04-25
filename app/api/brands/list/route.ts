import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

type BrandRow = Database["public"]["Tables"]["brands"]["Row"];

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("brands")
      .select("id, name, name_ja, country, description, worldview_tags, era_tags, maniac_level, price_range, official_url, instagram_url")
      .eq("is_active", true)
      .order("maniac_level", { ascending: false }) as unknown as { data: BrandRow[] | null };

    return NextResponse.json({ brands: data ?? [] });
  } catch {
    return NextResponse.json({ brands: [] });
  }
}
