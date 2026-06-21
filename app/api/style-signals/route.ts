// 世界観リセット: 本人の style_signals(憧れ写真分析で育った事実タグ)を全削除する。
//
// DELETE /api/style-signals
// returns: { ok:true, deletedCount? } / { error }
//
// ⚠️ 物理削除・不可逆。auth.uid() の行だけ消す(RLS「users own style_signals」+ server で eq user.id 二重防御)。
//   ⚠️ 消すのは style_signals のみ。好み登録(users.style_preference)・体型(body_profile)・会話(threads)・
//      moodboard には一切触れない。空になると closet/追撃/brand-learn の個別化が graceful(無難寄り)に戻るだけ。
//   ⚠️ 本人分のみ削除なので「他人の世界観を消す」は構造的に不可能(auth 必須・user.id 固定)。

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function DELETE() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // ★ 本人分のみ削除(RLS と二重防御)。select("id") で削除件数を返す(完了フィードバック用)。
    const { data: deleted, error: delErr } = await supabase
      .from("style_signals")
      .delete()
      .eq("user_id", user.id)
      .select("id") as unknown as { data: { id: string }[] | null; error: { message: string } | null };

    if (delErr) {
      console.warn("[style-signals DELETE] error:", delErr.message);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deletedCount: deleted?.length ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[style-signals DELETE] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
