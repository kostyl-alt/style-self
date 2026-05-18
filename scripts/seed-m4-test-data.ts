// M4(世界観マッチング)検証用シードデータ投入スクリプト
//
// 【目的】
// M4 マッチが意味を持つには、オーナー(7ed5d391)から見て worldview_tags の
// overlap が階段状に変化する「他人」が必要。本スクリプトは 5 ペルソナ +
// 各 2 投稿(計 10 件)を Supabase に投入する。
//
// 【安全装置(必須・多層)】
// 1. NEXT_PUBLIC_SUPABASE_URL が読めなければ abort
// 2. 環境変数 SEED_OK=true が無ければ abort(うっかり実行防止)
// 3. SUPABASE_SERVICE_ROLE_KEY が読めなければ abort
//
// 【冪等性】
// - 既存ユーザー(同じ deterministic UUID)は skip
// - worldview_profiles / posts は upsert で再実行 OK
//
// 【deterministic UUID(6bd309dd 教訓)】
// - User:  00000000-0000-4000-8000-00000000000{N}     (N=1..5)
// - Post:  00000000-0001-4000-8000-0000000000{N}{P}   (N=1..5, P=1..2)
// - 連続したゼロ + 末尾 1 桁で、本物の UUID と一目で区別可能
//
// 【auth.admin.createUser() に id を渡す】
// - supabase-js v2 の型には id フィールドが無いが、GoTrue admin API は
//   id を受け付ける。型キャストで通す。これにより冪等性も担保される。
//
// 【実行】
//   SEED_OK=true npx tsx scripts/seed-m4-test-data.ts

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
  // .env.local が無くても直接環境変数で動かせるよう続行
}

// ========== 定数 ==========
const OWNER_USER_ID  = "7ed5d391-5e47-40ae-adc5-68464b380a50";
const EMAIL_PREFIX   = "test+seed";
const EMAIL_DOMAIN   = "style-self.local";

// ========== ペルソナ設計(設計セクション 2) ==========
// targetOverlap = アンカー(オーナーの tags)と何個重ねるか
// fillerTags    = アンカーに含まれなければ採用する非アンカー候補
//                 (anchor と被ったら除外して残りで埋める)
interface PersonaSpec {
  idx:               number;
  uuid:              string;
  email:             string;
  displayName:       string;
  worldviewName:     string;
  coreIdentity:      string;
  idealSelf:         string;
  attractedCulture:  string;
  targetOverlap:     number;
  fillerTags:        string[];
  colors:            string[];
  materials:         string[];
  silhouettes:       string[];
  brands:            string[];
  firstPieceName:    string;
  firstPieceKeyword: string;
  bgHex:             string;
  textHex:           string;
}

