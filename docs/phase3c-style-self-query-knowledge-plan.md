# ③-c 設計書：STYLE-SELF を query_knowledge 寄せにして KO 使用追跡に乗せる（ChatGPT レビュー用）

> 本書は **実装前のレビュー資料**。方式は確定済み（下記「確定方針」）。本書の論点をレビューで確定してから着手する。
> 対象リポジトリ: `style-self`（KO = `knowledge-os` は別プロジェクト）。
>
> **レビュー反映（ChatGPT）**: 全体方針（query_knowledge 寄せ・フラグ裏OFF・getInfluences併用・answer補助/rules主素材）は承認。
> ただし「**遅いゴミ回答**（待った挙句に薄い/ズレた回答）を防ぐ品質ゲートが足りない」との指摘を受け、以下を反映済み:
> ①タイムアウト改訂（通常18〜20s・最大25s・超過時は通常回答を出さない §3-c-1/§4-1）、②answer 厳格化（補助のみ・本文化/再要約禁止・implementation_hints 不使用 §3-c-2/§4-2）、③**品質ゲート新設**（満たさなければ安全モード §3.5）、④フォールバック改訂（get_* で雑に答えず安全モードへ §4-4）、⑤実機比較ツールを作る方針に確定（§4-3）。

---

## 0. 用語・前提

- **KO**: Knowledge OS（管理者の外部脳・MCP サーバ）。STYLE-SELF とは **別 Supabase プロジェクト**（直接 SQL join 不可）。
- **query_knowledge**: KO の MCP ツール。内部で **OpenAI embed → pgvector 検索 → Claude 合成(maxTokens 4096)** を行い、`KnowledgeAnswer`（answer / related_entries / decision_rules / failure_patterns / design_principles / implementation_hints / used_references）を返す。**KO 側で LLM を1回回す重い処理**。
- **get_***: KO の `get_decision_rules` / `get_failure_patterns` / `get_influences` / `get_categories`。**純 DB フェッチ（KO 側 LLM 無し・高速・5分キャッシュ可）**。
- **rule_applications**: KO 側の使用追跡テーブル（③-a/b）。**query_knowledge の使用のみ**を request_id 付きで記録する。
- **request_id**: KO が tools/call ごとに採番し、`result._meta.request_id` で返す相関 ID（③-b で全ツール応答に搭載済み）。将来 STYLE-SELF の feedback と突合する核。

---

## 1. 背景：なぜ ③-c が要るか

### KO 側の現状（③-b まで完了）
- query_knowledge の応答に `result._meta.request_id` を搭載済み。
- query_knowledge を呼ぶと、引かれた知識（related_entries / used_references）が **request_id 付きで rule_applications に記録**され、応答 `_meta.request_id` と一致する（実機実証済み）。
- ただし **rule_applications に記録されるのは query_knowledge だけ**（get_* は ③-b' 未対応）。

### STYLE-SELF 側の現状（棚卸し結果）
- KO 連携は **MCP 読み取りクライアント1本**（`lib/knowledge-os/client.ts`）。実装済みは **get_* のみ**で **query_knowledge ラッパは無い**。
- クライアントは `result.content[0].text` を **JSON 配列**としてパースし、**`result._meta` を一切読まない**（line 196-199）。
- KO を呼ぶルートは4つ（すべて get_*）:
  - `app/api/ai/analyze-v2/route.ts`（診断v2）: getInfluences / getDecisionRules / getCategories
  - `app/api/ai/analyze/route.ts`（旧診断）: getInfluences / getDecisionRules
  - `app/api/ai/stylist-chat/route.ts`（チャット・全5intent）: getDecisionRules + getFailurePatterns + getInfluences
  - `app/api/moodboards/[id]/analyze/route.ts`（MB解析）: getDecisionRules / getInfluences
- → **STYLE-SELF は query_knowledge を一度も呼んでいない**。結果、**STYLE-SELF の実使用は rule_applications に1行も記録されていない**。

