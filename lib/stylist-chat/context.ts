// ③-c 比較ツール準備: stylist-chat の context fetcher 群を共有可能にするための抽出（挙動不変）。
// route.ts と scripts/compare-chat.ts の両方から import する。
// ★ ロジックは route.ts から移設したまま（無改変）。export を付けただけ（挙動は1ミリも変えていない）。

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { StylistChatContext } from "@/lib/prompts/stylist-chat";
import { getDecisionRules, getFailurePatterns, getInfluences, queryKnowledge, searchKnowledge } from "@/lib/knowledge-os/client";
import {
  getMaterialContext,
  getColorContext,
  getLineContext,
  getRatioContext,
} from "@/lib/dictionaries/inject";
import { MATERIAL_DICT, COLOR_DICT, LINE_DICT, RATIO_DICT } from "@/lib/dictionaries";
import { normalizeColor } from "@/lib/knowledge/wardrobe-color-systems";
import { PRODUCT_WORLDVIEW_TAGS } from "@/lib/knowledge/product-worldview-tags";
import { computeBrandMatches, type SignalAttributes } from "@/lib/knowledge/brand-facts";

// diagnose: worldview_profiles から jsonb 列絞り SELECT(1.5a 既存ロジック)。
// ★ worldview_tags(英語スラッグ)は SELECT 句に書かない → 取得経路無し(三重防御 1)
export async function fetchDiagnoseContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<StylistChatContext> {
  const { data: profileRow } = await supabase
    .from("worldview_profiles")
    .select(
      "name:result->worldviewName,keywords:result->worldview_keywords,core:result->coreIdentity,ideal:result->idealSelf",
    )
    .eq("user_id", userId)
    .maybeSingle() as unknown as {
      data: {
        name:     unknown;
        keywords: unknown;
        core:     unknown;
        ideal:    unknown;
      } | null;
    };
  return extractContext(profileRow);
}