const PERSONAS: PersonaSpec[] = [
  {
    idx: 1,
    uuid: "00000000-0000-4000-8000-000000000001",
    email: `${EMAIL_PREFIX}1@${EMAIL_DOMAIN}`,
    displayName: "[TEST] Dark Adjacent",
    worldviewName: "退廃を装う観察者",
    coreIdentity: "暗さの中に美を見出す視線で世界と接する",
    idealSelf: "静かに引力を放つ存在",
    attractedCulture: "薄暗い喫茶店、古書、フィルムノワール",
    targetOverlap: 3,
    fillerTags: ["sensual", "romantic"],
    colors: ["ブラック", "チャコール", "ダークレッド"],
    materials: ["ウール", "レザー", "ベルベット"],
    silhouettes: ["Iライン", "ロング丈", "ドレープ"],
    brands: ["Yohji Yamamoto", "Ann Demeulemeester"],
    firstPieceName: "黒のロングコート",
    firstPieceKeyword: "黒ロングコート",
    bgHex: "1a1a1a", textHex: "e6e6e6",
  },
  {
    idx: 2,
    uuid: "00000000-0000-4000-8000-000000000002",
    email: `${EMAIL_PREFIX}2@${EMAIL_DOMAIN}`,
    displayName: "[TEST] Structured Refined",
    worldviewName: "構造で語る大人",
    coreIdentity: "余白と構造で信頼を作る",
    idealSelf: "場の温度を上げる存在",
    attractedCulture: "ECMジャズ、ハネケ、北欧建築",
    targetOverlap: 2,
    fillerTags: ["clean", "structured", "mature"],
    colors: ["黒", "ネイビー", "ライトグレー"],
    materials: ["ハリのあるコットン", "ウール"],
    silhouettes: ["Iライン", "テーラード"],
    brands: ["Theory", "Hyke", "Graphpaper"],
    firstPieceName: "黒のテーラードジャケット",
    firstPieceKeyword: "黒ジャケット",
    bgHex: "2c3540", textHex: "d8dfe8",
  },
  {
    idx: 3,
    uuid: "00000000-0000-4000-8000-000000000003",
    email: `${EMAIL_PREFIX}3@${EMAIL_DOMAIN}`,
    displayName: "[TEST] Quiet Intellectual",
    worldviewName: "静謐な観察者",
    coreIdentity: "佇まいで知性を伝える",
    idealSelf: "言葉を尽くさずとも知性が伝わる人",
    attractedCulture: "Nils Frahm、是枝裕和、白檀",
    targetOverlap: 2,
    fillerTags: ["quiet", "intellectual", "nostalgic"],
    colors: ["オフホワイト", "墨色", "グレージュ"],
    materials: ["コットン", "リネン"],
    silhouettes: ["Iライン", "ゆるやかなドレープ"],
    brands: ["Lemaire", "Comoli", "Margaret Howell"],
    firstPieceName: "白の細番手シャツ",
    firstPieceKeyword: "白シャツ",
    bgHex: "f0ebe0", textHex: "5b5b5b",
  },
  {
    idx: 4,
    uuid: "00000000-0000-4000-8000-000000000004",
    email: `${EMAIL_PREFIX}4@${EMAIL_DOMAIN}`,
    displayName: "[TEST] Edge Experimental",
    worldviewName: "逸脱する作り手",
    coreIdentity: "違和感を残して記憶される",
    idealSelf: "見たことのない服を当たり前に着る人",
    attractedCulture: "ポストパンク、剥がれた壁、現代美術",
    targetOverlap: 1,
    fillerTags: ["raw", "rebellious", "expressive", "sharp"],
    colors: ["くすみオリーブ", "ベージュ", "鈍い赤"],
    materials: ["生成りリネン", "藍染綿", "硬質ナイロン"],
    silhouettes: ["変形Iライン", "アンバランスドレープ"],
    brands: ["Carol Christian Poell", "Boris Bidjan Saberi"],
    firstPieceName: "アシンメトリーのシャツ",
    firstPieceKeyword: "アシメ シャツ",
    bgHex: "453a2c", textHex: "e4d8c2",
  },
  {
    idx: 5,
    uuid: "00000000-0000-4000-8000-000000000005",
    email: `${EMAIL_PREFIX}5@${EMAIL_DOMAIN}`,
    displayName: "[TEST] Soft Natural",
    worldviewName: "やわらかな自然体",
    coreIdentity: "温度のある素材で日常を編む",
    idealSelf: "近づきやすく安心される存在",
    attractedCulture: "縁側、土鍋、Ólafur Arnalds",
    targetOverlap: 0,
    fillerTags: ["soft", "natural", "relaxed", "approachable", "youthful"],
    colors: ["生成り", "オフホワイト", "サンドベージュ"],
    materials: ["ニット", "コットン", "リネン"],
    silhouettes: ["ゆるストレート", "ふんわりA"],
    brands: ["YAECA", "evameva"],
    firstPieceName: "オフホワイトのざっくりニット",
    firstPieceKeyword: "白ニット",
    bgHex: "f7ede0", textHex: "6b5a47",
  },
];

// ========== helpers ==========
function abort(msg: string): never {
  console.error(`[ABORT] ${msg}`);
  process.exit(1);
}

function rotate<T>(arr: T[], offset: number): T[] {
  if (arr.length === 0) return arr;
  const n = ((offset % arr.length) + arr.length) % arr.length;
  return [...arr.slice(n), ...arr.slice(0, n)];
}

// EXTRA_FILLER: targetOverlap が大きく fillerTags が足りない場合の補充候補
// anchor と被らないものから 5 個に達するまで足す
const EXTRA_FILLER = ["soft", "natural", "relaxed", "approachable", "open", "youthful", "expressive", "mysterious", "light"];

function buildPersonaTags(p: PersonaSpec, anchor: string[], orderOffset: number): string[] {
  // anchor から targetOverlap 個(ペルソナごとに違う start で多様性確保)
  const rotated   = rotate(anchor, orderOffset);
  const fromAnchor = rotated.slice(0, p.targetOverlap);

  // filler は anchor と被らないものだけ採用
  const safeFiller = p.fillerTags.filter((t) => !anchor.includes(t));
  const need       = 5 - fromAnchor.length;

  const tags = [...fromAnchor, ...safeFiller.slice(0, need)];

  // 5 個に達するまで EXTRA_FILLER から補充(anchor + 既存と重複しないもの)
  for (const cand of EXTRA_FILLER) {
    if (tags.length >= 5) break;
    if (!tags.includes(cand) && !anchor.includes(cand)) tags.push(cand);
  }

  return tags;
}

