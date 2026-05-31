# STYLE-SELF Sprint H — 対話型 AI スタイリスト 実装設計調査(★ E-0e 戦略を実装可能な形に翻訳・論点 1-10 の判断材料整理・★ コード 0 変更・doc のみ)

- 作成日: 2026-05-31
- 起点 HEAD: `0e7c8df`(E-0e 対話型AIスタイリスト戦略文書・5本目DNA保全・clean / 399 PASS / tsc EXIT 0)
- 本 doc の役割: ★ E-0e([STYLE-SELF_E0e_対話型AIスタイリスト_プロダクト構造再定義_戦略文書.md](STYLE-SELF_E0e_対話型AIスタイリスト_プロダクト構造再定義_戦略文書.md))の戦略を、★ ★ 実機の既存資産を verify した上で実装可能な粒度に翻訳し、オーナー判断 10 論点の材料を整理する(★ コード 0 変更・実装は次の指示)
- ★ 実装の北極星: E-0e §1 オーナー verbatim(プロンプト生成ツールではなく対話型 AI スタイリスト)

---

## 0. ★ ★ 既存資産 verify 結果(2026-05-31 実機確認・★ タスク前提の補正含む)

| 項目 | タスク前提 | ★ 実機確認結果 | 補正 |
|---|---|---|---|
| `moodboards` テーブル | (FK 対象として想定) | ✅ **実在**(`026_d1_moodboards.sql`) | FK 可・PK は uuid |
| FK の参照先 | `auth.users` | ✅ プロジェクト慣習は **`public.users(id)`** | `public.users(id)` に統一 |
| 最新 migration 番号 | (未指定) | ✅ **026** が最新(CLAUDE.md 記載は 021 までで**陳腐化**) | 新規は **027 以降** |
| RLS パターン | user_id ベース | ✅ `auth.uid() = user_id` の FOR ALL(+ moodboards は公開行 SELECT 二重) | chat は私的 → 本人 FOR ALL のみ |
| `updated_at` 自動更新 | (未指定) | ✅ 既存 `public.handle_updated_at()` trigger 流用可 | 新テーブルも流用 |
| `lib/knowledge-os/client.ts` | 想定 | ✅ **実在**(`getInfluences` / `getDecisionRules` / `getFailurePatterns`) | client は確定 |
| `fetchKnowledgeOSContext` | client 内想定 | ⚠️ 実体は **`stylist-chat/route.ts` 内**(L578)・MCP client は 5分 in-memory cache | route 側 helper |
| `lib/prompts/stylist-chat.ts` | 想定 | ✅ 実在(他に editor-prompt / tryon-prompt / moodboard-prompt / overlay-intent) | 確定 |
| `worldview_id`(thread 紐付け) | FK 想定 | ⚠️ **単独 worldview テーブルは無い**。worldview は moodboards の snapshot 列 + `worldview_profiles`(user_id PK・1:1) | thread に worldview_id は不要(下記§B) |
| `ai_history` | 関係整理対象 | ✅ 実在(`016`・type discriminated・jsonb input/output)| §B Step6 で関係定義 |

> ★ 注記: CLAUDE.md のフォルダ構成は migration 021 / Sprint 49 時点で止まっており、`moodboards`(026)や E-0 戦略文書群は未記載。実装着手時に CLAUDE.md 追記が必要(ドキュメント更新ルール 1)。

---

## A. 既存資産確認(E-0e §13 の実機裏取り)

### Step 1: ai_history テーブル / stylist-chat API
- `ai_history`(`016`): `id / user_id→public.users / type(4種) / input jsonb / output jsonb / metadata jsonb / created_at`。RLS `auth.uid()=user_id` FOR ALL。**thread 概念なし**(intent 別の単発ログ)。
- `app/api/ai/stylist-chat/route.ts`: 認証 → body(text/intent/history)→ intent 別 context SELECT + KO fetch 並列 → Haiku reply → (MB 経由のみ)エディタ AI → 出力フィルタ。**履歴は client が `history`(N=3)を毎回送る方式・サーバーに永続化されない**(E-0e 問題3 の構造的根)。

### Step 2: 既存実装(E-0e §13 の実体)
- `lib/prompts/moodboard-prompt.ts`: `buildMoodboardPrompt` + `MB_PROMPT_SIGNATURE`(固定文・先頭一致分岐)
- `lib/prompts/stylist-chat.ts`: 5 intent 統合 system prompt
- `lib/prompts/editor-prompt.ts`: C-2c-1 エディタ AI(10軸+6チェック・厳しい方採用の保険)
- `lib/prompts/tryon-prompt.ts`: C-2a/C-2g(着用イメージ prompt・【厳守4】6重視点)
- `app/(app)/ai/page.tsx`: 現 /ai(textarea + 段階A/B + EditorScoreFold)
- `app/(app)/moodboard/[id]/page.tsx`: MB 詳細 +「チャットに渡す」(sessionStorage 経由)
- `app/api/tryon/generate/route.ts`: 認証必須(401 auth required)・FASHN tryon-max
- 5 intent: diagnose / closet / style-consult / brand-learn / coordinate

