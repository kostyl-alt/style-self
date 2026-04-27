# CHANGES.md — 実装変更記録

---

## Sprint 1: 認証基盤

| # | 内容 | 状態 |
|---|------|------|
| 1 | Supabase Auth（メール/パスワード）ログイン・サインアップ | ✅ |
| 2 | 認証ミドルウェア（`middleware.ts`） | ✅ |
| 3 | 認証後リダイレクト（`/callback` → `/wardrobe`） | ✅ |
| 4 | ユーザープロフィール自動作成トリガー | ✅ |

---

## Sprint 2: ワードローブ基本機能

| # | 内容 | 状態 |
|---|------|------|
| 1 | `wardrobe_items` テーブル作成 | ✅ |
| 2 | アイテム登録モーダル（`AddItemModal.tsx`） | ✅ |
| 3 | ワードローブ一覧表示（`/wardrobe`） | ✅ |
| 4 | アイテム削除機能 | ✅ |

---

## Sprint 3: AI診断（スタイル軸）

| # | 内容 | 状態 |
|---|------|------|
| 1 | オンボーディングフロー（`/onboarding`） | ✅ |
| 2 | スタイル軸診断AI（`/api/ai/analyze`） | ✅ |
| 3 | 相性スコア判定 AI（アイテム登録後の自動判定） | ✅ |
| 4 | 判定結果を `users.style_axis` に保存 | ✅ |

---

## Sprint 4: コーデ提案

| # | 内容 | 状態 |
|---|------|------|
| 1 | コーデ生成AI（`/api/ai/coordinate`） | ✅ |
| 2 | コーデ結果表示（`CoordinateCard.tsx`） | ✅ |
| 3 | コーデ保存（`/api/coordinate`） | ✅ |
| 4 | コーデ保存履歴表示（`/coordinate` 保存履歴トグル） | ✅ |

---

## Sprint 5: UX改善・バグ修正

| # | 内容 | 状態 |
|---|------|------|
| 1 | ローディング状態の表示 | ✅ |
| 2 | エラーハンドリング統一 | ✅ |
| 3 | 画像アップロード（Supabase Storage） | ✅ |
| 4 | カテゴリフィルター | ✅ |

---

## Sprint 6: ワードローブUI全面見直し

| # | 内容 | 状態 | 備考 |
|---|------|------|------|
| 1 | アイテム登録UIの全面見直し（`AddItemModal.tsx`）| ✅ | |
| 2 | コーデ提案根拠の可視化 | ✅ | |
| 3 | 身体情報の入力・保存 | ✅ | Sprint 9 で実装 |
| 4 | スタイル診断の精度向上 | ✅ | Sprint 6.4: 5→7ステップに刷新（シルエット・色トーン・印象・参照語追加）| |
| 5 | 信念メモ（Belief Note）UI | ✅ | Sprint 11 `/worldview` で実装 |
| 6 | アプリ内完結導線 | ✅ | Sprint 12 BottomNav で実装 |

**スキーマ変更（`002_wardrobe_schema_update.sql`）**
- `season`: text → text[]
- `sub_color` / `fabric_texture` / `silhouette` / `taste` カラム追加（`taste` は Sprint 7 で text[] に変更）

---

## Sprint 7: Wardrobe OS 進化

| # | 内容 | 状態 |
|---|------|------|
| 1 | `taste` を `text[]` に変更、複数テイスト選択UI | ✅ |
| 2 | シルエット選択をカテゴリ連動に変更（16カテゴリ対応） | ✅ |
| 3 | `status` フィールド追加・ステータスタブ UI | ✅ |
| 4 | 購入検討AI判定パネル（`PurchaseCheckPanel.tsx`）| ✅ |
| 5 | `worldview_score` / `worldview_tags` フィールド追加 | ✅ |
| 6 | `CoordinateCard` カテゴリ絵文字修正 | ✅ |
| 7 | 素材選択肢を17種に拡張（テンセル・モーダル・竹 等） | ✅ |
| 8 | カテゴリフィルターを `<select>` ドロップダウンに変更 | ✅ |
| 9 | 所有アイテム0件時にコーデ生成ボタンを無効化 | ✅ |

**スキーマ変更（`003_sprint7_wardrobe_update.sql`）**
- `taste`: text → text[]
- `status` カラム追加（デフォルト: `owned`）
- `worldview_score` カラム追加（integer）
- `worldview_tags` カラム追加（text[]）

---

## Sprint 8: 外部商品連携（楽天市場API）

| # | 内容 | 状態 |
|---|------|------|
| 1 | `external_products` テーブル作成 | ✅ |
| 2 | 楽天APIクライアント（`lib/rakuten.ts`） | ✅ |
| 3 | 商品正規化プロンプト（`lib/prompts/normalize-product.ts`）| ✅ |
| 4 | 楽天商品同期API（`app/api/admin/sync-rakuten/route.ts`）| ✅ |
| 5 | AI判定を3グループ構成に拡張（owned/brand/crossBrand） | ✅ |
| 6 | 5軸ペアリング理由（色・素材・シルエット・テイスト・世界観） | ✅ |

**スキーマ変更（`004_external_products.sql`）**
- `external_products` テーブル作成（楽天等の外部商品マスタ）

---

## Sprint 9: 身体情報の追加

