import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { rowToKnowledgeSource } from "@/lib/utils/knowledge-merge";
import type { CreateKnowledgeSourceRequest, KnowledgeSourcesListResponse } from "@/types/index";

const VALID_TYPES = new Set<string>([
  "url", "memo", "image", "book", "video", "lookbook", "expert_note",
]);

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const analyzedRaw = searchParams.get("analyzed");
    const limitRaw = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
    const limit = Math.min(Math.max(1, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT), MAX_LIMIT);

    let query = supabase
      .from("knowledge_sources")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (type && VALID_TYPES.has(type)) {
      query = query.eq("source_type", type);
    }
    if (analyzedRaw === "true") {
      query = query.eq("is_analyzed", true);
    } else if (analyzedRaw === "false") {
      query = query.eq("is_analyzed", false);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    const response: KnowledgeSourcesListResponse = {
      sources: rows.map(rowToKnowledgeSource),
    };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "ソース一覧の取得に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const body = await request.json() as CreateKnowledgeSourceRequest;

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "タイトルは必須です" }, { status: 400 });
    }
    if (!body.sourceType || !VALID_TYPES.has(body.sourceType)) {
      return NextResponse.json({ error: "不正な source_type です" }, { status: 400 });
    }

    const url          = body.url?.trim()          || null;
    const contentText  = body.contentText?.trim()  || null;
    const imageUrl     = body.imageUrl?.trim()     || null;
    const author       = body.author?.trim()       || null;
    const citationNote = body.citationNote?.trim() || null;
    const summary      = body.summary?.trim()      || null;

    // タイプ別バリデーション
    if (body.sourceType === "url" && !url) {
      return NextResponse.json({ error: "URLタイプにはURLが必須です" }, { status: 400 });
    }
    if ((body.sourceType === "memo" || body.sourceType === "expert_note") && !contentText) {
      return NextResponse.json({ error: "メモタイプには本文が必須です" }, { status: 400 });
    }
    if ((body.sourceType === "image" || body.sourceType === "book" || body.sourceType === "lookbook" || body.sourceType === "video") && !imageUrl && !contentText) {
      return NextResponse.json({ error: "画像URLまたは本文が必要です" }, { status: 400 });
    }

    const insertData = {
      user_id:       user.id,
      title:         body.title.trim().slice(0, 200),
      source_type:   body.sourceType,
      url,
      content_text:  contentText,
      image_url:     imageUrl,
      author,
      citation_note: citationNote,
      summary,
      visibility:    "private",
      is_analyzed:   false,
    };

    const { data, error } = await supabase
      .from("knowledge_sources")
      .insert(insertData as never)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const source = rowToKnowledgeSource(data as unknown as Record<string, unknown>);
    return NextResponse.json({ source });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ソースの登録に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
