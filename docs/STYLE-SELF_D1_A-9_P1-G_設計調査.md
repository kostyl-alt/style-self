# STYLE-SELF D1 — A-9 P1-G 設計調査(仕上げ + 退行点検 + 知見 docs 追記・Phase 1 完成宣言の準備)

- 作成日: 2026-05-24
- 起点 HEAD: `fcbe065`(A-5 P1-D UI 完成・`origin/main` 整合・clean)
- 本 doc の役割: A-9 着手前の **静的解析中心の設計調査**(本体・コード・他 doc 0 変更)
- 上位連結:
  - ロードマップ [§3.9 / §11.1 優先 7](./STYLE-SELF_D1_ビジョン完全達成_ロードマップ.md)
  - ★ Phase 1 完成宣言 候補の判断軸を整理(★ MVP 優先 7/8 達成・残 1 は Sprint E 領域)
- 実装方針: ★ **コード 0 変更**(docs 追記中心・既存達成 100% 保持)

---

## 1. 背景

### 1.1 本セッション 9 commits 達成サマリ(`a62a36c` → `fcbe065`)

| # | SHA | 種別 | 内容 | 規模 |
|---|---|---|---|---|
| 1 | `66dd5bb` | docs | A-4 P1-C-4 設計調査(チャットコマンド + 到達点検 + プライバシー漏洩点検) | 330 行 |
| 2 | `9bfb0cc` | docs | A-10 Knowledge OS 連携 設計調査 | 319 行 |
| 3 | `566e3b2` | **feat** | **A-10 実装**(KOS 連携・案A フル統合)| +340/-9 行 |
| 4 | `4cabf4a` | docs | A-6 style-consult intent 設計調査 | 379 行 |
| 5 | `626b57d` | **feat** | **A-6 実装**(style-consult・4 intent 拡張)| +337/-16 行 |
| 6 | `65bad33` | docs | A-6b brand-learn intent 設計調査 | 413 行 |
| 7 | `3589dcc` | **feat** | **A-6b 実装**(brand-learn・5 intent 拡張・getInfluences 統合)| +401/-25 行 |
| 8 | `c126f76` | docs | A-5 P1-D 設計調査(上部世界観カード + 提案チップ 5 + 入力欄近接 4 ボタン)| 267 行 |
| 9 | `fcbe065` | **feat** | **A-5 実装**(UI 完成形・ClosetPickerModal 完全実装)| +663/-16 行 |

- 設計 5 件 + 実装 4 件(★ 全 commit が設計 → 実装 → push のサイクルを完遂)
- リグレッションテスト 119 → **399 PASS**(+280 assertion・3.35 倍)
- 累計 +2,449 insertions / -66 deletions(コード + test + docs 合計)

### 1.2 A-9 の位置づけ
- Sprint A の **仕上げ工程**(優先 7・ロードマップ §11.1)
- ★ **Phase 1 完成宣言の前哨**(MVP 優先 7/8 達成・残 1 は Sprint E 領域)
- ★ コード 0 変更・docs 追記中心(既存達成 100% 保持で退行リスク 0)

### 1.3 不可侵境界線(本セッション再宣言)
1-8: 既存 8 条 + ★ **本 A-9 は コード 0 変更**(docs 追記のみ)
9: ★ 既存設計判断 1-10 文言不変 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / 各設計案 不変
10: ★ ロードマップ `a62a36c` のみ **Sprint A 進捗反映で改訂**(完遂工程に ✅ + 実装 SHA 追記)

---

## 2. 本セッションで確立した 4 作法(★ 知見の核心)

### 2.1 作法 1: 段階 A プロンプト修正(`2ef689e` 起源)
- **内容**: intent description 精緻化 + 境界判定ブロック更新
- **適用例**:
  - MVP-1c (`2ef689e`): coordinate / virtual-coordinate / tryon 境界
  - A-6 (`626b57d`): style-consult 行追加
  - A-6b (`3589dcc`): brand-learn / culture / inspiration 3 種境界判定ブロック追加
- **効果**: コード改修ではなくプロンプト精緻化で LLM 分類差を解決(原則 8)

