// Knowledge OS への JSON-RPC クライアント（PoC: 影響源・判断ルールの参照のみ）
//
// Knowledge OS の MCP RPC エンドポイント仕様:
//   POST {KNOWLEDGE_OS_URL}
//   Authorization: Bearer {KNOWLEDGE_OS_API_KEY}
//   body: { jsonrpc:"2.0", id, method:"tools/call", params:{ name, arguments } }
//   response.result.content[0].text に JSON 配列の文字列が入る（add3bea 以降）

const DEFAULT_URL = "http://localhost:3001/api/mcp/rpc";
const TIMEOUT_MS = 5000;

// ③-c-1: query_knowledge は KO 側で LLM 合成(embed + Claude 4096tok)を回す重い処理のため、
// get_* の 5s とは別枠の長いタイムアウト。通常 20s で諦め・25s を絶対上限とする(設計 §4-1)。
const QUERY_KNOWLEDGE_TIMEOUT_MS = 20_000;
const QUERY_KNOWLEDGE_TIMEOUT_MAX_MS = 25_000;

let warnedMissingKey = false;
function getConfig(): { url: string; apiKey: string | undefined } {
  const url = process.env.KNOWLEDGE_OS_URL || DEFAULT_URL;
  const apiKey = process.env.KNOWLEDGE_OS_API_KEY;
  if (!apiKey && !warnedMissingKey) {
    console.warn("[knowledge-os] KNOWLEDGE_OS_API_KEY が未設定です。Knowledge OS 連携はスキップされます。");
    warnedMissingKey = true;
  }
  return { url, apiKey };
}

export type InfluenceCategory =
  | "art" | "color" | "music" | "culture" | "fashion"
  | "material" | "worldview" | "philosophy" | "silhouette" | "performance";

export interface InfluenceData {
  id: string;
  subject_type: string;
  subject_name: string;
  subject_summary?: string;
  fusion_essence?: string;
  influences?: Partial<Record<InfluenceCategory, string[]>>;
  influence_decision_rules?: unknown[];
  visual_signatures?: unknown;
  importance?: number;
  // Sprint 17 Phase 1 で MCP が返すカテゴリ階層メタ（未紐付けは null）
  category_id?: string | null;
  category_slug?: string | null;
  category_name?: string | null;
}

export interface CategoryData {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  parent_slug: string | null;
  description: string | null;
  sort_order: number;
  is_system: boolean;
  influence_count?: number;
  entry_count?: number;
}

export interface DecisionRule {
  rule: string;
  condition?: string;
  source_entry_id?: string;
  source_entry_title?: string;
  category?: string;
  project?: string;
  importance?: number;
  is_shared_knowledge?: boolean;
  confidence_score?: number | null;
}

// A-10: 失敗パターン(MCP server 側 get_failure_patterns の戻り型)
export interface FailurePattern {
  pattern:             string;
  what_went_wrong:     string;
  lesson:              string;
  source_entry_id:     string;
  source_entry_title:  string;
  category:            string | null;
  tags:                string[];
}

interface GetInfluencesArgs {
  subject_name?: string;
  category?: string;
  // Sprint 17 Phase 1: 新カテゴリ階層 slug でフィルタ
  category_slug?: string;
  include_children?: boolean;
  importance_min?: number;
  limit?: number;
}

interface GetDecisionRulesArgs {
  project?: string;
  category_slug?: string;
  include_children?: boolean;
  importance_min?: number;
  min_confidence?: number;
  limit?: number;
}

interface GetCategoriesArgs {
  parent_slug?: string;
  include_counts?: boolean;
}

// A-10: 失敗パターン取得の引数(MCP server 側 get_failure_patterns の入力)
interface GetFailurePatternsArgs {
  context?:          string;
  related_features?: string[];
}