| # | 内容 | 状態 |
|---|------|------|
| 1 | `users` テーブルに身体情報6カラム追加 | ✅ |
| 2 | プロフィールページ（`/profile`）新規作成 | ✅ |
| 3 | プロフィールAPI（`/api/profile` GET/PATCH）新規作成 | ✅ |
| 4 | コーデプロンプトに身体情報セクション追加 | ✅ |
| 5 | コーデ提案に `bodyFitNote`（比率・丈感・重心）出力追加 | ✅ |
| 6 | `CoordinateCard` に Body Fit セクション表示追加 | ✅ |

**スキーマ変更（`005_sprint9_body_info.sql`）**
- `users` に `height` / `weight` / `body_type` / `body_tendency` / `weight_center` / `shoulder_width` カラム追加

---

## Sprint 9 改善: プロフィール画面の強化

| # | 内容 | 状態 |
|---|------|------|
| 1 | 詳細身体情報7項目追加（上半身の厚み・筋肉感・脚の長さ・サイズ感・印象・強調/隠したい部位） | ✅ |
| 2 | 体重ラベルを「提案精度補助・任意」に変更 + 注記追加 | ✅ |
| 3 | 重心・肩幅に判断ヒント文を追加 | ✅ |
| 4 | 保存時にAI推奨サイズ感を自動生成・表示 | ✅ |
| 5 | 推奨サイズ感AIプロンプト（`lib/prompts/profile-fit.ts`）新規作成 | ✅ |
| 6 | 推奨サイズ感APIエンドポイント（`/api/ai/profile-fit`）新規作成 | ✅ |

**スキーマ変更（`006_sprint9_profile_update.sql`）**
- `users` に `upper_body_thickness` / `muscle_type` / `leg_length` / `preferred_fit` / `style_impression` / `emphasize_parts` / `hide_parts` / `fit_recommendation` カラム追加

---

## Sprint 10: コーデ提案を購買判断できる実用出力に改善

| # | 内容 | 状態 |
|---|------|------|
| 1 | コーデプロンプトに5セクション構造化出力を追加 | ✅ |
| 2 | `CoordinateAIResponse` に `silhouette` / `sizeGuide` / `adjustment` / `avoid` / `buyingHint` 追加 | ✅ |
| 3 | `CoordinateCard` に5セクションの折りたたみUI追加（デフォルト閉じ） | ✅ |
| 4 | `maxTokens` を 2048 に増加（出力量増加に対応） | ✅ |

---

## Sprint 11: 世界観編集 + 抽象語コーデ

*目標: 「言語をシルエットに変換する」コアコンセプトを実現する*

### ① 世界観編集ページ（/worldview）

| # | 内容 | 状態 |
|---|------|------|
| 1 | `users` テーブルに `worldview` jsonb カラム追加 | ✅ |
| 2 | `/app/(app)/worldview/page.tsx` 新規作成 | ✅ |
| 3 | `/api/worldview/route.ts`（GET/PATCH）新規作成 | ✅ |
| 4 | コーデ生成プロンプトに `worldview` を渡す | ✅ |
| 5 | マイグレーション `007_sprint11_worldview.sql` 作成 | ✅ |

### ② 抽象語・テーマ入力（/inspire）

| # | 内容 | 状態 |
|---|------|------|
| 6 | `/app/(app)/inspire/page.tsx` 新規作成 | ✅ |
| 7 | `/api/ai/abstract-coordinate/route.ts` 新規作成 | ✅ |
| 8 | `lib/prompts/abstract-coordinate.ts` 新規作成 | ✅ |

**スキーマ変更（`007_sprint11_worldview.sql`）**
- `users` に `worldview` jsonb カラム追加

---

## Sprint 12: UI/UX改善

| # | 内容 | 状態 |
|---|------|------|
| 1 | グローバルボトムナビ（`components/BottomNav.tsx` + `app/(app)/layout.tsx`）| ✅ |
| 2 | 初回ユーザー導線（`onboarding_completed` チェック・オンボーディング完了後ボタン）| ✅ |
| 3 | 空状態の案内（`/coordinate` と `/inspire` にリンク付き案内）| ✅ |
| 4 | `app/layout.tsx` タイトル・`lang="ja"` 修正 | ✅ |
| 5 | 削除確認をインライン確認ダイアログに変更（`window.confirm` 廃止）| ✅ |
| 6 | コーデ保存後の保存履歴トグル表示（GET `/api/coordinate` 追加）| ✅ |
| 7 | `middleware.ts` に `/worldview` `/inspire` を追加（認証保護漏れ修正）| ✅ |

---

## Sprint 13: 診断結果UI刷新・チップ説明・素材ポップアップ

| # | 内容 | 状態 |
|---|------|------|
| 1 | `lib/prompts/analyze.ts` を7フィールド出力に刷新（`coreIdentity` / `whyThisResult` / `styleStructure` / `inputMapping` / `avoid` / `actionPlan` / `nextBuyingRule`） | ✅ |
| 2 | `types/index.ts` に `StyleDiagnosisResult` / `StyleStructure` / `InputMappingItem` 型追加 | ✅ |
| 3 | `supabase/migrations/008_sprint13_style_analysis.sql` 作成・`users.style_analysis` jsonbカラム追加 | ✅ |
| 4 | `app/api/ai/analyze/route.ts` を新出力形式に対応、`style_analysis` をDBに保存 | ✅ |
| 5 | `app/(app)/onboarding/page.tsx` 診断結果画面を7セクション構成に刷新 | ✅ |
| 6 | 選択肢チップに一言説明（`desc`）を追加（`ChipOption` インターフェース） | ✅ |
| 7 | 素材チップに `?` ボタンと4層詳細ポップアップ（`MaterialPopup`）を追加 | ✅ |

