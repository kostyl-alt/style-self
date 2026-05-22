# STYLE-SELF D1 段階 A プロンプト修正 設計調査(virtual-coordinate / coordinate 境界精緻化)

> ★ 設計調査 doc(実装しない・本体 [STYLE-SELF_D1_実装設計.md](./STYLE-SELF_D1_実装設計.md) `ac834bb` は書き換えない)。
> 真因切り分け結果: 仮説 H1(累積履歴)完全確定・コード分岐は MVP-1c 設計通り正しく動作。
> 真の論点: 段階 A LLM の `virtual-coordinate` / `coordinate` 境界が曖昧・LLM が「組む」「具体条件」発話を `virtual-coordinate` に振り分けている。
>
> 前提コミット: `182c25b`(MVP-1c 実装完了・119/119 PASS・push 待機中)

---

## 1. 背景

### 1.1 オーナー実機 J1 検証結果(完全確定)
- 新しいチャット履歴クリア後「コーデを組んで」単独投入 → **intent-result カード(virtual-coordinate 75%)のみ**・段階 B reply なし
- 仮説 H1(累積履歴による「両方表示」誤認)完全確定
- ★ コード分岐は MVP-1c 設計通り正しく動作

### 1.2 真の論点
段階 A LLM が以下のパターンで分類:

| 発話 | 現状 LLM 判定 | 期待 |
|---|---|---|
| 「コーデ提案して」 | `coordinate`(0.9-)| ✅ OK |
| **「コーデを組んで」** | **`virtual-coordinate` (0.75)** | ❌ NG → `coordinate` 期待 |
| **「黒系で静かだけど印象に残るコーデにしたい」** | **`virtual-coordinate` (0.92)** | ❌ NG → `coordinate` 期待 |
| 「クローゼット見せて」 | `closet` | ✅ OK |
| 「ブランドを学びたい」 | `brand-learn` | ✅ OK |

**規則性**: 「組む」「具体条件付き(色・雰囲気)」発話が `virtual-coordinate` に過剰に振り分けられている。

### 1.3 影響
- MVP-1c で `coordinate` のみカバー → これら発話は段階 B 非起動 → intent-result カード表示
- ChatGPT の服版として完成形でない(コーデ系発話の半分しか会話化されない)

---

## 2. 現状実装サマリ([lib/prompts/overlay-intent.ts](../lib/prompts/overlay-intent.ts) 全 70 行)

### 2.1 該当 intent description(L22-24)
```
- coordinate          : 今日のコーデを提案してほしい(AI による日常コーデ)
- style-consult       : 着こなしの相談がしたい(体型・身長等の悩み解消)
- virtual-coordinate  : コンセプトから理想のコーデを設計したい(抽象語→具体コーデ)
```

### 2.2 mode 付与ルール(L42-46)
- `coordinate` → mode "api"
- `virtual-coordinate` → mode **"hybrid"**
- `tryon` → mode "none"(将来機能・現在未配線)

### 2.3 params 例(L51)
- `virtual-coordinate なら { "scene": "オフィス", "concept": "静かな大人" }`

