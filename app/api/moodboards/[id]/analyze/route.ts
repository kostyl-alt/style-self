// Phase 1: ムードボード board単位解析 API（context object 生成・保存）
//
// POST /api/moodboards/[id]/analyze
//
// 【責務】
//   その board の items キャプション群 + name/description/worldview + 診断プロフィールを
//   テキスト統合して Claude に渡し、moodboard_analysis を 1 回生成して upsert する。
//   per-image の /items/analyze（画像1枚→item追加）とは別物・無干渉。
//
// 【三重防御 1（M2-3 踏襲）】
//   解析入力に英語スラッグ（moodboards.worldview_tags）を含めない。
//   日本語の worldview_name / worldview_keywords のみ使用。
//
// 【セキュリティ】既存 /items/analyze と同型（UUID検証 + 認証 + 親MB本人所有 + RLS二重防御）。

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { MODEL } from "@/lib/claude";
import { analyzeMoodboard } from "@/lib/prompts/moodboard-analysis";
import { getMoodboardAnalysis } from "@/lib/utils/moodboard-analysis-service";
import { aggregateMoodboardSignals } from "@/lib/utils/moodboard-aggregate";
import { getDecisionRules, getInfluences } from "@/lib/knowledge-os/client";
import type {
  MoodboardAnalysisRow,
  MoodboardAnalysisLLM,
  AnalyzeMoodboardResponse,
  MoodboardBrief,
  BriefBasis,
} from "@/types/moodboard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;  // LLM 生成は秒単位かかる

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ★ 案A: KO 初回 cold（実測 ~5.5s）が client 既定 5s を超えるため、analyze では 20s に延長。
//   analyze は maxDuration=60s の重い処理なので許容内。タイムアウト時は [] 縮退（退行ゼロ）。
const KO_TIMEOUT_MS = 20000;

interface RouteContext {
  params: { id: string };
}

// worldview_profiles.result（jsonb）から短い文脈ノートを安全に抽出。
function buildProfileNote(result: unknown): string | null {
  if (result === null || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof r.worldviewName === "string" && r.worldviewName.trim() !== "") {
    parts.push(`世界観: ${r.worldviewName}`);
  }
  if (typeof r.coreIdentity === "string" && r.coreIdentity.trim() !== "") {
    parts.push(`核: ${r.coreIdentity}`);
  }
  return parts.length > 0 ? parts.join(" / ") : null;
}

function toStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

// ★ Moodboard First Step 1: LLM の brief を防御的に正規化（object でなければ {}・value は string 強制・
//   basis は enum 既定 inferred・colorPalette 配列は string[] 化）。空値の項目はキーごと省略。
const BRIEF_TEXT_KEYS = ["concept", "story", "person", "lifestyle", "hair", "makeup", "location", "light"] as const;

function normBasis(v: unknown): BriefBasis {
  return v === "observed" ? "observed" : "inferred";
}

function normalizeBrief(raw: unknown): MoodboardBrief {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: MoodboardBrief = {};
  for (const key of BRIEF_TEXT_KEYS) {
    const f = r[key];
    if (f && typeof f === "object") {
      const fo = f as Record<string, unknown>;
      const value = typeof fo.value === "string" ? fo.value.trim() : "";
      if (value !== "") out[key] = { value, basis: normBasis(fo.basis) };
    }
  }
  const cp = r.colorPalette;
  if (cp && typeof cp === "object") {
    const c = cp as Record<string, unknown>;
    const main = toStringArray(c.main);
    const accent = toStringArray(c.accent);
    const saturation = typeof c.saturation === "string" ? c.saturation.trim() : "";
    if (main.length > 0 || accent.length > 0 || saturation !== "") {
      out.colorPalette = { main, accent, saturation, basis: normBasis(c.basis) };
    }
  }
  return out;
}