**スキーマ変更（`008_sprint13_style_analysis.sql`）**
- `users` に `style_analysis` jsonb カラム追加

---

## Sprint 14: 診断フロー中立化・多軸化

| # | 内容 | 状態 |
|---|------|------|
| 1 | 印象語を12→20語に拡張（遊び心・陽気さ・少年性・官能・退廃・土着性・危うさ・祝祭感 追加） | ✅ |
| 2 | 印象語を5軸グループで表示（静・知・構 / 温・誠・柔 / 動・遊・解 / 体・艶・毒 / 地・生・根） | ✅ |
| 3 | 素材チップの `desc` を感覚ファーストに中立化（6素材の説明文を書き直し） | ✅ |
| 4 | 素材ポップアップの感情解釈を複数解釈の並列表示に変更（9素材分） | ✅ |
| 5 | Step 5 例示 pill を多様な軸に置き換え（自己・関係・身体・遊びの4軸9語） | ✅ |
| 6 | Step 1〜4 に任意フリーテキスト欄（`StepNote`）追加 | ✅ |
| 7 | `whyThisResult` プロンプトを直接引用形式に変更（選択語必須引用・追跡可能な記述） | ✅ |

---

## Sprint 15: 診断フロー拡張・結果平易化

| # | 内容 | 状態 |
|---|------|------|
| 1 | Step 8「インスピレーション源」追加（6カテゴリ選択＋自由記述） | ✅ |
| 2 | Step 5 に「社会的・文化的テーマ」チップ追加（9語） | ✅ |
| 3 | Step 1・Step 4 の補足欄プレースホルダーを「上記にない素材・色があれば」に変更 | ✅ |
| 4 | 診断結果冒頭に PLAIN SUMMARY セクション追加 | ✅ |
| 5 | `StyleDiagnosisResult` に `plainSummary: string` フィールド追加 | ✅ |
| 6 | `ANALYZE_SYSTEM_PROMPT` に `plainSummary` 出力指示・Step 8 コンテキスト追加 | ✅ |
| 7 | `maxTokens` を 2500 → 3000 に増加 | ✅ |

---

## Sprint 16: 診断フロー構造の根本刷新（時代・場所・シーン軸）

| # | 内容 | 状態 |
|---|------|------|
| 1 | Step 1 を「好きな時代・年代」に刷新（9選択肢＋自由記述） | ✅ |
| 2 | Step 2 を「好きな場所・文化圏」に刷新（9選択肢＋自由記述） | ✅ |
| 3 | Step 3 を「シーン・文化的文脈」に刷新（10選択肢＋自由記述） | ✅ |
| 4 | Step 4 を「ミックスしたいスタイル（自由記述）」に刷新、具体例 pill 追加 | ✅ |
| 5 | Step 5 を「参考になる人物・作品・場所（自由記述）」に刷新 | ✅ |
| 6 | Step 6（素材）の下部に「シルエットの好み（任意）」簡略版を追加（5選択肢） | ✅ |
| 7 | 旧 Step 2（シルエット詳細）・旧 Step 3（余白スライダー）を削除 | ✅ |
| 8 | 旧 Step 7・Step 8 を新 Step 5 に統合 | ✅ |
| 9 | `ANALYZE_SYSTEM_PROMPT` を9ステップ対応に全面改訂、`plainSummary` テンプレート形式に変更 | ✅ |

---

## Sprint 17: Step 4「感覚を探る質問」構造に刷新

| # | 内容 | 状態 |
|---|------|------|
| 1 | Step 4 タイトルを「あなたの感覚を探ってみましょう」に変更 | ✅ |
| 2 | Q1「最近いいなと思った服装」自由記述を追加 | ✅ |
| 3 | Q2「自分には無理と思った服装」自由記述（任意）を追加 | ✅ |
| 4 | Q3「今の気分に近いもの」10択チップ（複数可）を追加 | ✅ |
| 5 | Q4「制限なければなりたい雰囲気」自由記述（任意）＋例 pill を追加 | ✅ |
| 6 | `canProceed()` を Q1 記述 OR Q3 チップ選択で進行可に変更 | ✅ |
| 7 | `buildAnswers()` step 4 を4サブ質問の構造化テキストに変更 | ✅ |

---

## Sprint 18: 深層分析・行動パターン質問の追加

| # | 内容 | 状態 |
|---|------|------|
| 1 | Step 3 を「こんな時、どうしますか？」の行動パターン3問に刷新 | ✅ |
| 2 | Q1「友達と意見が違う時」単一選択（4択）を追加 | ✅ |
| 3 | Q2「似合うvs好き」単一選択（4択）を追加 | ✅ |
| 4 | Q3「最初に気になるもの」単一選択（6択）を追加 | ✅ |
| 5 | `RadioSelect` コンポーネントを新設（相互排他の単一選択UI） | ✅ |
| 6 | `canProceed()` を3問全回答を必須に変更 | ✅ |
| 7 | `ANALYZE_SYSTEM_PROMPT` に深層分析・無意識の傾向発見の指示を追加 | ✅ |
| 8 | `plainSummary` 形式を「気づきの文」テンプレートに変更 | ✅ |

---

## Sprint 19: ブランド提案機能

