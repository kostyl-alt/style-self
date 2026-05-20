# STYLE-SELF D1 P1-C-1.5a — 会話連続性 設計調査

> ★調査 doc(実装しない・本体設計書 [STYLE-SELF_D1_実装設計.md](./STYLE-SELF_D1_実装設計.md) は書き換えない)。
> オーナー判断項目を整理してレビューを短縮することが目的。

## 0. 背景

P1-C-1.5a(commit 276c48d)実機 FB:

- ✅ **1 往復目**「診断したい」→ オーナー良い例 1 水準の会話文 + 末尾小ボタン到達
  (Haiku で品質 OK・三重防御で英語スラッグ漏れなし)
- ❌ **2 往復目**「似合う服が分からない」
  → 段階 A の intent 判定が `"style-consult"`(信頼度 75%)になる
  → `STYLIST_CHAT_INTENTS = new Set(["diagnose"])` に含まれず段階 B を呼ばず
  → 従来の `intent-result`(NavigateConfirm カード)に戻る = 会話が切れる

### 真因

MVP-1 スコープ設計が「**最初の 1 発話**」だけを想定していた。良い例 1 自体が
複数往復前提(「どれが近いですか?」と聞き返す)なのに、続く発話が他 intent に
判定されてスコープから外れる = 設計の穴。

---

## A. 実物確認(コード根拠)

`commit 276c48d` 時点の確定事実:

### A-1. UI 側([app/(app)/ai/page.tsx](../app/(app)/ai/page.tsx))

```ts
// L60-66: MessageContent 型(intent フィールド無し)
type MessageContent =
  | { kind: "text";          text: string }                          // user 発話
  | { kind: "loading" }
  | { kind: "reply";         text: string; actions?: SuggestionItem[] }
  | { kind: "intent-result"; result: IntentResponse }                 // NavigateConfirm
  | { kind: "error";         message: string };

// L70: UI 側スコープ Set(API 側にも同名の Set あり)
const STYLIST_CHAT_INTENTS = new Set<string>(["diagnose"]);
```

```ts
// L143-211: handleSubmit の現フロー
// 1. POST /api/overlay/intent → data.intent 取得(常に呼ぶ)
// 2. STYLIST_CHAT_INTENTS.has(data.intent) で分岐
//    - true → POST /api/ai/stylist-chat → kind:"reply" に置換
//    - false → kind:"intent-result" に置換(NavigateConfirm カード)
```

```ts
// L304-: buildStylistHistory
// messages から user kind:"text" と assistant kind:"reply" の本文だけを
// {role, text}[] で抽出する。N=3 上限。intent-result は履歴に入れない。
```

### A-2. API 側([app/api/ai/stylist-chat/route.ts](../app/api/ai/stylist-chat/route.ts))

```ts
// L48: API 側スコープ Set(UI と完全一致)
const STYLIST_CHAT_INTENTS = new Set<string>(["diagnose"]);

// L99-105: 入口で intent_out_of_scope を返す
const intent = typeof body.intent === "string" ? body.intent : "";
if (!STYLIST_CHAT_INTENTS.has(intent)) {
  return { ok: false, reason: "intent_out_of_scope" };
}
```

### A-3. 重要な含意

- `kind:"reply"` には **`intent` フィールドが存在しない**
  → 直前の assistant reply がどの intent で生成されたかを後から取れない
- `STYLIST_CHAT_INTENTS` は **UI / API 両側に同名 Set がある**
  → どちらかをスキップしても他方で再度判定される(設計の対称性)
- `buildStylistHistory` は kind=`"reply"` の text のみ抽出
  → reply に intent を載せても history に影響しない(自然文だけ渡る)

---

## B. 設計案(複数論点整理)

### 1. ★並列 vs スキップ

「会話セッション中」(直前メッセージが reply)に **段階 A intent 判定を呼ぶか**。

