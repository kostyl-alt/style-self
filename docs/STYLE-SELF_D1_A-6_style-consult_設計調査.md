# STYLE-SELF D1 — A-6 style-consult intent 設計調査(MVP-1c 残 5 intent 第 1 弾)

- 作成日: 2026-05-23
- 起点 HEAD: `566e3b2`(A-10 実装完了・`origin/main` 整合・clean)
- 本 doc の役割: A-6 着手前の **静的解析中心の設計調査**(本体・コード・他 doc 0 変更)
- 上位連結:
  - ロードマップ [§3.6 / §11.1 優先 3](./STYLE-SELF_D1_ビジョン完全達成_ロードマップ.md)
  - MVP-1c coordinate 実装作法(`182c25b`)+ 段階 A 修正作法(`2ef689e`)を完全踏襲
  - A-4 三重防御基盤(`66dd5bb`)+ A-10 Knowledge OS 共通注入(`566e3b2`)の上に構築
- 実装方針: **既存 v1 `/api/ai/style-consult` API は無変更**(本 A-6 は段階 B `stylist-chat` への style-consult 追加のみ)

---

## 1. 背景

### 1.1 ビジョン的位置づけ
- 最終ビジョン `df36d82` で示される対話型 reply:
  - 「自分の世界観に合うコーデを作って」(coordinate 寄りだが「相談」要素含み)
  - 「低身長だけどロングコートを着たい」(典型的な style-consult)
  - 「服選びの相談」「アドバイスして」「悩んでる」型(汎用的な style-consult)
- A-10 完遂(`566e3b2`)で Knowledge OS 共通注入が確立した → **style-consult も同経路で自動的に KOS 統合される**(追加実装不要)

### 1.2 coordinate(MVP-1c)との関係 — A-6 着手の論理順
- coordinate = 「**具体的に組む**」(「黒系で印象に残るコーデを組んで」)
- style-consult = 「**相談・悩み解消**」(「○○を着たいけど合わない」「アドバイス欲しい」)
- ★ 段階 A プロンプトの境界判定が **本 A-6 の最重要設計ポイント**(2ef689e で coordinate の境界精緻化を実証した作法を踏襲)

### 1.3 不可侵境界線(ロードマップ §12 + 本セッション再宣言)
1. 既存 DB 直接触らず・既存 API 経由のみ
2. M2-3 / M4-2 / M5 列絞り / view / coreTags 並列 を迂回しない
3. 既存 API 入出力契約を変更しない(★ 既存 v1 `/api/ai/style-consult` は **無変更**)
4. `/u/[id]` / `/p/[id]` 公開 URL 構造 不変
5. 旧画面 redirect shim 不削除
6. `worldview_tags` 英語スラッグ非露出(★ A-4 三重防御 + A-10 入口/出口 二段 sanitize 維持)
7. `service_role` 不使用(本人 RLS のみ)
8. ★ ③ 専章 / ③ コスト管理 / Phase 2 後ゲート diff 0 行

---

## 2. 現状実装サマリ(静的解析)

### 2.1 段階 A `lib/prompts/overlay-intent.ts` の style-consult description(現状)
- 行 24: `- style-consult       : 着こなしの相談がしたい(体型・身長等の悩み解消)`
- 行 54: mode マッピング = `api`(coordinate / match-users 等と同列)
- ★ **境界明示行なし**(coordinate は行 44-50 で `[★ coordinate / virtual-coordinate / tryon 境界判定ルール]` を持つが、style-consult には専用ブロックなし)

### 2.2 段階 B `STYLIST_CHAT_INTENTS` 現状
- `app/api/ai/stylist-chat/route.ts:60`(MVP-1c で確定)
  ```typescript
  const STYLIST_CHAT_INTENTS = new Set<string>(["diagnose", "closet", "coordinate"]);
  ```
- `app/(app)/ai/page.tsx:79` 同形(★ 両側同期コメント済)
- ★ A-6 で **`"style-consult"` を追加 → 4 intent 化**

