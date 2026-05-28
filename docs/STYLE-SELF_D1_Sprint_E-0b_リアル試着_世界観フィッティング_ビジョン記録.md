# STYLE-SELF D1 — Sprint E-0b リアル試着「世界観フィッティング」ビジョン記録(★ オーナー壮大ビジョン・Sprint E 統合・最終ビジョン Phase 1-4 具体化・★ 設計のみ)

- 作成日: 2026-05-28
- 起点 HEAD: `8de8217`(Sprint E-0 MB 世界観分解×三位一体推薦 ビジョン記録・origin 保全済・clean / 399 PASS / tsc EXIT 0)
- 本 doc の役割: ★ オーナー壮大ビジョン「リアル試着 = バーチャル試着ではなく **世界観フィッティング**」の **正式記録 + Sprint E との統合関係整理**(★ **コード 0 変更・実装は別工程**)
- Sprint E-0a(`8de8217`)= MB 軸・本 Sprint E-0b = 体型軸 = ★ **両軸統合で「自分専用 AI スタイリスト」完成**

---

## 1. ★ オーナービジョン verbatim 記録(★ 改変禁止)

### 1.1 核心思想

```
Meshcapade のような 3D 体型アバター生成 + ワコール SCANBE/3D smart&try のような
3D ボディ計測を参考にしつつ、★ ワコールの真似ではない:
- ワコール: 体型を知る → インナー/サイズ選び
- ★ STYLE-SELF: 体型を知る → 世界観を成立させる服・髪型・小物・商品に変換
= ★ 「その人の体型で、その世界観をどう成立させるか」
= ★ ★ 目的はバーチャル試着ではなく ★ 世界観フィッティング
```

### 1.2 目的

```
ユーザーが自分の体型を理解し、自分の世界観に合う服を、失敗少なく選べるようにする。
単なるサイズ推薦ではなく「その人の体型で、その世界観をどう成立させるか」を提案。
```

### 1.3 実装思想

```
- 写真/身長/体重/ウエスト/肩幅/股下から body_profile 作成
- 将来的に 3D アバター生成 API や SMPL 系モデル連携できる設計
- ★ MVP では完全 3D 試着ではなく ★ 体型特徴 + シルエット補正ロジック を先に
- 低身長/肩幅/胴長/脚長/腰位置/首の長さ/上半身・下半身の重心 を分析
- 診断結果の世界観 + MB 分析 を組み合わせ、似合うシルエット・丈・素材・色・靴・小物を提案
```

### 1.4 将来構想(★ 8 ステップ)

```
1. 写真または採寸値を入力
2. 自分に近い 3D アバター生成
3. 顔・髪型・体型を保存
4. 世界観診断と連携
5. ムードボード入力と連携
6. コーデをアバター上で表示
7. サイズ推薦と商品購入に接続
8. 保存・購入・違和感フィードバックを学習に使う
```

### 1.5 MVP 実装方針(★ 8 ステップ)

```
1. user_body_profiles テーブル作成
2. 身長/体重/肩幅/ウエスト/股下/首の長さ/脚の長さ感/重心/体型の悩み を保存
3. body_shape_analysis: 体型特徴を AI で言語化
4. silhouette_rules: 体型ごとの似合う丈・重心・シルエット・靴・小物のルール
5. moodboards/moodboard_analysis 連携
6. user_worldview_profiles 連携
7. コーデ提案時に統合:診断世界観/MB空気感/体型特徴/季節/シーン/予算/持ってる服
8. 提案理由を「MB 由来」「体型補正由来」「世界観由来」に分けて表示
```

### 1.6 重要(★ 中核思想)

```
- 黒が好きだから黒い服、の浅い提案は禁止
- ロングコートが世界観に合っても体型的に合わないなら代替案
- 体型を否定せず「その体型で一番世界観が成立する構造」を提案
- ユーザーに"他人から見た自分の見え方"を理解させる
- ★ 目的はバーチャル試着ではなく ★ 世界観フィッティング
```

### 1.7 将来拡張

```
- Meshcapade 系 API / SMPL 系モデル連携想定
- 3D アバター生成 API 接続できる設計
- 商品側 3D データ揃えばアバター上で服表示
- サイズ推薦/360 度確認/顔・髪型・メイク・カラコン提案まで拡張
```

### 1.8 MVP 必要 DB(★ 11 テーブル)

```
user_body_profiles / user_measurements / body_shape_analysis / silhouette_rules /
moodboards / moodboard_images / moodboard_analysis /
user_worldview_profiles / outfit_recommendations / product_recommendations / recommendation_feedback
```