| | 案 A 並列 | 案 B スキップ |
|---|---|---|
| 段階 A `/api/overlay/intent` 呼び出し | 常に呼ぶ(結果は無視) | 会話中はスキップ |
| 段階 B `/api/ai/stylist-chat` | 呼ぶ(会話中は intent を継承) | 呼ぶ(同左) |
| コスト | 全往復で intent 判定分発生 | 続く発話で intent 判定分節約 |
| 推定差額 | — | 約 ¥0.05/件(8 章) |
| ログ可観測性 | 段階 A 判定 履歴が残る → **将来「話題切替検出」(論点 4-A)の基盤になる** | 段階 A 履歴が失われる |
| 実装変更量 | 分岐 1 箇所追加 | 分岐 1 箇所追加 |
| リスク | 段階 A の遅延が会話全体のレイテンシに加わる(本体実測ベース ~400ms) | 「閉じる条件」を全自動にする道(論点 4-A)が塞がる |

> ★**設計者推奨: 案 A 並列**(段階 A 結果は破棄するが呼ぶ)。
> 理由 3 点:
> 1. ¥0.05/件 × 月 150 相談 × 平均 2 続き発話 ≒ ¥15/月 ← 無視可能なコスト
> 2. 段階 A 履歴は「話題切替検出」(論点 4-A 全自動案)の前提データ。
>    今スキップすると、将来切替検出を入れる時に手戻り発生
> 3. オーナー方針「自然に話しかける体験」を担保するには、将来切替検出が
>    必須機能になる確度が高い → 並列で道を残しておく

---

### 2. ★継続 intent 集合の構成

「セッション中」状態を何で表現するか。

#### 集合のサイズ

MVP-1a では `STYLIST_CHAT_INTENTS = {"diagnose"}` だけが段階 B 対象。
継続 intent 集合は **常に 1 個**(セッション中の唯一の intent)で十分。

1.5b で `{"diagnose", "closet"}` に拡張するとき:

- 案 X: セッション intent は依然 1 個(`diagnose` 会話中は `closet` 発話が来ても無視)
- 案 Y: セッション intent は集合(`{diagnose}` から `{diagnose, closet}` に膨らむ・複数同時)

> ★**設計者推奨: 案 X(セッション intent は 1 個)**。
> 理由: 自然会話は 1 トピックずつ。集合に膨らませると論点 4「閉じる条件」が
> 複雑化。複数 intent を同時に保持する UX が思いつかない時点で過剰設計。

#### 保持場所

| | 案 P: `useState<string|null> sessionIntent` | 案 Q: 直前 reply message に格納 | 案 R: localStorage |
|---|---|---|---|
| 揮発性 | リロードで喪失 | リロードで messages ごと喪失(MVP は履歴保存しない) | 永続 |
| 履歴復元時 | 復元できない | reply に紐付くため復元される | 永続(過剰) |
| 型変更 | 不要 | `kind:"reply"` に `intent?` 追加(後方互換) | 不要 |
| 競合リスク | 1 ChatPage 内のみ・無し | 1 ChatPage 内のみ・無し | 別タブと衝突しうる |

> ★**設計者推奨: 案 Q(reply message に格納)+ 案 P(useState)の併用ではなく案 Q 単独**。
> 理由 2 点:
> 1. 「直前 message が reply かどうか」の判定は **どちらにせよ messages 配列を見る**
>    必要がある(他の kind との混在のため)。reply に intent を持たせれば
>    判定と取得が同じパスで済む。
> 2. MVP は履歴保存しないため、揮発性は実害ゼロ(本体判断 4)。
>    案 P は冗長(同じ情報が 2 箇所に存在 → 不整合リスク)。

→ **論点 3 と直結**。`kind:"reply"` に `intent` フィールドを追加する方向で確定。

---

### 3. ★reply への intent 保持

`MessageContent` の `kind:"reply"` に `sessionIntent` を追加するか。

```diff
- | { kind: "reply"; text: string; actions?: SuggestionItem[] }
+ | { kind: "reply"; text: string; actions?: SuggestionItem[]; sessionIntent?: string }
```

| | 案 A: kind:"reply" に sessionIntent 追加 | 案 B: ChatPage 内 useState |
|---|---|---|
| 型変更 | 1 行追加(optional・後方互換) | なし |
| 履歴復元時 | 自動的に復元される | 喪失 |
| 不整合リスク | 単一ソース・なし | useState と messages の二重管理・あり |
| `buildStylistHistory` への影響 | 不変(text のみ抽出する既存ロジック) | 不変 |
| サブコンポーネント(`AssistantContent` 等)への影響 | reply 描画は text/actions のみ参照・破壊なし | 影響なし |