### 2.3 既存 v1 `/api/ai/style-consult` API(★ A-6 では無変更・参考)
- [app/api/ai/style-consult/route.ts](../app/api/ai/style-consult/route.ts)(70 行)
- データソース: `users.body_profile + style_preference + style_analysis`(3 列絞り SELECT)
- 出力: **構造化 JSON**(`{analysis, adjustments{silhouette,length,weightCenter,color,material,shoes,accessories,sizing}, keyPoints[], itemsToFind[], avoidPoints[], preferenceNote}`)
- 用途: `components/style/StyleTabs.tsx:880` の `ConsultTab` で結果カード表示
- ★ **本 A-6 とは別経路**(stylist-chat = 自然文 reply・v1 = 構造化 JSON・両立)
- ★ A-6 では `users.body_profile + style_preference` を **同形パターンで段階 B contextData に流す**

### 2.4 ★ 重要発見: `past_consultations` 専用テーブルは存在しない
- `grep past_consultations supabase/ types/ app/` → **0 件**
- 過去相談は `ai_history` テーブル(`016_ai_history.sql`)に `type='consultation'` で保存される単一保管庫
- ★ A-6 では **`ai_history` を context として読まない**(発話継続性は L3 sessionIntent + N=3 history で既に成立・追加 SELECT はコスト + 複雑さの割に効果が薄い)

### 2.5 MVP-1c coordinate 実装パターン(`182c25b`)抽出
- `fetchCoordinateContext`(route.ts:284-302)= `Promise.all([fetchDiagnoseContext, fetchClosetContext, users.body_profile])`
- prompt 分岐(stylist-chat.ts:127-173)= worldview + body + closet の 3 セクション統合
- few-shot 行 49-51:「黒系で静かだけど印象に残る…」型 1 件
- 段階 A 修正(`2ef689e`)= virtual-coordinate narrow 化 + coordinate broad 化 + 案 Z 例文 + 判定ルール

### 2.6 既存 system プロンプト(stylist-chat.ts)の保持義務
- 行 25-39: 人格 / 構成 / **★ 絶対禁止(英語スラッグ 31 語 + 内部 ID + jsonb キー名 + 他人情報 + URL)**
- 行 39 末尾: 「MVP-1c 段階の対象は『診断振り返り』『クローゼット集計の振り返り』『コーデ提案』の **3 種類** のみ」
- 行 41-51: 良い例 1-3(diagnose / closet / coordinate)
- 行 53-54: A-10 で追加した参考情報の扱い(2 行)
- ★ A-6 では:
  - 行 39 の「**3 種類**」→「**4 種類**(着こなし相談を追加)」に拡張(1 字差分)
  - 良い例 4(style-consult)を 1 件追加
  - 既存 31 語禁止 + 良い例 1-3 + A-10 参考情報行は **完全保持**

---

## 3. style-consult の本質(coordinate 境界判定)

### 3.1 発話パターン分類

| 発話例 | 想定 intent | 判定キー |
|---|---|---|
| 「黒系で印象に残るコーデを組んで」 | coordinate | 「組む」「組み合わせ」「コーデ」+ 具体条件 |
| 「コーデ提案して」 | coordinate | 直接的な提案要求 |
| 「服選びの相談したい」 | style-consult | 「相談」+ 漠然と |
| 「アドバイスして」 | style-consult | 「アドバイス」 |
| 「低身長だけどロングコートを着たい」 | style-consult | 「○○だけど○○を着たい」型の悩み |
| 「○○に困ってる / 悩んでる」 | style-consult | 悩み訴求 |
| 「○○が似合わない気がする」 | style-consult | 自信不足の相談 |
| 「サイズ感が分からない」 | style-consult | 着方の不安 |

### 3.2 ★ 段階 A プロンプト修正の最重要ポイント(2ef689e 作法踏襲)

`OVERLAY_INTENT_PROMPT` の現行行 44-50 の「★ coordinate / virtual-coordinate / tryon 境界判定ルール」ブロックを **拡張**:

