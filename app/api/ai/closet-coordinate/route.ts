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
import { callClaude, callClaudeJSON } from "@/lib/claude";
import {
  CLOSET_COORDINATE_SYSTEM,
  CLOSET_COORDINATE_JSON_SYSTEM,
  buildClosetCoordinateUserMessage,
  type ClosetCoordinateOptions,
} from "@/lib/prompts/closet-coordinate";
// ★ 第3段(買い足し→検索リンク): 検索ワードの型のみ流用(生成は closet 自身が reply と1回 JSON で出す)。
import { type StyleMatchKeywords } from "@/lib/prompts/style-match-keywords";
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
  ok:          boolean;
  reply?:      string;
  buyKeywords?: StyleMatchKeywords;  // ★ 第3段: 買い足し検索ワード(3アプリ・best-effort・無ければ省略=リンク無し)
  reason?:     "auth_required" | "empty_facts";
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

    // 4) LLM 1回(JSON): reply(会話文)と buyKeywords(買い足し検索ワード)を同時に返させる → reply とリンクが必ず一致。
    //    ⚠️ 買い足しは「reply で勧めたアイテム＋世界観」を検索ワード化・手持ち服は除外(プロンプトで担保)。
    //    ⚠️ Style Match の「再現」生成器は使わない(手持ち服を探すワードになる矛盾を解消)。
    const userMessage = buildClosetCoordinateUserMessage(
      signals ?? ({ schemaVersion: 1, imageCount: 0, signals: [] } as unknown as MoodboardSignals),
      { items, gender, note, ...(worldview ? { worldview } : {}) },
    );
    const clean = (v: unknown): string[] => Array.isArray(v)
      ? Array.from(new Set(v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean))).slice(0, 6)
      : [];

    let reply = "";
    let buyKeywords: StyleMatchKeywords | undefined;
    try {
      const parsed = await callClaudeJSON<{
        reply?: unknown;
        buyKeywords?: { zozo_rakuten?: unknown; mercari_furugi?: unknown; pinterest_en?: unknown };
      }>({
        systemPrompt: CLOSET_COORDINATE_JSON_SYSTEM,
        userMessage,
        maxTokens:    2048,   // reply(長文)＋buyKeywords を1回で出すため余裕を持たせる(callClaudeJSON 途中切れ対策)
        temperature:  0.5,
      });
      // プライバシー三重防御(3): reply から英語スラッグを検出削除(aspiration ルートと同じ)。
      reply = stripCanonicalSlugs(typeof parsed.reply === "string" ? parsed.reply : "").cleaned.trim();
      const bk = parsed.buyKeywords;
      if (bk) {
        const zk = clean(bk.zozo_rakuten), mk = clean(bk.mercari_furugi), pk = clean(bk.pinterest_en);
        if (zk.length > 0 || mk.length > 0 || pk.length > 0) buyKeywords = { zozo_rakuten: zk, mercari_furugi: mk, pinterest_en: pk };
      }
    } catch {
      // ★ graceful: JSON 失敗時はテキストプロンプトで reply だけ取り直す(buyKeywords は諦める=リンク無し)。
      try {
        const rawText = await callClaude({ systemPrompt: CLOSET_COORDINATE_SYSTEM, userMessage, maxTokens: 1536, temperature: 0.5 });
        reply = stripCanonicalSlugs(rawText).cleaned.trim();
      } catch { /* both failed → reply 空 */ }
    }

    if (!reply) {
      return NextResponse.json<ClosetCoordinateResponse>({ ok: true, reason: "empty_facts" });
    }
    return NextResponse.json<ClosetCoordinateResponse>({ ok: true, reply, ...(buyKeywords ? { buyKeywords } : {}) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[closet-coordinate] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
