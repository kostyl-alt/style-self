# STYLE-SELF D1 — A-6b brand-learn intent 設計調査(MVP-1c 残 5 intent 第 2 弾)

- 作成日: 2026-05-23
- 起点 HEAD: `626b57d`(A-6 style-consult 実装完了・`origin/main` 整合・clean)
- 本 doc の役割: A-6b 着手前の **静的解析中心の設計調査**(本体・コード・他 doc 0 変更)
- 上位連結:
  - ロードマップ [§3.6](./STYLE-SELF_D1_ビジョン完全達成_ロードマップ.md)
  - A-6 style-consult 実装(`626b57d`)で確立した **4 作法** を完全踏襲(段階 A 修正 / MVP-1c fetcher / A-4 三重防御 / A-10 KOS 共通注入)
- 実装方針: **既存 v1 `/api/brands/list` + `/api/brands/recommend` API は無変更**(本 A-6b は段階 B `stylist-chat` への brand-learn 追加のみ)

---

## 1. 背景

### 1.1 ビジョン的位置づけ
- 最終ビジョン `df36d82` で示される対話型 reply:
  - 「特定ブランドについて教えて」(汎用ブランド情報)
  - 「自分の世界観に合うブランドを知りたい」(マッチング)
  - 「ダーク・コンセプチュアルな美学を学びたい」(美学起点)
  - 「ブランド分析」「センスある画像の分析」型(本体 doc7 思想)
- A-10 完遂(`566e3b2`)で **Knowledge OS 共通注入** が確立 → brand-learn では特に `getInfluences` が活きる(★ A-10 で 3 関数中 1 関数のみ未使用)

### 1.2 A-6 style-consult 完遂(`626b57d`)後の論理順
- A-6 で確立した 4 作法:
  1. 段階 A 修正(`2ef689e`)= description 精緻化 + 境界判定ブロック更新
  2. MVP-1c(`182c25b`)= `fetchXxxContext` を `Promise.all` 並列で組立
  3. A-4(`66dd5bb`)= 三重防御 (1) 列絞り SELECT を新規 fetcher で同型再適用
  4. A-10(`566e3b2`)= KOS 共通注入で追加実装ゼロで知識ベース連携
- ★ A-6b はこの **4 作法をそのまま brand-learn にも適用**(本セッションで A-6 が雛形)

### 1.3 不可侵境界線
1-8: 既存 8 条 + ★ **既存 v1 `/api/brands/list` + `/api/brands/recommend` API + `ConsultTab`/`BrandRecommend` UI は 無変更**

---

## 2. 現状実装サマリ(静的解析)

### 2.1 段階 A `lib/prompts/overlay-intent.ts` brand-learn 現状
- 行 35: `- brand-learn         : ブランドについて学びたい・ブランド推薦が欲しい`
- 行 36: `- culture             : 世界観に合う音楽・映画・カルチャーを知りたい`(★ 隣接 intent・境界要明示)
- 行 33: `- inspiration         : 抽象語・テーマからインスピレーションを得たい`(★ もう一つの隣接)
- 行 57: mode マッピング = `api`
- ★ **境界判定ブロック未保有**(A-6 で coordinate / style-consult / virtual-coordinate / tryon の 4 種ブロックはあるが、brand-learn / culture / inspiration の 3 種は未整理)

### 2.2 段階 B `STYLIST_CHAT_INTENTS` 現状(A-6 完了時 = 4 intent)
- `app/api/ai/stylist-chat/route.ts:60`:
  ```typescript
  const STYLIST_CHAT_INTENTS = new Set<string>(["diagnose", "closet", "coordinate", "style-consult"]);
  ```
- A-6b で **`"brand-learn"` を追加 → 5 intent 化**

### 2.3 既存 v1 ブランド系 API(★ A-6b では無変更・参考)

| API | 用途 | データソース | A-6b 影響 |
|---|---|---|---|
| `GET /api/brands/list` | 全 brands を Service Role で取得(20 件 seed) | `brands` テーブル `worldview_tags, era_tags, maniac_level, price_range` 等 11 列絞り SELECT | **無変更** |
| `POST /api/brands/recommend` | ユーザー診断結果 → 5 件マッチング JSON | `brands` 全件 + `users.style_preference` + `users.style_analysis` | **無変更** |
| `lib/prompts/brand-recommend.ts` | v1 system prompt(構造化 JSON 出力指示)| — | **無変更** |
| `components/BrandCard.tsx` | ブランド推薦カード UI | — | **無変更** |