```
[★ coordinate / style-consult / virtual-coordinate / tryon 境界判定ルール]
判定の優先順位は上から順に評価する:
1. 視覚化・試着の要求(「これ着てみたい」「自分に着せて」)→ tryon
2. concept または scene キーワード明示の翻訳設計(「『○○』のコンセプトで」「○○シーン用に変換」)→ virtual-coordinate
3. 「相談」「アドバイス」「悩み」「困ってる」「○○だけど○○を着たい」「○○が似合わない」「サイズ感」型 → style-consult
4. 上記に該当しない日常コーデ提案(色・雰囲気・テイスト・アイテム指定を含む)→ coordinate

★ 重要: 「組む」「組み合わせ」「コーデにしたい」等の日常表現は具体条件付きでも virtual に流さず coordinate に分類する(既存・2ef689e で確定)
★ 重要 (A-6): 「相談」「アドバイス」「悩み」が明示的に含まれる場合は **悩み解消が主目的** とみなして style-consult に分類する(コーデ「組む」表現が同時に含まれていても、相談要素が強ければ style-consult を優先)
```

### 3.3 段階 A description 精緻化案(行 24)

現行: `- style-consult       : 着こなしの相談がしたい(体型・身長等の悩み解消)`
↓
案: `- style-consult       : 服選び全般の相談・悩み・アドバイス要求(体型・身長・サイズ・似合わない不安など)`
                            `例:「ロングコートを着たい」「服選びで困ってる」「サイズ感が分からない」`

---

## 4. fetchStyleConsultContext 設計

### 4.1 データソース(★ 既存 v1 と同形で列絞り SELECT)

| ソース | 取得列 | 三重防御 (1) 列絞り | 既存比較 |
|---|---|---|---|
| `worldview_profiles.result` | `name,keywords,core,ideal`(jsonb 列絞り) | ✅ | diagnose 既存と完全同形 |
| `users.body_profile` | `body_profile` 1 列 | ✅ | coordinate 既存と完全同形 |
| `users.style_preference` | `style_preference` 1 列 ★ A-6 新規 | ✅ | v1 が同じ取得方法 |
| `users.avoid_items` | `avoid_items` 1 列 ★ A-6 任意 | ✅ | Sprint 47 で追加・style-consult に直結 |
| Knowledge OS | A-10 共通注入 | ✅ 入口/出口 二段 sanitize | 追加実装不要 |

★ **`wardrobe_items` は読まない**(coordinate と違って style-consult は手持ち服より体型/好みベースの悩み解消が主目的・読み込みコスト削減)
★ **`ai_history` も読まない**(L3 sessionIntent + N=3 history で会話継続性は既に十分・コスト + 複雑さの割に効果薄)

### 4.2 実装案(MVP-1c coordinate の `Promise.all` パターン踏襲)

```typescript
async function fetchStyleConsultContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<StylistChatContext> {
  const [diagCtx, userRow] = await Promise.all([
    fetchDiagnoseContext(supabase, userId),
    supabase
      .from("users")
      .select("body_profile, style_preference, avoid_items")
      .eq("id", userId)
      .maybeSingle() as unknown as Promise<{ data: {
        body_profile: unknown; style_preference: unknown; avoid_items: unknown
      } | null }>,
  ]);
  return {
    worldviewName:     diagCtx.worldviewName,
    worldviewKeywords: diagCtx.worldviewKeywords,
    coreIdentity:      diagCtx.coreIdentity,
    idealSelf:         diagCtx.idealSelf,
    bodyProfile:       extractBodyProfile(userRow?.data?.body_profile),
    stylePreference:   extractStylePreference(userRow?.data?.style_preference),  // ★ 新規 extractor
    avoidItems:        extractAvoidItems(userRow?.data?.avoid_items),            // ★ 新規 extractor
  };
}
```

### 4.3 `StylistChatContext` 型拡張(`lib/prompts/stylist-chat.ts`)