// 既存解析の有無確認（Phase 2: クライアントの遅延自動生成の判定用）。
// 返り値 { analysis: 行 | null }。未生成でも 200（null）を返す。
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    if (!UUID_RE.test(params.id)) {
      return NextResponse.json({ error: "moodboard_id が不正です" }, { status: 400 });
    }
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const analysis = await getMoodboardAnalysis(supabase, params.id);
    return NextResponse.json({ analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[moodboards/analyze GET] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    // 1) moodboard_id 検証
    if (!UUID_RE.test(params.id)) {
      return NextResponse.json({ error: "moodboard_id が不正です" }, { status: 400 });
    }

    // 2) 認証
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 3) 親MB取得 + 本人所有確認（★ 英語スラッグ worldview_tags は取得しない＝三重防御1）
    const { data: mb } = await supabase
      .from("moodboards")
      .select("id, user_id, name, description, worldview_name, worldview_keywords")
      .eq("id", params.id)
      .maybeSingle() as unknown as {
        data: {
          id: string; user_id: string; name: string; description: string;
          worldview_name: string | null; worldview_keywords: string[] | null;
        } | null;
      };

    if (!mb) {
      return NextResponse.json({ error: "ムードボードが見つかりません" }, { status: 404 });
    }
    if (mb.user_id !== user.id) {
      return NextResponse.json({ error: "このムードボードを解析する権限がありません" }, { status: 403 });
    }

    // 4) items キャプション群 + vision（既存 per-image 解析資産を再利用＝テキスト統合方式）
    //    ★ Layer2: vision も読み、styleSignals を画像横断で決定的に集約する（LLM コール増ゼロ・SELECT に列追加のみ）。
    const { data: itemRows } = await supabase
      .from("moodboard_items")
      .select("id, caption, order_index, vision")
      .eq("moodboard_id", params.id)
      .order("order_index", { ascending: true }) as unknown as {
        data: { id: string; caption: string | null; order_index: number; vision: unknown }[] | null;
      };
    const itemCaptions = (itemRows ?? [])
      .map((it) => (it.caption ?? "").trim())
      .filter((c) => c !== "");

    // ★ Layer2: 決定的集約（純関数・LLM 不要）。誰も signals を読まないが、Layer3 以降の受け皿として保存する。
    const signals = aggregateMoodboardSignals(
      (itemRows ?? []).map((it) => ({ id: it.id, vision: it.vision })),
    );

    // 5) 診断プロフィール（任意の文脈）
    const { data: profile } = await supabase
      .from("worldview_profiles")
      .select("result")
      .eq("user_id", user.id)
      .maybeSingle() as unknown as { data: { result: unknown } | null };
    const worldviewProfileNote = buildProfileNote(profile?.result ?? null);

    // 6) Knowledge OS 参考（案A・best-effort）。初回 cold は数秒かかるため timeout を 20s に延長。
    //    到達不可/タイムアウト/エラーは [] に縮退 → KO 節を足さず通常生成（退行ゼロ）。
    const [koRulesRaw, koInflRaw] = await Promise.all([
      getDecisionRules({ importance_min: 4, limit: 8 }, KO_TIMEOUT_MS).catch(() => []),
      getInfluences({ limit: 5 }, KO_TIMEOUT_MS).catch(() => []),
    ]);
    const koDecisionRules = koRulesRaw
      .map((r) => (typeof r.rule === "string" ? r.rule.trim() : ""))
      .filter((s) => s !== "");
    const koInfluences = koInflRaw
      .map((i) => {
        const name = (i.subject_name ?? "").trim();
        const essence = (i.fusion_essence ?? "").trim();
        if (name === "" && essence === "") return "";
        return essence !== "" ? `${name}：${essence}` : name;
      })
      .filter((s) => s !== "");

    // 7) LLM 解析（テキスト統合・1回）
    let llm: MoodboardAnalysisLLM;
    try {
      llm = await analyzeMoodboard({
        name:                 mb.name,
        description:          mb.description ?? "",
        worldviewName:        mb.worldview_name,
        worldviewKeywords:    toStringArray(mb.worldview_keywords),
        itemCaptions,
        worldviewProfileNote,
        koDecisionRules,
        koInfluences,
      });
    } catch (llmErr) {
      const msg = llmErr instanceof Error ? llmErr.message : String(llmErr);
      console.warn("[moodboards/analyze] LLM failed:", msg);
      return NextResponse.json({ error: "解析に失敗しました" }, { status: 502 });
    }

    // 7) upsert（1 MB に 1 行・再解析は上書き）
    const now = new Date().toISOString();
    const payload: MoodboardAnalysisRow = {
      moodboard_id:   params.id,
      worldview_core: typeof llm.worldview_core === "string" ? llm.worldview_core : "",
      colors:         toStringArray(llm.colors),
      materials:      toStringArray(llm.materials),
      silhouettes:    toStringArray(llm.silhouettes),
      mood:           typeof llm.mood === "string" ? llm.mood : "",
      ng_elements:    toStringArray(llm.ng_elements),
      shopping_axis:  (llm.shopping_axis && typeof llm.shopping_axis === "object") ? llm.shopping_axis : {},
      styling_axis:   (llm.styling_axis && typeof llm.styling_axis === "object") ? llm.styling_axis : {},
      brief:          normalizeBrief(llm.brief),  // ★ Moodboard First Step 1: additive・消費者ゼロ
      signals,                                    // ★ Layer2: 決定的集約（純関数の計算値・LLM 産物でない）・additive・消費者ゼロ
      source:         MODEL,
      created_at:     now,
      updated_at:     now,
    };

    const { data: saved, error: upsertErr } = await supabase
      .from("moodboard_analysis")
      .upsert(payload as never, { onConflict: "moodboard_id" })
      .select("moodboard_id, worldview_core, colors, materials, silhouettes, mood, ng_elements, shopping_axis, styling_axis, brief, signals, source, created_at, updated_at")
      .single() as unknown as {
        data: MoodboardAnalysisRow | null;
        error: { message: string } | null;
      };

    if (upsertErr || !saved) {
      console.warn("[moodboards/analyze] upsert error:", upsertErr?.message ?? "no data");
      return NextResponse.json(
        { error: upsertErr?.message ?? "解析結果の保存に失敗しました" },
        { status: 500 },
      );
    }

    return NextResponse.json<AnalyzeMoodboardResponse>({ analysis: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[moodboards/analyze] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