| # | 内容 | 状態 |
|---|------|------|
| 1 | `supabase/migrations/009_brands.sql` 作成（brandsテーブル＋RLS＋初期20件） | ✅ |
| 2 | `lib/prompts/brand-recommend.ts` 作成（ブランドキュレーターシステムプロンプト） | ✅ |
| 3 | `app/api/brands/recommend/route.ts` 作成（styleAnalysis/userId→BrandRecommendation[]） | ✅ |
| 4 | `types/index.ts` に `Brand` / `BrandRecommendation` インターフェース追加 | ✅ |
| 5 | `types/database.ts` に `brands` テーブル型追加 | ✅ |
| 6 | `components/BrandCard.tsx` 作成（ブランドカードUI） | ✅ |
| 7 | `app/(app)/onboarding/page.tsx` 結果画面に「Brands for You」セクション追加 | ✅ |
| 8 | `CLAUDE.md` フォルダ構成・DBテーブル一覧を更新 | ✅ |

**スキーマ変更（`009_brands.sql`）**
- `brands` テーブル新設（id / name / name_ja / country / city / description / worldview_tags / taste_tags / era_tags / scene_tags / price_range / maniac_level / official_url / instagram_url / is_active / created_at）
- RLS: 全ユーザー読み取り可（書き込み不可）
- 初期データ: 20ブランド（Yohji Yamamoto / Auralee / Comoli / Engineered Garments / Lemaire / Kapital / Ann Demeulemeester / Cav Empt / orSlow / Undercover / COMME des GARÇONS / Maison Margiela / ISSEY MIYAKE / Needles / SUNSEA / TEATORA / Graphpaper / nanamica / ts(s) / PORTER CLASSIC）

**ブランド提案フロー**
1. 診断完了 → `/api/ai/analyze` でスタイル診断結果取得
2. 非同期で `/api/brands/recommend` にスタイル診断結果を送信
3. サーバー側でtag overlap scoring → 上位12候補をClaudeに渡す
4. Claude が5ブランドを選定し reason / matchTags / matchScore を返す
5. 診断結果画面末尾の「Brands for You」にカード表示（読み込み中はアニメーション表示）

---

## Sprint 20: Phase 1 — 画面構成・ナビゲーション再設計

| # | 内容 | 状態 |
|---|------|------|
| 1 | `BottomNav.tsx` を5項目に変更（SELF / DISCOVER / STYLE / CLOSET / LEARN） | ✅ |
| 2 | `/closet/page.tsx` 新設（`/wardrobe` の内容をそのまま移動） | ✅ |
| 3 | `/style/page.tsx` 新設（`/coordinate` の内容を移動、内部リンク修正） | ✅ |
| 4 | `/discover/page.tsx` 新設（`/inspire` の内容を移動、内部リンク修正） | ✅ |
| 5 | `/self/page.tsx` 新設（`/profile` + `/worldview` + 診断結果を3タブで統合） | ✅ |
| 6 | `/learn/page.tsx` 新設（ブランドフィロソフィー一覧＋Coming Soon プレースホルダー） | ✅ |
| 7 | `/api/brands/list/route.ts` 新設（/learn 用ブランド一覧API） | ✅ |
| 8 | `middleware.ts` の `appRoutes` を新ルートに更新 | ✅ |
| 9 | `app/page.tsx` のリダイレクト先を `/wardrobe` → `/closet` に変更 | ✅ |
| 10 | `app/(app)/onboarding/page.tsx` の「クローゼットへ進む」リンクを `/closet` に変更 | ✅ |
| 11 | `next.config.mjs` に旧URL→新URLのリダイレクト設定追加（5ルート） | ✅ |
| 12 | `CLAUDE.md` フォルダ構成を新ルートに更新 | ✅ |

**ルート変更マッピング**
- `/wardrobe` → `/closet`
- `/coordinate` → `/style`
- `/inspire` → `/discover`
- `/profile` → `/self`（統合）
- `/worldview` → `/self`（統合）

**SELF タブ構成**（デフォルト: 世界観診断）
- 世界観診断: 診断結果の表示 + 「再診断する」リンク（未診断の場合は診断開始プロンプト）
- 身体情報: 旧 /profile の内容をそのまま
- 世界観編集: 旧 /worldview の内容をそのまま

---

## Sprint 20: Phase 2 — コーデ分析11軸拡張

| # | 内容 | 状態 |
|---|------|------|
| 1 | `types/index.ts` に `CoordinateAnalysis` と7サブ型を追加 | ✅ |
| 2 | `lib/prompts/coordinate.ts` に `analysis` ブロック（ratio / material / line / weight / structure / worldviewAlignment / why / what / emotion / gaze）を追加 | ✅ |
| 3 | `app/api/ai/coordinate/route.ts` の `maxTokens` を 2048 → 3500 に変更 | ✅ |
| 4 | `components/coordinate/CoordinateCard.tsx` に「Analysis」アコーディオンを追加（デフォルト閉じ、11軸表示） | ✅ |

**Analysis アコーディオン内容**
- Why / What / Emotion（テキスト3行）
- 比率・ライン・重心・構造・素材（2列グリッド）
- 視線の流れ（Gaze Flow: entry → flow → exit）
- 世界観整合性スコア（★/☆ 5段階）＋ alignedTags / divergedTags

---

## Sprint 20: Phase 3 — AI出力バリデーション層の実装

