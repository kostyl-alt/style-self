# STYLE-SELF 8 パターン廃止 監査(doc7 Phase C 準備資料)

> 設計判断: [docs/STYLE-SELF_D1_実装設計.md](./STYLE-SELF_D1_実装設計.md) 判断 10(`ac834bb` で確定)
> 上位思想: [docs/STYLE-SELF_診断システム_再設計.md](./STYLE-SELF_診断システム_再設計.md)(doc7・アプローチ 2)
> 投入ポリシー: 判断 10 項目 5「T2 = 本判断確定後すぐに投入」→ 本 doc
> 実装ポリシー: ★ コード変更なし(監査のみ)・Phase C 実装は MVP-1c 完了後の別 Sprint

---

## 1. 背景

doc7「①知る再定義」で 8 パターン体制廃止 → AI 毎回ユーザー固有世界観構築(`analyze-v2`)
に移行する Phase C(legacy 削除)を、MVP-1c 完了後に投入するための事前監査。本 doc では
全参照箇所をリスト化し X(代替可)/ Y(残置必要)/ Z(既知ギャップ・対応済 or 別タスク)
に分類する。

---

## 2. 監査対象

- **シンボル**: `patternId`(変数 / 列 / 型フィールド)・`WORLDVIEW_PATTERNS`(辞書)・
  `WorldviewPattern`(型)・`matchWorldview`(関数)・`applyPatternToResult`(関数)
- **ファイル**: `lib/knowledge/worldview-patterns.ts` / `lib/utils/worldview-matcher.ts` 全体
- **DB 列**: `worldview_profiles.pattern_id` / `diagnosis_sessions.pattern_id` /
  `posts.pattern_id`

---

## 3. 全参照リスト(ファイル別・行番号付き・分類タグ付き)

### 3.1 純粋 legacy core(分類 X: Phase C で削除可能)