// ----- インメモリキャッシュ (P4) -----
// KO の influences/categories/rules は分単位で変わらないので 5 分 TTL でキャッシュ。
// サーバ再起動でリセットされる素朴な Map ベース。外部依存(Redis 等)は不要。
// 鮮度より速度を優先する設計判断: 診断中に KO 側で entry が追加されても
// 5 分以内は古いデータが返るが、フェーズA の許容範囲とする。
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  data:      unknown[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(name: string, args: Record<string, unknown>): string {
  // JSON.stringify は引数のキー順で結果が変わりうるが、callTool への呼び出しは
  // GetInfluencesArgs/GetDecisionRulesArgs/GetCategoriesArgs 経由で同じ順序になるため実用上問題ない。
  return `${name}::${JSON.stringify(args)}`;
}

async function callToolCached<T>(
  name: string,
  args: Record<string, unknown>,
  timeoutMs: number = TIMEOUT_MS,
): Promise<T[]> {
  const key = cacheKey(name, args);
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && hit.expiresAt > now) {
    // slice で配列の浅いコピーを返す(呼び出し側 filter/map で長さを変えても安全)。
    // 配列要素のオブジェクトは共有なので、呼び出し側はオブジェクトをミューテートしない約束。
    return (hit.data as T[]).slice();
  }
  const fresh = await callTool<T>(name, args, timeoutMs);
  cache.set(key, { data: fresh, expiresAt: now + CACHE_TTL_MS });
  return fresh.slice();
}

async function callTool<T>(
  name: string,
  args: Record<string, unknown>,
  timeoutMs: number = TIMEOUT_MS,
): Promise<T[]> {
  const { url, apiKey } = getConfig();
  if (!apiKey) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name, arguments: args },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[knowledge-os] ${name} HTTP ${res.status}`);
      return [];
    }

    const body = await res.json() as {
      result?: { content?: Array<{ type?: string; text?: string }> };
      error?: { message?: string };
    };

    if (body.error) {
      console.warn(`[knowledge-os] ${name} RPC error:`, body.error.message ?? body.error);
      return [];
    }

    const text = body.result?.content?.[0]?.text;
    if (!text) {
      console.warn(`[knowledge-os] ${name} empty content`);
      return [];
    }

    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) {
      console.warn(`[knowledge-os] ${name} content[0] is not an array`);
      return [];
    }
    return parsed as T[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[knowledge-os] ${name} failed:`, msg);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function getInfluences(args: GetInfluencesArgs = {}, timeoutMs?: number): Promise<InfluenceData[]> {
  return callToolCached<InfluenceData>("get_influences", args as Record<string, unknown>, timeoutMs);
}

export async function getDecisionRules(args: GetDecisionRulesArgs = {}, timeoutMs?: number): Promise<DecisionRule[]> {
  return callToolCached<DecisionRule>("get_decision_rules", args as Record<string, unknown>, timeoutMs);
}

export async function getCategories(args: GetCategoriesArgs = {}): Promise<CategoryData[]> {
  return callToolCached<CategoryData>("get_categories", args as Record<string, unknown>);
}

// A-10: 失敗パターン取得(getDecisionRules と同形・5 分キャッシュ + エラー時 [] 返却)
// 注: getFashionRules は worldview_tags 配列を返すため A-10 では追加しない(構造的排除)
export async function getFailurePatterns(args: GetFailurePatternsArgs = {}): Promise<FailurePattern[]> {
  return callToolCached<FailurePattern>("get_failure_patterns", args as Record<string, unknown>);
}

// ====================================================================
// ③-c-1: query_knowledge（KO の意味検索＋合成回答）
// ====================================================================
// get_* と異なり、KO は KnowledgeAnswer "オブジェクト" を content[0].text に入れて返す
// (get_* は配列)。さらに result._meta.request_id を返す(③-b)。突合の核なのでここで受領する。
//
// callTool/callToolCached は使わない(配列前提・キャッシュ前提のため):
//   - パースが配列ではなくオブジェクト。
//   - request_id を一意に保つにはキャッシュ禁止(毎回 KO を実呼びして新しい request_id を得る)。
//   - タイムアウトが get_* の 5s では足りない(LLM 合成のため 20-25s)。
//
// graceful: 失敗/タイムアウト/パース失敗/キー未設定は全て { answer:null, requestId:null }。throw しない。
// 呼び出し側(stylist-chat・③-c-2)は answer===null を「安全モードへ」の信号として扱う。

