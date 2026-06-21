// 手持ちの服でコーデ相談: 「合うコーデ/買い足し」を自由文(会話)で提案する隔離ルート。
//   ⚠️ photos-structure / style-match-keywords を汚さない別ルート。CLOSET_COORDINATE 体験からのみ呼ばれる。
//   DB は触らない(返答は会話・保存はフロントの ChatGPT 型保存に任せる)。
//
// returns: { ok:true, reply } / { ok:true, reason:"auth_required"|"empty_facts" } / { error }
//
// フロー: auth(cookie RLS) → signals 主軸(core/repeated)＋観察アイテム → LLM 1回で自由文提案。
//   ⚠️ 事実(signals/items)は決定的・LLM は「会話での助言」だけ(服の捏造はプロンプトで担保)。
//   ⚠️ プライバシー: 返答に stripCanonicalSlugs(英語スラッグ31語の検出削除)を適用(aspiration 流用)。

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callClaude } from "@/lib/claude";
import {
  CLOSET_COORDINATE_SYSTEM,
  buildClosetCoordinateUserMessage,
  type ClosetCoordinateOptions,
} from "@/lib/prompts/closet-coordinate";
import { stripCanonicalSlugs, fetchStyleConsultContext, fetchStyleSignals } from "@/lib/stylist-chat/context";
import { buildBrandFacts } from "@/lib/knowledge/brand-facts";
import type { MoodboardSignals } from "@/types/moodboard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ClosetCoordinateRequest {
  signals?: MoodboardSignals;
  items?:   string[];  // 観察アイテム名(任意・補助・vision.visualFacts.items の value)
  gender?:  string;    // 任意("メンズ"/"レディース" 等・無ければ断定しない)
  note?:    string;    // 任意(本人の相談文・自由文)
}

interface ClosetCoordinateResponse {
  ok:      boolean;
  reply?:  string;
  reason?: "auth_required" | "empty_facts";
}

export async function POST(request: NextRequest) {
  try {
    // 1) 認証(体験を本人に閉じる・DB は触らない)
    const supabase = createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      return NextResponse.json<ClosetCoordinateResponse>({ ok: true, reason: "auth_required" });
    }

    // 2) body(client 信頼は最小化)
    const body = await request.json() as ClosetCoordinateRequest;
    const signals = body.signals;
    const items = Array.isArray(body.items) ? body.items.filter((s): s is string => typeof s === "string") : [];
    const gender = typeof body.gender === "string" ? body.gender : undefined;
    const note = typeof body.note === "string" ? body.note : undefined;
    const hasCore = !!signals && Array.isArray(signals.signals) && signals.signals.length > 0;
    // 事実(共通要素)も観察アイテムも無ければ提案を作らない(無理に出して質を落とさない)。
    if (!hasCore && items.length === 0) {
      return NextResponse.json<ClosetCoordinateResponse>({ ok: true, reason: "empty_facts" });
    }

    // ★ 第1段(世界観で個別化): 本人の事実ベース世界観を server 自前SELECT(auth.uid())で取得し prompt に注入。
    //   ・style_signals(惹かれる構造の事実) + style_preference(好み/避けたい) を buildBrandFacts で決定的に集約。
    //   ・診断ポエム(worldview_profiles)は使わない(育成方針に整合)。空(未育成)なら undefined → 従来の無難提案(graceful)。
    let worldview: ClosetCoordinateOptions["worldview"] | undefined;
    try {
      const [userSignals, consult] = await Promise.all([
        fetchStyleSignals(supabase, authData.user.id),
        fetchStyleConsultContext(supabase, authData.user.id),
      ]);
      const pref = consult.stylePreference;
      const facts = buildBrandFacts({
        signals: userSignals,
        preference: { likedColors: pref?.likedColors, likedSilhouettes: pref?.likedSilhouettes, likedMaterials: pref?.likedMaterials },
      });
      const wv = {
        colors: facts.colors, silhouettes: facts.silhouettes, genres: facts.genres, eras: facts.eras, materials: facts.materials,
        avoidColors: pref?.dislikedColors, avoidSilhouettes: pref?.dislikedSilhouettes, avoidImpressions: pref?.avoidImpressions,
      };
      const hasAny = [wv.colors, wv.silhouettes, wv.genres, wv.eras, wv.materials, wv.avoidColors, wv.avoidSilhouettes, wv.avoidImpressions]
        .some((a) => Array.isArray(a) && a.length > 0);
      worldview = hasAny ? wv : undefined;
    } catch { worldview = undefined; }  // graceful: 取得失敗は世界観なしで従来どおり

    // 4) LLM 1回(事実は渡すだけ・会話で提案)。質優先で既定 Sonnet。
    const userMessage = buildClosetCoordinateUserMessage(
      signals ?? ({ schemaVersion: 1, imageCount: 0, signals: [] } as unknown as MoodboardSignals),
      { items, gender, note, ...(worldview ? { worldview } : {}) },
    );
    const raw = await callClaude({
      systemPrompt: CLOSET_COORDINATE_SYSTEM,
      userMessage,
      maxTokens:    1536,
      temperature:  0.5,
    });

    // プライバシー三重防御(3): 返答から英語スラッグを検出削除(aspiration ルートと同じ)。
    const reply = stripCanonicalSlugs(raw).cleaned.trim();
    if (!reply) {
      return NextResponse.json<ClosetCoordinateResponse>({ ok: true, reason: "empty_facts" });
    }

    return NextResponse.json<ClosetCoordinateResponse>({ ok: true, reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[closet-coordinate] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
