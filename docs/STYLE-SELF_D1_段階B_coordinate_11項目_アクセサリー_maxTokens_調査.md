# STYLE-SELF D1 — 段階 B coordinate 11 項目 + アクセサリー + maxTokens 調査(★ オーナー実機 verify で発見・調査のみ・実装は別工程)

- 作成日: 2026-05-28
- 起点 HEAD: `3daffa9`(段階 A maxTokens 768→1536・origin 保全済・clean / 399 PASS / tsc EXIT 0)
- 本 doc の役割: 段階 B coordinate 応答品質改善(途中切れ解消 + 11 項目説明 + アクセサリー提案)の **調査**(★ **コード 0 変更・実装は別工程**)
- 上位連結:
  - Sprint C-3 MB → coordinate 連鎖 4 commits(`f1867e6` / `0cf6759` / `9e90926` / `3daffa9`)= MB → coordinate 連鎖 完全動作確認済
  - 本 doc = 段階 B coordinate **応答品質** の改善青写真

---

## 1. 背景

### 1.1 オーナー実機 verify(2026-05-28)で発見した 3 つの本意

```
1. ★ コーデ応答が途中で切れる
   「『守られた個性』を引...」で終了 = 段階 B maxTokens 不足

2. ★ 11 項目で説明してほしい:
   比率・素材・色・カット・シルエット・ライン・重量・構造・調和・機能・テーマ

3. ★ アクセサリーも提案してほしい
   時計・カラコン・髪型・ピアス・ネックレス 等
```

### 1.2 不可侵境界線(★ 厳守)

1. 本体 `ac834bb` / コード / doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` / 各設計案 / 既存設計判断 1-10 ★ **全 0 変更**
2. ★ 本 doc は **調査のみ・実装しない**
3. リグレッションテスト **399 PASS 維持**
4. tsc EXIT 0 維持

---

## 2. ★ 静的解析結果

### 2.1 段階 B maxTokens(★ 途中切れ原因)

[`app/api/ai/stylist-chat/route.ts:65-66`](../app/api/ai/stylist-chat/route.ts#L65-L66):
```typescript
// reply 抑制(設計書 7.4・Haiku max_tokens)
const MAX_REPLY_TOKENS = 400;
```

[`app/api/ai/stylist-chat/route.ts:148`](../app/api/ai/stylist-chat/route.ts#L148):
```typescript
maxTokens: MAX_REPLY_TOKENS,
```

→ ★ **段階 B reply は 400 tokens 上限**(短文対話前提・MVP-1c 当時の設定)。

★ オーナー応答が「『守られた個性』を引...」で切れた = **400 tokens で truncation**(日本語 1 文字 ≒ 1.5-2 tokens → 200-260 文字でカット)。

### 2.2 段階 A maxTokens との比較

| 段階 | 用途 | 旧 | 現在 |
|---|---|---|---|
| 段階 A(`overlay-intent`)| intent 分類 JSON | 384 | **1536**(`3daffa9` で拡大) |
| **段階 B(`stylist-chat`)** | reply 本文(自然文)| **400** | ★ **400 のまま** |

→ ★ 段階 B も拡大が必要(MVP-1c 当時の短文対話用設定が現状の長文応答に追いついていない)。

### 2.3 段階 B coordinate prompt 構造

[`lib/prompts/stylist-chat.ts:25-82`](../lib/prompts/stylist-chat.ts#L25-L82) STYLIST_CHAT_SYSTEM_PROMPT:
- 【人格・返答構成】「1 返答 = **2〜4 文程度**」(★ 短文指示)
- 【絶対禁止】worldview_tags / 内部 ID / URL / 5 対象外話題に深入りしない
- 【良い例 5 低身長ロングコート】「3 法則: ①... ②... ③...」型 4 文構造
- 【出力】「返答本文のみを書く。前置き・JSON・タグ・括弧書きの注釈・絵文字は一切付けない」

→ ★ 現状は **短文(2-4 文)対話前提**。11 項目詳細 + アクセサリーは現状の指示と矛盾。

### 2.4 「11 項目」の既存定義(★ codebase 内検索結果)

```bash
grep -rn "11項目\|11軸" lib/ docs/
```

結果:
- `lib/dictionaries/inject.ts:49`: `// A-10: 比率辞書 8 種(getMaterialContext / getColorContext / getLineContext と同形)`
- `docs/STYLE-SELF_D1_A-4_P1-C-4_設計調査.md:156, 217`: MenuDrawer 11 項目(関係なし)

★ **コーデ説明用「11 項目」は ★ 既存コードに未定義**(オーナーが提示した新仕様)。