export interface KnowledgeAnswer {
  answer: string;
  related_entries: Array<{ id: string; title: string; summary: string; decision_rules: string[] }>;
  decision_rules: string[];
  failure_patterns: string[];
  design_principles: string[];
  implementation_hints: string[];
  used_references?: Array<{ source_type: string; source_id: string; rule_text: string; why_used: string }>;
}

export interface QueryKnowledgeResult {
  answer: KnowledgeAnswer | null; // 失敗/タイムアウト時 null
  requestId: string | null;       // KO の _meta.request_id（突合の核）
}

const EMPTY_QUERY_KNOWLEDGE_RESULT: QueryKnowledgeResult = { answer: null, requestId: null };

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

// content[0].text(オブジェクト)を KnowledgeAnswer に正規化(欠損は空で補完)。
function normalizeKnowledgeAnswer(raw: unknown): KnowledgeAnswer | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  return {
    answer: typeof o.answer === "string" ? o.answer : "",
    related_entries: Array.isArray(o.related_entries)
      ? (o.related_entries as unknown[]).map((e) => {
          const r = (e ?? {}) as Record<string, unknown>;
          return {
            id: typeof r.id === "string" ? r.id : "",
            title: typeof r.title === "string" ? r.title : "",
            summary: typeof r.summary === "string" ? r.summary : "",
            decision_rules: asStringArray(r.decision_rules),
          };
        })
      : [],
    decision_rules: asStringArray(o.decision_rules),
    failure_patterns: asStringArray(o.failure_patterns),
    design_principles: asStringArray(o.design_principles),
    implementation_hints: asStringArray(o.implementation_hints),
    used_references: Array.isArray(o.used_references)
      ? (o.used_references as unknown[]).map((u) => {
          const r = (u ?? {}) as Record<string, unknown>;
          return {
            source_type: typeof r.source_type === "string" ? r.source_type : "",
            source_id: typeof r.source_id === "string" ? r.source_id : "",
            rule_text: typeof r.rule_text === "string" ? r.rule_text : "",
            why_used: typeof r.why_used === "string" ? r.why_used : "",
          };
        })
      : undefined,
  };
}

