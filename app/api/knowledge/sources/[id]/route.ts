import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { rowToKnowledgeSource, rowToKnowledgeRule } from "@/lib/utils/knowledge-merge";
import type { KnowledgeSourceWithRulesResponse } from "@/types/index";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    // ソース取得（RLSで他人のは弾かれる）
    const { data: sourceRow, error: sourceErr } = await supabase
      .from("knowledge_sources")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();

    if (sourceErr || !sourceRow) {
      return NextResponse.json({ error: "ソースが見つかりません" }, { status: 404 });
    }

    // 関連ルール取得
    const { data: ruleRows, error: rulesErr } = await supabase
      .from("knowledge_rules")
      .select("*")
      .eq("source_id", params.id)
      .order("weight", { ascending: false });

    if (rulesErr) return NextResponse.json({ error: rulesErr.message }, { status: 500 });

    const response: KnowledgeSourceWithRulesResponse = {
      source: rowToKnowledgeSource(sourceRow as unknown as Record<string, unknown>),
      rules:  ((ruleRows ?? []) as unknown as Record<string, unknown>[]).map(rowToKnowledgeRule),
    };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "ソースの取得に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    // RLS + 明示的なuser_id絞り込みで二重チェック
    // 関連 knowledge_rules は ON DELETE CASCADE で自動削除される（migration 015）
    const { error } = await supabase
      .from("knowledge_sources")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "削除に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
