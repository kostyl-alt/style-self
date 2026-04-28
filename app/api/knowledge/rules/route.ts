import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { rowToKnowledgeRule } from "@/lib/utils/knowledge-merge";
import type { KnowledgeRule, KnowledgeRulesResponse } from "@/types/index";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const keyword = (searchParams.get("keyword") ?? "").trim();
    const limitRaw = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
    const limit = Math.min(Math.max(1, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT), MAX_LIMIT);

    if (!keyword) {
      return NextResponse.json({ error: "keyword query is required" }, { status: 400 });
    }

    // 2クエリ構成（concept_keyword の ILIKE 部分一致 + aliases の完全一致）
    // RLS が visibility/active を絞り込むため WHERE 句では絞らない。
    const [byKeyword, byAlias] = await Promise.all([
      supabase
        .from("knowledge_rules")
        .select("*")
        .ilike("concept_keyword", `%${keyword}%`)
        .order("weight", { ascending: false })
        .limit(limit),
      supabase
        .from("knowledge_rules")
        .select("*")
        .contains("aliases", [keyword])
        .order("weight", { ascending: false })
        .limit(limit),
    ]);

    if (byKeyword.error) return NextResponse.json({ error: byKeyword.error.message }, { status: 500 });
    if (byAlias.error)   return NextResponse.json({ error: byAlias.error.message }, { status: 500 });

    // 結果をマージしてID重複排除（Supabase v2 の型推論回避のため unknown キャスト経由）
    const rowsById = new Map<string, Record<string, unknown>>();
    const keywordRows = (byKeyword.data ?? []) as unknown as Record<string, unknown>[];
    const aliasRows   = (byAlias.data   ?? []) as unknown as Record<string, unknown>[];
    for (const row of keywordRows) rowsById.set(row.id as string, row);
    for (const row of aliasRows)   rowsById.set(row.id as string, row);

    const allRules: KnowledgeRule[] = Array.from(rowsById.values()).map(rowToKnowledgeRule);

    // 関連度ソート: 完全一致 > エイリアス完全一致 > 前方一致 > 部分一致、同点は weight 降順
    const lower = keyword.toLowerCase();
    const relevanceScore = (r: KnowledgeRule): number => {
      const ck = r.conceptKeyword.toLowerCase();
      if (ck === lower) return 100;
      if (r.aliases.some((a) => a.toLowerCase() === lower)) return 95;
      if (ck.startsWith(lower)) return 75;
      return 50;
    };

    const rules = allRules
      .sort((a, b) => {
        const sa = relevanceScore(a);
        const sb = relevanceScore(b);
        if (sa !== sb) return sb - sa;
        return b.weight - a.weight;
      })
      .slice(0, limit);

    const response: KnowledgeRulesResponse = {
      rules,
      matched: rules.length > 0,
    };

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "知識ベースの検索に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