### 2.5 既存 dictionaries との対応

| 11 項目 | 既存 dictionary | 状態 |
|---|---|---|
| 比率 | `lib/dictionaries/ratio.ts`(8 種) | ✅ 既存 |
| 素材 | `lib/dictionaries/material.ts`(14 種) | ✅ 既存 |
| 色 | `lib/dictionaries/color.ts`(15 種) | ✅ 既存 |
| シルエット | `lib/dictionaries/line.ts`(10 種) | ✅ 既存 |
| ライン | 同上(line.ts) | ✅ 既存 |
| カット | なし | ★ 新規 |
| 重量 | なし(`line.ts` で部分言及)| ★ 新規 |
| 構造 | なし | ★ 新規 |
| 調和 | なし | ★ 新規 |
| 機能 | なし | ★ 新規 |
| テーマ | なし | ★ 新規 |

→ ★ **5/11 は dictionary 既存**(A-10 で stylist-chat に注入済)・6/11 は新規概念。

### 2.6 アクセサリーの既存扱い

[`lib/prompts/stylist-chat.ts`](../lib/prompts/stylist-chat.ts) 全体検索結果:
- アクセサリー / 時計 / カラコン / 髪型 ★ **言及ゼロ**

→ ★ 現状のコーデ提案は **服のみ**(アウター/トップス/ボトムス/シューズ/小物)前提。アクセサリーは ★ 新規領域。

---

## 3. ★ アイテム提案 × 11 項目説明 の関係整理

### 3.1 現状の応答構造

```
アウター: ○○
トップス: ○○
ボトムス: ○○
シューズ: ○○
小物: ○○

着こなしポイント: ...
```

= **アイテム名 + 簡潔な着こなしポイント**(2-4 文程度)

### 3.2 オーナー要望の応答構造(11 項目 + アクセサリー)

```
[アイテム提案]
アウター: ○○
トップス: ○○
ボトムス: ○○
シューズ: ○○
アクセサリー: 時計 ○○ / ネックレス ○○
ヘアスタイル: ○○
メイク: ○○

[11 項目説明]
- 比率: ...
- 素材: ...
- 色: ...
- カット: ...
- シルエット: ...
- ライン: ...
- 重量: ...
- 構造: ...
- 調和: ...
- 機能: ...
- テーマ: ...
```

= **アイテム提案(★ 拡張)+ 11 項目で「なぜ・どう」を説明**

→ ★ **アイテム = What / 11 項目 = Why & How** の階層構造。

### 3.3 出力規模見積もり

| セクション | 想定文字数 |
|---|---|
| アイテム提案(7-8 種類) | 200-300 字 |
| 11 項目説明(各 30-50 字)| 350-550 字 |
| ★ **合計** | **550-850 字**(★ tokens: ~700-1300)|

→ ★ 段階 B maxTokens 400(~250 字)では ★ **完全に不足**(現状の途中切れも納得)。

---

## 4. ★ 影響範囲分析(★ 重要)

### 4.1 coordinate intent の全経路

stylist-chat の coordinate 経路は ★ **全 coordinate 経路で共通**:

| ユーザー操作 | 経路 |
|---|---|
| 「コーデ提案して」 | 段階 A → coordinate → stylist-chat |
| 「黒系で印象残るコーデ」 | 同上 |
| ★ MB → 「このムードボードで撮影する」 | 同上(本セッションで配線)|

→ ★ 段階 B coordinate prompt 改訂は ★ **全 coordinate ユーザーに影響**(MB 由来だけでなく)。

### 4.2 リグレッション 399 PASS への影響評価

`scripts/test-stylist-chat-continuity.ts`(399 PASS):
- L4-A 切替検出 / 5 intent 五角 / 入口 sanitize / 出口フィルタ / dictionaries 出力 等をテスト
- ★ **応答本文の構造はテストしない**(LLM 出力は非決定的なため検証外)

→ ★ **maxTokens 拡大・prompt 改訂は 399 PASS に直接影響なし**(coordinate fetcher / 三重防御は不変のため)。

### 4.3 既存 5 intent 短文応答への影響

- diagnose / closet / style-consult / brand-learn は ★ 短文応答前提(良い例 1-9 で確認)
- maxTokens 拡大は ★ 必要分しか生成しない(LLM は prompt に従う)= 短文 intent は引き続き短文応答
- ただし system prompt の「1 返答 = 2-4 文」を強化したい場合 = ★ 別途調整

### 4.4 コスト影響

