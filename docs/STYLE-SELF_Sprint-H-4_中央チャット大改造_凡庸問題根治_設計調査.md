# STYLE-SELF Sprint H-4 — 中央チャット大改造・凡庸問題 構造的根治 設計調査(★ Layer 1 最重要工程・5工程統合・E-0e §12 出力UI 7+5・MB context object 化・★ コード 0 変更・doc のみ)

- 作成日: 2026-05-31
- 起点 HEAD: `23d07fc`(H-3 左ペイン スレッド履歴一覧 UI・実機 verify 7項目クリア・clean / 399 PASS / tsc EXIT 0)
- 本 doc の役割: H-4(中央チャット大改造)を 5 工程に分解し実装可能な粒度に設計。E-0e §12 出力UI、MB の context object 化、2026-05-31 朝の凡庸問題の構造的根治方針を確定する(★ コード 0 変更・実装は次の指示)
- Layer 1 進捗: 3/5(H-1 DB / H-2 API / H-3 左ペイン完了)→ H-4 = Layer 1 最大かつ最重要

---

## 0. ★ ★ 既存資産 verify 結果(2026-05-31 実機確認・★ 改造マップの前提)

| 項目 | 実機確認結果 | H-4 への含意 |
|---|---|---|
| localStorage キー | `STORAGE_KEY = "style-self:ai:messages:v1"`・`Message[]`(discriminated union)を persist | 工程2 の移行対象が確定 |
| Message 型 | `content.kind` = `text` / `intent-result` / `reply` / `loading` / `error` の判別共用体 | 出力UI再設計は `reply` kind を拡張 |
| ★ 現 `reply` の中身 | **`text: string` + actions + editorScore のみ**(7項目の構造化なし。本文は plain text・スコアは `EditorScoreFold`) | ★ 工程3 は metadata 構造化が新規必要 |
| MB 受け取り | `sessionStorage` の `mb_prompt`(本文先頭に prepend)+ `mb_id`(`lastMoodboardId`)/ `MoodboardPickerModal` | 工程4・5 の置換対象 |
| MB 判定(server) | `stylist-chat/route.ts:158` `intent==="coordinate" && text.startsWith(MB_PROMPT_SIGNATURE)` | ★ 工程5 の根治対象(脆い先頭一致) |
| editor AI | `route.ts:188` `if (isMbCoordinate)` 内でのみ実行・throw 時 `catch` で**無言フォールバック**(editorScore 欠落) | 工程5 で必須化 |
| KO fetch | `fetchKnowledgeOSContext`(route L578)・独立の try/catch・失敗で空 context | 工程5 で editor と疎結合化 |
| editor 保険 | `editor-prompt.ts:167-178` LLM verdict と E-0c 基準の**厳しい方採用** | 既に堅牢・発動さえすれば凡庸を弾く |
| H-1/H-2 資産 | `chat_threads.moodboard_id`(列あり)/ `/api/threads/[id]`(GET詳細+messages)/ `/messages`(POST) | 工程1・4・5 の土台が揃っている |

> ★ ★ 重要な事実確認: 現状の中央チャットは **「plain text 応答 + 折りたたみスコア」** であり、E-0e §12 の「7項目表示順」UI は**まだ存在しない**。H-4 工程3 はゼロからの構造化実装。

### ★ 凡庸問題の根本原因(診断との突き合わせ・正確な記録)
2026-05-31 朝の事象は **2 つの失敗面**が重なった:
- (a) **MB 判定の脆さ**: `text.startsWith(MB_PROMPT_SIGNATURE)` は textarea 先頭に既存文字があると false → `isMbCoordinate=false` → editor が動かず凡庸素通り(機能診断で特定した最有力機序)
- (b) **editor の無言フォールバック**: editor が throw すると catch して editorScore 欠落のまま継続(オーナーが観測した "falling back without score")
- → H-4c は **両方**を断つ: (a) を `thread.moodboard_id` 状態判定に置換、(b) を editor 必須化 + KO 疎結合化。

---

## A. 既存資産の実機 verify(§0 に集約)

主要ファイル: `app/(app)/ai/page.tsx`(1051行)/ `app/api/ai/stylist-chat/route.ts` / `lib/prompts/moodboard-prompt.ts` / `lib/prompts/editor-prompt.ts`。いずれも §0 のとおり実機確認済。

---

## B. 5 工程 詳細設計

