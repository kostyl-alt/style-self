# STYLE-SELF D1 P1-C-1.5 — リグレッションテスト 設計案(1.5a + 1.5b 完成形)

> ★設計案 doc(実装しない・本体設計書 [STYLE-SELF_D1_実装設計.md](./STYLE-SELF_D1_実装設計.md)
> は書き換えない・`scripts/` 配下に新規ファイルも作らない)。
> 実装合意後にオーナー判断で投入工程を決める。
>
> 前提コミット:
> - 本体: `41e9139`(D1 実装設計の Phase 1 P1-C)
> - 1.5a 連続性: `04d6296`(設計案 `0d0f74e` 7 章でリグレッションテスト言及・実装は延期)
> - 1.5b 設計調査: `458c0be`
> - 1.5b-i closet 会話化: `88dea21`
> - 1.5b-i+ 履歴永続化 v1: `33310ea`
> - **race fix v2 案C(useState 化)**: `040078c`
> - **L4-A 切替検出(SWITCH_THRESHOLD=0.85)**: `60c7fa8` ← ★ 1.5b 完成形 HEAD

---

## 0. 背景

1.5a 修正実装時に Anthropic API タイムアウトのためリグレッションテストを延期した。
1.5b 完成形(i + ii)を origin/main に push 完了した今、**1.5b 完成形を退行から守る安全網**
として設計を起こし直す。

延期中に増えた検証対象:
- 1.5a 連続性(`sessionIntent` / `STYLIST_CHAT_INTENTS`)
- 1.5b-i closet 会話化(wardrobe 要約)
- **race fix v2 案C**(`useState` 版 `hydrated` + 多層防御 `parsed.length > 0` /
  `messages.length === 0` / 依存配列 `[messages, hydrated]`)
- **L4-A 切替検出**(`SWITCH_THRESHOLD` / `isSwitchToOtherTarget` /
  `effectiveContinuing` / `history` リセット)

---

## A. 実物確認(コード根拠・HEAD = 60c7fa8)

### A-1. 検証対象ファイル

| パス | 役割 | 1.5 系で追加された関心事 |
|---|---|---|
| [app/(app)/ai/page.tsx](../app/(app)/ai/page.tsx) | UI / handleSubmit / hydrate-persist useEffect | `sessionIntent` / `STYLIST_CHAT_INTENTS={diagnose,closet}` / `SWITCH_THRESHOLD=0.85` / `isSwitchToOtherTarget` / `effectiveContinuing` / `intentToSend` / `recentHistory` 三項演算 / `useState` 版 `hydrated` / 多層防御 |
| [app/api/ai/stylist-chat/route.ts](../app/api/ai/stylist-chat/route.ts) | API 入出力 / 三重防御(列絞り・system 明示・出力フィルタ)/ contextData(diagnose/closet 個別) | `buildStylistChatUserMessage` の出力フィルタ・closet 用 wardrobe SELECT・history 受領 |
| [lib/prompts/stylist-chat.ts](../lib/prompts/stylist-chat.ts) | system プロンプト / 出力フィルタ実装 | PRODUCT_WORLDVIEW_TAGS 31 語直参照の除去ロジック |
| [lib/knowledge/wardrobe-color-systems.ts](../lib/knowledge/wardrobe-color-systems.ts) | `normalizeColor`(closet 集計) | closet 要約の色系統正規化 |
| [lib/knowledge/product-worldview-tags.ts](../lib/knowledge/product-worldview-tags.ts) | `PRODUCT_WORLDVIEW_TAGS` 31 語マスタ | プライバシー検証の真実源 |

### A-2. 既存 `scripts/` 構造(実行方式の参考)

```
scripts/
├── retag-rakuten-products.ts     # 商品再タグ付け
├── seed-m4-test-data.ts          # M4 テストデータ投入
├── teardown-m4-test-data.ts      # M4 テストデータ削除
├── test-analyze-v2.ts            # /api/ai/analyze-v2 スモークテスト(★live 呼出)
├── test-analyze-v2-multi.ts      # 同上 偏り検証(★live 呼出・約5分)
└── test-mcp.ts                   # MCP クライアント単体スモーク
```

**観察された既存パターン**:
- 実行は `npx tsx scripts/test-xxx.ts`(`package.json` の `scripts` には未登録)
- `.env.local` を素朴に `readFileSync` + 正規表現で読み込む(Next.js 起動を模倣)
- live dev server(`localhost:3000`)へ実 `fetch` する **スモークテスト方式**
- `tsconfig` は別途特殊設定なし(`tsx` が直接 TS を実行)
- assertion ライブラリ未使用・`console.log` で結果出力 + 例外 throw で失敗表現

