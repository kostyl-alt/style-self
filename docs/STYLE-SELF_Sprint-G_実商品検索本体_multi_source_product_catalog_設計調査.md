# STYLE-SELF Sprint G(改訂版 v2)— 実商品検索本体・multi-source product catalog 設計調査(★ E-0f 実装本体 + E-0g 実装第一歩・★ コード 0 変更・doc のみ)

## § 0. 前置き + 改訂背景

- 改訂版作成日: 2026-05-31 夜
- 起点 HEAD: `93d39ae`(E-0g・DNA 9文書・clean / 399 + 14 PASS / tsc EXIT 0)
- 旧版(`ad5badf`・★ 破棄済)は **楽天 MVP 前提**だった。本改訂版は **E-0g(`93d39ae`)反映で multi-source product catalog 対応**に書き直す。
- Sprint G = ★ E-0f(`206bc19`「実商品試着主軸・架空画像廃止」)の実装本体 + ★ E-0g(`93d39ae`「multi-source・服好きターゲット」)の実装第一歩
- ★ ローカル ahead: `c128102`(H-4b1-b-1''・本 doc では触らない・扱いは §I / 論点G-7)

---

## § A. 既存資産 verify(★ 楽天 = MVP 技術検証用に位置づけ直し)

| 資産 | 実態(Sprint 40/41) | 改訂版での扱い |
|---|---|---|
| 楽天 API | `lib/rakuten.ts`(fetchRakuten/getRanking)・`app/api/admin/sync-rakuten` | ★ **MVP 技術検証用のみ**(本番の商品価値中心にしない) |
| `external_products`(004) | source/external_id/product_url/affiliate_url/name/brand/price/image_url/normalized_category/color/material/silhouette/normalized_taste[]/is_available/synced_at | ★ **multi-source 拡張ベース**(既存カラム保持・下位互換) |
| `product-match` | `lib/utils/product-match.ts`(worldview/silhouette/season/taste スコア) | ★ **ソース横断対応に進化** |
| affiliate_url | external_products 既存 | 購入導線(楽天 MVP) |
| FASHN tryon-max | `app/api/tryon/generate`(product-to-model + prompt + プレースホルダ = 架空) | ★ G-3 で **実商品 garment_image に切替** |

→ ★ 既存 `external_products` は既に `source` カラムを持つ(= multi-source の素地あり)。E-0g 拡張は主に **スコア 3軸 + style_tags/worldview_tags の追加**。

---

## § B. 商品ソース戦略(E-0g §4 反映)

| source | 種別 | 優先度 | 取得方法(要法的調査) |
|---|---|---|---|
| rakuten | MVP | 既存 ✅ | 公式 API(統合済) |
| zozotown | 本命 | L2 開始 | 公式 API / アフィリエイト 検討 |
| ssense | 本命 | L2 開始 | アフィリエイト program 検討 |
| farfetch | 本命 | L2 | アフィリエイト / API 検討 |
| hbx | 本命 | L2 | 検討 |
| gr8 | 本命 | L2 | 検討 |
| nubian | 本命 | L2 | 検討 |
| dover_street_market | 本命 | L3 | 検討 |
| official_ec | ブランド | L3 | 個別対応 |
| select_shop | セレクト | L3 | 個別対応 |
| vintage | 古着 | L3 | 個別対応 |
| insta_brand | Instagram | L3 | API + 手動 |

- 各ソース判断軸: 公式 API 有無 / アフィリエイト経由 / スクレイピング合法性 / 商品画像の利用権 → ★ ソースごとに **法的調査必須**(独自スクレイピングは E-0f/E-0g でも非推奨)。
- **Layer 1 MVP = 楽天のみ**(既存統合で技術検証完了)
- **Layer 2 第一弾 = ZOZOTOWN or SSENSE 1つ**(multi-source 動作確認 = E-0g 本番価値検証の起点)
- **Layer 3 = 残り 9 ソース順次**

