# STYLE-SELF Sprint G-3 — try-on 実商品切替・FASHN 連携 設計調査(★ E-0f 実装核心・楽天先行・★ 法的判断は専門家確認 + 楽天直接照会必須・コード 0 変更)

- 作成日: 2026-06-01
- 起点 HEAD: `a08d36b`(Sprint G-L2 設計・clean / 14 + 6 PASS / tsc EXIT 0)
- 本 doc の役割: 「この商品を試す」(G-2b で disabled)を実際に動かす G-3 の設計。**FASHN を架空生成(product-to-model + プレースホルダ)→ 実楽天商品の try-on(garment_image)に切替**する E-0f「画像生成で服を作るな・実在商品を着せろ」の実装核心。3 つの不確実性を整理(★ コード 0 変更・実装は別 sprint)
- ★ 法的注意: 本 doc は公開情報・FASHN 公式 docs の一般構造・楽天規約一般情報からの整理。SSENSE 同様 ★ 私は FASHN の現行 model 名/params・楽天規約の画像 try-on 条項を ★ live 確認していない → 「★ 要確認」とし、§D / §H の専門家確認 + 楽天直接照会を必須とする。

---

## § 0. ★ 既存資産 verify 結果(★ FASHN 現状 = 架空生成)

| 項目 | 実態(verify 済) | G-3 での扱い |
|---|---|---|
| FASHN 呼出 | `POST https://api.fashn.ai/v1/run`(`tryon/generate/route.ts`)・polling 2s×60(120s timeout) | run/poll 構造は流用 |
| **model_name** | ★ **`"product-to-model"`**(商品画像 + prompt から AI モデル生成) | ★ **try-on モデルへ切替**(model_image + garment_image) |
| 入力 | `inputs: { product_image: PLACEHOLDER, prompt: generatedPrompt, output_format }` | ★ garment_image=実楽天画像・prompt 廃止 |
| **product_image** | ★ **`PLACEHOLDER_PRODUCT_IMAGE`(Unsplash 平置き・固定)** = 架空 | ★ ★ E-0f で廃止する核心 |
| prompt | `buildTryonPrompt`(英語・世界観反映) | ★ try-on モデルでは不要(架空生成の名残)|
| cost | $0.075 + Haiku ≈ ¥12/件(コメント記載)| コスト管理 論点G3-6 |
| 認証 | createSupabaseServerClient・FASHN_API_KEY サーバーのみ・24h 自動削除規約 | 流用 |
| TryOnButton | G-2a 実装済・現状 disabled「準備中」(onTryOn 未指定) | ★ G-3 で接続 |

→ ★ ★ G-3 の核心 = `model_name` を `product-to-model`(架空)から **実 try-on モデル**(model_image + garment_image)に切替。garment_image = 楽天商品 image_url。

> ★ 要確認(FASHN 公式 docs): FASHN の実 virtual try-on model 名(例: `tryon-v1.x` 系)と garment_image/model_image/category の正確な params。本 doc は「product-to-model → 実 try-on model」という構造変更を設計し、具体 model 名は実装着手時に FASHN docs で確定する。

---

## § A. 既存資産(§0 集約)
`app/api/tryon/generate/route.ts`(FASHN run/poll・product-to-model・PLACEHOLDER)/ `lib/prompts/tryon-prompt.ts`(buildTryonPrompt)/ `components/chat/TryOnButton.tsx`(G-2a・disabled)/ G-1 `ProductCandidate`(image_url/source_product_id)。

---

## § B. 不確実性1: garment_image FASHN 入力要件 vs 楽天画像実態

**FASHN garment_image 要件(★ 要確認・一般的な virtual try-on の傾向)**: 単品・できれば背景単色/透過・正面・十分な解像度・対応形式(png/jpg)・サイズ上限。

**楽天 image_url 実態(verify 知見)**: 出品者写真で **背景バラバラ・着用/平置き混在・解像度ばらつき**(E-0g「出品者画像がバラバラ」と一致)→ ★ FASHN 要件とのギャップ大。

