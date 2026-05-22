# STYLE-SELF D1 MVP-1c coordinate intent 設計調査(オーナー指摘 2 解決準備)

> ★ 設計調査 doc(実装しない・本体 [STYLE-SELF_D1_実装設計.md](./STYLE-SELF_D1_実装設計.md) `ac834bb` は書き換えない)。
> 上位ロードマップ: [STYLE-SELF_D1_ビジョン完全達成_ロードマップ.md](./STYLE-SELF_D1_ビジョン完全達成_ロードマップ.md) 章 3.6 **A-6 MVP-1c** の最初の Sprint(`fe8e15d`)
>
> 前提コミット: `11cf3de`(A-3 完遂・MenuDrawer + 新しいチャット機能 投入完了)

---

## 1. 背景

### 1.1 オーナー指摘 2
A-3 push 後オーナーから「コーデ提案 対話化」要請。1.5b 完成形(`60c7fa8`)では `STYLIST_CHAT_INTENTS = {diagnose, closet}` の 2 intent のみ会話化されており、`coordinate` 等のコーデ系発話は intent-result カードに落ちる(オーナー良い例 3「黒系で静かだけど印象に残るコーデ」水準を達成できていない)。

### 1.2 本 Sprint のスコープ
- ロードマップ A-6(MVP-1c 残 6 intent 会話化)の **最初の単体 Sprint**
- 投入対象: **coordinate のみ**(`style-consult` / `virtual-coordinate` / `product-match` / `match-users` / `match-posts` 等は別 Sprint)
- 1.5b 完成形に **3 intent 目** として追加・L4-A 切替検出は自動的に 3 intent 間の切替に拡張

---

## 2. 現状確認サマリ(実物確認結果)

### 2.1 段階 A intent 候補(`app/api/overlay/intent/route.ts:27-33`)
```ts
const ALLOWED_INTENTS = new Set<string>([
  "diagnose", "worldview-profile", "coordinate", "style-consult",
  "virtual-coordinate", "product-match", "match-users", "match-posts",
  "create-post", "my-posts", "closet", "inspiration", "brand-learn",
  "culture", "saved", "history", "body-edit", "preference-edit",
  "moodboard", "tryon", "unknown",
]);
```
★ `coordinate` は **既に段階 A の候補に含まれる**(4 番目)・新規追加不要

### 2.2 過去実機での coordinate 判定挙動
- 本セッション内「コーデ提案して」発話で L3 対象外継続維持(リグレッションテスト i-3 ケース)が正常動作した実績
- 段階 A LLM プロンプトで `coordinate` が高信頼で返ることが推定される(confidence >= 0.7 = `CONFIDENCE_THRESHOLD`)
- **MVP-1c 投入後の confidence 計測** は実機検証で要 verify(本 Sprint 実装後の点検項目)