### Step 3: knowledge-os 連携現状
- `lib/knowledge-os/client.ts`: `getInfluences / getDecisionRules / getFailurePatterns`(MCP 経由・5分 cache)
- `fetchKnowledgeOSContext`(stylist-chat route L578): 3 関数並列フェッチ・全 5 intent 共通注入
- **ベストエフォート**: KO fetch 失敗時は catch して空 context で続行(2026-05-31 朝の凡庸事象の一因)

---

## B. DB スキーマ詳細設計(論点 2)

> ★ FK は全て `public.users(id) on delete cascade`、PK は `uuid default gen_random_uuid()`、RLS は `auth.uid()=user_id` の本人 FOR ALL(既存 016 / 026 慣習に統一)。

### Step 4: 新規 4 テーブル

**chat_threads**
```sql
id            uuid pk default gen_random_uuid()
user_id       uuid not null references public.users(id) on delete cascade
title         text not null default ''         -- 自動生成 or ユーザー編集
moodboard_id  uuid references public.moodboards(id) on delete set null  -- 添付MB(nullable)
created_at    timestamptz not null default now()
updated_at    timestamptz not null default now()
last_message_at timestamptz not null default now()  -- 一覧ソート用
```
> ⚠️ `worldview_id` は**置かない**: 単独 worldview テーブルが無く、worldview は ① moodboards の snapshot 列、② `worldview_profiles`(user_id PK・ユーザー 1:1)で表現される。thread の世界観は moodboard_id 経由 or user 経由で導出可能 → 列追加は冗長。必要なら将来 `worldview_snapshot jsonb` を検討。

**messages**
```sql
id           uuid pk
thread_id    uuid not null references public.chat_threads(id) on delete cascade
role         text not null check (role in ('user','assistant'))
content      text not null
attachments  jsonb           -- 画像 / MB / コーデ案 等
metadata     jsonb           -- editorScore / intent / KO参照ID 等
created_at   timestamptz not null default now()
```

**feedback**
```sql
id           uuid pk
thread_id    uuid not null references public.chat_threads(id) on delete cascade
message_id   uuid references public.messages(id) on delete cascade  -- 対象メッセージ
kind         text not null   -- 'like'|'dislike'|'more_x'|'change_item' 等
content      text not null default ''
created_at   timestamptz not null default now()
```

**judgment_rules**
```sql
id                     uuid pk
user_id                uuid not null references public.users(id) on delete cascade
rule                   text not null      -- 「不穏さを丸めない」等
extracted_from_thread_id uuid references public.chat_threads(id) on delete set null
priority               int not null default 5 check (priority between 1 and 10)
kind                   text not null check (kind in ('preference','ng','style_rule'))
created_at             timestamptz not null default now()
```

### Step 5: RLS ポリシー
- `chat_threads` / `judgment_rules`: `auth.uid()=user_id` の本人 FOR ALL(WITH CHECK 同条件)
- `messages` / `feedback`: 親 thread 経由 EXISTS 判定(moodboard_items と同型作法 — 子テーブル単独で穴を作らない)
  ```sql
  using (exists (select 1 from public.chat_threads t
                 where t.id = thread_id and t.user_id = auth.uid()))
  ```
- chat は私的 → moodboards のような公開 SELECT は**不要**(将来スレッド共有時のみ追加)

### Step 6: ai_history との関係(★ 推奨判断)
| 案 | 内容 | 評価 |
|---|---|---|
| a 廃止移行 | ai_history → messages へ全移行 | ❌ 既存4 type(診断/相談/写真/理想コーデ)は thread 外でも使われ、移行コスト大・退行リスク |
| b **併存** | ai_history = intent 別単発ログ(現状維持)/ messages = thread ベース会話 | ✅ **推奨** |
| c 統合 | ai_history を messages.metadata に内包 | △ 概念が混ざる・履歴タブ(Sprint39)退行 |
- ★ 推奨 **案b 併存**: ai_history は既存「履歴タブ」資産として温存。新 messages は対話型の永続文脈。両者は疎結合(必要なら thread から ai_history を参照 ID で繋ぐのは将来検討)。