> ★**設計者推奨: 案 A**。型変更は optional 追加のみで後方互換、
> 履歴復元(将来仕様)にも自然に効き、二重管理を避けられる。

---

### 4. ★会話セッションを「閉じる」条件

セッションが終わって `intent-result` 経路に戻るタイミング。

#### 4-A. 入力欄に別話題が来た時の検出

| | 案 A 全自動切替 | 案 B 明示的切替 | 案 C MVP は検出しない |
|---|---|---|---|
| 動作 | 各発話で段階 A 判定し、信頼度高く別 intent なら切替 | ボタン or 「/end」等のコマンドで切替 | セッション中は段階 B のまま継続 |
| 段階 A 呼び出し | 全往復で必要(論点 1 並列案と整合) | スキップでよい(論点 1 スキップ案と整合) | スキップでよい |
| UX | 自然 | 不自然(MVP には過剰) | 自然(誤検出ゼロ)・ただし「話題変えたい時に変えられない」 |
| 実装複雑度 | 中(切替閾値・条件分岐) | 高(専用 UI / コマンド) | 低(最小実装) |
| 誤検出リスク | あり(短く曖昧な発話の取り違え) | ゼロ | ゼロ |

> ★**設計者推奨: MVP-1a は 案 C・1.5b 以降に 案 A 検討**。
> 理由 4 点:
> 1. 「診断したい → 続く質疑」のフローでは別 intent への切替需要が薄い
>    (途中で `closet` の話に脱線する自然な確率は低い)
> 2. 誤検出で会話が切れる方が UX 棄損が大きい
> 3. 段階 A は **論点 1 で並列で呼んでログを取る** ので、4-A を後から有効化する
>    準備はできている(手戻り無し)
> 4. M5 刻む作法に沿った最小実装

#### 4-B. 補助ボタン押下

`buildActions` が返す `{intent: "diagnose", label: "診断を始める →"}` を押すと
`executeNavigate(intent)` → `router.push("/onboarding-v2")` で別画面遷移。
**この瞬間に ChatPage 自体が unmount される** ため、セッション終了は自動的。
→ 追加の処理不要(現状動作)。

#### 4-C. タイムアウト・別日復帰

MVP は履歴を保存しないため(本体判断 4)、リロード or 別日訪問で
messages が初期化される = セッション終了も自動的。追加処理不要。

> ★**閉じる条件の最終推奨(まとめ)**:
> - 4-A: 案 C(MVP は検出しない・並列ログだけ残す)
> - 4-B: 不要(現状自然動作)
> - 4-C: 不要(現状自然動作)

---

### 5. handleSubmit 改修案(最小変更・骨子)

現状の分岐 1 箇所(L163-168 の `isStylistTarget`)の前段に **セッション継続判定** を
挟む。コードは骨子のみ示す(実装は次工程):

```ts
// 直前 assistant メッセージが reply かどうか判定(messages の末尾を見る)
function getSessionIntent(messages: Message[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    if (m.content.kind === "reply") {
      // 論点 3 で reply に sessionIntent を持たせる
      return m.content.sessionIntent ?? null;
    }
    // intent-result / error 等が間に挟まったらセッション切断扱い
    return null;
  }
  return null;
}

// handleSubmit 内、loadingMsg を append した直後に追加
const sessionIntent = getSessionIntent(messages);

// /api/overlay/intent は常に呼ぶ(論点 1 並列案・ログ用)
const res = await fetch("/api/overlay/intent", { ... });
const data = await res.json() as IntentResponse & { error?: string };

// セッション継続判定:
// - sessionIntent あり and STYLIST_CHAT_INTENTS.has(sessionIntent)
//   → 段階 B 直行(段階 A 結果は破棄するがログには残る)
const isContinuingSession =
  sessionIntent !== null && STYLIST_CHAT_INTENTS.has(sessionIntent);

// 段階 B 対象 intent の判定: 通常 or 継続セッション
const isStylistTarget = isContinuingSession
  || (data.ok && data.reason === undefined && typeof data.intent === "string"
      && STYLIST_CHAT_INTENTS.has(data.intent));

if (isStylistTarget) {
  // POST /api/ai/stylist-chat
  // - 通常時:    intent = data.intent
  // - 継続セッション: intent = sessionIntent(クライアント側で固定して渡す)
  const intentToSend = isContinuingSession ? sessionIntent! : data.intent;
  const replyRes = await fetch("/api/ai/stylist-chat", {
    method: "POST",
    body: JSON.stringify({ text: trimmed, intent: intentToSend, history: recentHistory }),
  });
  // ...成功時 replaceMessage で kind:"reply" + sessionIntent: intentToSend を渡す
  replaceMessage(setMessages, loadingId, {
    kind: "reply",
    text: replyData.reply,
    actions: replyData.actions,
    sessionIntent: intentToSend,   // ★ 論点 3
  });
}
```

