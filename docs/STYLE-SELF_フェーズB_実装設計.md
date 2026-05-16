# STYLE-SELF フェーズB 実装設計

作成日: 2026-05-16
対象: STYLE-SELF / analyze-v2 の本番化(8パターン → AI自由構築への切替)
ステータス: 設計確定。この順序で実装する。
前提: フェーズA完了(analyze-v2 動作・3パターン検証済み・P2レイテンシ改善済み)

---

## 0. フェーズB の本質(調査で判明)

```
誤解していたこと:
  「8パターン廃止 = 大規模な切替作業」

実際:
  切替の核心は /onboarding の fetch URL 1行だけ
  大半は「切替の前準備」(UI新形式対応・商品マッチング配線)
  最大の地雷は worldview_profiles.pattern_id NOT NULL
```

フェーズB の本質的作業は2つ:
1. DiagnosisDisplay を新形式(13項目)に対応させる
2. 商品マッチングを worldview_tags 経由で配線する

---

## 1. 最重要: 隠れていた地雷

```
worldview_profiles テーブル:
  pattern_id text NOT NULL  ← analyze-v2 は null を入れようとして失敗
  
現状: try/catch で握りつぶされ、DB保存が黙って失敗していた
影響: フェーズAのテストは動作したが、診断結果が永続化されていない
対応: 切替前に必ず migration で nullable 化(Step 1)
```

これを直さずに切り替えると、本番ユーザーの診断結果が保存されない致命的バグになる。フェーズB の Step 1 は絶対にこれ。

---

## 2. 実装ステップ(7段階・低リスク→高リスク順)

### Step 1: DBスキーマ migration 🟢 (15分)

```
目的: analyze-v2 の DB保存を本当に動かす
作業:
  - worldview_profiles.pattern_id を NOT NULL → nullable
  - pattern_name も NOT NULL を緩める(analyze-v2 は worldviewName を
    入れているので緊急性低だが、念のため)
  - migration ファイル新規(021_diagnosis_v2_nullable.sql 想定)
リスク: 極小(既存データに影響なし・カラム制約を緩めるだけ)
確認: analyze-v2 を実行 → worldview_profiles に行が実際に保存されるか
```

### Step 2: DiagnosisDisplay の新形式対応 🟢 (2〜3時間)

```
目的: 13項目を全部表示できるようにする(フェーズB最大の作業)
現状: worldviewName / unconsciousTendency / idealSelf /
       culturalAffinities / firstPiece は表示OK
追加が必要な4セクション:
  - recommendedAccessories(13項目の9番・小物)
  - recommendedBrands(10番・ブランド)
  - culturalAffinities.art(11番・アート)
  - relatedInfluencers(13番・近い世界観の人)
制約:
  - 過去診断(patternId 有り)でも壊れないよう既存セクションは温存
  - patternId が無いと clothingRole が欠落するので、
    worldview_keywords 等で代替表示
リスク: 小(表示の追加・既存を壊さない)
確認: analyze-v2 の結果が13項目すべて画面に出るか
```

### Step 3: InspirationView / CultureView の patternId 依存解消 🟡 (1〜2時間)

```
目的: /discover の2機能が新形式で壊れないようにする
InspirationView:
  - 現状 getConceptsForPattern(patternId) → patternId無しで [] になり
    抽象語チップが完全に消える
  - worldview_keywords ベースに置き換え
CultureView:
  - 現状 patternId を localStorage キャッシュキーに使用
  - patternId無しでキャッシュ機構が無効化
  - キャッシュキーを worldviewName または
    worldview_keywords.join() ベースに変更
リスク: 中(既存の発見系UIに触る)
確認: /discover の両タブが新形式診断後も機能するか
```

### Step 4: 商品マッチング配線 🟡 (1〜2時間)

```
目的: 「あなたに合う商品」をユーザーの世界観から出す
現状:
  - product-match.ts は変更不要(conceptKeywords を受ける汎用設計)
  - analyze-v2 は worldview_tags を出力済み(案X実装済み)
  - 足りないのは「配線」だけ
作業:
  - users.style_analysis.worldview_tags を読んで
    /api/products/match に conceptKeywords として渡す経路を新設
  - 「あなたに合う商品」UI をどこに置くか決める(/home or /self)
  - product-match.ts 自体は絶対に触らない
リスク: 中(新しいUI導線・既存ロジックは保護)
確認: 診断後に世界観に合った商品が表示されるか
判断ポイント: UI をどこに置くか(設計時にオーナーと相談)
```

### Step 5: 切替 🔴 (15分・最重要の節目)

```
目的: 本番の新規診断を全部 analyze-v2 にする
作業:
  - /api/ai/analyze を /api/ai/analyze-legacy にリネーム(保険で残す)
  - analyze-v2 を /api/ai/analyze に昇格
    (または /onboarding の fetch URL を analyze-v2 に変更)
  - この1行が「8パターン時代の終わり」
リスク: 高(本番の診断が全部切り替わる)
        ただし Step1〜4 が済んでいれば実際のリスクは小さい
確認: /onboarding で実際に診断 → 13項目表示 → DB保存 → 商品表示
      の全フローが通るか
前提: Step 1〜4 が全部完了していること(順序厳守)
```

