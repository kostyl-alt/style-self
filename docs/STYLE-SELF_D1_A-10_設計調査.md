# STYLE-SELF D1 — A-10 Knowledge OS 連携 設計調査(stylist-chat 段階 B 拡張)

- 作成日: 2026-05-23
- 起点 HEAD: `66dd5bb`(`origin/main` 整合・clean)
- 本 doc の役割: A-10 着手前の **静的解析中心の設計調査**(本体・コード・他 doc 0 変更)
- 上位連結:
  - 最終ビジョン [docs/STYLE-SELF_最終ビジョン.md](./STYLE-SELF_最終ビジョン.md)(`df36d82`)「黒の重心・光沢・素材と重心で差を出す」型 reply
  - 整合性点検 [docs/STYLE-SELF_D1_最終ビジョン_ロードマップ_整合性点検.md](./STYLE-SELF_D1_最終ビジョン_ロードマップ_整合性点検.md)(`ddb86f7`) ギャップ C 緊急性最高
  - ロードマップ [§3.10 / §11.1 優先 2](./STYLE-SELF_D1_ビジョン完全達成_ロードマップ.md#310--a-10-knowledge-os-連携-整合性点検-ddb86f7-ギャップ-c緊急性最高)
  - A-4 設計調査 [docs/STYLE-SELF_D1_A-4_P1-C-4_設計調査.md](./STYLE-SELF_D1_A-4_P1-C-4_設計調査.md)(`66dd5bb`)で確立した三重防御基盤
- 実装方針: **A-4 で確立した三重防御 (1)(2)(3) を Knowledge OS 経路にも同型再適用**

---

## 1. 背景

### 1.1 ビジョン的緊急性
- 最終ビジョン `df36d82`: 「黒の重心・光沢」「素材と重心で差を出す」「白すぎるスニーカーは静かな世界観を壊す」型の **知識ベース返答** を段階 B reply で達成する
- MVP-1c stylist-chat の coordinate 例文(`lib/prompts/stylist-chat.ts:50-51`)も「低光沢の黒、短丈トップス、長めのパンツ、重めの靴で組むと、静かだけど印象に残ります」と同方向だが、**現状は few-shot 1 件の手書き**・体系的知識ベース未連携
- 整合性点検 `ddb86f7` ギャップ C: Knowledge OS 連携が 4 レイヤー構造(本体 / doc7 / ロードマップ / Knowledge OS)の **唯一の未接続箇所**・★ **緊急性最高** 確定

### 1.2 A-4 完遂(`66dd5bb`)で確立したプライバシー基盤
- 三重防御 (1) 列絞り SELECT / (2) system 明示禁止 / (3) `stripCanonicalSlugs` 31 語動的検証 — **3 reply 経路全て(diagnose / closet / coordinate)で維持**
- リグレッションテスト 119 PASS(`PRODUCT_WORLDVIEW_TAGS` 動的検証)
- ★ A-10 は **この基盤の上に Knowledge OS 経路を増設** する形

### 1.3 不可侵境界線(ロードマップ §12 + A-4 §1.3 再宣言)
1. 既存 DB 直接触らず・既存 API 経由のみ
2. M2-3 / M4-2 / M5 列絞り / view / coreTags 並列 を迂回しない
3. 既存 API 入出力契約を変更しない(stylist-chat の reply/actions 型は維持)
4. `/u/[id]` / `/p/[id]` 公開 URL 構造 不変
5. 旧画面 redirect shim 不削除
6. `worldview_tags` 英語スラッグ非露出(★ Knowledge OS 経路でも厳守)
7. `service_role` 不使用(本人 RLS のみ・★ KOS client は Bearer API Key 経由で本人スコープを保つ)
8. ★ **③ プライバシー専章 / ③ コスト管理 / Phase 2 後ゲート diff 0 行**

---

## 2. 現状実装サマリ(静的解析)

### 2.1 [lib/knowledge-os/client.ts](../lib/knowledge-os/client.ts)(196 行)
- **MCP RPC エンドポイント**: `POST {KNOWLEDGE_OS_URL}/api/mcp/rpc` + `Authorization: Bearer {KNOWLEDGE_OS_API_KEY}`
- **タイムアウト**: 5,000ms(`AbortController`)
- **キャッシュ**: インメモリ Map(TTL 5 分・サーバ再起動でリセット)
- **欠落キー時の挙動**: `console.warn` 1 回 + `[]` 返却(本ルートは無視・呼出側で fallback)
- **エラー時の挙動**: 全分岐で `console.warn` + `[]` 返却(★ 段階 B reply を絶対に壊さない設計)
- **★ 公開済み関数(3 個)**:
  - `getInfluences(args)` → `InfluenceData[]`
  - `getDecisionRules(args)` → `DecisionRule[]`
  - `getCategories(args)` → `CategoryData[]`
- **★ 未実装関数(2 個・★ A-10 で wrapper 追加が必要)**:
  - `getFailurePatterns` — MCP server 側に `get_failure_patterns` 実体あり(`../knowledge-os/lib/mcp/tools/get-failure-patterns.ts`)・引数: `{context?, related_features?}` / 戻り: `McpFailurePattern[]`
  - `getFashionRules` — MCP server 側に `get_fashion_rules` 実体あり・引数: `{worldview_tags?, usable_for?}` / 戻り: `McpFashionRule[]` ★ **戻り値に `worldview_tags` 配列を含む**(プライバシー要 sanitize)

### 2.2 [lib/dictionaries/](../lib/dictionaries/) 構造(5 ファイル・整合性点検 `ddb86f7` の記述通り)

| ファイル | 型 | エントリ数 | フィールド構造 |
|---|---|---|---|
| `material.ts` | `MaterialEntry` | **14**(綿 / 麻 / 毛 / 革 / シルク / カシミヤ / ベルベット / デニム / リネン / ナイロン / ポリエステル ほか)| `name, instinctiveImage[], culturalContext[], physicalSensation[], universalMood[], oppositeOf[]` |
| `color.ts` | `ColorEntry` | **15**(黒 / 白 / グレー / ベージュ / ブラウン / ネイビー / カーキ / オリーブ ほか)| `name, instinctiveImage[], temperatureFeel, weightFeel, distanceFeel, universalAssociation[], culturalContext[]` |
| `line.ts` | `LineEntry` | **10**(オーバーサイズ / スリム / ワイド / ストレート / ボックス / レイヤード ほか)| `name, visualEffect[], psychologicalEffect[], bodyImpact[], universalMood[]` |
| `ratio.ts` | `RatioEntry` | **8**(上3:下7 / 上4:下6 / 上5:下5 ほか)| `pattern, weightCenter, instinctiveFeel[], silhouetteEffect[], universalMood[]` |
| `index.ts` | re-export | — | 全 4 dict を re-export |
| `inject.ts` | helper | — | `getMaterialContext(materials[])` / `getColorContext(colors[])` / `getLineContext(silhouettes[])` — **日本語キーで lookup → 日本語の文脈文字列を返す**(★ 英語スラッグ非含有を構造保証) |

- ★ **既存利用箇所**: `app/api/ai/coordinate/route.ts:137-138` で `getMaterialContext` / `getColorContext` を **既に使用**(同形パターンを stylist-chat に持ち込めばよい)

### 2.3 [app/api/ai/stylist-chat/route.ts](../app/api/ai/stylist-chat/route.ts)(395 行)現状 contextData
- intent 分岐(`route.ts:118-125`):
  - `diagnose` → `fetchDiagnoseContext()` = `worldview_profiles.result->{name,keywords,core,ideal}` 4 列絞り
  - `closet` → `fetchClosetContext()` = `wardrobe_items.select("category, color")`(集計サマリ)
  - `coordinate` → `fetchCoordinateContext()` = `Promise.all([fetchDiagnoseContext, fetchClosetContext, users.body_profile])`(MVP-1c で投入済 3 並列)
- `StylistChatContext` 型(`lib/prompts/stylist-chat.ts:56-79`): worldview / closetSummary / bodyProfile の 3 セクション保持
- ★ **既存に Knowledge OS フィールドなし** → 型拡張が必要(下記 §3.1)

### 2.4 [lib/prompts/stylist-chat.ts](../lib/prompts/stylist-chat.ts)(213 行)現状 system
- `STYLIST_CHAT_SYSTEM_PROMPT`(行 25-54): 人格 / 構成 / 絶対禁止(★ 英語スラッグ 31 語禁止)/ 良い例 3 件(diagnose / closet / coordinate)/ 出力指示
- `buildStylistChatUserMessage()`(行 98-208): intent 別に「【文脈】」セクションを組立 → 「【直近の会話】」→「【今回のユーザー入力】」を連結
- ★ **既存に Knowledge OS セクションなし** → user message 末尾に追加 ブロックを差し込む形がシンプル(下記 §3.2)

### 2.5 既存 KOS 連携の参考実装
- `app/api/ai/analyze-v2/route.ts:115-119` で **`Promise.all` 並列フェッチ**:
  ```typescript
  const [influences, decisionRules, categories] = await Promise.all([
    getInfluences({ limit: 30 }),
    getDecisionRules({ importance_min: 4, limit: 20 }),
    getCategories({ include_counts: true }),
  ]);
  ```
- `app/api/ai/analyze/route.ts:160-161` でも同様(より小規模 `limit: 5`)
- ★ **同じパターンを stylist-chat 段階 B に持ち込む** のが最小コストで一貫性が高い

---

## 3. A-10 設計の核心

### 3.1 contextData に knowledgeOS 統合

**型拡張**(`lib/prompts/stylist-chat.ts` の `StylistChatContext`):
```typescript
export interface StylistChatContext {
  // 既存 ...
  // ★ Knowledge OS 由来(A-10 で追加)
  knowledgeOS?: {
    decisionRules:   Array<{ rule: string; importance?: number }>;  // 上位 N 件・rule 本文のみ抽出
    failurePatterns: Array<{ title: string; summary?: string }>;    // 上位 N 件・短文化
    dictionaries: {
      // 既存 inject.ts と同形の日本語文脈文字列(英語スラッグ非含有を構造保証)
      materials:    string;   // getMaterialContext で生成
      colors:       string;   // getColorContext で生成
      silhouettes:  string;   // getLineContext で生成
      ratios:       string;   // ratio.ts は inject.ts に未対応・★ 同形 helper 追加 +10 行
    };
  };
}
```

**フェッチ方針(★ 推奨: 3 intent 共通注入・並列フェッチ)**:
- `Promise.all` で 既存 3 ソース + KOS 2 ソース(`getDecisionRules` + `getFailurePatterns`)を **5 並列**
- dictionaries は file import(同期・コスト 0)→ `getMaterialContext` 等を呼ぶだけ
- 3 intent(diagnose / closet / coordinate)で **共通に注入**(intent 別絞り込みは A-10 では避ける・将来 Sprint で精緻化)

**呼出パラメータ(★ 控えめ初期値)**:
- `getDecisionRules({ importance_min: 4, limit: 10 })` — 重要度 4 以上・最大 10 件(analyze-v2 の `importance_min: 4, limit: 20` より控えめ・stylist-chat は短文対話のため)
- `getFailurePatterns({ context: "fashion-coordinate", limit: 5 })` — 文脈タグで絞り・最大 5 件
- dictionaries は **全件 import**(material 14 + color 15 + line 10 + ratio 8 = 計 47 エントリ)・helper で **発話に関連する語彙のみ抽出**

### 3.2 system / user message への統合

**推奨: user message 末尾に Knowledge OS ブロック追記**(system 改変リスクを最小化):
```
【参考(Knowledge OS から本人 contextData として取得)】
・判断ルール(重要度順):
  ・ <rule 本文 1>
  ・ <rule 本文 2>
  ...
・失敗パターン(回避すべき):
  ・ <title>: <summary>
  ...
・素材辞書: <inject.ts 生成文脈文字列>
・色辞書:   <同上>
・シルエット辞書: <同上>
・比率辞書: <同上(新 helper)>
```

**system プロンプト側の差分(最小)**:
- 「【参考(Knowledge OS …)】が文脈にある場合は **判断ルール・失敗パターン・辞書を ★ 参照して reply を組み立てる**」を行 33 付近に **1 行追加**(★ 英語スラッグ禁止行は不変・順序的に最後に維持)
- 既存 few-shot 3 件は ★ **無変更**(良い例 3 を達成基準として保つ)

### 3.3 Knowledge OS 呼出タイミング

**推奨: 並列フェッチ + 既存キャッシュ(5 分 TTL)に依存**:
- `client.ts:97 CACHE_TTL_MS = 5 * 60 * 1000` の **インメモリキャッシュが既に存在**
- KOS は分単位で変わらない → キャッシュヒット時は 1ms 級(レイテンシ影響なし)
- 同一プロセス内であれば 5 分以内の連続発話は **同じ KOS 結果を再利用**(★ コスト・レイテンシ両方の抑制)
- ★ アプリ側に追加キャッシュ機構は不要

### 3.4 戻り値 sanitize(★ 三重防御 (3) の同型再適用)

**入口 sanitize(★ A-10 新規)**:
- `getFailurePatterns` の `title`/`summary` → `stripCanonicalSlugs` 適用後に contextData に注入
- `getDecisionRules` の `rule` 本文 → 同上
- `getFashionRules` を将来使う場合(A-10 では未使用): 戻り値の `worldview_tags` 配列を **そのまま contextData に入れない**・必要なら日本語に翻訳

**出口 sanitize(★ 既存 (3) を流用)**:
- `app/api/ai/stylist-chat/route.ts:146 stripCanonicalSlugs(replyRaw)` は ★ **既存のまま reply 全文を最終チェック**
- KOS 由来データが reply に出力される経路でも 31 語動的検証で除去
- ★ **二段検証**(contextData 注入時 + reply 出力時)で多層防御

---

## 4. 規模見当

| 箇所 | 想定行数 | 内訳 |
|---|---|---|
| `lib/knowledge-os/client.ts` | **+15-25 行** | `getFailurePatterns` wrapper 新規追加(`getDecisionRules` と同形)・`McpFailurePattern` 型エクスポート |
| `lib/dictionaries/inject.ts` | **+10-15 行** | `getRatioContext(ratios[])` helper 追加(line/material/color と同形) |
| `app/api/ai/stylist-chat/route.ts` | **+25-35 行** | `fetchKnowledgeOSContext()` 新規 +20 行 / 3 intent fetcher で `Promise.all` に統合 +5-10 行 / 入口 sanitize ヘルパ +5 行 |
| `lib/prompts/stylist-chat.ts` | **+20-30 行** | `StylistChatContext.knowledgeOS` 型追加 +5 行 / `buildStylistChatUserMessage` に KOS ブロック組立 +15-20 行 / system に参照指示 1 行 +1-3 行 |
| `scripts/test-stylist-chat-continuity.ts` | **+30-50 行** | KOS mock(空配列 + 通常値の 2 系)+ 入口 sanitize 検証 +5-8 assertion + 既存 fetcher との並列性検証 +3-5 assertion |
| **合計** | **+100-155 行** | 整合性点検 `ddb86f7` 予測「+50-100 行」より **やや上振れ**(`getFailurePatterns` wrapper 新規 + `getRatioContext` 追加が想定外要素)|
| 実装時間 | **75-105 分** | 整合性点検予測「60-90 分」より +15 分(wrapper 追加と test 拡張ぶん)|

★ **オーナー判断**: +50-100 行を厳守したい場合は **dictionaries 統合を後回し**(A-10 では `getDecisionRules` + `getFailurePatterns` のみ)にする選択肢あり → +50-80 行・60-75 分

---

## 5. 既存達成への影響評価

| 達成項目 | コミット | 想定影響 |
|---|---|---|
| 1.5b 完成形(履歴永続化 race fix v2)| `040078c` | **0**(UI 側 0 変更)|
| L4-A 切替検出 | `60c7fa8` | **0**(継続判定ロジック 0 変更)|
| A-2 BottomNav 廃止 | `59fa4d6` | **0** |
| A-3 MenuDrawer | `11cf3de` | **0** |
| MVP-1c coordinate | `182c25b` + `2ef689e` | **0**(段階 A プロンプト 0 変更・段階 B 内部の contextData 拡張のみ)|
| A-4 三重防御(列絞り / system / フィルタ)| `66dd5bb` | **★ 同型再適用で維持**(KOS 経路にも (3) を流用) |
| リグレッションテスト | `3e39f99` → 119 PASS | **★ 124-129 PASS に拡張**(KOS mock + sanitize 検証 +5-10)|
| **コスト管理 (③コスト)** | 本体 `ac834bb` | 差分 0 行 / **実コスト**: KOS 呼出 ¥0.0001 級(整合性点検 `ddb86f7` 予測通り)・5 分キャッシュで実効 ¥0 級が大半 / 案 P1(月 N 回上限・`985d00b`)範囲内 |
| **③ プライバシー専章** | 本体 `ac834bb` | **diff 0 行**(★ 厳守)|
| **Phase 2 後ゲート** | 本体 `ac834bb` | **diff 0 行**(★ 厳守)|
| **既存設計判断 1-10** | 本体 `ac834bb` | **文言不変**(★ 厳守)|

---

## 6. 三重防御 同型再適用(★ A-4 で確認した 3 点)

| # | 層 | A-4 既存実装(stylist-chat 内)| A-10 同型再適用(KOS 経路追加) |
|---|---|---|---|
| (1) | 構造的遮断 | `worldview_profiles` `wardrobe_items` `users` を **列絞り SELECT**(worldview_tags 列を取得経路から物理排除)| KOS は MCP・DB 列絞り対象外 → **入口 sanitize で同等遮断**(`stripCanonicalSlugs(rule)` を contextData 注入前に適用・★ 31 語英語スラッグを構造的に剥がす)|
| (2) | system 明示禁止 | `STYLIST_CHAT_SYSTEM_PROMPT` 行 34-39 で 31 語例示禁止 | system に「Knowledge OS 由来の文脈にも英語スラッグが含まれる可能性があれば無視・必ず日本語で reply」を **1 行追記**(★ 既存禁止行は完全保持) |
| (3) | 出力フィルタ | `stripCanonicalSlugs(replyRaw)` で reply 全文の 31 語動的削除 | **★ 既存のまま流用**(KOS 経路追加で reply に英語スラッグが混入しても同じフィルタが捕捉)|
| 動的検証 | リグレッションテスト | `[d]` ブロックで `PRODUCT_WORLDVIEW_TAGS` import + 31 語全件除去 | KOS mock ブロック新規追加(`[k]` 想定)で **KOS 由来 contextData が reply に到達 → 出口で 31 語除去** を動的検証 |

---

## 7. Step 分割(★ 推奨 10 段階)

| Step | 内容 | 想定時間 |
|---|---|---|
| 1 | `lib/knowledge-os/client.ts` API 確認(再)+ `getFailurePatterns` wrapper 設計(+15-25 行)| 10 分 |
| 2 | `lib/dictionaries/inject.ts` に `getRatioContext` 追加(line/material/color と同形・+10-15 行)| 5 分 |
| 3 | `route.ts` に `fetchKnowledgeOSContext()` 新規追加(KOS + dictionaries 統合・+20 行)| 10-15 分 |
| 4 | `route.ts` 3 intent fetcher で `Promise.all` に KOS 結果を統合(+5-10 行)| 5-10 分 |
| 5 | `lib/prompts/stylist-chat.ts` に `StylistChatContext.knowledgeOS` 型追加 + `buildStylistChatUserMessage` の KOS ブロック組立(+20-30 行)| 15-20 分 |
| 6 | 入口 sanitize: `stripCanonicalSlugs` を `lib/utils/` に切り出し export 化(★ ロードマップ §13.2 横断 TODO 1 件解消・+30-50 行)or **route.ts 内 helper として呼ぶだけ**(+5 行)で済ます | 5-10 分 |
| 7 | system プロンプトに参照指示 1 行追加 + 既存英語スラッグ禁止行は完全保持 | 5 分 |
| 8 | `npx tsc --noEmit` → EXIT 0 | 2 分 |
| 9 | リグレッションテスト拡張: KOS mock + 入口 sanitize 検証 + 並列性検証(+30-50 行) → **124-129 PASS** | 15-20 分 |
| 10 | 実機 verify(オーナー実施推奨・「黒系で印象に残るコーデにしたい」発話で「光沢」「素材」「重心」の言及を観察)+ commit | 10 分 |
| **合計** | | **77-117 分**(中央値 ≒ 90 分)|

---

## 8. リスク + エッジケース

### 8.1 KOS MCP 接続失敗時のフォールバック(★ 重要)
- `client.ts:128 if (!apiKey) return []` + `client.ts:178 catch → return []` で **全エラー経路が空配列に収束**
- 段階 B 側は contextData の `knowledgeOS.decisionRules.length === 0` 等を見て **「Knowledge OS 無し」ブロックを user message に出さない** 分岐を入れる(★ ノイズ防止)
- ★ KOS が落ちていても **段階 B reply は 1 行も劣化しない**(MVP-1c 完成形維持)

### 8.2 KOS 戻り値が予期しない構造
- `client.ts:171-174` で `Array.isArray` 検証 + 型 cast(`as T[]`)・予期外は `console.warn` + `[]`
- 段階 B 側 sanitize で `typeof rule.rule === "string"` 等を 1 段挟む(★ 防御的)

### 8.3 KOS から英語スラッグ返却の可能性(★ 三重防御 (1) 相当の入口防御)
- `get_fashion_rules` は ★ **戻り値に `worldview_tags` 配列を含む**(MCP server 実装 `get-fashion-rules.ts:55`)
- A-10 では `getFashionRules` を **使わない選択**(`getDecisionRules` + `getFailurePatterns` のみ)→ 英語スラッグ混入経路を構造的に排除
- 将来 A-10 拡張で `getFashionRules` を使う場合は **入口で `worldview_tags` を捨てるか日本語翻訳** が必要(★ 明示申し送り)

### 8.4 KOS 呼出レイテンシ
- `client.ts:10 TIMEOUT_MS = 5000` で最大 5 秒タイムアウト
- キャッシュヒット時は 1ms 級(5 分 TTL 内)
- ★ MVP-1c reply の現状レスポンス時間(Haiku 4.5・max_tokens 400)に **対した影響なし**(段階 B 並列フェッチで)
- ★ KOS 接続失敗時はタイムアウトを待たず即 catch → 段階 B は通常通り進行

### 8.5 キャッシュ vs 都度フェッチ
- ★ 既存キャッシュ(5 分 TTL)を ★ そのまま流用
- アプリ側に追加キャッシュは不要(複雑化リスク)

### 8.6 `stripCanonicalSlugs` の export 化(横断 TODO §13.2)
- 現状: route.ts 内 non-export 関数 + リグレッションテストに同形コピー
- A-10 で **入口 sanitize にも使いたい** → 2 案:
  - 案 X(最小): route.ts 内 helper のままで A-10 内部から呼ぶ(+5 行)
  - 案 Y(横断 TODO 解消): `lib/utils/strip-canonical-slugs.ts` に切り出し export(+30-50 行・リグレッションテストの同形コピー削除も伴う)
- ★ **推奨 案 X**(A-10 のスコープを最小化・案 Y は別 Sprint で実施)

### 8.7 整合性点検 `ddb86f7` 予測との差分
- 予測 +50-100 行 / 60-90 分 → 本調査 +100-155 行 / 75-105 分
- 差分の原因: `getFailurePatterns` wrapper 新規(+15-25 行)+ `getRatioContext` helper 新規(+10-15 行)
- ★ 妥当な上振れ(MCP client wrapper の不足は事前未検知)・**ロードマップ §3.10 規模欄を A-10 commit 時に更新申し送り** 推奨

---

## 9. 推奨実装方針(★ オーナー意思決定用)

### 9.1 推奨案 = 案 A(フル統合・dictionaries 含む)
- **規模**: +100-155 行 / 75-105 分
- **取得**: `getDecisionRules({ importance_min: 4, limit: 10 })` + `getFailurePatterns({ context: "fashion-coordinate", limit: 5 })` + dictionaries 4 種(material 14 / color 15 / line 10 / ratio 8)
- **理由**: ビジョン「素材・色・余白・信念軸」型 reply の達成には dictionaries 統合が ★ 必須(coordinate route の既存パターン踏襲)

### 9.2 縮小案 = 案 B(KOS のみ・dictionaries 後回し)
- **規模**: +50-80 行 / 60-75 分(整合性点検予測内)
- **取得**: `getDecisionRules` + `getFailurePatterns` のみ
- **理由**: dictionaries は次 Sprint(A-10b 等)で追加・規模を整合性点検予測内に収める
- ★ ロードマップ §3.10 規模欄との整合性を優先する場合の選択肢

### 9.3 統合戦略の共通方針
- 段階 B contextData 取得を **`Promise.all` で 5 並列**(既存 3 + KOS 2)
- 戻り値は **入口 sanitize**(`stripCanonicalSlugs` 適用)してから contextData に注入
- system プロンプトに **参照指示 1 行追記**(既存禁止行は完全保持)
- 3 intent(diagnose / closet / coordinate)で **共通注入**(intent 別絞り込みは将来 Sprint で精緻化)

---

## 10. 結論

| 観点 | 結論 |
|---|---|
| 規模 | **+100-155 行 / 75-105 分**(案 A・整合性点検予測 +50-100 行の上振れ要因明示)|
| 既存達成保持 | 1.5b 完成形 / race fix v2 / L4-A / A-2 / A-3 / MVP-1c / A-4 三重防御 **全保持** |
| 三重防御 | (1)(2)(3) を KOS 経路に **同型再適用**(入口 sanitize + 既存 (3) 流用 + system 1 行追加)|
| リグレッションテスト | 119 → **124-129 PASS** 想定(KOS mock + sanitize 検証 +5-10 assertion)|
| コスト | KOS 呼出 ¥0.0001 級・5 分キャッシュで実効 ¥0 級が大半・案 P1 範囲内 |
| ビジョン達成 | 「黒の重心・光沢・素材と重心で差を出す」型 reply 実現の **核心工程**(整合性点検 `ddb86f7` ギャップ C 緊急性最高 解決) |
| 横断 TODO | `getFailurePatterns` wrapper 新規追加 + `getRatioContext` helper 追加 + (任意) `stripCanonicalSlugs` の export 化(§13.2 解消) |
| ★ 推奨実装順 | Step 1-10(本 doc §7)・案 A(フル統合)|

---

## 11. 制約遵守チェックリスト

- [x] 新規 docs ファイル 1 件のみ(本 doc)
- [x] 本体 `ac834bb` / コード(app/api/lib/scripts/package.json/tsconfig.json)/ doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `a62a36c` / A-4 設計案 `66dd5bb` / 他 docs **全 0 変更**
- [x] view + grep + 静的解析のみ・実装なし
- [x] 既存設計判断 1-10 文言不変
- [x] ③ 専章 / ③ コスト / Phase 2 後ゲート diff 0 行
- [x] tsc 通る前提(本 doc は markdown のみ・コード変更なしのため tsc 影響なし)
- [x] commit はあり / push はなし