// closet: wardrobe_items から category, color のみ列絞り SELECT(1.5b-i 新規)。
// ★ worldview_tags 列は SELECT 句に書かない → 取得経路無し(三重防御 1)
// ★ .eq("user_id", userId) で本人データのみ(cookie-bound RLS + 二重 guard)
export async function fetchClosetContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<StylistChatContext> {
  const { data: itemsRaw } = await supabase
    .from("wardrobe_items")
    .select("category, color")
    .eq("user_id", userId);
  const items = (itemsRaw ?? []) as Array<{
    category: string | null;
    color:    string | null;
  }>;

  // 集計: 色系統別(normalizeColor で正規化) + カテゴリ別 件数
  const colorCounts: Map<string, number> = new Map();
  const categoryCounts: Map<string, number> = new Map();
  for (const it of items) {
    const system = normalizeColor(it.color);
    colorCounts.set(system, (colorCounts.get(system) ?? 0) + 1);
    const cat = (typeof it.category === "string" && it.category.trim() !== "")
      ? it.category.trim()
      : "(その他)";
    categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
  }

  const colorBuckets = Array.from(colorCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const categoryBuckets = Array.from(categoryCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    // diagnose 用フィールドは空(closet では使わない)
    worldviewName:     null,
    worldviewKeywords: [],
    coreIdentity:      null,
    idealSelf:         null,
    // closet 用サマリ
    closetSummary: {
      totalItems: items.length,
      colorBuckets,
      categoryBuckets,
    },
  };
}

// coordinate: worldview + body_profile + wardrobe の 3 並列 SELECT(MVP-1c)
// ★ いずれも列絞り SELECT で worldview_tags 取得経路を遮断(三重防御 1)
// ★ .eq("...", userId) で本人データのみ(cookie-bound RLS + 二重 guard)
// body_profile パターンは lib/prompts/concept-translate.ts:81-99 を踏襲。
export async function fetchCoordinateContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<StylistChatContext> {
  // 診断撤廃(あ): worldview_profiles(診断ポエム)の注入を停止。育成方針＝勝手に世界観を断定しない。
  //   body_profile / クローゼット集計(事実ベース)のみ注入。worldview フィールドは null/[] で返す。
  const [closetCtx, bodyRow] = await Promise.all([
    fetchClosetContext(supabase, userId),
    supabase
      .from("users")
      .select("body_profile")
      .eq("id", userId)
      .maybeSingle() as unknown as Promise<{ data: { body_profile: unknown } | null }>,
  ]);

  return {
    // 診断 worldview は注入しない(育成方針)
    worldviewName:     null,
    worldviewKeywords: [],
    coreIdentity:      null,
    idealSelf:         null,
    // closet 由来(集計サマリ)
    closetSummary:     closetCtx.closetSummary,
    // body_profile 由来(日本語サマリ化)
    bodyProfile:       extractBodyProfile(bodyRow?.data?.body_profile),
  };
}

// A-6: style-consult intent 用 contextData fetcher。
// ★ worldview + body_profile + style_preference + avoid_items の 4 ソース統合(wardrobe_items は読まない)
// ★ いずれも列絞り SELECT で worldview_tags 取得経路を遮断(三重防御 1)
// ★ .eq("id", userId) で本人データのみ(cookie-bound RLS + 二重 guard)
export async function fetchStyleConsultContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<StylistChatContext> {
  // 診断撤廃(あ): worldview_profiles(診断ポエム)の注入を停止。育成方針＝勝手に世界観を断定しない。
  //   体型 / 好み / 避けたい(事実ベース)のみ注入。worldview フィールドは null/[] で返す。
  const { data: userRow } = await supabase
    .from("users")
    .select("body_profile, style_preference, avoid_items")
    .eq("id", userId)
    .maybeSingle() as unknown as { data: {
      body_profile:     unknown;
      style_preference: unknown;
      avoid_items:      unknown;
    } | null };

  return {
    // 診断 worldview は注入しない(育成方針)
    worldviewName:     null,
    worldviewKeywords: [],
    coreIdentity:      null,
    idealSelf:         null,
    // body_profile 由来(coordinate と同形 extractor 流用)
    bodyProfile:       extractBodyProfile(userRow?.body_profile),
    // style_preference 由来(★ A-6 新規 extractor)
    stylePreference:   extractStylePreference(userRow?.style_preference),
    // avoid_items 由来(Sprint 47 text[]・★ A-6 新規 extractor)
    avoidItems:        extractAvoidItems(userRow?.avoid_items),
  };
}

// A-6b: brand-learn intent 用 contextData fetcher。
// ★ worldview + brands(curated 12件・maniac_level 順)+ style_preference の 3 ソース統合
// ★ wardrobe_items / body_profile / ai_history は読まない(コスト削減・学習型相談)
// ★ brands.worldview_tags は日本語タグ(PRODUCT_WORLDVIEW_TAGS とは別語彙・構造的安全)
// ★ KOS getInfluences は fetchKnowledgeOSContext で共通注入(本 fetcher 内では呼ばない)
const BRAND_LEARN_CURATED_LIMIT = 12;
const BRAND_DESC_TRUNCATE_LEN   = 80;

export async function fetchBrandLearnContext(
  supabase: SupabaseClient<Database>,
  userId: string,
  text?: string, // Step4-a: 明示条件の発言キーワードマップ用(optional・既存呼び出し無破壊)
  skipSignalsPreference?: boolean, // Step4-b 一時チャット: true で育成(style_signals)+好み(preference)を読まず発話のみで facts を作る
): Promise<StylistChatContext> {
  // 診断撤廃(あ): worldview_profiles(診断ポエム)の注入を停止。育成方針＝勝手に世界観を断定しない。
  //   好み(事実) + curated brands のみ注入。worldview フィールドは null/[] で返す。
  // ★ 一時チャット(skipSignalsPreference): style_signals/style_preference を読まない(痕跡ゼロ・育成非反映)。
  const [brandsRow, prefRow, signalRows] = await Promise.all([
    supabase
      .from("brands")
      .select("name, name_ja, country, description, worldview_tags, era_tags, maniac_level, price_range")
      .eq("is_active", true)
      .order("maniac_level", { ascending: false }) as unknown as Promise<{ data: Array<{
        name:           string;
        name_ja:        string | null;
        country:        string | null;
        description:    string;
        worldview_tags: string[];
        era_tags:       string[];
        maniac_level:   number;
        price_range:    string;
      }> | null }>,
    skipSignalsPreference
      ? Promise.resolve({ data: null })
      : supabase
          .from("users")
          .select("style_preference")
          .eq("id", userId)
          .maybeSingle() as unknown as Promise<{ data: { style_preference: unknown } | null }>,
    // Step4-a: 育成 style_signals(主 facts ソース)。best-effort・失敗/空でも [] で壊さない。一時チャットは読まない。
    skipSignalsPreference ? Promise.resolve([] as SignalAttributes[]) : fetchStyleSignals(supabase, userId),
  ]);

  const stylePreference = skipSignalsPreference ? undefined : extractStylePreference(prefRow?.data?.style_preference);

  // Step4-a/B: facts 組み立て → 決定的 matchBrands。constraintsActive は明示条件フィルタが効いたか(会話層 graceful 3分岐用)。
  //   一時チャット時は signals/preference を渡さず text(発話)のみで facts を作る。
  const { matches, constraintsActive } = computeBrandMatches({
    signals:    skipSignalsPreference ? undefined : signalRows,
    preference: stylePreference,
    text,
  });

  return {
    // 診断 worldview は注入しない(育成方針)
    worldviewName:     null,
    worldviewKeywords: [],
    coreIdentity:      null,
    idealSelf:         null,
    stylePreference,
    brandsCurated:     summarizeBrands(brandsRow?.data ?? []),
    brandMatches:      matches,
    brandMatchConstrained: constraintsActive,
  };
}

// Step4-a: style_signals を best-effort で読む(RLS 本人・列絞り)。失敗/空は [] を返し brand-learn を壊さない。
// ★ export: closet-coordinate(手持ち服コーデ相談)が本人の世界観(事実)集約に流用する(server 自前SELECT)。
export async function fetchStyleSignals(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<SignalAttributes[]> {
  try {
    const res = await (supabase
      .from("style_signals")
      .select("attributes")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }) as unknown as Promise<{ data: { attributes: SignalAttributes }[] | null }>);
    return (res.data ?? []).map((r) => r.attributes ?? {});
  } catch {
    return [];
  }
}