### ギャップ解決案
| 案 | 内容 | 評価 |
|---|---|---|
| A そのまま投入 | image_url を直接 garment_image に | 実装最小・★ 失敗率高想定 |
| B image_quality_score フィルタ | 高品質画像のみ try-on 対象・低品質は不可表示 | E-0g §3 image_quality 前倒し・無駄打ち削減 |
| C 画像前処理 | remove.bg 等で背景除去/切抜き | コスト+実装増・★ 規約確認要(改変) |
| **D ハイブリッド(B+C)** | 高品質=そのまま / 中品質=前処理 / 低品質=スキップ | ★ E-0g §D 整合・本命だが重い |
| E graceful fallback | FASHN 失敗→商品カードのみ+「試着失敗:画像品質」 | 任意・どの案でも併用推奨 |

★ 推奨: **G-3 最小は 案A + 案E(そのまま投入 + 失敗時 fallback)で実測** → 失敗率を見て **案B(品質フィルタ)を G-3b で追加**。案C(前処理)は ★ 規約確認後(画像改変が楽天規約 OK か §D)・効果次第。
- 理由: Layer 1「出たよ・質は悪い」と同じ ★ まず動かして実測する段階的検証。前処理(C)は規約リスク(改変)を伴うため後回し。

---

## § C. 不確実性2: model_image 最小供給

**役割**: 「誰に garment を着せるか」。「近い体型で見る」(本人 attrs から選択)= G-7、「自分で試す」(本人写真・同意)= G-7/L3。G-3 は ★ 最小の base model が要る。

| 案 | 内容 | 評価 |
|---|---|---|
| A オーナー基準 1 枚 | 開発者(オーナー)体型の静的モデル画像 1 枚 | ★ MVP 最小・検証に十分・一般化は L2/L3 |
| B 汎用標準モデル 1-2 枚 | 男性/女性 標準 1 枚ずつ | 一般 EC try-on の標準 |
| C 体型カテゴリ別 | 骨格×サイズの複数 + KO(E-0d)で自動選択 | ★ 重い → G-7 |

★ 推奨: **G-3 = 案A or 案B(最小 1-2 枚)**。「近い体型で見る」(案C)は G-7。
- model_image 供給: public/ に静的画像を置く or Supabase Storage。FASHN が GET 取得できる public URL が要る(PLACEHOLDER と同様)。
- ★ 注意: model 画像は **権利クリアな素材**(自前撮影・ライセンス済ストック・本人同意)であること(§H)。

---

## § D. ★ 不確実性3: 楽天アフィリエイト規約の画像 try-on 利用範囲(★ 最重要)

| 利用形態 | 一般的可否(★ 要確認) |
|---|---|
| 商品カードでの**表示** | ほぼ OK(アフィリエイト目的の商品画像表示)|
| **改変**(切抜き・背景除去・前処理 案C) | ★ ★ 要確認(改変禁止条項の有無)|
| **try-on 投入**(AI への入力) | ★ ★ ★ 要確認(二次利用・派生物)|
| **try-on 出力画像の表示**(楽天商品を着せた生成画像) | ★ ★ ★ ★ 要確認(派生物の公開)|
| 画像の**キャッシュ/保存** | ★ 要確認 |

- 出品者画像の著作権所在(楽天 vs 出品者)も ★ 要確認。
- **法的リスク シナリオ**:
  - S1 そのまま投入: ★ 規約抵触リスク(二次利用・改変の解釈次第)
  - S2 「サンプル試着」明示 + 商品リンク必須 + opt-out
  - S3 ★ 楽天アフィリエイト窓口へ直接照会(最も確実)
- ★ ★ ★ try-on(garment_image 投入)は「商品画像の二次利用・派生物生成」に該当し得るため、**表示 OK ≠ try-on OK**。G-3a 着手前に §H の確認必須。

---

## § E. G-3 実装ロードマップ(段階分割)

| 段階 | 内容 | 行数 | 法的前提 |
|---|---|---|---|
| **G-3a** | `/api/products/tryon` route 新規(productId+threadId → FASHN 実 try-on)・model_name 切替・garment_image=楽天 image_url(案A)・model_image=案A/B・TryOnButton 接続・試着画像を新メッセージ kind `tryon` で表示(G-2 案D 流用)・案E fallback | 200-300 | ★ ★ 楽天規約確認必須(§D/§H)|
| G-3b | image_quality_score フィルタ(案B)・低品質は try-on 不可表示 | 100-200 | ─ |
| G-3c | 画像前処理(案C・remove.bg 等・★ 任意) | 増 | ★ ★ 改変の規約確認必須 |