### Step 7: migration SQL 設計
- 配置: `supabase/migrations/`、採番 **027 以降**(026 が最新)
- 順序: chat_threads → messages → feedback → judgment_rules(FK 依存順)
- 単一ファイル `027_h1_chat_threads.sql`(4 テーブル + RLS + index 一括)を推奨(d1_moodboards と同型の 1 ファイル多テーブル)
- インデックス: `chat_threads(user_id, last_message_at desc)` / `messages(thread_id, created_at)` / `feedback(thread_id)` / `judgment_rules(user_id, priority desc)`
- updated_at: `chat_threads` に `handle_updated_at()` trigger 流用
- 想定: **+200〜400 行 SQL** + `types/database.ts` 型追記

---

## C. 旧 MB 画面の扱い(論点 4)

### Step 8: /moodboard/[id] の現役割
- できること: MB 作成・編集・閲覧・「チャットに渡す」(sessionStorage→/ai)
- 利用者: オーナー(既存ユーザー)/ 価値: MB を**視覚的に組み立てる場所**

### Step 9: 3 案比較
| 案 | 内容 | 利点 | 欠点 |
|---|---|---|---|
| **A 残す** | MB 作成は独立画面・/ai で添付 | 既存 UX 保持・作成に集中可 | 導線2画面。sessionStorage 経路は廃止し MB 添付モーダルに置換 |
| B リダイレクト | /moodboard → /ai | 画面1本化 | 既存ブックマーク無効・作成体験劣化 |
| C 統合 | /ai 内で MB 作成も完結 | 完全統合 | 実装重い(作成 UI を /ai に移植) |

★ ★ Sprint H 推奨: **H-3/H-4 時点では案A**(残す+添付)→ 将来案C 移行可。理由: H-4(中央チャット再設計)が最大工数のため、MB 作成 UI 移植(案C)を同時に抱えない。

---

## D. 新 MVP 線引き(論点 7・★ 最重要)

### Step 10: 「対話型 AI スタイリストの最小成立」3 層

**★ ★ ★ Layer 1 — 絶対必須(MVP コア)**
- Chat Thread 作成・切替・履歴永続(027 スキーマ)
- 1 スレッドで会話継続(history を DB から復元)
- MB 添付(context object 化・プロンプト非露出)
- 短い出力 UI(表示順7)+ 折りたたみ(詳細5)
- 対話で修正(「もっと不穏に」を文脈で解釈)
- → **これだけで「対話型」が成立**(E-0e §11 の競争生命線=文脈永続を満たす)

**★ ★ Layer 2 — 強く望ましい(Phase 1.5)**
- KO 連携(生成前取得・参照)/ feedback 保存 / 次回反映(judgment_rules 蓄積)

**★ Layer 3 — 将来拡張(Phase 2)**
- 着用イメージ統合(C-1/C-2a/C-2g)/ 実商品試着(Sprint G)/ 5 intent 自然統合 / Vision エディタ

★ ★ ★ 推奨線引き: **Layer 1 完成で MVP リリース可** / Layer 2 = MVP 直後 / Layer 3 = 段階的。
→ E-0e §16「プロンプト生成 MVP は無効化」の具体化。新 MVP の合格条件 = Layer 1 の 5 項目が動作。

---

## E. 既存実装の主役/サブ整理(論点 5 / 9)

### Step 11: コンポーネント別 4 分類
| 分類 | 対象 | 扱い |
|---|---|---|
| **保持・裏側再利用** | `buildMoodboardPrompt`→MB analysis 抽出に転用 / `tryon-prompt`→画像生成時のみ / `editor-prompt`→送信時に内部実行 / 5 intent system prompt→自動判定 | 露出は消すがロジックは生かす |
| **主役から外す** | /ai textarea の長文 prompt 表示 / 「チャットに渡す」ボタン(→MB 添付に) / 11項目一括表示(→折りたたみ) | 廃止 |
| **統合** | C-1/C-2a/C-2g 着用イメージ→message attachment / C-2c-1 エディタ→自動実行・スコアは折りたたみ / C-2g【厳守4】→世界観ルック生成時 | thread 内に吸収 |
| **廃止検討** | MVP-1c 直接 coordinate(MB なし直接コーデ) | チャットで意図表明できれば残す(自動 intent で吸収)→ ★ 推奨: 残す |

### Step 12: 5 intent 統合方針(論点 5)
- ★ ★ 推奨: **自動判定をデフォルト + 必要時のみ明示**
- 実装: system prompt に「あなたは AI スタイリスト・5 対応領域(診断/クローゼット/相談/ブランド学習/コーデ)を文脈で切替」を教示。既存段階A(overlay-intent)を裏で流用しつつ、ユーザーには intent を見せない。
- C-2c-1 凡庸問題(論点9): H-4 で UX 観点から再対処。`MB_PROMPT_SIGNATURE` 先頭一致の脆さ → thread の `moodboard_id` 状態で coordinate 確定に置換(構造的に根治)。