**示唆**: 既存パターンは「smoke + console」。リグレッションテストとして使うなら
**assertion 関数の自前定義 + exit code 制御** を追加するだけで十分。Jest/Vitest 導入は
過剰(devDependency 追加 + tsconfig 追加 + 学習コストで本体に対する diff 増)。

---

## B. テスト実装方式の選択肢

### B-1. 案 A: Jest / Vitest 等 Unit Test フレームワーク

| 項目 | 評価 |
|---|---|
| 長所 | `describe / it / expect` の標準 idiom・watch モード・並列実行・カバレッジ |
| 短所 | **devDependency 大量追加**(本体 package.json 純度低下)・`tsconfig` 追加設定・jsdom 必要・React コンポーネント単体テストの mount 機構が必要 |
| 既存構造との整合 | ★ 低(既存 scripts/ 構造を破壊) |
| 規模 | 大(設定 + テストファイル数で 1000 行超) |

**判定: 不採用**(MVP には過剰投資・既存と乖離)

### B-2. 案 B: API ルート Integration Test(live 呼出)

| 項目 | 評価 |
|---|---|
| 長所 | 実 Claude API 応答で **真の出力フィルタ動作** を検証可能・既存 `test-analyze-v2.ts` パターン踏襲 |
| 短所 | ★ **コスト発生**(段階 A intent 判定 + 段階 B stylist-chat 各 ¥0.5 級 × 往復数 × ケース数 = **¥30〜¥60/run** 級)・レイテンシ大(1 run 数分)・非決定性(LLM 出力ぶれで assertion 不安定)・dev server 起動が前提 |
| 既存構造との整合 | ★ 高(scripts/test-analyze-v2.ts と同形) |
| 規模 | 中(400〜500 行) |

**判定: 部分採用候補**(プライバシー検証だけは実呼出の価値あり・但し非決定性で
assertion 安定化が課題)

### B-3. 案 C: 純粋ロジックテスト(scripts/ + mock)★ 推奨

| 項目 | 評価 |
|---|---|
| 長所 | ★ **コストゼロ**・★ **決定性 100%**(LLM ぶれなし)・既存 scripts/ 構造に完全整合・実装が小さい(400〜600 行)・CI/CD に乗せやすい |
| 短所 | mock と実物の乖離リスク(対策: 実物のフィルタ関数を ★ そのまま import して mock 入力で実行 = 乖離なし)・LLM の主観品質(reply の自然さ)は検証不可 |
| 既存構造との整合 | ★ 高(`npx tsx scripts/test-stylist-chat-continuity.ts`)|
| 規模 | 中(400〜600 行) |

**判定: ★★ 本命採用**

### B-4. 推奨

**案 C(純粋ロジックテスト + mock 主体)** を本命とし、**プライバシー出力フィルタは
実物関数を直接 import** することで「mock 入力 + 実物ロジック」で乖離ゼロを実現。
LLM の主観品質(reply の自然さ・closet 要約の妥当性)は **オーナー実機検証で担保**
(既存ワークフロー継続)。

---

## C. 検証項目(計 10 件)

### 既存(1.5a 連続性 設計案 `0d0f74e` 7 章で言及)

#### a. 1 往復目「診断したい」
- **入力**: `text="診断したい"`・`messages=[]`
- **段階 A mock**: `{intent:"diagnose", confidence:0.95, mode:"navigate"}`
- **段階 B mock**: `{ok:true, reply:"診断を始めますね", actions:[...]}`
- **期待**: `setMessages` 末尾に `kind:"reply"` + `sessionIntent:"diagnose"` の Message が
  保持される(後続の `getSessionIntent` が `"diagnose"` を返す前提条件)

#### b. 2 往復目「似合う服が分からない」
- **入力**: `text="似合う服が分からない"`・直前に a の reply あり
- **段階 A mock**: `{intent:"unknown", confidence:0.3}`(intent ぶれを意図)
- **段階 B mock**: 自然文 reply
- **期待**: `getSessionIntent(messages)="diagnose"` → `isContinuingSession=true` →
  `effectiveContinuing=true`(`isSwitchToOtherTarget` の条件 `STYLIST_CHAT_INTENTS.has` で
  unknown が弾かれ false)→ 段階 B 直行・`intentToSend="diagnose"` 維持