| # | 内容 | 状態 |
|---|------|------|
| 1 | `lib/validators/coordinate.ts` 新設（validateAndFixCoordinate を route から移動・強化） | ✅ |
| 2 | `lib/validators/analyze.ts` 新設（validateAndFixStyleDiagnosis） | ✅ |
| 3 | `lib/validators/purchase-check.ts` 新設（validateAndFixPurchaseCheck） | ✅ |
| 4 | `app/api/ai/coordinate/route.ts` にバリデーション適用・items 空チェック追加 | ✅ |
| 5 | `app/api/ai/analyze/route.ts` にバリデーション適用 | ✅ |
| 6 | `app/api/ai/purchase-check/route.ts` にバリデーション適用 | ✅ |
| 7 | `app/api/ai/abstract-coordinate/route.ts` に maxTokens 2048→3500 修正＋バリデーション適用 | ✅ |

**各バリデーター対応内容**
- coordinate: role enum・line.direction・weight.center・structure.consistency フォールバック、silhouette↔ratio整合性、worldviewAlignment スコアクランプ、why/what/emotion 空文字補完
- analyze: styleAxis enum フォールバック（colorTone/spaceFeeling/materialPreference）、beliefKeywords/avoid/actionPlan/nextBuyingRule の非配列→[]補完、styleStructure 欠落フィールド補完
- purchase-check: worldviewScore クランプ(1-5)、pairingGroups.source enum フォールバック、reasons 欠落フィールド空文字補完

---

## Sprint 21: Phase 3 — 画像AI登録

| # | 内容 | 状態 |
|---|------|------|
| 1 | `types/index.ts` に `ItemAnalysisAIResponse` 追加 | ✅ |
| 2 | `lib/claude.ts` に `callClaudeWithImage<T>` 追加（Claude Vision API対応） | ✅ |
| 3 | `lib/prompts/analyze-item.ts` 新設（25色・カテゴリ・素材・テイスト定義付き画像解析プロンプト） | ✅ |
| 4 | `lib/validators/analyze-item.ts` 新設（validateAndFixItemAnalysis） | ✅ |
| 5 | `app/api/ai/analyze-item/route.ts` 新設（画像base64受取 → Claude Vision → バリデーション → JSON返却） | ✅ |
| 6 | `components/wardrobe/AddItemModal.tsx` 改善（画像選択後にAI自動入力ボタン・全て上書きボタン表示、1024pxリサイズ処理追加） | ✅ |

**UXフロー**
1. 画像を選択 → 「AIで自動入力」「全て上書き」ボタンが出現
2. 「AIで自動入力」→ 空フィールドのみAI結果で埋める
3. 「全て上書き」→ 全フィールドをAI結果で置き換え
4. ユーザーが確認・修正してから「追加する」

**クライアント側リサイズ**
- canvas で最大1024px にリサイズ
- JPEG 85% 品質でbase64エンコード → APIに送信

## Sprint 21: Phase 4 — LEARN タブ充実

| # | 内容 | 状態 |
|---|------|------|
| 1 | `types/index.ts` に `Inspiration` / `InspirationCategory` / `LearnInsight` / `LearnInsightTheme` を追加 | ✅ |
| 2 | `types/database.ts` に `inspirations` テーブル型を追加 | ✅ |
| 3 | `supabase/migrations/010_inspirations.sql` 新設（テーブル作成 + RLS + シード5件） | ✅ |
| 4 | `lib/prompts/learn-insight.ts` 新設（今日の気づき生成プロンプト） | ✅ |
| 5 | `app/api/ai/learn-insight/route.ts` 新設（診断結果→気づき生成、beliefKeywords返却） | ✅ |
| 6 | `app/api/inspirations/route.ts` 新設（偉大な参照一覧GET） | ✅ |
| 7 | `app/api/brands/list/route.ts` 拡張（era_tags / official_url / instagram_url を追加取得） | ✅ |
| 8 | `app/(app)/learn/page.tsx` 全面更新（3セクション構成） | ✅ |

**learn/page.tsx 3セクション構成**
- Section 1「今日の気づき」: localStorage に日付付きキャッシュ（1日1回生成）。診断未完了時は診断誘導。
- Section 2「ブランドフィロソフィー」: ブランドカードクリックで詳細モーダル（哲学/タグ/時代/共鳴タグ/リンク）
- Section 3「偉大な参照」: カテゴリタブ（すべて/デザイナー/ルック/アートワーク/映画・本）付き一覧

**シードデータ（5件）**
- Rick Owens 2019SS（designer）
- Yohji Yamamoto の哲学（designer）
- Martin Margiela 初期ルック（look）
- Wim Wenders の映画衣装（film）
- 川久保玲 インタビュー（designer）

---

## Sprint 22: コーデ結果表示の大幅改善

| # | 内容 | 状態 |
|---|------|------|
| 1 | `lib/utils/silhouette-map.ts` 新設（topVolume/bottomVolume/ratio → SVG数値変換） | ✅ |
| 2 | `components/coordinate/SilhouetteDiagram.tsx` 新設（SVGシルエット構造図） | ✅ |
| 3 | `components/coordinate/CoordinateCard.tsx` 全面再設計（3層構造・アコーディオン廃止） | ✅ |

**3層構造の設計**
- Layer 1（サマリーバー）: beliefAlignment / シルエット名バッジ / ★世界観一致度 + worldviewComment
- SVGパネル: シルエット構造図（上下比率バー・ボリューム幅・重心マーカー・ライン方向）とアイテム画像を2カラムで並列表示
- Layer 2（構造の核）: A.形 / B.質感 / C.成立条件 / D.意味 の4ブロックを常時展開で縦スクロール
- Layer 3（解釈）: デフォルト折りたたみ — Why / Emotion / Worldview aligned/diverged tags / Gaze Flow / 崩してはいけない要素

