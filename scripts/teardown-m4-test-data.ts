// M4 検証用シードデータ 後片付けスクリプト
//
// 【目的】
// scripts/seed-m4-test-data.ts で投入したテストデータ(auth.users +
// public.users + worldview_profiles + posts)を完全に削除する。
// 残骸ゼロを目標とし、結果をログで検証する。
//
// 【削除戦略】
// auth.admin.deleteUser() → FK on delete cascade で連鎖削除:
//   auth.users
//     → public.users(001: id references auth.users on delete cascade)
//       → posts.author_user_id (024: on delete cascade)
//       → worldview_profiles.user_id (020: on delete cascade)
//       → diagnosis_sessions / user_style_events 等(同上)
//
// 【冪等性】対象 0 件でもエラーにせず正常終了
//
// 【安全装置(必須・多層)】
// 1. NEXT_PUBLIC_SUPABASE_URL が読めなければ abort
// 2. 環境変数 TEARDOWN_OK=true が無ければ abort
// 3. SUPABASE_SERVICE_ROLE_KEY が読めなければ abort
//
// 【実行】
//   TEARDOWN_OK=true npx tsx scripts/teardown-m4-test-data.ts

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

const EMAIL_PREFIX = "test+seed";
const EMAIL_DOMAIN = "style-self.local";

function abort(msg: string): never {
  console.error(`[ABORT] ${msg}`);
  process.exit(1);
}

function isTestEmail(email: string | undefined): boolean {
  if (!email) return false;
  return email.startsWith(EMAIL_PREFIX) && email.endsWith(`@${EMAIL_DOMAIN}`);
}

(async () => {
  console.log("=== M4 検証用シードデータ 後片付け ===\n");

  // 【1】安全装置
  console.log("【1】安全装置チェック");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url) abort("NEXT_PUBLIC_SUPABASE_URL が読めない");
  if (process.env.TEARDOWN_OK !== "true") abort("環境変数 TEARDOWN_OK=true が未設定。明示フラグ必須(うっかり実行防止)");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) abort("SUPABASE_SERVICE_ROLE_KEY が読めない");
  console.log(`  SUPABASE_URL  : ${url}`);
  console.log(`  TEARDOWN_OK   : true`);
  console.log(`  service_role  : 読み込み済み\n`);

  const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // 【2】削除対象を確認
  console.log("【2】削除対象確認");
  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (listErr) abort(`listUsers エラー: ${listErr.message}`);

  const testUsers = (listData?.users ?? []).filter((u) => isTestEmail(u.email));

  console.log(`  対象 auth.users: ${testUsers.length} 件`);
  for (const u of testUsers) {
    console.log(`    ${u.id} / ${u.email}`);
  }

  if (testUsers.length === 0) {
    console.log("\n→ 対象なし(既に片付け済みか、未投入)。終了。");
    return;
  }

  const userIds = testUsers.map((u) => u.id);

  // 関連件数
  const { count: postBefore } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .in("author_user_id", userIds);
  const { count: profBefore } = await supabase
    .from("worldview_profiles")
    .select("*", { count: "exact", head: true })
    .in("user_id", userIds);

  console.log(`  関連 posts:              ${postBefore ?? 0} 件`);
  console.log(`  関連 worldview_profiles: ${profBefore ?? 0} 件\n`);

  // 【3】削除実行(CASCADE)
  console.log("【3】削除実行(auth.users から CASCADE 連鎖)");
  for (const u of testUsers) {
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (error) console.warn(`  delete エラー: ${u.id} / ${error.message}`);
    else       console.log(`  deleted: ${u.id} (${u.email})`);
  }
  console.log();

  // 【4】残骸チェック
  console.log("【4】残骸チェック(全て 0 になることが期待)");

  const { data: listAfter } = await supabase.auth.admin.listUsers({ perPage: 200 });
  const authRemain = (listAfter?.users ?? []).filter((u) => isTestEmail(u.email)).length;

  const { count: usersRemain } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .in("id", userIds);
  const { count: postRemain } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .in("author_user_id", userIds);
  const { count: profRemain } = await supabase
    .from("worldview_profiles")
    .select("*", { count: "exact", head: true })
    .in("user_id", userIds);

  console.log(`  auth.users 残:         ${authRemain}`);
  console.log(`  public.users 残:       ${usersRemain ?? 0}`);
  console.log(`  posts 残:              ${postRemain ?? 0}`);
  console.log(`  worldview_profiles 残: ${profRemain ?? 0}`);

  const allClean = authRemain === 0 && (usersRemain ?? 0) === 0 && (postRemain ?? 0) === 0 && (profRemain ?? 0) === 0;
  if (allClean) {
    console.log("\n→ 残骸なし。後片付け完了。");
  } else {
    console.log("\n⚠ 残骸あり。手動確認が必要(Supabase Studio で auth.users / public.users / posts / worldview_profiles を確認)。");
    process.exit(1);
  }
})().catch((e: unknown) => {
  console.error("[FATAL]", e instanceof Error ? e.message : e);
  process.exit(1);
});
