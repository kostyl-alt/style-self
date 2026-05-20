# STYLE-SELF D1 P1-C-1.5b — 設計調査(closet 追加 + L4 切替検出 案 A 格上げ)

> ★調査 doc(実装しない・本体設計書 [STYLE-SELF_D1_実装設計.md](./STYLE-SELF_D1_実装設計.md) は書き換えない)。
> オーナー判断項目を整理してレビューを短縮することが目的。
>
> 前提:
> - 1.5a 修正(commit `04d6296`)で `STYLIST_CHAT_INTENTS = {"diagnose"}` + L4=案 C
>   (切替検出なし)の会話継続が成立済。
> - 連続性 設計調査(commit `0d0f74e`)第 9 章で「1.5b 投入時に L4 を A に格上げ必要」と
>   明示済。本 doc はその具体設計。

## 0. 背景

- **1.5a 修正後の状態**: `STYLIST_CHAT_INTENTS = new Set(["diagnose"])` で diagnose 会話が
  複数往復継続(オーナー実機検証クリア)
- **1.5b の目的**:
  1. `closet` を会話継続対象 intent に追加
     (オーナー良い例 2: 「ブラック系・ベージュ系のボトムス・バッグが登録されています。
       組みますか?一覧見ますか?」水準)
  2. L4 を 案 C → 案 A(全自動切替)に格上げ
     (diagnose 会話中に closet 高信頼度発話が来たら新セッションに自然遷移)

---

## A. 実物確認(コード根拠)

### A-1. 1.5a 修正後の handleSubmit([app/(app)/ai/page.tsx](../app/(app)/ai/page.tsx))

```ts
// L70: UI 側スコープ Set(1.5a)
const STYLIST_CHAT_INTENTS = new Set<string>(["diagnose"]);

// L164-167: 1.5a 会話継続判定
const sessionIntent = getSessionIntent(messages);
const isContinuingSession =
  sessionIntent !== null && STYLIST_CHAT_INTENTS.has(sessionIntent);

// L171-176: 段階A 並列 + 段階B 直行
const isStylistTarget = isContinuingSession || (
  data.ok && data.reason === undefined
  && typeof data.intent === "string"
  && STYLIST_CHAT_INTENTS.has(data.intent)
);

// L181: 継続時は sessionIntent、新規時は data.intent
const intentToSend = isContinuingSession ? sessionIntent! : (data.intent as string);
```

→ **拡張ポイントは明確**: L4 案 A は `isContinuingSession` の条件分岐に「**段階A 判定が
  別の継続対象 intent で高信頼**」を追加するだけ。1.5a 構造を最小拡張で達成可能。

### A-2. lib/prompts/stylist-chat.ts(108 行)

```ts
// L24: 単一 system prompt(diagnose few-shot 1 件のみ・closet 用は未投入)
export const STYLIST_CHAT_SYSTEM_PROMPT = `...
【良い例(到達基準・診断振り返り)】
user: 「診断したい」
AI:   「了解しました。あなたの世界観を見つけるために…」
`;

// L47-52: 共通 context 型(closet 用フィールドは未定義)
export interface StylistChatContext {
  worldviewName:      string | null;
  worldviewKeywords:  string[];
  coreIdentity:       string | null;
  idealSelf:          string | null;
}
```

→ closet 用には:
- few-shot を 1 件追加(オーナー良い例 2 水準)
- `StylistChatContext` に closet 系フィールド(色系統別件数 / カテゴリ別件数)を追加
- 「MVP-1 段階のため診断以外は深入りせず引き戻す」の禁止記述を **緩和**(closet も
  対象 intent になるため)。代わりに「対象外 intent(coordinate / saved 等)には深入りしない」
  に書き換え

### A-3. stylist-chat route の contextData([app/api/ai/stylist-chat/route.ts](../app/api/ai/stylist-chat/route.ts))

```ts
// L48: API 側スコープ Set(UI と完全一致)
const STYLIST_CHAT_INTENTS = new Set<string>(["diagnose"]);

// L121-133: worldview_profiles を jsonb 列絞り SELECT(★三重防御の 1 つ目)
const { data: profileRow } = await supabase
  .from("worldview_profiles")
  .select(
    "name:result->worldviewName,keywords:result->worldview_keywords," +
    "core:result->coreIdentity,ideal:result->idealSelf"
  )
  .eq("user_id", userId)
  .maybeSingle();
```