| ファイル | 行 | 種別 | 分類 |
|---|---|---|---|
| [lib/knowledge/worldview-patterns.ts](../lib/knowledge/worldview-patterns.ts) | 全 200 行 | 8 パターン辞書 + `getPatternById` | **X** |
| [lib/utils/worldview-matcher.ts](../lib/utils/worldview-matcher.ts) | 全 179 行 | `matchWorldview` / `WORLDVIEW_PATTERNS` 集計 | **X** |
| [lib/validators/analyze.ts:1,126,128,130](../lib/validators/analyze.ts) | 1 import + 約 30 行 `applyPatternToResult` | パターン強制上書き | **X** |
| [app/api/ai/analyze/route.ts:4,7,12,27,28,85,145,156](../app/api/ai/analyze/route.ts) | 全 192 行(旧エンドポイント本体) | legacy `/api/ai/analyze` | **X**(切替確認後削除) |
| [types/index.ts:395](../types/index.ts#L395) | `WorldviewPattern` interface 宣言 | 型定義(legacy) | **X** |
| [types/index.ts:443](../types/index.ts#L443) | `WorldviewMatchResult.patternId` | `matchWorldview` 戻り型 | **X**(matcher と一緒に削除) |

### 3.2 公開・共有スキーマ(分類 Y: 残置必要・案 a 整合)

| ファイル | 行 | 種別 | 分類 |
|---|---|---|---|
| [types/index.ts:380](../types/index.ts#L380) | `StyleDiagnosisResult.patternId?: string`(optional) | 過去診断データ互換 | **Y**(optional のまま残置) |
| [lib/utils/worldview-public-fields.ts:29,140](../lib/utils/worldview-public-fields.ts) | public 露出フィールドに `patternId` 含む | `/u` / `/p` 公開ルートで過去診断ユーザーの coreTags 復元に必要 | **Y**(legacy ユーザー読出維持) |
| [app/api/posts/route.ts:114,174](../app/api/posts/route.ts) | 投稿時に `result.patternId` を `posts.pattern_id` にコピー | 過去診断ユーザー投稿の世界観タグ | **Y**(案 a 過去診断温存) |
| [app/api/ai/culture-explain/route.ts:12,55](../app/api/ai/culture-explain/route.ts) | body の `patternId?: string`(optional) | culture 解説の cacheKey 候補 | **Y**(optional・3.3 と連動) |

### 3.3 既知ギャップ・互換ブリッジ(分類 Z: 対応済 or 別タスク)

| ファイル | 行 | 種別 | 状態 |
|---|---|---|---|
| [lib/knowledge/worldview-concepts.ts:92-108](../lib/knowledge/worldview-concepts.ts#L92-L108) | `getConceptsForPattern` + 99-100 で「analyze-v2 で patternId 辞書空」明記 | Phase B Step 3 ギャップ・本体 4.7 / 11 章で参照 | **Z**(対応済: `getConceptsForAnalysis` で `worldview_keywords` フォールバック) |
| [components/discover/CultureView.tsx:12-93](../components/discover/CultureView.tsx#L12-L93) | cacheKey が `patternId → worldviewName → keywords` フォールバック・v1→v2 で衝突回避 | analyze-v2 対応済 | **Z**(対応済) |
| [components/discover/InspirationView.tsx:96](../components/discover/InspirationView.tsx#L96) | `patternId` なしの時 `worldview_keywords` フォールバック | analyze-v2 対応済 | **Z**(対応済) |
| [components/DiagnosisDisplay.tsx:30-33](../components/DiagnosisDisplay.tsx#L30-L33) | UI 側で patternId 駆動データ非存在時 `worldview_keywords` フォールバック | analyze-v2 対応済 | **Z**(対応済) |

### 3.4 コメント・プロンプト文字列(削除不要 or 内容のみ更新)

| ファイル | 行 | 種別 | 扱い |
|---|---|---|---|
| [app/api/ai/analyze-v2/route.ts:266](../app/api/ai/analyze-v2/route.ts#L266) | コメント「patternId は意図的に未設定」 | 設計意図のドキュメント | Phase C 時に陳腐化 → 削除 or 更新 |
| [lib/prompts/stylist-chat.ts:36](../lib/prompts/stylist-chat.ts#L36) | system プロンプト「内部 ID(patternId・session ID 等)を出力しない」 | プライバシー三重防御 1 段目 | **★ 残置必須**(出力フィルタ防御線) |
| [app/(app)/dev/diagnosis-preview/PreviewClient.tsx:97,102](../app/(app)/dev/diagnosis-preview/PreviewClient.tsx) | dev 専用 preview で `patternId: "quiet-observer"` hardcode | 開発ツール・本番非経路 | Phase C 時に dev tool 全体の存続判断 |

### 3.5 DB 列(マイグレーション戦略)

| マイグレーション | 列 | 状態 |
|---|---|---|
| [020_diagnosis_v2.sql:35](../supabase/migrations/020_diagnosis_v2.sql) | `diagnosis_sessions.pattern_id text not null` | 初期定義 |
| [022_diagnosis_v2_nullable.sql:29](../supabase/migrations/022_diagnosis_v2_nullable.sql) | `worldview_profiles.pattern_id` を NULL 許容に変更(★ Phase B Step 1 完了済)| ★ analyze-v2 で null 保存可能 |
| [024_m3_posts.sql:72](../supabase/migrations/024_m3_posts.sql) | `posts.pattern_id text`(legacy ユーザー用) | 案 a で温存 |

---

## 4. 分類サマリ

| 分類 | 件数(ファイル) | 行数見当(削除規模) | 扱い |
|---|---|---|---|
| **X(削除可)** | 6 ファイル | コード **約 600 行**(legacy 本体 + 型 + 旧エンドポイント) | Phase C で削除 |
| **Y(残置必要・案 a 整合)** | 4 ファイル | 約 10 行(個別フィールド) | 残置・optional maintain |
| **Z(対応済 or 別タスク)** | 4 ファイル | 0 行(既にフォールバック実装済)| 既存動作維持 |
| **コメント/プロンプト/dev tool** | 3 ファイル | コメント 数行更新のみ | 個別判断 |

---

## 5. Phase C 実装計画(MVP-1c 完了後・別 Sprint)

### 5.1 削除手順(X 系)

1. **旧 `/api/ai/analyze` エンドポイント削除**(analyze-v2 切替が安定動作している前提)
   - 削除: [app/api/ai/analyze/route.ts](../app/api/ai/analyze/route.ts) 192 行
2. **legacy 関数削除**
   - `applyPatternToResult` from [lib/validators/analyze.ts](../lib/validators/analyze.ts)
   - `matchWorldview` from [lib/utils/worldview-matcher.ts](../lib/utils/worldview-matcher.ts) 全 179 行削除
3. **legacy 辞書削除**
   - [lib/knowledge/worldview-patterns.ts](../lib/knowledge/worldview-patterns.ts) 全 200 行削除
4. **型削除**
   - `WorldviewPattern` interface([types/index.ts:395](../types/index.ts#L395))
   - `WorldviewMatchResult` interface([types/index.ts:443](../types/index.ts#L443))
   - `StyleDiagnosisResult.patternId?` ★ **Y のため残置**
5. **検証**: `npx tsc --noEmit` で参照漏れ検出 → 残るのは Y 系 optional のみ

### 5.2 削除しないもの(Y 系)

- `StyleDiagnosisResult.patternId?: string`(optional・過去診断データの jsonb 読出)
- `worldview-public-fields.ts` の `patternId` 露出
- `posts.pattern_id` 保存ロジック
- `stylist-chat.ts:36` 出力ガード文言(★ プライバシー三重防御維持)

### 5.3 規模見当
- 削除: コード **約 600 行**
- 残置: 約 10 行(Y 系 optional フィールド)
- マイグレーション: **0 件**(下記 6 章方針による)

---

## 6. DB マイグレーション戦略

### 候補
| 案 | 内容 | 推奨 |
|---|---|---|
| Option A | `pattern_id` 列を全テーブルから DROP | ❌ 案 a「過去診断温存」と矛盾(過去データ破壊)|
| **Option B** | nullable のまま keep(既に 022 で適用済) | ★ **本命** |
| Option C | deprecated view で互換維持 | 過剰(B で十分) |

### 推奨: Option B(変更なし・既に 022 で nullable 化済)
- ★ Phase C 時点でマイグレーション **0 件**
- 過去診断データ(`pattern_id` あり)は読出可能・公開ルート `/u` `/p` で表示維持
- 新規 analyze-v2 保存は `pattern_id = null`(既に動作中)
- 案 a「過去診断は 8 パターン形式温存・再診断で新形式上書き」と完全整合

---

## 7. 既存達成への影響評価

| 既存達成 | 影響 | 根拠 |
|---|---|---|
| 1.5b 完成形(`60c7fa8`)| **なし** | `stylist-chat` route は `analyze-v2` schema(`worldviewName` / `worldview_keywords` 等)を使用・legacy 非依存 |
| race fix v2(`040078c`)| **なし** | localStorage 永続化・診断スキーマ非依存 |
| L4-A 切替検出(`60c7fa8`)| **なし** | UI 側 routing・intent 判定のみ |
| リグレッションテスト(`3e39f99`)| **なし** | mock 値で simulator 動作確認・診断スキーマ非依存 |
| コスト試算(`985d00b`)| **なし** | 会話 AI コスト試算のみ |
| ③ プライバシー専章 | **なし** | 顔写真・worldview_tags 出力フィルタは独立 |
| Phase 2 後ゲート | **なし** | 機構不変 |
| public ルート(`/u` `/p`)| ★ **Y 系で保護**(残置)| `worldview-public-fields.ts` の patternId 露出維持 |

---

## 8. リスク + 緩和策

| # | リスク | 緩和策 |
|---|---|---|
| 1 | X 系削除後に Y 系 optional への参照が宙に浮く | tsc で参照漏れ検出・Y 系は optional のまま keep |
| 2 | 過去診断データの coreTags 復元が将来必要になる | `worldview-public-fields.ts` 経由で復元可能(legacy 辞書削除時に該当 method の挙動確認必要)|
| 3 | culture-explain / DiagnosisDisplay の patternId フォールバックロジックがいつまで必要か曖昧 | 案 a により過去ユーザーがいる限り永続維持(コメントで明記)|
| 4 | dev tool(PreviewClient)が壊れる | dev 専用・本番経路非依存 → Phase C 時に dev tool 全体の存続判断と同時処理 |
| 5 | system プロンプトの patternId 言及が陳腐化 | ★ 残置(プライバシー三重防御の防御線文言・将来読者の補助)|
| 6 | MVP-1c 中に新たな legacy 参照が増える | 本 doc を MVP-1c 完了時に再 grep して更新 |

---

## 9. 結論 + 次工程

### 結論
- **X 系(削除可)** = 6 ファイル・約 600 行・Phase C で削除
- **Y 系(残置必要)** = 4 ファイル・約 10 行・案 a 整合で永続 optional
- **Z 系(対応済)** = 4 ファイル・既にフォールバック実装済・現状動作維持
- **DB マイグレーション** = 0 件(Option B 既適用)
- 既存達成(1.5b 完成形 + race fix v2 + L4-A + リグレッションテスト + コスト試算)
  への影響 ★ **ゼロ**

### 次工程
1. **MVP-1c**(残 6 intent 会話化)を進める間、本 doc は冷凍保管
2. MVP-1c 完了後に **本 doc を再 grep して更新**(新規 legacy 参照の追加検出)
3. T3 = Phase C 実装(別 Sprint・コード -600 行・マイグレーション 0 件)
4. T3 完了後に本 doc を「実施済」として archive 注記