---

## § C. external_products multi-source 拡張(E-0g §3 反映)

**現状(楽天)保持(下位互換)**: id / external_id / product_url / affiliate_url / image_url / name / brand / price / normalized_*。

**追加カラム(migration で順次・NULL 許容)**:
| カラム | 用途 | 既存との関係 |
|---|---|---|
| source | enum(rakuten/zozo/ssense/…12種) | ★ 既存 source(text)を enum 運用に |
| source_product_id | 各ソース内一意 ID | ★ 既存 external_id を写し / 並走 |
| style_tags text[] | スタイルタグ | 新規 |
| worldview_tags text[] | E-0a ベース世界観タグ | 新規(normalized_taste と整合) |
| source_quality_score (0-100) | ソース信頼性 | 新規 |
| image_quality_score (0-100) | try-on 適合度 | 新規 |
| fashion_sensitivity_score (0-100) | ★ E-0g 核心 | 新規 |
| (title/category/color/material/silhouette) | E-0g 指定名 | ★ 既存 name/normalized_* に対応(別名追加でなく既存を正規名として扱う) |

**migration 戦略**: 既存楽天データを `source='rakuten'` で埋め戻し / source_product_id = external_id 写し / 残りは NULL 許容で順次 → ★ 既存資産棄損ゼロ。

---

## § D. スコアリングロジック(★ E-0g 核心・3軸)

**source_quality_score(0-100)**: 公式API 80-100(楽天90/ZOZO85)/ アフィリエイト 70-85 / スクレイピング 50-70 / 個別 40-60。

**image_quality_score(0-100)**: スタジオ+背景透過 90-100 / スタジオ+背景 70-90 / 出品者着用 50-70 / 出品者平置き 30-50。→ ★ try-on 適合度に直結(garment_image の質)。

**fashion_sensitivity_score(0-100)**: ★ E-0g の魂。評価軸=ブランド世界観の強さ / コア層認知 / トレンド反映 / 「これ欲しい」引力。評価方法:
- **LLM 評価**(brand/title/image_url から)
- **ソース別ベースライン**(SSENSE=80 / Farfetch=85 / 楽天=30-50 / インディー=可変)
- **手動キャリブレーション**(オーナー)
- → ★ 推奨: **LLM + ベースライン併用**(論点G-3)

**候補抽出時の総合スコア**: ムードボード一致度(既存 product-match)× source_quality × image_quality × fashion_sensitivity → 上位 N 件。

---

## § E. ムードボード → 商品候補 LLM(改訂)

- 1回目: moodboard → ★ **source 別 query 生成**(楽天/ZOZO/SSENSE の商品命名習慣に合わせる)
- 2回目: product-match 結果 → reasoning「なぜ合うか」生成(★ fashion_sensitivity も考慮)
- マッチング本体はコード(product-match)→ LLM は keyword と reasoning に限定(コスト最小・2呼出)

---

## § F. UI 4 ボタン(E-0f §4)+ 商品カード

| ボタン | 動作 |
|---|---|
| 世界観ルックを見る | 既存 VisualizeButton(★ 廃止予定・暫定保持) |
| 商品を探す | ★ multi-source 検索 |
| この商品を試す | ★ try-on 実商品 |
| 近い体型 / 自分で試す | L2 |

**商品カード**: 画像 / 商品名 / 価格 / brand / 「なぜ合うか」/ ★ source バッジ / 「試す」/ 購入リンク。

**ソースバッジ表示(論点G-2)**:
- 案A 表示(透明性)/ 案B 非表示(STYLE-SELF ブランド)/ 案C ホバー時のみ
- ★ 推奨: **案C(ホバー/詳細時のみ表示)** — 一覧は世界観で見せ(E-0g「どこで買えるかより世界観に合うか」)、購入判断時にソースを確認できる折衷。

---

## § G. 購入導線