### 2.4 `brands` DB スキーマ(`009_brands.sql`)
- 11 列: `id, name, name_ja, country, city, description, worldview_tags text[], taste_tags text[], era_tags text[], scene_tags text[], price_range, maniac_level, official_url, instagram_url, is_active, created_at`
- ★ **`worldview_tags` は日本語タグ**(例: `['黒', '解体', '哲学', '反抗', '余白']`)・`PRODUCT_WORLDVIEW_TAGS` 31 英語スラッグとは **別の語彙体系**
- ★ `stripCanonicalSlugs` 適用しても日本語タグは一切影響を受けない(構造的安全)
- 20 件 seed(Yohji Yamamoto / Auralee 等・公開読み取り可・RLS `using (true)`)

### 2.5 Knowledge OS `getInfluences` API(A-10 で公開済・未使用の 1 関数)
- `lib/knowledge-os/client.ts:185-187` `getInfluences(args) → InfluenceData[]`
- 戻り値 `InfluenceData`(行 27-41):
  - `subject_name`(string)、`subject_summary?`、`fusion_essence?`
  - `influences?: Partial<Record<InfluenceCategory, string[]>>` — 10 カテゴリ(art / color / music / culture / fashion / material / worldview / philosophy / silhouette / performance)の日本語影響源リスト
  - `influence_decision_rules?: unknown[]`
  - `importance?, category_id?, category_slug?, category_name?`
- ★ **`worldview_tags` フィールド ★ 含まれない**(getFashionRules と違って構造的に安全)
- 既存利用: `app/api/ai/analyze-v2/route.ts:116`(20-30 件取得 → 世界観診断の影響源比較)/ `app/api/ai/analyze/route.ts:160`(5 件取得 → ライト診断)

### 2.6 `inspiration` intent との分離(★ 別 intent・別データ)
- `app/api/inspirations/route.ts` あり(Sprint 21・偉大な参照コンテンツ designer / look / artwork / film / book を返す)
- 本 A-6b では **inspiration intent は対象外**(将来別 Sprint で同形投入可能)

---

## 3. brand-learn の本質と境界判定

### 3.1 用途分類

| 発話例 | 想定 intent | 判定キー |
|---|---|---|
| 「Yohji Yamamoto について教えて」 | brand-learn | 固有ブランド名 + 学習意図 |
| 「コム・デ・ギャルソンの世界観を知りたい」 | brand-learn | 「世界観」+ ブランド名 |
| 「自分の世界観に合うブランドを知りたい」 | brand-learn | ブランド推薦要求 |
| 「ダークでアバンギャルドな美学を学びたい」 | brand-learn | 美学キーワード(アバンギャルド / ダーク 等)|
| 「ジードラゴンに影響を受けたファッションを知りたい」 | brand-learn(or culture?) | 人物影響源 → 境界微妙・推奨 brand-learn |
| 「黒い世界観の音楽を教えて」 | culture | 音楽・映画キーワード |
| 「『静けさ』をテーマにコーデのインスピが欲しい」 | inspiration | 抽象テーマ + コーデ |

### 3.2 段階 A プロンプト境界判定方針(★ A-6 §3.2 拡張)
A-6 で追加した境界判定ブロックの **後ろに brand-learn / culture / inspiration の境界行を追加**:

```
[★ brand-learn / culture / inspiration 境界判定ルール(A-6b 追加)]
1. ブランド名 / デザイナー名 / 美学キーワード(アバンギャルド・ミニマル・デコンストラクション 等)+ 学習意図 → brand-learn
2. 音楽 / 映画 / アート / カルチャー文脈の学習 → culture
3. 抽象テーマ(「静けさ」「余白」等)起点でコーデのアイデア要求 → inspiration

★ 重要 (A-6b): 「自分の世界観に合うブランドを知りたい」「○○ブランドは自分に合う?」は brand-learn(マッチング型)。ブランドが特定されておらず雰囲気だけが指定された場合(「黒系のブランドを教えて」)も brand-learn に分類する。
```

### 3.3 段階 A description 精緻化案(行 35)