// A-6b: brands 配列を ctx.brandsCurated 形式に簡略化(LLM トークン抑制・上位 N 件 + description truncate)。
function summarizeBrands(rows: Array<{
  name:           string;
  name_ja:        string | null;
  country:        string | null;
  description:    string;
  worldview_tags: string[];
  era_tags:       string[];
  maniac_level:   number;
  price_range:    string;
}>): StylistChatContext["brandsCurated"] {
  if (rows.length === 0) return undefined;
  return rows.slice(0, BRAND_LEARN_CURATED_LIMIT).map((r) => ({
    name:          r.name,
    nameJa:        r.name_ja,
    country:       r.country,
    description:   r.description.length <= BRAND_DESC_TRUNCATE_LEN ? r.description : r.description.slice(0, BRAND_DESC_TRUNCATE_LEN) + "…",
    worldviewTags: Array.isArray(r.worldview_tags) ? r.worldview_tags : [],
    eraTags:       Array.isArray(r.era_tags)       ? r.era_tags       : [],
    maniacLevel:   typeof r.maniac_level === "number" ? r.maniac_level : 1,
    priceRange:    typeof r.price_range  === "string" ? r.price_range  : "mid",
  }));
}

// A-6: users.style_preference jsonb を日本語表示用に正規化(未登録なら undefined)。
// 型は types/index.ts:277 StylePreference 13 フィールドから stylist-chat に必要な 8 フィールド抽出。
function extractStylePreference(raw: unknown): StylistChatContext["stylePreference"] {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "")
      : [];
  const pref = {
    likedColors:         arr(r.likedColors),
    dislikedColors:      arr(r.dislikedColors),
    likedMaterials:      arr(r.likedMaterials),
    dislikedMaterials:   arr(r.dislikedMaterials),
    likedSilhouettes:    arr(r.likedSilhouettes),
    dislikedSilhouettes: arr(r.dislikedSilhouettes),
    targetImpressions:   arr(r.targetImpressions),
    avoidImpressions:    arr(r.avoidImpressions),
  };
  // 全フィールド空なら未登録扱い
  const hasAny = Object.values(pref).some((v) => v.length > 0);
  return hasAny ? pref : undefined;
}