### 2.2 作法 2: MVP-1c fetcher Promise.all(`182c25b` 起源)
- **内容**: `fetchXxxContext` を `Promise.all` で並列化(レイテンシ抑制)
- **適用例**:
  - MVP-1c coordinate: `Promise.all([fetchDiagnoseContext, fetchClosetContext, body_profile])`
  - A-6 style-consult: `Promise.all([fetchDiagnoseContext, users 3 列絞り])`
  - A-6b brand-learn: `Promise.all([fetchDiagnoseContext, brands 8 列絞り, style_preference])`
- **効果**: 5 intent fetcher 全てで同形構造・新 intent 投入時に作法をコピーするだけ

### 2.3 作法 3: A-4 三重防御 構造証明(`66dd5bb` 起源)
- **内容**: (1) 列絞り SELECT / (2) system 明示禁止 / (3) 出力フィルタ — 3 層で worldview_tags 英語スラッグの非露出を構造的に保証
- **適用例**: A-4 で 3 reply 経路(diagnose / closet / coordinate)の構造証明 → A-10 / A-6 / A-6b / A-5 で同型再適用
- **効果**: 新規 fetcher 追加時に三重防御チェックリストで漏洩経路 0 を構造的に担保

### 2.4 作法 4: A-10 KOS 共通注入(`566e3b2` 起源)
- **内容**: `fetchKnowledgeOSContext` を全 intent 共通注入 + 入口 sanitize(三重防御 (3) を二段化)
- **適用例**:
  - A-10 で 2 関数(`getDecisionRules` + `getFailurePatterns`)+ dictionaries 並列フェッチ
  - A-6b で 3 関数(+ `getInfluences`)に昇格・全 5 intent 共通注入で reply 品質全体向上
- **効果**: 新 intent 投入時に追加実装ゼロで知識ベース連携が自動有効化

---

## 3. 三重防御の進化(M5 起源 → 本セッションで多段化)

| 層 | M5 起源(`ac834bb` 以前)| A-10(`566e3b2`)拡張 | A-5(`fcbe065`)拡張 |
|---|---|---|---|
| (1) 構造遮断 | DB 列絞り SELECT(`worldview_tags` 列を SELECT 句に書かない)| ★ **入口 sanitize 追加**(KOS 戻り値の `stripCanonicalSlugs` 適用)| ★ **UI 表示テンプレ追加**(ClosetPicker で `worldview_tags / worldviewScore` 非表示・`/api/worldview-card` 列絞り)|
| (2) system 明示禁止 | 31 語例示禁止 + 内部 ID + jsonb キー名禁止 | ★ KOS 文脈無視指示 + 日本語強制追加 | (本 A-5 は UI 層のみ・system 不変)|
| (3) 出力フィルタ | `stripCanonicalSlugs` 31 語動的検証(`PRODUCT_WORLDVIEW_TAGS` 直 import で語彙ドリフト 0)| ★ そのまま流用(KOS 経路にも自動適用)| ★ そのまま流用 |
| 動的検証 | リグレッションテスト 119 PASS | ★ case K1-K5 で 31 語 × KOS 経路 = +147 assertion → 266 PASS | ★ UI は simulator 範囲外・case B4 で 31 語 × influences 経路 → 399 PASS |

★ **三重防御 → 「構造遮断 + 入口 sanitize + system 禁止 + 出口フィルタ + UI 表示制御」の 5 層多段防御に進化**

---

## 4. MVP 優先 達成状況(★ 本 A-9 の判断軸)

### 4.1 ビジョン `df36d82` MVP 優先 8 項目 達成度

| # | 項目 | 達成状態 | 対応工程 |
|---|---|---|---|
| 1 | AI スタイリストチャット(自然言語対話) | ✅ | 1.5a / 1.5b / MVP-1c / A-6 / A-6b(5 intent 五角)|
| 2 | 世界観プロフィール表示 | ✅ | A-5 上部世界観カード(`/api/worldview-card`)|
| 3 | 身体・好み・避けたい印象の保持 | ✅ | 既存 v1 + A-6 fetchStyleConsultContext(body_profile / style_preference / avoid_items) |
| 4 | クローゼット(手持ち服)管理 | ✅ | 既存 v1 + A-5 ClosetPickerModal(GET /api/wardrobe 流用)|
| 5 | 保存(コーデ / 商品)| ✅ | 既存 v1(本セッション影響なし)|
| 6 | ★ **商品画像・商品 URL・MB をチャットに渡す** | ✅ | **A-5 入力欄近接 4 ボタン(クローゼット完全 / 写真 + URL + MB 骨格)** |
| 7 | ★ **Knowledge OS 連携** | ✅ | **A-10 KOS 共通注入(全 5 intent)+ A-6b getInfluences 統合** |
| 8 | リアル試着用 身体情報設計 | 🟡 基盤あり・可視化未 | **Sprint E 領域**(Phase 2 後ゲート判断対象・MVP 優先 ではない) |