```typescript
export interface StylistChatContext {
  // 既存 4 セクション ...
  // ★ A-6 新規(style-consult 用・他 intent は undefined)
  stylePreference?: {
    likedColors:        string[];
    dislikedColors:     string[];
    likedMaterials:     string[];
    dislikedMaterials:  string[];
    likedSilhouettes:   string[];
    dislikedSilhouettes: string[];
    targetImpressions:  string[];
    avoidImpressions:   string[];
  };
  avoidItems?: string[];
  // knowledgeOS は A-10 で追加済(共通注入)
}
```

★ 型は v1 `StylePreference` から **stylist-chat reply に必要な 8 フィールドだけ抽出**(残り 5 フィールドは構造化 JSON 用なので不要)

---

## 5. few-shot 3 件設計(★ ビジョン df36d82 例文から選定)

### 5.1 良い例 4(汎用相談 — 「服選びで悩んでる」型)
```
user: 「最近、自分に何が似合うか分からなくなってる」
AI: 「もう少しだけ教えてください。『今までよく着てた服に飽きてきた』のか、『新しい雰囲気を試したいけど自信がない』のか、『体型変化で今までの服が合わない』のか、どれが一番近いですか?方向が掴めたら、あなたの世界観と体型に合わせた具体的な提案ができます。」
```

### 5.2 良い例 5(★ ビジョン例文 — 「低身長だけどロングコート」型)
```
user: 「低身長だけどロングコートを着たい」
AI: 「ロングコート、低身長でもしっかり着られます。鍵は『縦比率の演出』です。ハイウエストのボトムスを合わせて重心を上げる、コートの色をボトムスと同系色にして縦のラインを切らない、足元は厚底かポインテッドトゥで縦に伸ばす。この 3 つを組み合わせると、ロングコートが『着られている』ではなく『着こなしている』印象になります。」
```

### 5.3 良い例 6(★ ビジョン例文 — 「自分の世界観に合うコーデを作って」型・★ coordinate との境界例)
```
user: 「自分の世界観に合うコーデを作ってほしいんだけど、何から相談すればいい?」
AI: 「相談の入口は 3 つあります。『今ある服で組み合わせを考えたい』なら手持ち服の相性を見ます、『新しく買い足したい』なら世界観に合う 1 着を提案します、『TPO に合わせて変えたい』ならシーン別の調整を考えます。今日の発話だとどれが近いですか?」
```

### 5.4 system プロンプト差分(★ 最小化)

行 39 の `「MVP-1c 段階の対象は… 3 種類のみ」` を:
```
「MVP-1c+1 段階の対象は『診断振り返り』『クローゼット集計の振り返り』『コーデ提案』『着こなし相談』の 4 種類のみ」
```
に拡張(1 字差分・「3 種類」→「4 種類」+「『着こなし相談』」追加)。良い例 4-6 を行 51 直後に追加。

---

## 6. リグレッションテスト拡張計画(case S1-S5)

### 6.1 想定 case(★ A-10 case K の流儀踏襲)

| case | 検証内容 | assertion 想定 |
|---|---|---|
| S1 | `STYLIST_CHAT_INTENTS` に `"style-consult"` 含まれる + page.tsx と同期 | 2-3 |
| S2 | `buildStylistChatUserMessage` で `intent="style-consult"` 時に文脈ブロックヘッダ「【文脈(本人のみ・着こなし相談…)】」が出る | 3-5 |
| S3 | style-consult ctx で `stylePreference` / `avoidItems` フィールドが user message に出る(例: 「好きな色: 黒、白」「避けたい: 派手な柄」)| 3-5 |
| S4 | 三重防御維持: `stylePreference.likedColors` に英語スラッグ含めた mock → user message 内で `stripCanonicalSlugs` 等価式で除去確認(★ ただし stylePreference は日本語値前提・防御確認のみ)| 5-10(31 語 × 1 経路)|
| S5 | A-10 KOS 統合: `intent="style-consult"` でも KOS ブロック注入を確認(case K5 の 3 intent を 4 intent に拡張)| 1 |
| L1-L4(任意) | L4-A 切替検出: 4 intent 四角(diagnose↔closet↔coordinate↔style-consult)で切替動作が高信頼で動く | 4-8 |