### 1.9 UI 表示

```
体型プロフィール入力 / 体型分析結果 / 似合うシルエットのルール / 避けた方がいいシルエット /
MB 入力 / 今回の世界観変換 / 体型に合わせたコーデ提案 / 商品候補 /
なぜ似合うか / どこが体型補正か / どこが MB 由来か /
保存・違う・もっと寄せる・日常化・体型を綺麗に見せる フィードバック
```

---

## 2. ★ Sprint E(`8de8217`)との統合関係整理

### 2.1 共通テーブル(★ 5 件・Sprint E-0a と共有)

| # | テーブル | Sprint E-0a 由来 | E-0b での扱い |
|---|---|---|---|
| 1 | moodboards | ✅(Sprint C-2 段階1 + Sprint E-0a)| ✅ 共通 |
| 2 | moodboard_images(= items)| ✅(同上) | ✅ 共通 |
| 3 | moodboard_analysis | 🟡 部分既存(Sprint E-1 で完全構造化)| ✅ 共通 |
| 4 | user_worldview_profiles(= worldview_profiles)| ✅(Sprint 42 既存)| ✅ 共通 |
| 5 | outfit_recommendations | ❌ 新規(Sprint E-N)| ✅ 共通 |
| 6 | product_recommendations(★ E-0b で追加)| — | ★ 新規(E-0a の outfit より細粒度)|
| 7 | recommendation_feedback | ❌ 新規(Sprint E-N)| ✅ 共通 |

### 2.2 固有テーブル(★ 4 件・リアル試着 専用)

| # | テーブル | 既存 | 状態 |
|---|---|---|---|
| 1 | user_body_profiles | 🟡 `users.body_profile jsonb`(Sprint 32 / `014`)+ 個別カラム(Sprint 9 / `005`)既存 | ★ **拡張**(専用テーブル化検討) |
| 2 | user_measurements | ❌ なし | ★ **新規** |
| 3 | body_shape_analysis | ❌ なし(AI 言語化結果)| ★ **新規** |
| 4 | silhouette_rules | 部分既存(`lib/dictionaries/line.ts`)| 🟡 **辞書既存・ルール DB は新規** |

### 2.3 ★ Sprint E と リアル試着 の関係

```
Sprint E-0a(MB 軸):
  MB 入力 → 14 分析項目 → 診断 + 行動履歴 → 三位一体推薦

Sprint E-0b(体型軸):★ MB 軸を ★ 体型で着地させる
  体型入力 → 体型特徴 + シルエットルール → MB + 診断 統合 → 体型補正コーデ提案

= ★ Sprint E-0a + E-0b = ★ 「自分専用 AI スタイリスト」完成形
= ★ MB の世界観を ★ 自分の体型で成立させる
```

★ **DB 共通 5 + 固有 4 = 計 9 テーブル**(E-0b 単独 11 テーブルのうち 2 つは E-0a と重複・全体最適化で 9 テーブルに削減可)。

---

## 3. ★ 既存資産マッピング(★ 体型関連)

### 3.1 既存

| 資産 | 詳細 |
|---|---|
| `users.body_profile jsonb` | Sprint 32(`014_body_profile.sql`)・身体情報 jsonb |
| `users.height / weight / body_type 等` | Sprint 9(`005_sprint9_body_info.sql`)・個別カラム |
| `users.upper_body_thickness / muscle_type / leg_length 等` | Sprint 9 改善(`006_sprint9_profile_update.sql`)|
| `lib/dictionaries/line.ts` | シルエット辞書 10 種 |
| `lib/dictionaries/ratio.ts` | 比率辞書 8 種 |
| `lib/utils/product-match.ts` | body_profile を参照して product マッチング |
| `lib/prompts/stylist-chat.ts` | coordinate intent で body_profile 注入(MVP-1c)|

→ ★ **体型データ + 辞書 + 注入は既存**(★ **DRY by design 効率: 中**)。

### 3.2 新規

| 資産 | 詳細 |
|---|---|
| user_measurements | 採寸値の時系列(写真や date 別)|
| body_shape_analysis | AI による体型特徴の自然文言語化 |
| silhouette_rules | 体型 × シルエットの推奨/回避ルール DB(辞書 + 学習結果)|
| product_recommendations | outfit より細粒度の商品マッチング |

---

## 4. ★ 最終ビジョン `df36d82` Phase 1-4 との対応