→ closet 用には:
- intent に応じて contextData の取得先を切替
  - `intent === "diagnose"`: 既存の worldview_profiles SELECT
  - `intent === "closet"`: 新規 `wardrobe_items` の **列絞り SELECT**(下記 A-6 参照)

### A-4. STYLIST_CHAT_INTENTS 定義箇所(UI / API 両側)

| 場所 | 行 | 現状 |
|---|---:|---|
| [app/(app)/ai/page.tsx](../app/(app)/ai/page.tsx) | L70 | `new Set<string>(["diagnose"])` |
| [app/api/ai/stylist-chat/route.ts](../app/api/ai/stylist-chat/route.ts) | L48 | `new Set<string>(["diagnose"])` |

→ **両側を同時に `["diagnose", "closet"]` に拡張**。これ以外の場所での参照はなし(grep 確認済)。

### A-5. navigate-map(closet は既存登録済)

```ts
// lib/overlay/navigate-map.ts L21:
closet: {
  url:         "/outfit?tab=closet",
  description: "クローゼットを開きます",
},
```

→ closet の遷移先 URL は **既存 navigate-map 9 entries で対応済**。追加変更不要。
   補助 actions として `{intent: "closet", label: "一覧で見る →"}` を返せばよい。

### A-6. wardrobe_items SELECT パターン

既存 GET `/api/wardrobe`(L53-57)は `.select("*")` で**全列**を取得しているが、これは
クライアント返却用の経路。**closet 用 contextData は別経路で列絞り SELECT** を使う:

```ts
// 想定(closet contextData)
await supabase
  .from("wardrobe_items")
  .select("category, color")
  .eq("user_id", userId);
```

→ サーバ側で `Map<color系統, count>` / `Map<category, count>` に集計して
   `StylistChatContext` に詰める。`worldview_tags`(英語スラッグ)を含む列は **そもそも
   SELECT 句に書かない** = 取得経路が無い(diagnose と同パターンの三重防御 1 つ目)。

---

## B. 設計案

### 1. STYLIST_CHAT_INTENTS 拡張

```ts
// 両側同時更新(UI / API)
- const STYLIST_CHAT_INTENTS = new Set<string>(["diagnose"]);
+ const STYLIST_CHAT_INTENTS = new Set<string>(["diagnose", "closet"]);
```

- 他 19 intent(coordinate / style-consult / worldview-profile / saved / history /
  body-edit / preference-edit / create-post / my-posts / moodboard / tryon /
  trend-translate / abstract-coordinate / culture-explain / learn-insight /
  profile-fit / purchase-check / virtual-coordinate / unknown 等)は引き続き
  従来 intent-result(NavigateConfirm)経路 = **P1-C-1 挙動 0 変更**

> ★設計者推奨: 2 ファイル × 1 行差分のみ。**変更行数: +0(置換)**。

---

### 2. ★L4-A 切替検出 具体設計(本 doc の中心論点)

#### 2-1. 切替条件

```
切替成立 ⇔
  (a) isContinuingSession === true(直前 reply の sessionIntent あり)
  AND
  (b) data.ok === true(段階A 判定が成功)
  AND
  (c) data.intent ∈ STYLIST_CHAT_INTENTS かつ data.intent !== sessionIntent
       (= 別の継続対象 intent が判定された)
  AND
  (d) data.confidence >= SWITCH_THRESHOLD
       (= 高信頼で別 intent と判定された)
```

#### 2-2. 切替閾値の選定

**1.5a 実機実績**:
- 「似合う服が分からない」→ style-consult(75%)→ **誤判定**だが対象外 intent なので
  影響なし
- これは 75% 程度では多義的入力で誤判定する事実を示している

**MVP-1b 推奨閾値**:
- **85% 以上**(保守設定)
- 理由: 1.5b 投入直後は誤切替で UX 棄損するリスクの方が大きい
- 1.5a で並列段階A ログが取れる設計のため、**閾値チューニングは運用で観測ベースで段階的に下げる**(85% → 80% 等)