**最小変更箇所**:
1. `MessageContent` の `kind:"reply"` に `sessionIntent?: string` 追加(1 行)
2. `getSessionIntent` ヘルパー追加(10 行強)
3. `handleSubmit` の `isStylistTarget` 算出を `isContinuingSession || (...)` に置換(2 行)
4. `replyData` 成功時の `replaceMessage` 引数に `sessionIntent` を渡す(1 行)
5. `intentToSend` を `body` の `intent` に渡す(既存と同型・1 行差分)

**フォールバック動作**: `/api/ai/stylist-chat` が `intent_out_of_scope` を返す ケースは(継承される intent は常に `diagnose` で API 側 Set にも含まれるため)発生しない。`auth_required` や HTTP エラー時は **現行通り `intent-result` フォールバック** = ユーザーは少なくとも遷移ボタンで diagnose に到達できる(P1-C-1 退行ゼロ維持)。

---

### 6. ★API 側(stylist-chat route)の変更要否

> **結論: 不変**。

理由:
- `body.intent` は依然必須(`empty_input` / `intent_out_of_scope` reason ロジック維持)
- UI が継続セッション時に `sessionIntent`(= `"diagnose"`)を `intent` フィールドに
  詰めて送る運用なので、API 側のスキーマも `STYLIST_CHAT_INTENTS` も全く変えなくてよい
- API 側 Set は「UI が暴走して `closet` を送ってきた時の防壁」として残す
  (UI 単独のバグでスコープ外 intent が API に届くケースの最終防衛線)

→ **API 側ファイル 0 行変更**。1.5b で集合を `{"diagnose", "closet"}` に拡張する時に
   両側を同時更新する。

---

### 7. ★プライバシー三重防御 維持確認

| 防御層 | セッション継続で影響あるか |
|---|---|
| 列絞り SELECT(result → worldviewName のみ等)| なし(`contextData` 取得は API 側で毎リクエスト・list 不変) |
| system 明示禁止(「他ユーザーデータに触れない」)| なし(system prompt 不変) |
| 出力フィルタ(PRODUCT_WORLDVIEW_TAGS 31 語直参照)| なし(`buildStylistChatUserMessage` 内のフィルタ不変) |
| `buildStylistHistory` (history N=3 で reply の自然文だけ抽出)| **会話継続で常に呼ばれる経路に乗る** → 既存の自然文だけ抽出するロジックが効くか実機で確認(段階 A 結果や intent-result 等の他 kind は混入しない設計だが、リグレッションテスト必須) |

> **追加検証項目(実装後)**: 5 往復続けた時に system プロンプト / contextData /
> history のいずれにも他ユーザーデータが漏れない確認。
> リグレッションテストとして `scripts/test-stylist-chat-continuity.ts`(仮称)を
> 用意するのが堅い(これは実装工程で判断)。

#### contextData キャッシュ

会話継続で `contextData`(自前 SELECT)が複数回呼ばれる。1 ChatPage セッションで
平均 3-5 往復 = SELECT 3-5 回。

- SELECT 1 回 ≒ ¥0.0001 級(Supabase は無視可)
- レイテンシ: ~50-100ms × 数回
- **キャッシュ要否**: 不要。MVP では都度 SELECT で十分。

