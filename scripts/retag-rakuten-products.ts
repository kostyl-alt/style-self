// M5-4a: 楽天商品 coreTags 後付けスクリプト
//
// 【目的】
// sync-rakuten で取り込んだが worldview_tags='{}' のままになっている楽天商品に対し、
// AI(Haiku 4.5)で coreTags(31 語辞書から最大 5 個)を抽出し UPDATE で付与する。
// M5-1 で確定:楽天 83 件 / worldview_tags 空 / 付与率 3.4% の二重構造を解消し、
// M5-3 の worldview スコアが楽天商品にも当たるようにする。
//
// 【安全装置(必須・4 重・うっかり実行防止)】
// 1. NEXT_PUBLIC_SUPABASE_URL 必須
// 2. SUPABASE_SERVICE_ROLE_KEY 必須(AI 呼出 + DB UPDATE のため)
// 3. RAKUTEN_AI_TAG_OK=true 必須(AI コスト発生工程・明示フラグ)
// 4. ANTHROPIC_API_KEY 必須
//
// 【冪等・対象限定】
// - source='rakuten' AND (worldview_tags = '{}' OR array_length(worldview_tags, 1) IS NULL)
// - 既に付与済の行はスキップ(再実行で二重付与しない)
// - manual 3 件(M5-2 で正規化済)は構造的に対象外
//
// 【失敗時の挙動】
// - 1 件失敗は errors[] に積んで継続(個別 UPDATE なので途中失敗で巻き戻らない)
// - AI 抽出失敗時(ネットワーク/JSON 解析エラー等)は worldview_tags=空のまま放置
//   (次回再実行で再挑戦できる=冪等)
//
// 【dryRun モード】
// --dry-run 引数で最初の 5 件のみ・UPDATE せず console.log のみ。
// 抽出品質を本実行前に目視確認するため。
//
// 【コスト見積もり(M5-4 調査・Haiku 4.5)】
// 1 商品 ≒ $0.001 / 83 件 ≒ ¥13 / レート制限 300ms sleep
//
// 【実行】
//   dryRun(5 件確認):
//     RAKUTEN_AI_TAG_OK=true npx tsx scripts/retag-rakuten-products.ts --dry-run
//   本実行:
//     RAKUTEN_AI_TAG_OK=true npx tsx scripts/retag-rakuten-products.ts

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { callClaudeJSON, HAIKU_MODEL } from "@/lib/claude";
import {
  EXTRACT_PRODUCT_CORETAGS_PROMPT,
  buildProductCoretagsUserMessage,
} from "@/lib/prompts/extract-product-coretags";
import { PRODUCT_WORLDVIEW_TAGS } from "@/lib/knowledge/product-worldview-tags";

// ========== .env.local 読み込み ==========
try {
  const envText = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
} catch {
  // 環境変数で直接渡しても動くよう続行
}

// ========== 定数 ==========
const RATE_LIMIT_SLEEP_MS = 300; // 既存 sync-rakuten 同等
const DRY_RUN_LIMIT       = 5;
const ALLOWED_TAGS = new Set<string>(PRODUCT_WORLDVIEW_TAGS);

interface ProductRow {
  id:       string;
  name:     string;
  brand:    string | null;
  // 楽天 sync は caption を別フィールドで保持しない・name のみだが、
  // 念のため将来カラム化されても拾えるよう any 経由で拾わない設計。
  // 現状は name+brand のみ AI に渡す。
}

function abort(msg: string): never {
  console.error(`[ABORT] ${msg}`);
  process.exit(1);
}

async function extractCoreTags(product: ProductRow): Promise<string[]> {
  const userMessage = buildProductCoretagsUserMessage({
    name:    product.name,
    brand:   product.brand,
    caption: null, // 楽天 sync は caption を DB に持たないため未使用
  });
  const raw = await callClaudeJSON<{ coreTags?: unknown }>({
    systemPrompt: EXTRACT_PRODUCT_CORETAGS_PROMPT,
    userMessage,
    model:        HAIKU_MODEL,
    maxTokens:    256,
  });

  // 辞書外の語をフィルタで弾く(プロンプト指示があってもモデルが逸脱する可能性に備えた防御)
  const arr = Array.isArray(raw.coreTags)
    ? raw.coreTags.filter((t): t is string => typeof t === "string" && ALLOWED_TAGS.has(t))
    : [];
  return arr.slice(0, 5);
}