#### 2-3. 切替対象外 intent が高信頼で来た時(★重要判断)

例: diagnose 会話中に「コーデ組みたい」と発話 → 段階A が coordinate(90%)を返す
(coordinate は STYLIST_CHAT_INTENTS に**含まれない**)

| 案 | 動作 | UX | リスク |
|---|---|---|---|
| **案 X 継続維持(1.5a 案 C と同じ)** | sessionIntent=diagnose で段階B 継続 | 自然(会話の流れを断たない)| diagnose の文脈で coordinate 質問に答える違和感 |
| 案 Y intent-result に切替 | 従来 NavigateConfirm カード表示 | 不自然(突然 UI が変わる) | 会話が切れる |

> ★設計者推奨: **案 X(継続維持)**。
> 理由 2 点:
> 1. 連続性 設計調査 第 4 章 L4 案 C の論理(継続維持の方が UX 棄損が小さい)が
>    そのまま 1.5b でも当てはまる
> 2. system prompt の禁止記述「対象外 intent には深入りしない」で AI 側が
>    軽く引き戻すように設計できる

#### 2-4. 切替時の history 保持 / リセット

切替が成立したとき、`recentHistory` に何を渡すか:

| 案 | history | 利点 | 欠点 |
|---|---|---|---|
| **案 P リセット** | 空配列 | 新トピック = 新文脈・前の会話の混乱を持ち込まない | 連続性ヒントが消える(再質問が必要かも) |
| 案 Q 保持 | 前のセッションの末尾 N=3 | 連続性ヒントあり(「さっき診断の話してた人がクローゼットの話を始めた」)| 前トピックを引きずって混乱 |

> ★設計者推奨: **案 P リセット**。
> 理由: 切替 = 新トピックで AI も人間も同じ前提に立つのが自然。
> 「直前話してたこと」を保持する UI(messages 表示)はそのままで、AI に渡す history のみ
> リセット = ユーザー視点で過去会話は残るが AI の応答品質を最大化。

#### 2-5. handleSubmit 改修 diff 骨子(設計付録 A)

```diff
  const sessionIntent = getSessionIntent(messages);
  const isContinuingSession =
    sessionIntent !== null && STYLIST_CHAT_INTENTS.has(sessionIntent);

+ // L4-A 切替検出(1.5b): 段階A が「別の継続対象 intent」を高信頼で返したら新セッション
+ const SWITCH_THRESHOLD = 0.85;  // MVP-1b 保守設定(運用でチューニング)
+ const isSwitchToOtherTarget =
+   isContinuingSession
+   && data.ok && data.reason === undefined
+   && typeof data.intent === "string"
+   && STYLIST_CHAT_INTENTS.has(data.intent)
+   && data.intent !== sessionIntent
+   && typeof data.confidence === "number"
+   && data.confidence >= SWITCH_THRESHOLD;

- const isStylistTarget = isContinuingSession || (
+ // 切替成立時は新セッションとして扱う(継続フラグ off)
+ const effectiveContinuing = isContinuingSession && !isSwitchToOtherTarget;
+
+ const isStylistTarget = effectiveContinuing || (
    data.ok && data.reason === undefined
    && typeof data.intent === "string"
    && STYLIST_CHAT_INTENTS.has(data.intent)
  );

  if (isStylistTarget) {
-   const intentToSend = isContinuingSession ? sessionIntent! : (data.intent as string);
+   const intentToSend = effectiveContinuing ? sessionIntent! : (data.intent as string);
-   const recentHistory = buildStylistHistory(messages);
+   // 切替時は history リセット(2-4 案 P)・新トピックの文脈で AI に応答させる
+   const recentHistory = isSwitchToOtherTarget ? [] : buildStylistHistory(messages);
    ...
  }
```

正味追加行数: **+10 行**(SWITCH_THRESHOLD 定数 1 行 + isSwitchToOtherTarget 8 行 + effectiveContinuing 1 行 + history リセット三項演算 1 行 + 既存 2 行修正)

1.5a の +30 行 から **+10 行追加 = 累計 +40 行**(ai/page.tsx 改修)。