---

### 8. コスト影響(本体 7.4 整合)

| ケース | 1 往復目 | 続く発話 ×N | 合計(N=4・5 往復会話)|
|---|---:|---:|---:|
| 並列案(推奨)| ¥0.50 | ¥0.50 ×4 = ¥2.00 | **¥2.50** |
| スキップ案 | ¥0.50 | ¥0.45 ×4 = ¥1.80 | ¥2.30 |
| 差額 | — | — | ¥0.20 |

**月額再試算**(本体 7.4 上限 ¥77/月想定):

- 月 150 相談 × 平均 N=2 続き発話 × 並列案 ¥0.50/件
- = 月 ¥150(相談本体)+ ¥150(続き発話)= **月 ¥300?**

**待った**:本体 7.4 の ¥77/月上限は「1 相談 = 1 往復」前提だった可能性。
1.5a で複数往復前提に変わったので **本体 7.4 のコスト試算は再評価が必要**。
ただしこれは P1-C-1.5a の本件ではなく **コスト章(③ 専章)の更新事項** に該当。

> ★**設計者推奨**: 本調査 doc では並列案の月額レンジを明示(¥300/月程度)するに
> とどめ、コスト章(③専章)の更新は別 doc で行う(本体 7.4 / Phase2 後ゲート不変)。

---

### 9. 拡張性(MVP-1b 以降)

1.5b で `STYLIST_CHAT_INTENTS = {"diagnose", "closet"}` に拡張する時:

- UI 側 Set + API 側 Set を同時更新(2 行)
- `buildActions(intent)` に `closet` の補助 actions を追加(数行)
- **論点 2 X 案(セッション intent は 1 個)+ 論点 4-A C 案(切替検出しない)**
  だと、`diagnose` セッション中に `closet` 発話が来たら **そのまま `diagnose` として
  段階 B が応答する** ことになる
- これは「自然な会話」としては不自然 → 1.5b 投入時に **論点 4-A を C → A**(全自動切替)
  に格上げする必要あり

> **拡張ロードマップ**:
> - 1.5a 今回: 並列案 + reply intent 保持 + 切替検出なし(C 案)
> - 1.5b 投入時: 並列で取った段階 A intent を見て切替検出(A 案)に格上げ
> - 1.5b に着手する前に、本調査 doc を再読 + 並列ログから誤検出率を確認

---

### 10. リスク + エッジケース

| # | リスク / エッジケース | 緩和策 | 残存リスク |
|---|---|---|---|
| R1 | 「会話を閉じる」条件の判定漏れで会話が無限に続く | 補助ボタン押下 → unmount でセッションリセット(4-B)+ messages 上限(`trimByMax`)で履歴肥大化防止 | 低 |
| R2 | 補助ボタン押下時の正しいセッション終了 | `executeNavigate` → `router.push` → ChatPage unmount で自動 | なし |
| R3 | リロード時の挙動 | MVP は履歴保存しないため messages 初期化 = 自然にセッション終了 | 受容(本体判断 4) |
| R4 | 既存 5 サブ / intent / navigate-map シグネチャ不変 | 本案は handleSubmit と MessageContent.reply のみ修正・既存資産に触れない | なし |
| R5 | ③専章 / ③コスト / Phase2 後ゲート不変 | 本案は実装方針のみ・コスト章は別 doc | コスト試算 再評価必要(8章) |
| R6 | 1 往復目の会話品質が連続発話でも維持 | history N=3 でも会話継続に十分(本体 7.4 抑制策の一段目) | 5 往復超で品質劣化リスクあり・実機検証必要 |
| R7 | 段階 A `/api/overlay/intent` が連続呼び出しで rate limit | 並列案でも 1 ChatPage で同時 1 リクエスト・問題なし | なし |
| R8 | `getSessionIntent` が間違って古い reply を拾う | 「**末尾から逆順走査し、reply 以外の kind に当たったら切断**」のロジックで対処 | 実装時に注意 |
| R9 | history N=3 に古い reply の文脈が混入 | `buildStylistHistory` は既存通り text のみ抽出 = sessionIntent は API に渡らない | なし(設計通り) |
| R10 | API 側 `intent_out_of_scope` が継続セッションで発火 | UI が継承して送る intent は `diagnose` のみ・API Set にも含まれるので発生しない | なし |

