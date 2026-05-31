# STYLE-SELF Sprint G-2 — 商品候補 UI・チャット内カード・CoordinateReply 実商品参照発展 設計調査(★ E-0f/E-0g 整合の完成設計・H-4b1-b-1 流用・★ コード 0 変更・doc のみ)

- 作成日: 2026-05-31 夜
- 起点 HEAD: `e309687`(G-1 候補API・clean / 399 + 14 + 6 PASS / tsc EXIT 0)
- 本 doc の役割: G-1(`e309687`)の `/api/products/candidates` を **UI に接続**し、E-0f「実商品試着主軸」/ E-0g「multi-source・服好き感度」を ★ ユーザー体験として完成させる細部設計(★ コード 0 変更・実装は次の指示)
- G-2 = ★ 「商品が初めて UI に出る瞬間」= 戦略(E-0f/E-0g)が体験になる第一歩

---

## § 0. ★ 既存資産 verify 結果(2026-05-31)

| 項目 | 実態 | G-2 への含意 |
|---|---|---|
| `coordinate_v2`(H-4b1-b-1) | Message 判別共用体に存在・**items=架空コーデ方向性**・暫定 pre レンダ([page.tsx:725](app/(app)/ai/page.tsx#L725))・sessionIntent/editorScore 保持 | 破壊せず「方向性記述」として残す |
| G-1 `CandidatesResponse` | `{ moodboardId, candidates: ProductCandidate[], queriesUsed, fallbackText? }`・各候補に image_url/affiliate_url/price/category/score/reasoning | UI に流すデータ形(確定) |
| Message レンダ | `AssistantContent` が content.kind で分岐(text/reply/coordinate_v2/loading/error/intent-result) | ★ 新 kind 追加で商品カード表示 |
| quickActions 配線 | `AssistantActions`(actions.map→onClick→navigate)。**送信トリガは別**(handleSubmit) | 「商品を探す」は専用ハンドラが要る |
| privacy | `stripCanonicalSlugsRecursive`(G-1 で response 適用済) | カード表示は strip 済データ |

---

## § A. 既存資産(§0 集約)
対象: `types/coordinate-reply.ts` / `types/product-candidate.ts` / `app/(app)/ai/page.tsx`(Message/AssistantContent/handleSubmit)/ `components/chat/*` / E-0f §4・E-0g §F。

---

## § B. CoordinateReply 実商品参照発展(★ 論点G2-1・核心)

| 案 | 内容 | 評価 |
|---|---|---|
| A 既存保持 + productCandidates 追加 | CoordinateReply に `productCandidates` フィールド新設(items は方向性記述で残す) | 冗長・型と LLM 出力の二重管理 |
| B items[] 完全置換 | items→ProductCandidate[] | E-0f 直球だが H-4b1-b-1 改修大・LLM出力契約も再変更 |
| C ハイブリッド(productCandidateId 埋込) | CoordinateItem に id 任意付与 | 複雑・中途半端 |
| **★ D 別メッセージ kind**(推奨) | coordinate_v2 は不変(方向性)。**実商品候補は新 Message kind `products`(ProductCardList)** として「商品を探す」フローで別途生成 | ★ 関心分離・H-4b1-b-1 破壊ゼロ・E-0e 対話型統合・DB永続化可 |

★ **推奨 = 案D(案A の進化形)**。理由:
- coordinate_v2(LLM の世界観コーデ方向性)と 実商品候補(G-1 API の決定的データ)は**性質が違う**(生成物 vs 検索結果)→ 別メッセージが自然
- H-4b1-b-1 / CoordinateReply / stylist-chat route を**一切触らず**に実商品 UI を足せる(E-0f/E-0g を非破壊で実現)
- 「商品を探す」→ 新 `products` メッセージ追加 → 履歴に残り DB 永続化(H-4a)可能
- Sprint G v2 §I「H-4b1-b-1 の器を流用」も満たす(quickActions に「商品を探す」を生やす = 器の活用)

→ ★ Message に `{ kind: "products"; data: CandidatesResponse; ... }` を追加(types/product-candidate.ts の型を再利用)。

---

## § C. 商品カード UI

**ProductCard 表示要素**(E-0g §F / Sprint G v2 §F):
- 商品画像(image_url・aspect 3:4・null時プレースホルダ)
- 商品名(title・2行 truncate)
- 価格(price・`¥{toLocaleString}`・null時「価格未定」)
- reasoning(「なぜ合うか」・80-120字)
- ソースバッジ(★ ホバー時のみ・§F)
- 「この商品を試す」ボタン(G-3 連携・§E)
- 「購入ページ」リンク(affiliate_url・別タブ)

**レイアウト(論点G2-2)**: ★ 推奨 = **横長カード縦並びリスト**(画像左・情報右)。理由: reasoning(文)を読ませる E-0e 対話文脈に合う・チャット幅(flex-1)で破綻しない・モバイル縦スクロール自然。グリッドは画像偏重で reasoning が埋もれる。

**表示順(論点G2-3)**: ★ **カテゴリ別グループ(アウター→トップス→…)+ グループ内 score 降順**。G-1 は score 降順済 → UI でカテゴリ束ね。

**ProductCardList**: カテゴリ見出し + カード群 + 空状態(「条件に合う商品が見つかりませんでした」)+ queriesUsed をデバッグ折りたたみ(任意)。

---

## § D. チャット統合

**「商品を探す」ボタン配置(論点G2-4)**: ★ 推奨 = **案B(coordinate_v2 メッセージ内)主導線**。LLM がコーデ方向性を返した直後に「この方向性で商品を探す」ボタン → 会話の流れに自然。上部固定(案A)は moodboard 添付状態管理が要り G-2 では過剰。
- 実装: coordinate_v2 レンダ下に `SearchProductsButton`(moodboardId を渡す)。

**商品カード表示配置(論点G2-5)**: ★ 推奨 = **案A(新 `products` メッセージ)**。「商品を探す」押下 → loading メッセージ → `/api/products/candidates` → `products` メッセージに置換。E-0e 対話型統合・履歴永続化(H-4a の persist 経路を products kind 対応に)。

**送信ハンドラ**: quickActions(navigate)とは別に、`handleSearchProducts(moodboardId)` を新設(fetch → メッセージ append)。handleSubmit は触らない。

---

## § E. 「この商品を試す」ボタン(G-3 へのバトン・仕様確定のみ)
- G-2 では `TryOnButton`(productId + threadId 保持)の **UI と押下時の遷移仕様**まで。
- 押下 → `/api/products/tryon`(★ G-3 新規)→ 試着画像 → 新メッセージ。
- G-2 ではボタンを置き、onClick は仮(G-3 で接続)or disabled+「準備中」表示。

---

## § F. ソースバッジ(★ 確定論点 = ホバー時のみ)
- `SourceBadge`: ホバー/フォーカス時のみ出現・小サイズ・控えめ。
- 表記: rakuten→「楽天」/ zozotown→「ZOZO」/ ssense→「SSENSE」等(source→ラベルマップ)。
- 色分け(論点G2-7): ★ 推奨 = **色分けしない**(全て同じ控えめグレー)。E-0g「どこで買えるかより世界観」= ソースを目立たせない思想と整合。

---

## § G. ファイル影響

**新規 component(5)**:
| ファイル | 役割 |
|---|---|
| components/chat/ProductCard.tsx | 1商品カード(横長) |
| components/chat/ProductCardList.tsx | カテゴリ別リスト + 空/ローディング |
| components/chat/SearchProductsButton.tsx | 「商品を探す」 |
| components/chat/TryOnButton.tsx | 「この商品を試す」(G-3連携・G-2は仮) |
| components/chat/SourceBadge.tsx | ホバー時バッジ |

**編集(1-2)**:
| ファイル | 変更 |
|---|---|
| app/(app)/ai/page.tsx | Message kind に `products` 追加 / AssistantContent 分岐 / handleSearchProducts / coordinate_v2 下に SearchProductsButton / 永続化(H-4a)products 対応 |
| (types は product-candidate.ts 再利用・coordinate-reply.ts は ★ 触らない=案D) |

**合計: +300-450 行**(うち page.tsx 編集 +100-150)。

> ★ 案D 採用により `types/coordinate-reply.ts` は **0 変更**(productCandidates フィールド追加が不要)。Sprint G v2 §I の「H-4b1-b-1 流用」は「coordinate_v2 の下に商品導線を生やす」形で達成。

---

## § H. 段階分割(★ 推奨: G-2a/G-2b)
| 段階 | 内容 | 行数 | verify |
|---|---|---|---|
| **G-2a** | ProductCard / ProductCardList / SourceBadge(component 単体・モックデータでレンダ確認) | +150-200 | カードが正しく描画される |
| **G-2b** | page.tsx 統合(products kind / handleSearchProducts / SearchProductsButton / TryOnButton 仮 / 永続化) | +150-250 | 「商品を探す」→ 実 API → カード表示 → 履歴復元 |

依存 G-2a→G-2b。G-2a は既存に未接続(退行ゼロ)、G-2b で初めてユーザー体験が変わる。

---

## § I. オーナー判断 8 論点(★ 推奨併記)
| # | 論点 | ★ 推奨 |
|---|---|---|
| G2-1 | CoordinateReply 発展 | **案D 別メッセージ kind `products`**(coordinate-reply.ts 不変・H-4b1-b-1 非破壊) |
| G2-2 | カードレイアウト | **横長カード縦並び**(reasoning を読ませる) |
| G2-3 | 表示順 | **カテゴリ別 + 内 score 降順** |
| G2-4 | 「商品を探す」配置 | **案B coordinate_v2 メッセージ内**(会話の流れ) |
| G2-5 | カード表示配置 | **案A 新メッセージ**(E-0e統合・永続化) |
| G2-6 | 段階分割 | **G-2a/G-2b 分割** |
| G2-7 | ソースバッジ色 | **色分けしない**(控えめ・E-0g整合) |
| G2-8 | カード追加情報 | **G-2 では brand のみ任意表示**(material/silhouette は楽天生結果で空が多い→出さない) |

---

## § J. H-4b1-b-1 流用 詳細(Sprint G v2 §I 具体化)
- 「器」= coordinate_v2 + quickActions/customActions の JSON 構造化応答 → ★ **そのまま流用**(改修なし)
- 「中身の発展」= items[] を実商品に置換するのではなく、★ **coordinate_v2 の下に `SearchProductsButton` を生やし、押下で実商品 `products` メッセージを得る**形で E-0f/E-0g を反映
- quickActions(もっと不穏に 等)は coordinate 継続・「商品を探す」は実商品導線 → ★ 両立(対話で方向性を磨き、納得したら実商品へ)

---

## § K. 4本柱 + E-0f/E-0g 整合
| 文書 | G-2 での反映 |
|---|---|
| E-0a 表面真似禁止 | reasoning「○○を反映」(G-1 prompt 済) |
| E-0b-rev2 リアル試着 | 商品カード + 「試す」ボタン(G-3 へ) |
| E-0c 服好き基準 | reasoning 文体・score |
| E-0d Knowledge OS | reasoning 生成時(G-1/将来) |
| E-0e 対話型UI | ★ チャット内 products メッセージ統合 |
| E-0f 実商品試着主軸 | ★ ★ G-2 が体験本体(実商品が UI に出る) |
| E-0g multi-source | ★ ソースバッジ(ホバー・色分けなし) |

## § L. 不可侵境界線
- 本体 `ac834bb` / DNA 9文書 / 最終ビジョン `df36d82` 全0変更
- ★ 案D により `coordinate-reply.ts` / `stylist-chat route` / H-4b1-b-1 ロジックは **0 変更**(page.tsx は Message 型拡張 + 分岐追加のみ・既存 kind は不変)

---

## 検証(本 doc)
- ✅ コード 0 変更(doc 1 件のみ)/ tsc EXIT 0 維持 / 14 + 6 PASS 維持
- ✅ 本体 / DNA 9文書 / 最終ビジョン / 各設計案 全 0 変更