#### c. 5 往復シナリオ:`history N=3` 維持
- **入力**: a/b と同形の往復を 5 回連続
- **期待**: 5 回目の `buildStylistHistory(messages)` 出力が **直近 3 件** のみ
  (`STYLIST_CHAT_HISTORY_MAX=3` の slice が効く・本体 7.4 抑制策一段目維持)

#### d. プライバシー(31 語全件カバー)
- **入力**: `buildStylistChatUserMessage` 等の出力フィルタ関数に
  **`PRODUCT_WORLDVIEW_TAGS` 全 31 語を含む合成 reply 文字列** を渡す
- **期待**: 出力に 31 語が 1 件も残らない(`stripCanonicalSlugs` 系の正規表現が
  全件除去)・各語について個別 assertion(31 アサーション)
- **副次**: フィルタが warning log を出すか(stdout キャプチャで確認)
- **方式**: ★ live API 呼出不要(実物フィルタ関数を直接 import)

#### e. ~~L4=C(MVP-1a)継続セッション維持~~ → **削除**
→ 1.5b-ii で L4=A 切替検出に格上げ(`60c7fa8`)・項目 i のサブケース「L3 対象外
継続維持」に統合済。

#### f. MVP-1b スコープ:対象外 intent は `intent-result` カード
- **入力**: `messages=[]`(新規)+ `text="ブランドを探したい"`
- **段階 A mock**: `{intent:"brand-recommend", confidence:0.9}`(`STYLIST_CHAT_INTENTS`
  外の高信頼)
- **期待**: `isStylistTarget=false` → 段階 B を呼ばず・`replaceMessage` で
  `kind:"intent-result"` を投入(従来 P1-C-1 挙動・1 文字も変えない)

### 新規(1.5b 完成形 = i + ii 向け)

#### g. 1.5b-i closet 会話化
- **入力**: `text="クローゼット見せて"`・`messages=[]`
- **段階 A mock**: `{intent:"closet", confidence:0.95}`
- **段階 B mock**: `{ok:true, reply:"ブラック系のトップス 5 件・アウター 3 件が
  あります。組みますか?一覧見ますか?", actions:[...]}`
- **wardrobe SELECT mock**: 13 点(ブラック系トップス 5/アウター 3/ボトムス 2/
  バッグ 3)
- **期待**: `setMessages` 末尾に `kind:"reply"` + `sessionIntent:"closet"` 保持・
  reply に「ブラック系」「トップス」「アウター」キーワード含む(closet 要約が
  AI に届いた証拠)

#### h. ★ race fix v2 検証(履歴永続化・案 C)

3 サブケースに分割:

**h-1. hydrate 復元**
- **準備**: `localStorage.setItem("style-self:ai:messages:v1", JSON.stringify(<長い履歴>))`
- **実行**: ChatPage 相当の hydrate useEffect を simulate(初回 mount)
- **期待**: `setMessages` が呼ばれて `messages` が復元値と一致・`setHydrated(true)` が
  続く

**h-2. persist 書込 + 空配列ガード**
- **ケース h-2-α**: `hydrated=true` + `messages=[m1, m2]` → `localStorage.setItem` 呼ばれ
  値が `[m1, m2]` の JSON
- **ケース h-2-β**: `hydrated=true` + `messages=[]` → `setItem` 呼ばれない
  (`messages.length === 0` 早期 return)★ race fix v2 核心
- **ケース h-2-γ**: `hydrated=false` + `messages=[m1]` → `setItem` 呼ばれない
  (`!hydrated` 早期 return)

**h-3. 空配列復元防止(hydrate 側多層防御)**
- **準備**: `localStorage.setItem(key, "[]")`(過去のバグで残された空配列)
- **実行**: hydrate
- **期待**: `setMessages` は呼ばれない(`parsed.length > 0` 条件で弾く)

> 注: StrictMode 二重実行の検証は test では再現困難。useState/useEffect の simulate
> で「同期 setState → 次 render で hydrated=true 反映 → persist effect 走行時点で
> guard 効く」というシーケンスを検証する。

#### i. ★ L4-A 切替検出(1.5b-ii)

4 サブケースに分割:

**i-1. target 内切替(diagnose → closet)**
- **入力**: diagnose 会話中(`sessionIntent="diagnose"`)+ `text="クローゼット見せて"`
- **段階 A mock**: `{intent:"closet", confidence:0.95}`(`>=SWITCH_THRESHOLD=0.85`)
- **期待**: `isSwitchToOtherTarget=true` → `effectiveContinuing=false` → 新セッション
  closet・`intentToSend="closet"`・`recentHistory=[]`(空配列・diagnose 履歴は AI に
  渡らない)・UI 側 `messages` 表示は残る

**i-2. 逆方向切替(closet → diagnose)**
- 上と対称(`sessionIntent="closet"` + closet 中に「診断したい」)
- **期待**: `intentToSend="diagnose"`・`recentHistory=[]`

**i-3. L3 対象外 intent 継続維持(★ 自動実現の証明)**
- **入力**: diagnose 会話中 + `text="コーデ提案して"`
- **段階 A mock**: `{intent:"coordinate", confidence:0.92}`(高信頼だが
  `STYLIST_CHAT_INTENTS` 外)
- **期待**: `isSwitchToOtherTarget=false`(2 番目条件 `STYLIST_CHAT_INTENTS.has(coordinate)`
  で false)→ `effectiveContinuing=true` → 継続維持・`intentToSend="diagnose"` 不変・
  `recentHistory=buildStylistHistory(messages)`(履歴あり)・★ `intent-result` カードに
  戻らない

**i-4. L2 低信頼継続(SWITCH_THRESHOLD の保守設定が効く)**
- **入力**: diagnose 会話中 + 曖昧な closet 系発話
- **段階 A mock**: `{intent:"closet", confidence:0.7}`(`< 0.85`)
- **期待**: `isSwitchToOtherTarget=false`(4 番目条件 `confidence >= SWITCH_THRESHOLD`
  で false)→ 継続維持・`intentToSend="diagnose"` 不変

---

## D. mock vs 実呼出(再整理)

| 検証項目 | mock 推奨 | 実呼出推奨 | 理由 |
|---|---|---|---|
| a〜c, f, g, h, i | ★ | | UI 側 routing / state / 履歴永続化は **決定性 100%** で検証可能・LLM 呼ぶ意味なし |
| d(プライバシー 31 語) | ★ | | 実物フィルタ関数を import して合成入力 → 乖離ゼロ・コストゼロ |
| reply の自然さ / closet 要約品質 | | ー | ★ オーナー実機検証で担保(既存ワークフロー)・テスト対象外 |

**結論**: 全件 mock(実物フィルタ関数だけ直接 import)で十分。実呼出は不要。

---

## E. ファイル設計

### E-1. 新規ファイル

`scripts/test-stylist-chat-continuity.ts`
(命名は 1.5a 設計案 `0d0f74e` で確定済)

### E-2. 構造(骨子)

```ts
// scripts/test-stylist-chat-continuity.ts
//
// P1-C-1.5 リグレッションテスト(1.5a 連続性 + 1.5b 完成形 + race fix v2 + L4-A)
// 実行: npx tsx scripts/test-stylist-chat-continuity.ts
// 方式: mock 主体・LLM/API 呼ばない・実物フィルタ関数だけ import
// 終了コード: 全件成功で 0・1 件でも失敗で 1

import { stripCanonicalSlugs } from "../lib/prompts/stylist-chat"; // ★ 実物 import
import { PRODUCT_WORLDVIEW_TAGS } from "../lib/knowledge/product-worldview-tags";

// --- assertion helper(Jest 不要)---
let pass = 0, fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log("  ✅", label); pass++; }
  else      { console.log("  ❌", label); fail++; }
}

// --- mock 機構 ---
type FetchMock = (url: string, init?: RequestInit) => Promise<Response>;
function makeFetchMock(handlers: Record<string, (body: unknown) => unknown>): FetchMock { ... }
function makeLocalStorageMock() { ... }

// --- handleSubmit 相当ロジック ---
// app/(app)/ai/page.tsx の handleSubmit 計算部分を「テスト可能な純粋関数」に
// 切り出した simulator(本体は不変・テスト側で再現する責務)
function simulateHandleSubmit(state, input, fetchMock) { ... }
function simulateHydratePersist(localStorageMock, initialMessages) { ... }

// --- ケース定義 ---
const CASES = [
  { id: "a", label: "1 往復目 diagnose", run: () => { ... } },
  { id: "b", label: "2 往復目 sessionIntent 継続", run: () => { ... } },
  { id: "c", label: "5 往復 history N=3 維持", run: () => { ... } },
  { id: "d", label: "プライバシー 31 語全件除去", run: () => {
      const synthetic = `これは ${PRODUCT_WORLDVIEW_TAGS.join(" ")} を含む合成 reply`;
      const filtered = stripCanonicalSlugs(synthetic);
      for (const tag of PRODUCT_WORLDVIEW_TAGS) {
        assert(!filtered.includes(tag), `tag "${tag}" 除去`);
      }
    } },
  { id: "f", label: "対象外 intent → intent-result", run: () => { ... } },
  { id: "g", label: "closet 会話化 + wardrobe 要約", run: () => { ... } },
  { id: "h-1", label: "hydrate 復元", run: () => { ... } },
  { id: "h-2-α", label: "persist 通常書込", run: () => { ... } },
  { id: "h-2-β", label: "persist 空配列ガード(★ race fix v2 核心)", run: () => { ... } },
  { id: "h-2-γ", label: "persist hydrate 前ガード", run: () => { ... } },
  { id: "h-3",   label: "hydrate 側空配列復元防止", run: () => { ... } },
  { id: "i-1", label: "L4-A 切替 diagnose→closet", run: () => { ... } },
  { id: "i-2", label: "L4-A 切替 closet→diagnose", run: () => { ... } },
  { id: "i-3", label: "L3 対象外 intent 継続維持", run: () => { ... } },
  { id: "i-4", label: "L2 低信頼継続", run: () => { ... } },
];

// --- main ---
for (const c of CASES) {
  console.log(`\n[${c.id}] ${c.label}`);
  try { await c.run(); }
  catch (err) { fail++; console.log("  ❌ 例外:", err); }
}
console.log(`\n=== ${pass} pass / ${fail} fail ===`);
process.exit(fail === 0 ? 0 : 1);
```

