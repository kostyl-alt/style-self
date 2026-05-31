# STYLE-SELF E-0g — multi-source product catalog・服好き感度・ターゲット明確化 戦略宣言(★ STYLE-SELF DNA 9 文書目・オーナー 2026-05-31 夜発見 第2弾・E-0f 具体化版)

## § 0. 前置き

- 発見日: 2026-05-31 夜(★ E-0f と ★ 同日・★ さらに深い発見 第2弾)
- 発見者: オーナー
- STYLE-SELF DNA 9 文書目
- 起点 HEAD: `206bc19`(E-0f まで origin 保全)
- 本文書の役割: E-0f(`206bc19`「実商品試着主軸・架空画像生成廃止」)を ★ さらに具体化し、実商品試着の「中身」を ★ ★ multi-source product catalog として品質保証する。楽天は MVP 技術検証用・本番は 11+ ソース・ターゲットは服好き/インフルエンサーであることを ★ verbatim 100% 保全して戦略宣言する

---

## § 1. ★ オーナー verbatim 記録(★ 改変禁止・全文保全)

```
楽天の商品しか出ないなら、服好き・インフルエンサー向けとしては弱い。かなり正直に言うと、今のままだと「誰が使いたいの?」って感覚

問題の本質
楽天が悪いというより、楽天だけだと世界観アプリの品揃えにならない。
あなたが作りたいのは、
ムードボードに合う、センスのある商品と出会える場所
なのに、楽天だけだと多分こうなる。

* 商品写真がダサい
* ブランドの世界観が弱い
* 出品者画像がバラバラ
* ファッション感度が高い商品が少ない
* ムードボードとの一致感が低い
* 服好きが「これ欲しい」と思いにくい

だから、楽天だけをメインの商品ソースにするのは危ない。

でも楽天を捨てる必要はない
楽天は MVP の接続確認用 として使えばいい。
つまり楽天は、
商品検索 → 商品カード → affiliate_url → 購入リンク → try-on導線
が動くか確認するための土台。
でも、ユーザーに出す本命商品は楽天だけじゃダメ。

正しい方針
こう分けた方がいい。

MVP技術検証
楽天でOK。
目的は、
* 商品カードが出るか
* 購入リンクが動くか
* product-matchが動くか
* try-onに商品画像を渡せるか
を見る。

本番価値検証
楽天だけではNG。
追加すべき商品ソースは、
* ZOZOTOWN
* SSENSE
* Farfetch
* HBX
* GR8
* Nubian
* Dover Street Market
* ブランド公式EC
* 古着/セレクトショップ
* 小規模ブランド
* Instagramブランド
この辺。
あなたのアプリは、むしろ "どこで買えるか" より "世界観に合うか" が価値だから、商品ソースは広くないと弱い。

Sprint Gの実商品導線について方針を修正したいです。
楽天API・external_products・product-match・affiliate_url が既に存在するのは大きな資産です。
ただし、楽天の商品だけをユーザー向けの本命商品ソースにするのは弱いです。

理由：
- 服好き・インフルエンサー向けには商品感度が足りない
- 商品写真やブランド世界観がバラバラ
- ムードボードとの一致感が弱くなりやすい
- 「これ欲しい」「真似したい」と思える商品に届きにくい
- 楽天だけだとSTYLE SELFの世界観価値が落ちる

方針：
楽天はMVPの技術検証用の商品ソースとして使う。
ただし、本番価値としては「複数商品ソース対応」を前提に設計する。

MVPで楽天を使う目的：
1. 商品カード表示
2. product-match接続
3. affiliate_url購入導線
4. 商品画像をtry-onへ渡す
5. 実商品ベースのフロー検証

ただしUI上では、楽天だけを最終形のように見せないでください。
商品ソースは将来拡張前提にしてください。

将来追加したい商品ソース：
- ZOZOTOWN
- SSENSE
- Farfetch
- HBX
- GR8
- Nubian
- Dover Street Market
- ブランド公式EC
- セレクトショップ
- 小規模ブランド
- 古着ショップ
- Instagramブランド

設計方針：
external_products は source を持つ汎用商品テーブルとして扱う。
楽天専用ではなく、multi-source product catalog として拡張できるようにする。

必要なカラム/考え方：
- source
- source_product_id
- brand
- title
- price
- image_url
- product_url
- affiliate_url
- category
- color
- material
- silhouette
- style_tags
- worldview_tags
- source_quality_score
- image_quality_score
- fashion_sensitivity_score

重要：
STYLE SELFの価値は「楽天の商品を出すこと」ではありません。
ムードボード・世界観・体型に合う"欲しくなる商品"を見つけることです。
そのため、Sprint Gでは楽天を使って実商品フローを動かしつつ、
設計上は必ず multi-source 対応を前提にしてください。

Sprint Gは進めます。
ただし楽天はMVPの技術検証用として扱い、本番の商品価値の中心にはしません。
multi-source product catalog 前提で設計してください。
```

---

## § 2. ★ STYLE-SELF ターゲット明確化

本文書により STYLE-SELF のターゲット顧客像が明確化された:

- ★ ターゲット:
  - 服好き
  - インフルエンサー
  - ファッション感度が高い人
  - 「真似したい」「これ欲しい」と感じる層

- ★ ★ ターゲットでない:
  - 価格優先層
  - 楽天で十分な層
  - = 一般 EC ユーザー