- Layer 1: 楽天 affiliate_url 直リンク
- Layer 2: 各ソースのアフィリエイト ID + 統一クリックトラッキング(`user_style_events` 流用可)
- 法的: 楽天(確認済)/ ZOZO・SSENSE アフィリエイト program は ★ ソースごとに別調査(論点G-8)

---

## § H. Sprint G ロードマップ(E-0g 反映)

| 段階 | 内容 | Layer |
|---|---|---|
| G-1 | 候補 LLM(moodboard→source別query→楽天match→reasoning) | L1 |
| G-2 | 商品候補 UI(チャット内カード・なぜ合うか) | L1 |
| G-3 | try-on 実商品 garment_image 切替 | L1 |
| G-4 | 試着結果 UI + 購入導線 | L1 |
| **Layer 1 MVP = G-1〜G-4(楽天のみ)** | | |
| G-5 | external_products multi-source カラム拡張(§C) | L2 |
| G-6 | ZOZOTOWN or SSENSE 統合 | L2 |
| G-7 | fashion_sensitivity_score ロジック実装 | L2 |
| **Layer 2 第一弾 = G-5〜G-7** | | |
| G-8〜 | 残り 9 ソース順次 / 近い体型モデル / 本人写真同意UI | L3 |

---

## § I. H-4b1-b-1''(`c128102`)の扱い

- H-4b1-b-1 = JSON 構造化 reply(CoordinateReply)。「架空コーデ」前提だが ★ 構造(direction/summary/items/quickActions)は **実商品にも流用可**。
- ★ 推奨: **C 保持 + 流用方向**(verify 不要・ローカル温存)。G-2 で items[] を実商品参照(product_id)に発展。

---

## § J. オーナー判断 新 8 論点(★ 推奨併記)

| # | 論点 | ★ 推奨 |
|---|---|---|
| G-1 | Layer 1 MVP スコープ | **楽天のみ**(技術検証) |
| G-2 | ソースバッジ UI | **案C ホバー/詳細時のみ** |
| G-3 | fashion_sensitivity 評価 | **LLM + ベースライン併用** |
| G-4 | Layer 2 第一弾ソース | **SSENSE**(感度高・E-0g ターゲット直撃)or ZOZO(日本/API容易)→ 法的調査で確定 |
| G-5 | migration タイミング | **L1 で source/source_product_id のみ・残り L2** |
| G-6 | 段階分割 | **G-1〜4=L1 / G-5〜7=L2** |
| G-7 | H-4b1-b-1''(`c128102`) | **C 保持 + 流用** |
| G-8 | 法的調査優先順 | **ZOZO / SSENSE アフィリエイト先行** |

---

## § K. 4本柱 + E-0f/E-0g 整合

| 文書 | Sprint G での反映 |
|---|---|
| E-0a 表面真似禁止 | fashion_sensitivity 評価 |
| E-0b-rev2 リアル試着 | ★ G-3 実商品 try-on |
| E-0c 服好き基準 | fashion_sensitivity_score |
| E-0d Knowledge OS | 商品マッチング |
| E-0e 対話型UI | 商品候補も対話で |
| E-0f 実商品試着主軸 | ★ Sprint G が本体 |
| E-0g multi-source | ★ ★ Layer 2 から本番価値 |

## § L. 不可侵境界線
- 本体 `ac834bb` / doc7 / 最終ビジョン `df36d82` / 既存 DNA 9文書(E-0a〜E-0g)全0変更 → Sprint G v2 設計は侵さない。

---

## 検証(本 doc)
- ✅ コード 0 変更(doc 1 件のみ・旧版 ad5badf は破棄)/ tsc EXIT 0 維持 / 399 + 14 PASS 維持
- ✅ 本体 / 戦略文書(E-0a〜E-0g)/ 最終ビジョン / 各設計案 全 0 変更
- ✅ ローカル H-4b1-b-1''(`c128102`)触らず