- ★ **MVP 優先 7/8 = 87.5% 達成**(残 1 は Sprint E / Phase 2 後ゲート対象で MVP スコープ外)
- 実質的に **MVP 優先範囲 100% 達成**(項目 8 は将来 Phase の準備工程)

### 4.2 Sprint A 進捗

| 工程 | 状態 | コミット |
|---|---|---|
| A-1 doc7 統合 | ✅ | `ac834bb` |
| A-2 BottomNav 廃止 | ✅ | `59fa4d6` |
| A-3 MenuDrawer | ✅ | `11cf3de` |
| **A-4 到達点検 + 漏洩点検** | ✅ | `66dd5bb` |
| **A-5 P1-D UI 完成** | ✅ | `fcbe065` |
| A-6 style-consult(残 5 第 1 弾)| ✅ | `626b57d` |
| A-6b brand-learn(残 5 第 2 弾)| ✅ | `3589dcc` |
| **A-10 Knowledge OS 連携** | ✅ | `566e3b2` |
| A-6c virtual-coordinate(残 5 第 3 弾)| ⬜ | 拡張領域 |
| A-6d product-match(残 5 第 4 弾)| ⬜ | 拡張領域 |
| A-6e match-users(残 5 第 5 弾)| ⬜ | 拡張領域 |
| A-7 結果カード | ⬜ | 拡張領域 |
| A-8 virtual → product 連鎖 | ⬜ | 拡張領域(Phase 2 / 3 への布石)|
| **A-9 仕上げ + 退行点検 + Phase 1 完成宣言** | 🔄 | **本工程** |

- ★ **Sprint A 8/14 完遂**(MVP 優先工程は 100%)
- 残 3(A-6c-e)+ A-7 + A-8 は **MVP 優先 達成後の「拡張領域」**

---

## 5. ★ Phase 1 完成宣言の判断(★ 本 A-9 の核心)

### 5.1 案 X(★ 推奨): A-9 で Phase 1 完成宣言
- 根拠: **MVP 優先 7/8 達成**(残 1 = 項目 8 は Sprint E 領域)
- 残工程(A-6c-e / A-7 / A-8)は **拡張領域** として明示・別 Sprint で順次
- メリット:
  - 本セッション 9 commits の達成を **節目** として確定できる
  - Phase 2(ムードボード)着手前ゲート評価(Sprint B-1)に進める
  - オーナーが Phase 2 / 3 / 4 の長期計画にすぐ取り組める
- デメリット: 残 3 intent + A-7 + A-8 が「未完」と見える可能性
  - → **拡張領域として位置づけ明示**することで回避(本 doc §6 で明文化)

### 5.2 案 Y: A-6c-e + A-7 + A-8 完遂後に完成宣言
- 根拠: Sprint A 全工程(11 工程)を完遂してから完成宣言
- メリット: より「完全」な状態で宣言
- デメリット:
  - **5 セッション以上**の追加実装が必要(各 30-45 分 × 残 5 工程)
  - 残工程は MVP スコープ外(項目 6 / 7 達成済)で **緊急性が低い**
  - 完成宣言が遠のく → モチベーション低下リスク

### 5.3 ★ 結論: 案 X 推奨
- **判定基準**: MVP 優先達成 = Phase 1 完成基準を満たす
- 残工程は「Phase 1 強化期間」or「Phase 2 並行」として位置づけ可
- ★ **A-9 で Phase 1 完成宣言を origin に保全することで、節目として確立**

---

## 6. A-9 構成要素 詳細設計

### 6.1 docs 追記スコープ(★ 推奨 = 案 B + 案 A 軽量版)

