# STYLE-SELF Sprint H-3 — 左ペイン スレッド履歴一覧 UI 設計調査(★ E-0e §9 画面構造 + Sprint-H ロードマップに基づく UI 細部設計・H-4 中央チャット改造との整合・★ コード 0 変更・doc のみ)

- 作成日: 2026-05-31
- 起点 HEAD: `1a7c2e9`(H-2 スレッド管理 API CRUD + CLAUDE.md 同期・clean / 399 PASS / tsc EXIT 0)
- 本 doc の役割: E-0e §9「左:チャット履歴一覧 / 中央:チャット / 右or下:MB等」のうち **左ペイン**を実装可能な粒度に設計。H-4(中央チャット大改造)との責務分離を明確化し、ちゃぶ台返しを回避する(★ コード 0 変更・実装は次の指示)
- Layer 1 進捗: 2/5(H-1 DB / H-2 API 完了)→ 本 doc は H-3 の青写真

---

## 0. ★ ★ 既存資産 verify 結果(2026-05-31 実機確認・★ タスク前提の重要補正)

| 項目 | タスク前提 | ★ 実機確認結果 | 補正 |
|---|---|---|---|
| 新規 component 置き場所 | `components/ai/*` | ⚠️ **`components/ai/` は存在しない**。chat 系は **`components/chat/`**(MenuDrawer / MoodboardPickerModal / SuggestionChips 等) | 新規は **`components/chat/`** に置く |
| 5 intent タブ | 「上部タブで明示選択」 | ⚠️ **UI にタブは存在しない**。intent は `/api/overlay/intent` で**自動判定**(Haiku)。/ai は単一全画面チャット | Step13 は前提崩れ → 「タブ無し・H-3 で何も足さない」に読み替え |
| 状態管理 | 「SWR 推奨」 | ⚠️ **SWR 未導入**。全箇所 plain `fetch` + `useState`(例: `fetch("/api/profile")`) | use-threads は **plain fetch wrapper**(SWR 導入は別判断) |
| 会話履歴の現状 | (thread 前提) | ⚠️ messages は **localStorage 単一会話**(key `style-self:ai:messages:v1`)。thread 概念なし | 既存履歴の移行を論点化(下記 §C-移行) |
| `lib/hooks/` | use-threads.ts 想定 | ⚠️ **`lib/hooks/` 不在**(既存は fetch を component 内インライン) | 新規ディレクトリ作成 or インライン(下記推奨) |
| (app) レイアウト | (共通サイドバー?) | `app/(app)/layout.tsx` は `{children} + DevAuthBadge` の**最小 pass-through** | 左ペインは **/ai/page.tsx 内で完結** |
| H-2 API CRUD | 完備か | ✅ 完備(GET一覧 / POST作成 / GET詳細 / PATCH / DELETE / messages / feedback) | H-3 が叩く API は揃っている |

> ★ 注記: /ai は **1051 行**の大型 client component(`min-h-screen flex flex-col`: header + スクロール messages + 入力欄)。H-3 はこの**外側に左ペインを足し、中央(既存)は触らない**のが安全。

---

## A. 既存資産の確認

### Step 1: /ai 現状
- `app/(app)/ai/page.tsx`(1051 行・`"use client"`)= **単一全画面チャット**(タブなし)
- intent は `/api/overlay/intent` で自動判定(MB 経由は signature 先頭一致で coordinate 確定 = 凡庸問題の根・H-4 で根治)
- 履歴は `localStorage`(`STORAGE_KEY = "style-self:ai:messages:v1"`)に persist(hydrate race 対策済)
- MB 受け渡し: `sessionStorage` の `mb_prompt` / `mb_id`(C-3)

### Step 2: 既存 UI 資産
- `components/chat/`: MenuDrawer / MoodboardPickerModal / ClosetPickerModal / SuggestionChips / InputAttachments / WorldviewCard
- Tailwind(`bg-white` / `rounded-2xl` / `border-gray-100` / `flex` 系)。shadcn は不使用・**素の Tailwind + 自前 component**
- モーダル枠の既存パターン: `fixed inset-0 z-50 bg-black/50 / max-w-md / max-h-[90vh] / ×ボタン`