---

### 3. closet 会話の contextData(API 側 route.ts 改修)

#### 3-1. SELECT(三重防御 1 つ目)

```ts
// intent ごとに分岐(diagnose と closet で別経路)
let ctx: StylistChatContext;
if (intent === "diagnose") {
  // 既存ロジック(変更なし)
  ctx = await fetchDiagnoseContext(supabase, userId);
} else if (intent === "closet") {
  // 新規(1.5b)
  ctx = await fetchClosetContext(supabase, userId);
}

async function fetchClosetContext(
  supabase: SupabaseClient<Database>, userId: string
): Promise<StylistChatContext> {
  const { data: itemsRaw } = await supabase
    .from("wardrobe_items")
    .select("category, color")    // ★列絞り(三重防御 1)・worldview_tags は SELECT 句に書かない
    .eq("user_id", userId);

  const items = (itemsRaw ?? []) as Array<{ category: string | null; color: string | null }>;

  // 集計: 色系統別 / カテゴリ別の件数を Map で
  const colorCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  for (const it of items) {
    const c = normalizeColor(it.color);  // 「黒系」「ベージュ系」等に正規化
    if (c) colorCounts[c] = (colorCounts[c] ?? 0) + 1;
    const cat = it.category ?? "(その他)";
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
  }
  return buildClosetContext(colorCounts, categoryCounts, items.length);
}
```

#### 3-2. StylistChatContext 拡張

```ts
// lib/prompts/stylist-chat.ts
export interface StylistChatContext {
  // 既存(diagnose 用)
  worldviewName:      string | null;
  worldviewKeywords:  string[];
  coreIdentity:       string | null;
  idealSelf:          string | null;
  // 新規(closet 用・1.5b)
  closetSummary?: {
    totalItems:        number;
    colorBuckets:      Array<{ name: string; count: number }>;  // ["黒系", "ベージュ系", ...]
    categoryBuckets:   Array<{ name: string; count: number }>;  // ["トップス", "ボトムス", ...]
  };
}
```

両方 optional でも良いが、`closetSummary` のみ optional で十分(diagnose 用フィールドは
既存のまま・後方互換)。

#### 3-3. buildStylistChatUserMessage の context 整形

```ts
// intent === "closet" のときの整形(日本語サマリ・ 英語スラッグ含まない)
if (ctx.closetSummary) {
  lines.push("【文脈(本人のクローゼット集計・日本語サマリ)】");
  lines.push(`・登録件数: ${ctx.closetSummary.totalItems}件`);
  if (ctx.closetSummary.colorBuckets.length > 0) {
    lines.push(`・色系統別: ${ctx.closetSummary.colorBuckets
      .slice(0, 5)
      .map(b => `${b.name} ${b.count}`)
      .join("、")}`);
  }
  if (ctx.closetSummary.categoryBuckets.length > 0) {
    lines.push(`・カテゴリ別: ${ctx.closetSummary.categoryBuckets
      .slice(0, 5)
      .map(b => `${b.name} ${b.count}`)
      .join("、")}`);
  }
}
```

---

### 4. closet system プロンプト追加方針(オーナー良い例 2 基準)

#### 4-1. few-shot 追加(stylist-chat.ts L40-43 の隣に追加)

```
【良い例(到達基準・クローゼット振り返り)】
user: 「クローゼット見せて」
AI: 「ブラック系のトップスが5点、ベージュ系のボトムスが2点、バッグが1点 登録されています。
     これらを組み合わせてコーデを考えますか?それとも一覧で確認しますか?」
```

#### 4-2. 禁止記述の更新(L38 を緩和)

```diff
- ・MVP-1 段階のため、診断以外の話題(コーデ提案・クローゼット詳細など)には深入りせず、
-   軽く受け止めて「いまは診断の振り返りからご一緒できます」と引き戻す
+ ・MVP-1b 段階の対象は「診断振り返り」と「クローゼット集計の振り返り」の 2 種類のみ。
+   それ以外の話題(コーデ提案・着せ替え・保存一覧・トレンド翻訳など)には深入りせず、
+   軽く受け止めて「いまはこの 2 種類のご相談がご一緒できます」と引き戻す
```