### 工程1: thread 接続
- `currentThreadId`(URL `?thread=id`・H-3 完成)を監視
- thread 変化時 `GET /api/threads/[id]` で messages ロード → 中央表示
- 送信時 `POST /api/threads/[id]/messages` で user/assistant 両方を永続化
- 状態: 新フック `lib/hooks/use-thread-messages.ts`(messages の取得・追加・楽観更新)
- thread 未選択(`?thread` なし)時: 新規スレッド自動作成 or 「新しいチャット」促し(論点 H4-1 と連動)

### 工程2: localStorage → DB 移行
| 案 | 内容 | 評価 |
|---|---|---|
| **A 自動移行** | 初回アクセス時に localStorage 履歴 → 新規 thread 作成 + messages 一括 INSERT → localStorage クリア | ✅ **推奨**(履歴を失わず thread モデルへ自然移行) |
| B 破棄 | localStorage 捨てて新規 thread から | ❌ 既存会話を失う |
| C 過去履歴 thread | 「過去履歴」専用 thread に隔離 | △ 実装増・UX 中途半端 |
- ★ 推奨 **案A**。移行済み判定は localStorage に `migrated_at` フラグ or キー削除で表現。移行ロジックは `lib/utils/migrate-localstorage.ts`。1 回限り・冪等。

### 工程3: 出力 UI 7項目 + 折りたたみ 5(E-0e §12)
**メッセージ構造の拡張**(`reply` kind を構造化):
```
assistant message =
  content.kind: "reply"
  metadata: {
    direction:   string       // ①今回の方向性 1-2文
    summary:     string       // ②コーデ案の要約
    items:       {category, name}[]   // ③具体アイテム一覧
    mbElements:  {imageRef, note}[]   // ④MB由来の要素
    images?:     string[]     // ⑤画像(生成後 inline)
    quickActions: string[]    // ⑥修正ボタン候補
    // ⑦折りたたみ詳細:
    details: { referenceReflection, elevenPoints, editorScore, koRules, generatedPrompt }
  }
```
- 表示順 7項目を上から即時表示、⑦は `<DetailsFold>`(`<details>` ベース)に格納
- 折りたたみ 5項目 = 参考画像反映 / 11項目 / 品質評価(現 editorScore)/ KO 参照ルール / 生成プロンプト
- ★ サーバー(stylist-chat)が構造化 JSON を返す形に変更 → クライアントは分解レンダリング
- ★ 互換性: 旧 plain text 応答(localStorage 由来)は `direction` 欠落時に従来表示へフォールバック

### 工程4: MB 添付の context object 化
- 現状: `sessionStorage` mb_prompt を本文に prepend(ユーザーに長文露出 = E-0e 問題1)
- 後: thread 作成時に `moodboard_id` を紐付け(H-1 列)。送信時サーバーが `moodboard_id` から **context object** を構築(ユーザーは見ない):
```
context = { moodboard{id,theme,concept,worldview,items}, moodboard_analysis, moodboard_core, translation_rules }
```
- `buildMoodboardPrompt` は**裏で再利用**(露出を消すだけ・ロジック温存)
- ★ MB 一覧から選ぶモーダル UI は **H-5**。H-4 は「thread.moodboard_id があれば context 構築」までを担う

### 工程5: 凡庸問題の構造的根治
- (a) `isMbCoordinate` 判定を `text.startsWith(MB_PROMPT_SIGNATURE)` → **`thread.moodboard_id !== null`** に置換(DB の確実な状態・先頭一致の脆さを排除)
- (b) editor AI を **`isMbCoordinate` 内の必須ステップ**に格上げ。KO fetch 失敗とは**疎結合**(KO は context 補強であり editor 発動の前提にしない)
- (c) editor が throw した場合の方針(論点 H4-6): 無言フォールバック廃止 → リトライ or 明示。最低限 editorScore 欠落のまま凡庸を通さない
- → editor の「厳しい方採用」保険(`editor-prompt.ts:167`)は既に堅牢なので、**発動を保証するだけ**で凡庸は弾ける

---

## C. ファイル影響範囲