これは STYLE-SELF の ★ ★ ★ ★ ポジショニングを決定する戦略宣言である。商品の感度・ブランド世界観・撮影品質・ムードボード一致感の全てが、★ ターゲットの審美眼に応える水準であること。

---

## § 3. external_products multi-source 設計

オーナー指定のカラム/考え方:

| カラム | 説明 |
|---|---|
| source | ★ rakuten/zozo/ssense/farfetch/hbx/gr8/nubian/dsm/official_ec/select_shop/vintage/insta_brand 等の enum |
| source_product_id | 各ソース内の一意 ID |
| brand | ブランド名 |
| title | 商品名 |
| price | 価格(通貨は別カラム or jsonb) |
| image_url | 商品画像 URL |
| product_url | 購入ページ |
| affiliate_url | ある場合(楽天等) |
| category | outer/tops/bottoms/shoes/accessory/hair/makeup |
| color | 色 |
| material | 素材 |
| silhouette | シルエット |
| style_tags | ★ text[] |
| worldview_tags | ★ text[]・E-0a ベース |
| source_quality_score | ★ ソースの信頼性・0-100 |
| image_quality_score | ★ 画像品質・try-on 適合度・0-100 |
| fashion_sensitivity_score | ★ ★ ★ ファッション感度・E-0g 核心・0-100 |

- ★ ★ 既存 external_products(Sprint 40/41 で楽天実装済)を ★ multi-source 拡張する形:
  - 既存カラム保持(下位互換)
  - 上記追加カラムは migration で順次追加
  - 既存楽天データは ★ ★ source='rakuten' で埋め戻し
  - = ★ ★ ★ ★ 既存資産を ★ 棄損せず拡張

> ★ 実装注記(検証済): 既存 `external_products`(`004`)は既に `source` / `external_id`(= source_product_id 相当)/ `affiliate_url` / `image_url` / `normalized_category/color/material/silhouette` / `normalized_taste[]` を持つ。E-0g の追加は主に `brand`(既存)・`style_tags` / `worldview_tags` / `source_quality_score` / `image_quality_score` / `fashion_sensitivity_score`。命名は既存 normalized_* と整合を取る(別 Sprint で詳細設計)。

---

## § 4. 商品ソース 12 種 一覧

| source | 種別 | 優先度 |
|---|---|---|
| rakuten | MVP | 既存 ✅ |
| zozotown | 本命 | L2 開始 |
| ssense | 本命 | L2 開始 |
| farfetch | 本命 | L2 |
| hbx | 本命 | L2 |
| gr8 | 本命 | L2 |
| nubian | 本命 | L2 |
| dover_street_market | 本命 | L3 |
| official_ec | ブランド | L3 |
| select_shop | セレクト | L3 |
| vintage | 古着 | L3 |
| insta_brand | Instagram | L3 |

優先度:
- MVP(✅): 既存・接続確認用
- L2 開始: Sprint G の本番価値検証で最初に追加
- L2: Sprint G 後半
- L3: 将来拡張

---

## § 5. Sprint G 改訂指針(★ 段階2 へのバトン)

本セッションで作成済の Sprint G 設計(`6c76ab2`・ローカル・push 前)は ★ E-0g 反映で改訂が必要:

1. external_products 拡張カラム追加方針(§3)
2. multi-source 対応の検索ロジック
3. ソース別 fetch 戦略(楽天 API / ZOZO API / Farfetch スクレイピング 等)
4. source_quality / fashion_sensitivity_score の評価ロジック
5. UI 上で「これは楽天です」「これは SSENSE です」を ★ ★ 明示するか / しないか

改訂版 Sprint G 設計 は ★ ★ 段階2 で作成し、`6c76ab2` を上書き or 別 doc として並走させる。

> 注: `6c76ab2`(Sprint G 旧版)は本 E-0g push 後も ★ ローカルに温存される(原則は「楽天 MVP + 既存資産活用」で正しく、E-0g は「本番は multi-source 前提」を上書き的に追加する関係)。旧版の §B/§C を multi-source 視点で改訂する。

---

## § 6. STYLE-SELF DNA 9 文書での位置づけ

| 文書 | SHA | 役割 |
|---|---|---|
| E-0a | `8de8217` | 表面真似禁止 |
| E-0b | `feac265` | 世界観フィッティング思想 |
| E-0b-rev | `1f5c11e` | 中核機能(世界観ルック用) |
| E-0b-rev2 | `8e9bcfb` | 実商品試着・本命 |
| E-0c | `dfdec56` | 服好き基準 |
| E-0d | `3bdeb97` | Knowledge OS |
| E-0e | `0e7c8df` | 対話型AIスタイリスト=容器 |
| E-0f | `206bc19` | 実商品試着主軸・架空画像廃止 |
| ★ E-0g | (本文書) | ★ multi-source / ターゲット明確化 |

補完関係:
- E-0f: 画像生成廃止・実商品試着主軸(★ 何をやめるか / 何に変えるか)
- E-0g: 実商品の中身を ★ multi-source で品質保証(★ どんな商品を見せるか)

---

## § 7. 不可侵境界線確認

- 本体 `ac834bb` / doc7 / 最終ビジョン `df36d82` 全 0 変更
- E-0a〜E-0f 戦略文書 全 0 変更
- = ★ E-0g は新規追加のみ