### ギャップの核心
③-c のゴール「feedback ⇔ rule_applications を request_id で突合 → rule_confidence_scores 合流 → ランキング学習」は、**STYLE-SELF が query_knowledge を呼び、その request_id を保存する**ところから始まる。本書（③-c-1〜3）はその「**STYLE-SELF の使用が rule_applications に記録される所まで**」を設計する。

---

## 2. 確定方針（レビューの前提・ここは議論対象外）

| 論点 | 確定 |
|---|---|
| 方式 | **道1**: query_knowledge を**チャットの主素材**にする（get_* 併用）。品質最優先・ゴミ回答を出さない。 |
| レイテンシ | **A**: query_knowledge を**待つ**（中途半端に打ち切らない）。 |
| influences | **X**: `getInfluences` **併用**で温存（KnowledgeAnswer に influences が無いため・退行防止）。 |
| answer の使い方 | **補助文脈のみ**。最終回答の主素材は **decision_rules / failure_patterns / related_entries**。answer を**そのまま本文化・再要約しない**。implementation_hints は**原則使わない**（コード作業向け＝ファッション応答にノイズ）。 |
| 品質ゲート | **遅いゴミ回答を出さない**。§3.5 のゲートを満たさない／query_knowledge 失敗・タイムアウト時は **通常回答を出さず安全モード**（追加質問・暫定回答・2択提示・必要情報の確認）に切替。 |
| 導入 | **フラグ裏**（既定 OFF・`STYLE_SELF_QUERY_KNOWLEDGE_CHAT`）。ON で実機比較してから採用。**OFF 時は完全に現状維持**（get_* 3並列のまま）。 |
| 今回範囲 | ③-c-1（client.ts に queryKnowledge）＋ ③-c-2（stylist-chat を寄せる・フラグ裏）＋ ③-c-3（request_id を message.metadata.ko に永続化）。**c-4〜6（feedback 突合）は次回**。 |

---

## 3. ③-c-1〜3 設計詳細

### ③-c-1: `lib/knowledge-os/client.ts` に `queryKnowledge` を追加

**現状の制約**: 既存 `callTool` は `result.content[0].text` を JSON 配列前提でパースし（配列でなければ `[]`）、`_meta` を読まない。query_knowledge の戻りは **KnowledgeAnswer オブジェクト**なので流用不可。

**追加する専用メソッド（設計案）**:
```ts
export interface KnowledgeAnswer {
  answer: string;
  related_entries: Array<{ id: string; title: string; summary: string; decision_rules: string[] }>;
  decision_rules: string[];
  failure_patterns: string[];
  design_principles: string[];
  implementation_hints: string[];
  used_references?: Array<{ source_type: string; source_id: string; rule_text: string; why_used: string }>;
}
export interface QueryKnowledgeResult {
  answer: KnowledgeAnswer | null;  // 失敗/タイムアウト時 null
  requestId: string | null;        // KO の _meta.request_id（突合の核）
}

export async function queryKnowledge(
  question: string,
  opts?: { timeoutMs?: number },
): Promise<QueryKnowledgeResult>;
```

**実装要件**:
- `tools/call` / `name:"query_knowledge"` / `arguments:{ question }`。**`project` は渡さない**（KO の project はプロvenンスフィルタ。`'style-self'` を渡すと該当 entry が無く 0 件事故になる。undefined=全知識を対象）。
- パース: `result.content[0].text` を **オブジェクト**として `JSON.parse` → `KnowledgeAnswer`。`requestId = result._meta?.request_id ?? null`。
- **キャッシュ対象外**（`callToolCached` を使わない）。理由は §4-5（キャッシュとの相性）。
- **タイムアウト（改訂）**: query_knowledge 専用に延長し、**通常目安 18〜20 秒・最大 25 秒**（既存 get_* は 5s のまま）。**25 秒を超えたら通常回答を出さない**（後段 stylist-chat が安全モードに切替・§3.5）。値の根拠は §4-1。
- **graceful**: ネットワーク失敗・HTTP 非200・RPC error・タイムアウト・パース失敗・キー未設定はすべて `{ answer: null, requestId: null }` を返す（throw しない）。**呼び出し側（stylist-chat）は `answer === null` を「深い回答を作らず安全モードへ」の信号として扱う**（従来 get_* で雑に埋めない・§3.5/§4-4）。