**SVGシルエット構造図の仕様**
- topVolume → topScale（タイト=0.7 / ジャスト=1.0 / ゆとりあり=1.3）
- bottomVolume → botScale（スリム=0.6 / テーパード=0.8 / ジャスト=1.0 / ワイド=1.4 / フレア=1.6）
- analysis.ratio.topBottom → "上3:下7" を正規表現でパースして分割比率を計算
- analysis.weight.center → amber●マーカーをbody内のupper/balanced/lower位置に表示
- analysis.line.direction → vertical/horizontal/diagonal を青色破線でオーバーレイ
- 左端に比率バーと「上N / 下N」ラベルを表示

**Layer 2 各ブロックの内容**
- A. 形: silhouette.type / ratio.topBottom+assessment / line.dominantLine+effect / lengthBalance
- B. 質感: colorStory / material.combination+tactileStory+hierarchy / weight.feeling+structuralRole
- C. 成立条件: bodyFitNote（先頭）/ structure.logic+tension / sizeGuide / adjustment
- D. 意味: analysis.what / trendNote / buyingHint

---

## Sprint 21: Phase 5 — 辞書システム実装

| # | 内容 | 状態 |
|---|------|------|
| 1 | `lib/dictionaries/material.ts` 新設（MaterialEntry interface + 14素材） | ✅ |
| 2 | `lib/dictionaries/color.ts` 新設（ColorEntry interface + 15色） | ✅ |
| 3 | `lib/dictionaries/line.ts` 新設（LineEntry interface + 10シルエット） | ✅ |
| 4 | `lib/dictionaries/ratio.ts` 新設（RatioEntry interface + 8比率） | ✅ |
| 5 | `lib/dictionaries/index.ts` 新設（全辞書の re-export） | ✅ |
| 6 | `lib/dictionaries/inject.ts` 新設（getMaterialContext / getColorContext / getLineContext） | ✅ |
| 7 | `lib/prompts/coordinate.ts` 更新（buildCoordinateSystemPrompt 追加） | ✅ |
| 8 | `lib/prompts/analyze-item.ts` 更新（素材本質イメージの静的辞書参照を追記） | ✅ |
| 9 | `app/api/ai/coordinate/route.ts` 更新（wardrobeItems から素材・色を抽出して辞書注入） | ✅ |

**辞書設計思想**
- 3層モデル: 本能的イメージ / 文化的文脈 / 身体感覚
- ファッション解釈ではなく「人類共通の知覚・記憶」として定義
- coordinate ルートでは動的注入（ユーザーの手持ちアイテムから素材・色を抽出）
- analyze-item プロンプトでは静的注入（画像解析時の参照情報として）

---

## Sprint 22: Phase 2 — CoordinateCard UI 改善（5点）

| # | 内容 | 状態 |
|---|------|------|
| 1 | Layer 1「このコーデの核」を2層化（analysis.what 大＋beliefAlignment 小・グレー） | ✅ |
| 2 | SVG図の下にラベル追加（比率・重心・形・視線の4行） | ✅ |
| 3 | 世界観一致度を「世界観一致 ★★★★☆」ラベル付き表示に変更 | ✅ |
| 4 | Layer 2 の余白・行間改善（spacing/padding拡大・値テキスト text-sm 化） | ✅ |
| 5 | Layer 1 再設計（コア1行大→バッジ行→beliefAlignment 補足の3段構造） | ✅ |

---

## Sprint 22: Phase 3 — プロンプト字数制限 + テキストクリーニング

| # | 内容 | 状態 |
|---|------|------|
| 1 | `analysis.what` を25字以内・「何を・どう・作る」構造に制約 | ✅ |
| 2 | `beliefAlignment` を60字以内・信念との接点を1文で言い切るに制約 | ✅ |
| 3 | `trendNote` を40字以内・「〇〇を、世界観を壊さず取り入れている」形式に制約 | ✅ |
| 4 | `CoordinateCard.tsx` に `cleanText()` 追加（ハングル文字除去）・全テキスト表示前に適用 | ✅ |
| 5 | 比率表示を2行分離（`parseRatioDisplay()`：実際の比率 / 見え方の比率） | ✅ |

---

## Sprint 23: 診断結果・オンボーディング改善

| # | 内容 | 状態 |
|---|------|------|
| 1 | `lib/prompts/analyze.ts` に8フィールド追加（plainType / typeExplanation / recommendedColors / recommendedMaterials / recommendedSilhouettes / avoidElements / buyingPriority / dailyAdvice） | ✅ |
| 2 | `styleStructure` 各軸に具体的な色名・素材名・シルエット名を含める指示を追加 | ✅ |
| 3 | `avoid` → `avoidElements` に統合（具体的な色・素材・装飾・シルエット） | ✅ |
| 4 | `types/index.ts` に新フィールドをオプショナルで追加・後方互換維持 | ✅ |
| 5 | `lib/validators/analyze.ts` に新フィールドのバリデーション追加 | ✅ |
| 6 | `/api/ai/analyze` の `maxTokens` を 3000 → 4000 に増加 | ✅ |
| 7 | `ResultCard` の表示順を再設計（plainType→typeExplanation→coreIdentity小→似合う服→avoid→買い足し→今日のアドバイス→既存セクション） | ✅ |
| 8 | Step 8（印象）：与えたい印象を日常語グループに刷新・避けたい印象を12項目フラットリストに変更・質問文変更 | ✅ |
| 9 | Step 9（信念）：社会テーマのChipSelectを自由入力textareaに変更 | ✅ |
| 10 | `middleware.ts` に環境変数ガード追加（Vercel本番エラー対策） | ✅ |