現行: `- brand-learn         : ブランドについて学びたい・ブランド推薦が欲しい`
↓
案: `- brand-learn         : ブランド・デザイナー・美学(アバンギャルド/ミニマル/デコンストラクション等)の学習 + 自分の世界観との相性確認・推薦`
              `例:「Yohji Yamamoto について教えて」「自分の世界観に合うブランドを知りたい」「ダーク・コンセプチュアルな美学を学びたい」「○○ブランドは自分に合う?」`

---

## 4. fetchBrandLearnContext 設計

### 4.1 データソース(★ A-6 fetchStyleConsultContext と同形 + brands + getInfluences 追加)

| ソース | 取得列 | 三重防御 (1) | A-6b 採用判断 |
|---|---|---|---|
| `worldview_profiles.result` | `name,keywords,core,ideal`(jsonb 列絞り) | ✅ | ★ 採用(本人の世界観で接点提案)|
| `brands` テーブル | `id, name, name_ja, country, description, worldview_tags, taste_tags, era_tags, maniac_level, price_range, official_url`(11 列絞り)| ✅(日本語タグなので 31 語フィルタとは無関係) | ★ 採用(curated 20 件・LLM が候補比較で使う) |
| Knowledge OS `getInfluences` | `{ limit: 15 }` で 15 件取得 | ✅(getInfluences は worldview_tags 含まない構造) | ★ 採用(A-10 未使用の関数活用)|
| Knowledge OS `getDecisionRules` + `getFailurePatterns` | A-10 共通注入 | ✅ 入口/出口 二段 sanitize | ★ そのまま流用(追加実装不要)|
| dictionaries | A-10 共通注入(発話マッチ) | ✅ | ★ そのまま流用 |

### 4.2 読まないソース(★ A-6 と同じ判断・コスト削減)

| ソース | 理由 |
|---|---|
| `wardrobe_items` | brand-learn は手持ち服に依存しない学習型相談 |
| `users.body_profile` | 体型起点のブランド相談ではない(将来別 intent 等で対応)|
| `users.style_preference` | 任意採用(★ 縮小案で省略可)・好みはあるとブランド相性提案精度↑ |
| `ai_history` | L3 sessionIntent + N=3 history で会話継続性は十分 |

### 4.3 実装案(★ A-6 と同形 `Promise.all`)

```typescript
async function fetchBrandLearnContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<StylistChatContext> {
  const [diagCtx, brandsRow, prefRow] = await Promise.all([
    fetchDiagnoseContext(supabase, userId),
    supabase
      .from("brands")
      .select("name, name_ja, country, description, worldview_tags, taste_tags, era_tags, maniac_level, price_range")
      .eq("is_active", true)
      .order("maniac_level", { ascending: false }) as unknown as Promise<{ data: BrandSummaryRow[] | null }>,
    supabase
      .from("users")
      .select("style_preference")
      .eq("id", userId)
      .maybeSingle() as unknown as Promise<{ data: { style_preference: unknown } | null }>,
  ]);
  return {
    worldviewName:     diagCtx.worldviewName,
    worldviewKeywords: diagCtx.worldviewKeywords,
    coreIdentity:      diagCtx.coreIdentity,
    idealSelf:         diagCtx.idealSelf,
    stylePreference:   extractStylePreference(prefRow?.data?.style_preference),
    brandsCurated:     summarizeBrands(brandsRow?.data ?? []),   // ★ A-6b 新規(最大 12 件・description 80 字 truncate)
  };
}
```

- `brandsCurated` は LLM のトークン消費を抑えるため **最大 12 件**(maniac_level 順)・各 description は 80 字 truncate
- `getInfluences` は **`fetchKnowledgeOSContext` 側に統合**(A-10 拡張・3 関数並列フェッチに昇格)→ §5

### 4.4 `StylistChatContext` 型拡張

```typescript
export interface StylistChatContext {
  // 既存 5 セクション(diagnose / closet / coordinate / style-consult)...
  // A-6b 新規(brand-learn 用)
  brandsCurated?: Array<{
    name:        string;
    nameJa?:     string | null;
    country?:    string | null;
    description: string;     // 80 字 truncate
    worldviewTags: string[]; // 日本語タグ・PRODUCT_WORLDVIEW_TAGS とは別語彙
    eraTags:      string[];
    maniacLevel:  number;
    priceRange:   string;
  }>;
  // A-10 knowledgeOS.influences を ★ A-6b で追加(getInfluences の戻り値を簡略化)
  // → §5.2 参照(StylistChatContext.knowledgeOS.influences を追加)
}
```