// A-6: users.avoid_items text[] を正規化(未登録 or 空配列なら undefined)。
function extractAvoidItems(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw.filter((x): x is string => typeof x === "string" && x.trim() !== "");
  return out.length > 0 ? out : undefined;
}

// users.body_profile jsonb を日本語表示用に正規化(未登録なら undefined)。
// 型は types/index.ts:302 BodyProfile に対応(コンセプト翻訳実装と整合)。
function extractBodyProfile(raw: unknown): StylistChatContext["bodyProfile"] {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const concerns = Array.isArray(r.concerns)
    ? r.concerns.filter((c): c is string => typeof c === "string" && c.trim() !== "")
    : [];
  const height       = typeof r.height === "number" ? r.height : null;
  const bodyType     = typeof r.bodyType === "string" && r.bodyType.trim() !== "" ? r.bodyType.trim() : null;
  const skeletonType = typeof r.skeletonType === "string" && r.skeletonType.trim() !== "" ? r.skeletonType.trim() : null;
  const proportionNote = typeof r.proportionNote === "string" && r.proportionNote.trim() !== "" ? r.proportionNote.trim() : null;
  // 全フィールドが null/空 なら未登録扱い
  if (height === null && bodyType === null && skeletonType === null && concerns.length === 0 && proportionNote === null) {
    return undefined;
  }
  return { height, bodyType, skeletonType, concerns, proportionNote };
}

// jsonb 列絞り SELECT の戻り値を日本語サマリ型に正規化(fetchDiagnoseContext から使う)。
// row が null = 診断未完了 → 全 null。
function extractContext(row: {
  name:     unknown;
  keywords: unknown;
  core:     unknown;
  ideal:    unknown;
} | null): StylistChatContext {
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  const arr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "")
      : [];
  if (!row) {
    return { worldviewName: null, worldviewKeywords: [], coreIdentity: null, idealSelf: null };
  }
  return {
    worldviewName:     str(row.name),
    worldviewKeywords: arr(row.keywords),
    coreIdentity:      str(row.core),
    idealSelf:         str(row.ideal),
  };
}

// ====================================================================
// A-10: Knowledge OS 連携(案A フル統合)
// ====================================================================
// stylist-chat 段階 B 専用の Knowledge OS context fetcher。
// ・getDecisionRules + getFailurePatterns を並列フェッチ(MCP client が 5 分 in-memory cache 持つ)
// ・dictionaries(material 14 / color 15 / line 10 / ratio 8)から発話に関連する語彙を抽出
// ・★ 入口 sanitize: stripCanonicalSlugs を contextData 注入前に適用(三重防御 (1) 同型再適用)
// ・★ KOS 接続失敗時は全フィールド空で undefined 相当 → buildStylistChatUserMessage 側で
//    ブロック自体を出さない(段階 B reply 退行ゼロ)
// ・getFashionRules は worldview_tags 配列を返すため使わない(構造的排除・A-10 設計案 9bfb0cc §3.4)
const KOS_DECISION_RULES_LIMIT   = 10;
const KOS_FAILURE_PATTERNS_LIMIT = 5;
const KOS_INFLUENCES_LIMIT       = 15;

