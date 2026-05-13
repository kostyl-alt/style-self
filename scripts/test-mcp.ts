// MCP クライアント単体スモークテスト
// 実行: npx tsx scripts/test-mcp.ts
// 事前: .env.local に KNOWLEDGE_OS_API_KEY が設定されていること & dev server (localhost:3001) 起動済み

import { readFileSync } from "node:fs";
import { join } from "node:path";

// .env.local を素朴に読み込む（next.js 起動時の挙動を模倣）
try {
  const envText = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
} catch {
  // .env.local が無くても続行（環境変数経由で渡される前提）
}

async function main() {
  const { getInfluences, getDecisionRules } = await import("../lib/knowledge-os/client");

  console.log("[test-mcp] URL =", process.env.KNOWLEDGE_OS_URL ?? "http://localhost:3001/api/mcp/rpc");
  console.log("[test-mcp] API key set?", Boolean(process.env.KNOWLEDGE_OS_API_KEY));

  const inf = await getInfluences({ importance_min: 4, limit: 3 });
  console.log("\n[influences]", inf.length, "件");
  for (const i of inf) {
    console.log(`  - ${i.subject_name} (importance=${i.importance}) fusion_essence=${(i.fusion_essence ?? "").slice(0, 60)}…`);
  }

  const rules = await getDecisionRules({ importance_min: 4, limit: 3 });
  console.log("\n[decision rules]", rules.length, "件");
  for (const r of rules) {
    console.log(`  - [imp=${r.importance}] ${r.rule.slice(0, 80)}…`);
  }
}

main().catch((err) => {
  console.error("[test-mcp] FAILED:", err);
  process.exit(1);
});