---

## 5. Knowledge OS getInfluences 統合方針(★ A-10 fetchKnowledgeOSContext 拡張)

### 5.1 推奨案 = A-10 共通注入の自然拡張
- A-10 `fetchKnowledgeOSContext` を **`Promise.all` 3 並列**(decision rules + failure patterns + ★ influences)に拡張
- ★ **全 5 intent 共通注入**(diagnose / closet / coordinate / style-consult / brand-learn)
- 理由: influences は brand-learn 以外の intent でも参考価値あり(diagnose で「あなたは Yohji Yamamoto の系譜」等)
- 規模: +10-20 行(getInfluences 呼出 + sanitize + extract)

### 5.2 `StylistChatContext.knowledgeOS` 型拡張案

```typescript
knowledgeOS?: {
  decisionRules:   ...   // A-10 既存
  failurePatterns: ...   // A-10 既存
  influences:      Array<{ subjectName: string; summary?: string; fusion?: string }>;  // ★ A-6b 新規
  dictionaries:    ...   // A-10 既存
};
```

### 5.3 入口 sanitize 適用
- A-10 `fetchKnowledgeOSContext` 内の sanitize 経路に **`subjectName / summary / fusion` も追加**:
  ```typescript
  influences: influencesRaw.slice(0, 15).map((i) => ({
    subjectName: stripCanonicalSlugs(i.subject_name ?? "").cleaned,
    summary:     stripCanonicalSlugs(i.subject_summary ?? "").cleaned,
    fusion:      stripCanonicalSlugs(i.fusion_essence ?? "").cleaned,
  })).filter((i) => i.subjectName.trim().length > 0),
  ```

### 5.4 user message ブロック追記
- `buildStylistChatUserMessage` の Knowledge OS ブロック末尾に influences セクション追加:
  ```
  ・影響源(Knowledge OS):
    ・ <subjectName>: <summary>(融合: <fusion>)
  ```

---

## 6. few-shot 3 件設計(★ ビジョン df36d82 直対応・良い例 7-9)

### 6.1 良い例 7(汎用 — 「○○ブランドについて教えて」)
```
user: 「Yohji Yamamoto について教えて」
AI: 「Yohji Yamamoto は『黒を哲学として纏う』アバンギャルドの巨人です。1980 年代以降、非対称・ドレープ・過剰な丈感で『服の本質を問う』姿勢を貫いています。あなたの世界観に重ねるなら、特に『余白』『構築の解体』の感覚が共通点になりそうです。具体的にどの側面(色 / シルエット / 哲学)を深掘りしますか?」
```

### 6.2 良い例 8(★ ビジョン直対応 — 「自分の世界観に合うブランドを知りたい」)
```
user: 「自分の世界観に合うブランドを知りたい」
AI: 「あなたの世界観に近いブランドを 3 段階で挙げます。まずコア寄りに『Yohji Yamamoto』(黒・解体・哲学が直接重なる)、橋渡しに『Auralee』(素材と静けさで共通点あり)、拡張方向に『Lemaire』(余白の感覚を別角度で)が候補です。どれから掘り下げますか?」
```

### 6.3 良い例 9(★ 美学起点 — 「ダーク・コンセプチュアルな美学を学びたい」)
```
user: 「ダーク・コンセプチュアルな美学を学びたい」
AI: 「ダーク・コンセプチュアル系の美学は 3 層で読み解けます。①素材層: 黒に光沢段階を持たせる(低光沢 / 半光沢 / マット黒)②構造層: 解体 / 過剰丈 / 非対称で完成度を崩す ③思想層: 服は『装飾』ではなく『問い』として機能する。具体ブランドだと Yohji Yamamoto / Rick Owens がこの系譜です。どの層から具体例を見ますか?」
```

### 6.4 system プロンプト差分(★ 最小化)
- 行 39 の `「A-6 段階の対象は… 4 種類のみ」` を `「5 種類(ブランド学習を追加)」` に拡張(1 字差分)
- 良い例 7-9 を行 末尾に追加

---

## 7. リグレッションテスト拡張計画(case B1-B5 + 任意 L5-L8)