| Phase | 最終ビジョン記述 | オーナー構想 E-0b 対応 |
|---|---|---|
| Phase 1 | 身長・体重・ウエスト・肩幅・股下入力 → 体型モデル選択 | ★ MVP 実装方針 Step 1-2(user_body_profiles + measurements)|
| Phase 2 | 体型モデルに世界観コーデ | ★ MVP Step 3-7(body_shape_analysis + silhouette_rules + 統合コーデ提案)|
| Phase 3 | 自分の写真試着 | ★ 将来構想 Step 1-3(3D アバター生成)|
| Phase 4 | 髪型・メイク・カラコン | ★ 将来拡張(顔・髪型・メイク・カラコン)|

→ ★ **最終ビジョン Phase 1-4 を完全に具体化**(オーナー本意「段階的に・最初から完璧でなくていい」と整合)。

---

## 5. ★ 不可侵境界線整合確認

### 5.1 本体 `ac834bb` 判断 6 との整合

```
判断6: ★ ③ は Phase 2 完了後の GO ゲートで再判断(★完全不変)
       外部 try-on API 選定 + コスト見積もり + プライバシー設計確定 + 規約整備が GO 条件。
```

| GO 条件 | オーナー構想 E-0b 対応 | 整合 |
|---|---|---|
| 外部 try-on API 選定 | Meshcapade / SMPL 系モデル連携設計 | ✅ |
| コスト見積もり | MVP は体型特徴 + シルエット補正(★ Vision API 不使用 = コスト極小)| ✅ |
| プライバシー設計 | ★ §5.3 で重大確認(後述)| ✅ |
| 規約整備 | MVP は採寸値のみ(顔写真は Phase 3 + 規約)| ✅ |

→ ★ **本体判断 6 と完全整合**(MVP = 客観準備条件揃った状態で段階着手)。

### 5.2 最終ビジョン `df36d82` との整合

| 観点 | 最終ビジョン | E-0b | 整合 |
|---|---|---|---|
| 段階的構築 | 「段階的に作って」 | MVP → 将来構想 段階化 | ✅ |
| 完璧でなくていい | 「最初から完璧でなくていい」 | MVP は体型特徴 + シルエット補正のみ | ✅ |
| Phase 1-4 構造 | 明示 | §4 で具体化 | ✅ |
| 世界観コーデ確認 | 「自分に近い体型モデルで世界観コーデ確認」 | ★ **世界観フィッティング** = まさにこれ | ✅ ★ **完全一致** |

### 5.3 ★ ★ プライバシー重大確認(★ ③ 専章 6 章)

本体 `ac834bb` 6 章 ③ プライバシー専章 = ★ **完全不変必須**:
- 写真 / 採寸値 / 体型データ = ★ **機微情報**
- ★ user_body_profiles の RLS = ★ 本人 FOR ALL(他人閲覧禁止)
- 顔写真は Phase 3 + 規約整備後(MVP では扱わない)
- 既存 `users.body_profile` jsonb の RLS は ★ 既に本人 RLS 確立済(`001_initial_schema.sql`)

→ ★ **MVP は採寸値のみ・顔写真なし = 既存プライバシー設計範囲内**(規約変更不要)。

★ Phase 3 着手時(★ 顔写真投入時)に ★ 6 章 + 規約整備を ★ 必須再評価。

---

## 6. ★ Sprint R-1〜R-9 分解(★ 全体スコープ)

| Sprint | スコープ | 既存活用 | MVP / Phase |
|---|---|---|---|
| **R-1** | user_body_profiles + user_measurements(採寸値入力・保存)| `users.body_profile` 拡張 | ✅ MVP 可 |
| **R-2** | body_shape_analysis(体型特徴 AI 言語化)| Claude API(既存)| △(MVP 推奨)|
| **R-3** | silhouette_rules(体型別ルール DB)| `line.ts` / `ratio.ts` 拡張 | △(MVP 推奨)|
| **R-4** | 体型 × 世界観 × MB 統合コーデ提案 | stylist-chat coordinate 拡張 | ❌ Phase 3 |
| **R-5** | 提案理由の 3 分類表示(MB 由来/体型補正/世界観由来)| 段階3-B 既存 UI 拡張 | ❌ Phase 3 |
| **R-6** | 商品推薦(product_recommendations)| `sync-rakuten` 既存 | ❌ Phase 3 |
| **R-7** | フィードバック学習(recommendation_feedback)| `user_style_events` 拡張 | ❌ Phase 3 |
| **R-8+** | 3D アバター(Phase 3・外部 API)| 外部 Meshcapade/SMPL | ❌ Phase 3 |
| **R-9+** | 顔・髪型・メイク・カラコン(Phase 4)| 外部 Vision/Style API | ❌ Phase 4 |

