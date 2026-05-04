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
| AI | Anthropic Claude API（`claude-sonnet-4-6`） |
| Supabase SSR | `@supabase/ssr` |
| 外部API | 楽天市場 Ichiba Item Search API |

---

## フォルダ構成

```
style-self/
├── app/
│   ├── (app)/                            # 認証済みユーザー向けページ
│   │   ├── layout.tsx                    # (app)グループ共通レイアウト（BottomNav）
│   │   ├── home/page.tsx                 # ホーム: 世界観カード+今日のおすすめコーデ+CTA（Sprint 43）
│   │   ├── discover/page.tsx             # 発見: 2タブ（インスピレーション/ブランドを学ぶ）（Sprint 43で2タブ統合）
│   │   ├── saved/page.tsx                # 保存: 4セクション（コーデ/商品/投稿*将来/カルチャー*将来）（Sprint 44）
│   │   ├── outfit/page.tsx               # コーデ: 4タブ（コーデ提案/着こなし相談/クローゼット/理想を探す）（Sprint 44で理想を探すを追加）
│   │   ├── self/page.tsx                 # 自分: 4タブ（診断/身体/好み/履歴）。Sprint 44で保存コーデは /saved に移動
│   │   ├── onboarding/page.tsx           # 世界観診断フロー（全画面・BottomNav非表示）
│   │   ├── admin/
│   │   │   ├── knowledge/page.tsx        # 管理者専用ナレッジ管理（Sprint 39.5、middlewareで認可）
│   │   │   ├── products/page.tsx         # 管理者専用商品キュレーション一覧（Sprint 41）
│   │   │   └── products/new/page.tsx     # 商品登録フォーム（Sprint 41 / 41.2でスクショ解析・素材混率表示追加）
│   │   ├── shop/page.tsx                 # 旧ルート（Sprint 44で /outfit?tab=virtual にリダイレクト。買うニュアンス削除のため）
│   │   ├── style/page.tsx                # 旧ルート（Sprint 43で /outfit に redirect。?tab=virtual→/outfit?tab=virtual, ?tab=consult→/outfit?tab=consult, ?tab=saved→/self）
│   │   ├── closet/page.tsx               # 旧ルート（Sprint 43で /outfit?tab=closet にリダイレクト）
│   │   ├── learn/page.tsx                # 旧ルート（Sprint 43で /discover?tab=learn にリダイレクト）
│   │   ├── coordinate/page.tsx           # 旧ルート（/outfit にリダイレクト）
│   │   ├── inspire/page.tsx              # 旧ルート（/discover?tab=inspiration にリダイレクト）
│   │   ├── profile/page.tsx              # 旧ルート（/self にリダイレクト）
│   │   ├── wardrobe/page.tsx             # 旧ルート（/outfit?tab=closet にリダイレクト）
│   │   └── worldview/page.tsx            # 旧ルート（/self?tab=worldview にリダイレクト）
│   ├── (auth)/                           # 未認証ユーザー向け
│   │   ├── callback/route.ts             # 認証コールバック
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── api/
│   │   ├── admin/
│   │   │   ├── sync-rakuten/route.ts                 # 楽天商品同期API（管理者専用）
│   │   │   └── sync-trends/route.ts                  # 楽天ランキング→トレンド自動同期（Sprint 30）
│   │   ├── ai/
│   │   │   ├── abstract-coordinate/route.ts          # 抽象語→コーデ提案AI（2段階）
│   │   │   ├── analyze/route.ts                      # スタイル軸診断AI（Sprint 39で履歴保存追加）
│   │   │   ├── analyze-item/route.ts                 # 画像AI解析（Sprint 21 Phase 3）
│   │   │   ├── analyze-look/route.ts                 # 参考写真の比率・シルエット分析AI（Sprint 34、Sprint 39で履歴保存追加）
│   │   │   ├── coordinate/route.ts                   # コーデ提案AI
│   │   │   ├── learn-insight/route.ts                # 今日の気づき生成AI（Sprint 21 Phase 4）
│   │   │   ├── profile-fit/route.ts                  # 推奨サイズ感AI
│   │   │   ├── purchase-check/route.ts               # 購入検討AI判定
│   │   │   ├── style-consult/route.ts                # 着こなし相談AI（Sprint 33、Sprint 39で履歴保存追加）
│   │   │   ├── trend-translate/route.ts              # トレンド世界観翻訳AI（Sprint 28）
│   │   │   ├── virtual-coordinate/route.ts           # 理想コーデ提案AI・知識ベースlookup→Stage3（Sprint 36/37、Sprint 39で履歴保存追加）
│   │   │   ├── virtual-coordinate/concepts/route.ts  # 理想コーデのコンセプト候補3案AI（Sprint 36 v1.1）
│   │   │   └── virtual-coordinate/translate/route.ts # コンセプト翻訳AI（Sprint 36 v1.2 単体利用も可能）
│   │   ├── brands/
│   │   │   ├── list/route.ts                         # ブランド一覧取得（/learn用）
│   │   │   └── recommend/route.ts                    # ブランド提案AI（Sprint 19）
│   │   ├── coordinate/route.ts                       # コーデ保存
│   │   ├── history/
│   │   │   ├── route.ts                              # AI履歴取得 GET（Sprint 39）
│   │   │   └── [id]/route.ts                         # AI履歴削除 DELETE（Sprint 39）
│   │   ├── inspirations/route.ts                     # 偉大な参照一覧GET（Sprint 21 Phase 4）
│   │   ├── products/
│   │   │   └── match/route.ts                        # 商品マッチング POST（Sprint 40 / 41で拡張スコアリング）
│   │   ├── admin/products/
│   │   │   ├── route.ts                              # 管理者用商品 GET（一覧）/ POST（登録）（Sprint 41 / 41.1で配列・axes対応）
│   │   │   └── [id]/route.ts                         # 管理者用商品 DELETE（ソフト削除）（Sprint 41）
│   │   ├── admin/knowledge-keywords/
│   │   │   └── route.ts                              # オートコンプリート用キーワード GET（Sprint 41）
│   │   ├── admin/fetch-product-info/
│   │   │   └── route.ts                              # URL→商品情報＋8軸自動抽出 POST（Sprint 41.1 / 41.2で素材混率対応）
│   │   ├── admin/analyze-product-image/
│   │   │   └── route.ts                              # スクショ→商品情報＋8軸＋素材混率を Vision で抽出 POST（Sprint 41.2）
│   │   ├── admin/analyze-product-text/
│   │   │   └── route.ts                              # ペーストされた本文→商品情報＋8軸＋素材混率を抽出 POST（Sprint 41.2+）
│   │   ├── knowledge/
│   │   │   ├── rules/route.ts                        # 知識ベースのルール検索（Sprint 37 MVP）
│   │   │   ├── sources/route.ts                      # 情報源 GET（一覧）/ POST（登録）（Sprint 38）
│   │   │   ├── sources/[id]/route.ts                 # 情報源 GET（詳細+ルール）/ DELETE（Sprint 38）
│   │   │   └── sources/[id]/analyze/route.ts         # 情報源 → AIルール抽出（Sprint 38）
│   │   ├── profile/route.ts                          # プロフィール GET/PATCH
│   │   ├── trends/route.ts                           # トレンド一覧GET（Sprint 28）
│   │   ├── wardrobe/route.ts                         # ワードローブCRUD + PATCH
│   │   └── worldview/route.ts                        # 世界観 GET/PATCH
│   ├── layout.tsx
│   └── page.tsx                          # トップ（認証状態でリダイレクト）
├── components/
│   ├── BottomNav.tsx                 # グローバルボトムナビ（Sprint 43で lucide-react SVG + 日本語ラベルに統一）
│   ├── BrandCard.tsx                 # ブランド提案カード（Sprint 19）
│   ├── DiagnosisDisplay.tsx          # 診断結果v3 UI共有コンポーネント（onboarding結果＋/self DiagnosisTabで共用）
│   ├── style/StyleTabs.tsx           # CoordinateTab/VirtualTab/ConsultTab/SavedTab を export（Sprint 43）
│   ├── closet/ClosetView.tsx         # クローゼット画面（embedded prop で /outfit のサブタブにも対応）（Sprint 43）
│   ├── discover/InspirationView.tsx  # 抽象語コーデ生成（embedded prop で /discover のサブタブにも対応）（Sprint 43）
│   ├── learn/LearnView.tsx           # 学び画面（embedded prop で /discover のサブタブにも対応）（Sprint 43）
│   ├── saved/SavedProductsList.tsx   # 保存商品リスト（wardrobe_items.status='wishlist' を表示）（Sprint 44）
│   ├── coordinate/
│   │   ├── CoordinateCard.tsx        # コーデ結果カード（3層構造・SVG構造図付き）
│   │   ├── SilhouetteDiagram.tsx     # SVGシルエット構造図コンポーネント
│   │   ├── ProductMatchCard.tsx      # 楽天商品単体カード（Sprint 40）
│   │   └── ProductMatchList.tsx     # アイテム1件分の商品候補リスト・横スクロール（Sprint 40）
│   ├── knowledge/
│   │   ├── KnowledgeTab.tsx          # ナレッジタブ本体（Sprint 38）
│   │   └── AddSourceModal.tsx        # 情報源追加モーダル（Sprint 38）
│   ├── history/
│   │   ├── HistoryTab.tsx            # 履歴タブ本体（Sprint 39）
│   │   └── HistoryCard.tsx           # 履歴カード（タイプ別描画）（Sprint 39）
│   └── wardrobe/
│       ├── AddItemModal.tsx          # アイテム登録モーダル
│       ├── PurchaseCheckPanel.tsx    # 購入検討AI判定パネル
│       └── WardrobeItemCard.tsx      # アイテムカード
├── lib/
│   ├── utils/
│   │   ├── silhouette-map.ts         # 文字列→SVG数値マッピング（topVolume/bottomVolume/ratio）
│   │   ├── body-rules.ts             # 体型・骨格・悩みからコーデ制約を導出（Sprint 32）
│   │   ├── zozo-link.ts              # ZOZOTOWN検索URLビルダー（Sprint 35）
│   │   ├── season.ts                 # JST季節判定（Sprint 36 v1.1）
│   │   ├── knowledge-merge.ts        # knowledge_rules→ConceptInterpretation変換・マージ（Sprint 37）
│   │   ├── url-extract.ts            # URL→本文抽出（Sprint 38）
│   │   ├── history-helper.ts         # AI履歴INSERTヘルパー（Sprint 39）
│   │   ├── color-aliases.ts          # 色名表記揺れマップ（Sprint 40）
│   │   ├── product-match.ts          # 商品スコアリング・行変換（Sprint 40 / 41 / 41.3でシルエット・季節・テイスト・NG誤爆対策追加）
│   │   ├── admin-check.ts            # ADMIN_EMAILS allowlist チェック（Sprint 41）
│   │   └── worldview-matcher.ts      # タグ集計→8パターン判定（Sprint 42、単一2点・複数1点）
│   ├── dictionaries/
│   │   ├── material.ts               # 素材辞書（14素材：本能・文化・感覚の3層）
│   │   ├── color.ts                  # 色辞書（15色：温度感・重量感・距離感）
│   │   ├── line.ts                   # ライン/シルエット辞書（10種）
│   │   ├── ratio.ts                  # 比率辞書（8パターン）
│   │   ├── index.ts                  # 全辞書 re-export
│   │   └── inject.ts                 # getMaterialContext / getColorContext / getLineContext
│   ├── knowledge/
│   │   ├── fashion-axes.ts           # ファッション判断の8軸（FASHION_AXES + プロンプト用ブロック）
│   │   ├── worldview-patterns.ts     # 世界観8パターン定数（Sprint 42：診断のソース・オブ・トゥルース）
│   │   └── diagnosis-questions.ts    # 15問の質問定義（Sprint 42：scoring=score/hint で集計分岐）
│   ├── claude.ts                     # Claude APIクライアント
│   ├── rakuten.ts                    # 楽天APIクライアント
│   ├── storage.ts                    # Supabase Storage操作
│   ├── supabase-browser.ts           # Supabaseクライアント（Client Component用）
│   ├── supabase-server.ts            # Supabaseクライアント（Route Handler用）
│   ├── supabase.ts                   # Supabaseクライアント（service role）
│   ├── validators/
│   │   ├── coordinate.ts             # validateAndFixCoordinate（role/line/weight/structure/ratio整合）
│   │   ├── analyze.ts                # validateAndFixStyleDiagnosis（styleAxis enum / 配列補完）
│   │   ├── purchase-check.ts         # validateAndFixPurchaseCheck（score クランプ / source enum）
│   │   └── analyze-item.ts           # validateAndFixItemAnalysis（category/color/taste フォールバック）
│   └── prompts/
│       ├── abstract-coordinate.ts    # 抽象語→デザイン変換・コーデ提案プロンプト
│       ├── analyze.ts                # スタイル診断・相性判定プロンプト
│       ├── analyze-item.ts           # 画像AI解析プロンプト（25色・カテゴリ・素材定義付き）
│       ├── coordinate.ts             # コーデ生成プロンプト（buildCoordinateSystemPrompt）
│       ├── learn-insight.ts          # 今日の気づき生成プロンプト（3タイプ×3テーマ）
│       ├── normalize-product.ts      # 楽天商品属性正規化プロンプト
│       ├── profile-fit.ts            # 推奨サイズ感AIプロンプト
│       ├── purchase.ts               # 購入検討AI判定プロンプト
│       ├── brand-recommend.ts        # ブランド提案AIプロンプト（Sprint 19）
│       ├── trend-translate.ts        # トレンド世界観翻訳プロンプト（Sprint 28）
│       ├── trend-extract.ts          # 楽天商品名リスト→トレンド抽出プロンプト（Sprint 30）
│       ├── style-consult.ts          # 着こなし相談プロンプト（Sprint 33）
│       ├── analyze-look.ts            # 参考写真分析プロンプト（Sprint 34）
│       ├── virtual-coordinate.ts      # 理想コーデ提案プロンプト・Stage 3（Sprint 36 / v1.2）
│       ├── concept-translate.ts       # コンセプト翻訳プロンプト・Stage 1（Sprint 36 v1.2）
│       ├── normalize-interpretation.ts # コンセプト翻訳レスポンス正規化（Sprint 36 v1.2）
│       ├── knowledge-extract.ts       # 情報源→ルール抽出プロンプト（Sprint 38）
│       ├── extract-product-info.ts    # URL→商品情報＋8軸抽出プロンプト（Sprint 41.1 / 41.2で素材混率対応）
│       ├── analyze-product-image.ts   # スクショ→商品情報＋8軸＋素材混率の Vision プロンプト（Sprint 41.2）
│       ├── analyze-product-text.ts    # ペースト本文→商品情報＋8軸＋素材混率のプロンプト（Sprint 41.2+）
│       └── trends.ts                 # トレンド分析プロンプト（未使用・旧版）
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql        # 初期スキーマ（users / wardrobe_items / coordinates）
│   │   ├── 002_wardrobe_schema_update.sql  # Sprint 6: season→text[], 新カラム追加
│   │   ├── 003_sprint7_wardrobe_update.sql # Sprint 7: taste→text[], status, worldview_*
│   │   ├── 004_external_products.sql       # 楽天連携: external_productsテーブル
│   │   ├── 005_sprint9_body_info.sql       # Sprint 9: users身体情報カラム追加
│   │   ├── 006_sprint9_profile_update.sql  # Sprint 9改善: 詳細身体情報・fit_recommendation追加
│   │   ├── 007_sprint11_worldview.sql      # Sprint 11: users.worldview jsonb追加
│   │   ├── 008_sprint13_style_analysis.sql # Sprint 13: users.style_analysis jsonb追加
│   │   ├── 009_brands.sql                  # Sprint 19: brandsテーブル＋初期20件
│   │   ├── 010_inspirations.sql            # Sprint 21 Phase 4: inspirationsテーブル＋シード5件
│   │   ├── 011_preference.sql             # Sprint 26: users.style_preference jsonb追加
│   │   ├── 012_trends.sql                 # Sprint 28: trendsテーブル＋2025SSシード5件
│   │   ├── 013_trends_evidence.sql        # Sprint 29: trends根拠フィールド追加
│   │   ├── 014_body_profile.sql           # Sprint 32: users.body_profile jsonb追加
│   │   ├── 015_knowledge.sql              # Sprint 37: knowledge_sources / knowledge_rules テーブル追加
│   │   ├── 016_ai_history.sql             # Sprint 39: ai_history テーブル追加
│   │   ├── 017_product_curation.sql       # Sprint 41: external_products拡張 + product_concept_tags新規
│   │   ├── 018_product_multi_attrs.sql    # Sprint 41.1: colors/materialsを配列化、axes jsonb追加
│   │   ├── 019_material_composition.sql   # Sprint 41.2: material_composition jsonb追加（素材混率を percentage 付きで保存）
│   │   └── 020_diagnosis_v2.sql           # Sprint 42: diagnosis_sessions / worldview_profiles / user_style_events
│   └── seeds/
│       └── 015_knowledge_rules_seed.sql  # Sprint 37: 管理者キュレーション初期15件（手動投入用）
├── types/
│   ├── database.ts                   # Supabase DBの型定義
│   └── index.ts                      # アプリ全体の型定義
├── vercel.json                        # Vercel Cron設定（週次トレンド同期）
├── middleware.ts                      # 認証ミドルウェア
├── .env.local                        # 環境変数（gitignore済み）
└── CLAUDE.md                         # このファイル
```