export async function fetchKnowledgeOSContext(text: string): Promise<StylistChatContext["knowledgeOS"]> {
  try {
    // A-6b: getInfluences を 3 関数並列に昇格(全 5 intent 共通注入・brand-learn で特に活用)
    const [rulesRaw, failuresRaw, influencesRaw] = await Promise.all([
      getDecisionRules({ importance_min: 4, limit: KOS_DECISION_RULES_LIMIT }),
      getFailurePatterns({ context: "fashion-coordinate", related_features: undefined }),
      getInfluences({ limit: KOS_INFLUENCES_LIMIT }),
    ]);

    // ★ 入口 sanitize: KOS 戻り値の rule / pattern / lesson / influence 文字列にも 31 語フィルタを適用
    const decisionRules = rulesRaw.slice(0, KOS_DECISION_RULES_LIMIT)
      .map((r) => ({
        rule:       stripCanonicalSlugs(r.rule ?? "").cleaned,
        importance: r.importance,
      }))
      .filter((r) => r.rule.trim().length > 0);

    const failurePatterns = failuresRaw.slice(0, KOS_FAILURE_PATTERNS_LIMIT)
      .map((f) => ({
        title:   stripCanonicalSlugs(f.pattern ?? "").cleaned,
        summary: stripCanonicalSlugs(`${f.what_went_wrong ?? ""}${f.lesson ? "  教訓: " + f.lesson : ""}`).cleaned,
      }))
      .filter((f) => f.title.trim().length > 0);

    // A-6b: 影響源(subject_name / subject_summary / fusion_essence の 3 フィールド・入口 sanitize 適用)
    const influences = influencesRaw.slice(0, KOS_INFLUENCES_LIMIT)
      .map((i) => ({
        subjectName: stripCanonicalSlugs(i.subject_name ?? "").cleaned,
        summary:     stripCanonicalSlugs(i.subject_summary ?? "").cleaned,
        fusion:      stripCanonicalSlugs(i.fusion_essence ?? "").cleaned,
      }))
      .filter((i) => i.subjectName.trim().length > 0);

    // dictionaries: 発話 text に出てくる語彙のみ抽出(全 47 エントリ全載せはトークン浪費 + ノイズ)
    const matched = matchDictionaryKeys(text);

    return {
      decisionRules,
      failurePatterns,
      influences,
      dictionaries: {
        materials:   getMaterialContext(matched.materials),
        colors:      getColorContext(matched.colors),
        silhouettes: getLineContext(matched.silhouettes),
        ratios:      getRatioContext(matched.ratios),
      },
    };
  } catch (err) {
    // KOS / dictionaries 失敗時は undefined 相当(空オブジェクト)で段階 B 退行ゼロ
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[stylist-chat] knowledge-os fetch failed:", message);
    return {
      decisionRules:   [],
      failurePatterns: [],
      influences:      [],
      dictionaries:    { materials: "", colors: "", silhouettes: "", ratios: "" },
    };
  }
}

// ③-c-2: query_knowledge 主素材版の KO context fetcher（フラグ ON・非 MB のみ使用）。
// ・queryKnowledge(text)（c-1・キャッシュ外・graceful・通常20s/最大25s）を待つ。
// ・answer!==null: decision_rules/failure_patterns/related_entries を主素材、answer を補助、
//   getInfluences 併用で influences 温存。dictionaries は従来どおり text マッチで抽出。
// ・answer===null（失敗/タイムアウト）: 安全モード（knowledgeOS=undefined・get_* は使わない）。
// ・入口 sanitize（stripCanonicalSlugs 31語）を query_knowledge 戻り値にも適用（描画指示「sanitize 済」と整合）。
// 戻り: { knowledgeOS, requestId, safeMode }。
export async function fetchKnowledgeOSViaQueryKnowledge(text: string): Promise<{
  knowledgeOS: StylistChatContext["knowledgeOS"];
  requestId: string | null;
  safeMode: boolean;
}> {
  // queryKnowledge と getInfluences を並列（influences 併用温存）。getInfluences は graceful([])。
  const [qk, influencesRaw] = await Promise.all([
    queryKnowledge(text),
    getInfluences({ limit: KOS_INFLUENCES_LIMIT }),
  ]);

  // 失敗/タイムアウト → 安全モード（KO 文脈なし・get_* も使わない）
  if (!qk.answer) {
    return { knowledgeOS: undefined, requestId: qk.requestId, safeMode: true };
  }
  const a = qk.answer;

  const decisionRules = a.decision_rules
    .map((r) => ({ rule: stripCanonicalSlugs(r ?? "").cleaned }))
    .filter((r) => r.rule.trim().length > 0)
    .slice(0, KOS_DECISION_RULES_LIMIT);

  const failurePatterns = a.failure_patterns
    .map((f) => ({ title: stripCanonicalSlugs(f ?? "").cleaned }))
    .filter((f) => f.title.trim().length > 0)
    .slice(0, KOS_FAILURE_PATTERNS_LIMIT);

  const relatedEntries = a.related_entries
    .map((e) => ({
      title:   stripCanonicalSlugs(e.title ?? "").cleaned,
      summary: stripCanonicalSlugs(e.summary ?? "").cleaned,
    }))
    .filter((e) => e.title.trim().length > 0)
    .slice(0, 5);

  const answerSummary = stripCanonicalSlugs(a.answer ?? "").cleaned || undefined;

  const influences = influencesRaw.slice(0, KOS_INFLUENCES_LIMIT)
    .map((i) => ({
      subjectName: stripCanonicalSlugs(i.subject_name ?? "").cleaned,
      summary:     stripCanonicalSlugs(i.subject_summary ?? "").cleaned,
      fusion:      stripCanonicalSlugs(i.fusion_essence ?? "").cleaned,
    }))
    .filter((i) => i.subjectName.trim().length > 0);

  const matched = matchDictionaryKeys(text);

  return {
    knowledgeOS: {
      decisionRules,
      failurePatterns,
      influences,
      answerSummary,
      relatedEntries,
      dictionaries: {
        materials:   getMaterialContext(matched.materials),
        colors:      getColorContext(matched.colors),
        silhouettes: getLineContext(matched.silhouettes),
        ratios:      getRatioContext(matched.ratios),
      },
    },
    requestId: qk.requestId,
    safeMode: false,
  };
}