// /u/[userId] の pickPublicFields がエラーにならない最小有効な result jsonb
function buildResult(p: PersonaSpec, tags: string[]): Record<string, unknown> {
  return {
    // 必須型項目(空値で型を満たす・public ページでは pickPublicFields が非公開化)
    plainSummary:   `[TEST] ${p.worldviewName} のサンプル診断結果(M4 検証用)`,
    coreIdentity:   p.coreIdentity,
    whyThisResult:  "[TEST] テスト用シードデータ",
    styleStructure: {},
    inputMapping:   [],
    avoid:          [],
    actionPlan:     [],
    nextBuyingRule: [],
    styleAxis:      { beliefKeywords: [] },

    // 公開フィールド(/u/[id] で表示される)
    worldview_tags:     tags,                  // ★ M4 マッチ用
    worldview_keywords: [p.worldviewName],
    worldviewName:      p.worldviewName,
    idealSelf:          p.idealSelf,
    attractedCulture:   p.attractedCulture,
    recommendedColors:      p.colors,
    recommendedMaterials:   p.materials,
    recommendedSilhouettes: p.silhouettes,
    recommendedBrands:      p.brands,
    firstPiece: {
      name:        p.firstPieceName,
      zozoKeyword: p.firstPieceKeyword,
      why:         "[TEST] サンプル理由",
    },
  };
}

// auth.admin.createUser() に id を渡すための型回避
// supabase-js v2 型は id を露出しないが、GoTrue admin API は受け付ける
type CreateUserAttrs = {
  id?:            string;
  email?:         string;
  password?:      string;
  email_confirm?: boolean;
};

async function ensureAuthUser(supabase: SupabaseClient, p: PersonaSpec): Promise<"skip" | "created" | "error"> {
  // 既存確認(deterministic UUID で getUserById)
  const { data: existing } = await supabase.auth.admin.getUserById(p.uuid);
  if (existing?.user) return "skip";

  const attrs: CreateUserAttrs = {
    id:            p.uuid,
    email:         p.email,
    password:      `seed-not-real-${p.idx}-do-not-use`,
    email_confirm: true,
  };
  const { error } = await supabase.auth.admin.createUser(
    attrs as Parameters<typeof supabase.auth.admin.createUser>[0]
  );
  if (error) {
    console.warn(`    create エラー(${p.email}): ${error.message}`);
    return "error";
  }
  return "created";
}