### 6.2 PASS 数想定
- 現状: **266 PASS**(A-10 完了時)
- A-6 追加: **+15-30 assertion** → **281-296 PASS** 想定
- ★ A-10 で 31 語イテレーションが約 100 件加算されたが、A-6 は新規経路が 1 つ追加されるだけなのでイテレーションは控えめ

---

## 7. 規模見当

| ファイル | 想定行数 | 内訳 |
|---|---|---|
| `lib/prompts/overlay-intent.ts` | **+10-20** | style-consult description 精緻化 +5-8 / 境界判定ルールに style-consult 行追加 +5-10 |
| `app/api/ai/stylist-chat/route.ts` | **+40-60** | `STYLIST_CHAT_INTENTS` 拡張 +1 / `fetchStyleConsultContext` 新規 +20-30 / 3 intent 分岐 → 4 intent 分岐 +5-10 / `extractStylePreference` + `extractAvoidItems` ヘルパ +15-20 |
| `app/(app)/ai/page.tsx` | **+1** | `STYLIST_CHAT_INTENTS` 同期更新 |
| `lib/prompts/stylist-chat.ts` | **+45-65** | `StylistChatContext.stylePreference / avoidItems` 型追加 +10-15 / `buildStylistChatUserMessage` に style-consult 分岐 +25-35 / few-shot 3 件 +20-30 / system 1 文修正 +1-2 |
| `scripts/test-stylist-chat-continuity.ts` | **+30-50** | case S1-S5 |
| **合計** | **+126-196 行** | 起点指示「+115-195 行」と整合 |
| 実装時間 | **50-80 分** | 起点指示「45-75 分」と整合(段階 A 修正 + few-shot + テスト)|

---

## 8. 既存達成への影響評価

| 達成項目 | 想定影響 |
|---|---|
| 1.5b 完成形 / race fix v2 / L4-A | **0**(コード 0 変更)|
| A-2 / A-3 / MVP-1c coordinate / A-4 三重防御 / A-10 KOS | **0**(既存ロジック不変)|
| 既存 v1 `/api/ai/style-consult` + `ConsultTab` UI | **0**(別経路・無変更)|
| L4-A 切替検出 | **★ 3 intent 三角 → 4 intent 四角に自動拡張**(`STYLIST_CHAT_INTENTS` Set 拡張で全切替パターンが自動有効化・追加実装不要)|
| リグレッションテスト | 266 → 281-296 PASS 想定 |
| コスト管理 (③コスト) | 段階 B 流入増(style-consult 発話分)・¥0.50/相談級・案 P1 範囲内 |
| ③ 専章 / Phase 2 後ゲート | **diff 0 行**(★ 厳守) |
| 既存設計判断 1-10 | **文言不変**(★ 厳守) |

---

## 9. 三重防御 維持(★ A-4 + A-10 基盤の上に同形構築)

| 層 | 既存(A-4 / A-10)| A-6 同形再適用 |
|---|---|---|
| (1) 列絞り SELECT | 3 reply 経路で worldview_tags 列を SELECT 句に書かない | `fetchStyleConsultContext` で `body_profile, style_preference, avoid_items` のみ列絞り(★ worldview_tags 列を SELECT 句に書かない)|
| (1) 入口 sanitize | A-10 で KOS 戻り値に `stripCanonicalSlugs` 適用 | ★ そのまま流用(本 A-6 で追加処理なし・KOS は 4 intent 共通注入)|
| (2) system 明示禁止 | 既存 31 語禁止行 + A-10 KOS 無視指示 + 日本語強制 | ★ 完全保持(本 A-6 で system 改変は 1 字 + few-shot 3 件のみ・禁止行に影響なし)|
| (3) 出力フィルタ | `stripCanonicalSlugs(replyRaw)` で reply 全文 31 語動的削除 | ★ そのまま流用(intent に依存しない・style-consult reply にも自動適用)|
| 動的検証 | `[d]` + `[k-3]` で 31 語 全件除去 | ★ case S4 で **`stylePreference` / `avoidItems` 経路の防御確認**(31 語 × 1-2 経路 = +5-10 assertion)|