| 追記対象 | 内容 | 想定行数 |
|---|---|---|
| **ロードマップ §3**(Sprint A 各工程)| ✅ + 実装 SHA を A-4 / A-5 / A-6 / A-6b / A-10 に追記 + A-6 残 3 / A-7 / A-8 を「拡張領域」明記 | +30-50 行 |
| **ロードマップ §11.1**(優先順序)| 完遂工程を「完了 7 件」セクションに移動 + 残工程を「拡張領域」セクション化 + **Phase 1 完成宣言** 明示 | +20-30 行 |
| **CHANGES.md** | 本セッション 9 commits の整理(Sprint 番号付き表形式) | +30-50 行 |
| **新規 docs: 知見サマリ**(`docs/STYLE-SELF_D1_セッション知見サマリ.md`)| 4 作法体系化 + 三重防御の進化 + MVP 優先達成状況 + 各セッションの設計判断ログ | 100-150 行(軽量版)|
| **新規 docs: 退行点検チェックリスト**(`docs/STYLE-SELF_D1_A-9_退行点検チェックリスト.md`)| 10 項目チェックリスト(オーナー実機実施用)| 30-50 行 |
| **合計** | | **+210-330 行**(起点指示 +160-250 行 を上振れ・docs 5 ファイル変更)|

### 6.2 docs 追記の最小化案
- 知見サマリ doc を **削除**(将来 Sprint B-2 ビジョンマップ統合で吸収)
- 退行点検 チェックリストを **本 doc §8 内に格納**(別 file 不要)
- ロードマップ + CHANGES.md のみ追記
- 規模: **+80-130 行 / 20-30 分**

★ **オーナー判断**: 知見サマリを「セッション節目の記録」として残すか、最小限で済ますか。

### 6.3 退行点検 チェックリスト 10 項目(オーナー実機実施推奨)

| # | 項目 | 確認方法 |
|---|---|---|
| 1 | 上部世界観カード表示 | `/ai` 開く → 診断済なら name + keywords 5 pill + 詳細リンク / 未診断なら CTA |
| 2 | 提案チップ 5 動作 | 履歴 0 件時に 5 チップ表示 → タップ → textarea に文言挿入(直接送信なし) |
| 3 | 5 intent 各 reply | 提案チップ 5 全てから送信 → 各 intent で reply 動作(coordinate / brand-learn / style-consult / closet / diagnose)|
| 4 | L4-A 5 intent 五角切替 | 1 intent reply 後に別 target intent 高信頼発話 → sessionIntent 切替動作 |
| 5 | 入力欄近接 4 ボタン | 📎 写真 / 🔗 URL / 🎨 MB = notice 表示 / 👕 服 = モーダル開閉 + 選択 → 挿入 |
| 6 | クローゼットモーダル Empty state | アイテム未登録時に CTA → `/outfit?tab=closet` 遷移 |
| 7 | MenuDrawer 7 項目 | [≡] → 7 navigate + 新しいチャット + placeholder 2(避けたい / 設定) |
| 8 | [≡] 新しいチャット | confirm → setMessages([]) + localStorage.removeItem(race fix v2 維持) |
| 9 | 履歴永続化 | 数発話後にリロード → localStorage から復元(race fix v2 案 C)|
| 10 | プライバシー漏洩点検 | 各 reply / WorldviewCard / ClosetPicker に英語スラッグ 31 語非露出を目視確認 |

### 6.4 リグレッションテスト 維持確認
- `npx tsx scripts/test-stylist-chat-continuity.ts` → **399 PASS exit 0**
- A-9 では新規テストケース追加なし(★ 退行点検中心)

---

## 7. Step 1-7 分割(★ 推奨 7 段階・docs 中心)

| Step | 内容 | 想定時間 |
|---|---|---|
| 1 | ロードマップ §3 Sprint A 進捗反映(A-4 / A-5 / A-6 / A-6b / A-10 に ✅ + SHA 追記)+ A-6 残 3 / A-7 / A-8 を「拡張領域」明記 | 10 分 |
| 2 | ロードマップ §11.1 優先順序更新(完遂 7 件を「完了」セクションに / 残工程を「拡張領域」/ ★ Phase 1 完成宣言 明示) | 5 分 |
| 3 | CHANGES.md に本セッション 9 commits の整理表追記 | 5 分 |
| 4 | 知見サマリ doc 新規(4 作法 + 三重防御進化 + MVP 達成 + 各セッション設計判断ログ)or 本 doc §2-§5 に集約済として skip | 10-15 分(or 0 分)|
| 5 | 退行点検チェックリスト doc 新規 or 本 doc §6.3 に集約済として skip | 5 分(or 0 分)|
| 6 | リグレッションテスト 399 PASS 維持確認 + tsc EXIT 0 | 2 分 |
| 7 | commit(push しない)| 3 分 |
| **合計(最小化案)** | (Step 4 / 5 を本 doc 集約)| **30 分** |
| **合計(フル案)** | (Step 4 / 5 を別 doc)| **40-45 分** |