### ③-c-2: `stylist-chat` をフラグ裏で query_knowledge 主素材に

**現状の KO 使われ方**（精読結果）:
- `fetchKnowledgeOSContext(text)`（route.ts:668）が get_* を3並列で取得 → サニタイズして
  `knowledgeOS = { decisionRules[{rule,importance}], failurePatterns[{title,summary}], influences[{subjectName,summary,fusion}], dictionaries{材/色/線/比} }` を返す。
- プロンプト（`lib/prompts/stylist-chat.ts:575`）が user message 末尾に **「【参考(Knowledge OS …)】 判断ルール / 失敗パターン / 影響源」** ブロックとして追記し、「無関係は無視・自然文に溶かして reply」と指示。
- `dictionaries`（材/色/線/比）は **STYLE-SELF ローカル辞書**で KO 非依存。intent別 fetcher（closet/coordinate/style-consult/brand-learn/diagnose）は **STYLE-SELF 自前 Supabase**。

**KnowledgeAnswer への対応づけ（質・形の差）**:
| 現状 get_* | KnowledgeAnswer | 評価 |
|---|---|---|
| decisionRules `{rule,importance}` | `decision_rules: string[]` | ◯ ほぼ等価（importance 欠落） |
| failurePatterns `{title,summary}` | `failure_patterns: string[]` | ◯ ほぼ等価 |
| **influences `{subjectName,summary,fusion}`** | **無し** | ⚠ 欠落 → **getInfluences 併用で温存** |
| — | `related_entries[]`（id/title/summary/rules） | ＋ **主素材の一部**（根拠・該当 entry のルール） |
| — | `answer`（200-400字 合成） | △ **補助文脈のみ**（本文化・再要約しない） |
| — | `design_principles[]` | △ 限定使用（世界観原則として補助可） |
| — | `implementation_hints[]` | ✕ **原則使わない**（コード作業指示向け＝ファッション応答にノイズ） |

**ON 時の動作（フラグ ON）**:
1. ユーザー発話 `text` で `queryKnowledge(text)` を実行（**待つ**＝道1/レイテンシA）。intent fetcher（自前Supabase）と `getInfluences` は従来どおり並列で取得。
2. 成功時: `knowledgeOS` を query_knowledge 由来で構築する。
   - **主素材**: `decision_rules` → 判断ルール、`failure_patterns` → 失敗パターン、`related_entries` → 根拠/該当ルール。
   - **補助文脈**: `answer` は**補助のみ**（KOの要約観点として軽く添える程度・**そのまま本文化／再要約しない**・主素材を上書きしない）。
   - **不使用**: `implementation_hints`（原則不使用）。`design_principles` は限定（世界観原則として補助可）。
   - **influences**: `getInfluences` 併用分をそのまま温存（退行防止）。
   - `dictionaries` 不変。
   - 生成後に **§3.5 品質ゲート**を適用。満たさなければ通常回答を出さず**安全モード**へ。
   - `requestId` を後段（③-c-3）へ受け渡す。
3. **失敗/タイムアウト時（改訂）**: get_* で**雑に深い回答を作らない**。**安全モード**（追加質問・暫定回答・2択提示・必要情報の確認のいずれか）に切替える（§4-4）。`requestId = null`。
4. プロンプト【参考】ブロックの**描画ロジック・persona・format 指示・intent fetcher・dictionaries はすべて不変**。変わるのは「ブロックの中身の出所」と「品質ゲート/安全モードの追加」のみ。

**OFF 時の動作（フラグ OFF・既定）**: **完全に現状**（get_* 3並列・queryKnowledge を呼ばない・request_id 無し）。新コードは一切走らない。

**フラグ**: `lib/flags.ts` に追加（`FEEDBACK_LOOP` 同型）。stylist-chat は server なので `STYLE_SELF_QUERY_KNOWLEDGE_CHAT === "true"`（既定 OFF）。request_id を client 側で永続化する都合上、必要なら `NEXT_PUBLIC_` 版も検討（§4-6）。

### ③-c-3: request_id を `messages.metadata.ko.request_id` に永続化