### Step 3: H-2 API(H-3 で叩く先・完備)
| API | メソッド | 用途 |
|---|---|---|
| /api/threads | GET | 一覧(last_message_at 降順) |
| /api/threads | POST | 新規作成 |
| /api/threads/[id] | GET | 詳細(messages 含む) |
| /api/threads/[id] | PATCH | title / moodboard_id 更新 |
| /api/threads/[id] | DELETE | 削除 |

---

## B. 左ペイン UI 細部設計

| Step | 項目 | ★ 推奨 | 補足 |
|---|---|---|---|
| 4 | 一覧表示形式 | **案1 シンプル行リスト**(title + 最終更新日・約48px) | ChatGPT/Claude 採用・MVP に過剰でない・将来カード化可 |
| 5 | 並び順 | **last_message_at DESC 固定**(切替なし) | 将来 作成日/名前順 |
| 6 | タイトル | **最初のメッセージ先頭30文字 + 手動編集可** | LLM 要約は追加コスト → MVP では先頭30文字 |
| 6 | タイトル編集 | **MVP に入れる**(ホバー時ペンアイコン → PATCH) | PATCH は H-2 完備 |
| 7 | 選択状態 | 選択中=薄グレー背景 or 左ボーダー / ホバー=微変化 | 既存 Tailwind パターン(`bg-gray-100` 等) |
| 8 | 新規作成ボタン | **案A 上部 大ボタン「+ 新規」** | 視認性最優先・ChatGPT/Claude 採用 |
| 9 | 削除 UX | **案A ホバー時ゴミ箱 → 確認モーダル** | シンプル・PC/モバイル両対応 |
| 10 | 検索ボックス | **なし(MVP)** | L2 で導入(20+ スレッド時) |
| 11 | 件数バッジ | **なし(MVP)** | シンプル維持 |

---

## C. レイアウト全体への影響

### Step 12: /ai の構造変遷
```
現状(1ペイン):     [header][スクロール messages][入力欄]   ← /ai/page.tsx 内で完結

H-3 後(2ペイン):   [左:スレッド履歴 280px][中央:既存チャットをそのまま内包]
                    ★ 中央の中身は一切触らない(既存 1051 行を子に格納)

H-4 後:            [左:スレッド履歴][中央:大改造チャット(出力UI7)][右/下:MB/画像/商品]
```

### ★ 移行論点(タスク未記載・実機 verify で判明)
現在 messages は **localStorage 単一会話**。thread モデル導入で「既存 localStorage 履歴」をどう扱うか:
- ★ 推奨: H-3 では **localStorage 履歴はそのまま"暫定スレッド"扱いで残す**(破棄しない)。DB thread への正式移行は H-4(送受信ロジック改造時)に実施。H-3 は左ペイン追加に専念し、中央の persist 機構は触らない。

### Step 13: 5 intent の扱い(★ 前提補正)
- タスクは「5 intent タブ」を前提とするが **UI にタブは存在しない**(自動判定)。
- → H-3 の判断: **何も足さない・何も消さない**(現状の自動判定維持)。intent 統合の再設計は E-0e §13 どおり **H-4**。
- (タスクの案A「タブ残す」に実質一致 = H-3 では中央・intent に手を入れない)

### Step 14: レスポンシブ
- デスクトップ: 左ペイン **280px 固定** + 中央 `flex-1`
- モバイル: **案A ハンバーガー**(左ペインをドロワー開閉)。既存 `MenuDrawer`(components/chat)と同型の `useState` 開閉が流用可 → ChatGPT/Claude モバイル UI と同じ

---

## D. 既存コードへの影響範囲(★ パス補正済)

### Step 15: ファイル変更
**新規(★ `components/ai/` ではなく `components/chat/` に統一)**
| ファイル | 役割 |
|---|---|
| `components/chat/ThreadsSidebar.tsx` | 左ペイン本体 |
| `components/chat/ThreadItem.tsx` | スレッド1行(選択/ホバー/ペン/ゴミ箱) |
| `components/chat/NewThreadButton.tsx` | 「+ 新規」ボタン |
| `components/chat/DeleteThreadModal.tsx` | 削除確認モーダル(既存モーダル枠流用) |
| `lib/hooks/use-threads.ts` | スレッド CRUD の fetch wrapper(★ SWR 不使用・plain fetch + useState) |