---

## 10. Step 分割(実装フェーズ・★ 推奨 11 段階)

| Step | 内容 | 想定時間 |
|---|---|---|
| 1 | `lib/prompts/overlay-intent.ts` で style-consult description 精緻化 + 境界判定ルールに style-consult 行追加 | 5-10 分 |
| 2 | `app/api/ai/stylist-chat/route.ts` `STYLIST_CHAT_INTENTS` に `"style-consult"` 追加 + `app/(app)/ai/page.tsx` 同期 | 2 分 |
| 3 | `fetchStyleConsultContext` 新規追加(MVP-1c coordinate と同形 `Promise.all`)+ `extractStylePreference` / `extractAvoidItems` ヘルパ追加 | 10-15 分 |
| 4 | 3 intent 分岐 → 4 intent 分岐統合(if-else を switch 化 or 三項拡張)| 5 分 |
| 5 | `lib/prompts/stylist-chat.ts` `StylistChatContext.stylePreference / avoidItems` 型追加 + `buildStylistChatUserMessage` に style-consult 分岐追加 + system 1 字修正 | 10-15 分 |
| 6 | few-shot 3 件追加(良い例 4-6)| 5-10 分 |
| 7 | `npx tsc --noEmit` → EXIT 0 | 2 分 |
| 8 | リグレッションテスト拡張(case S1-S5)| 10-15 分 |
| 9 | テスト実行 → **281-296 PASS** 確認 | 2 分 |
| 10 | 実機 verify(オーナー実施推奨・「ロングコートを着たい」「服選びで悩んでる」「コーデを組んで」3 発話で intent 分類精度確認 + reply 品質 + KOS 統合確認)| 10 分 |
| 11 | commit(push しない)| 3-5 分 |
| **合計** | | **64-94 分**(中央値 ≒ 75 分・起点指示 45-75 分と概ね整合)|

---

## 11. リスク + エッジケース

### 11.1 coordinate vs style-consult 境界の LLM 解釈予測不能性
- ★ **最大リスク**: 「黒系のコーデを相談したい」型は両方の特徴を持つ
- 設計 §3.2 の境界ルール: **「相談」「アドバイス」が明示的に含まれれば style-consult 優先**
- 実機 verify(Step 10)で 3-5 発話の境界を確認・必要に応じて段階 A プロンプト追加修正(2ef689e と同型・別 commit 可)

### 11.2 `past_consultations` テーブル未存在 ★ 重要発見
- 起点指示で言及あったが **実体なし**(grep 0 件)
- 過去相談は `ai_history.type='consultation'` に保管
- 本 A-6 では `ai_history` も読まない判断(L3 sessionIntent + N=3 history で十分・追加 SELECT のコスト + 複雑さ回避)
- 将来「過去相談を踏まえて再相談」UX が必要になったら別 Sprint で `ai_history` SELECT 追加(本 A-6 ではスコープ外)

### 11.3 L4-A 4 intent 四角での切替テスト
- 現在 3 intent 三角 = 6 方向(`d↔c, d↔co, c↔co` 各双方向)
- 4 intent 四角 = 12 方向(追加 6 方向 = `d↔s, c↔s, co↔s` 各双方向)
- ★ case L1-L4(任意)で 4 intent 切替の代表 4 方向だけ検証(全 12 方向は冗長)
- L4-A の `SWITCH_THRESHOLD=0.85` ロジックは intent 数に依存しない → **自動拡張**(MVP-1c で確認済)

### 11.4 既存 v1 `/api/ai/style-consult` との競合
- 同じ user 発話で **段階 B(stylist-chat)に流れる + v1 API は呼ばれない**(段階 B が成功する限り)
- v1 は `ConsultTab` UI(構造化 JSON カード)からの直接呼出専用 → ★ 自然な棲み分け(チャット = 自然文・カード UI = 構造化)