---

### 11. ★最終推奨(設計者見解・オーナー判断項目)

| 論点 | 設計者推奨 | 根拠 |
|---|---|---|
| **L1 並列 vs スキップ** | **案 A 並列** | 将来「話題切替検出」(1.5b)の前提データを失わない・コスト差 ¥0.05/件 は無視可 |
| **L2 継続 intent 集合の構成** | **セッション intent は 1 個** | 自然会話は 1 トピック・複数同時保持の UX が思いつかない時点で過剰設計 |
| **L3 reply への intent 保持** | **`kind:"reply"` に `sessionIntent?: string` 追加** | 型変更 1 行・後方互換・単一ソース・履歴復元自動 |
| **L4 閉じる条件** | **MVP-1a は案 C(検出しない)・1.5b 投入時に案 A(全自動)へ格上げ** | 誤検出で会話が切れる方が UX 棄損が大きい・並列ログで準備済み |

**オーナー判断項目(レビューで決定)**:

1. L1 並列案 ¥0.05/件追加コスト・月 ¥15 程度 受容するか
2. L2 セッション intent 1 個固定 受容するか(将来複数同時に膨らませる仕様には触れない)
3. L3 `MessageContent.reply` に `sessionIntent?` 追加 受容するか(型変更 1 行・1.5b 後方互換)
4. L4 MVP-1a で切替検出しない方針 受容するか(1.5b に持ち越し)
5. 8 章のコスト試算 再評価を別 doc で扱う方針 受容するか(本体 7.4 ¥77/月 上限を見直す必要があるか)
6. 7 章のリグレッションテスト追加(`scripts/test-stylist-chat-continuity.ts` 仮称)を 1.5a 修正実装と同 commit で入れるか別 commit にするか

---

## 12. 次工程(本 doc では実装しない)

オーナー判断後、以下を実装工程として進める:

1. `MessageContent.reply` 型に `sessionIntent?: string` 追加
2. `getSessionIntent(messages)` ヘルパー追加
3. `handleSubmit` の `isStylistTarget` 算出に継続セッション分岐追加
4. `replyData` 成功時の `replaceMessage` に `sessionIntent: intentToSend` 追加
5. リグレッションテスト(7 章で言及・本体 7.4 三重防御を 5 往復で維持確認)
6. 実機検証(オーナー良い例 1 を 2-3 往復続けて自然文が破綻しないか)

**API 側 / 既存 5 サブ / navigate-map / 三重防御ロジック / ③専章 / Phase2 後ゲート: いずれも不変**。

---

## 付録 A. handleSubmit 改修 diff サマリ(L163-167 周辺)

```diff
+ // 直前 assistant メッセージが reply かどうかでセッション継続を判定
+ const sessionIntent = getSessionIntent(messages);
+ const isContinuingSession =
+   sessionIntent !== null && STYLIST_CHAT_INTENTS.has(sessionIntent);
+
- const isStylistTarget =
+ const isStylistTarget = isContinuingSession || (
    data.ok
    && data.reason === undefined
    && typeof data.intent === "string"
-   && STYLIST_CHAT_INTENTS.has(data.intent);
+   && STYLIST_CHAT_INTENTS.has(data.intent)
+ );

  if (isStylistTarget) {
+   const intentToSend = isContinuingSession ? sessionIntent! : data.intent;
    const recentHistory = buildStylistHistory(messages);
    ...
    body: JSON.stringify({
      text:    trimmed,
-     intent:  data.intent,
+     intent:  intentToSend,
      history: recentHistory,
    }),
    ...
    replaceMessage(setMessages, loadingId, {
      kind:    "reply",
      text:    replyData.reply,
      actions: replyData.actions,
+     sessionIntent: intentToSend,
    });
  }
```

正味の追加行数: **約 10 行**(MessageContent 型 1 行 + getSessionIntent 10 行 + handleSubmit 内 5 行差分)。