### 6.1 規模見当(★ 既存資産流用後)

| Sprint | 新規規模 | 想定時間 |
|---|---|---|
| R-1 | +150-300(migration + form + API) | 1-2 セッション |
| R-2 | +100-200(AI prompt + 言語化)| 1 セッション |
| R-3 | +200-400(辞書拡張 + ルール構造化)| 2-3 セッション |
| R-4 | +200-400(prompt 統合)| 2-3 セッション |
| R-5 | +100-200(UI 拡張)| 1-2 セッション |
| R-6 | +200-400(product 連鎖)| 2-3 セッション |
| R-7 | +200-400(学習ループ)| 2-3 セッション |
| R-8+(Phase 3)| +500-1000(外部 API 統合)| 5-10 セッション |
| R-9+(Phase 4)| +500-1000(顔・髪型・メイク)| 5-10 セッション |
| **合計** | **+2150-4300 行**(R-1〜R-7)+ **+1000-2000 行**(R-8/R-9 将来)| **17-29 セッション**(R-1〜R-7)|

★ **MVP リリース後の Phase 3 大型 Sprint 群**(Sprint D GO 後)= Sprint E と並行 or 統合可。

### 6.2 MVP スコープ判断

| Sprint | MVP 推奨 | 理由 |
|---|---|---|
| R-1 | ✅ | 採寸値入力 = 既存 `users.body_profile` 拡張で安価 |
| R-2 | △ | 体型 AI 言語化 = stylist-chat に既存活用余地 |
| R-3 | △ | silhouette_rules DB = `line.ts` 辞書既存 |
| R-4〜R-7 | ❌ Phase 3 | 推薦/UI/商品連鎖/フィードバックループ = MVP 後評価 |
| R-8/R-9 | ❌ Phase 3-4 | 外部 API + 規約整備 = MVP 後の大型 Sprint |

★ **MVP リリース基準**:
- R-1(必須)+ R-2 + R-3(MVP 推奨)= 体型入力 → 体型特徴 → シルエットルール提示
- 残は Phase 3 / 4(Sprint D GO 後)

---

## 7. ★ 「世界観フィッティング」中核思想記録(★ STYLE-SELF を ★ ワコール / Meshcapade と差別化する原則)

### 7.1 ワコール / Meshcapade との差別化

| 観点 | ワコール SCANBE / 3D smart&try | Meshcapade | ★ STYLE-SELF |
|---|---|---|---|
| 目的 | サイズ選び / インナー選び | 3D アバター提供(汎用)| ★ **世界観フィッティング** |
| 出力 | 推奨サイズ | 3D メッシュ | 「その体型で世界観成立する服・髪型・小物」 |
| 軸 | 体型のみ | 体型のみ | ★ 体型 × 世界観 × MB(三位一体)|

### 7.2 ★ 思想の連続性(Sprint E-0a「表面を真似しない」と統合)

```
Sprint E-0a(MB 軸):
  ★ 画像の表面を真似しない(黒画像 → 黒服 ❌)
  → 奥のムード/距離感/緊張感/素材感/光/構図/文化参照を抽出

Sprint E-0b(体型軸):
  ★ 体型のサイズだけを見ない(身長低い → 短丈推奨 ❌ では不十分)
  → その体型で「世界観をどう成立させるか」を提案

= ★ ★ 「表面の特徴」ではなく「奥の構造」を扱う
= ★ ★ STYLE-SELF を「サイズアプリ」「Pinterest クローン」ではなく
  ★ 「★ 自分専用 AI スタイリスト」にする中核原則
```

### 7.3 「体型を否定せず・世界観成立」原則

```
- ロングコートが世界観に合っても体型的に合わない → 代替案(短丈 + 縦比率演出)
- 黒が好きでも体型的に重くなる → 黒の重心を下げる構造提案
- "他人から見た自分の見え方" を理解させる(主観 → 客観 橋渡し)
```

### 7.4 既存 stylist-chat との関係

[`lib/prompts/stylist-chat.ts` 良い例 5 低身長ロングコート](../lib/prompts/stylist-chat.ts):
```
「低身長でもロングコートは縦比率の演出で着られます。3 法則です:
 ①上半身を短く見せる ②ボトムスは丈長め+前だけタックインで重心を上げる
 ③靴は厚底か濃色で縦に伸ばす」
```

→ ★ **既に「世界観フィッティング」思想を部分体現**(★ オーナー本意の起源)。Sprint R-1〜R-7 で完全化。

