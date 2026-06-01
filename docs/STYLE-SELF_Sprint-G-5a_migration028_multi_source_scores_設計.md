# STYLE-SELF Sprint G-5a — migration 028 設計(external_products +4カラム・multi-source 本番価値基盤・★ 適用は G-5b)

- 作成日: 2026-06-01
- 起点 HEAD: `20e9412`(Sprint G-3 設計・clean / 14 + 6 PASS / tsc EXIT 0)
- 本 doc の役割: Sprint G-L2 §F で確定した external_products の +4 カラムを実 migration ファイル(`028_g5a_multi_source_scores.sql`)に落とす。**法務待ち(G-3a)と並行**で進める Layer 2 開始の必須前提(★ migration ファイル作成のみ・Supabase 適用は G-5b・コード 0 変更)
- ★ E-0g §3 multi-source カラムの実装第一歩

---

## § 0. 既存 external_products 全カラム(verify 済)

| 由来 | カラム |
|---|---|
| 004 | id / source / external_id / product_url / affiliate_url / name / brand / price / image_url / normalized_category / normalized_silhouette / normalized_taste[] / is_available / imported_at / synced_at / unique(source, external_id) |
| 017 | worldview_tags[] / body_compat_tags[] / curation_notes / curation_priority / curated_by / match_reason_template |
| 018 | normalized_colors[] / normalized_materials[] / axes(jsonb)/(旧 normalized_color/material は drop) |
| 019 | material_composition |

→ E-0g §3 希望の **大半が既存**。新規は **4 カラムのみ**(§B)。

---

## § A. migration 028 の位置づけ
- Sprint G-L2 §0「+14カラム想定は過大・実際は +4」の実体化
- 既存 14+ カラム・楽天同期データ(80 件規模)は **無変更**
- 適用は G-5b(別 sprint・Supabase 管理画面 or CLI)

---

## § B. +4 カラム SQL 設計(`028_g5a_multi_source_scores.sql`)
```sql
alter table public.external_products
  add column if not exists style_tags                text[]   not null default '{}',
  add column if not exists source_quality_score      smallint check (source_quality_score      between 0 and 100),
  add column if not exists image_quality_score       smallint check (image_quality_score       between 0 and 100),
  add column if not exists fashion_sensitivity_score smallint check (fashion_sensitivity_score between 0 and 100);
```
| カラム | 型 | 用途 | 評価時期 |
|---|---|---|---|
| style_tags | text[] default '{}' | スタイルタグ(E-0a 軸・worldview_tags と別) | G-7 |
| source_quality_score | smallint 0-100 | ソース信頼性(楽天=90/ZOZO=85)| 埋め戻し + ソース別既定 |
| image_quality_score | smallint 0-100 | try-on 適合度 | G-3b |
| fashion_sensitivity_score | smallint 0-100 | ★ E-0g 核心・服好き感度 | G-7(LLM+ベースライン)|

---

## § C. 既存楽天データ 埋め戻し戦略(論点G5a-1)
```sql
update public.external_products
set source_quality_score = 90
where source = 'rakuten' and source_quality_score is null;
```
- source_quality_score = **90**(Sprint G-L2 §D: 楽天 = 90)
- image_quality_score = **NULL**(G-3b で評価)
- fashion_sensitivity_score = **NULL**(G-7 で評価)
- style_tags = **'{}'**(default・G-7 で評価)
- → ★ スコア未評価は NULL で表現(0 と区別・「未評価」と「最低スコア」を混同しない)

---

## § D. 型・index・rollback
- **論点G5a-2 smallint vs integer**: ★ smallint(0-100 に十分・領域節約)+ CHECK(0-100)
- **論点G5a-3 index**: ★ composite `(source_quality_score desc, fashion_sensitivity_score desc)`(候補抽出の総合ソート用・Sprint G v2 §D)+ style_tags は gin(018 同型・将来のタグ絞り込み)
- **論点G5a-4 rollback**: ★ DOWN 手順を migration ヘッダコメントに記載(drop index → drop column ×4)

---

## § E. G-5b 適用計画(別 sprint・doc 内記述)
1. Supabase ダッシュボード SQL Editor で `028_*.sql` 実行(or `supabase db push`)
2. 確認: `\d external_products` で +4 カラム / 楽天行 source_quality_score=90 / 他 NULL
3. 既存 14 カラム・楽天データ無変更を確認
4. 失敗時: ヘッダの rollback 手順
5. ★ 適用後に `types/index.ts` の `ExternalProduct` 型へ 4 フィールド追記(★ G-5b で同時・本 G-5a では型は触らない=DB と型の不整合を避ける)

> ★ 重要: 型追記(`types/index.ts`)は ★ G-5b(適用と同時)で行う。G-5a で型だけ追記すると「型にあるが DB に無い」不整合期間が生まれるため、★ migration ファイル作成のみに留める。

---

## § F. G-6(ZOZO 統合)への布石
- `source` カラムは既存(text)→ ZOZO 統合時は `source='zozo'` で行追加(enum 化は任意・現状 text 運用)
- ZOZO の Affiliate データを正規化 → external_products に upsert(unique(source, external_id))
- source_quality_score = 85(ZOZO・Sprint G-L2 §D)
- → migration 029 は不要(source は text・既存カラムで ZOZO 行を持てる)。ZOZO 統合は ★ コード(クライアント + 正規化)中心

---

## § G. オーナー判断 4 論点(★ 推奨併記)
| # | 論点 | ★ 推奨 |
|---|---|---|
| G5a-1 | 埋め戻し値 | source=90 / image=NULL / sensitivity=NULL / style_tags='{}' |
| G5a-2 | smallint vs integer | **smallint**(0-100・領域節約)+ CHECK |
| G5a-3 | index | **composite(quality desc, sensitivity desc)** + style_tags gin |
| G5a-4 | rollback | **DOWN 手順をヘッダに記載** |

---

## § H. 4本柱 + E-0f/E-0g 整合
- E-0g §3 multi-source カラム → ★ G-5a が実装第一歩
- Sprint G-L2 §F プレビュー → 本 sprint で実体化(+4 確定)
- Sprint G v2 §C / §D → スコア 3 軸の DB 基盤

## § I. 不可侵境界線
- 本体 / DNA 9文書 / 各設計案 / 既存実装 / **既存 migration 001〜027** 全0変更 → 本 sprint は docs 新規1 + migration 028 新規1 のみ。
- ★ Supabase 未適用(G-5b)。`types/index.ts` 未変更(G-5b で適用と同時)。

---

## 検証(本 doc)
- ✅ コード 0 変更(.ts/.tsx 差分なし)/ migration ファイル 1 新規 / tsc EXIT 0 維持 / 14 + 6 PASS 維持
- ✅ 既存 migration 001〜027・本体・DNA 9文書・各設計案 全 0 変更
- ✅ ★ Supabase 未適用(G-5b で適用)
