---
paths:
  # cwd 相対 / プロジェクト相対の両対応
  - "supabase/migrations/**"
  - "lib/supabase*.ts"
  - "app/api/**"
  - "types/database.ts"
  - "style-self/supabase/migrations/**"
  - "style-self/lib/supabase*.ts"
  - "style-self/app/api/**"
  - "style-self/types/database.ts"
---

# DB スキーマ・マイグレーション・Supabase 型バグ

## DBテーブル一覧

| テーブル | 用途 |
|---------|------|
| `users` | ユーザープロフィール・スタイル軸（`avoid_items text[]` 含む） |
| `wardrobe_items` | 手持ちアイテム（status / worldview_score / worldview_tags 含む） |
| `coordinates` | 保存済みコーデ |
| `external_products` | 楽天等の外部商品マスタ |
| `brands` | ブランドマスタ（worldview_tags / era_tags / maniac_level など・brand-learn のキュレーション源） |
| `inspirations` | 偉大な参照コンテンツ（designer / look / artwork / film / book） |
| `knowledge_sources` / `knowledge_rules` | 知識ベースの一次情報 / 判断ルール（concept_keyword→推奨色/素材/シルエット/小物/NG） |
| `ai_history` | AI履歴の統一テーブル（診断/相談/写真分析/理想コーデ） |
| `diagnosis_sessions` / `worldview_profiles` / `user_style_events` | 診断詳細 / 最新確定プロファイル(user_id 主キー) / 行動イベントログ |
| `chat_threads` / `messages` / `feedback` / `judgment_rules` | 対話AIスタイリスト基盤（H-1：スレッド / role=user/assistant・metadata jsonb / like/dislike 等 / 好み・NG・style_rule を次回生成に反映） |
| `moodboards` / `moodboard_items` | ムードボード本体 / 参考画像（`caption` + `vision` jsonb=画像ごとの構造化observed facts） |
| `moodboard_analysis` | MB の board単位 context object（worldview_core/colors/materials/silhouettes/mood/ng_elements/shopping_axis/styling_axis/**brief**/**signals**/**brand_translation** jsonb・1 MBに1行・再解析で上書き・RLSは親moodboards経由EXISTS。`signals`=Layer2 決定的集約 repeated/accent・`brand_translation`=A2 決定的ブランド翻訳 signals主軸→matchBrands） |
| `style_signals` | 写真分析の育成事実タグ（attributes jsonb・brand-facts の主 facts ソース） |

## マイグレーション（supabase/migrations/・連番）

001 初期(users/wardrobe_items/coordinates) / 002-003 wardrobe更新(season/taste→text[], status, worldview_*) / 004 external_products / 005-006 身体情報 / 007 users.worldview / 008 style_analysis / 009 brands(+初期20件) / 010 inspirations / 011 style_preference / 012-013 trends(+根拠) / 014 body_profile / 015 knowledge_sources・knowledge_rules / 016 ai_history / 017 product_curation / 018 product_multi_attrs(colors/materials配列・axes) / 019 material_composition / 020 diagnosis_v2(diagnosis_sessions/worldview_profiles/user_style_events) / 021 avoid_items / 027 H-1 chat基盤(chat_threads/messages/feedback/judgment_rules) ※022-026未記載 / 029 moodboard_analysis ※028未記載 / 030 styling_axis追加 / 031 style_signals / 032 moodboard_analysis.brief追加 / 033 moodboard_items.vision追加 / 034 moodboard_analysis.signals追加(Layer2 決定的集約) / 035 moodboard_analysis.brand_translation追加(A2 決定的ブランド翻訳 signals主軸→matchBrands)

⚠️ 新規マイグレーションは `add column if not exists` / 存在チェックで**破壊なし・冪等**にする（030/032/033/034/035 が前例）。RLS は親テーブル経由 EXISTS を踏襲。

## ⚠️ Supabase v2 型推論バグ（`as never`・全 insert/update 箇所で必要）
`.insert()` / `.update()` が `never` 型になるケースがある。回避策（既存パターン踏襲）:

```typescript
// Insert
type FooInsert = Database["public"]["Tables"]["foo"]["Insert"];
const data: FooInsert = { ... };
supabase.from("foo").insert(data as never)

// Update
supabase.from("foo").update({ field: value } as never)
```
（この1行原則は CLAUDE.md コーディングルールにも常時掲載。詳細はここ。）