---

## Sprint 24: オンボーディング選択肢の全面刷新（バイアス除去）

| # | 内容 | 状態 |
|---|------|------|
| 1 | `lib/prompts/analyze.ts` に診断バイアス排除指示を追加（かわいい・派手・ストリート・ラグジュアリー等あらゆる方向性を等しく尊重） | ✅ |
| 2 | Step 4「今の気分」`MOOD_VIBES` を16項目に拡張（かわいい・派手・ストリート・ラグジュアリー・フェミニン・エスニック方向を追加） | ✅ |
| 3 | Step 8「与えたい印象」を `GroupedChipSelect`（グループ構造）→ `ChipSelect`（フラット）に変更・25項目・各1行説明付きに刷新 | ✅ |
| 4 | Step 8「避けたい印象」を23項目に刷新（古くさい・野暮ったい・近寄りがたい・だらしない・チャラい・重すぎる・暗すぎる・幼い・生活感・痛々しいを追加） | ✅ |
| 5 | Step 9 社会テーマを `CULTURE_HINTS`（23項目クリックチップ）に変更・プレースホルダーを「好きな文化・時代・場所・作品があれば書いてください」に更新 | ✅ |

---

## Sprint 25: オンボーディング言語・設計の全面改善 + 診断ロジック強化

| # | 内容 | 状態 |
|---|------|------|
| 1 | Step 4 全設問を自然な日本語に刷新（Q1〜Q4の質問文・例文・チップ更新、DREAM_STYLE_EXAMPLESを廃止） | ✅ |
| 2 | Step 5 を「参考になる人物・作品・場所」→「服はどんな役割をしていますか？」に変更（自由入力＋`CLOTHING_ROLE_CHIPS` 7項目） | ✅ |
| 3 | Step 7 `COLOR_TONES` の desc を抽象語から平易な説明に変更・value も具体的な色名入りに更新（6項目に整理） | ✅ |
| 4 | Step 8 を ChipSelect 主体 → 自由入力主体に変更（与えたい・避けたいそれぞれ FreeNote＋補助チップ）、state を `string[]` → `string` に変更 | ✅ |
| 5 | Step 9 を「服を着ることの意味」→「服の好みに影響しているもの」に変更（textarea＋`INFLUENCE_HINTS` 6項目チップ） | ✅ |
| 6 | 未使用定数（`CULTURE_HINTS` / `BELIEF_EXAMPLES`）・コンポーネント（`GroupedChipSelect`）・型（`ImpressionGroup`）を削除 | ✅ |
| 7 | `lib/prompts/analyze.ts` に分析5ステップ手順・自由入力優先指示・whyThisResult強化・ブランド方向性ガイド7方向・テンプレ化防止指示を追加 | ✅ |

---

## Sprint 26: StylePreference 構造化データの保存・活用

| # | 内容 | 状態 |
|---|------|------|
| 1 | `types/index.ts` に `StylePreference` インターフェース追加・`StyleDiagnosisResult.preference` フィールド追加 | ✅ |
| 2 | `lib/prompts/analyze.ts` の JSON スキーマに `preference` ブロック追加（13フィールド） | ✅ |
| 3 | `lib/validators/analyze.ts` に preference フィールドのバリデーション追加 | ✅ |
| 4 | `supabase/migrations/011_preference.sql` — `users.style_preference jsonb` カラム追加 | ✅ |
| 5 | `app/api/ai/analyze/route.ts` で `result.preference` を `style_preference` としてDBに保存 | ✅ |
| 6 | `lib/prompts/coordinate.ts` の `buildCoordinateSystemPrompt` に `stylePreference` パラメータ追加・注入 | ✅ |
| 7 | `app/api/ai/coordinate/route.ts` で `style_preference` を SELECT・プロンプトに渡す | ✅ |
| 8 | `lib/prompts/brand-recommend.ts` を `buildBrandRecommendSystemPrompt(stylePreference?)` 関数に変更・注入 | ✅ |
| 9 | `app/api/brands/recommend/route.ts` で認証ユーザーから `style_preference` を取得・プロンプトに渡す | ✅ |

---

## Sprint 27: 世界観編集画面の全面改善

| # | 内容 | 状態 |
|---|------|------|
| 1 | `WorldviewTab` を `StylePreference` ベースに全面書き直し（8セクション構成） | ✅ |
| 2 | 抽象語チップ（余白・静けさ等）→ 日常語16項目（落ち着いて見える・清潔感がある等）に置き換え | ✅ |
| 3 | 好きな色・素材・形・苦手な色・素材・形のタグ入力セクションを追加 | ✅ |
| 4 | 参考にしたいもの（ブランド・映画・音楽・街・時代）入力セクションを追加 | ✅ |
| 5 | 「信念キーワード」→「服を選ぶとき大事にしたいこと」チップ選択に変更 | ✅ |
| 6 | NGな要素タグ入力セクションを追加 | ✅ |
| 7 | 編集内容を `style_preference` として保存（コーデ提案・ブランド提案に自動反映） | ✅ |
| 8 | `app/api/worldview/route.ts` を GET/PATCH 両方 `style_preference` 対応に更新 | ✅ |

