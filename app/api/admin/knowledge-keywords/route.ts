import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/utils/admin-check";
import type { KnowledgeKeywordsResponse } from "@/types/index";

// 管理者向け：knowledge_rules から concept_keyword の一覧を返す（オートコンプリート用）
// 商品登録フォームの worldview_tags 入力で使う

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    }

    // admin / public のルール + 自分の private ルール、is_active=true
    const { data, error } = await supabase
      .from("knowledge_rules")
      .select("concept_keyword")
      .eq("is_active", true)
      .order("concept_keyword", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []) as unknown as { concept_keyword: string }[];
    const keywords = Array.from(new Set(rows.map((r) => r.concept_keyword))).sort();

    const response: KnowledgeKeywordsResponse = { keywords };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "キーワード一覧の取得に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
