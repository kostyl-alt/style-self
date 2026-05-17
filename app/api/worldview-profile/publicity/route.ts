// M2-4: 世界観プロフィールの公開/非公開トグル API
//
// 本人が自分の worldview_profiles.is_public を更新する PATCH エンドポイント。
//
// 【設計】
// - createSupabaseServerClient()(認証 anon client)を使う。service_role は使わない。
// - 認証から取った user.id を update の .eq() 条件に直接使う(body から userId を
//   受け取らない)= リクエストパラメータで他人の id を指定できない。
// - さらに RLS の既存ポリシー "users own worldview_profile" FOR ALL が
//   auth.uid() = user_id を要求するため、万一フィルタが消えても他人の行は更新不可。
// - 二重防御(アプリ層フィルタ + RLS)。
// - body は { isPublic: boolean } のみ。boolean 以外は 400 で拒否。

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();

    // 認証チェック
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // body パース + バリデーション
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON パースに失敗しました" }, { status: 400 });
    }
    const isPublic = (body as { isPublic?: unknown })?.isPublic;
    if (typeof isPublic !== "boolean") {
      return NextResponse.json({ error: "isPublic は boolean が必要です" }, { status: 400 });
    }

    // 本人の worldview_profiles 行だけ更新。
    // - .eq("user_id", user.id): アプリ層で本人限定を保証
    // - RLS "users own worldview_profile" FOR ALL: DB 層でも本人限定を保証
    // types/database.ts に is_public 列が未掲載のため Supabase v2 型推論が never に
    // 落ちる。既存パターンに合わせて as never キャストで吸収。
    const { error: updErr } = await supabase
      .from("worldview_profiles")
      .update({
        is_public: isPublic,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("user_id", user.id);

    if (updErr) {
      console.warn("[worldview-profile/publicity] update error:", updErr.message);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, isPublic });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[worldview-profile/publicity] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