| case | 検証内容 | assertion 想定 |
|---|---|---|
| B1 | `STYLIST_CHAT_INTENTS` に `"brand-learn"` 含まれる(両側同期・5 intent)| 2-3 |
| B2 | `buildStylistChatUserMessage` で `intent="brand-learn"` 時に「【文脈(本人のみ・ブランド学習…)】」ヘッダ + 「ブランド候補(curated)」セクション | 3-5 |
| B3 | `brandsCurated` フィールドが user message に出る(brand name + description + worldview_tags 日本語)| 3-5 |
| B4 | A-10 KOS 拡張: `influences` セクションが user message に出る(getInfluences mock)+ 入口 sanitize 検証(31 語 × influences 経路 = +31)| 35-40 |
| B5 | 既存 4 intent への影響なし(diagnose / closet / coordinate / style-consult user message に brand 系セクションが混入しない)| 4-8 |
| 任意 L5-L8 | L4-A 5 intent 五角の代表 4 方向(diagnose→brand-learn / coordinate→brand-learn / style-consult→brand-learn / brand-learn→diagnose)| 12-16 |
| **合計** | | **+59-77 assertion** → **386-404 PASS 想定** |

★ 現状 **327 PASS**(A-6 完了時)

---

## 8. 規模見当

| ファイル | 想定行数 | 内訳 |
|---|---|---|
| `lib/prompts/overlay-intent.ts` | **+10-20** | brand-learn description 精緻化 + brand-learn/culture/inspiration 境界判定ブロック追加 |
| `app/api/ai/stylist-chat/route.ts` | **+50-75** | `STYLIST_CHAT_INTENTS` 5 intent +1 / `fetchBrandLearnContext` 新規 +25-35 / `summarizeBrands` ヘルパ +10-15 / 4 → 5 intent 分岐統合 +3-5 / `fetchKnowledgeOSContext` に `getInfluences` 追加 +10-15 |
| `app/(app)/ai/page.tsx` | **+1-3** | `STYLIST_CHAT_INTENTS` 同期(コメント込み)|
| `lib/prompts/stylist-chat.ts` | **+65-90** | `StylistChatContext.brandsCurated / knowledgeOS.influences` 型追加 +15-20 / `buildMessage` に brand-learn 分岐(curated brands ブロック)+ KOS influences ブロック +25-35 / few-shot 3 件(良い例 7-9)+25-35 / system 1 字修正 +1 |
| `scripts/test-stylist-chat-continuity.ts` | **+50-80** | case B1-B5 + 任意 L5-L8 |
| **合計** | **+176-268 行** | 起点指示「+158-238 行」とほぼ整合(getInfluences 統合分やや上振れ)|
| 実装時間 | **65-100 分** | 起点指示「60-90 分」とほぼ整合 |

---

## 9. 既存達成への影響評価

| 達成項目 | 想定影響 |
|---|---|
| 1.5b 完成形 / race fix v2 / L4-A / A-2 / A-3 / MVP-1c / A-4 / A-10 / A-6 | **0**(コード本体 0 変更)|
| 既存 v1 `/api/brands/list` / `/api/brands/recommend` / `BrandCard` UI | **0**(別経路・無変更)|
| L4-A 切替検出 | **4 intent 四角 → 5 intent 五角に自動拡張**(直接方向 12 → 20)|
| リグレッションテスト | 327 → **386-404 PASS** 想定 |
| コスト管理 | `getInfluences` 呼出 ¥0.0001 級・5 分キャッシュで実効 0・案 P1 範囲内 |
| ③ 専章 / Phase 2 後ゲート | **diff 0 行**(★ 厳守)|
| 既存設計判断 1-10 | **文言不変**(★ 厳守)|

---

## 10. 三重防御 維持(★ A-4 + A-10 + A-6 基盤の上に同形構築)