- Haiku 4.5 output: ~$1.25/1M tokens
- 400 → 2048 tokens(5x): 1 reply あたり最大 ~$0.0025(現状 ~$0.0005)→ ★ 微増
- LLM は必要分しか生成しない = ★ 短文 intent は引き続き低コスト
- MVP 検証期は誤差(コスト試算 `985d00b` 範囲内)

---

## 5. ★ 修正方針案 1-4 比較

### 5.1 案 1: 段階 B maxTokens のみ拡大(★ 最小)

| 観点 | 内容 |
|---|---|
| 変更 | `MAX_REPLY_TOKENS: 400 → 2048` のみ |
| 規模 | +1 -1(数値変更)|
| 効果 | 途中切れ解消のみ |
| 11 項目 / アクセサリー | ★ 未対応 |
| サーバー側 | あり(stylist-chat route)|
| リグレッション影響 | なし |

### 5.2 案 2: maxTokens + 11 項目 + アクセサリー(全 coordinate 改訂)

| 観点 | 内容 |
|---|---|
| 変更 | maxTokens + system prompt に 11 項目構造 + アクセサリー指示 |
| 規模 | +30-50 行(prompt 拡張)|
| 効果 | 3 desires 全達成 |
| 全 coordinate 影響 | ★ あり(通常 coordinate も 11 項目で応答化)|
| サーバー側 | あり(prompt + route)|
| リグレッション影響 | 399 PASS は OK・LLM 出力スタイル変化 |
| リスク | 通常 coordinate ユーザーが「2-4 文を期待」している場合に違和感 |

### 5.3 案 3: MB 由来のみ 11 項目(クライアント側)

| 観点 | 内容 |
|---|---|
| 変更 | maxTokens 拡大(サーバー)+ buildMoodboardPrompt に 11 項目 + アクセサリー指示(クライアント)|
| 規模 | maxTokens +1 / buildMoodboardPrompt +10-15 行 |
| 効果 | MB 由来は 11 項目 + アクセサリー / 通常 coordinate は短文(既存)|
| 全 coordinate 影響 | ★ MB 由来のみ(★ 通常 coordinate は不変)|
| サーバー側 | maxTokens のみ |
| リグレッション影響 | なし |
| リスク | 最小 |
| ★ ユーザー体験 | ★ MB 経由は詳細・通常は簡潔 = ★ 自然な使い分け |

### 5.4 案 4: 段階分割(★ 推奨)

| 段階 | 内容 | 規模 |
|---|---|---|
| **Step 1**(本セッション)| 段階 B maxTokens 400 → 2048 | +1 -1 |
| **Step 2**(本セッション)| buildMoodboardPrompt に 11 項目 + アクセサリー指示(MB 由来のみ)| +10-15 行 |
| Step 3(将来 Sprint)| 段階 B coordinate prompt 改訂(全 coordinate に 11 項目 適用)| MVP-2 期検討 |

★ Step 1 + 2 = ★ オーナー 3 desires 全達成(★ 通常 coordinate 退行なし)
★ Step 3 = 将来全体 11 項目化(★ ユーザーフィードバック蓄積後)

---

## 6. ★ ★ ★ 推奨案: 案 4(段階分割・★ Step 1 + Step 2 を本セッションで実施)

### 6.1 推奨理由(★ 5 件)

1. ★ **オーナー 3 desires 全達成**(途中切れ + 11 項目 + アクセサリー)
2. ★ **通常 coordinate 退行なし**(MB 由来のみ 11 項目化)
3. ★ **サーバー側変更は maxTokens 1 行のみ**(prompt 構造変更なし)
4. ★ **リグレッション 399 PASS 維持**
5. ★ **将来 Step 3 で全 coordinate 11 項目化への移行余地**(ユーザーフィードバック後)

### 6.2 具体的実装計画(★ 別工程)

#### Step 1: 段階 B maxTokens 拡大

```typescript
// app/api/ai/stylist-chat/route.ts L66
const MAX_REPLY_TOKENS = 2048;  // 旧: 400(MVP-1c 当時の短文設定)
```

★ コメント: 「Sprint C-3 hotfix: MB → coordinate 連鎖で 11 項目 + アクセサリー詳細応答に対応するため 400→2048 へ拡大(短文 intent は引き続き必要分しか生成しない)」

#### Step 2: buildMoodboardPrompt に 11 項目 + アクセサリー指示追加

