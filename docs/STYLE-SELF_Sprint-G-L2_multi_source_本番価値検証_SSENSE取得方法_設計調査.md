# STYLE-SELF Sprint G-L2 — multi-source 本番価値検証・SSENSE 取得方法 設計調査(★ Layer 2 実装第一歩・E-0g §4 反映・★ 法的判断は専門家確認必須・コード 0 変更)

- 作成日: 2026-06-01
- 起点 HEAD: `16b699e`(G-1 429修正・Layer 1 MVP 技術検証完了・clean / 14 + 6 PASS / tsc EXIT 0)
- 本 doc の役割: Layer 1(楽天=技術検証・オーナー verify「出たよ・質は悪い・当たり前」)完了を受け、E-0g「服好き・インフルエンサーが欲しくなる商品」を出す **Layer 2 = multi-source 本番価値検証**の設計。第一弾ソースの取得方法・法的要件・規模・代替案・migration を整理(★ コード 0 変更・実装は別 sprint)
- ★ ★ 法的注意: 本 doc は ★ Claude Code が一般的な構造・公開情報から整理したもので、★ ★ ★ 法務文書ではない。SSENSE 等の具体的規約・robots.txt・Affiliate 条項は ★ 私が live 確認できないため「★ 要確認」とし、最終判断は §H の専門家確認を必須とする。

---

## § 0. ★ 既存資産 verify 結果(★ migration 028 を大幅補正)

> ★ ★ 最重要補正: E-0g §3 の希望カラム 18 個のうち **大半は既に external_products に存在**(004 + 017 + 018 + 019)。migration 028 の新規追加は **わずか 4 カラム**。タスクの「+14 カラム」想定は過大。

| E-0g §3 希望 | 既存 external_products | migration 028 |
|---|---|---|
| source | ✅ `source`(004) | 既存(enum 運用で) |
| source_product_id | ✅ `external_id`(004) | 既存を流用(rename せず並走) |
| brand / title / price | ✅ `brand` / `name` / `price` | 既存 |
| image_url / product_url / affiliate_url | ✅ 全て(004) | 既存 |
| category / color / material / silhouette | ✅ `normalized_category/colors[]/materials[]/silhouette` | 既存 |
| worldview_tags | ✅ `worldview_tags[]`(017) | 既存 |
| **style_tags** | ❌ なし | ★ **新規** |
| **source_quality_score** | ❌ なし | ★ **新規** |
| **image_quality_score** | ❌ なし | ★ **新規** |
| **fashion_sensitivity_score** | ❌ なし | ★ **新規(E-0g 核心)** |

→ migration 028 = **+4 カラム**(NULL 許容・既存破損ゼロ)。既存資産は Layer 2 にほぼそのまま流用可能。

---

## § A. 既存資産(§0 集約 + L2 北極星)
- E-0g(`93d39ae`)§3 multi-source カラム / §4 商品ソース 12 種 / §5 改訂指針
- Sprint G v2(`716bd3a`)§B ソース戦略 / §D スコアリング 3 軸 / §H ロードマップ
- external_products(004/017/018/019)= §0 のとおり大半のカラム完備
- 楽天 = Affiliate 構造の既存実装(`lib/rakuten.ts` の affiliateUrl)= Affiliate 経由統合の前例

---

## § B. SSENSE 取得方法 5 案 比較(★ 本調査の核)

> ★ SSENSE の API 有無・Affiliate 提供状況・robots.txt・ToS は ★ 私が live 確認していない。以下は ★ 一般的な高級 EC の構造に基づく整理であり、各項目は ★ 「要確認」。

| 案 | 概要 | 法的安全性 | データ範囲 | 工数 | 維持 | 推奨度 |
|---|---|---|---|---|---|---|
| 1 公式 API | SSENSE 直の商品 API | 高(あれば) | 広い | 中 | 低 | △(★ 公開 API 存在は要確認・一般に高級ECは非公開傾向) |
| **2 Affiliate ネットワーク** | Rakuten Advertising / Awin / CJ / Impact 等経由 | ★ 高 | 商品ID/title/price/image/url/affiliate_url | 中(200-400行) | 低 | ★ **最有力** |
| 3 スクレイピング | HTML 直収集 | ★ ★ 低(危険) | 任意 | 大 | ★ 高(構造変更で破綻) | ❌ 非推奨(E-0g §4 と整合) |
| 4 個別契約(B2B) | SSENSE 法人窓口とデータフィード契約 | 高 | 広い | 大(交渉) | 中 | △(STYLE-SELF 規模では未現実的) |
| 5 ハイブリッド | 案2 + 手動キュレーション | 高 | 案2 + 補完 | 中-大 | 中 | ○(中間) |

**比較軸**: 法的安全性 / データ範囲・品質 / 工数 / 維持コスト / スケーラビリティ / STYLE-SELF 適合度。

