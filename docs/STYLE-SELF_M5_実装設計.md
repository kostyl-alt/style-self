# STYLE-SELF M5 実装設計 — ②変換の空回り解消

作成日: 2026-05-18
位置づけ: ビジョン統合マップ MVP 最後の 1 ピース「M5」の実装設計。
          上位 = [docs/STYLE-SELF_ビジョン統合マップ.md](STYLE-SELF_ビジョン統合マップ.md)(②変換 本体)
ステータス: 設計確定。この順序で実装する。
前提: M1〜M4 完結(origin/main HEAD = `61f7136`)。M4 完結時点で **③繋がる** は揃ったが、
      **②変換**(診断 → 商品提案)が空回りしていることが M5-1 実データで確定。

---

## 0. M5 の本質

```
M1: 自分の世界観を「言葉にできる」(診断・①知る)
M2: その世界観を「人に見せられる」(公開プロフィール・③繋がる土台)
M3: 投稿を通じて世界観を「表現できる」(③繋がる基盤)
M4: 世界観で「人/投稿に出会える」(③繋がる本体)
M5: 自分の世界観に合う商品が「ちゃんと提案される」(②変換 本体)  ← ここを解消
```

M5 が無いと、診断結果に合う商品が見つからない=「世界観を知っても買うものに繋がらない」
という ②変換 の空回りが残り、MVP として完結しない。

---

## 1. 確定した設計判断(オーナー確定)

```
判断1: 真因 = 3 者語彙系統ズレ + 付与率 3.4% の二重構造
       (M5-1 で実測確定)

判断2: 統一先 = (a) coreTags 英語スラッグ体系
       理由: M4 で実証済(オーナーアンカー overlap 3/2/2/1/0 階段)・
       ユーザー側不変・有限の正規化語彙

判断3: ★設計思想B(最重要・世界観を潰さない)★
       conceptKeywords は二系統並列:
       - 詩的日本語(表示用・現状維持・「静謐」「古代ローマ」「孤独」等)
       - coreTags(マッチ用・新規併産・dark, minimal 等)
       詩的表現はビジョン「世界観の言語化」の核。マッチ都合で貧弱化させない。

判断4: 既存 manual 商品 3 件は手動で coreTags 正規化
       (スクリプト化しない・件数少のため誤判断より人の判断を信頼)

判断5: coreTags 辞書は既存流用(再定義しない)
       worldview-patterns.ts の coreTags + analyze-v2 で例示された拡張を
       そのまま正準辞書として採用
```

---

## 2. 真因の構造(M5-1 実測確定)

### 商品データ実測

```sql
-- M5-1 SQL① 結果
total:             87
worldview_tags 非空: 3
付与率:             3.4%
rakuten:           83(全て worldview_tags = '{}')
manual:            4(うち 3 が非空)
```

→ 楽天同期コード([sync-rakuten/route.ts](../app/api/admin/sync-rakuten/route.ts))に
worldview_tags 付与処理が **無い** ため、楽天で大量取り込んだ商品は全て空のまま蓄積。
手動キュレーション(AI 補助)で 1 件ずつ管理者がタグ付けした 3 件だけが非空。

### 3 者語彙の系統ズレ(M5-1 で完全確定)

| 場所 | 語彙体系 | 実例 |
|---|---|---|
| (a) `worldview_profiles.worldview_tags`(+ `posts.worldview_tags`) | **英語スラッグ**(coreTags + 拡張)| `dark, minimal, structured, deconstruction, refined, gothic, monochrome, avant-garde` |
| (b) `external_products.worldview_tags` | **日本語**(具体ジャンル名・自由形)| `クラシック, メンズライク, きれいめカジュアル, ユニセックス` |
| (c) `conceptKeywords`(Stage1 + knowledge-merge)| **日本語**(抽象キーワード・AI 自由生成)| `静謐, 古代ローマ, 孤独, 思想, Yohji Yamamoto` |