**現状**: thread 選択中は assistant 応答を `/api/threads/[id]/messages` 経由で永続化。`messages.metadata = { message: PersistableMessage }`（`lib/hooks/use-thread-messages.ts:88` がハードコード）。`metadata` jsonb は 027 で「KO 参照 ID 等」を入れる想定の枠。

**設計（additive・migration 不要）**:
- `messages.metadata = { message, ko: { request_id } }` に拡張。
- 動線:
  1. `stylist-chat` 応答に `requestId` を additive で含める（返却 JSON に `koRequestId` 等）。
  2. `app/(app)/ai/page.tsx` が応答から `requestId` を受け取り、`persistMessage` に渡す。
  3. `use-thread-messages.persistMessage` が `metadata: { message, ko: requestId ? { request_id: requestId } : undefined }` で保存。
- **1 メッセージ = 1 query_knowledge = 1 request_id**。これにより message に「この返信を作るのに使った KO 知識の相関 ID」が残る（feedback 突合は c-4 以降）。
- thread 未選択（永続化しない一時会話）の場合は request_id を保存できない＝突合対象外（許容）。

---

## 3.5. 品質ゲート（レビュー反映・新設）

**目的**: query_knowledge を「待つ」設計の代償が「**遅いゴミ回答**」になることを防ぐ。stylist-chat は以下を満たさない場合、**通常回答を出さず安全モードに切替える**。

**通常回答を出してよい条件（すべて満たす）**:
- ユーザーの相談に**直接答えている**。
- **世界観・色・素材・シルエット・着方のうち最低2つ以上に具体性**がある。
- **「どう着るか」「何を足すか」「何を避けるか」**が含まれている。
- **アイテム名の羅列で終わっていない**。
- **KO 由来の判断軸、またはユーザー入力に基づいた明確な理由**がある。

**安全モードに切替える条件（いずれか）**:
- 自信が低い → **断定しない**。
- 情報不足 → **追加質問に切替える**。
- query_knowledge 失敗/タイムアウト → **深い回答のフリをしない**（安全モード：追加質問・暫定回答・2択提示・必要情報の確認）。

### 判定方法（どこで・どう判定するか）— 実装方針の案と所見
1. **案A: プロンプト内で AI に自己チェックさせる**（生成時に内省）。
   - 方法: stylist-chat の system/format 指示に「出力前に上記チェックリストを自己評価し、満たさなければ通常回答ではなく安全モード（追加質問/2択/暫定）で返す」を明記。出力 JSON に `mode: "answer" | "safe"`（+ 不足理由）を持たせる。
   - 長所: 追加 LLM 呼び出し不要・自然文に統合しやすい。短所: 自己申告なので**すり抜け得る**（甘く自己採点する）。
2. **案B: 生成後にサーバ側で機械検査**（後検査）。
   - 方法: reply を簡易ヒューリスティクスで検査（例: 文字数下限／「足す・避ける・着方」語の有無／アイテム名羅列パターン／KO rules 由来語の含有）。不合格なら安全モードのテンプレ応答に差し替え or 再生成。
   - 長所: すり抜けに強い。短所: ルールベースは脆く、再生成は更にレイテンシ増。
3. **案C（推奨・ハイブリッド）**: **案A を主**（プロンプト自己チェック＋ `mode` フィールド）に、**案B を薄い安全網**（最低限の機械検査：reply が極端に短い／`mode:"answer"` なのにアイテム名羅列のみ 等のときだけ safe に倒す）。再生成はせず安全モード応答へフォールバック（レイテンシ二重増を避ける）。

- **EditorScore との関係**: 既存に `editorScore`（MB coordinate の AI 評価スコア）がある（types/page で確認済み）。品質ゲートはこれと同系の「出力品質判定」だが、対象が**全 intent のチャット reply**である点が異なる。**EditorScore の仕組みを流用/拡張できるか**は実装時に確認（重複実装回避）。
- **フラグ ON 時のみ**適用（OFF=現状の get_* 経路は従来どおり・ゲート無し）。

---

## 4. レビューで判断してほしい論点（ChatGPT 向け設問）