// ========== main ==========
(async () => {
  console.log("=== M4 検証用シードデータ投入 ===\n");

  // 【1】安全装置
  console.log("【1】安全装置チェック");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url) abort("NEXT_PUBLIC_SUPABASE_URL が読めない(.env.local を確認)");
  if (process.env.SEED_OK !== "true") abort("環境変数 SEED_OK=true が未設定。実行する場合は明示的に SEED_OK=true を付ける(うっかり実行防止)");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) abort("SUPABASE_SERVICE_ROLE_KEY が読めない(.env.local を確認)");
  console.log(`  SUPABASE_URL  : ${url}`);
  console.log(`  SEED_OK       : true`);
  console.log(`  service_role  : 読み込み済み\n`);

  const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // 【2】アンカー取得
  console.log("【2】オーナーアンカー取得");
  const { data: anchorRow, error: anchorErr } = await supabase
    .from("worldview_profiles")
    .select("result")
    .eq("user_id", OWNER_USER_ID)
    .maybeSingle() as unknown as {
      data: { result: { worldview_tags?: unknown } | null } | null;
      error: { message: string } | null;
    };
  if (anchorErr)        abort(`アンカー取得エラー: ${anchorErr.message}`);
  if (!anchorRow)       abort(`worldview_profiles 行なし(user_id=${OWNER_USER_ID})。先にオーナーが診断完了する必要があります。`);
  if (!anchorRow.result) abort("worldview_profiles.result が null。先にオーナーが診断完了する必要があります。");

  const rawTags = anchorRow.result.worldview_tags;
  if (!Array.isArray(rawTags) || rawTags.length === 0) {
    abort("worldview_profiles.result.worldview_tags が空。先にオーナーが診断完了する必要があります。");
  }
  const anchor = rawTags.filter((t): t is string => typeof t === "string");
  if (anchor.length === 0) abort("worldview_tags に有効な文字列がない。");

  console.log(`  アンカー(${OWNER_USER_ID.slice(0, 8)}…): [${anchor.join(", ")}] (${anchor.length} 個)\n`);

  // 【3】ペルソナ tags 構築
  console.log("【3】ペルソナ tags 構築");
  const computed = PERSONAS.map((p, i) => {
    const tags = buildPersonaTags(p, anchor, i * 2);
    const actualOverlap = tags.filter((t) => anchor.includes(t)).length;
    return { ...p, tags, actualOverlap };
  });
  for (const c of computed) {
    console.log(`  ${c.idx} ${c.displayName} (target=${c.targetOverlap} / actual=${c.actualOverlap})`);
    console.log(`     tags: [${c.tags.join(", ")}]`);
  }
  console.log();

  // 【4】auth.users 作成
  console.log("【4】auth.users 作成 / 既存 skip");
  for (const c of computed) {
    const status = await ensureAuthUser(supabase, c);
    console.log(`  ${c.idx} ${status}: ${c.email}`);
  }
  console.log();

  // 【5】public.users.display_name 設定
  console.log("【5】public.users.display_name 設定");
  for (const c of computed) {
    const { error } = await supabase
      .from("users")
      .update({ display_name: c.displayName } as never)
      .eq("id", c.uuid);
    if (error) console.warn(`  ${c.idx} エラー: ${error.message}`);
    else       console.log(`  ${c.idx} ${c.displayName}`);
  }
  console.log();

  // 【6】worldview_profiles upsert
  console.log("【6】worldview_profiles upsert(is_public=true)");
  for (const c of computed) {
    const result = buildResult(c, c.tags);
    const { error } = await supabase
      .from("worldview_profiles")
      .upsert({
        user_id:      c.uuid,
        pattern_id:   null,
        pattern_name: c.worldviewName,
        result:       result,
        is_public:    true,
        updated_at:   new Date().toISOString(),
      } as never, { onConflict: "user_id" });
    if (error) console.warn(`  ${c.idx} エラー: ${error.message}`);
    else       console.log(`  ${c.idx} ${c.worldviewName} (tags=${c.tags.length})`);
  }
  console.log();

  // 【7】posts INSERT(各 persona × 2 件・upsert で冪等)
  console.log("【7】posts upsert(各2件・is_public=true)");
  for (const c of computed) {
    for (let postNum = 1; postNum <= 2; postNum++) {
      const postId   = `00000000-0001-4000-8000-0000000000${c.idx}${postNum}`;
      const label    = c.displayName.replace("[TEST] ", "");
      const imageUrl = `https://placehold.co/600x600/${c.bgHex}/${c.textHex}?text=${encodeURIComponent(label)}+${postNum}`;
      const caption  = `[TEST] ${c.worldviewName} - sample ${postNum}`;

      const { error } = await supabase
        .from("posts")
        .upsert({
          id:                 postId,
          author_user_id:     c.uuid,
          image_url:          imageUrl,
          caption,
          worldview_tags:     c.tags,
          worldview_keywords: [c.worldviewName],
          worldview_name:     c.worldviewName,
          pattern_id:         null,
          is_public:          true,
        } as never, { onConflict: "id" });
      if (error) console.warn(`  ${c.idx}-${postNum} エラー: ${error.message}`);
      else       console.log(`  ${c.idx}-${postNum} ${postId}`);
    }
  }
  console.log();

  // 【8】投入結果サマリ
  console.log("=== 投入結果サマリ ===");
  console.log(`  テストユーザー: 5 人(00000000-0000-4000-8000-00000000000{1..5})`);
  console.log(`  テスト投稿:     10 件(00000000-0001-4000-8000-0000000000{N}{P})`);
  console.log(`  アンカー基準 overlap 分布:`);
  for (const c of computed) {
    console.log(`    ${c.displayName.padEnd(28)}  target=${c.targetOverlap}  actual=${c.actualOverlap}  tags=[${c.tags.join(", ")}]`);
  }
  console.log();
  console.log("→ 台帳:     docs/M4_test_data_ledger.md");
  console.log("→ 後片付け: TEARDOWN_OK=true npx tsx scripts/teardown-m4-test-data.ts");
})().catch((e: unknown) => {
  console.error("[FATAL]", e instanceof Error ? e.message : e);
  process.exit(1);
});