[product-match.ts:80-89](../lib/utils/product-match.ts#L80-L89) のスコアリングは
`t.includes(c) || c.includes(t)` の部分一致だが、(b)(c) が日本語でも語彙体系が違うため
偶然「ミニマル」「クラシック」等が両方に現れた時しかマッチしない = +40 点がほぼ
当たらない = 空回りの構造的根本。

---

## 3. M5 の隠れ地雷(M2-3 / M4-2 / M4-4 教訓を継承)

### 🔴 地雷1: プロンプト改修で既存正常系を壊す(M2-3「画面で見えなくても漏れる」型)

```
M5-2 で商品 AI プロンプト 3 経路を coreTags 統一に書き換えるとき、
既存の他フィールド(category / colors / materials / silhouettes / brands / axes /
material_composition / body_compat_tags / curation_notes / curationPriority 等)を
壊さない注意が必要。

該当ファイル:
- lib/prompts/extract-product-info.ts(URL→属性抽出)
- lib/prompts/analyze-product-image.ts(画像→属性抽出)
- lib/prompts/analyze-product-text.ts(本文→属性抽出)

対策:
- worldviewTags フィールドだけを書き換え・他フィールドの記述/JSON 形式は無変更
- diff で「変更行が worldviewTags 関連のみ」を確認
- 改修後の AI レスポンスを 1 件は手動 dryRun で他フィールドが壊れていないか確認
```

### 🔴 地雷2: coreTags 辞書の表記揺れ・閉集合性

```
analyze-v2 プロンプトには「など」が付いているため辞書は厳密には閉じていない:
  既存タグ語彙(minimal, dark, structured, refined, natural, sensual,
   futuristic, expressive, deconstruction, gothic, preppy, glam など)を優先

オーナーアンカー実値で確認できた拡張: monochrome, avant-garde

→ M5 の正準辞書は「coreTags(25 語)+ analyze-v2 拡張」を明示列挙する
  半閉集合とする(セクション 4)

対策:
- M5-2 のプロンプト改修時、辞書を明示列挙(コピペ可能な配列で)
- 「この辞書にない語は使わない」と明記
- 大文字小文字・ハイフン/アンダースコアの表記を強制(全て小文字・ハイフン区切り)
```

### 🔴 地雷3: 楽天バッチの AI コスト(M5-4)

```
楽天が 83 件 + 今後の取り込みで急増する可能性。
Claude API での worldview_tags 抽出は 1 件 ≒ 数円〜十数円。

対策:
- M5-4 着手前に「1 件あたりのコスト」を実測(1 件 dryRun・トークン数集計)
- 楽天 sync の hits 上限(現状 dryRun で 5 / 本番 20)と整合して総コスト見積もり
- バッチは段階導入(まず 5 件 → 20 件 → ロット)で段階確認
```

### 🔴 地雷4: product-match.ts スコアリング切替で既存スコアを壊す(M4-4「バグじゃない」型)

```
M5-3 で worldview スコアを部分一致 includes → coreTags 完全 overlap に切り替えるとき、
既存の他スコア要素(カテゴリ +50 / 色 +30 / 素材 +20 / キーワード +10 / 体型 +30 /
キュレーション +25 / curation_priority 0-20)を **絶対に触らない**。

該当ファイル: lib/utils/product-match.ts:42 (scoreProduct)

対策:
- 変更は worldview スコア(L80-89 周辺)のみ
- 他スコア要素のコード行・点数・条件は完全保持
- diff で「変更が worldview ブロック内のみ」を確認
- M5-3 完了後、テスト用にコンセプト 1 つで「他スコア要素が変わっていないこと」を実測
```

### 🔴 地雷5: 設計思想 B(詩的+coreTags 並列)の維持

```
M5-3 で conceptKeywords を coreTags 統一すると、概念翻訳の表現力が貧弱化する
危険がある(「静謐」「古代ローマ」のような詩的表現がスラッグに置き換わる)。

ビジョン「世界観の言語化」の核を潰す = M5 で M1 の成果を毀損する事故。

対策(設計判断3):
- concept-translate.ts プロンプトに新フィールド `worldview_tags` を追加(coreTags 集合から選ぶ)
- 既存の `keywords`(詩的日本語)は完全保持
- product-match.ts は併産された worldview_tags を使う(keywords は表示専用)
- レスポンス UI / ChiveTokyo 風の表現は変えない
```

### 🔴 地雷6: 既存 1.2%(実測 3 件)を coreTags に再付与するときの判断ミス

```
3 件の現値:
  ["クラシック", "メンズライク"]   → どの coreTags?
  ["きれいめカジュアル", "ユニセックス"]
  (もう 1 件は SQL② サンプルから不明)

「クラシック」→ refined?mature?intellectual? 解釈が分かれる。
誤判断するとマッチ結果が偏る。

対策:
- セクション 7 で「現値 → coreTags 案」を一覧化
- 最終判断はオーナーが商品の image/name を見て決める
- 自動化(スクリプト・AI 自動)はしない(3 件のみ・人の判断信頼)
```

---

## 4. coreTags 正準辞書(M5 統一先・確定)

[lib/knowledge/worldview-patterns.ts](../lib/knowledge/worldview-patterns.ts) の coreTags 全 8 パターン分から抽出した
**重複除去後の閉集合(25 語)** に、[analyze-v2-details.ts](../lib/prompts/analyze-v2-details.ts)
で例示された拡張・オーナーアンカー実値での拡張を **明示列挙** で追加した
**半閉集合(全 31 語)**。

### coreTags(8 パターン × 4 タグ → 重複除去 25 語)

```
quiet, minimal, intellectual, nostalgic,
clean, structured, refined, mature,
rebellious, raw, dark, expressive,
soft, romantic, approachable, open,
sensual, mysterious, heavy,
natural, relaxed,
futuristic, sharp,
youthful, light
```

### analyze-v2 / オーナーアンカーで観測された拡張(6 語)

```
deconstruction, gothic, preppy, glam, monochrome, avant-garde
```

### M5 統一辞書(31 語・小文字・ハイフン区切り)

```
quiet, minimal, intellectual, nostalgic, clean, structured, refined, mature,
rebellious, raw, dark, expressive, soft, romantic, approachable, open,
sensual, mysterious, heavy, natural, relaxed, futuristic, sharp, youthful, light,
deconstruction, gothic, preppy, glam, monochrome, avant-garde
```

→ M5-2 商品プロンプト・M5-3 concept-translate プロンプト・M5-3 product-match.ts は
この 31 語のみを正準辞書として扱う。新規追加は **辞書を物理ファイル化してから**
判断する(M5 完了後の運用課題)。

---

## 5. ステップ分割(確定)

### M5-2: 商品 AI プロンプト 3 経路を coreTags 統一 + 既存 3 件手動正規化

| 対象 | 変更 |
|---|---|
| [lib/prompts/extract-product-info.ts](../lib/prompts/extract-product-info.ts) | `worldviewTags` 出力仕様を「上記 31 語辞書から選ぶ・最大 5 個・小文字英語スラッグ」に書き換え |
| [lib/prompts/analyze-product-image.ts](../lib/prompts/analyze-product-image.ts) | 同上 |
| [lib/prompts/analyze-product-text.ts](../lib/prompts/analyze-product-text.ts) | 同上 |
| 既存 manual 商品 3 件 | Supabase Studio で手動 UPDATE。セクション 7 の対応表素案を基に最終はオーナー判断 |

**地雷対策**:他フィールド(category / colors / materials / silhouettes / brands /
axes / material_composition / body_compat_tags / curation_notes / curationPriority)
の記述・JSON 形式は **完全保持**。diff で worldviewTags ブロックのみ変わることを確認。

### M5-3: conceptKeywords 設計思想 B 並列化 + product-match スコアリング切替

| 対象 | 変更 |
|---|---|
| [lib/prompts/concept-translate.ts](../lib/prompts/concept-translate.ts) | 既存 `keywords`(詩的日本語)は **完全保持**。新フィールド `worldview_tags` を追加(31 語辞書から 0〜5 個・該当なしは空配列許容)|
| 型定義 `ConceptInterpretation` | `worldview_tags?: string[]` を追加(後方互換のため optional)|
| [lib/utils/knowledge-merge.ts](../lib/utils/knowledge-merge.ts) | 既存 `keywords` 経路はそのまま・並列で `worldview_tags` も生成する経路を追加(knowledge_rules に直接列がなければ空配列で OK)|
| [components/style/StyleTabs.tsx](../components/style/StyleTabs.tsx) | `/api/products/match` に `worldview_tags` も渡す(新フィールド・既存 `conceptKeywords` も維持)|
| [app/api/products/match/route.ts](../app/api/products/match/route.ts) | body で `worldview_tags` も受ける(ScoringContext 拡張)|
| [lib/utils/product-match.ts:80-89](../lib/utils/product-match.ts#L80-L89) | worldview スコア(+40)を **新ロジック**:`ctx.userWorldviewTags && product.worldviewTags` の **完全文字列 overlap 数**(M4 同型)に置き換え。tie-break と他スコア要素は **完全保持**(地雷4)|

**設計思想 B 維持**:既存の詩的 `keywords` は何も変えない。UI 表示も変えない。
**マッチ用 coreTags は完全に内部用** で UI には出さない(M4 と同じプライバシー作法)。

### M5-4: sync-rakuten に AI タグ付与バッチ組込

| 対象 | 変更 |
|---|---|
| [app/api/admin/sync-rakuten/route.ts](../app/api/admin/sync-rakuten/route.ts) | 楽天から取り込んだ各商品に対し analyze-product-text 相当を呼んで coreTags を AI 抽出・INSERT 時に worldview_tags 列を埋める |

**地雷対策(地雷3)**:着手前にコスト見積もり(1 件あたり ¥ + 楽天 sync hits 上限の組み合わせ)を出す。段階導入(5 → 20 → ロット)で進める。AI 失敗時は worldview_tags=空で fallback(取り込み自体は止めない)。

### M5-5(任意): 診断 → 商品 直接マッチ API

| 対象 | 変更 |
|---|---|
| `app/api/match/products/route.ts`(新規)| M4 `/api/match/users` と同型。`worldview_profiles.worldview_tags && external_products.worldview_tags` を `.overlaps()` で直接マッチ → サーバ側 overlap 数計算 → sort → 返却。プライバシー(worldview_tags 非露出)も M4 同型 |
| `app/(app)/home/page.tsx` or `/discover` の新タブ等 | 直接マッチを呼ぶ UI(配信面はオーナー判断)|

→ virtual-coordinate を経由しない「世界観 → 商品」最短経路。M5-2/M5-3/M5-4 完了後に
データが揃えば即作れる(任意・MVP 必須ではない・M5 完結後の余地として残す判断もあり)。

### 依存関係

```
M5-2(商品側統一・31語化)
  ↓ 商品 worldview_tags が coreTags になる
M5-3(concept+scoring 並列化)
  ↓ 3 者完全 overlap でマッチ動作
M5-4(楽天 AI バッチ)
  ↓ 網羅率 3.4% → ほぼ全量
M5-5(任意・直接マッチ API)
  ↓
M5 完結
```

---

## 6. 各ステップの完了条件・実機確認方法

| Step | 完了条件 | 実機確認 |
|---|---|---|
| M5-2 | プロンプト 3 経路で worldviewTags が 31 語辞書語のみを返す + 既存 manual 3 件が coreTags 化 | 管理者が新規商品 1 件を URL/画像/本文 3 経路で登録 → `worldview_tags` 値が辞書語のみであることを Supabase Studio で確認 |
| M5-3 | concept-translate が `keywords`(詩的)+ `worldview_tags`(coreTags)を並列出力 + product-match の +40 が完全 overlap で動く + 他スコア要素無変更 | オーナー診断結果でコーデ提案 → 商品マッチ結果が以前と「カテゴリ/色/素材スコアは同じ・世界観スコアの当たり方だけ変わる」ことを score ログで確認 |
| M5-4 | sync-rakuten の取り込み結果で worldview_tags が AI 自動付与される + コスト実測値が見積もり内 | dryRun=5 で 5 件に AI タグが付くこと + 本番 20 件でも辞書語のみであることを確認 |
| M5-5(任意)| `/api/match/products` が `is_public=true` 商品から overlap 順で返す + worldview_tags 漏洩ゼロ | M4 と同じ手順(fetch + View Source 漏洩点検)|

**M5 全体ゴール(オーナー実機確認)**:
オーナーが診断 → コーデ生成 → 商品提案を開き、**実際に世界観に合う商品が出る**
ことを目視で確認できる(現状は語彙ズレ + 付与率低で出ない)。

---

## 7. 既存 manual 3 件の coreTags 正規化 対応表(素案)

> 最終はオーナーが商品画像 / 商品名を見て確定する。本表は議論の叩き台。

| 現値(M5-1 SQL② サンプル) | coreTags 正規化案(31 語辞書から) | 根拠 |
|---|---|---|
| `["クラシック", "メンズライク"]` | `["refined", "mature", "structured"]` | クラシック = 構造性 + 大人っぽさ。メンズライク = sharp/structured 系 |
| `["きれいめカジュアル", "ユニセックス"]` | `["clean", "approachable", "minimal"]` | きれいめ = clean、カジュアル = approachable、ユニセックス = minimal(中性)|
| (3 件目・SQL② 切れた値) | (要確認)| オーナーが Supabase Studio で 3 件目の現値を確認後、coreTags を決定 |

### 正規化の手順(M5-2 サブステップ)

```sql
-- 1. 現値の確認
select id, name, brand, worldview_tags
from public.external_products
where source = 'manual' and array_length(worldview_tags, 1) > 0;

-- 2. オーナーが各行の画像・名前を見て coreTags を選択

-- 3. 個別 UPDATE
update public.external_products
set worldview_tags = ARRAY['refined', 'mature', 'structured']::text[]
where id = '<the row id>';

-- 4. 結果検証
select id, name, worldview_tags from public.external_products
where source = 'manual' and array_length(worldview_tags, 1) > 0;
```

スクリプト化はしない(3 件のみ・人の判断信頼)。

---

## 8. スコープ外(M5 でやらないこと)

```
- coreTags 辞書のファイル化(独立 .ts に切り出す)
  → M5 完了後の運用課題。M5 ではプロンプト内列挙で十分
- 商品 worldview_tags の手動キュレーション UI
  → M5-4 で AI 自動付与すれば管理者の手動編集需要は減る
- 「英語スラッグ↔日本語」変換マップ
  → 設計思想 B で並列保持するため不要
- ZOZO 連携の復活 / 別 EC ソース追加
  → 楽天が現役。M5 完結後の話
- マッチ結果の AI 自然文化(「あなたの dark にこの商品の structured が響き合う」等)
  → 将来。MVP は数値表現/従来 reason 文字列で十分
- 商品 worldview_tags の M4 直接マッチ(M5-5)を MVP 必須にする
  → 任意。virtual-coordinate 経由(M5-3)で出れば本筋の空回りは解消
```

---

## 9. M3 / M4 由来パターンの踏襲(明記)

M5 は以下を完全踏襲する:

| パターン | 出典 | M5 で使う場所 |
|---|---|---|
| 「推測で直さず実物根拠で真因確定」 | M3-5 6bd309dd / M4-2 RLS / M4-4 "バグじゃない" | M5-1 で SQL 実測で確定済・M5-2/3/4 でも同様 |
| ★worldview_tags をユーザー UI に露出しない | M2-3 量産型漏洩 / M4-2 教訓 | M5-3 で product-match の coreTags は内部用・UI は詩的 keywords のまま |
| 既存系を壊さない最小差分 | M3-5 / M4-4 タブ追加 | M5-2 はプロンプトの worldviewTags ブロックのみ・M5-3 は scoring の +40 ブロックのみ |
| anon client + RLS + 列絞り + 自己除外 | M3-4 / M4-2 / M4-3 | M5-5 を作るなら同型(`/api/match/products`)|
| service_role 不使用 | M3 全体 / M4 全体 | M5 全体 |
| 設計→実装→実機確認→docs 記録 の型 | M2-5 / M3-5 / M4-5 | M5 完結時に docs/STYLE-SELF_M5_実装設計.md に「知見」を追記 |

---

## 10. このドキュメントの位置づけ

```
docs/STYLE-SELF_ビジョン統合マップ.md(最上位)
  ├ STYLE-SELF_診断システム_再設計.md(①知る 思想)
  ├ STYLE-SELF_フェーズB_実装設計.md(①知る 実装・完了)
  ├ STYLE-SELF_M2_実装設計.md(③繋がる 土台・完了)
  ├ STYLE-SELF_M3_実装設計.md(③繋がる 基盤・完了)
  ├ STYLE-SELF_M4_実装設計.md(③繋がる 本体・完了)
  ├ STYLE-SELF_M5_実装設計.md(このファイル・②変換 本体・MVP 最後の 1 ピース)
  └ M4_test_data_ledger.md(検証データ台帳)

M2 / M3 / M4 と同じ「調査→設計→ステップ実装」の型。
M5 は 4 ステップ(M5-2〜M5-5 任意)で進める。M5-1 は完了済(本ドキュメント作成で確定)。
```