### 4-1. レイテンシ／タイムアウト（レビューで改訂済み）
- 事実: query_knowledge = KO側で **embed + Claude合成(4096tok)**。良ネットワークでも概ね **4〜10s**。その後 STYLE-SELF が自前 Claude 生成 → **初回応答まで合計でさらに数秒上乗せ**。チャットは「考えています…」表示中に走るが、体感待ちが伸びる。
- **確定（レビュー反映）**: タイムアウトは **通常目安 18〜20 秒・最大 25 秒**。**25 秒を超えたら通常回答を出さない**（安全モードへ §3.5/§4-4）。「品質最優先で待つ」が、待った末のゴミ回答は出さない。
- **残レビュー設問**: 18〜20s/最大25s の体感は許容範囲か。安全モードへ倒す閾値（例: 20s で諦めて安全モード、25s は絶対上限）をどう刻むのが良いか。

### 4-2. answer の扱い（レビューで厳格化済み）
- 懸念: KO側Claudeが要約した `answer` を STYLE-SELF Claude が再加工＝二重合成で**平板化・ニュアンスずれ**が起きうる。
- **確定（レビュー反映）**:
  - KO `answer` は**補助文脈のみ**。最終回答の**主素材は decision_rules / failure_patterns / related_entries**。
  - answer を**そのまま本文化・再要約しない**。
  - `implementation_hints` は**原則使わない**（コード作業向けでファッション応答にノイズ）。`design_principles` は限定使用。
- **残レビュー設問**: 「answer は完全に prompt から外し、ログ取得（request_id 目的）だけにする」まで踏み込むべきか。それとも「補助として薄く添える」現案で十分か。

### 4-3. 実機比較ツール（レビューで「作る」に確定）
- 方針: 既定 OFF で実装 → ON で実機比較 → 良ければ採用。
- **確定（レビュー反映）**: **OFF/ON 比較ツールを作る**（KO 側 `compare-search` のチャット版）。同一ユーザー発話を **get_* 方式（OFF 相当）** と **query_knowledge 方式（ON 相当）** の両方で叩き、**reply・使った rules・レイテンシ**を並べて出力。
- **評価軸**（並べて目視 or 採点）:
  1. 質問に**直接答えているか**
  2. **具体性**（抽象論で終わっていないか）
  3. **世界観・色・素材・シルエット・着方**が出ているか
  4. **何を足すか／避けるか**が含まれているか
  5. **KO 由来の判断軸が自然に**入っているか
  6. **長いだけで薄くないか**
  7. **ゴミ回答が出ていないか**（安全モードに倒すべきものを通常回答していないか）
  8. **レイテンシが許容範囲か**
- **残レビュー設問**: このツールは「代表発話セット（A系=明確/B系=口語の両方）」を何件くらい用意すべきか。採点は手動 ◎○△× で十分か、簡易自動判定（語含有チェック）も足すか。

### 4-4. フォールバック（レビューで改訂：安全モードへ）
- **確定（レビュー反映）**: フォールバックは「**従来 get_* で雑に答える**」ではなく「**低品質回答を防ぐ安全モード**」。query_knowledge 失敗/タイムアウト時は **追加質問／暫定回答／2択提示／必要情報の確認**のいずれかに寄せる（深い回答のフリをしない）。`requestId=null`＝そのメッセージは突合対象外（許容）。
- 補足: get_* を「文脈の足し」として薄く使うこと自体は可だが、**それを根拠に通常回答（断定的な深い提案）を組まない**。あくまで安全モードの素材に留める。
- **残レビュー設問**: 安全モード時に get_* 文脈を**少しでも使う**か、**完全に使わず純粋な確認質問**にするか。前者は「情報ゼロよりマシ」、後者は「中途半端な根拠で断定するリスクをゼロにする」。

