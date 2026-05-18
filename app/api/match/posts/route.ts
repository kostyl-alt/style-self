// M4-2: 投稿マッチ API
//
// GET /api/match/posts?limit=24
//
// 【役割】
// 自分の世界観に近い「他者の公開投稿」を common_tag_count(共通 tags 数)
// 降順で返す。M4(世界観マッチング)の本体 API の一つ。
//
// 【セキュリティ・プライバシー(M3-4 / M2-3 教訓踏襲・最重要)】
// - createSupabaseServerClient()(認証 client) のみ。service_role 使わない
// - worldview_tags を SELECT 句で取得し overlap 計算に使うが、
//   レスポンスには絶対に含めない(M2-3 で「量産型」が HTML inline 漏洩した教訓)
// - クライアントには common_tag_count(数値)だけ返す → 「N 個共通」と
//   抽象表現で UI に出す約束
// - .neq("author_user_id", user.id) で自己除外(M4 隠れ地雷2)
// - .eq("is_public", true) アプリ層フィルタ + RLS "public posts readable by anyone"
//   の二重防御(M3-1)
//
// 【fallback HTTP 200(M3-4 思想)】
// - 401/400 を使わない。reason: "auth_required" / "diagnosis_required" を
//   返す ok:true 形で、UI 側は「壊れた発見タブ」を作らずに誘導 UI を出せる
//
// 【マッチ計算(設計セクション 2)】
// - 単純 overlap 数(検証データで Jaccard と順位一致を確認済)
// - .overlaps("worldview_tags", myTags) で SQL 側 1 個以上重なるものに絞る
//   (0 個は構造的に除外)
// - サーバ側で各候補の overlap 数を計算 → ソート(overlap DESC,
//   created_at DESC, id DESC = 設計の tie-break)→ slice(limit)
//
// 【author display_name 取得(設計セクション 5 / 9 — 実装時再検証で確定)】
// - public_users view を in("id", authorIds) で引いて author_user_id → display_name の
//   map を作る
// - 当初 .from("users") で実装していたが、public.users の RLS
//   "users can read own profile" が auth.uid()=id を要求するため他人の行が
//   構造的に返らず、author_display_name が全件 null になる事象が発生した
//   → M2-1(023)の public_users view(SECURITY DEFINER + INNER JOIN
//     worldview_profiles.is_public=true)経由に変更で解決
// - 副作用: worldview 非公開 + 投稿公開 のユーザーは display_name が null になる
//   が、これは privacy-conservative な仕様として意図(worldview を隠す人は
//   世界観で見つかることを望まない前提・UI 側でプレースホルダ表示)
// - M4-3(人マッチ)も同じ public_users view を使う統一的な設計
//
// 【未ログイン / 診断未完了の扱い(設計セクション 5)】
// - 未ログイン: 200 + { ok:true, posts:[], reason:"auth_required" }
// - 診断未完了 / worldview_tags 空: 200 + { ok:true, posts:[], reason:"diagnosis_required" }

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// 候補母集団の最大件数(設計セクション 5: 段階2)
// .overlaps() で SQL 側絞り込み後、サーバ側で overlap 計算 → sort するための上限。
// 数千件規模までは GIN + サーバ計算で msec オーダー。MVP は 200 で十分。
const CANDIDATE_LIMIT = 200;

// レスポンスの items 上限(クライアントから ?limit= で上書き可・上限あり)
const DEFAULT_LIMIT = 24;
const MAX_LIMIT     = 50;

// SELECT で取得する列(worldview_tags は overlap 計算に使うが レスポンスに乗せない)
interface PostRow {
  id:              string;
  image_url:       string;
  caption:         string;
  worldview_name:  string | null;
  worldview_tags:  string[];        // ★ サーバ内のみで使用・レスポンスに含めない
  author_user_id:  string;
  created_at:      string;
}

// レスポンスの 1 件分(★ worldview_tags は構造的に含めない)
interface MatchPostItem {
  id:                  string;
  image_url:           string;
  caption:             string;
  worldview_name:      string | null;
  author_user_id:      string;
  author_display_name: string | null;  // 取得不可なら null(設計 ★方針)
  common_tag_count:    number;
  created_at:          string;
}

interface MatchPostsResponse {
  ok:      boolean;
  posts:   MatchPostItem[];
  reason?: "auth_required" | "diagnosis_required";
}