#### 4-3. 共通禁止 4 項目は不変

- `worldview_tags` 英語スラッグ出力禁止 ← 不変
- 内部 ID / jsonb キー名 出力禁止 ← 不変
- 他ユーザー情報 出力禁止 ← 不変
- URL / 外部リンク 出力禁止 ← 不変

---

### 5. handleSubmit 改修骨子(2-5 と同内容のサマリ)

| # | 修正 | 行差分 |
|---:|---|---:|
| 1 | UI 側 `STYLIST_CHAT_INTENTS` を `{"diagnose", "closet"}` に置換 | ±0(1 行差分・置換のみ)|
| 2 | `SWITCH_THRESHOLD = 0.85` 定数追加 | +1 |
| 3 | `isSwitchToOtherTarget` 算出(8 行) | +8 |
| 4 | `effectiveContinuing` 導入 + 既存 `isStylistTarget` / `intentToSend` を effectiveContinuing 基準に変更 | +2 |
| 5 | history 切替時リセット(`isSwitchToOtherTarget ? [] : buildStylistHistory(messages)`) | +1(三項演算で 1 行)|

→ **正味 +10 行 / 1.5a 累計 +40 行**(ai/page.tsx)

API 側 route.ts は **+30 行程度**(intent 分岐 + fetchClosetContext + 集計関数)。

---

### 6. 補助 actions(navigate-map 9 entries 転用)

```ts
// buildActions(route.ts)を intent 別に拡張
function buildActions(intent: string): StylistChatActionItem[] {
  if (intent === "diagnose") {
    return [{ intent: "diagnose", label: "診断を始める →" }];
  }
  if (intent === "closet") {
    return [
      { intent: "closet",       label: "一覧で見る →" },          // → /outfit?tab=closet
      { intent: "coordinate",   label: "コーデを組む →" },        // → 既存 coordinate intent
    ];
  }
  return [];
}
```

→ navigate-map に **新規エントリー追加 0**(既存 closet + coordinate を再利用)。

---

### 7. ★プライバシー三重防御 継承確認

| 防御層 | closet 会話での扱い |
|---|---|
| 列絞り SELECT(三重防御 1)| ✅ `.select("category, color")` で worldview_tags 列は取得しない・原理的に同パターン |
| system 明示禁止(三重防御 2)| ✅ 既存 system prompt 4 項目(worldview_tags / 内部 ID / 他ユーザー / URL)は全て不変・closet 用 few-shot 追加でも変わらない |
| 出力フィルタ PRODUCT_WORLDVIEW_TAGS 31 語(三重防御 3)| ✅ `stripCanonicalSlugs` 既存実装を closet reply にも適用(intent 分岐不要)|

> **追加検証項目(実装後)**: closet 会話で `wardrobe_items` の他列(`worldview_tags` 列が
> 存在する場合)が漏れないことを `scripts/test-stylist-chat-continuity.ts`
> (1.5b で追加予定・別 commit)で確認。

---

### 8. コスト試算(本体 7.4 / 1.5a 連動)

| ケース | 月想定相談数 | 平均往復 N | コスト/相談 | 月額 |
|---|---:|---:|---:|---:|
| 1.5a(diagnose のみ) | 150 | 2 | ¥1.00 | **¥150** |
| 1.5b 追加(closet) | +100 | 2 | ¥1.00 | **+¥100** |
| **1.5b 後の累計** | 250 | 2 | ¥1.00 | **¥250** |

※ コスト/相談は L1 並列案 ¥0.50 × N=2 = ¥1.00。1.5b でも同じ並列構造を維持。

**累計 ¥250/月** は本体 7.4 の旧上限 ¥77/月 を大きく超える(1.5a 連動課題)。
→ **オーナー判断 5(コスト再評価別 doc)で扱う**。本 1.5b 投入で更に課題が明確化。

---

### 9. リスク + エッジケース