### E-3. `package.json` 登録

既存 scripts(`test-analyze-v2.ts` 等)が **未登録のまま `npx tsx` 直接実行** されている
ため、整合性のため未登録のまま。手動で `npx tsx scripts/test-stylist-chat-continuity.ts`。

将来 CI/CD に乗せる時に `"test:continuity": "tsx scripts/test-stylist-chat-continuity.ts"`
を追加する余地は残す(本 doc では追加しない)。

### E-4. `handleSubmit` simulator の方針

`app/(app)/ai/page.tsx` の handleSubmit は React state に強く依存しているため、
**そのまま import して呼ぶことは不可**。

選択肢:
1. ★ **simulator を書く**(handleSubmit の routing 部分のロジックをテスト側で再現)
   - 短所: 本体と乖離するリスク → コメントで「本体が変わったら simulator も更新」明記
   - 長所: 純粋関数・React 不要・実装容易
2. handleSubmit の routing 計算部分を ★ 本体側で純粋関数に切り出して export
   - 短所: 本体に diff が発生(`60c7fa8` を 1 行も触らない原則と衝突)
   - 長所: 乖離ゼロ
3. React Testing Library で実 ChatPage を mount
   - 短所: jsdom / @testing-library/react 等 devDependency 追加 + jest 等が必要(案 A に逆戻り)

**推奨: 案 1**(simulator)+ コメントで連動更新を明記。将来本体が大きく変わるなら
案 2(本体リファクタ + 純粋関数 export)に格上げ。

---

## F. 規模見当 + 実装時間

| 区分 | 行数見当 |
|---|---|
| import / helper(assert・fetch mock・localStorage mock)| 80 |
| simulator(handleSubmit 相当)| 100 |
| simulator(hydrate-persist useEffect 相当)| 60 |
| ケース a〜c, f, g | 各 30〜40 行 × 5 = 175 |
| ケース d(プライバシー)| 30(31 語ループだけ) |
| ケース h-1〜h-3(計 5 サブ)| 各 30 行 × 5 = 150 |
| ケース i-1〜i-4(4 サブ)| 各 30 行 × 4 = 120 |
| 集計 + exit | 20 |
| **合計** | **約 600〜650 行** |

**実装時間見当**: 1.5〜2 時間
- simulator 設計 + helper 30 分
- ケース実装 60 分
- 動作確認(全件 pass まで)15 分
- ドキュメント reflection(本 doc 更新)15 分

---

## G. リスク + エッジケース

| # | リスク | 対策 |
|---|---|---|
| 1 | simulator と本体実装の乖離 | E-4 案 1 を採用する場合、ファイル冒頭で
  「本体 `app/(app)/ai/page.tsx` の handleSubmit / useEffect が変わったら本ファイルも
   更新」を ★ 明記。本体変更 PR の review check に追加。 |