| 層 | 既存 | A-6b 同形再適用 |
|---|---|---|
| (1) 列絞り SELECT | 既存 4 reply 経路で worldview_tags 列を SELECT 句に書かない | ★ `fetchBrandLearnContext` で `brands.worldview_tags`(日本語タグ・PRODUCT_WORLDVIEW_TAGS とは別語彙)を取得するのは **意図的**(LLM がブランドマッチングに使う)。日本語タグなので `stripCanonicalSlugs` は無影響 |
| (1) 入口 sanitize | A-10 で KOS 戻り値に `stripCanonicalSlugs` 適用 | ★ `getInfluences` 戻り値 `subject_name / summary / fusion` にも適用(A-10 拡張) |
| (2) system 明示禁止 | 既存 31 語禁止 + KOS 無視指示 + 日本語強制 | ★ 完全保持(本 A-6b で system 改変は「4 → 5 種類」1 字 + few-shot 3 件のみ)|
| (3) 出力フィルタ | `stripCanonicalSlugs(replyRaw)` で reply 全文 31 語動的削除 | ★ そのまま流用(intent に依存しない)|
| 動的検証 | case `[d]`/`[k]`/`[s-4]` で 31 語イテレーション | ★ case B4 で **31 語 × influences 経路 = +31 assertion** 追加 |

---

## 11. Step 分割(実装フェーズ・A-6 と同形 11 段階)

| Step | 内容 | 想定時間 |
|---|---|---|
| 1 | `overlay-intent.ts` brand-learn description 精緻化 + brand-learn/culture/inspiration 境界判定ブロック追加 | 5-10 分 |
| 2 | `STYLIST_CHAT_INTENTS` 5 intent 拡張(両側同期 + 同期コメント更新)| 2 分 |
| 3 | `fetchBrandLearnContext` 新規(`Promise.all` 3 並列: diagnose ctx + brands SELECT + style_preference)+ `summarizeBrands` ヘルパ + ★ `fetchKnowledgeOSContext` に `getInfluences` 追加 | 15-20 分 |
| 4 | 4 → 5 intent 分岐統合 | 5 分 |
| 5 | `StylistChatContext.brandsCurated / knowledgeOS.influences` 型追加 + `buildMessage` brand-learn 分岐 + KOS influences ブロック追記 + system 「4 → 5 種類」修正 | 15-20 分 |
| 6 | few-shot 3 件追加(良い例 7-9)| 10 分 |
| 7 | `npx tsc --noEmit` → EXIT 0 | 2 分 |
| 8 | リグレッションテスト拡張(case B1-B5 + 任意 L5-L8)| 15-20 分 |
| 9 | テスト実行 → **386-404 PASS** 確認 | 2 分 |
| 10 | 実機 verify(オーナー実施推奨・3-5 発話)| 10 分 |
| 11 | commit(push しない)| 3-5 分 |
| **合計** | | **84-116 分**(中央値 ≒ 100 分・起点指示 60-90 分より上振れ要因 = getInfluences 統合 + brands SELECT)|

---

## 12. リスク + エッジケース

### 12.1 brand-learn vs culture / inspiration 境界の LLM 解釈
- ★ **最大リスク**: 「黒い世界観のブランドとカルチャーを教えて」型は両方の特徴
- 境界判定ブロック(§3.2)で **ブランド名 / 美学キーワード明示なら brand-learn 優先**
- 実機 verify(Step 10)で 3-5 発話の境界確認・必要に応じて段階 A プロンプト追加修正(別 commit 可)

### 12.2 `brands.worldview_tags` の日本語タグ vs `PRODUCT_WORLDVIEW_TAGS` 英語スラッグ
- ★ 列名は同じだが **値の語彙体系が異なる**(brands は日本語「黒・解体・哲学」/ M5 は英語 31 スラッグ「quiet, minimal, dark」)
- `stripCanonicalSlugs` 適用しても brands の日本語タグは無影響(構造的安全)
- system プロンプトの「英語スラッグ 31 語禁止」は brand 系出力にも適用される(★ ブランド名や日本語タグは禁止対象外)
- ★ **要 verify**: brands seed に万一英語スラッグが混入していないか(現状 grep 確認済 = 純日本語)

### 12.3 `getInfluences` 戻り値に worldview_tags 含まれていないか
- `InfluenceData` 型定義(client.ts:27-41)を再確認: **`worldview_tags` フィールド ★ 不在**(getFashionRules と違って構造的に安全)
- `subject_name / summary / fusion / influences.fashion[]` 等は KOS Sprint 12 の seed 内容に依存・実体は日本語想定
- ★ 念のため入口 sanitize で 31 語フィルタを適用(防御的)

### 12.4 L4-A 5 intent 五角での切替テスト
- 4 intent 四角 = 12 方向 → 5 intent 五角 = 20 方向(追加 8 方向)
- 任意 L5-L8 で **代表 4 方向だけ検証**(全 20 方向は冗長)
- `SWITCH_THRESHOLD=0.85` ロジックは intent 数非依存 → 自動拡張