---

## 8. ★ 既存達成への影響評価(★ コード 0 変更・全保持)

| 達成項目 | 想定影響 |
|---|---|
| Phase 1 完成宣言含む全達成 + Sprint B-1〜C-4 + Sprint E-0(`8de8217`)| **0**(コード 0 変更)|
| リグレッションテスト | **399 PASS 維持** |
| 既存 v1 各 intent API + UI | **0** |
| 既存 migrations + 既存 body_profile / dictionaries / stylist-chat | **0**(参照 only / Sprint R-N で拡張)|
| 本体 `ac834bb` 6 章 / 7 章 / 判断 6 | **diff 0 行**(★ 6 章 ③ プライバシー専章は ★ Phase 3 着手時に必須再評価)|
| 本体 / doc7 / 最終ビジョン / 整合性点検 / ロードマップ / コスト試算 / 各設計案 | **diff 0 行** |
| 既存設計判断 1-10 | **文言不変** |

---

## 9. 結論

| 観点 | 結論 |
|---|---|
| ★ オーナービジョン記録 | ★ verbatim 記録完遂(核心思想 / 目的 / 実装思想 / 将来 8 / MVP 8 / 中核思想 / 将来拡張 / 11 テーブル / UI)|
| ★ Sprint E との統合関係 | ★ 共通 5 + 固有 4 = 計 9 テーブル(全体最適化)/ Sprint E-0a + E-0b = ★ **自分専用 AI スタイリスト完成形** |
| ★ 既存資産マッピング | `users.body_profile` jsonb + 個別カラム + `line.ts`/`ratio.ts` 辞書既存 / DRY 効率: 中 |
| ★ 最終ビジョン Phase 1-4 具体化 | Phase 1(R-1)+ Phase 2(R-2-R-7)+ Phase 3(R-8+ 3D アバター)+ Phase 4(R-9+ 顔・髪・メイク)|
| ★ 本体判断 6 整合 | ★ 完全整合(外部 API / コスト / プライバシー / 規約 = 客観準備条件)|
| ★ プライバシー重大確認 | ★ MVP は採寸値のみ(顔写真は Phase 3 + 規約整備後)/ user_body_profiles RLS 本人 FOR ALL / 既存 6 章 ③ 専章は完全不変 |
| ★ Sprint R-1〜R-9 分解 | ★ R-1〜R-3(MVP)+ R-4〜R-7(Phase 3)+ R-8〜R-9(Phase 3-4)= **+2150-4300 行 / 17-29 セッション**(R-1〜R-7) |
| ★ 「世界観フィッティング」中核思想 | ★ ワコール / Meshcapade と差別化 / Sprint E-0a「表面を真似しない」と思想連続 / 既存 stylist-chat 良い例 5 で部分体現済 |
| 規模 | **+400-500 行 / 45-60 分**(本 commit・設計のみ)+ Sprint R-1〜R-7 実装(別工程・Phase 3 領域)|
| 既存達成保持 | コード 0 変更で **全保持**(399 PASS 維持・tsc EXIT 0 維持)|
| 不可侵 | 本体 6 章 / 7 章 / 判断 6 / コスト試算 / 整合性点検 / ロードマップ / 各設計案 / 既存設計判断 1-10 ★ **全不変** |
| ★ 次工程 | 本 commit(ビジョン docs 1 件)→ オーナーレビュー → Sprint D Phase 2 後ゲート判断 → Sprint R-1〜R-3(MVP)or Phase 3 着手判断 |

→ ★ **Sprint E-0b リアル試着「世界観フィッティング」ビジョン記録完遂**(Sprint E-0a と統合で「自分専用 AI スタイリスト」設計青写真完成)

---

## 10. 制約遵守チェックリスト

- [x] 新規 docs ファイル 1 件のみ(本 doc)
- [x] 本体 `ac834bb` / コード(app/api/lib/scripts/package.json/tsconfig.json)/ doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` / 各設計案 / 他 docs **全 0 変更**
- [x] 本体 6 章(③ プライバシー専章)/ 7 章 / 判断 6 diff 0 行
- [x] 既存設計判断 1-10 文言不変
- [x] view + grep + 静的解析のみ・実装なし
- [x] tsc EXIT 0 維持(本 doc は markdown のみ・コード 0 変更)
- [x] リグレッションテスト 399 PASS 維持(本工程はコード 0 変更)
- [x] 実装は ★ 別工程(本 doc では実施しない・Sprint R-1〜R-9 領域)
- [x] commit はあり / push はなし