### Step 6: ストリーミング 🟡 (半日〜1日・レイテンシの本命)

```
目的: step4(92秒)の体感を改善する
2つのアプローチ:
  案α: 擬似ストリーミング(複雑度:低・体感:中)
    - step1完了時点で worldview_name + 影響源を先に返す
    - 残り13項目は別fetch
    - JSON parse 問題を回避できる
  案β: フィールド単位ストリーミング(複雑度:中・体感:大)
    - Anthropic SDK の messages.stream() で受信
    - 13項目を1つずつ画面に出す
    - 「自分が解き明かされていく」体験(ビジョンに合致)
推奨: まず案αを試す → 物足りなければ案βを追加
リスク: 中(新規technical実装・エラーハンドリング設計必要)
確認: 体感的に「待たされ感」が減るか
注意: Vercel timeout(maxDuration=60)との兼ね合い・
      time to first token の確認が必要
```

### Step 7: フェーズC(旧コード削除) 🟢 (1時間)

```
目的: 8パターン時代の遺産を完全に削除
作業:
  - analyze-legacy 削除
  - worldview-patterns.ts 削除
  - matchWorldview / applyPatternToResult 削除
  - WorldviewPattern 型削除
  - patternId? は過去診断互換のため optional で残してOK
前提: 切替後3〜7日、本番でエラーが出ないことを監視してから
リスク: 小(監視期間を経ていれば安全)
```

---

## 3. 各ステップの依存関係

```
Step 1(migration)
  ↓ これが無いと保存が壊れる。最初に必須。
Step 2(UI新形式対応)
  ↓ これが無いと切替後に13項目が表示されない
Step 3(discover依存解消)  Step 4(商品配線)
  ↓ 並行可能。両方とも切替前に必要。
Step 5(切替)← Step 1〜4 全部完了が前提
  ↓ 本番が新形式に
Step 6(ストリーミング)← 切替後でないと意味が薄い
  ↓ レイテンシ体感改善
Step 7(旧コード削除)← 切替後3〜7日の監視を経て
```

順序厳守。特に Step 5(切替)は Step 1〜4 が全部終わってから。

---

## 4. セッション分割の見込み

フェーズB は1セッションで終わらない。想定:

```
セッションX(今日含む): Step 1 + Step 2
  = migration + DiagnosisDisplay 新形式対応
  = 「13項目が画面に出る」状態まで

セッションY: Step 3 + Step 4
  = discover依存解消 + 商品配線
  = 「切替の準備が全部整う」状態まで

セッションZ: Step 5 + Step 6
  = 切替 + ストリーミング
  = 「本番が新形式・体感も改善」状態まで

セッションW(数日後): Step 7
  = 監視期間を経て旧コード削除
```

---

## 5. リスクと緩和

| リスク | 緩和策 |
|--------|--------|
| pattern_id NOT NULL の見落とし | Step 1 を最初に必ずやる。これがフェーズB の絶対条件 |
| 切替後に過去診断が壊れる | patternId? を optional で残す。既存セクション温存 |
| UI が13項目に対応できてない状態で切替 | Step 5 は Step 2 完了が絶対前提。順序厳守 |
| ストリーミングの技術的複雑さ | まず案α(擬似)で試す。案βは物足りなければ |
| 商品マッチングが壊れる | product-match.ts は触らない。配線だけ追加 |
| Vercel timeout | ストリーミング実装時に time to first token を計測 |

---

## 6. 今日のスコープ

```
今日: Step 1 + Step 2 を目標

Step 1: DBスキーマ migration(15分)
  → analyze-v2 の保存が本当に動くようになる

Step 2: DiagnosisDisplay の新形式対応(2〜3時間)
  → 13項目すべてが画面に表示される
  → フェーズB の最大の作業
  → これができると analyze-v2 の品質を「画面で」見られる

Step 1 が早く終わるので、Step 2 にしっかり時間を使う。
Step 2 が今日中に終わらなければ、途中まででも次回に繋げる。
```

---

## 7. このドキュメントの位置づけ

```
STYLE-SELF 再設計の設計ドキュメント群:

1. STYLE-SELF_診断システム_再設計.md(既存)
   = なぜ8パターンを廃止するか・アプローチ2の思想

2. STYLE-SELF_フェーズB_実装設計.md(このファイル)
   = どの順で本番化するか・7ステップの地図
```

Knowledge OS 再設計が「ビジョン達成マップ → 再設計 → 初期カテゴリ構成」の
3点セットで5ステップ成功したのと同じ型。フェーズB もこの地図に沿って
ステップ分割で進める。