★ **推奨 = 案2(Affiliate ネットワーク経由)**。理由:
- 法的に最も安全(規約の枠内で画像・リンクが提供される・楽天と同じ構造で既存知見が活きる)
- `affiliate_url` で購入導線 = 収益基盤(E-0f/E-0g)
- スクレイピング(案3)は E-0g §4「独自スクレイピング非推奨」と整合し**回避**
- ★ ただし SSENSE が ★ どの Affiliate ネットワークに参加しているか・画像利用権の条項は ★ ★ 要確認(§C)

---

## § C. SSENSE 法的調査要件(★ 専門家確認の前提整理)

| # | 項目 | 確認内容 | 確認方法 |
|---|---|---|---|
| 1 | Affiliate program 規約 | 商品画像利用権 / 改変可否(クロップ・透過・★ try-on 投入)/ 再配布 / 表示義務(「Provided by」等)/ 禁止行為 | 参加ネットワークの規約 + SSENSE パートナー規約 |
| 2 | robots.txt | 自動アクセス許諾範囲 | `https://www.ssense.com/robots.txt`(★ 要 live 確認) |
| 3 | 利用規約(ToS) | 自動アクセス禁止 / データ収集禁止 / 商標利用 | SSENSE ToS(リージョン別)|
| 4 | 商品画像の著作権 | SSENSE 撮影画像 vs ブランド提供画像の権利所在・★ try-on(garment_image)利用への適用 | 規約 + 専門家 |
| 5 | ★ 専門家確認 | 上記すべての最終判断 | §H |

**法的リスクマトリクス**:
- 案2 Affiliate: リスク低(規約遵守が前提)。最悪ケース=program 規約違反で提携停止 → 緩和=規約精読+専門家確認
- 案3 スクレイピング: ★ リスク高(ToS違反・著作権・IP ブロック)。最悪ケース=法的請求 → 緩和=実施しない
- ★ ★ ★ 特に「商品画像の try-on(garment_image)への投入・改変」は ★ 著作権・規約の双方に関わる最重要論点。専門家確認なしに実行不可。

---

## § D. 規模見積(各案)
| 案 | 内訳 | 推定 |
|---|---|---|
| 案2 Affiliate | ネットワーク登録(★ オーナー作業 1-2週)/ API クライアント 200-400行 / 正規化 100-200行 / migration 028(+4列)/ E2E | 3-5 セッション |
| 案3 スクレイピング | スクレイパー 500-1000行 / retry / パーサ / ★ 維持高 / ★ 法的高 | 6-10 セッション + 継続維持 |
| 案5 ハイブリッド | 案2 の 70% + 手動キュレUI 300-500行 | 5-8 セッション |

---

## § E. 代替案(★ SSENSE 法的問題発覚時のフォールバック)

| ソース | 特徴 | 取得方法候補 | 法的安全性 | 推奨順 |
|---|---|---|---|---|
| **ZOZOTOWN** | 国内 EC・拠点親和性・楽天類似の Affiliate 構造 | ZOZO Affiliate(要確認)/ ValueCommerce 等 | ★ 最安全候補 | ★ 1 |
| Farfetch | グローバル高級 EC(SSENSE 競合)・ハイブランド充実 | Farfetch Partner program(要確認) | 高 | 2 |
| HBX | Hypebeast 系・ストリート寄り | Affiliate 有無 要確認 | 中-高 | 3 |
| GR8 / Nubian | 国内セレクト・服好き親和・規模小 | 個別契約寄り・難易度高 | 中 | 4(ニッチ) |

★ フォールバック方針: SSENSE で法的問題が発覚 → **ZOZOTOWN(国内・最安全・既存 ZOZO アフィリエイト ID env も存在)へ切替**。Farfetch / HBX は次点。GR8/Nubian は世界観親和だが契約難で L3。

> ★ 補足(検証済): 既存 `.env.local` に `NEXT_PUBLIC_ZOZO_AFFILIATE_ID` キーが存在(CLAUDE.md Sprint 35・ValueCommerce 承認前提)。ZOZO は env 面でも前進済みで、SSENSE より着手が早い可能性 → 論点 L2-3。

---

## § F. migration 028 プレビュー(★ +4 カラムのみ・doc 内設計)
```sql
-- Sprint G-5a(028): external_products に multi-source 本番価値カラムを追加(E-0g §3 核心)
alter table public.external_products
  add column if not exists style_tags                text[]  not null default '{}',
  add column if not exists source_quality_score      integer,        -- 0-100・ソース信頼性
  add column if not exists image_quality_score        integer,        -- 0-100・try-on 適合度
  add column if not exists fashion_sensitivity_score  integer;        -- 0-100・★ E-0g 核心
-- 既存楽天データ: source='rakuten' は既存値のまま・新カラムは NULL(順次評価で埋め)
-- source_product_id は既存 external_id を流用(rename しない=破損ゼロ)
```
- ★ 既存 worldview_tags/normalized_* は流用 → migration は **4 カラムのみ**(§0 補正)
- 既存破損ゼロ(NULL 許容 add column if not exists)

