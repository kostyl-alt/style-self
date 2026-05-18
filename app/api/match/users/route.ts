// M4-3: 人マッチ API
//
// GET /api/match/users?limit=12
//
// 【役割】
// 自分の世界観に近い「他者の公開プロフィール」を common_tag_count(共通 tags 数)
// 降順で返す。M4 投稿マッチ(/api/match/posts)と並ぶマッチング本体 API。
//
// 【M4-2(投稿マッチ)との構造差(設計セクション 6・調査報告通り)】
// - 投稿マッチ: posts.worldview_tags(text[] 直接列)→ .overlaps() で SQL 側絞れる
// - 人マッチ:   worldview_profiles.result(jsonb)内の worldview_tags
//              → .overlaps() 使えない・候補を母集団で SELECT してサーバ側で
//                各行の result->worldview_tags を取り出し overlap 計算
// - 1 ユーザー 1 エントリ(投稿マッチは 1 ユーザー複数投稿になり得る点も差異)
//
// 【セキュリティ・プライバシー(M3-4 / M2-3 / M4-2 教訓踏襲)】
// - createSupabaseServerClient()(認証 client) のみ。service_role 使わない
// - worldview_tags は overlap 計算に使うがレスポンスには含めない
//   → common_tag_count(数値)だけ返す = 「N 個共通」と抽象表現で UI に出す
// - .neq("user_id", user.id) で自己除外(M4 隠れ地雷2)
// - .eq("is_public", true) アプリ層フィルタ + RLS "public worldview profiles
//   readable by anyone" の二重防御(M2-1)
// - display_name は public_users view 経由(M4-2 で確定した RLS 独立性の知見・
//   docs/STYLE-SELF_M4_実装設計.md セクション 13)
//   人マッチの母集団 = worldview_profiles.is_public=true ユーザー
//   = public_users view の対象と完全一致 → display_name は基本 null にならない
//   (投稿マッチと違い「worldview 非公開だが投稿公開」が構造上発生しない)
//
// 【fallback HTTP 200(M3-4 思想)】
// - 401/400 を使わない。reason: "auth_required" / "diagnosis_required" を
//   返す ok:true 形で、UI 側は「壊れた発見タブ」を作らずに誘導 UI を出せる
//
// 【tie-break(設計セクション 2)】
// - overlap DESC → updated_at DESC(worldview_profiles は created_at 不在・最新
//   診断のユーザーを先に)→ user_id DESC(完全 deterministic)

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// 候補母集団の最大件数。公開プロフィール数が母数小(当面〜数十)の前提で
// 全件取得 → サーバ側 overlap 計算 → sort で十分(設計セクション 4 の判断と整合)
const CANDIDATE_LIMIT = 200;

// レスポンス items 上限(クライアントから ?limit= で上書き可・上限あり)
const DEFAULT_LIMIT = 12;
const MAX_LIMIT     = 50;

// SELECT で取得する列(result jsonb から worldview_tags を取り出す)
interface ProfileRow {
  user_id:      string;
  pattern_name: string;
  result:       { worldview_tags?: unknown } | null;
  updated_at:   string;
}

// レスポンスの 1 件分(★ worldview_tags は構造的に含めない)
interface MatchUserItem {
  user_id:          string;
  display_name:     string | null;  // public_users view 経由・worldview 公開者は基本値あり
  worldview_name:   string;         // worldview_profiles.pattern_name(公開対象・M2-3 既存範囲)
  common_tag_count: number;
}

interface MatchUsersResponse {
  ok:      boolean;
  users:   MatchUserItem[];
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

