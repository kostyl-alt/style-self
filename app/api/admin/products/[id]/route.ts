import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/utils/admin-check";

// Sprint 41: 商品ソフト削除
// is_available=false に UPDATE する。物理削除はしない（履歴・URL切れ検知用）。

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    }

    const service = createServiceClient();
    const { error } = await service
      .from("external_products")
      .update({ is_available: false } as never)
      .eq("id", params.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "削除に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
