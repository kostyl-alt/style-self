# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 注: このリポジトリのコードは `style-self/` 配下。コマンドは `style-self/` をカレントにして実行する。

# CLAUDE.md — Style Self プロジェクト憲法

## プロジェクト概要

「持つ・選ぶ・組む・買う」を世界観を軸に一つの判断フローで扱えるワードローブOS。
Next.js 14 + Supabase + Claude API で構築するファッションアプリ。

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フロントエンド | Next.js 14 App Router（TypeScript + TailwindCSS） |
| バックエンド | Next.js Route Handlers（API Routes） |
| DB / Auth / Storage | Supabase（PostgreSQL + Supabase Auth + Supabase Storage） |
| AI | Anthropic Claude API（`claude-sonnet-4-6` / 軽量タスクは `claude-haiku-4-5`） |
| Supabase SSR | `@supabase/ssr` |
| 外部API | 楽天市場 Ichiba Item Search API |

---

## 高レベルアーキテクチャ（横断フロー・複数ファイルにまたがる設計）

ここは**読むのに複数ファイルが要る big picture**。新機能はこの流れに合流させる。
（フォルダ構成 / DB / 環境変数 / 楽天 / Knowledge OS の詳細は `.claude/rules/*.md` に path-scoped で分離＝該当ファイルを触ると自動で読まれる。下部「詳細ルール」参照。）

### モデルの使い分け（`lib/claude.ts`）
- 既定 `MODEL = claude-sonnet-4-6`。**会話AI・意図分類など軽量タスクは `HAIKU_MODEL = claude-haiku-4-5`**（コーディングルールの Sonnet 必須に対する、claude.ts に明記された例外。選択は呼び出し側の責任）。
- ヘルパ: `callClaude`（テキスト）/ `callClaudeJSON`（`text.indexOf("{")`〜`lastIndexOf("}")` を抽出してパース）/ `callClaudeWithImage<T>`（画像**1枚**→JSON）/ `callClaudeWithImageText`（画像1枚→自然文）。⚠️**複数画像を1リクエストで送るヘルパは存在しない**（必要なら新設）。
- ⚠️ `callClaudeJSON` は `maxTokens` 不足で JSON が途中切れ→parse 失敗。複雑な応答は `maxTokens: 2048+` を指定。

### AIスタイリスト・チャットの2段パイプライン（`app/(app)/ai/page.tsx`）
- messages / temporaryMode は `ChatSessionProvider` に持ち上げ（/ai↔他画面の往復で生存・cold openで初期化）。
- **段階A** `POST /api/overlay/intent`（Haiku・`lib/prompts/overlay-intent.ts`）= 自然言語→intent分類（coordinate/style-consult/brand-learn/closet 他）。
- **段階B** `POST /api/ai/stylist-chat`（Haiku）= `STYLIST_CHAT_INTENTS` を自然文 reply / 構造化 `coordinate_v2` に。intent別 context は `lib/stylist-chat/context.ts`（**サーバが auth.uid() で自前SELECT**・client 渡しは信頼しない）。
- **MB添付時**は `MB_CONTEXT_OBJECT` 経路で `moodboard_analysis` を読み coordinate を `coordinate_v2` JSON で返す（`COORDINATE_ACTIONABLE_OUTPUT_INSTRUCTION` / parse は `lib/utils/parse-coordinate-reply.ts`・失敗時は reply フォールバック）。フロントは intent を尊重して経路分岐（ブランド質問は brand-learn カードへ・コーデは coordinate を維持）。
- 安全網 `lib/utils/strip-raw-json-reply.ts` が「LLMが自然文契約を破って吐いた生JSON」を最終fallbackで画面に出さない。

### ブランドマッチング（決定的・LLMに作らせない）
- `lib/knowledge/brand-match.ts` `matchBrands`（純関数・STYLE_AXES タグでスコア・hard制約 pre-filter） ← `brand-facts.ts` `computeBrandMatches`（style_signals / preference / 発話から `StyleFacts` を組立・`UTTERANCE_RULES`） ← `brand-render.ts` `renderBrandMatchCards`（カードを決定的に文字列化）。
- 辞書は DB `brands` + コードの `STYLE_AXES`（`lib/style-taxonomy.ts`・genre/culture/era/color/silhouette/material/mood）。⚠️**固有名の捏造・国籍断定を構造的に防ぐため、カード本体はコードが組み、LLMは前置き/締めの自然会話だけ**。

### ムードボード分析（2系統 + Moodboard First 3層）
- **per-image Vision**: `/api/moodboards/[id]/items/analyze`（と `from-url`）→ `lib/utils/vision-analyzer.ts` `analyzeImage`（実画像1枚・Vision・Sonnet）。`moodboard_items` に caption + `vision` jsonb（構造化facts・`styleSignals` は STYLE_AXES に正規化）。
- **board analysis**: `/api/moodboards/[id]/analyze` → `lib/prompts/moodboard-analysis.ts` `analyzeMoodboard`（**caption 集約**・Sonnet）→ `moodboard_analysis`（worldview_core/colors/.../shopping_axis/styling_axis/`brief`）。読み取りは `lib/utils/moodboard-analysis-service.ts`（GETは生成しない・POSTで再生成upsert）。
- **Moodboard First 構想**＝「服から始めない」＝画像ごとの事実→集約(repeated/accent)→board brief の3層（Layer1 vision / Layer2 集約 / Layer3 brief）。⭐**事実集約は決定的（純関数）・意味づけだけLLM**。