### 11.5 `style_preference` jsonb の未登録時
- `users.style_preference` は **任意フィールド**(NULL あり得る)
- `extractStylePreference` で null → undefined 返却 → buildMessage で「・好み: 未登録」表示
- ★ 既存 `extractBodyProfile` と同形パターン

---

## 12. 推奨案

### 12.1 推奨実装方針
- 段階 A 修正(`2ef689e`)+ MVP-1c coordinate 実装(`182c25b`)+ A-4 三重防御(`66dd5bb`)+ A-10 KOS 共通注入(`566e3b2`)の **4 つの作法を完全踏襲**
- 規模 **+126-196 行 / 64-94 分**(起点指示 +115-195 行 / 45-75 分と概ね整合)
- リグレッションテスト **266 → 281-296 PASS**(case S1-S5 + 任意 L1-L4)
- few-shot 3 件はビジョン `df36d82` 例文から選定(汎用相談 / 低身長ロングコート / 世界観相談入口)

### 12.2 ★ 縮小案(規模を起点指示内に収めたい場合)
- few-shot を 2 件に縮小(「ロングコート」+「服選びで悩んでる」)
- 任意 L1-L4 を省略 → S1-S5 のみ
- 規模 **+100-150 行 / 50-70 分**

### 12.3 ★ 拡大案(MVP-1c 残 5 intent をまとめて投入したい場合)
- 本 A-6 で style-consult のみ → 続いて A-6b(virtual-coordinate)、A-6c(product-match)、A-6d(match-users)、A-6e(brand-learn)を順次
- 1 intent 1 commit の作法(M5 教訓・原則 3・刻む)
- ★ **推奨は段階的(A-6 = style-consult 単体 → 検証 → A-6b 着手)**

---

## 13. 結論

| 観点 | 結論 |
|---|---|
| 規模 | **+126-196 行 / 64-94 分**(中央値 ≒ 75 分)|
| 既存達成保持 | 1.5b 完成形 / race fix v2 / L4-A / A-2 / A-3 / MVP-1c / A-4 / A-10 / 既存 v1 style-consult API **全保持** |
| 三重防御 | (1)(2)(3) + 入口/出口 二段 sanitize を **★ そのまま流用**(stylist-chat ロジック不変・新規経路にも自動適用)|
| リグレッションテスト | 266 → **281-296 PASS** 想定 |
| コスト | 段階 B 流入増 ¥0.50/相談級・案 P1 範囲内 |
| L4-A 切替検出 | 3 intent 三角 → **4 intent 四角に自動拡張**(`STYLIST_CHAT_INTENTS` Set 拡張のみ)|
| 重要発見 | `past_consultations` 専用テーブル ★ 不在 → `ai_history.type='consultation'` を本 A-6 では読まない判断 |
| ★ 推奨実装順 | Step 1-11(本 doc §10)・段階 A 修正 + MVP-1c + A-4 + A-10 の 4 作法完全踏襲 |
| 次工程 | A-6 完遂後 → A-6b virtual-coordinate(同形パターン)→ A-6c product-match … → A-6 完了で Phase 1 中盤完成 |

---

## 14. 制約遵守チェックリスト

- [x] 新規 docs ファイル 1 件のみ(本 doc)
- [x] 本体 `ac834bb` / コード(app/api/lib/scripts/package.json/tsconfig.json)/ doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `a62a36c` / A-4 設計案 `66dd5bb` / A-10 設計案 `9bfb0cc` / A-10 実装 `566e3b2` / 他 docs **全 0 変更**
- [x] view + grep + 静的解析のみ・実装なし
- [x] 既存設計判断 1-10 文言不変
- [x] ③ 専章 / ③ コスト / Phase 2 後ゲート diff 0 行
- [x] tsc 通る前提(本 doc は markdown のみ・コード変更なしのため tsc 影響なし)
- [x] commit はあり / push はなし