export async function queryKnowledge(
  question: string,
  opts?: { timeoutMs?: number },
): Promise<QueryKnowledgeResult> {
  const { url, apiKey } = getConfig();
  if (!apiKey) return EMPTY_QUERY_KNOWLEDGE_RESULT;

  const q = (question ?? "").trim();
  if (!q) return EMPTY_QUERY_KNOWLEDGE_RESULT;

  const timeoutMs = Math.min(
    opts?.timeoutMs ?? QUERY_KNOWLEDGE_TIMEOUT_MS,
    QUERY_KNOWLEDGE_TIMEOUT_MAX_MS,
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      // project は渡さない(KO の project はプロvenンスフィルタ・'style-self' 指定で 0 件事故)
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name: "query_knowledge", arguments: { question: q } },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[knowledge-os] query_knowledge HTTP ${res.status}`);
      return EMPTY_QUERY_KNOWLEDGE_RESULT;
    }

    const body = (await res.json()) as {
      result?: {
        content?: Array<{ type?: string; text?: string }>;
        _meta?: { request_id?: string };
      };
      error?: { message?: string };
    };

    if (body.error) {
      console.warn("[knowledge-os] query_knowledge RPC error:", body.error.message ?? body.error);
      return EMPTY_QUERY_KNOWLEDGE_RESULT;
    }

    const requestId = body.result?._meta?.request_id ?? null;

    const text = body.result?.content?.[0]?.text;
    if (!text) {
      console.warn("[knowledge-os] query_knowledge empty content");
      // request_id は取れていれば返す(ログ目的・本文は null)
      return { answer: null, requestId };
    }

    const parsed = normalizeKnowledgeAnswer(JSON.parse(text) as unknown);
    if (!parsed) {
      console.warn("[knowledge-os] query_knowledge content[0] is not a KnowledgeAnswer object");
      return { answer: null, requestId };
    }
    return { answer: parsed, requestId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[knowledge-os] query_knowledge failed:", msg);
    return EMPTY_QUERY_KNOWLEDGE_RESULT;
  } finally {
    clearTimeout(timeout);
  }
}

// ====================================================================
// 高速化: search_knowledge（KO の合成なし意味検索）
// ====================================================================
// query_knowledge と並置。KO側で Claude 合成(Sonnet 4096tok)を行わず、生の ranked entry を返す。
// 合成が無いぶん高速(curl 実測 ~3s/local・本番 ~1s 見込み・query_knowledge の 20-25s より大幅短い)。
// queryKnowledge と同様: キャッシュ外・_meta.request_id 受領・graceful。タイムアウトは合成無しで短い(10s)。

const SEARCH_KNOWLEDGE_TIMEOUT_MS = 10_000;

export interface SearchKnowledgeEntry {
  id: string;
  title: string | null;
  ai_summary: string | null;
  decision_rules: Array<{ rule: string; condition?: string }>;
  log_type: string;
  importance: number;
  confidence: number;
  score: number;       // cos_sim
  final: number;
  embedding_id: string;
  chunk_index: number;
  matched_text?: string[]; // (d): 検索ヒット本文抜粋（KO_SK_CHUNK_CONTEXT ON時のみ・無ければ undefined）
}
export interface SearchKnowledgeResult {
  outcome: "ranked" | "no_relevant" | "no_embeddings";
  entries: SearchKnowledgeEntry[];
}
export interface SearchKnowledgeReturn {
  result: SearchKnowledgeResult | null; // 失敗/タイムアウト時 null
  requestId: string | null;             // KO の _meta.request_id（突合の核）
}

const EMPTY_SEARCH_KNOWLEDGE_RETURN: SearchKnowledgeReturn = { result: null, requestId: null };

function normalizeSearchKnowledge(raw: unknown): SearchKnowledgeResult | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const outcome =
    o.outcome === "no_relevant" || o.outcome === "no_embeddings" ? o.outcome : "ranked";
  const entries = Array.isArray(o.entries)
    ? (o.entries as unknown[]).map((e) => {
        const r = (e ?? {}) as Record<string, unknown>;
        const rules = Array.isArray(r.decision_rules)
          ? (r.decision_rules as unknown[])
              .map((d) => {
                const dr = (d ?? {}) as Record<string, unknown>;
                if (typeof dr.rule !== "string") return null;
                return typeof dr.condition === "string"
                  ? { rule: dr.rule, condition: dr.condition }
                  : { rule: dr.rule };
              })
              .filter((x): x is { rule: string; condition?: string } => x !== null)
          : [];
        return {
          id: typeof r.id === "string" ? r.id : "",
          title: typeof r.title === "string" ? r.title : null,
          ai_summary: typeof r.ai_summary === "string" ? r.ai_summary : null,
          decision_rules: rules,
          log_type: typeof r.log_type === "string" ? r.log_type : "",
          importance: typeof r.importance === "number" ? r.importance : 0,
          confidence: typeof r.confidence === "number" ? r.confidence : 0,
          score: typeof r.score === "number" ? r.score : 0,
          final: typeof r.final === "number" ? r.final : 0,
          embedding_id: typeof r.embedding_id === "string" ? r.embedding_id : "",
          chunk_index: typeof r.chunk_index === "number" ? r.chunk_index : 0,
          // (d): matched_text（任意）。文字列配列のみ受領・無ければ undefined（後方互換）。
          matched_text: Array.isArray(r.matched_text)
            ? (r.matched_text as unknown[]).filter((t): t is string => typeof t === "string")
            : undefined,
        };
      })
    : [];
  return { outcome, entries };
}

export async function searchKnowledge(
  question: string,
  opts?: { timeoutMs?: number },
): Promise<SearchKnowledgeReturn> {
  const { url, apiKey } = getConfig();
  if (!apiKey) return EMPTY_SEARCH_KNOWLEDGE_RETURN;

  const q = (question ?? "").trim();
  if (!q) return EMPTY_SEARCH_KNOWLEDGE_RETURN;

  const timeoutMs = opts?.timeoutMs ?? SEARCH_KNOWLEDGE_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      // project は渡さない(query_knowledge と同じ理由)
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name: "search_knowledge", arguments: { question: q } },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[knowledge-os] search_knowledge HTTP ${res.status}`);
      return EMPTY_SEARCH_KNOWLEDGE_RETURN;
    }

    const body = (await res.json()) as {
      result?: {
        content?: Array<{ type?: string; text?: string }>;
        _meta?: { request_id?: string };
      };
      error?: { message?: string };
    };

    if (body.error) {
      console.warn("[knowledge-os] search_knowledge RPC error:", body.error.message ?? body.error);
      return EMPTY_SEARCH_KNOWLEDGE_RETURN;
    }

    const requestId = body.result?._meta?.request_id ?? null;

    const text = body.result?.content?.[0]?.text;
    if (!text) {
      console.warn("[knowledge-os] search_knowledge empty content");
      return { result: null, requestId };
    }

    const parsed = normalizeSearchKnowledge(JSON.parse(text) as unknown);
    if (!parsed) {
      console.warn("[knowledge-os] search_knowledge content[0] is not a SearchKnowledgeResult object");
      return { result: null, requestId };
    }
    return { result: parsed, requestId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[knowledge-os] search_knowledge failed:", msg);
    return EMPTY_SEARCH_KNOWLEDGE_RETURN;
  } finally {
    clearTimeout(timeout);
  }
}

