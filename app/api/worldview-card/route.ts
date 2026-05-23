// A-5 P1-D: 上部世界観カード用 軽量 GET エンドポイント
//
// 設計: docs/STYLE-SELF_D1_A-5_P1-D_設計調査.md(c126f76)§3.1
//
// 【スコープ】
//   ChatPage 上部の WorldviewCard 表示用に worldview_profiles.result から
//   表示必要な 3 フィールドだけ列絞り SELECT で返す軽量 API。
//
// 【セキュリティ / プライバシー(三重防御 (1) 同型再適用)】
//   ・createSupabaseServerClient()(cookie-bound RLS) のみ・service_role 使わない
//   ・★ worldview_profiles.result から jsonb 列絞り(name/keywords/core のみ)
//     worldview_tags 列を SELECT 句に書かない構造的安全(A-10 fetchDiagnoseContext と同形)
//   ・未認証は 200 + { ok:false, reason:"auth_required" }(既存 intent route 同型)
//   ・未診断ユーザーは 200 + { ok:true, worldview: null }(UI 側で CTA 表示)
//
// 【コスト】
//   ・1 SELECT(列絞り)+ 認証チェックのみ・Claude API 呼出なし → ¥0 級

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

interface WorldviewCardData {
  worldviewName:     string | null;
  worldviewKeywords: string[];
  coreIdentity:      string | null;
}

interface WorldviewCardResponse {
  ok:         boolean;
  worldview?: WorldviewCardData | null;
  reason?:    "auth_required";
}

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json<WorldviewCardResponse>({
        ok:     false,
        reason: "auth_required",
      });
    }

    // ★ 列絞り SELECT: result jsonb から 3 フィールドのみ取得
    //   worldview_tags 列を SELECT 句に書かない(三重防御 (1))
    const { data: row } = await supabase
      .from("worldview_profiles")
      .select(
        "name:result->worldviewName,keywords:result->worldview_keywords,core:result->coreIdentity",
      )
      .eq("user_id", user.id)
      .maybeSingle() as unknown as {
        data: { name: unknown; keywords: unknown; core: unknown } | null;
      };

    if (!row) {
      return NextResponse.json<WorldviewCardResponse>({
        ok:        true,
        worldview: null,  // 未診断
      });
    }

    const str = (v: unknown): string | null =>
      typeof v === "string" && v.trim() !== "" ? v.trim() : null;
    const arr = (v: unknown): string[] =>
      Array.isArray(v)
        ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "")
        : [];

    return NextResponse.json<WorldviewCardResponse>({
      ok:        true,
      worldview: {
        worldviewName:     str(row.name),
        worldviewKeywords: arr(row.keywords),
        coreIdentity:      str(row.core),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[worldview-card] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
