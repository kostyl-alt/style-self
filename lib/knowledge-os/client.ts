// Knowledge OS への JSON-RPC クライアント（PoC: 影響源・判断ルールの参照のみ）
//
// Knowledge OS の MCP RPC エンドポイント仕様:
//   POST {KNOWLEDGE_OS_URL}
//   Authorization: Bearer {KNOWLEDGE_OS_API_KEY}
//   body: { jsonrpc:"2.0", id, method:"tools/call", params:{ name, arguments } }
//   response.result.content[0].text に JSON 配列の文字列が入る（add3bea 以降）

const DEFAULT_URL = "http://localhost:3001/api/mcp/rpc";
const TIMEOUT_MS = 5000;

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

async function callToolCached<T>(name: string, args: Record<string, unknown>): Promise<T[]> {
  const key = cacheKey(name, args);
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && hit.expiresAt > now) {
    // slice で配列の浅いコピーを返す(呼び出し側 filter/map で長さを変えても安全)。
    // 配列要素のオブジェクトは共有なので、呼び出し側はオブジェクトをミューテートしない約束。
    return (hit.data as T[]).slice();
  }
  const fresh = await callTool<T>(name, args);
  cache.set(key, { data: fresh, expiresAt: now + CACHE_TTL_MS });
  return fresh.slice();
}

async function callTool<T>(name: string, args: Record<string, unknown>): Promise<T[]> {
  const { url, apiKey } = getConfig();
  if (!apiKey) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

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

export async function getInfluences(args: GetInfluencesArgs = {}): Promise<InfluenceData[]> {
  return callToolCached<InfluenceData>("get_influences", args as Record<string, unknown>);
}

export async function getDecisionRules(args: GetDecisionRulesArgs = {}): Promise<DecisionRule[]> {
  return callToolCached<DecisionRule>("get_decision_rules", args as Record<string, unknown>);
}

export async function getCategories(args: GetCategoriesArgs = {}): Promise<CategoryData[]> {
  return callToolCached<CategoryData>("get_categories", args as Record<string, unknown>);
}