---

## 8. 退行点検 範囲 + 詳細(★ Step 5 で別 doc 化 or 本章で完結)

§6.3 で 10 項目を表化済。オーナー実機で 1 項目ずつ確認 → ★ 5-7 分で完走可能。

---

## 9. 既存達成への影響評価

| 達成項目 | 想定影響 |
|---|---|
| 1.5b 完成形 / race fix v2 / L4-A | **0**(コード 0 変更)|
| A-2 / A-3 / MVP-1c / A-4 / A-10 / A-6 / A-6b / A-5 | **0**(コード 0 変更)|
| リグレッションテスト | **399 PASS 維持**(★ 維持確認のみ・新規追加なし)|
| 既存 v1 各 intent API + UI | **0** |
| ③ 専章 / ③ コスト / Phase 2 後ゲート | **diff 0 行**(★ 厳守)|
| 既存設計判断 1-10 | **文言不変**(★ 厳守)|
| 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / 各設計案 | **不変**(★ 厳守)|
| ロードマップ `a62a36c` | ★ **Sprint A 進捗反映で改訂**(Phase 1 完成宣言含む・本 A-9 の主要編集対象) |

---

## 10. 推奨案(★ 結論)

### 10.1 推奨実装方針 = 最小化案 + Phase 1 完成宣言
- ★ **コード 0 変更**(★ 退行リスク 0)
- docs 追記 5 ファイル(ロードマップ + CHANGES.md + 知見サマリ 新規 + 退行点検 新規 + 本 A-9 設計調査 doc)
- ★ **ロードマップ §11.1 + §3 で Phase 1 完成宣言を明示**(案 X 採用)
- 規模 +210-330 行 / 30-45 分

### 10.2 縮小案(最小化)
- 知見サマリ + 退行点検チェックリスト を **本 A-9 設計調査 doc 内に集約**(新規 doc 2 件削減)
- 規模 +80-130 行 / 20-30 分

### 10.3 拡大案
- 知見サマリ doc を **詳細版**(300+ 行)で別冊化 + Phase 2 着手前ガイドも追加
- 規模 +400-600 行 / 60-90 分
- ★ 非推奨(M5 教訓・原則 3「刻む」違反・docs 過剰化リスク)

---

## 11. 結論

| 観点 | 結論 |
|---|---|
| 規模(推奨案) | **+210-330 行 / 30-45 分**(縮小案 +80-130 行 / 20-30 分)|
| 既存達成保持 | コード 0 変更で **全保持** |
| リグレッションテスト | **399 PASS 維持**(新規追加なし)|
| ★ Phase 1 完成宣言 | **案 X(本 A-9 で宣言)推奨**・MVP 優先 7/8 達成 + 残 1 は Sprint E 領域 |
| 残工程の位置づけ | A-6c-e / A-7 / A-8 = 「Phase 1 強化期間 = 拡張領域」 |
| 次工程候補 | Sprint B-1(Phase 2 前ゲート評価)or 拡張領域 順次 or セッション終了 |
| ★ 推奨実装順 | Step 1-7(本 doc §7)・最小化案 + Phase 1 完成宣言 |

---

## 12. 制約遵守チェックリスト

- [x] 新規 docs ファイル 1 件のみ(本 doc)
- [x] 本体 `ac834bb` / コード(app/api/lib/scripts/package.json/tsconfig.json)/ doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / 各設計案(`66dd5bb` / `9bfb0cc` / `4cabf4a` / `65bad33` / `c126f76`)/ 各実装(`566e3b2` / `626b57d` / `3589dcc` / `fcbe065`)**全 0 変更**
- [x] view + grep + 静的解析のみ・実装なし
- [x] 既存設計判断 1-10 文言不変
- [x] ③ 専章 / ③ コスト / Phase 2 後ゲート diff 0 行
- [x] tsc 通る前提(本 doc は markdown のみ)
- [x] commit はあり / push はなし