export async function GET(request: NextRequest) {
  try {
    // limit パラメータ
    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const supabase = createSupabaseServerClient();

    // 1) 認証(未ログインは 200 + reason:auth_required で UI に誘導させる)
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      return NextResponse.json<MatchPostsResponse>({
        ok:     true,
        posts:  [],
        reason: "auth_required",
      });
    }

    // 2) 自分の worldview_tags 取得(本人 RLS で読める)
    //    worldview_profiles.result は jsonb・直接列ではない
    const { data: profileRow } = await supabase
      .from("worldview_profiles")
      .select("result")
      .eq("user_id", user.id)
      .maybeSingle() as unknown as {
        data: { result: { worldview_tags?: unknown } | null } | null;
        error: { message: string } | null;
      };

    const rawTags = profileRow?.result?.worldview_tags;
    const myTags = Array.isArray(rawTags)
      ? rawTags.filter((t): t is string => typeof t === "string" && t.length > 0)
      : [];

    if (myTags.length === 0) {
      // 診断未完了 / tags 空 → 200 + reason で UI に誘導
      return NextResponse.json<MatchPostsResponse>({
        ok:     true,
        posts:  [],
        reason: "diagnosis_required",
      });
    }

    // 3) 候補取得(自己除外・公開のみ・overlap 1 以上)
    //    SELECT に worldview_tags を含めるが、後段の map で構造的に外に出さない
    const { data: candidatesRaw, error: candErr } = await supabase
      .from("posts")
      .select("id, image_url, caption, worldview_name, worldview_tags, author_user_id, created_at")
      .eq("is_public", true)
      .neq("author_user_id", user.id)
      .overlaps("worldview_tags", myTags)
      .order("created_at", { ascending: false })
      .limit(CANDIDATE_LIMIT) as unknown as {
        data: PostRow[] | null;
        error: { message: string } | null;
      };

    if (candErr) {
      console.warn("[match/posts] DB error:", candErr.message);
      return NextResponse.json({ error: candErr.message }, { status: 500 });
    }
    const candidates = candidatesRaw ?? [];

    // 4) overlap 数計算 + sort + slice
    //    ★ ここで worldview_tags は使い切る。map の戻り値には含めない。
    const mySet = new Set(myTags);
    const scored = candidates
      .map((p) => ({
        // 表示用フィールド
        id:             p.id,
        image_url:      p.image_url,
        caption:        p.caption,
        worldview_name: p.worldview_name,
        author_user_id: p.author_user_id,
        created_at:     p.created_at,
        // overlap 数(p.worldview_tags はここで消費・以後参照しない)
        common_tag_count: p.worldview_tags.filter((t) => mySet.has(t)).length,
      }))
      // .overlaps() で構造除外しているが防御的に >0 を再チェック
      .filter((s) => s.common_tag_count > 0);

    scored.sort((a, b) => {
      // 1: overlap 数 DESC
      if (b.common_tag_count !== a.common_tag_count) {
        return b.common_tag_count - a.common_tag_count;
      }
      // 2: created_at DESC(新しいものを先)
      if (a.created_at !== b.created_at) {
        return a.created_at < b.created_at ? 1 : -1;
      }
      // 3: id DESC(完全 deterministic)
      return a.id < b.id ? 1 : -1;
    });

    const top = scored.slice(0, limit);

    // 5) author display_name を一括取得(public_users view 経由・実装時再検証で確定)
    //    public.users を直接読むと RLS "users can read own profile" で他人が弾かれて
    //    全件 null になるため、M2-1(023)の public_users view を使う。
    //    view は SECURITY DEFINER + INNER JOIN worldview_profiles.is_public=true で
    //    is_public=true ユーザーの id+display_name だけを露出する厳格設計。
    //    → worldview 非公開ユーザーは display_name=null(privacy-conservative・意図的)
    const authorIds = Array.from(new Set(top.map((s) => s.author_user_id)));
    const nameMap = new Map<string, string | null>();
    if (authorIds.length > 0) {
      const { data: userRows, error: usersErr } = await supabase
        .from("public_users")
        .select("id, display_name")
        .in("id", authorIds) as unknown as {
          data: { id: string; display_name: string | null }[] | null;
          error: { message: string } | null;
        };
      if (usersErr) {
        console.warn("[match/posts] public_users select warn(non-fatal):", usersErr.message);
      }
      for (const u of userRows ?? []) {
        nameMap.set(u.id, u.display_name);
      }
    }

    // 6) レスポンス組み立て(★ worldview_tags は含めない構造)
    const posts: MatchPostItem[] = top.map((s) => ({
      id:                  s.id,
      image_url:           s.image_url,
      caption:             s.caption,
      worldview_name:      s.worldview_name,
      author_user_id:      s.author_user_id,
      author_display_name: nameMap.get(s.author_user_id) ?? null,
      common_tag_count:    s.common_tag_count,
      created_at:          s.created_at,
    }));

    return NextResponse.json<MatchPostsResponse>({ ok: true, posts });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[match/posts] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