---

## Sprint 28: トレンド翻訳機能

| # | 内容 | 状態 |
|---|------|------|
| 1 | `supabase/migrations/012_trends.sql` — trendsテーブル作成・RLS設定・2025SSシード5件 | ✅ |
| 2 | `types/index.ts` — `Trend` / `TrendTranslationResult` / enum型追加 | ✅ |
| 3 | `lib/prompts/trend-translate.ts` — 世界観を壊さない取り入れ方特化プロンプト | ✅ |
| 4 | `app/api/trends/route.ts` — トレンド一覧GET（認証不要・public） | ✅ |
| 5 | `app/api/ai/trend-translate/route.ts` — style_preference×トレンドをClaudeで翻訳 | ✅ |
| 6 | `app/(app)/learn/page.tsx` — Today's Insight直後にTrend Translationセクション追加 | ✅ |
| 7 | 翻訳結果をアコーディオン展開・compatibility色分け（高=緑・中=黄・低=赤） | ✅ |
| 8 | 翻訳済み結果はキャッシュし再クリックで再表示（API再呼び出しなし） | ✅ |

---

## Sprint 29: トレンド機能改善 + ブランド提案強化 + UI文言整理

| # | 内容 | 状態 |
|---|------|------|
| A1 | `lib/prompts/trend-translate.ts` — 禁止ワードリスト明示・出力フォーマット強制 | ✅ |
| A2 | compatibilityReason/howToAdapt/specificAdvice を具体的なアイテム・色・素材ベースに変更 | ✅ |
| B1 | `lib/prompts/brand-recommend.ts` — `whyThisBrand` / `tryFirst` / `caution` フィールドを出力スキーマに追加 | ✅ |
| B2 | `types/index.ts` — `BrandRecommendation` に3フィールド追加（optional） | ✅ |
| B3 | `app/api/brands/recommend/route.ts` — 新フィールドをマッピング・maxTokens 2500に増量 | ✅ |
| B4 | `components/BrandCard.tsx` — 診断との一致・まず試すなら・注意点を追加表示 | ✅ |
| C1 | `self/page.tsx` — タブ名「世界観診断」→「診断結果」「世界観編集」→「好みの設定」 | ✅ |
| C2 | `learn/page.tsx` — 「世界観タグ」→「スタイルタグ」「世界観との共鳴」→「好みと重なる点」「自分の世界観との相性を見る」→「自分の好みと合うか見る」 | ✅ |
| C3 | `onboarding/page.tsx` — ヘッドコピー「あなたの世界観を言語化」→「あなたの服の方向性を言語化」 | ✅ |
| D1 | `supabase/migrations/013_trends_evidence.sql` — trendsテーブルに根拠フィールド5カラム追加 | ✅ |

---

## Sprint 30: 楽天ランキング自動トレンド取得

| # | 内容 | 状態 |
|---|------|------|
| 1 | `lib/rakuten.ts` — `getRanking(genreId, hits)` 関数追加（楽天Ranking API使用） | ✅ |
| 2 | `lib/prompts/trend-extract.ts` — 商品名リストからトレンド抽出プロンプト（3〜5件・JSON） | ✅ |
| 3 | `app/api/admin/sync-trends/route.ts` — 管理者向けトレンド同期API（dryRun対応・Bearer認証） | ✅ |

---

## Sprint 31: Vercel Cron 週次トレンド自動更新

| # | 内容 | 状態 |
|---|------|------|
| 1 | `vercel.json` 新規作成 — 毎週月曜 UTC 0:00（日本時間 9:00）に `/api/admin/sync-trends` を実行 | ✅ |
| 2 | `app/api/admin/sync-trends/route.ts` — GET ハンドラ追加（Vercel Cron 用・常に本番実行） | ✅ |
| 3 | 認証を2パターン対応: `CRON_SECRET`（Cron）/ `SUPABASE_SERVICE_ROLE_KEY`（手動） | ✅ |
| 4 | ロジックを `runSync()` 関数に集約し GET/POST から共通呼び出し | ✅ |

---

## Sprint 32: 体型・骨格・サイズ相談機能

| # | 内容 | 状態 |
|---|------|------|
| 1 | `types/index.ts` — `BodyConcern` / `BodyProfile` 型追加 | ✅ |
| 2 | `supabase/migrations/014_body_profile.sql` — `users.body_profile jsonb` カラム追加 | ✅ |
| 3 | `lib/utils/body-rules.ts` — `getBodyAdjustments()` ルールエンジン新規作成 | ✅ |
| 4 | `app/(app)/self/page.tsx` — 身体情報タブに体型タイプ・骨格・悩み・補足メモを追加 | ✅ |
| 5 | `app/api/profile/route.ts` — GET/PATCHに `body_profile` を追加 | ✅ |
| 6 | `lib/prompts/coordinate.ts` — `buildCoordinateSystemPrompt()` に `bodyProfile?` 引数追加・制約ブロック注入 | ✅ |
| 7 | `app/api/ai/coordinate/route.ts` — `body_profile` を SELECT してプロンプトに渡す | ✅ |

---

## 既知の未解決問題

| 問題 | 詳細 |
|------|------|
| 楽天API認証エラー | UUID形式のアプリIDおよびpk_形式のアクセスキーがAPIに拒否される |

---

