import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Worldview, StylePreference } from "@/types/index";

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const { data, error } = await supabase
      .from("users")
      .select("worldview, style_preference")
      .eq("id", user.id)
      .single() as unknown as {
        data: { worldview: Worldview | null; style_preference: StylePreference | null } | null;
        error: { message: string } | null;
      };

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data)  return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });

    return NextResponse.json({ worldview: data.worldview, stylePreference: data.style_preference });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const body = await request.json() as { worldview?: Worldview; stylePreference?: StylePreference };

    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.worldview !== undefined)       updatePayload.worldview       = body.worldview;
    if (body.stylePreference !== undefined) updatePayload.style_preference = body.stylePreference;

    const { error } = await supabase
      .from("users")
      .update(updatePayload as never)
      .eq("id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