### プライバシー三重防御（worldview_tags 英語スラッグを UI に出さない）
1. **jsonb 列絞り SELECT**（取得経路で英語スラッグを引かない）/ 2. **system prompt で出力禁止明示** / 3. **出力フィルタ `stripCanonicalSlugs`**（`PRODUCT_WORLDVIEW_TAGS` 31語を検出削除・`context.ts`）。

### 設計思想「構造で強制（祈らない）」
LLM が盛る/逸脱する余地は**コード側の決定的処理で消す**のが一貫方針。実例: 生JSON素通しを止める `stripRawJsonReply` / ポエム見出しを止める `buildHeadingTags`（fitConditions から見出しを組む）/ ブランド捏造を止める `matchBrands`+`renderBrandMatchCards` / 推測値は `basis: observed|inferred` で機械可読に分離。**プロンプトで効かないと分かったら構造に倒す**。

### フラグ・テスト
- フラグは `lib/flags.ts`（`NEXT_PUBLIC_*`・原則 default OFF・**OFF / 該当state false で現状維持＝回帰ゼロ**）。一覧と env は `.claude/rules/env-and-flags.md`。
- 専用テストランナーは無い。検証は **`npx tsc --noEmit` + `npm run build` の green** + 実機確認（認証が要るチャット/MB系はオーナー実機で）。コミットは実機OK後・ユーザー確認を挟む（`co-authored-by` 不要）。

---

## Supabaseクライアントの使い分け

| ファイル | 使用箇所 |
|---------|---------|
| `supabase-server.ts` | Route Handlers（`app/api/`） |
| `supabase-browser.ts` | Client Components（`"use client"`） |
| `supabase.ts` | service role が必要な管理処理のみ |

---

## コーディングルール

### 必須
- `"use client"` はインタラクティブなコンポーネントにのみ付ける（Server Components がデフォルト）
- Supabaseクエリは必ず `lib/` 経由（コンポーネント内に直接 supabase クライアントを書かない）
- Claude API の呼び出しは `app/api/` ルートからのみ（クライアントサイドから直接叩かない）
- 型定義は `types/index.ts`（アプリ型）と `types/database.ts`（DB型）に集約する
- モデルは原則 `claude-sonnet-4-6`（`lib/claude.ts` の `MODEL` 定数）。軽量タスクのみ `HAIKU_MODEL`（claude.ts に明記された例外）

### 禁止 / 既存パターン
- `any` 型の使用禁止 / `console.log` の残置禁止
- ⚠️ Supabase v2 の `.insert()` / `.update()` は `never` 型化を `as never` キャストで回避（**全 insert/update 箇所で必要・既存パターン踏襲**・詳細コード例は `.claude/rules/database.md`）

### コメント
- 「なぜそうするか」が非自明な場合のみ書く。コードが何をするかの説明コメントは書かない。

---

## 作業の進め方ルール

### ドキュメント更新ルール
1. **新しいファイルを作成したら `.claude/rules/folder-structure.md` のフォルダ構成に追記する**
2. **実装が完了したら `CHANGES.md` の該当項目を ✅ に更新する**
3. **想定外のファイル構成の変化があった場合は実装前に報告して確認を取る**
4. マイグレーションSQLを作成したら `supabase/migrations/` に追加し、`.claude/rules/database.md`（マイグレーション一覧・DBテーブル）と `.claude/rules/folder-structure.md` に記載する

### 実装方針
- 1項目ずつ確認しながら進める（一気に全部やらない）
- 実装前に「何をどう変えるか」を短く宣言してから着手する
- 型チェック（`npx tsc --noEmit`）を実装後に必ず実行する
- バグ修正時はエラーメッセージを詳細化して次回のデバッグを容易にする

---

## よく使うコマンド

```bash
npm run dev          # 開発サーバー起動
npx tsc --noEmit     # 型チェック
npm run build        # ビルド確認
```
楽天商品同期の curl は `.claude/rules/rakuten.md`。

---

## 詳細ルール（`.claude/rules/`・path-scoped・該当ファイルを触ると自動読込）

| ファイル | 内容 | paths(発火条件) |
|---|---|---|
| `folder-structure.md` | フォルダ構成（**新規ファイルはここに追記**） | app/components/lib/types/supabase |
| `database.md` | DBテーブル / マイグレーション一覧 / Supabase 型バグ詳細 | supabase/migrations, lib/supabase*, app/api, types/database |
| `env-and-flags.md` | 環境変数 / フィーチャーフラグ一覧 | .env*, lib/flags.ts, app/api |
| `rakuten.md` | 楽天API認証・同期コマンド | lib/rakuten.ts, app/api/admin/sync-* |
| `knowledge-os.md` | Knowledge OS（MCP）連携手順・報告ルール | lib/knowledge*, app/api/ai |
| `styling-quality.md` | スタイリング品質（事実ベース/構造再現/断定回避/買える条件/固有名捏造防止） | lib/prompts, app/api/ai, lib/utils/vision-analyzer.ts |