---

## 環境変数

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 楽天API
RAKUTEN_APP_ID=        # UUIDまたは数字形式
RAKUTEN_AFFILIATE_ID=
RAKUTEN_ACCESS_KEY=    # 管理画面のアクセスキー（RAKUTEN_APP_IDより優先）

# ZOZOTOWN（Sprint 35 / Phase 1: ValueCommerce 承認後に値を設定）
NEXT_PUBLIC_ZOZO_AFFILIATE_ID=

# Admin Access (Sprint 39.5: ナレッジ管理者専用化)
# /admin/* にアクセス可能な email のカンマ区切りリスト
ADMIN_EMAILS=
```

---

## DBテーブル一覧

| テーブル | 用途 |
|---------|------|
| `users` | ユーザープロフィール・スタイル軸 |
| `wardrobe_items` | 手持ちアイテム（status / worldview_score / worldview_tags 含む） |
| `coordinates` | 保存済みコーデ |
| `external_products` | 楽天等の外部商品マスタ |
| `brands` | ブランドマスタ（worldview_tags / era_tags / maniac_level など） |
| `inspirations` | 偉大な参照コンテンツ（designer / look / artwork / film / book） |
| `knowledge_sources` | 知識ベースの一次情報（Sprint 37：URL/メモ/画像/書籍） |
| `knowledge_rules` | 知識ベースの判断ルール（Sprint 37：concept_keyword→推奨色/素材/シルエット/小物/NG） |
| `ai_history` | AI履歴の統一テーブル（Sprint 39：診断/相談/写真分析/理想コーデ） |
| `diagnosis_sessions` | 診断セッションの詳細記録（Sprint 42：answers / matched_pattern / scores / result） |
| `worldview_profiles` | ユーザーごとの最新確定プロファイル（Sprint 42：user_id 主キー） |
| `user_style_events` | 学習用の行動イベントログ（Sprint 42：クリック・保存・拒否など） |

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
- モデルは必ず `claude-sonnet-4-6` を使用する（`lib/claude.ts` の `MODEL` 定数で管理）

### 禁止
- `any` 型の使用禁止
- `console.log` の残置禁止
- Supabase v2 の `.insert()` / `.update()` の型エラー回避に `as never` キャストを使う（既存パターン踏襲）

### コメント
- コメントは「なぜそうするか」が非自明な場合のみ書く
- コードが何をするかの説明コメントは書かない

---

## 作業の進め方ルール

### ドキュメント更新ルール
1. **新しいファイルを作成したら必ず `CLAUDE.md` のフォルダ構成に追記する**
2. **実装が完了したら `CHANGES.md` の該当項目を ✅ に更新する**
3. **想定外のファイル構成の変化があった場合は実装前に報告して確認を取る**
4. マイグレーションSQLを作成したら `supabase/migrations/` に追加し、CLAUDE.mdのフォルダ構成にも記載する

### 実装方針
- 1項目ずつ確認しながら進める（一気に全部やらない）
- 実装前に「何をどう変えるか」を短く宣言してから着手する
- 型チェック（`npx tsc --noEmit`）を実装後に必ず実行する
- バグ修正時はエラーメッセージを詳細化して次回のデバッグを容易にする

---

## よく使うコマンド

```bash
# 開発サーバー起動
npm run dev

