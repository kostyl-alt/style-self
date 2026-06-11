// 憧れ写真分析（新モード「この雰囲気に近づく」）。
//
// POST /api/ai/aspiration-photo
// body: { base64: string, mediaType: string, note?: string }
// returns: { ok, reply } / { ok:false, reason } / { error }
//
// フロー: auth(cookie RLS) → 文脈を列絞り SELECT で取得（診断済み=変換先 / 未診断=方向性推測）→
//   Claude Vision に憧れ写真を送り自然文の分析を返させる → stripCanonicalSlugs（防御3）→ reply。
// ⚠️ 商品検索・アフィリエイトは一切しない（分析体験のみ）。保存は P2（本ルートは保存しない）。
//
// プライバシー三重防御:
//   (1) 文脈は fetchStyleConsultContext の列絞り SELECT 由来（worldview_tags 取得経路なし）
//   (2) system prompt で英語スラッグ・内部 ID の出力禁止を明示（lib/prompts/aspiration-photo.ts）
//   (3) 本ルートで返答に stripCanonicalSlugs を適用（31 語辞書で検出削除）

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callClaudeWithImageText, type ImageMediaType } from "@/lib/claude";
import {
  ASPIRATION_PHOTO_SYSTEM_PROMPT,
  buildAspirationPhotoUserMessage,
  type AspirationPhotoContext,
} from "@/lib/prompts/aspiration-photo";
import { fetchStyleConsultContext, stripCanonicalSlugs } from "@/lib/stylist-chat/context";
import { STYLE_SIGNALS } from "@/lib/flags";

export const dynamic = "force-dynamic";

// Phase A: [[SECTION:signals]] ブロックを {colors,silhouettes,genres,eras,moods} にパース（保存用）。
//   日本語ラベル行「ラベル: 値, 値」のみ拾う。各値に stripCanonicalSlugs を通して英語スラッグ二重防御。
//   signals が無い/空なら null。
function parseStyleSignals(raw: string): Record<string, string[]> | null {
  const block = raw.match(/\[\[SECTION:signals\]\]([\s\S]*?)(?:\[\[SECTION:|$)/i);
  if (!block) return null;
  const labelMap: Record<string, string> = {
    "色": "colors", "シルエット": "silhouettes",
    "ジャンル候補": "genres", "ジャンル": "genres",
    "年代": "eras", "ムード": "moods",
  };
  const out: Record<string, string[]> = {};
  for (const line of block[1].split("\n")) {
    const m = line.match(/^\s*([^:：]+)[:：]\s*(.+)$/);
    if (!m) continue;
    const key = labelMap[m[1].trim()];
    if (!key) continue;
    const vals = m[2]
      .split(/[,、，]/)
      .map((s) => stripCanonicalSlugs(s.trim()).cleaned.trim())
      .filter(Boolean);
    if (vals.length > 0) out[key] = vals;
  }
  return Object.keys(out).length > 0 ? out : null;
}
// Vision(Sonnet)1 回呼び出し。analyze 系と同等の余裕を持たせる。
export const maxDuration = 60;

const VALID_MEDIA_TYPES = new Set<ImageMediaType>(["image/jpeg", "image/png", "image/gif", "image/webp"]);
// 要約 ＋ ===DETAIL=== ＋ 詳細7セクションで出力が増えるため 2048→3072（詳細の途中切れ防止）。
const MAX_REPLY_TOKENS = 3072;

interface AspirationPhotoRequest {
  base64?:    unknown;
  mediaType?: unknown;
  note?:      unknown;
}

interface AspirationPhotoResponse {
  ok:      boolean;
  reply?:  string;
  reason?: "auth_required" | "empty_image";
}

export async function POST(request: NextRequest) {
  try {
    // 1) 認証（本人のみ・他人データ防止の起点）
    const supabase = createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      return NextResponse.json<AspirationPhotoResponse>({ ok: true, reason: "auth_required" });
    }
    const userId = authData.user.id;

    // 2) body 解析（client 信頼は最小化）
    const body = await request.json() as AspirationPhotoRequest;
    const base64 = typeof body.base64 === "string" ? body.base64 : "";
    if (base64.length === 0) {
      return NextResponse.json<AspirationPhotoResponse>({ ok: true, reason: "empty_image" });
    }
    const safeMediaType: ImageMediaType =
      VALID_MEDIA_TYPES.has(body.mediaType as ImageMediaType)
        ? (body.mediaType as ImageMediaType)
        : "image/jpeg";
    const note = typeof body.note === "string" ? body.note : undefined;

    // 3) 文脈（変換先の補助）をサーバ自前 SELECT。列絞りで worldview_tags は構造的に取得しない。
    //    style-consult 用 fetcher を流用（世界観 + 体型 + 好み/避けたい印象 + 避けたい服）。
    //    未診断なら worldviewName=null 等 → prompt が方向性推測モードに分岐。
    const base = await fetchStyleConsultContext(supabase, userId);
    const ctx: AspirationPhotoContext = {
      worldviewName:     base.worldviewName,
      worldviewKeywords: base.worldviewKeywords,
      coreIdentity:      base.coreIdentity,
      bodyProfile: base.bodyProfile
        ? {
            height:         base.bodyProfile.height,
            bodyType:       base.bodyProfile.bodyType,
            skeletonType:   base.bodyProfile.skeletonType,
            proportionNote: base.bodyProfile.proportionNote,
          }
        : undefined,
      avoidImpressions: base.stylePreference?.avoidImpressions,
      avoidItems:       base.avoidItems,
    };

    // 4) Claude Vision 呼び出し（自然文返答）
    let raw: string;
    try {
      raw = await callClaudeWithImageText(
        ASPIRATION_PHOTO_SYSTEM_PROMPT,
        base64,
        safeMediaType,
        buildAspirationPhotoUserMessage(ctx, note),
        MAX_REPLY_TOKENS,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[aspiration-photo] claude failed:", message);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    // 5) 出力フィルタ（三重防御の3つ目・31 語辞書で英語スラッグ検出削除）
    const { cleaned, removed } = stripCanonicalSlugs(raw);
    if (removed) {
      console.warn("[aspiration-photo] english slug detected in reply, removed");
    }
    const reply = cleaned.trim().length > 0
      ? cleaned
      : "うまく言葉にできませんでした。もう一度、別の写真で試してもらえますか。";

    // Phase A: 事実属性を style_signals に保存（フラグON時・ベストエフォート）。
    //   ⚠️ 保存の成否に関わらず分析の返答は必ず返す（保存は分析を邪魔しない）。OFF/失敗時は何もしない＝退行ゼロ。
    if (STYLE_SIGNALS) {
      try {
        const attributes = parseStyleSignals(raw);
        if (attributes) {
          await supabase.from("style_signals").insert({
            user_id: userId,
            source:  "aspiration",
            attributes,
          } as never);
        }
      } catch (e) {
        console.warn("[aspiration-photo] style_signals insert skipped:", e instanceof Error ? e.message : e);
      }
    }

    return NextResponse.json<AspirationPhotoResponse>({ ok: true, reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[aspiration-photo] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