> ※ `lib/hooks/` は新設。既存に hook ディレクトリは無いが、CRUD ロジックを page.tsx(既に1051行)へ足すのは肥大化するため分離を推奨。命名は既存 component(PascalCase.tsx)に合わせる。

**編集**
- `app/(app)/ai/page.tsx`: 左ペイン + 中央の 2 ペイン化(既存チャットを中央に内包・currentThreadId 配線)= +50-100 行

**合計: +300-450 行**(component 5 + page.tsx 編集)

### Step 16: 状態管理
- `currentThreadId`(**URL クエリ `?thread=id`** 推奨: リロード耐性 + 共有可・将来の deep link)
- threads list(`use-threads.ts` の fetch + useState)
- new/delete モーダル開閉(useState)
- → 状態は少ない。**SWR 不要**(plain fetch で十分・依存追加を避ける)

---

## E. H-4 との整合(★ ★ ★ ちゃぶ台返し回避)

| H-3 で固める(安定・触る) | H-4 で大改造(H-3 では触らない) |
|---|---|
| 左ペイン全体構造 | 中央チャットの出力 UI(7項目 + 折りたたみ5) |
| スレッド一覧 / 新規 / 削除 / 改名 | メッセージ送受信ロジック(DB thread 化) |
| currentThreadId 管理(URL クエリ) | MB 添付モーダル(context object 化) |
| 2 ペイン化 + レスポンシブ | 着用イメージ inline 表示 / 修正ボタン群 |
| | 5 intent 統合方法・signature 依存の根治 |

★ ★ ★ 責務: **H-3 = 容器(左ペイン + 全体レイアウト)/ H-4 = 中身(中央チャット)**。H-3 は中央の既存 1051 行を**子として内包するだけ**で中身を変えない → H-4 の大改造と衝突しない。

---

## F. 凡庸問題との関係(オーナー 2026-05-31 朝の発見)

### Step 18
- 凡庸 fix は **H-3 単独では不可**。根治は H-4(`MB_PROMPT_SIGNATURE` 先頭一致依存 → `thread.moodboard_id` 状態管理に置換)。
- H-3 は thread / moodboard_id を持つ**左ペインという土台**を用意する役割(H-4 がその上で根治)。

---

## G. オーナー判断 7 論点(★ 推奨案併記)

| # | 論点 | ★ 本 doc 推奨 |
|---|---|---|
| H3-1 | タイトル自動生成方法 | **先頭30文字**(LLM 要約は追加コストで MVP 過剰) |
| H3-2 | タイトル編集機能 | **MVP に入れる**(ホバー時ペン → PATCH・H-2 完備) |
| H3-3 | 削除 UX | **ホバー時ゴミ箱 + 確認モーダル** |
| H3-4 | 5 intent タブ | ⚠️ **前提補正: タブは元々無い** → H-3 では中央/intent に触らない(H-4 で再設計) |
| H3-5 | モバイル対応 | **ハンバーガー(ドロワー)**・既存 MenuDrawer 同型 |
| H3-6 | 状態管理(currentThreadId) | **URL クエリ `?thread=id`**(リロード耐性・共有可) |
| H3-7 | データ取得方式 | **plain fetch wrapper(`lib/hooks/use-threads.ts`)** ・SWR 不使用(未導入・依存追加回避) |
| (追加) | 既存 localStorage 履歴の扱い | H-3 では残す(破棄しない)・DB 正式移行は H-4 |
| (追加) | 新規 component 置き場所 | **`components/chat/`**(`components/ai/` は不在) |

---

## 検証(本 doc)
- ✅ コード 0 変更(doc 1 件のみ)/ tsc EXIT 0 維持 / 399 PASS 維持
- ✅ 本体 / 戦略文書(E-0a〜E-0e)/ 最終ビジョン / 各設計案 全 0 変更
- ✅ 不可侵境界線 維持