| # | リスク / エッジケース | 緩和策 | 残存リスク |
|---|---|---|---|
| R1 | L4-A 誤切替で UX 棄損(closet 信頼度 85% でも誤判定)| 閾値 85% を保守設定・運用ログでチューニング | 中(初期投入で目立つ可能性)|
| R2 | 切替時の history リセットでユーザー視点で違和感(「さっきの話は?」)| messages 表示は残す・AI に渡す history のみリセット | 低 |
| R3 | wardrobe_items の color 列が自由文字列で集計しづらい | `normalizeColor` で系統正規化(黒系 / 白系 / ベージュ系等 10 系統程度に丸める)| 中(`normalizeColor` の網羅性)|
| R4 | wardrobe 0 件のユーザーが closet 会話を始めた | system prompt で「未登録なら登録を促す」few-shot を追加 | 低 |
| R5 | diagnose と closet が同時に系統的に話題化(両方話したい) | MVP-1b は 1 セッション 1 intent 固定(L4-A 切替で順次・並列ではない)| 受容 |
| R6 | 1.5b 投入で誤切替増加(段階A 判定の精度問題) | 1.5b-i / 1.5b-ii 段階分割(下記 10)| 低 |
| R7 | 既存 18 機能 / D1-1 intent / navigate-map / 5 サブ / publicルート / ③専章 / コスト / Phase2 後ゲート 不変 | 設計書 4.4 不可侵リスト準拠 | なし |
| R8 | 1.5a の getSessionIntent / sessionIntent 構造との競合 | 完全互換(継続判定の追加分岐のみ・既存ロジック不変)| なし |

---

### 10. 段階分割(★1.5b-i / 1.5b-ii vs 一括)

#### 10-1. 段階分割案

| 段階 | 内容 | 累計行数 | リスク |
|---|---|---:|---|
| **1.5b-i** | Set 拡張 + closet contextData + closet system プロンプト + closet few-shot 追加(L4=C のまま) | API +30 / UI +1 | 低(closet 単独会話のみ・切替なし) |
| **1.5b-ii** | L4-A 切替検出 投入(SWITCH_THRESHOLD / isSwitchToOtherTarget / history リセット)| UI +10 | 中(誤切替リスク) |

#### 10-2. 一括案

1.5b 全部を 1 commit で投入。

| | 段階分割(i / ii) | 一括 |
|---|---|---|
| 失敗範囲の限定 | ★ i は closet 会話成立だけ確認・ii で切替成立確認 | 失敗時に切り分け困難 |
| 1.5b-i での並列段階A ログ蓄積 | ★ ii の閾値チューニングに活用可能 | できない |
| コミット粒度 | 小刻み(M5 作法) | 大きい |
| ロールバック | i / ii 個別に revert 可能 | 全体 revert のみ |

> ★設計者推奨: **段階分割(1.5b-i / 1.5b-ii)**。
> 理由 3 点:
> 1. 1.5b-i だけで closet 会話の実機品質を切り分けて確認できる
> 2. 1.5b-i 並列段階A ログから ii の閾値判断材料が得られる
> 3. M5 刻む作法に整合・revert 単位が小さい

---

### 11. ★最終推奨(設計者見解・オーナー判断項目)

| 論点 | 設計者推奨 | 根拠 |
|---|---|---|
| **L1 STYLIST_CHAT_INTENTS 拡張** | `{"diagnose", "closet"}` に置換(両側 1 行差分) | 最小変更 |
| **L2 L4-A 切替閾値** | **`SWITCH_THRESHOLD = 0.85`(保守設定)** | 1.5a 実機実測で 75% 誤判定例あり・初期は安全側 |
| **L3 切替対象外 intent の扱い** | **継続維持(案 X)** | 連続性 第 4 章 L4 案 C の論理を 1.5b でも踏襲 |
| **L4 切替時の history** | **リセット(案 P)** | 新トピック = 新文脈・AI 応答品質を最大化 |
| **L5 段階分割** | **1.5b-i / 1.5b-ii 段階分割** | M5 刻む作法・並列ログで閾値チューニング |
| **L6 closet contextData の SELECT** | `.select("category, color")`(列絞り)| 三重防御 1 つ目を構造的に継承 |
| **L7 closet system プロンプト** | few-shot 1 件追加 + 禁止記述 1 行更新 | 共通禁止 4 項目は不変・最小拡張 |

**オーナー判断項目**:

1. L2 切替閾値 0.85 受容するか(運用でチューニングする前提・初期投入の安全側)
2. L3 切替対象外 intent(coordinate / saved 等)継続維持 受容するか
3. L4 切替時 history リセット 受容するか(messages 表示は残す・AI に渡すデータのみリセット)
4. L5 段階分割(1.5b-i / 1.5b-ii)受容するか(別 commit で 2 回 push)
5. L6 wardrobe_items の `normalizeColor` の系統数(黒系 / 白系 / ベージュ系等 10 系統)について
   別 doc で正準辞書化が必要か(M5 PRODUCT_WORLDVIEW_TAGS 同パターン)
6. closet 用 few-shot を 1 件で足りるか・複数件追加するか(MVP-1b は 1 件で十分か)
7. オーナー判断 5(コスト試算 再評価別 doc)を 1.5b 投入と同時に発進するか・別 Sprint か

---

## 12. 次工程(本 doc では実装しない)

オーナー判断後、段階分割の場合:

### 1.5b-i(closet 会話成立)
1. `STYLIST_CHAT_INTENTS` を両側 `{"diagnose", "closet"}` に
2. `StylistChatContext` に `closetSummary?` 追加(stylist-chat.ts)
3. API route で `intent === "closet"` 分岐 + `fetchClosetContext` + `normalizeColor`
4. system prompt に closet few-shot 1 件追加 + 禁止記述 1 行更新
5. `buildActions("closet")` 拡張(navigate-map 既存転用)
6. 実機検証: 「クローゼット見せて」→ 良い例 2 水準到達

### 1.5b-ii(L4-A 切替検出)
1. `SWITCH_THRESHOLD = 0.85` 定数追加
2. `isSwitchToOtherTarget` + `effectiveContinuing` 算出追加
3. history リセット三項演算
4. 実機検証: diagnose 中に「クローゼット見せて」(85%)→ 自然遷移

### 別 commit(設計判断 6・1.5a 修正で延期した分)
- `scripts/test-stylist-chat-continuity.ts`(連続性 設計調査 7 章で必要性指摘済・1.5a修正の延期 TODO)
- 1.5b 内容も含めた 5 往復 × 2 トピック切替の検証スクリプト

### 別 doc(オーナー判断 5)
- 本体 7.4 コスト試算 再評価(月 ¥77 → ¥250-300 レンジ・複数往復 + 複数 intent 前提)

---

## 付録 A. ai/page.tsx 改修 diff サマリ(1.5b-ii・L4-A 切替)

```diff
  const sessionIntent = getSessionIntent(messages);
  const isContinuingSession =
    sessionIntent !== null && STYLIST_CHAT_INTENTS.has(sessionIntent);

+ // L4-A 切替検出(1.5b-ii)
+ const SWITCH_THRESHOLD = 0.85;
+ const isSwitchToOtherTarget =
+   isContinuingSession
+   && data.ok && data.reason === undefined
+   && typeof data.intent === "string"
+   && STYLIST_CHAT_INTENTS.has(data.intent)
+   && data.intent !== sessionIntent
+   && typeof data.confidence === "number"
+   && data.confidence >= SWITCH_THRESHOLD;
+
+ const effectiveContinuing = isContinuingSession && !isSwitchToOtherTarget;

- const isStylistTarget = isContinuingSession || (
+ const isStylistTarget = effectiveContinuing || (
    data.ok && data.reason === undefined
    && typeof data.intent === "string"
    && STYLIST_CHAT_INTENTS.has(data.intent)
  );

  if (isStylistTarget) {
-   const intentToSend = isContinuingSession ? sessionIntent! : (data.intent as string);
+   const intentToSend = effectiveContinuing ? sessionIntent! : (data.intent as string);
-   const recentHistory = buildStylistHistory(messages);
+   const recentHistory = isSwitchToOtherTarget ? [] : buildStylistHistory(messages);
    ...
  }
```

**正味追加: +10 行 / 1.5a 累計から +40 行**(ai/page.tsx)。

API 側 route.ts は **+30 行程度**(intent 分岐 + `fetchClosetContext` + `normalizeColor` + 集計関数)。