# 型チェック
npx tsc --noEmit

# ビルド確認
npm run build

# 楽天商品同期（dryRun）
curl -X POST http://localhost:3000/api/admin/sync-rakuten \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"brand": "BEAMS", "hits": 5, "dryRun": true}'

# 楽天商品同期（本番）
curl -X POST http://localhost:3000/api/admin/sync-rakuten \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"brand": "BEAMS", "hits": 20, "dryRun": false}'
```

---

## 既知の注意事項

### 楽天API認証 (Sprint 40で解決)
新エンドポイント `openapi.rakuten.co.jp/ichibams/...` は `accessKey` クエリ必須・レスポンスは `Items` フラット配列。
旧仕様は `applicationId` のみ + `Items: [{Item: ...}]` ネスト。
`lib/rakuten.ts` の `fetchRakuten` は両方を併送・両形式を吸収する設計済み。

### Supabase v2 型推論バグ
`.insert()` / `.update()` が `never` 型になるケースがある。回避策：

```typescript
// Insert
type FooInsert = Database["public"]["Tables"]["foo"]["Insert"];
const data: FooInsert = { ... };
supabase.from("foo").insert(data as never)

// Update
supabase.from("foo").update({ field: value } as never)
```

### Claude API レスポンスのJSONパース
`callClaudeJSON` は `text.indexOf("{")` から `text.lastIndexOf("}")` を抽出してパースする。
`maxTokens` が不足すると JSON が途中で切れてパースエラーになる。
複雑なレスポンスは `maxTokens: 2048` 以上を指定する。

### 楽天API 認証
`RAKUTEN_ACCESS_KEY` を優先し、未設定の場合は `RAKUTEN_APP_ID` にフォールバック。
現状 UUID形式のIDはAPIに拒否される問題あり（未解決）。