### 新規(10)
| ファイル | 役割 |
|---|---|
| lib/hooks/use-thread-messages.ts | thread の messages 取得 / 追加 / 楽観更新 |
| components/chat/MessageList.tsx | 中央 messages 表示 |
| components/chat/Message.tsx | 1 メッセージ(出力UI 7項目) |
| components/chat/MessageContent.tsx | metadata → 構造化表示 |
| components/chat/QuickActionButtons.tsx | 修正ボタン群(⑥) |
| components/chat/DetailsFold.tsx | 折りたたみ 5項目(⑦) |
| components/chat/MoodboardAttachment.tsx | MB 添付の表示(モーダルは H-5) |
| lib/utils/migrate-localstorage.ts | localStorage → DB 移行(冪等) |
| lib/server/moodboard-context.ts | context object 構築(サーバー側) |
| types/chat-message.ts | reply metadata の構造化型 |

### 編集(4)
| ファイル | 変更 |
|---|---|
| app/(app)/ai/page.tsx | localStorage 経路→移行用 / thread 接続 / 送受信 / MB→moodboard_id / 出力UI 構造化 |
| app/api/ai/stylist-chat/route.ts | signature 判定→moodboard_id / context object / editor 必須化 / 構造化 JSON 応答 |
| lib/prompts/moodboard-prompt.ts | signature 経路廃止(長文生成は裏で維持) |
| lib/prompts/editor-prompt.ts | 発動条件・KO 失敗時フォールバック |

**合計: 新規 +400-600 + 編集 +100-200 = +500-800 行 / 8-12 セッション**

---

## D. 段階分割案(★ ★ 推奨)

H-4 を一気に(8-12セッション・1 commit)は verify が複雑・ロールバック重い。**a/b/c に分割推奨**(M5 刻む作法):
| 段階 | 内容(工程) | 行数 | verify ポイント |
|---|---|---|---|
| **H-4a** | thread 接続 + localStorage 移行(工程1+2) | +200-300 | 過去履歴が thread として残り、選択で復元 |
| **H-4b** | 出力UI 7+5 + MB context object(工程3+4) | +200-300 | 応答が 7項目で表示・MB は裏 context |
| **H-4c** | 凡庸根治(工程5) | +100-200 | MB 経由で editor 必ず発動・凡庸を弾く |
- 依存: H-4a → H-4b → H-4c。各段階で**動作する状態を維持**(中央が常に壊れない)。

---

## E. H-5/H-6/H-7 との関係(スコープ厳密化)
- H-4 に**含めない**: MB 一覧選択モーダル UI(H-5)/ feedback→judgment_rules 抽出(H-6)/ G・F 統合(H-7)
- H-4 の MB は「thread.moodboard_id があれば context 構築」まで。添付 UI は H-5。

---

## F. オーナー判断 7 論点(★ 推奨案併記)
| # | 論点 | ★ 推奨 |
|---|---|---|
| H4-1 | localStorage 履歴の扱い | **案A 自動移行**(冪等・履歴を失わない) |
| H4-2 | H-4 を a/b/c 分割するか | **分割**(M5 刻む作法・各段階 verify 可) |
| H4-3 | 出力7項目の構造 | **JSON metadata + クライアント分解**(markdown 直よりロバスト) |
| H4-4 | 修正ボタン群 | **固定セット + LLM 動的の併用**(MVP は固定数種「もっと日常的に/靴変更/もっと尖らせる」) |
| H4-5 | context object 永続化タイミング | **初回メッセージ時に構築・thread に紐付け**(thread 作成時は moodboard_id のみ) |
| H4-6 | editor の KO 失敗時 | **KO なしで editor 発動(疎結合)**・KO はあれば補強 |
| H4-7 | メッセージレンダリング | **構造化 JSON 解析**(旧 plain text はフォールバック表示) |

---

## G. 4本柱との整合 + 不可侵境界線
| 柱 | H-4 での反映 |
|---|---|
| E-0a 表面真似禁止 | context object 構築時に有効 |
| E-0b-rev2 実商品試着 | 工程3 画像で扱う・本格は H-7 |
| E-0c 服好き基準 | ★ 工程5 editor 必須化で凡庸根治 |
| E-0d Knowledge OS | editor と疎結合化(KO 失敗で editor を止めない) |
| E-0e UX | ★ 5 工程すべてが E-0e の実装 |
- 不可侵境界線: 本体 `ac834bb` / doc7 / 最終ビジョン `df36d82` / 既存戦略文書(E-0a〜E-0e)全0変更 → H-4 設計は侵さない。

---

## 検証(本 doc)
- ✅ コード 0 変更(doc 1 件のみ)/ tsc EXIT 0 維持 / 399 PASS 維持
- ✅ 本体 / 戦略文書(E-0a〜E-0e)/ 最終ビジョン / 各設計案 全 0 変更
