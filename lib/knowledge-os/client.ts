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
  importance_min?: number;
  limit?: number;
}

interface GetDecisionRulesArgs {
  project?: string;
  importance_min?: number;
  min_confidence?: number;
  limit?: number;
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
  return callTool<InfluenceData>("get_influences", args as Record<string, unknown>);
}

export async function getDecisionRules(args: GetDecisionRulesArgs = {}): Promise<DecisionRule[]> {
  return callTool<DecisionRule>("get_decision_rules", args as Record<string, unknown>);
}