// ====================================================================
// ③-c-5b: submit_feedback（KO への返信評価の書き戻し）
// ====================================================================
// query_knowledge/search_knowledge と同じ JSON-RPC tools/call 形。
// KO 側 submit_feedback は app_label をキーから解決するため、ここでは app_label を送らない。
// best-effort: 失敗/タイムアウト/キー未設定/RPC エラーは全て握り潰し { ok:false } を返す（throw しない）。
// 呼び出し側（ai/page.tsx の submitFeedback）は結果を待たない／無視可。会話・feedback 保存に影響させない。

const SUBMIT_FEEDBACK_TIMEOUT_MS = 5000;

export type KoFeedbackRating = "good" | "bad" | "save";

export async function submitFeedback(args: {
  request_id: string;
  rating: KoFeedbackRating;
  note?: string;
}): Promise<{ ok: boolean }> {
  const { url, apiKey } = getConfig();
  if (!apiKey) return { ok: false };
  if (!args.request_id) return { ok: false };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUBMIT_FEEDBACK_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: "submit_feedback",
          arguments: {
            request_id: args.request_id,
            rating: args.rating,
            ...(args.note ? { note: args.note } : {}),
          },
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[knowledge-os] submit_feedback HTTP ${res.status}`);
      return { ok: false };
    }
    const body = (await res.json()) as { error?: { message?: string } };
    if (body.error) {
      console.warn("[knowledge-os] submit_feedback RPC error:", body.error.message ?? body.error);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[knowledge-os] submit_feedback failed:", msg);
    return { ok: false };
  } finally {
    clearTimeout(timeout);
  }
}