| 2 | StrictMode 二重実行を test で再現困難 | useState/useEffect simulator 内で
  「初回 mount 時に effect が 1 回走り、state 更新 → 次 render で再評価」のシーケンスを
   明示的に書く。StrictMode 完全再現は諦める(オーナー実機検証で担保)。 |
| 3 | mock 入力が実 Claude API 応答とずれる | プライバシーケース(d)だけは ★ 実物
  フィルタ関数を import するため乖離ゼロ。それ以外の routing 検証は **本来 Claude
  非依存** のロジック(intent 判定後の分岐 + history 構築 + state 遷移)なので
  mock で問題なし。 |
| 4 | テストが古くなる地雷 | ファイル冒頭コメントで「前提コミット(`60c7fa8`)」を明記。
  本体が大きく変わったら simulator を破棄して新規書き直し前提(MVP の安全網と割り切る)。 |
| 5 | `PRODUCT_WORLDVIEW_TAGS` 31 語が将来増減する | 31 語のハードコードはせず、
  import した配列を `.length` で動的に検証(増減に追従)。 |
| 6 | `localStorage` mock の挙動が実ブラウザと微妙にずれる | `setItem`/`getItem` の
  最小実装(in-memory Map)で十分(race fix v2 検証で必要な機能は read/write 一致のみ)。 |
| 7 | `STYLIST_CHAT_INTENTS` / `SWITCH_THRESHOLD` が将来追加・変更 | テスト側は
  ★ 本体から import して使う(ハードコードしない)→ 自動追従。 |

---

## H. 三重防御維持の確認(設計案 `0d0f74e` 7 章の継承)

| 防御層 | 1.5b 完成形でも維持か | テスト検証 |
|---|---|---|
| 列絞り SELECT | ★ 維持(API 側 contextData 取得は毎リクエスト不変)| 対象外(API 側責務) |
| system 明示禁止 | ★ 維持(system prompt 不変)| 対象外(`lib/prompts/stylist-chat.ts` の system 文字列 grep で軽く確認可能) |
| 出力フィルタ 31 語 | ★ 維持(`stripCanonicalSlugs` 等)| ★ **ケース d で 31 語全件 assertion** |
| `buildStylistHistory` 自然文抽出 | ★ 維持・★ 1.5b-ii で **切替時は空配列に置換** | ケース i-1/i-2 で `recentHistory=[]` を assertion |

---

## I. 次工程(本 doc では実装しない)

1. オーナーレビュー → 案 C(mock 主体)で合意
2. simulator の細部設計(handleSubmit の何を「純粋」とみなすか)を別 doc または直接
   実装で詰める
3. 実装: `scripts/test-stylist-chat-continuity.ts` 新規(約 600 行・1.5〜2 時間)
4. CI/CD 連携(将来工程・MVP-2 以降で判断)
5. 本体 `app/(app)/ai/page.tsx` が変わった時の simulator 連動更新ルールを CHANGES.md
   に明記

---

## 付録 A. ケース a〜i 対応マトリクス

| ケース | 検証対象 commit | 防御する退行 |
|---|---|---|
| a | `04d6296`(1.5a) | sessionIntent 保持失敗 → 1 往復で会話切断 |
| b | `04d6296` | `getSessionIntent` 失敗 → 2 往復目で intent-result に戻る |
| c | `04d6296` | `STYLIST_CHAT_HISTORY_MAX=3` slice 失敗 → コスト膨張 |
| d | 本体 7.4 / `04d6296` | フィルタ退行 → 英語スラッグ露出 |
| f | 本体 P1-C-1 | 対象外 intent の表示退行 |
| g | `88dea21`(1.5b-i) | closet 会話化退行 |
| h-1〜h-3 | `040078c`(race fix v2) | localStorage `[]` 上書き再発 |
| i-1〜i-4 | `60c7fa8`(L4-A) | 切替検出退行 / L3 対象外維持の退行 / L2 保守設定退行 |

---

## 付録 B. 本 doc が ★ しないこと

- ❌ `scripts/test-stylist-chat-continuity.ts` の実装
- ❌ 本体 `41e9139` / `60c7fa8` への diff
- ❌ `package.json` の `scripts` への登録
- ❌ Jest/Vitest 等 devDependency の追加
- ❌ オーナー実機検証で担保されている品質項目(reply の自然さ・closet 要約妥当性)の
  自動化

実装合意後に上記を別工程で実行する。
