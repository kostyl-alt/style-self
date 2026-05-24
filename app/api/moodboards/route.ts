// D1 Phase 2 ムードボード API: 自分の MB 一覧 GET / MB 新規作成 POST
//
// GET  /api/moodboards
// POST /api/moodboards
//
// 設計: docs/STYLE-SELF_D1_Sprint_C-2_段階2_API_設計調査.md(1c0a270)§4.1
// 段階1 基盤: supabase/migrations/026_d1_moodboards.sql(ec12f7b)
//
// 【セキュリティ / プライバシー(三重防御維持・既存 posts/route.ts と同型)】
//   ・createSupabaseServerClient()(cookie-bound RLS)のみ・★ service_role 不使用
//   ・user_id は body から受けない → auth.getUser() の user.id 固定使用
//     = 他人になりすました MB 作成が構造的に不可能
//   ・★ 列絞り SELECT: worldview_tags / worldview_keywords は SELECT 句に書かない
//     (三重防御 1・worldview_name のみ取得・英語スラッグ非露出)
//   ・★ is_public default false(地雷 8 オプトイン公開・本体 ac834bb L376 確定)
//   ・RLS "users own moodboards" FOR ALL + "public moodboards readable by anyone" SELECT
//     が DB 層の最終防御(段階1 026_d1_moodboards.sql で確立済)
//
// 【世界観スナップショット】M3 posts/route.ts と同形
//   投稿時に worldview_profiles から worldview_tags/keywords/name をサーバ側で取得して
//   moodboards にコピー。再診断後も作成時の世界観が不変(M4 マッチング素材化の前提)。
//   未診断ユーザー(worldview_profiles 行なし)は空配列/null で作成可。

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { MoodboardRow } from "@/types/moodboard";

export const dynamic = "force-dynamic";

const NAME_MAX = 200;
const DESCRIPTION_MAX = 2000;

interface WorldviewSnapshot {
  worldview_tags:     string[];
  worldview_keywords: string[];
  worldview_name:     string | null;
}

interface CreateMoodboardBody {
  name?:        unknown;
  description?: unknown;
  is_public?:   unknown;
}

// ====================================================================
// GET — 自分の MB 一覧
// ====================================================================

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // ★ 列絞り SELECT: worldview_tags / worldview_keywords は含めない(三重防御 1)
    //   worldview_name のみ取得(日本語名・英語スラッグ非露出)
    const { data, error } = await supabase
      .from("moodboards")
      .select("id, name, description, is_public, cover_image_url, worldview_name, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[moodboards GET] error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ moodboards: (data ?? []) as MoodboardRow[] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[moodboards GET] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ====================================================================
// POST — MB 新規作成
// ====================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // body パース
    let body: CreateMoodboardBody;
    try {
      body = (await request.json()) as CreateMoodboardBody;
    } catch {
      return NextResponse.json({ error: "JSON パースに失敗しました" }, { status: 400 });
    }

    // name 検証(必須・空文字不可・200 字以下)
    if (typeof body.name !== "string" || body.name.trim() === "") {
      return NextResponse.json({ error: "name は必須です" }, { status: 400 });
    }
    const name = body.name.trim().slice(0, NAME_MAX);

    // description 検証(任意・2000 字以下)
    let description = "";
    if (body.description !== undefined && body.description !== null) {
      if (typeof body.description !== "string") {
        return NextResponse.json({ error: "description は文字列が必要です" }, { status: 400 });
      }
      description = body.description.slice(0, DESCRIPTION_MAX);
    }

    // ★ is_public default false(地雷 8 オプトイン公開・本体 ac834bb L376 確定)
    const is_public = body.is_public === true;

    // 世界観スナップショット取得(posts/route.ts と同形・未診断は空配列/null フォールバック)
    const { data: profileRow } = await supabase
      .from("worldview_profiles")
      .select("result")
      .eq("user_id", user.id)
      .maybeSingle() as unknown as { data: { result: Record<string, unknown> | null } | null };

    const snapshot = extractSnapshot(profileRow?.result ?? null);

    // INSERT moodboards
    //   user_id は user.id 固定(body から受けない・他人偽装不可)
    //   types/database.ts に moodboards 行型が未掲載のため as never で型を吸収(既存パターン)
    const { data: inserted, error: insErr } = await supabase
      .from("moodboards")
      .insert({
        user_id:            user.id,
        name,
        description,
        is_public,
        worldview_tags:     snapshot.worldview_tags,
        worldview_keywords: snapshot.worldview_keywords,
        worldview_name:     snapshot.worldview_name,
      } as never)
      .select("id, name, description, is_public, cover_image_url, worldview_name, created_at, updated_at")
      .single() as unknown as {
        data: MoodboardRow | null;
        error: { message: string } | null;
      };

    if (insErr || !inserted) {
      console.warn("[moodboards POST] insert error:", insErr?.message ?? "no data");
      return NextResponse.json(
        { error: insErr?.message ?? "ムードボードの作成に失敗しました" },
        { status: 500 },
      );
    }

    return NextResponse.json({ moodboard: inserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[moodboards POST] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ====================================================================
// helpers
// ====================================================================

// worldview_profiles.result(jsonb)から MB スナップショット用の値を抽出。
// 行が無い・キー欠落・型不一致 のいずれも null/[] にフォールバック(posts/route.ts と同形)。
function extractSnapshot(result: Record<string, unknown> | null): WorldviewSnapshot {
  if (!result) {
    return { worldview_tags: [], worldview_keywords: [], worldview_name: null };
  }
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() !== "" ? v : null;
  return {
    worldview_tags:     arr(result.worldview_tags),
    worldview_keywords: arr(result.worldview_keywords),
    worldview_name:     str(result.worldviewName),
  };
}