    // 1) 認証(未ログインは 200 + reason:auth_required)
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      return NextResponse.json<MatchUsersResponse>({
        ok:     true,
        users:  [],
        reason: "auth_required",
      });
    }

    // 2) 自分の worldview_tags 取得(本人 RLS で読める)
    const { data: selfRow } = await supabase
      .from("worldview_profiles")
      .select("result")
      .eq("user_id", user.id)
      .maybeSingle() as unknown as {
        data: { result: { worldview_tags?: unknown } | null } | null;
        error: { message: string } | null;
      };

    const rawTags = selfRow?.result?.worldview_tags;
    const myTags = Array.isArray(rawTags)
      ? rawTags.filter((t): t is string => typeof t === "string" && t.length > 0)
      : [];

    if (myTags.length === 0) {
      return NextResponse.json<MatchUsersResponse>({
        ok:     true,
        users:  [],
        reason: "diagnosis_required",
      });
    }

    // 3) 候補取得(他者・公開のみ)
    //    worldview_tags が jsonb 内のため .overlaps() 不可・全行を母集団に取り
    //    サーバ側で各行 result->worldview_tags を取り出して overlap 計算する。
    //    is_public=true & .neq 自己除外 = M2-1 RLS + アプリ層の二重防御。
    const { data: candidatesRaw, error: candErr } = await supabase
      .from("worldview_profiles")
      .select("user_id, pattern_name, result, updated_at")
      .eq("is_public", true)
      .neq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(CANDIDATE_LIMIT) as unknown as {
        data: ProfileRow[] | null;
        error: { message: string } | null;
      };

    if (candErr) {
      console.warn("[match/users] DB error:", candErr.message);
      return NextResponse.json({ error: candErr.message }, { status: 500 });
    }
    const candidates = candidatesRaw ?? [];

    // 4) overlap 数計算 + sort + slice
    //    ★ ここで worldview_tags は使い切る。map の戻り値には含めない構造。
    const mySet = new Set(myTags);
    const scored = candidates
      .map((p) => {
        const tagsRaw = p.result?.worldview_tags;
        const otherTags = Array.isArray(tagsRaw)
          ? tagsRaw.filter((t): t is string => typeof t === "string")
          : [];
        return {
          // 表示用フィールド(p.result 全体は外に出さない)
          user_id:          p.user_id,
          worldview_name:   p.pattern_name,
          updated_at:       p.updated_at,
          // overlap 数(otherTags はこの map の外に出さない)
          common_tag_count: otherTags.filter((t) => mySet.has(t)).length,
        };
      })
      // overlap 1 以上のみ(M4-2 と同じ・0 は表示しない)
      .filter((s) => s.common_tag_count > 0);

    scored.sort((a, b) => {
      // 1: overlap 数 DESC
      if (b.common_tag_count !== a.common_tag_count) {
        return b.common_tag_count - a.common_tag_count;
      }
      // 2: updated_at DESC(最新診断のユーザーを先に)
      if (a.updated_at !== b.updated_at) {
        return a.updated_at < b.updated_at ? 1 : -1;
      }
      // 3: user_id DESC(完全 deterministic)
      return a.user_id < b.user_id ? 1 : -1;
    });

    const top = scored.slice(0, limit);

    // 5) display_name を public_users view 経由で一括取得(M4-2 と同じ作法)
    //    人マッチの母集団 = worldview_profiles.is_public=true ユーザー =
    //    public_users view の対象と完全一致 → 基本的に全員 display_name が返る。
    //    返らない場合(view 側で何らかの理由で行が無い)は null 許容。
    const userIds = top.map((s) => s.user_id);
    const nameMap = new Map<string, string | null>();
    if (userIds.length > 0) {
      const { data: userRows, error: usersErr } = await supabase
        .from("public_users")
        .select("id, display_name")
        .in("id", userIds) as unknown as {
          data: { id: string; display_name: string | null }[] | null;
          error: { message: string } | null;
        };
      if (usersErr) {
        console.warn("[match/users] public_users select warn(non-fatal):", usersErr.message);
      }
      for (const u of userRows ?? []) {
        nameMap.set(u.id, u.display_name);
      }
    }

    // 6) レスポンス組み立て(★ worldview_tags は構造的に存在しない)
    const users: MatchUserItem[] = top.map((s) => ({
      user_id:          s.user_id,
      display_name:     nameMap.get(s.user_id) ?? null,
      worldview_name:   s.worldview_name,
      common_tag_count: s.common_tag_count,
    }));

    return NextResponse.json<MatchUsersResponse>({ ok: true, users });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[match/users] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