### 2.3 stylist-chat route 現状構造
- [app/api/ai/stylist-chat/route.ts:115-119](../app/api/ai/stylist-chat/route.ts#L115-L119):
```ts
let ctx: StylistChatContext;
if (intent === "closet") {
  ctx = await fetchClosetContext(supabase, userId);
} else {
  ctx = await fetchDiagnoseContext(supabase, userId);
}
```
→ intent switch が 2 分岐(closet / else=diagnose)。MVP-1c で coordinate 分岐追加が必要。

- `fetchDiagnoseContext` (line 197-218): `worldview_profiles` から jsonb 列絞り SELECT(`worldviewName` / `worldview_keywords` / `coreIdentity` / `idealSelf`)
- `fetchClosetContext` (line 222-258): `wardrobe_items` から `category, color` のみ列絞り SELECT(★ 三重防御 1 維持)

### 2.4 `body_profile` 存在確認 → ✅ **存在する**
- [supabase/migrations/014_body_profile.sql](../supabase/migrations/014_body_profile.sql): `users.body_profile jsonb` 列追加済(M5 / Sprint 32 由来)
- [lib/prompts/concept-translate.ts:81-99](../lib/prompts/concept-translate.ts#L81-L99) で実装パターン確立済:
```ts
if (bodyProfile) {
  lines.push(`身長: ${bodyProfile.height}cm`);
  lines.push(`体型: ${bodyProfile.bodyType} / 骨格: ${bodyProfile.skeletonType}`);
  if (bodyProfile.concerns.length) { /* ... */ }
  if (bodyProfile.proportionNote) lines.push(`補足: ${bodyProfile.proportionNote}`);
}
```
→ MVP-1c で同パターン踏襲・`users` テーブルから `body_profile` jsonb を列絞り SELECT

### 2.5 lib/prompts/stylist-chat.ts 現状
- 149 行・`STYLIST_CHAT_SYSTEM_PROMPT` + `buildStylistChatUserMessage` + 型定義
- **★ system プロンプト L24**:「MVP-1b 段階の対象は『診断振り返り』と『クローゼット集計の振り返り』の 2 種類のみ。それ以外の話題(★コーデ提案・着せ替え・保存一覧・トレンド翻訳など)には深入りせず…」
  → ★ **MVP-1c で必須更新**(さもないと AI が coordinate 要求を拒否する)
- `buildStylistChatUserMessage` (line 84-) は `intent === "closet"` / else(diagnose)の 2 分岐
- ★ オーナー良い例 3(coordinate「黒系で静かだけど印象に残る…」)は **未投入**(本体 ac834bb には記載のみ)

### 2.6 STYLIST_CHAT_INTENTS の同期箇所
| 箇所 | 現状 | MVP-1c 後 |
|---|---|---|
| [app/(app)/ai/page.tsx:78](../app/(app)/ai/page.tsx#L78) | `Set(["diagnose", "closet"])` | `Set(["diagnose", "closet", "coordinate"])` |
| `app/api/ai/stylist-chat/route.ts` の同名 Set | 同上 | 同上 |
両側同期(設計判断 9・本体 4.7)維持必須

### 2.7 リグレッションテスト i-3 ケース
- [scripts/test-stylist-chat-continuity.ts:592-609](../scripts/test-stylist-chat-continuity.ts#L592-L609):
```ts
// "/api/overlay/intent": () => ({ ok: true, intent: "coordinate", confidence: 0.92 })
// → 対象外 intent → L3 継続維持 検証
```
★ MVP-1c で `coordinate` が **target 入り** → i-3 が ★ **無効化**(coordinate は切替検出対象 intent になる)
→ ★ **i-3 の対象外 intent を別の intent に置き換える**設計必要

---

## 3. coordinate intent 用 contextData 設計

### 3.1 3 ソース統合(worldview + body + wardrobe)
| ソース | テーブル | 列絞り | 担当 |
|---|---|---|---|
| 世界観 | `worldview_profiles` | `worldviewName` / `worldview_keywords` / `coreIdentity` / `idealSelf` | 既存 `fetchDiagnoseContext` 流用可 |
| 体型 | `users.body_profile` jsonb | `height` / `bodyType` / `skeletonType` / `concerns` / `proportionNote` | 新規 SELECT(concept-translate パターン踏襲)|
| クローゼット | `wardrobe_items` | `category` / `color` 集計 | 既存 `fetchClosetContext` 流用可 |

### 3.2 新規 `fetchCoordinateContext` 実装方針
```ts
async function fetchCoordinateContext(supabase, userId): Promise<StylistChatContext> {
  // 3 並列 SELECT(本人 RLS 経由)
  const [diag, closet, bodyRaw] = await Promise.all([
    fetchDiagnoseContext(supabase, userId),  // worldview
    fetchClosetContext(supabase, userId),    // closet
    supabase.from("users").select("body_profile").eq("id", userId).maybeSingle(),
  ]);
  return {
    ...diag,
    closetSummary: closet.closetSummary,
    bodyProfile:   parseBodyProfile(bodyRaw?.data?.body_profile),
  };
}
```

### 3.3 `StylistChatContext` 型拡張
- 既存 fields(`worldviewName` / `worldviewKeywords` / `coreIdentity` / `idealSelf` / `closetSummary?`)に加えて:
- 新規 optional: `bodyProfile?: { height: number; bodyType: string; skeletonType: string; concerns: string[]; proportionNote?: string }`(`concept-translate.ts` の `BodyProfile` 型を再利用 or 同形 inline)

### 3.4 ★ 三重防御維持確認
- ✅ 列絞り SELECT(`worldview_tags` 列は SELECT 句に書かない・経路ゼロ)
- ✅ system プロンプト明示禁止(coordinate few-shot にも英語スラッグ禁止 31 語維持)
- ✅ 出力フィルタ `stripCanonicalSlugs`(31 語動的検証・既存維持)

---

## 4. lib/prompts/stylist-chat.ts 改修方針

### 4.1 system プロンプト L24 の更新(必須)
```diff
-・MVP-1b 段階の対象は「診断振り返り」と「クローゼット集計の振り返り」の 2 種類のみ。それ以外の話題(コーデ提案・着せ替え・保存一覧・トレンド翻訳など)には深入りせず、軽く受け止めて「いまはこの 2 種類のご相談がご一緒できます」と引き戻す
+・MVP-1c 段階の対象は「診断振り返り」「クローゼット集計の振り返り」「コーデ提案」の 3 種類のみ。それ以外の話題(着せ替え・保存一覧・トレンド翻訳など)には深入りせず、軽く受け止めて「いまはこの 3 種類のご相談がご一緒できます」と引き戻す
```

### 4.2 良い例 3 を few-shot 追加(本体 ac834bb 引用)
```
【良い例 3(到達基準・コーデ提案・MVP-1c)】
user: 「黒系で静かだけど印象に残るコーデにしたい」
AI: 「あなたの世界観なら、黒をただ暗く使うより、素材と重心で差を出す方が合います。低光沢の黒、短丈トップス、長めのパンツ、重めの靴で組むと、静かだけど印象に残ります。手持ち服で組みますか?それとも買える商品から探しますか?」
```
+5-8 行

### 4.3 `buildStylistChatUserMessage` の coordinate 分岐
```ts
if (intent === "coordinate") {
  // 世界観 + 体型 + クローゼット集計の 3 セクション統合
  // (worldview_tags / 内部 ID は構造的に含まれない)
}
```
+15-25 行(3 セクション統合)

### 4.4 MVP-1b 文言の更新
- 既存「・段階A 判定 intent: {intent}(MVP-1b の対象 = ...)」を「MVP-1c の対象 = 診断振り返り / クローゼット振り返り / コーデ提案」に更新(2 箇所・既存 if/else 両方)

---

## 5. STYLIST_CHAT_INTENTS 拡張(両側同期)

| 箇所 | 変更 | 行数 |
|---|---|---|
| `app/(app)/ai/page.tsx:78` | `["diagnose", "closet"]` → `["diagnose", "closet", "coordinate"]` | +1 行(同行内)|
| `app/api/ai/stylist-chat/route.ts` 内同名 Set(★ 実物 grep で位置確認要)| 同上 | +1 行 |

★ コメント「MVP-1b」→「MVP-1c」など文言更新(+0 行・内容のみ)

---

## 6. リグレッションテスト 更新方針

### 6.1 i-3 ケースの対象外 intent 置き換え
**現状**: `coordinate` を対象外 intent として使用(L3 継続維持検証)
**MVP-1c 後**: `coordinate` は target 入り → i-3 invalidated

**置き換え候補比較**:
| 候補 | 評価 |
|---|---|
| `style-consult` | 着こなし相談・コーデ近接・将来 target 化候補 → 一時的選定だが MVP-1c の次 Sprint で再置換必要 |
| `virtual-coordinate` | Phase 3 領域・将来も target 化されない可能性高 | 候補 |
| `product-match` | 連鎖系・virtual-coordinate からのみ呼ばれる | 単独発話想定なし |
| **`brand-learn`** | ブランド学習(`/learn` ページ)・会話化されにくい | ★ **推奨**(長期 target 化されない見込み)|
| `inspiration` | 発見系・abstract-coordinate に近い | 候補 |
| `match-users` / `match-posts` | SNS 系 | 候補 |

★ **推奨: `brand-learn`** — 長期にわたって target 化されない確率が最も高い(ブランド学習はチャット完結より一覧表示が自然)

### 6.2 coordinate ケース新規追加(target 入り後の検証)
新規ケース 3-5 件(既存 i-1 / i-2 / i-3 構造を拡張):
- **coord-1**: 初回「コーデ提案して」(target 入り・isStylistTarget=true・段階 B 直行)
- **coord-2**: diagnose 会話中 → coordinate 切替(L4-A 切替検出 3 intent 間で動作確認)
- **coord-3**: closet 会話中 → coordinate 切替(同上)
- **coord-4**: coordinate 会話中 → diagnose 切替(逆方向)
- **coord-5**: coordinate 継続 N=3(history 維持確認)

規模: +30-50 行

### 6.3 既存 i-1 / i-2 ケース確認
- i-1: diagnose → closet 切替(coordinate 無関係)→ 不変
- i-2: closet → diagnose 切替(coordinate 無関係)→ 不変
- i-3: 上記 6.1 で置き換え
- i-4: 低信頼継続(coordinate 関係なし)→ 不変

---

## 7. 全体規模見当

| ファイル | 変更内容 | 規模 |
|---|---|---|
| `lib/prompts/stylist-chat.ts` | system L24 更新・良い例 3 追加・user message coordinate 分岐 | **+30-50 行** |
| `app/api/ai/stylist-chat/route.ts` | STYLIST_CHAT_INTENTS 拡張・fetchCoordinateContext 新規・intent switch 拡張 | **+30-50 行** |
| `app/(app)/ai/page.tsx` | STYLIST_CHAT_INTENTS 拡張(同期) | +1 行 |
| `scripts/test-stylist-chat-continuity.ts` | i-3 置き換え + coordinate ケース 3-5 件追加 | **+30-50 行** |
| **合計** | | **+90-150 行** |
| **実装時間** | | **60-90 分** |

---

## 8. 既存達成への影響評価

| 既存達成 | 影響 | 詳細 |
|---|---|---|
| 1.5b 完成形(`60c7fa8`)| **拡張(退行ゼロ)** | STYLIST_CHAT_INTENTS 拡張・他構造維持・diagnose / closet 経路は完全不変 |
| race fix v2(`040078c`)| **なし** | localStorage 構造不変 |
| L4-A 切替検出(`60c7fa8`)| **★ 拡張**(自動)| 3 intent 間の切替動作に自動拡張・`SWITCH_THRESHOLD` / `isSwitchToOtherTarget` ロジック不変 |
| リグレッションテスト(`3e39f99`)| **★ 更新**(i-3 置換 + coord 新規)| 97 → 約 110-115 assertion |
| A-2(`59fa4d6`)| **なし** | UI layout 不変 |
| A-3(`11cf3de`)| **なし** | MenuDrawer / 新しいチャット 不変 |
| ③ プライバシー専章 | **なし** | UI / API contextData の三重防御維持 |
| ③ コスト管理 | **軽微** | 段階 B 呼出 1 回あたり ¥0.36 + body_profile 1 SELECT 程度・コスト試算 `985d00b` の範囲内 |
| Phase 2 後ゲート | **なし** | 機構不変 |
| 既存 18 機能 | **なし** | UI 別経路 |
| public ルート `/u` `/p` | **なし** | 別 layout |

---

## 9. リスク + エッジケース

| # | リスク | 緩和策 |
|---|---|---|
| 1 | 段階 A で coordinate confidence < 0.7 で MVP-1c が機能しない | 実機検証で計測・必要なら段階 A プロンプトに coordinate 例文追加(別 Sprint)|
| 2 | `body_profile` が null のユーザー(M5 以前登録) | コンセプト翻訳パターン通り「未登録」表示で fallback(章 3.4)|
| 3 | wardrobe_items が空のユーザー | closetSummary.totalItems === 0 で「手持ちなし」会話に切替(良い例 3 後半「買える商品から」フォールバックの動線想定)|
| 4 | i-3 置き換え候補(brand-learn)が後の Sprint で target 化される可能性 | 長期にわたって target 化されにくい intent を選定済・万一 target 化時は別 intent に再置換 |
| 5 | 良い例 3 の AI 出力が「素材と重心」「低光沢」等の表現を再現できない | Haiku → Sonnet 昇格判断(判断 9-2)・実機検証時に評価 |
| 6 | system プロンプト L24 「2 種類のみ」更新漏れで AI が拒否回答 | ★ Step 3 の必須更新項目として明記 |
| 7 | リグレッションテスト coordinate ケースで mock confidence 値の選定 | 既存ケース i-1 / i-2 の 0.95 / 0.9 と整合させ 0.9 推奨 |

---

## 10. 実装手順 Step 分割

| Step | 内容 | 規模 |
|---|---|---|
| 1 | `STYLIST_CHAT_INTENTS` 両側同期拡張(`["diagnose","closet","coordinate"]`)| +2 行(2 ファイル)|
| 2 | `lib/prompts/stylist-chat.ts`: system L24 更新(MVP-1b → MVP-1c・3 種類)| +0 行(文言更新のみ)|
| 3 | `lib/prompts/stylist-chat.ts`: 良い例 3 few-shot 追加 | +5-8 行 |
| 4 | `lib/prompts/stylist-chat.ts`: `buildStylistChatUserMessage` coordinate 分岐追加 | +15-25 行 |
| 5 | `lib/prompts/stylist-chat.ts`: `StylistChatContext` に `bodyProfile?` 追加 | +5-10 行 |
| 6 | `app/api/ai/stylist-chat/route.ts`: intent switch に coordinate 追加 + `fetchCoordinateContext` 新規 | +30-50 行 |
| 7 | `scripts/test-stylist-chat-continuity.ts`: i-3 を `brand-learn` に置き換え | +0 行(値変更のみ)|
| 8 | `scripts/test-stylist-chat-continuity.ts`: coordinate ケース 3-5 件新規追加 | +30-50 行 |
| 9 | `tsc --noEmit` + リグレッションテスト実行(97 → 約 110-115 PASS 想定)| 検証 |
| 10 | 実機確認(良い例 3 水準達成チェック・diagnose/closet/coordinate 三角切替)| 検証 |

合計: **+90-150 行**(設計値の中央付近)・**60-90 分**

---

## 11. ★ 設計者推奨案

### 11.1 推奨セット
| 項目 | 推奨 |
|---|---|
| **STYLIST_CHAT_INTENTS** | `["diagnose", "closet", "coordinate"]`(両側同期)|
| **contextData ソース** | worldview + body_profile + wardrobe(3 並列 SELECT)|
| **system プロンプト** | L24 更新(MVP-1b → MVP-1c・3 種類)+ 良い例 3 few-shot 追加 |
| **user message builder** | `intent === "coordinate"` 分岐追加(3 セクション統合)|
| **i-3 置き換え intent** | **`brand-learn`**(長期 target 化されない見込み)|
| **coordinate 新規ケース** | 3-5 件(初回 / diagnose→coord / closet→coord / coord→diagnose / 継続 N=3)|
| **全体規模** | **+90-150 行** |
| **実装時間** | **60-90 分** |

### 11.2 達成 UX
- オーナー指摘 2「コーデ提案 対話化」解決
- オーナー良い例 3 水準達成(実機検証で評価)
- 3 intent 間の自然な切替(diagnose ↔ closet ↔ coordinate)動作
- リグレッションテスト 97 → 約 110-115 PASS で安全網拡張

---

## 12. 結論

- **MVP-1c coordinate 単体投入**は既存達成を一切覆さず、4 ファイル変更で完了可能
- **規模 +90-150 行**・**実装時間 60-90 分** で 1 セッション内完結
- リスク主要 7 件すべて緩和策あり
- 三重防御維持(列絞り SELECT / system 明示禁止 / 出力フィルタ)を coordinate 経路にも踏襲
- ★ オーナーレビュー後 → A-6 MVP-1c の最初の単体 Sprint として実装着手可能

### 次工程
1. オーナーレビュー → 推奨案確定(特に i-3 置き換え intent = `brand-learn` 採否)
2. MVP-1c coordinate 実装(本 doc Step 1-10・別 commit)
3. 実機検証(良い例 3 水準達成評価)
4. MVP-1c 残 5 intent(style-consult / virtual-coordinate / product-match / match-users / match-posts)の Sprint 計画(別 doc)