★ **virtual-coordinate の本来の意味**(本体 4.2 機能 8 確認・[本体 L469](./STYLE-SELF_D1_実装設計.md#L469)):
> `virtual-coordinate` | POST `/api/ai/virtual-coordinate` body `{scene, concept, mood?}` | conceptInterpretation + items + 商品概要

= **コンセプト翻訳エンジニアリング**(M5 Sprint 36-37 で実装済・知識ベース lookup → Stage3)

### 2.4 隣接 intent との関係
| intent | 本来の意味 | 配線状態 |
|---|---|---|
| `coordinate` | 日常コーデ提案(broad) | ✅ MVP-1c で段階 B 配線済 |
| `virtual-coordinate` | コンセプト → コーデ設計(narrow・要 concept キーワード) | ✅ M5 既存(`/api/ai/virtual-coordinate`)・mode=hybrid・★ MVP-1c は未対応 |
| `tryon` | リアル試着(写真ベース) | ❌ 未配線・Phase 3-4 |
| `product-match` | virtual-coordinate 結果の連鎖 | ✅ M5 既存 |

★ **`virtual-coordinate` と `tryon` は別物**:
- `virtual-coordinate` = 抽象 → 具体コーデの **テキスト/構造設計**(画像なし)
- `tryon` = 写真ベース **視覚試着**

---

## 3. 境界精緻化の方針

### 3.1 設計原則
- **`coordinate` を broad(日常コーデ提案全般)に拡張** — 条件付き発話を含む
- **`virtual-coordinate` を narrow(明示的コンセプト/シーン翻訳)に絞る** — 要 `concept` or `scene` キーワード
- **`tryon` は不変**(写真試着・Phase 3 領域・③ プライバシー専章/コスト管理の地雷から距離保つ)

### 3.2 「コーデを組んで」「黒系で…コーデ」の分類根拠

| 発話 | 分類 | 根拠 |
|---|---|---|
| 「コーデを組んで」 | **`coordinate`** | 「組む」= 日常的なコーデ提案要求・concept キーワードなし |
| 「黒系で静かだけど印象に残るコーデにしたい」 | **`coordinate`** | スタイル形容詞(色・雰囲気)あり・concept 明示なし → broad 提案 |
| 「『静かな大人』のコンセプトでコーデを設計して」 | **`virtual-coordinate`** | 「コンセプト」明示 + 「設計」キーワード |
| 「オフィスシーン用に世界観名を変換して」 | **`virtual-coordinate`** | シーン明示 + 「変換」キーワード |

---

## 4. 修正案 比較

### 案 X: 各 description に例文追加(最小・+5-15 行)
```diff
- coordinate          : 今日のコーデを提案してほしい(AI による日常コーデ)
+ coordinate          : 今日のコーデを提案してほしい・コーデを組みたい・具体的なコーデが見たい(AI による日常コーデ提案)
+                       例:「コーデ提案して」「コーデを組んで」「黒系のコーデにしたい」「印象に残るコーデ」
- virtual-coordinate  : コンセプトから理想のコーデを設計したい(抽象語→具体コーデ)
+ virtual-coordinate  : 明示的なコンセプトやシーンを指定して理想のコーデを設計したい(抽象語→具体コーデ・要 concept キーワード)
+                       例:「『静かな大人』のコンセプトで設計」「オフィスシーン用に変換」
```
規模: +6 行

### 案 Y: 境界判定ルール明示化(中・+10-25 行)
description 末尾に判定基準ブロックを追加:
```
[coordinate / virtual-coordinate 境界判定ルール(★ 追加)]
- 「コンセプト」「シーン指定」「世界観名の翻訳」等の明示語句なし → coordinate
- 「コンセプト」「シーン」「○○の世界観を変換」等の明示語句あり → virtual-coordinate
- 具体的な条件(色・雰囲気・テイスト)付きでも、コンセプト翻訳の明示意図がなければ coordinate
```
規模: +5-8 行(description 不変・末尾ブロック追加)

### 案 Z(★ 推奨): 案 X + 案 Y(網羅)
- description に例文を追加(LLM の few-shot 学習効果)
- 末尾に判定ルールを追加(明示的指示)
- 規模: **+10-15 行**

---

## 5. ★ 推奨案(設計者判断)

### 5.1 推奨: **案 Z(網羅)**

**修正例**:
```ts
- coordinate          : 今日のコーデを提案してほしい・コーデを組みたい・具体的なコーデが見たい(AI による日常コーデ提案)
                        例:「コーデ提案して」「コーデを組んで」「黒系のコーデにしたい」「印象に残るコーデ」
- virtual-coordinate  : 明示的なコンセプトやシーンを指定して理想のコーデを設計したい(抽象語→具体コーデ・要 concept キーワード)
                        例:「『静かな大人』のコンセプトで設計」「オフィスシーン用に変換」「世界観名をコーデに翻訳」

[coordinate / virtual-coordinate 境界判定ルール(★ 重要)]
- 具体的な条件(色・雰囲気・テイスト)付きでも、コンセプト翻訳の明示意図がなければ → coordinate
- 「コンセプト」「シーン」「世界観名を変換」「○○というテーマで設計」等の明示語句あり → virtual-coordinate
- 試着・自分に着せる視覚化要求 → tryon(別 intent)
```

### 5.2 規模・時間
- 規模: **+10-15 行**(description 例文 +4 + 判定ルールブロック +6-10)
- 実装時間: **30-45 分**(プロンプト改修 5 分 + tsc 1 分 + 実機検証 25-40 分)
- リグレッションテスト: simulator は mock 主体・**段階 A プロンプト変更は影響なし**(119 PASS 維持)

---

## 6. 既存 intent 判定への影響評価

### 6.1 境界が変わる組(★ 期待されるシフト)
| 発話例 | 修正前 | 修正後 |
|---|---|---|
| 「コーデを組んで」 | virtual-coordinate | **coordinate** ✅ |
| 「黒系のコーデにしたい」 | virtual-coordinate | **coordinate** ✅ |
| 「印象に残るコーデ」 | virtual-coordinate | **coordinate** ✅ |
| 「『静かな大人』のコンセプトで」 | virtual-coordinate | virtual-coordinate ✅(維持)|
| 「オフィスシーン用に設計」 | virtual-coordinate | virtual-coordinate ✅(維持)|

### 6.2 他 intent への波及リスク
| 隣接 intent | リスク | 緩和策 |
|---|---|---|
| `style-consult` | 着こなし相談との境界(「悩み」言及あれば style-consult)| 既存 description「体型・身長等の悩み解消」で弁別済 |
| `tryon` | 試着発話との境界(「着てみる」「自分に着せる」)| 案 Z の判定ルールに「視覚化 → tryon」明示 |
| `product-match` | 商品マッチ(virtual-coordinate 連鎖)| 単独叩き不可・既存挙動維持 |
| `closet` | クローゼット参照 | 「クローゼット」明示語句で弁別済(影響なし)|
| `diagnose` | 診断 | 「診断」明示語句で弁別済(影響なし)|

→ **波及リスク低**(変更は coordinate/virtual-coordinate のみ・他 intent description 不変)

---

## 7. リグレッションテストへの影響

### 7.1 simulator は段階 A を mock(★ プロンプト変更は影響なし)
[scripts/test-stylist-chat-continuity.ts](../scripts/test-stylist-chat-continuity.ts) の `createFetchMock` は段階 A の response を **固定値 mock** で返している:
```ts
"/api/overlay/intent": () => ({ ok: true, intent: "coordinate", confidence: 0.9, mode: "api" }),
```
→ **lib/prompts/overlay-intent.ts の変更はテストに 0 影響**(119 PASS 維持)

### 7.2 実機検証は別途必要
段階 A の実 LLM 判定変化は **実機テスト**(本 doc 章 8)でのみ確認可能

---

## 8. 実機テスト 想定発話一覧

### 8.1 必須検証発話
| 発話 | 期待 intent | 検証目的 |
|---|---|---|
| 「コーデ提案して」 | `coordinate` | 既存挙動維持 |
| 「コーデを組んで」 | **`coordinate`** | ★ 修正効果検証 |
| 「黒系で静かだけど印象に残るコーデにしたい」 | **`coordinate`** | ★ 修正効果検証 |
| 「印象に残るコーデを作って」 | **`coordinate`** | ★ 修正効果検証 |
| 「クローゼット見せて」 | `closet` | 維持確認 |
| 「診断したい」 | `diagnose` | 維持確認 |

### 8.2 virtual-coordinate 維持確認(narrow 化が機能しているか)
| 発話 | 期待 intent | 検証目的 |
|---|---|---|
| 「『静かな大人』のコンセプトで」 | `virtual-coordinate` | narrow 維持 |
| 「オフィスシーン用にコーデを変換して」 | `virtual-coordinate` | narrow 維持 |
| 「世界観名をコーデに翻訳して」 | `virtual-coordinate` | narrow 維持 |

### 8.3 境界判定 (微妙な発話)
| 発話 | 期待 intent | 備考 |
|---|---|---|
| 「コーデを試したい」 | `coordinate` | 「試す」は提案文脈・視覚化なし |
| 「組み合わせを見たい」 | `coordinate` | 「組み合わせ」= coordinate |
| 「これ着てみたい」 | `tryon` | 視覚化要求 |
| 「自分に着せて」 | `tryon` | 視覚化要求 |

---

## 9. 既存達成への影響評価

| 既存達成 | 影響 |
|---|---|
| 1.5b 完成形(`60c7fa8`)| **なし**(段階 A プロンプト改修のみ・stylist-chat / sessionIntent / L4-A 不変) |
| race fix v2(`040078c`)| **なし**(localStorage 不変) |
| L4-A 切替検出(`60c7fa8`)| **なし**(handleSubmit ロジック不変) |
| リグレッションテスト(`3e39f99`)| **なし**(simulator は mock・119 PASS 維持) |
| A-2 / A-3(`59fa4d6` / `11cf3de`)| **なし**(UI 不変) |
| **MVP-1c 実装(`182c25b`)** | **★ 効果増大**(coordinate 経路への流入が増える) |
| ③ プライバシー専章 | **なし**(プロンプトは intent 分類のみ・worldview_tags 非露出) |
| ③ コスト管理 | **軽微**(coordinate 流入増 → 段階 B 呼出増 = コスト試算 985d00b の範囲内・案 P1 月 N 回上限が将来運用) |
| Phase 2 後ゲート | **なし**(機構不変) |
| 既存 18 機能 | **なし**(intent 分類精度の改善のみ) |
| 既存設計判断 1-10 | **文言不変** |

---

## 10. 不可侵境界線整合

| 境界線 | 整合 |
|---|---|
| 既存 DB 直触禁止 | ✅ 該当なし(プロンプト改修のみ)|
| 列絞り迂回禁止 | ✅ 該当なし |
| 既存 API 契約不変 | ✅ /api/overlay/intent の input/output 不変 |
| 公開 URL 不変 | ✅ 該当なし |
| 旧画面ファイル残置 | ✅ 該当なし |
| worldview_tags 英語スラッグ非露出 | ✅ プロンプトは intent 名のみ(英語スラッグ非依存)|
| service_role 不使用 | ✅ 該当なし |
| ★ ③ 専章 / ③ コスト / Phase 2 後ゲート diff 0 行 | ✅ 該当なし |

---

## 11. 実装手順 Step 分割

| Step | 内容 | 規模 |
|---|---|---|
| 1 | `lib/prompts/overlay-intent.ts` の `coordinate` description 拡張(例文 + broad 定義)| +2-3 行 |
| 2 | 同 `virtual-coordinate` description 絞り込み(narrow + 例文)| +2-3 行 |
| 3 | 「[coordinate / virtual-coordinate 境界判定ルール]」ブロック追加 | +5-8 行 |
| 4 | `tsc --noEmit` EXIT 0(★ プロンプト文字列のみ・型変更なし) | 検証 |
| 5 | ★ 実機テスト(本 doc 章 8 の発話一覧で intent 判定変化を verify) | 検証(25-40 分) |
| 6 | リグレッションテスト実行(★ simulator mock 主体・119 PASS 維持確認) | 検証 |
| 7 | commit(★ プロンプト改修のみ・本体不変)| - |

合計: **+10-15 行**・**30-45 分**

---

## 12. リスク + エッジケース

| # | リスク | 緩和策 |
|---|---|---|
| 1 | LLM が新プロンプトを期待通りに解釈しない | 実機テスト 8.1-8.3 で全件検証・必要なら few-shot 例追加で再調整 |
| 2 | virtual-coordinate を narrow にしすぎて誤判定 | 8.2 で 3 発話以上検証・必要なら判定ルール緩和 |
| 3 | 他 intent への波及(style-consult / inspiration 等)| 8 での全体検証・回帰確認 |
| 4 | 段階 A のコスト変化 | ほぼ同じ(プロンプト 10-15 行追加 = 30-50 tok 増・¥0.001 級・誤差) |
| 5 | リグレッションテスト simulator が prompt 変更を検出しない | ★ 仕様通り(simulator は mock・実 LLM 動作は実機検証で担保) |
| 6 | 「コーデを試したい」等の境界発話が誤判定 | 8.3 で個別検証・必要なら 8.3 ケースを判定ルールに追記 |

---

## 13. ★ 結論

- **境界精緻化方針確定**: `coordinate` を broad に拡張・`virtual-coordinate` を narrow(明示的コンセプト/シーン)に絞る
- **推奨: 案 Z(網羅)** — 例文 + 判定ルールブロックで LLM 学習効果と明示指示を両立
- **規模 +10-15 行・時間 30-45 分**
- 既存達成 ★ 全保持・**MVP-1c 実装(`182c25b`)の効果を最大化**
- リグレッションテスト 119 PASS 維持(simulator 影響なし)
- ChatGPT の服版「コーデ提案 対話化」完成度向上(オーナー指摘 2 完全解決)

### 次工程
1. オーナーレビュー → 案 Z 採用判断
2. 実装(本 doc 章 11 Step 1-7・別 commit・本体不変)
3. 実機検証(章 8 の発話一覧で intent 判定変化を verify)
4. ロードマップ A-6 MVP-1c 残 5 intent(style-consult / product-match / match-users / match-posts / 等)の Sprint 計画(別 doc)
