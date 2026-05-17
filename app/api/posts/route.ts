// M3-2 後半: 投稿作成 API
//
// POST /api/posts
//
// 【責務分担】案 X(オーナー確定)
// - クライアント: uploadPostImage で画像処理 + EXIF 除去 + Storage 保存
//   → 確定した image_url を取得して API に POST
// - API(本ルート): body 検証 + posts テーブル INSERT のみ
//
// 【セキュリティ】M2-4 publicity API と同型
// - createSupabaseServerClient()(認証 client) のみ。service_role 使わない
// - author_user_id は body から受けない → auth.getUser() の user.id を固定使用
//   = 他人になりすました投稿が構造的に不可能
// - is_public は body から受けない → MVP は true 固定
// - RLS "users own posts" FOR ALL が二重防御の最後の砦
//
// 【孤児画像の扱い】MVP は許容
// クライアントで画像 Storage 保存 → 本 API call が 401/500 で失敗、というケースで
// posts に紐付かない画像が Storage に残る可能性がある。MVP は許容。
// 将来のクリーンアップ案:
//   1) クライアント側ベストエフォート: API 失敗時に deletePostImage を呼ぶ
//   2) 定期バッチ: 週次 cron で posts に紐付かない post-images を削除
//
// 【世界観スナップショット】M3 の肝
// 投稿時に worldview_profiles から worldview_tags/keywords/name/pattern_id を
// サーバ側で取得して posts にコピー。再診断後も投稿当時の世界観が不変。
// worldview_profiles が無いユーザー(診断未完了)は空配列/null で投稿可。

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const CAPTION_MAX = 1000;

// image_url の許可プレフィックスを環境変数から組む。
// 形式: <NEXT_PUBLIC_SUPABASE_URL>/storage/v1/object/public/post-images/
// → 任意 URL の丸呑みを構造的に拒否(SSRF・悪意ある外部 URL 投稿の防止)。
function buildAllowedImageUrlPrefix(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/storage/v1/object/public/post-images/`;
}

interface PostsCreateBody {
  image_url?: unknown;
  caption?:   unknown;
}

interface WorldviewSnapshot {
  worldview_tags:     string[];
  worldview_keywords: string[];
  worldview_name:     string | null;
  pattern_id:         string | null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();

    // 1) 認証
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 2) body パース
    let body: PostsCreateBody;
    try {
      body = (await request.json()) as PostsCreateBody;
    } catch {
      return NextResponse.json({ error: "JSON パースに失敗しました" }, { status: 400 });
    }

    // 3) image_url バリデーション
    //    必須・文字列・空でない・Supabase post-images の公開URLプレフィックス一致
    if (typeof body.image_url !== "string" || body.image_url.trim() === "") {
      return NextResponse.json({ error: "image_url は必須です" }, { status: 400 });
    }
    const image_url = body.image_url.trim();
    const allowedPrefix = buildAllowedImageUrlPrefix();
    if (!allowedPrefix) {
      // env var 未設定は実装/デプロイ事故なので 500
      return NextResponse.json({ error: "サーバ設定が不正です(SUPABASE_URL 未設定)" }, { status: 500 });
    }
    if (!image_url.startsWith(allowedPrefix)) {
      // 任意の外部 URL を投稿として保存させない(SSRF 的悪用の予防)
      return NextResponse.json(
        { error: "image_url は post-images バケットの公開URLである必要があります" },
        { status: 400 },
      );
    }

    // 4) caption バリデーション
    let caption = "";
    if (body.caption !== undefined && body.caption !== null) {
      if (typeof body.caption !== "string") {
        return NextResponse.json({ error: "caption は文字列が必要です" }, { status: 400 });
      }
      if (body.caption.length > CAPTION_MAX) {
        return NextResponse.json(
          { error: `caption は ${CAPTION_MAX} 文字以下にしてください(現在 ${body.caption.length} 文字)` },
          { status: 400 },
        );
      }
      caption = body.caption;
    }

    // 5) 世界観スナップショット取得
    //    本人の worldview_profiles から取る(他人の id は構造的に取得不可)。
    //    types/database.ts に worldview スナップショット相当の列が掲載されていない
    //    ため、Supabase v2 型推論が never に落ちる箇所は as 経由で吸収(既存パターン)。
    //    maybeSingle で「行が無くてもエラーにせず null を返す」= 診断未完了ユーザーも投稿可
    //
    //    note: worldview_profiles.result は jsonb。中の worldview_tags / worldview_keywords /
    //    worldview_name / patternId を取り出してコピー。pattern_id は legacy 8 パターン用に保持。
    const { data: profileRow } = await supabase
      .from("worldview_profiles")
      .select("result")
      .eq("user_id", user.id)
      .maybeSingle() as unknown as { data: { result: Record<string, unknown> | null } | null };

    const snapshot = extractSnapshot(profileRow?.result ?? null);

    // 6) posts INSERT
    //    author_user_id は user.id 固定(body から受けない・他人偽装不可)
    //    is_public は true 固定(MVP 仕様・body から受けない)
    //    types/database.ts に posts 行型が無いため as never で型を吸収(既存パターン)
    const { data: insertedRaw, error: insErr } = await supabase
      .from("posts")
      .insert({
        author_user_id:     user.id,
        image_url,
        caption,
        worldview_tags:     snapshot.worldview_tags,
        worldview_keywords: snapshot.worldview_keywords,
        worldview_name:     snapshot.worldview_name,
        pattern_id:         snapshot.pattern_id,
        is_public:          true,
      } as never)
      .select("id, created_at")
      .single() as unknown as {
        data: { id: string; created_at: string } | null;
        error: { message: string } | null;
      };

    if (insErr || !insertedRaw) {
      console.warn("[posts.insert] error:", insErr?.message ?? "no data");
      return NextResponse.json({ error: insErr?.message ?? "投稿の作成に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      id:         insertedRaw.id,
      created_at: insertedRaw.created_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[posts POST] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// worldview_profiles.result(jsonb)から投稿スナップショット用の値を抽出。
// 行が無い・キー欠落・型不一致 のいずれも null/[] にフォールバック。
function extractSnapshot(result: Record<string, unknown> | null): WorldviewSnapshot {
  if (!result) {
    return { worldview_tags: [], worldview_keywords: [], worldview_name: null, pattern_id: null };
  }
  const arr = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
  return {
    worldview_tags:     arr(result.worldview_tags),
    worldview_keywords: arr(result.worldview_keywords),
    worldview_name:     str(result.worldviewName),
    pattern_id:         str(result.patternId),
  };
}