(async () => {
  const dryRun = process.argv.includes("--dry-run");

  console.log("=== M5-4a 楽天商品 coreTags 後付け ===\n");

  // 【1】安全装置
  console.log("【1】安全装置チェック");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url) abort("NEXT_PUBLIC_SUPABASE_URL が読めない(.env.local を確認)");
  if (process.env.RAKUTEN_AI_TAG_OK !== "true") {
    abort("環境変数 RAKUTEN_AI_TAG_OK=true が未設定(AI コスト発生工程・うっかり実行防止)");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) abort("SUPABASE_SERVICE_ROLE_KEY が読めない");
  if (!process.env.ANTHROPIC_API_KEY)         abort("ANTHROPIC_API_KEY が読めない");
  console.log(`  SUPABASE_URL       : ${url}`);
  console.log(`  RAKUTEN_AI_TAG_OK  : true`);
  console.log(`  service_role       : 読み込み済み`);
  console.log(`  ANTHROPIC_API_KEY  : 読み込み済み`);
  console.log(`  mode               : ${dryRun ? "DRY-RUN(最初の5件のみ・UPDATE せず)" : "本実行"}\n`);

  const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // 【2】対象抽出(冪等条件: source='rakuten' AND worldview_tags 空)
  console.log("【2】対象抽出");
  const { data: candidatesRaw, error: selectErr } = await supabase
    .from("external_products")
    .select("id, name, brand, worldview_tags")
    .eq("source", "rakuten")
    .order("synced_at", { ascending: false }) as unknown as {
      data: Array<{ id: string; name: string; brand: string | null; worldview_tags: string[] | null }> | null;
      error: { message: string } | null;
    };
  if (selectErr) abort(`SELECT エラー: ${selectErr.message}`);

  // PostgREST の text[] の「空配列」表現を吸収して JS 側でフィルタ(== '{}' は SQL 限定の表現)
  const targets = (candidatesRaw ?? []).filter(
    (r) => !Array.isArray(r.worldview_tags) || r.worldview_tags.length === 0,
  );

  console.log(`  source=rakuten 全件: ${candidatesRaw?.length ?? 0}`);
  console.log(`  うち worldview_tags 空(=対象): ${targets.length}`);
  if (targets.length === 0) {
    console.log("\n→ 対象なし(既に全件 coreTags 付与済)。終了。");
    return;
  }

  const workSet = dryRun ? targets.slice(0, DRY_RUN_LIMIT) : targets;
  console.log(`  今回処理: ${workSet.length} 件${dryRun ? "(dry-run 上限 5)" : ""}\n`);

  // 【3】各商品で Haiku 呼出 + UPDATE
  console.log("【3】Haiku で coreTags 抽出 + UPDATE");
  let success = 0;
  const errors: string[] = [];
  for (let i = 0; i < workSet.length; i++) {
    const p = workSet[i];
    const idx = i + 1;
    try {
      const tags = await extractCoreTags(p);
      console.log(`  ${idx}/${workSet.length} [${p.id.slice(0, 8)}…] ${p.name.slice(0, 40)} → [${tags.join(", ")}]`);

      if (!dryRun && tags.length > 0) {
        const { error: updErr } = await supabase
          .from("external_products")
          .update({ worldview_tags: tags } as never)
          .eq("id", p.id)
          .eq("source", "rakuten");        // 二重防御:source 限定で manual を絶対巻き込まない
        if (updErr) {
          errors.push(`${p.id}: UPDATE ${updErr.message}`);
          continue;
        }
      }
      success++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${p.id}: ${msg}`);
      console.warn(`  ${idx}/${workSet.length} [${p.id.slice(0, 8)}…] エラー: ${msg}`);
    }

    // レート制限(既存 sync-rakuten 同等)
    if (i < workSet.length - 1) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_SLEEP_MS));
    }
  }

  // 【4】サマリ
  console.log("\n=== 結果サマリ ===");
  console.log(`  処理:   ${workSet.length}`);
  console.log(`  成功:   ${success}`);
  console.log(`  失敗:   ${errors.length}`);
  if (errors.length > 0) {
    console.log(`  --- エラー詳細 ---`);
    for (const e of errors) console.log(`    ${e}`);
  }
  if (dryRun) {
    console.log(`\n→ DRY-RUN 終了(UPDATE していない)。本実行は --dry-run を外して再実行。`);
  } else {
    console.log(`\n→ 本実行完了。Supabase Studio で SQL 確認:`);
    console.log(`   select count(*) filter (where array_length(worldview_tags,1)>0)*100.0/count(*) as pct`);
    console.log(`   from public.external_products where source='rakuten';`);
  }
})().catch((e: unknown) => {
  console.error("[FATAL]", e instanceof Error ? e.message : e);
  process.exit(1);
});