// 高速版: search_knowledge（合成なし・生 ranked entry）から KO context を組む。
// fetchKnowledgeOSViaQueryKnowledge と同 shape の knowledgeOS を返す（描画不変）。answer補助は無し（合成廃止）。
// ・decisionRules: 上位entry(score降順=ranked順)の entry.decision_rules を flat 収集・condition展開・上限10。
// ・failurePatterns: log_type==='failure_pattern' の entry → {title, summary: ai_summary}・上限5。
// ・relatedEntries: ranked entry → {title, summary: ai_summary}・上限5。
// ・influences: getInfluences 併用で温存。dictionaries 不変。入口 sanitize 適用。
// ・outcome!=="ranked"（no_relevant/no_embeddings/失敗）→ safeMode=true・knowledgeOS=undefined（get_*に落とさない）。
export async function fetchKnowledgeOSViaSearchKnowledge(
  text: string,
  // 修正B: 本対話(general)は bookOnly=true で「本(book_learning)」だけ検索＋minCos 0.25緩和。
  //   fashionモードは未指定(false)＝従来(全件・MIN_COS 0.33)＝無改修。
  bookOnly = false,
): Promise<{
  knowledgeOS: StylistChatContext["knowledgeOS"];
  requestId: string | null;
  safeMode: boolean;
}> {
  const [sk, influencesRaw] = await Promise.all([
    bookOnly ? searchKnowledge(text, { bookOnly: true, minCos: 0.25 }) : searchKnowledge(text),
    getInfluences({ limit: KOS_INFLUENCES_LIMIT }),
  ]);

  if (!sk.result || sk.result.outcome !== "ranked" || sk.result.entries.length === 0) {
    return { knowledgeOS: undefined, requestId: sk.requestId, safeMode: true };
  }
  const entries = sk.result.entries;

  // 判断ルール: 上位 entry から flat 収集（condition は「〜（条件: …）」展開）・上限 KOS_DECISION_RULES_LIMIT
  const decisionRules: Array<{ rule: string; importance?: number }> = [];
  for (const e of entries) {
    for (const d of e.decision_rules) {
      const ruleText = stripCanonicalSlugs(
        d.condition ? `${d.rule}（条件: ${d.condition}）` : d.rule,
      ).cleaned;
      if (ruleText.trim().length === 0) continue;
      decisionRules.push({ rule: ruleText, importance: e.importance });
      if (decisionRules.length >= KOS_DECISION_RULES_LIMIT) break;
    }
    if (decisionRules.length >= KOS_DECISION_RULES_LIMIT) break;
  }

  // 失敗パターン: log_type='failure_pattern' の entry → {title, summary}
  const failurePatterns = entries
    .filter((e) => e.log_type === "failure_pattern")
    .map((e) => ({
      title:   stripCanonicalSlugs(e.title ?? "").cleaned,
      summary: stripCanonicalSlugs(e.ai_summary ?? "").cleaned,
    }))
    .filter((f) => f.title.trim().length > 0)
    .slice(0, KOS_FAILURE_PATTERNS_LIMIT);

  // 根拠: ranked entry → {title, summary}
  const relatedEntries = entries
    .map((e) => ({
      title:   stripCanonicalSlugs(e.title ?? "").cleaned,
      summary: stripCanonicalSlugs(e.ai_summary ?? "").cleaned,
    }))
    .filter((e) => e.title.trim().length > 0)
    .slice(0, 5);

  const influences = influencesRaw.slice(0, KOS_INFLUENCES_LIMIT)
    .map((i) => ({
      subjectName: stripCanonicalSlugs(i.subject_name ?? "").cleaned,
      summary:     stripCanonicalSlugs(i.subject_summary ?? "").cleaned,
      fusion:      stripCanonicalSlugs(i.fusion_essence ?? "").cleaned,
    }))
    .filter((i) => i.subjectName.trim().length > 0);

  const matched = matchDictionaryKeys(text);

  // (d): 本文抜粋（matched_text）を出典付きで収集。本(全文)など ai_summary が薄いナレッジでも、
  //   この抜粋で Haiku が本RAGの深さを出せる。cap: 上位3 entry × 各最大2抜粋・合計2000字（軽さ維持）。
  const passages: Array<{ source: string; text: string }> = [];
  let passageBudget = 2000;
  for (const e of entries.slice(0, 3)) {
    if (passageBudget <= 0) break;
    const src = stripCanonicalSlugs(e.title ?? "").cleaned || "(無題)";
    for (const t of (e.matched_text ?? []).slice(0, 2)) {
      if (passageBudget <= 0) break;
      const clean = stripCanonicalSlugs(t).cleaned.trim();
      if (!clean) continue;
      const take = clean.slice(0, passageBudget);
      passages.push({ source: src, text: take });
      passageBudget -= take.length;
    }
  }

  return {
    knowledgeOS: {
      decisionRules,
      failurePatterns,
      influences,
      // answerSummary: 無し（合成answer廃止・設計通り）
      relatedEntries,
      ...(passages.length > 0 ? { passages } : {}),
      dictionaries: {
        materials:   getMaterialContext(matched.materials),
        colors:      getColorContext(matched.colors),
        silhouettes: getLineContext(matched.silhouettes),
        ratios:      getRatioContext(matched.ratios),
      },
    },
    requestId: sk.requestId,
    safeMode: false,
  };
}