### G-5 段階分割
- **G-5a**: migration 028 設計(本 doc 内・+4列)
- **G-5b**: migration 028 適用(別 sprint・Supabase)
- **G-6**: SSENSE or ZOZO 統合(Affiliate クライアント・正規化)
- **G-7**: fashion_sensitivity_score 評価ロジック(LLM + ベースライン・Sprint G v2 §D)

---

## § G. ロードマップ更新(Layer 1 完了後)
| 段階 | 内容 | Layer |
|---|---|---|
| G-3 | try-on 実商品 garment_image 切替(★ 楽天で先行・論点L2-5)| L1 |
| G-4 | 試着結果 UI + 購入導線(Layer 1 MVP 完成)| L1 |
| G-5a/b | migration 028 設計 → 適用 | L2 |
| G-6 | SSENSE or ZOZO 統合 | L2 |
| G-7 | fashion_sensitivity_score 実装 | L2 |
| G-8〜 | 残り 9 ソース / 近い体型モデル / 本人写真同意UI | L3 |

> ★ 補足: G-3 の try-on(garment_image)は §C-4 の「商品画像の改変・try-on 利用」法的論点に直結。楽天商品画像での先行検証も、楽天アフィリエイト規約上の画像利用範囲を ★ 要確認(専門家)。

---

## § H. ★ ★ ★ ★ ★ 法的注意(必読・doc の最重要部)

```
本設計調査は Claude Code が公開情報・一般的な Affiliate program 構造・robots.txt 等の
「一般的な仕組み」から整理したものであり、★ 最終的な法的判断・契約締結・リスク評価には
★ ★ ★ 弁護士・IP 専門家・E-commerce 法務専門家の確認が必須である。

特に以下は専門家確認なしに実行してはならない:
- SSENSE / ZOZO 等 Affiliate program への登録(規約の受諾)
- ★ 商品画像の改変・try-on(garment_image)への投入・加工
- スクレイピング(★ ★ ★ ★ ★ 強く非推奨)
- 個別契約交渉

★ Claude Code は SSENSE 等の現行の規約・robots.txt・API 提供状況を live 確認していない。
本 doc 内の「SSENSE は〜」という記述はすべて「一般的傾向 + 要確認」であり、★ 法務文書ではない。
実装着手(G-6)前に、対象ソースの最新規約を取得し専門家レビューを通すこと。
```

---

## § I. オーナー判断 6 論点(★ 推奨併記)
| # | 論点 | ★ 推奨 |
|---|---|---|
| L2-1 | SSENSE 取得方法 | **案2 Affiliate ネットワーク**(規約・画像権は要確認) |
| L2-2 | 法的調査の進め方 | **本 doc 整理 + 専門家確認の 2 段構え**(着手前必須) |
| L2-3 | 第一弾ソース | **ZOZO 優先**(国内・最安全・env 前進済)or SSENSE(感度高)→ 法的確認で確定 |
| L2-4 | migration 028 | **G-5a doc 設計のみ本 sprint・適用 G-5b** |
| L2-5 | G-3 try-on 切替 | **楽天で先行 → L2 後に実商品ソース拡大**(画像利用権は要確認) |
| L2-6 | Sprint 順序 | **G-3 → G-4 → G-5a → G-5b → G-6 → G-7** |

---

## § J. 4本柱 + E-0f/E-0g 整合
| 文書 | 反映 |
|---|---|
| E-0a 表面真似禁止 | fashion_sensitivity 評価 |
| E-0b-rev2 リアル試着 | G-3 実商品 try-on(画像権 要確認) |
| E-0c 服好き基準 | fashion_sensitivity_score |
| E-0d Knowledge OS | 商品マッチング |
| E-0e 対話型UI | G-2 案D 達成済 |
| E-0f 実商品試着主軸 | Sprint G 本体達成(L1) |
| E-0g multi-source | ★ ★ 本調査が Layer 2 の実装第一歩 |

## § K. 不可侵境界線
- 本体 `ac834bb` / doc7 / 最終ビジョン `df36d82` / DNA 9文書 / 各設計案 全0変更 → 本 doc は新規 1 件のみ。

---

## 検証(本 doc)
- ✅ コード 0 変更(doc 1 件のみ)/ tsc EXIT 0 維持 / 14 + 6 PASS 維持
- ✅ 本体 / 戦略文書(E-0a〜E-0g)/ 最終ビジョン / 各設計案 全 0 変更
- ✅ ★ 法的判断は専門家確認必須を §H に明示