★ G-3 = **G-3a +(実測後)G-3b**。G-3c は規約確認 + 効果次第。

**検証戦略**(Layer 1 と同じ段階検証): 楽天商品 高/中/低品質それぞれの try-on 成功率・失敗率を実測 → 案B 要否を判断。

---

## § F. オーナー判断 6 論点(★ 推奨併記)
| # | 論点 | ★ 推奨 |
|---|---|---|
| G3-1 | garment_image ギャップ | **G-3a=案A+E で実測 → G-3b で案B**(案C は規約確認後)|
| G3-2 | model_image 供給 | **案A/B(最小1-2枚)**・近い体型は G-7・★ 権利クリア素材 |
| G3-3 | 楽天規約 画像 try-on | **Claude整理 + ★ オーナー楽天直接照会 + 専門家確認**(§H)|
| G3-4 | 段階分割 | **G-3a + G-3b 本sprint / G-3c は実機後** |
| G3-5 | 試着画像 UI | **新メッセージ kind `tryon`**(G-2 案D 流用・永続化 H-4a)|
| G3-6 | FASHN コスト管理 | **ユーザー/日次の生成上限**(Sprint B-3 案P1 思想)・$0.075/件 |

---

## § G. 4本柱 + E-0f/E-0g 整合
| 文書 | G-3 での反映 |
|---|---|
| E-0a 表面真似禁止 | 実商品 try-on(架空生成の廃止)|
| E-0b-rev2 リアル試着 | ★ ★ G-3 が本体達成 |
| E-0c 服好き基準 | G-3b image_quality |
| E-0d Knowledge OS | 体型反映(model選択)は G-7 |
| E-0e 対話型UI | 試着画像も対話の中(kind tryon)|
| E-0f 実商品試着主軸 | ★ ★ ★ ★ G-3 が最終達成(garment_image=実商品)|
| E-0g multi-source | G-3 は楽天先行・ZOZO/SSENSE は L2 後 |

---

## § H. ★ ★ ★ ★ ★ 法的注意(必読・doc 最重要部)

```
本設計調査は Claude Code が公開情報・FASHN 公式ドキュメントの一般構造・楽天アフィリエイト規約の
一般情報から整理したものであり、★ 最終的な法的判断・画像利用範囲・try-on 投入可否には
★ ★ ★ 弁護士・IP 専門家の確認、および ★ ★ ★ ★ ★ 楽天アフィリエイト窓口への直接照会が必須である。

特に以下は専門家確認 + 楽天直接照会なしに実行不可:
- 楽天商品画像の try-on 投入(AI 入力)
- try-on 出力画像(楽天商品を着せた生成画像)のユーザー表示
- 画像前処理(切抜き・背景除去・改変)
- 画像のキャッシュ・保存(FASHN は 24h 自動削除規約だが STYLE-SELF 側保存は別判断)

また model_image は ★ 権利クリアな素材(自前撮影 / ライセンス済 / 本人同意)であること。

★ Claude Code は FASHN の現行 model 名・params・楽天規約の画像 try-on 条項を live 確認していない。
本 doc の「FASHN は〜」「楽天規約は〜」はすべて「一般的傾向 + 要確認」であり、★ 法務文書ではない。
G-3a 実装着手前に、FASHN 公式 docs の最新仕様取得 + 楽天規約の画像 try-on 利用可否を確定すること。
```

---

## § I. 不可侵境界線
- 本体 `ac834bb` / doc7 / 最終ビジョン `df36d82` / DNA 9文書 / 各設計案 / 既存実装(H-1〜G-2b)全0変更 → 本 doc は新規 1 件のみ。

---

## 検証(本 doc)
- ✅ コード 0 変更(doc 1 件のみ)/ tsc EXIT 0 維持 / 14 + 6 PASS 維持
- ✅ 本体 / 戦略文書(E-0a〜E-0g)/ 最終ビジョン / 各設計案 全 0 変更
- ✅ ★ 法的判断は専門家確認 + 楽天直接照会必須を §H に明示