```typescript
// lib/prompts/moodboard-prompt.ts の冒頭直後に追加

lines.push("以下の世界観・参考画像から、アウター・トップス・ボトムス・シューズ・アクセサリー(時計・カラコン・髪型・ピアス・ネックレス等)の具体的な組み合わせを文章で提案してください。");
lines.push("(試着シミュレーションや概念翻訳ではなく、日常的なコーディネート提案です。)");
lines.push("");
lines.push("【応答形式の希望】");
lines.push("[アイテム提案] アウター / トップス / ボトムス / シューズ / アクセサリー / ヘア / メイク を各 1 行で具体的に");
lines.push("[11 項目説明] 比率 / 素材 / 色 / カット / シルエット / ライン / 重量 / 構造 / 調和 / 機能 / テーマ を各 1 行で簡潔に説明");
lines.push("");
```

### 6.3 規模

- Step 1: `app/api/ai/stylist-chat/route.ts` = **+1 -1 行**(数値変更)
- Step 2: `lib/prompts/moodboard-prompt.ts` = **+10-15 行**(指示追加・冒頭)
- ★ 合計: **+11-16 行 / -1 行 / 15-25 分**

### 6.4 検証

1. tsc EXIT 0
2. 399 PASS 維持
3. オーナー実機 verify:
   - MB → 「このムードボードで撮影する」→ ChatPage
   - 送信 → coordinate LLM 応答
   - ★ 期待: アイテム提案(アクセサリー含)+ 11 項目説明(★ 途中切れなし)
   - 通常 coordinate「コーデ提案して」→ 既存通り短文応答(★ 退行なし)

---

## 7. ★ 既存達成への影響評価(★ コード 0 変更・全保持)

| 達成項目 | 想定影響 |
|---|---|
| 1.5b 完成形 / race fix v2 / L4-A / A-2 / A-3 / MVP-1c / A-4 / A-10 / A-6 / A-6b / A-5 / A-9 / Sprint B-1〜C-4 / v4 / hotfix / intent 修正 4 commits | **0**(コード 0 変更)|
| リグレッションテスト | **399 PASS 維持** |
| 既存 5 intent reply 経路 | **0** |
| 既存 21 intent overlay-intent | **0** |
| 本体 `ac834bb` 6 章 / 7 章 / 判断 6 | **diff 0 行** |
| 本体 / doc7 / 最終ビジョン / 整合性点検 / ロードマップ / コスト試算 / 各設計案 | **diff 0 行** |
| 既存設計判断 1-10 | **文言不変** |

---

## 8. 結論

| 観点 | 結論 |
|---|---|
| ★ 真の原因 | ★ 段階 B `MAX_REPLY_TOKENS = 400`(MVP-1c 当時の短文設定)が現状の 11 項目 + アクセサリー詳細応答に追いついていない |
| ★ 推奨案 | ★ **案 4 段階分割**(Step 1: maxTokens 400→2048 / Step 2: buildMoodboardPrompt に 11 項目 + アクセサリー指示 / Step 3: 将来 Sprint で全 coordinate 11 項目化) |
| 修正規模 | ★ Step 1+2 = **+11-16 行 / -1 行 / 15-25 分**(別工程)|
| 修正後の効果 | オーナー 3 desires 全達成 + 通常 coordinate 退行なし |
| サーバー側影響 | ★ maxTokens 1 行のみ(prompt 構造変更なし)|
| クライアント側影響 | ★ buildMoodboardPrompt のみ(★ 通常 coordinate は不変)|
| リグレッション 399 PASS | ★ 維持(coordinate fetcher / 三重防御 不変)|
| コスト影響 | 微増(Haiku 安価・LLM は必要分しか生成しない)|
| 既存達成保持 | コード 0 変更で **全保持** |
| 不可侵 | 本体 6 章 / 7 章 / 判断 6 / コスト試算 / 整合性点検 / ロードマップ / 各設計案 / 既存設計判断 1-10 ★ **全不変** |
| ★ 次工程 | 本 commit(調査 doc 1 件)→ オーナー判断 → Step 1+2 実装(別 commit・+11-16 行 / 15-25 分)→ オーナー実機 verify |

→ ★ **段階 B coordinate 応答品質改善 青写真完遂**(MVP リリース前最後の応答品質改善)

---

## 9. 制約遵守チェックリスト

- [x] 新規 docs ファイル 1 件のみ(本 doc)
- [x] 本体 `ac834bb` / コード(app/api/lib/scripts/package.json/tsconfig.json)/ doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` / 各設計案 / 他 docs **全 0 変更**
- [x] 本体 6 章 / 7 章 / 判断 6 diff 0 行
- [x] 既存設計判断 1-10 文言不変
- [x] view + grep + 静的解析のみ・実装なし
- [x] tsc EXIT 0 維持(本 doc は markdown のみ・コード 0 変更)
- [x] リグレッションテスト 399 PASS 維持(本工程はコード 0 変更)
- [x] 実装は ★ 別工程(本 doc では実施しない)
- [x] commit はあり / push はなし