### 4-5. 見落としているリスク（明示的に潰したい）
- **二重課金/コスト**: 1メッセージで KO側Claude(4096) + STYLE-SELF Claude。コスト増の許容範囲。
- **キャッシュとの相性**: request_id を一意に保つには query_knowledge を**毎回実呼び**する必要 → **キャッシュ禁止**（キャッシュすると KO 未呼び出し＝新 rule_applications 行が作られず request_id 使い回しで突合破綻）。get_* の5分キャッシュは維持。この判断は正しいか。
- **request_id 重複/取りこぼし**: ③-b は waitUntil で rule_applications を書く。STYLE-SELF が `_meta.request_id` を受けても、KO 側の書き込みが失敗していれば「request_id は手元にあるが rule_applications に行が無い」状態がありうる（c-4 突合時に空振り）。許容 or 対策。
- **feedback 粒度**: 現 feedback は thread 単位（message_id 未送信）。c-4 で message_id 動線を足さないと「どの request_id への feedback か」が定まらない。
- **タイムアウト中の UX**: 20s 待って失敗 → フォールバックで更に生成。最悪ケースのトータル時間。
- **その他**: レビューで追加リスクの指摘を求める。

---

## 5. ③-c-4〜6（次回・今回実装しない・設計の地図）

| 段階 | 内容 | 主な変更箇所 |
|---|---|---|
| **③-c-4** | feedback ↔ message_id ↔ request_id を結線 | STYLE-SELF: feedback 送信に `message_id` を含める（現状 `{kind,content}` のみ）／feedback route は受領済み。message.metadata.ko.request_id を辿れる状態に。 |
| **③-c-5** | KO に書き戻しエンドポイント新設 | KO: 既存 MCP 認証（鍵）を再利用した write エンドポイント（MCP tool `submit_feedback` or REST）。STYLE-SELF が `{ request_id, rating, note }` を送る。STYLE-SELF: feedback 保存後に best-effort で KO へ送信。 |
| **③-c-6** | KO 側で突合 → rule_confidence_scores 合流 | KO: request_id で rule_applications と feedback を join → 「引いた知識(source_id/rule_text) × ユーザー反応」を集計 → rule_confidence_scores（Web /ask の既存ループと同じ表）に合流 → ②検索の合成スコアや entry 優先度に反映（ランキング学習）。 |

**地図上の含意**: c-1〜3 で「STYLE-SELF の使用 → rule_applications（request_id 付き）＋ message に request_id 保存」までを作る。c-4〜6 で「feedback → request_id → KO 書き戻し → 突合 → 学習」を閉じる。**STYLE-SELF と KO は別 DB なので、突合は SQL join ではなく request_id を介した write エンドポイント経由**（c-5）になる。

---

## 6. 影響範囲・不変条件（c-1〜3）

- **OFF 時は完全現状維持**（get_* 3並列・queryKnowledge 不使用・新コード不走行）。
- **intent fetcher / dictionaries / persona / format 指示は ON でも不変**（変わるのは【参考】ブロックの中身の出所＋品質ゲート/安全モードの追加のみ）。
- **品質ゲート・安全モードは ON 時のみ**（§3.5）。OFF 時は従来 get_* 経路でゲート無し（現状維持）。
- 診断（analyze-v2/analyze）・MB解析は **対象外**（query_knowledge は質問文が要る／文脈フェッチには get_* が適合）。今回は stylist-chat のみ寄せる。
- `messages.metadata` 拡張は **additive**（既存 `{message}` に `ko` を足すだけ・migration 不要）。
- KO への新規書き込みは無し（c-5 まで）。query_knowledge は読み取り（KO 側で rule_applications を書くのは KO の責務・STYLE-SELF は関与しない）。
- best-effort 維持（KO 落ち・タイムアウトでもチャットは動く）。

---

## 7. レビュー後の進め方

1. 本書の §4 残レビュー設問（4-1 安全モード閾値・4-2 answer を外すか・4-3 発話セット規模・4-4 安全モードで get_* を使うか）を確定。
2. ③-c-1（client.ts）→ ③-c-2（stylist-chat・フラグ裏・**§3.5 品質ゲート/安全モード込み**）→ ③-c-3（message 永続化）を実装。
3. **OFF/ON 比較ツール（§4-3）を作成** → tsc/build green → フラグ ON で実機比較（§4-3 の評価軸）→ 採用判断 → コミット。
4. 採用後に ③-c-4〜6（feedback 突合）へ。

*本書は実装前のレビュー資料。実装は本書の論点を確定してから着手する。*