### 12.5 few-shot 9 件目以降の system プロンプト長さ管理
- 現状 system: 約 60-80 行(MVP-1c + A-6 で良い例 1-6 + 参考情報指示)
- A-6b で 良い例 7-9 追加 → 約 90-110 行 想定
- ★ Haiku 4.5 system token は十分余裕(数千トークン)・問題なし
- 将来 5 intent 全完了時(diagnose / closet / coordinate / style-consult / brand-learn + 残 3 = virtual-coordinate / product-match / match-users)で良い例 12-15 件規模になれば system 縮約検討

### 12.6 `brands` テーブル 20 件全載せのトークン浪費
- 各 description 平均 60-80 字 × 20 件 + tags = 約 3,000 字
- ★ 緩和策: `summarizeBrands` で **maniac_level 順 上位 12 件 + description 80 字 truncate**(約 1,500 字)
- 将来「世界観近い 5 件だけ」に絞り込む案も可(LLM 前段で worldview 一致度スコアリング)

---

## 13. 推奨案

### 13.1 推奨案 = フル統合(brands + getInfluences 両方)
- **規模**: +176-268 行 / 84-116 分
- **データソース**: worldview + style_preference + brands(12 件)+ getInfluences(15 件)+ KOS 既存
- **理由**: brand-learn intent は **brands 局所データ + KOS 影響源データの両方** で深い学習体験を提供できる(ChatGPT の服版「ブランド分析」型)

### 13.2 縮小案 = brands のみ(getInfluences 後回し)
- **規模**: +130-180 行 / 60-80 分
- **データソース**: worldview + style_preference + brands のみ(getInfluences は将来 Sprint)
- **理由**: 起点指示の規模範囲(+158-238 行 / 60-90 分)に収める

### 13.3 拡大案 = inspiration intent も同時投入(MVP-1c 残 5 の 2 つ消化)
- **規模**: +280-400 行 / 120-150 分
- ★ **非推奨**(M5 教訓・原則 3「刻む」違反・1 intent 1 commit 推奨)

---

## 14. 結論

| 観点 | 結論 |
|---|---|
| 規模(推奨案) | **+176-268 行 / 84-116 分**(中央値 ≒ 100 分)|
| 既存達成保持 | 1.5b 完成形 / race fix v2 / L4-A / A-2 / A-3 / MVP-1c / A-4 / A-10 / A-6 / 既存 v1 brand API **全保持** |
| 三重防御 | (1)(2)(3) + 入口/出口 二段 sanitize を **★ そのまま流用**(brands は日本語タグなので 31 語 sanitize 無影響)|
| リグレッションテスト | 327 → **386-404 PASS** 想定 |
| コスト | `getInfluences` ¥0.0001 級・5 分キャッシュで実効 0 級・案 P1 範囲内 |
| L4-A 切替検出 | 4 intent 四角 → **5 intent 五角に自動拡張**(直接方向 20)|
| 重要発見 | `brands.worldview_tags` は日本語タグ・PRODUCT_WORLDVIEW_TAGS とは別語彙(構造的安全) / `getInfluences` 戻り値に `worldview_tags` 不在(構造的安全)|
| ★ 推奨実装順 | Step 1-11(本 doc §11)・4 作法完全踏襲・**推奨案(フル統合)** |
| 次工程 | A-6b 完遂後 → A-6c virtual-coordinate / product-match / match-users(MVP-1c 残 3 intent 順次)|

---

## 15. 制約遵守チェックリスト

- [x] 新規 docs ファイル 1 件のみ(本 doc)
- [x] 本体 `ac834bb` / コード(app/api/lib/scripts/package.json/tsconfig.json)/ doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `a62a36c` / A-4 設計案 `66dd5bb` / A-10 設計案 `9bfb0cc` / A-10 実装 `566e3b2` / A-6 設計案 `4cabf4a` / A-6 実装 `626b57d` / 他 docs **全 0 変更**
- [x] view + grep + 静的解析のみ・実装なし
- [x] 既存設計判断 1-10 文言不変
- [x] ③ 専章 / ③ コスト / Phase 2 後ゲート diff 0 行
- [x] tsc 通る前提(本 doc は markdown のみ・コード変更なしのため tsc 影響なし)
- [x] commit はあり / push はなし
