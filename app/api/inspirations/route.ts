import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

type InspirationRow = Database["public"]["Tables"]["inspirations"]["Row"];

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("inspirations")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true }) as unknown as { data: InspirationRow[] | null };

    return NextResponse.json({ inspirations: data ?? [] });
  } catch {
    return NextResponse.json({ inspirations: [] });
  }
}