// 発話 text に含まれる dictionary キー(日本語)を 4 種類抽出。
// 単純な部分一致(辞書キーは日本語短語のため誤検出は低い)。
function matchDictionaryKeys(text: string): {
  materials:   string[];
  colors:      string[];
  silhouettes: string[];
  ratios:      string[];
} {
  return {
    materials:   Object.keys(MATERIAL_DICT).filter((k) => text.includes(k)),
    colors:      Object.keys(COLOR_DICT).filter((k) => text.includes(k)),
    silhouettes: Object.keys(LINE_DICT).filter((k) => text.includes(k)),
    ratios:      Object.keys(RATIO_DICT).filter((k) => text.includes(k)),
  };
}

// 出力フィルタ(三重防御の 3 つ目)。
// PRODUCT_WORLDVIEW_TAGS 31 語(M5 正準辞書・小文字英語スラッグ)を
// 単語境界(\b)単位で検出 → 該当削除 + console.warn。
// 構造的同期: 31 語の定数を直参照しているため、辞書追加が即フィルタにも反映される。
const SLUG_PATTERN = new RegExp(
  `\\b(?:${PRODUCT_WORLDVIEW_TAGS.map(escapeRegExp).join("|")})\\b`,
  "gi",
);

export function stripCanonicalSlugs(text: string): { cleaned: string; removed: boolean } {
  let removed = false;
  const cleaned = text.replace(SLUG_PATTERN, () => {
    removed = true;
    return "";
  });
  if (!removed) {
    return { cleaned: text, removed: false };
  }
  // 残った句読点 / 連続空白 を整える(自然文を壊しすぎない)
  const normalized = cleaned
    .replace(/[ \t]+/g, " ")
    .replace(/\s*([、。])\s*/g, "$1")
    .replace(/(^|\n)[ \t、。]+/g, "$1")
    .trim();
  return { cleaned: normalized, removed: true };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