---

## F. Sprint H 段階分割の現実的見積もり

### Step 13: H-1〜H-7 詳細スコープ
| Sprint | スコープ | 行数 | セッション |
|---|---|---|---|
| H-1 | DB スキーマ + migration(027)+ types | +200-400 | 2-3 |
| H-2 | スレッド API(/api/threads GET/POST/DELETE・/[id]/messages・/[id]/feedback) | +300-500 | 3-4 |
| H-3 | 左ペイン UI(履歴一覧・選択・新規・削除) | +400-600 | 4-6 |
| H-4 ★最大 | 中央チャット UI 再設計(出力UI7+折りたたみ5・MB添付モーダル・着用イメージ inline・修正ボタン群) | +500-800 | 6-10 |
| H-5 | MB 添付(context object 化・moodboard_analysis 取得保存・thread 紐付け) | +200-300 | 2-3 |
| H-6 | フィードバック保存 + judgment_rules 抽出 + 次回反映 | +300-500 | 3-5 |
| H-7 | G(tryon-max 実商品試着)/ F(KO 連携拡張)を thread 内統合 | +500-1000 | 5-10 |
| **合計** | | **+2,400-4,100** | **25-40** |
| **★ Layer 1 MVP のみ**(H-1+2+3+4+5) | | **+1,600-2,600** | **17-26** |

依存: H-1→H-2→(H-3 / H-4 / H-5 並行可)→H-6→H-7。

---

## G. コスト試算

### Step 14: 月コスト影響(/user・現状 C-2g 後 ¥369 基準)
| 要素 | 増分 |
|---|---|
| KO 呼出増 | +¥50-80 |
| 履歴 context 増(token 増) | +¥80-120 |
| Vision エディタ(将来) | +¥150 |
- ★ ★ Layer 1 MVP 完成後: **¥499-569 / user / 月**
- ★ ★ ★ Sprint B-3 案 P1(月 N 回上限)は **必須**(履歴 context で token 単価が逓増するため上限ガード前提)

---

## H. 既存戦略文書との整合性確認(論点 8)

### Step 15: E-0a〜E-0d との整合
| 柱 | Sprint H での反映 | 整合 |
|---|---|---|
| E-0a 表面真似禁止 | MB analysis 抽出時に有効(buildMoodboardPrompt 転用) | ✅ |
| E-0b-rev2 実商品試着 | H-7 で Sprint G 統合 | ✅ |
| E-0c 服好き基準 | C-2c-1 を thread 内自動実行 | ✅ |
| E-0d Knowledge OS | H-6 で次回反映に直結(judgment_rules) | ✅ |
→ ★ ★ ★ E-0e(容器)は 4 本柱を**矛盾なく統合**。

### Step 16: 不可侵境界線
- 本体 `ac834bb` / doc7 / 最終ビジョン `df36d82` / ③専章 / ③コスト / Phase 2 後ゲート / 既存設計判断 1〜10 文言 — ★ Sprint H は**侵さない**(新規テーブル追加・既存テーブル/判断は不変)。

---

## 付録. オーナー判断 10 論点 まとめ(本 doc の推奨)
| # | 論点 | ★ 本 doc 推奨 |
|---|---|---|
| 1 | Sprint H 着工時期 | push 後オーナー判断(本 doc は材料提供) |
| 2 | DB スキーマ方針 | **新規4テーブル**(027・`public.users` FK・本人RLS) |
| 3 | 左ペイン優先度 | H-1/2 後。ただし MVP は単一スレッドでも成立可 |
| 4 | 旧 MB 画面 | **案A(残す+添付)**→将来案C |
| 5 | 5 intent 統合 | **自動判定デフォルト + 必要時明示** |
| 6 | G/F 統合時期 | **H-7 で最後**(Layer 3) |
| 7 | MVP 再定義 | **Layer 1 完成でリリース可**(プロンプト生成MVPは無効) |
| 8 | E-0a〜d 整合 | ✅ 矛盾なし(容器として統合) |
| 9 | C-2c-1 凡庸問題 | **H-4 で UX 再対処**(signature 依存を thread 状態に置換) |
| 10 | Sprint D MVP 再々評価 | 旧パターン破棄・新 Layer 1 基準で再設計 |

---

## 検証(本 doc)
- ✅ コード 0 変更(doc 1 件のみ)/ tsc EXIT 0 維持 / 399 PASS 維持
- ✅ 本体 / 既存戦略文書(E-0a〜E-0e)/ 最終ビジョン / 各設計案 全 0 変更
- ✅ 不可侵境界線 維持
