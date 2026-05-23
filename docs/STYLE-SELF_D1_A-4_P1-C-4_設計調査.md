# STYLE-SELF D1 — A-4 P1-C-4 設計調査(チャットコマンド + 到達点検 + プライバシー漏洩点検)

- 作成日: 2026-05-23
- 起点 HEAD: `a62a36c`(`origin/main` 整合・clean)
- 本 doc の役割: A-4 着手前の **静的解析中心の設計調査**(本体・コード・他 doc 0 変更)
- 上位連結: [章 3.4 / 11.1 優先 1](./STYLE-SELF_D1_ビジョン完全達成_ロードマップ.md#34-a-4-p1-c-4--チャットコマンド--到達点検--プライバシー漏洩点検)
- 並走連結: [章 3.10 / 11.1 優先 2](./STYLE-SELF_D1_ビジョン完全達成_ロードマップ.md#310--a-10-knowledge-os-連携-整合性点検-ddb86f7-ギャップ-c緊急性最高)(A-10 実装前のプライバシー基盤確認の役割も兼ねる)
- 実装方針: **静的解析(view + grep)+ 実機 verify + リグレッションテスト 119 PASS 維持**

---

## 1. 背景

### 1.1 直近の完遂状況
- **A-1**(`ac834bb`): doc7 ①知る再定義 最小統合(本体 +14 行)
- **A-2**(`59fa4d6`): BottomNav / OverlayFab / OverlayModal 廃止(-632 行・案 A タブなし完全チャット型物理実装)
- **A-3**(`11cf3de`): MenuDrawer + ChatPage [≡] + 新しいチャット(navigate 7 + new-chat + placeholder 2 = 10 項目)
- **MVP-1c**(`182c25b` + `2ef689e`): coordinate intent 投入で段階 B 対象が 3 intent(`{diagnose, closet, coordinate}`)に拡張
- **整合性点検**(`ddb86f7`)→ **ロードマップ最小改訂**(`a62a36c`)で A-10 / 横断 TODO 4 件を追加・優先順序を案 Y(優先 1+2 並走)に確定

### 1.2 A-4 の位置づけ
- Sprint A 残工程の **優先 1**(20-30 分・小)
- A-2 で BottomNav 廃止後の **到達経路実証**
- A-3 で MenuDrawer 7 navigate 項目を投入したことによる **対応関係の整理**
- MVP-1c 3 intent 拡大後の **プライバシー漏洩点検**
- ★ A-10(Knowledge OS 連携・段階 B reply 品質向上)着手前に **プライバシー基盤に問題ないか確認** する役割を兼ねる

### 1.3 不可侵境界線(ロードマップ章 12 準拠・本セッションで再宣言)
1. 既存 DB 直接触らず・既存 API 経由のみ
2. M2-3 / M4-2 / M5 列絞り / view / coreTags 並列 を迂回しない
3. 既存 API 入出力契約を変更しない
4. `/u/[id]` / `/p/[id]` 公開 URL 構造 不変
5. 旧画面ファイル(redirect shim)を Phase 1 で削除しない
6. `worldview_tags` 英語スラッグ非露出(M2-3 / M4 教訓・三重防御維持)
7. `service_role` 不使用(本人 RLS のみ)
8. ★ **③ プライバシー専章 / ③ コスト管理 / Phase 2 後ゲート diff 0 行**

---

## 2. 現状確認サマリ(静的解析・view 結果)

### 2.1 [app/(app)/ai/page.tsx](../app/(app)/ai/page.tsx) `handleSubmit` の経路分岐(抜粋)
- 行 187 `/api/overlay/intent` 段階 A は **常に呼ぶ**(L1 並列案・将来の話題切替検出ログ用)
- 行 206-216 直前 reply の `sessionIntent` を取り出して L3 セッション継続判定 + L4-A `SWITCH_THRESHOLD=0.85` 切替検出
- 行 221-226 段階 B 対象判定: `effectiveContinuing || (data.ok && data.reason===undefined && STYLIST_CHAT_INTENTS.has(intent))`
- 行 228-271 対象なら `/api/ai/stylist-chat` を叩いて自然文 reply に置換(失敗時は `intent-result` フォールバックで退行ゼロ)
- 行 274 対象外は ★ 従来通り **`intent-result`(NavigateConfirm / NoneNotice / SuggestionList / ApiHybridPlaceholder)** で表示
- 行 286-290 `executeNavigate`: `resolveNavigateTarget(intent)` → `router.push(target.url)`
- 行 294-299 `handleNewChat`(P1-C-3 案 A シンプル・race fix v2 整合)

### 2.2 [lib/overlay/navigate-map.ts](../lib/overlay/navigate-map.ts) `NAVIGATE_MAP` 9 entries 全件

| # | key intent | 遷移先 URL | 文言(description)|
|---|---|---|---|
| 1 | `diagnose` | `/onboarding` | 世界観診断を始めます |
| 2 | `worldview-profile` | `/self?tab=diagnosis` | あなたの世界観プロフィールを開きます ★ タブ命名トリック吸収 |
| 3 | `create-post` | `/self/new-post` | 投稿作成画面を開きます |
| 4 | `my-posts` | `/self?tab=posts` | あなたの投稿一覧を開きます |
| 5 | `closet` | `/outfit?tab=closet` | クローゼットを開きます |
| 6 | `saved` | `/saved` | 保存済みを開きます |
| 7 | `history` | `/self?tab=history` | AI履歴を開きます |
| 8 | `body-edit` | `/self?tab=body` | 体型情報の編集画面を開きます |
| 9 | `preference-edit` | `/self?tab=worldview` | 好みの編集画面を開きます ★ タブ命名トリック吸収 |

### 2.3 [components/chat/MenuDrawer.tsx](../components/chat/MenuDrawer.tsx) `MENU_ITEMS` 10 件
(navigate 7 + action 1 + placeholder 2 = 10、表示順)

| # | kind | intent / id | label | 配線先 |
|---|---|---|---|---|
| 1 | navigate | `worldview-profile` | あなたの世界観 | `/self?tab=diagnosis` |
| 2 | navigate | `closet` | クローゼット | `/outfit?tab=closet` |
| 3 | navigate | `saved` | 保存 | `/saved` |
| 4 | navigate | `history` | 履歴 | `/self?tab=history` |
| 5 | navigate | `body-edit` | 身体 | `/self?tab=body` |
| 6 | navigate | `preference-edit` | 好み | `/self?tab=worldview` |
| 7 | placeholder | `avoid` | 避けたい | 準備中(クリックで閉じる) |
| 8 | navigate | `my-posts` | 投稿 | `/self?tab=posts` |
| 9 | action | `new-chat` | 新しいチャット | `confirm()` + `setMessages([])` + `removeItem` |
| 10 | placeholder | `settings` | 設定 | 準備中(クリックで閉じる) |

### 2.4 段階 A intent 列挙 vs 段階 B 対象
- [app/api/overlay/intent/route.ts:27-33](../app/api/overlay/intent/route.ts#L27-L33) `ALLOWED_INTENTS` = 21 個(18 機能 + 将来 2 + unknown)
- [app/api/ai/stylist-chat/route.ts:52](../app/api/ai/stylist-chat/route.ts#L52) `STYLIST_CHAT_INTENTS` = `{diagnose, closet, coordinate}`(MVP-1c 完成・UI 側 `app/(app)/ai/page.tsx:79` と完全一致・両側同期コメント済)

---

## 3. 全画面到達経路マトリクス(★ 検証本体)

### 3.1 (app) 配下ディレクトリ実体 18 件(`ls app/(app)/`)
**注**: 起点指示の「19画面」は内訳列挙(18 dir)と差分あり。本調査で実体カウントを再確認した結果 **18 dir**(2026-05-23 時点)。
オーナー差分があれば実装 Step 1 で再確認する。

### 3.2 page.tsx 単位 22 ファイル(redirect shim 含む)

| # | path | 種別 | 直 URL | チャットコマンド | MenuDrawer | 公開 | 備考 |
|---|---|---|---|---|---|---|---|
| 1 | `(app)/ai/page.tsx` | チャットメイン | ✅ `/ai` | (本体) | (本体) | — | ★ 起動デフォルト(`app/page.tsx` → onboarding 完了 → `/ai`)|
| 2 | `(app)/home/page.tsx` | 既存 | ✅ `/home` | ❌ | ❌ | — | A-5 で世界観カード等を /ai に集約予定 |
| 3 | `(app)/discover/page.tsx` | 既存 | ✅ `/discover` | ❌ | ❌ | — | tab=inspiration / learn / culture |
| 4 | `(app)/saved/page.tsx` | 既存 | ✅ `/saved` | ✅ `saved` | ✅「保存」 | — | navigate 配線済 |
| 5 | `(app)/outfit/page.tsx` | 既存 | ✅ `/outfit` | ✅ `closet`(?tab=closet)| ✅「クローゼット」 | — | navigate 配線済(tab パラメータ経由) |
| 6 | `(app)/self/page.tsx` | 既存 | ✅ `/self` | ✅ 4 経路 | ✅ 4 経路 | — | tab=diagnosis/posts/history/body/worldview を 4 intent でカバー |
| 7 | `(app)/self/new-post/page.tsx` | 新規 | ✅ `/self/new-post` | ✅ `create-post` | ❌ | — | navigate-map にあるが MenuDrawer から呼べない(★ 後述 4 §) |
| 8 | `(app)/onboarding/page.tsx` | 既存 | ✅ `/onboarding` | ✅ `diagnose` | ❌ | — | reply 補助 action「診断を始める →」+ /(public)/u/[id] フッターから到達可 |
| 9 | `(app)/admin/knowledge/page.tsx` | 管理 | ✅ `/admin/knowledge` | ❌ | ❌ | — | middleware ADMIN_EMAILS allowlist で保護 |
| 10 | `(app)/admin/products/page.tsx` | 管理 | ✅ `/admin/products` | ❌ | ❌ | — | 同上 |
| 11 | `(app)/admin/products/new/page.tsx` | 管理 | ✅ `/admin/products/new` | ❌ | ❌ | — | 同上 |
| 12 | `(app)/dev/diagnosis-preview/page.tsx` | dev | ✅ `/dev/diagnosis-preview` | ❌ | ❌ | — | dev/* は middleware appRoutes 未登録(認証ガード非対象)|
| 13 | `(app)/dev/exif-test/page.tsx` | dev | ✅ `/dev/exif-test` | ❌ | ❌ | — | 同上 |
| 14 | `(app)/closet/page.tsx` | redirect shim | ✅ `/closet` | (`closet` intent は新ルートへ) | (同) | — | → `/outfit?tab=closet` |
| 15 | `(app)/coordinate/page.tsx` | redirect shim | ✅ `/coordinate` | — | — | — | → `/outfit` |
| 16 | `(app)/inspire/page.tsx` | redirect shim | ✅ `/inspire` | — | — | — | → `/discover?tab=inspiration` |
| 17 | `(app)/learn/page.tsx` | redirect shim | ✅ `/learn` | — | — | — | → `/discover?tab=learn` |
| 18 | `(app)/profile/page.tsx` | redirect shim | ✅ `/profile` | — | — | — | → `/self` |
| 19 | `(app)/shop/page.tsx` | redirect shim | ✅ `/shop` | — | — | — | → `/outfit?tab=virtual` |
| 20 | `(app)/style/page.tsx` | redirect shim | ✅ `/style` | — | — | — | → `/outfit*`(tab 別)|
| 21 | `(app)/wardrobe/page.tsx` | redirect shim | ✅ `/wardrobe` | — | — | — | → `/outfit?tab=closet` |
| 22 | `(app)/worldview/page.tsx` | redirect shim | ✅ `/worldview` | — | — | — | → `/self?tab=worldview` |
| 23 | `(public)/u/[userId]/page.tsx` | 公開 | ✅ `/u/[id]` | ❌(本人専用ではない) | ❌ | ✅ 独立 layout | 厳格 view + pickPublicFields マスク(M2-3) |
| 24 | `(public)/p/[postId]/page.tsx` | 公開 | ✅ `/p/[id]` | ❌ | ❌ | ✅ 独立 layout | 列絞り SELECT(M3-4) |

### 3.3 到達不能(★ ゼロ件 = 全画面到達可能を構造的に証明)
- 18 ディレクトリ × 22 page.tsx 全件で **★ 直 URL は全て到達可能**(redirect shim も新ルートへ吸収)
- A-2 後の到達経路実証: BottomNav 廃止後も **直 URL + チャットコマンド + MenuDrawer + 公開 layout** の合計 4 経路で機能した状態を維持

### 3.4 到達経路の重複度合い
- `/self*` 系: 直 URL + 4 つの navigate-map intent(`worldview-profile` / `my-posts` / `history` / `body-edit` / `preference-edit`)+ MenuDrawer 6 navigate 項目で **高重複・冗長で安心**
- `/outfit?tab=closet`: 直 URL + `closet` intent + MenuDrawer + 旧 `/closet` / `/wardrobe` 2 redirect shim
- `/onboarding`: 直 URL + `diagnose` intent + 公開 /u/[id] フッター CTA(複数経路で必着・★ 起動 default 含む)
- `/admin/*` `/dev/*`: 直 URL のみ(MVP では UI からは到達しない設計・想定通り)
- `/home` `/discover`: 直 URL のみ(★ チャットコマンドからも MenuDrawer からも経由しない・後述 §4 で考察)

---

## 4. MenuDrawer 7 navigate vs navigate-map 9 entries 対応関係

### 4.1 マッピング(★ 表で重複・欠落を明示)

| # | navigate-map intent | MenuDrawer に含まれるか | label(MenuDrawer)|
|---|---|---|---|
| 1 | `diagnose` | ❌ | — |
| 2 | `worldview-profile` | ✅ | あなたの世界観 |
| 3 | `create-post` | ❌ | — |
| 4 | `my-posts` | ✅ | 投稿 |
| 5 | `closet` | ✅ | クローゼット |
| 6 | `saved` | ✅ | 保存 |
| 7 | `history` | ✅ | 履歴 |
| 8 | `body-edit` | ✅ | 身体 |
| 9 | `preference-edit` | ✅ | 好み |

### 4.2 整理結果
- **navigate-map 9 のうち 7 が MenuDrawer に配線**(`worldview-profile` / `my-posts` / `closet` / `saved` / `history` / `body-edit` / `preference-edit`)
- **MenuDrawer 非配線 = 2 件**:
  - `diagnose` … チャットコマンド「診断したい」+ reply の補助 action「診断を始める →」+ /(public)/u/[id] フッター CTA に分散済(MenuDrawer に出さない判断は正当)
  - `create-post` … 投稿作成は別 UX(将来 A-5 P1-D / A-7 P1-E で再設計予定)
- **MenuDrawer 11 項目内訳の整合**:
  - 「避けたい」(placeholder) … 段階 A intent `avoidItems` 系は存在しない(将来用)
  - 「設定」(placeholder) … 同上(`settings` intent も navigate-map 未登録)
  - 「新しいチャット」(action) … 配線は ChatPage 側 `handleNewChat` のみ・navigate-map とは別軸(正当)
- ★ **重複・欠落の判断**: 現状の 7 配線は MVP 必要十分。`diagnose` / `create-post` を MenuDrawer に追加するかは A-5 P1-D 以降の UI 再設計で判断(本 A-4 ではスコープ外)

---

## 5. プライバシー漏洩点検 範囲 + 静的解析結果

### 5.1 三重防御の維持確認(設計書 4.4 / ロードマップ §12.6)

| # | 層 | 実装箇所 | 静的解析結果 |
|---|---|---|---|
| (1) | 列絞り SELECT(取得経路の構造遮断)| `app/api/ai/stylist-chat/route.ts:206-211, 232, 286-288` | ✅ 3 分岐(diagnose / closet / coordinate)全てで `worldview_tags` 列を SELECT 句に書かない |
| (2) | system prompt で英語スラッグ禁止明示 | `lib/prompts/stylist-chat.ts:34-39` | ✅ 31 語例示 + 「内部 ID」「jsonb キー名」も併せて禁止 |
| (3) | 出力フィルタ `stripCanonicalSlugs` | `app/api/ai/stylist-chat/route.ts:352-373` | ✅ `PRODUCT_WORLDVIEW_TAGS` 直参照で **辞書 31 語の動的反映**(辞書追加が即フィルタに伝播)|

### 5.2 全 reply で worldview_tags 英語スラッグ 31 語 非露出 verify

| reply 種別 | 検証経路 | 静的解析結果 |
|---|---|---|
| diagnose reply | `fetchDiagnoseContext()` 列絞り → system 明示 → `stripCanonicalSlugs` | ✅ 三重防御適用 |
| closet reply | `fetchClosetContext()` `select("category, color")` → 同上 | ✅ 三重防御適用(列絞りで構造遮断・1.5b-i) |
| coordinate reply | `fetchCoordinateContext()` 3 並列(worldview + body_profile + closet)→ 同上 | ✅ 三重防御適用(MVP-1c で追加・1.5b-i 同型) |
| 段階 A intent response `params` | `app/api/overlay/intent/route.ts:110-112` | ⚠️ Claude 出力 `raw.params` を `Record<string, unknown>` でそのまま返す(辞書外 intent は `unknown` に丸める防御あり)。 **params は内部識別子(scene/concept 等の日本語キー)で worldview_tags 英語スラッグは含まれない構造**(プロンプト指示通り)。★ 実機 verify で念のため複数発話で `params` 値を確認 |

### 5.3 public ルート SELECT 列絞り維持確認

| route | SELECT | 漏洩点検 |
|---|---|---|
| `(public)/u/[userId]` worldview_profiles | `.select("result")` + `.eq("is_public", true)` + `pickPublicFields()` で HTML inline マスク | ✅ M2-3 厳格版維持 |
| `(public)/u/[userId]` public_users(厳格 view)| `.select("display_name")` | ✅ INNER JOIN + is_public 二重防御 |
| `(public)/u/[userId]` posts | `.select("id, image_url, caption, worldview_name, created_at")` | ✅ `worldview_tags` `pattern_id` `is_public` `updated_at` 不取得 |
| `(public)/p/[postId]` posts | `.select("id, author_user_id, image_url, caption, worldview_name, worldview_keywords, created_at")` | ✅ `worldview_tags` 不取得(M3-4 列絞り) |

### 5.4 ★ A-10(Knowledge OS 連携)実装前 のプライバシー基盤確認(本 A-4 の 兼務役割)
- A-10 着手時の懸念: `lib/knowledge-os/client.ts` 経由で取得した `getDecisionRules` / `getFailurePatterns` / `getFashionRules` の **戻り値に英語スラッグが含まれる可能性**
- 確認方法(本 A-4 スコープ内・静的のみ):
  1. `lib/knowledge-os/` 配下を grep で `worldview_tags|coreTags` 漏れ点検(将来の Knowledge OS API 戻り型に依存・本 A-4 では型契約の事前合意のみ)
  2. A-10 実装時に **同じ三重防御の 3 段目(`stripCanonicalSlugs`)を必ず再適用** することを A-10 着手時 doc に明記する申し送り
- ★ 本 A-4 で「現状の 3 reply 経路は防御維持」を構造的に証明することで、A-10 着手時の比較ベースを確立できる(回帰判定の基準点)

### 5.5 リグレッションテスト動的検証の追認
- [scripts/test-stylist-chat-continuity.ts](../scripts/test-stylist-chat-continuity.ts) `[d]` ブロック(行 429-)で `PRODUCT_WORLDVIEW_TAGS` を **実物 import → 全件除去** を動的に検証(31 ハードコードなし・辞書追加に即追随)
- 現状ベースライン: **`Total: 119/119 passed`**(本セッション冒頭で再実行確認済)

---

## 6. A-4 実装計画(Step 1-5 段階分割)

### Step 1 — 静的解析(15-20 分)
- [x] navigate-map 9 entries 動作経路の view 確認(本 doc §2.2)
- [x] MenuDrawer 7 navigate 配線の view 確認(本 doc §2.3)
- [x] 全画面到達経路マトリクス作成(本 doc §3.2)
- [x] 三重防御維持点検(本 doc §5.1)
- [x] public ルート SELECT 列絞り維持点検(本 doc §5.3)

### Step 2 — 不足あれば追加修正(★ 規模見当 +5-15 行・任意)
- 現時点で発見した **構造的欠陥はゼロ**(到達不能 0 件・漏洩経路 0 件)
- 追加修正候補(★ 任意 / 別 Sprint 分離可):
  - (案 a)navigate-map に MenuDrawer 11 項目との対応コメント追記(+3-5 行・docs 性質)
  - (案 b)段階 A `params` に英語スラッグ混入防止の sanitize 追加(+5-10 行)
  - 案 a / b いずれも **MVP 必須ではない**(現状で防御は成立)→ 実装時のオーナー判断
- ★ **大規模修正(20 行超)は本 A-4 ではやらず別 Sprint 分離**

### Step 3 — 実機 verify(5-10 分)
- 複数発話で navigate 動作確認:
  - 「診断したい」→ `diagnose` reply(段階 B)+ 「診断を始める →」action → `/onboarding`
  - 「クローゼット見せて」→ `closet` reply + 「一覧で見る →」action → `/outfit?tab=closet`
  - 「黒系で印象に残るコーデにしたい」→ `coordinate` reply
  - 「保存済みを見たい」→ `saved` intent → NavigateConfirm カード → `/saved`
  - 「投稿を作りたい」→ `create-post` intent → NavigateConfirm カード → `/self/new-post`
- MenuDrawer 7 項目 全件クリック → 各画面到達確認
- 各 reply の本文に英語スラッグ非露出を目視確認(`PRODUCT_WORLDVIEW_TAGS` 31 語のいずれも reply に出ない)

### Step 4 — リグレッションテスト 119 PASS 維持(2-3 分)
- `npx tsx scripts/test-stylist-chat-continuity.ts` → **`Total: 119/119 passed`** を確認
- 追加修正(Step 2)が入っていれば必要に応じて test ケース追加

### Step 5 — commit + 知見 docs 追記(3-5 分)
- 本 A-4 で **新規発見の知見がなければ commit は本 doc のみ**(現在のコミット)
- 追加修正(Step 2)があれば別 commit で投入

---

## 7. 既存達成への影響評価

| 達成項目 | コミット | 本 A-4 静的解析時の影響 |
|---|---|---|
| 1.5b 完成形(履歴永続化 race fix v2)| `040078c` | 0(view のみ)|
| L4-A 切替検出 | `60c7fa8` | 0(view のみ)|
| A-2 BottomNav 廃止 | `59fa4d6` | 0(view のみ)|
| A-3 MenuDrawer 投入 | `11cf3de` | 0(view のみ)|
| MVP-1c coordinate 完成形 | `182c25b` + `2ef689e` | 0(view のみ)|
| リグレッションテスト | `3e39f99` | 119 PASS 維持(再実行)|
| 整合性点検 | `ddb86f7` | 0(参照のみ)|
| ロードマップ最小改訂 | `a62a36c` | 0(参照のみ)|
| **③ 専章 / ③ コスト / Phase 2 後ゲート** | 本体 `ac834bb` | **diff 0 行**(★ 厳守)|
| **既存設計判断 1-10** | 本体 `ac834bb` | **文言不変**(★ 厳守)|

---

## 8. A-4 規模見当

| 工程 | 想定時間 |
|---|---|
| 静的解析(Step 1)| 15-20 分(本 doc 作成込み)|
| 追加修正(Step 2)| 0-5 分(発見ゼロ前提)|
| 実機 verify(Step 3)| 5-10 分 |
| リグレッションテスト(Step 4)| 2-3 分 |
| commit + 知見追記(Step 5)| 3-5 分 |
| **合計** | **25-43 分**(中央値 ≒ 30 分)|

- ロードマップ §11.1 優先 1 想定の **20-30 分** と概ね整合
- 想定外の漏洩経路が見つかった場合は **別 Sprint 分離**(本 A-4 では発見 + 報告に留める)

---

## 9. A-10 実装前提との関係(★ 本 A-4 の兼務役割)

- A-4 が「現状の 3 reply 経路で三重防御が成立している」ことを構造的に証明することで、A-10 着手時に以下を **同型で再確認** すれば足りる:
  1. Knowledge OS 戻り値(`getDecisionRules` 等)を `contextData` に統合した後も **`stripCanonicalSlugs` の 3 段目フィルタが reply 全文に適用される** ことを ★ 再 verify
  2. Knowledge OS contextData に英語スラッグが混入する設計なら、stylist-chat 側で **取り込み時に sanitize** する(三重防御の (1) 列絞り相当の構造遮断を Knowledge OS API 側にも適用)
  3. リグレッションテスト `[d]` ブロックを **Knowledge OS 経路にも拡張**(reply 全文に 31 語不在を動的検証)
- ★ **A-4 と A-10 は経路独立(A-4 = UI 側 routing / A-10 = API 側 reply 生成)で並走可能**(ロードマップ §11.1 案 Y)
- A-4 完了後の A-10 着手が論理順(プライバシー基盤確認 → 新規 reply 生成器投入)

---

## 10. リスク + エッジケース

### 10.1 チャットコマンド未配線 entry(段階 A 対象 21 intent vs navigate-map 9)
- 段階 A `ALLOWED_INTENTS` 21 個のうち、navigate-map に登録があるのは 9 個(navigate mode のみ)
- 残 12 個は `mode: "api"` `"hybrid"` `"none"` のいずれかで、ChatPage 側で:
  - `api` / `hybrid` → `ApiHybridPlaceholder` カード(D1-2c' / D1-2e' で本配線予定・MVP-1c で `coordinate` は段階 B で会話化済)
  - `none`(`moodboard` / `tryon` / `unknown`)→ `NoneNotice` カード
- ★ **未配線 entry に当たっても UI 側で fallback カードが必ず出る**(404 や白画面にならない)構造的安全策あり

### 10.2 旧画面 redirect shim での表示崩れ・404
- 9 redirect shim 全件で `next/navigation` の `redirect()` を使用 → Next.js が **307/308 で新ルートへ即遷移**(白画面 0)
- `style/page.tsx` のみ `searchParams.tab` 分岐(`virtual` / `consult` / `saved` / その他)を持つが、全パターンで新ルートに吸収済

### 10.3 公開ルート /u /p の独立性
- `(public)/layout.tsx` で **BottomNav 無し・MenuDrawer 無し・(app) layout 非継承** の最小レイアウト
- middleware `appRoutes` に `/u` `/p` は不含 = 認証ガード対象外(意図通り・M2-3 設計)
- フッターに「診断を始める →」CTA → `/onboarding`(認証必要なら middleware が `/login` に redirect)

### 10.4 段階 A `params` の英語スラッグ混入可能性
- `OVERLAY_INTENT_PROMPT` で `params` の中身は intent 別 API body 形に合わせる指示・**英語スラッグ語彙の明示的禁止行は存在しない**
- 実機 verify(Step 3)で複数発話の `params` をブラウザ DevTools で確認(★ 念のため)
- 万が一混入が観測されたら Step 2 (案 b) で sanitize を投入

---

## 11. 推奨案(★ 結論)

1. **静的解析(Step 1)で構造的欠陥は発見ゼロ**(到達不能 0 / 漏洩経路 0)
2. ★ **追加修正なしで実機 verify(Step 3)→ リグレッション再実行(Step 4)→ 本 doc commit(Step 5)で完走可能**
3. 想定全体時間: **25-43 分**(ロードマップ §11.1 優先 1 の 20-30 分と概ね整合)
4. 想定外の漏洩経路が見つかった場合は **別 Sprint 分離**(本 A-4 では発見 + 報告に留める・原則 3 / M5 教訓踏襲)
5. A-4 完了後、優先 2 = **A-10 Knowledge OS 連携** を本 A-4 が確立したプライバシー基盤の上に着手(経路独立 + 並走可能)
6. ★ **本 A-4 では本体・コード・他 doc を 0 変更**(新規 docs 1 件のみ追加 = 本 doc)

---

## 12. 参考: 本 doc の制約遵守チェックリスト

- [x] 新規 docs ファイル 1 件のみ(本 doc)
- [x] 本体 `ac834bb` / コード(app/api/lib/scripts/package.json/tsconfig.json)/ doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `a62a36c` / 他 docs **全 0 変更**
- [x] 静的解析(view + grep)のみ・実装なし
- [x] 既存設計判断 1-10 文言不変
- [x] ③ 専章 / ③ コスト / Phase 2 後ゲート diff 0 行
- [x] tsc 通る前提(本 doc は markdown のみ・コード変更なしのため tsc 影響なし)
- [x] commit はあり / push はなし
