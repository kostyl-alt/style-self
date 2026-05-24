# STYLE-SELF D1 — Sprint C-2 段階3 ビジョン拡張 設計調査(プロのファッション制作プロセス対応・案 A 採用・★ 実装は別工程)

- 作成日: 2026-05-24
- 起点 HEAD: `2a29c3a`(Sprint C-2 段階3-A 一覧画面・origin 保全済・clean / 399 PASS / tsc EXIT 0)
- 本 doc の役割: ビジョン文書(プロのファッション制作プロセス)を踏まえた MB 機能の **再設計調査**(★ **コード 0 変更・実装は段階3-B で別工程**)
- 上位連結:
  - Sprint C-1 設計案 [§2 機能要件](./STYLE-SELF_D1_Sprint_C-1_ムードボード設計調査.md)(`60b8d87`)= MB 機能 4 軸
  - Sprint C-2 段階1 [026_d1_moodboards.sql](../supabase/migrations/026_d1_moodboards.sql)(`ec12f7b`)= 現状スキーマ
  - Sprint C-2 段階2 [API 4 route + types/moodboard.ts](./STYLE-SELF_D1_Sprint_C-2_段階2_API_設計調査.md)(`7edd4cb` + `1c0a270`)= API 層完備
  - Sprint C-2 段階3-A [(app)/moodboard/page.tsx](../app/\(app\)/moodboard/page.tsx)(`2a29c3a`)= 一覧画面完成
  - ★ 本 doc = 段階3-B 詳細画面 + Sprint C-3 連鎖 への **ビジョン整合の橋渡し**

---

## 1. 背景

### 1.1 本 doc の位置づけ

段階3-A 完遂(`2a29c3a`)後、オーナーがビジョン文書(プロのファッション制作プロセス)を提示。本 doc では:
- ビジョン要素 × 現状スキーマ のマッピング
- 拡張案 A/B/C の比較
- ★ **案 A(最小拡張)** 推奨理由
- 段階3-B 詳細画面の UI 設計(★ プロセス誘導込み)
- Sprint C-3 連鎖の準備

を整理し、段階3-B 実装の **青写真** を origin 保全する。

### 1.2 ★ M5 刻む作法・既存実装無傷

- ★ 既存実装(段階1 + 段階2 + 段階3-A)を **破壊せず拡張** する方針
- スキーマ変更を最小化(本 doc 結論 = 案 A = ★ スキーマ変更なし)
- 段階3-B で UI 工夫(プレースホルダ文言・ガイド表示)でプロセス誘導

### 1.3 不可侵境界線(★ 厳守 / Sprint B-1〜C-2 段階3-A と同型)

1. 本体 `ac834bb` / コード / doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` / 各設計案(B-2 / B-3 / C-1 / C-2 段階1/2)/ 既存設計判断 1-10 ★ **全 0 変更**
2. 既存 migrations(001-026)/ 既存 API 4 route / types/moodboard.ts / 段階3-A 一覧画面 ★ **不変**
3. ③ プライバシー専章 / ③ コスト管理 / Phase 2 後ゲート ★ **diff 0 行**
4. リグレッションテスト **399 PASS 維持**(本工程はコード 0 変更)
5. tsc EXIT 0 維持
6. ★ 実装は別工程(段階3-B / Sprint C-3 で実施・本 doc では実装しない)

---

## 2. ★ ビジョン文書の整理

### 2.1 ファッション業界の制作プロセス

ビジョン文書の核心(オーナー提示):

```
① コンセプト
   ↓
② ムードボード(MB)
   ↓
③ キャスティング(モデル選定)
   ↓
④ ロケーション選定
   ↓
⑤ スタイリング(服選び)
   ↓
⑥ 撮影
```

★ **重要な指摘**:
- 「服 → コンセプト」は **初心者の発想**(服から世界観を逆算する)
- ★ 「コンセプト → 服」が **正解**(世界観を起点に服を選ぶ)
- → MB は **コンセプトを視覚化する場**(服を集める場ではない)

### 2.2 MB に必須要素 8

ビジョンが明示する MB 構成要素:

| # | 要素 | 役割 |
|---|---|---|
| 1 | モデル(性別 / 年齢 / 体型 / 雰囲気) | キャスティング想定 |
| 2 | ライフスタイル | コンセプト具体化 |
| 3 | ヘア | 印象構築 |
| 4 | メイク | 印象構築 |
| 5 | 服 | スタイリング |
| 6 | 光(自然光 / 人工光 / 夕方 等) | 雰囲気 |
| 7 | ロケーション(海岸 / 室内 等) | 世界観 |
| 8 | 色(カラーパレット) | 全体トーン |

### 2.3 トレンド観察フロー

```
Vogue / Pinterest 等トレンド観察
   ↓
参考画像保存(URL + 画像)
   ↓
ムードボード更新(集約・整理)
   ↓
コーデ提案(Sprint C-3 連鎖)
```

---

## 3. ★ ビジョン要素 × 現状スキーマ マッピング

### 3.1 現状スキーマ(`026_d1_moodboards.sql` + types/moodboard.ts)

```typescript
// moodboards
{
  id: string;
  user_id: string;
  name: string;                // MB テーマ名
  description: string;         // 自由記述
  is_public: boolean;          // オプトイン公開
  worldview_tags: string[];    // 英語スラッグ snapshot(★ UI 非露出)
  worldview_keywords: string[];
  worldview_name: string;      // 日本語名
  cover_image_url: string;
  created_at / updated_at: string;
}

// moodboard_items
{
  id: string;
  moodboard_id: string;
  image_url: string;           // Storage public URL
  caption: string;             // 自由記述
  source_url: string | null;   // 参照元(Vogue / Pinterest 等)
  order_index: number;
  created_at: string;
}
```

### 3.2 ビジョン要素 × 現状スキーマ マッピング表

| ビジョン要素 | 現状対応 | ギャップ | 案 A 対応 |
|---|---|---|---|
| コンセプト記述 | `moodboards.description` | 構造化なし | ✅ description で対応(プレースホルダ誘導)|
| モデル(性別/年齢/体型/雰囲気) | なし | ★ 新列必要(案 B 案 C)| ✅ description 内自由記述で対応 |
| ライフスタイル | なし | ★ 新列必要(案 B 案 C)| ✅ description 内自由記述 |
| ヘア | `moodboard_items.caption` で対応? | 構造化なし | ✅ caption 内自由記述 / image 1 枚で表現 |
| メイク | 同上 | 同上 | ✅ caption 内自由記述 / image |
| 服 | 同上 | 同上 | ✅ caption 内自由記述 / image |
| 光(夕方 / 自然光等) | 同上 | 同上 | ✅ caption 内自由記述 / image |
| ロケーション(海岸 / 室内等) | 同上 | 同上 | ✅ caption 内自由記述 / image |
| カラーパレット | なし | ★ 新列必要(案 B 案 C)| ✅ description 内自由記述 / cover で表現 |
| 参考画像保存(Vogue 等) | `moodboard_items.image_url` + `source_url` | ✅ **対応済** | ✅ 既存 |
| テーマ別整理 | `moodboards.name` | ✅ **対応済** | ✅ 既存 |
| メインビジュアル | `moodboards.cover_image_url` | ✅ **対応済** | ✅ 既存 |

→ ★ **構造化されない要素(モデル/ライフスタイル/ヘア/メイク/光/ロケーション/カラーパレット)は description / caption 内 自由記述 で対応可能**

### 3.3 ★ 設計判断ポイント

| 観点 | 構造化(専用列) | 自由記述(description/caption 拡張) |
|---|---|---|
| 入力体験 | フォーム入力(初心者向け)| 1 つの文字列(自由度高)|
| LLM 連携(Sprint C-3) | JSON 構造化で渡せる | テキスト全体で渡す(LLM 解釈可)|
| スキーマ変更 | ★ 必要(migration 027)| ★ 不要 |
| MVP 速度 | 遅い(列追加 + 検証 + UI フォーム)| 速い(既存活用)|
| 将来漸進 | 一度に変更必要 | ★ **必要に応じて拡張可** |
| 既存データ影響 | 既存 row は null(問題なし)| 既存 row そのまま使える |

---

## 4. ★ 拡張案 A/B/C 比較

### 4.1 案 A: 最小拡張(現状スキーマで対応・★ 推奨)

#### 採用方針
- `moodboards.description` を ★ **コンセプト記述** として活用(モデル / ライフスタイル / カラーパレット 等を自由記述に含める)
- `moodboard_items.caption` を ★ **観察項目記述** として活用(ヘア / メイク / 光 / ロケーション 等の観察メモ)
- `cover_image_url` を ★ **メインビジュアル**(MB を象徴する 1 枚)
- ★ **スキーマ変更なし**(migration 027 不要)
- ★ **段階3-B UI でプロセス誘導**(プレースホルダ文言 / 例文 / ガイド表示)

#### メリット
- ★ 既存実装(段階1 + 段階2 + 段階3-A)**無傷**
- ★ 実装シンプル(段階3-B のみ)
- ★ 既存データへの影響ゼロ
- ★ 将来漸進的に案 B/C へ拡張可能(必要になってから)
- ★ Sprint C-3 連鎖は自由記述ベースで LLM 解釈可

#### デメリット
- ★ 構造化されない(検索 / フィルタは将来課題)
- ★ ユーザーが自由記述に「コンセプト / モデル / ロケーション」等を含める作法を学ぶ必要(プレースホルダ + 例文で誘導)

### 4.2 案 B: 中規模拡張(必要最小限の列追加)

#### 追加内容
```sql
-- migration 027 想定(★ 案 A 採用のため未作成)
alter table moodboards
  add column concept       text default '',         -- description と別の専用列
  add column color_palette text[] default '{}';     -- ["濃紺", "白"] 等

alter table moodboard_items
  add column category text;                         -- 'hair'/'makeup'/'clothes'/'location'/'lighting'/'color'/'reference'
```

#### メリット
- 構造化(Sprint C-3 連鎖で LLM に JSON で渡しやすい)
- カラーパレットが配列なので集計可能(将来 MB 検索)
- category で items を分類表示可能

#### デメリット
- ★ migration 027 必要(オーナー手作業)
- ★ API 改修(types + 4 route で +50-100 行)
- ★ 段階3-A 一覧画面で category バッジ表示等の改修必要
- MVP 速度低下

### 4.3 案 C: 大規模拡張(全要素を専用列)

#### 追加内容
```sql
-- migration 027 想定(★ 過剰設計のため未推奨)
alter table moodboards
  add column concept            text default '',
  add column model_description  text default '',  -- モデル
  add column lifestyle          text default '',
  add column hair_style         text default '',
  add column makeup_style       text default '',
  add column lighting           text default '',
  add column location           text default '',
  add column color_palette      text[] default '{}';

alter table moodboard_items
  add column category   text,
  add column annotation text default '';
```

#### メリット
- 完全構造化
- 各要素が独立してフィルタ / 集計可能

#### デメリット
- ★ **過剰設計**(MVP には重い)
- ★ 8 列追加 = 入力 UI も 8 フォーム必要 = ユーザー負担大
- ★ 案 B より migration / API / UI 改修規模 ×2
- ユーザーが慣れる前に全要素強制 = 離脱リスク

---

## 5. ★ 推奨判断: 案 A 採用

### 5.1 推奨理由(★ 5 件)

| # | 理由 |
|---|---|
| 1 | ★ 既存実装(段階1 + 段階2 + 段階3-A)**完全無傷**(M5 刻む作法・原則 3)|
| 2 | ★ スキーマ変更なし = migration 027 不要 = オーナー手作業ゼロ |
| 3 | ★ 段階3-B UI 工夫(プレースホルダ / 例文 / ガイド)で **プロセス誘導可能** |
| 4 | ★ ユーザーが慣れたら漸進的に案 B/C 拡張可能(必要になってから) |
| 5 | ★ Sprint C-3 連鎖は自由記述 → 段階 B prompt 注入で LLM が解釈可(既存 stylist-chat の 5 intent 拡張と同型) |

### 5.2 ★ Sprint C-3 連鎖の準備(案 A 前提)

#### 5.2.1 段階 B に渡す情報(案 A の自由記述ベース)

```typescript
// fetchMoodboardContext(supabase, userId, moodboardId)
//   → returns { mb, items }
const ctx = {
  mb: {
    name: "孤独な富裕層の夕方",                    // テーマ名
    description: "コンセプト: 25 歳富裕旅行者 / 海岸 / 夕方の光 / カラー: 濃紺・白・砂色",
    worldview_name: "ミニマル",                    // 既存 snapshot
    cover_image_url: "https://...",
  },
  items: [
    {
      image_url: "https://...",
      caption: "ヘア: 濡れ髪のラフな束ね",
      source_url: "https://vogue.com/...",
    },
    {
      image_url: "https://...",
      caption: "ロケーション: 海岸の白砂",
    },
    // ...
  ],
};
```

#### 5.2.2 prompt 注入例(★ A-6/A-6b 4 作法踏襲)

```
[ムードボードの世界観]
テーマ: 孤独な富裕層の夕方
コンセプト: 25 歳富裕旅行者 / 海岸 / 夕方の光 / カラー: 濃紺・白・砂色
世界観: ミニマル

[参考画像とメモ]
- ヘア: 濡れ髪のラフな束ね
- ロケーション: 海岸の白砂
- 光: 夕方の柔らかい逆光
- カラー: 砂色のリネンと濃紺

このムードボードに合うコーデを提案してください。
```

→ ★ LLM は自由記述から **構造化された世界観** を解釈してコーデ提案可能(GPT 系の自然言語解釈能力に依拠)

#### 5.2.3 案 A → 案 B 拡張時の影響

- 案 A で自由記述として書かれた内容 → 案 B 拡張時に **手動 or LLM 経由で構造化** 可能
- 既存 MB データは案 B 拡張後も `concept = '' / color_palette = '{}'` で互換維持
- ★ **案 A → 案 B はノーリスク**

---

## 6. ★ 段階3-B 詳細画面 UI 設計(案 A 採用前提)

### 6.1 画面構成

```
┌─ ヘッダ ─────────────────────────────┐
│ ← 戻る                MB 名             │
│                       [編集] [削除]    │
└───────────────────────────────────────┘

┌─ メインビジュアル ────────────────────┐
│                                         │
│       [cover 画像 or プレースホルダ]    │
│                                         │
│                       [公開バッジ]      │
└───────────────────────────────────────┘

┌─ コンセプト ──────────────────────────┐
│ Concept                                  │
│ 「孤独な富裕層 / 25 歳富裕旅行者 /     │
│  海岸 / 夕方の光 / 濃紺・白・砂色」   │
│                                         │
│ (description が空なら CTA ↓)            │
│ ┌─────────────────────────────────┐ │
│ │ ヒント: モデル・場所・光・色を     │ │
│ │ 1 つの記述で書いてみよう          │ │
│ │ 例: 「孤独な富裕層 / 海岸 / 夕方」│ │
│ │                  [編集 →]         │ │
│ └─────────────────────────────────┘ │
└───────────────────────────────────────┘

┌─ ムードボード要素 ───────────────────┐
│ Moodboard                  [+ 画像追加] │
│                                         │
│ ガイド(空時のみ):                    │
│ ┌─────────────────────────────────┐ │
│ │ ヘア / メイク / 服 / 光 /         │ │
│ │ ロケーション / カラー を集めよう  │ │
│ │ 例: Vogue / Pinterest から         │ │
│ └─────────────────────────────────┘ │
│                                         │
│ ┌───┐ ┌───┐ ┌───┐                  │
│ │img│ │img│ │img│ ... グリッド      │
│ └───┘ └───┘ └───┘                  │
│ caption: 「ヘア: 濡れ髪」              │
│ (各画像タップで caption 編集)         │
└───────────────────────────────────────┘

┌─ アクション ─────────────────────────┐
│ [チャットに渡す](Sprint C-3 で配線)  │
│ [この MB をコピー](将来)              │
└───────────────────────────────────────┘
```

### 6.2 ★ プロセス誘導 UI 工夫

| 場所 | 誘導 | 効果 |
|---|---|---|
| description 入力欄 placeholder | 「コンセプト: 例『孤独な富裕層 / 海岸 / 夕方 / 濃紺・白』」 | モデル/場所/光/色 を 1 文字列で書く作法を学習 |
| caption 入力欄 placeholder | 「観察メモ: 例『濡れ髪』『夕方の逆光』『砂色のリネン』」 | 1 枚の観察項目を絞って記述する作法 |
| 空の MB に CTA | 「Vogue / Pinterest から最初の参考画像を保存しよう」 | トレンド観察フローへの誘導 |
| items が 1-2 枚のとき | 「ヘア・メイク・服・光・ロケーション・色 を集めよう」ガイド | 必須要素 8 への意識付け |
| description 編集モーダル | 例文 3-5 件 inline 表示「孤独な富裕層 / 都会の夜 / ミニマル」 | コンセプト記述の幅を提示 |

### 6.3 ★ 段階3-B 機能リスト

- ✅ データ取得:`GET /api/moodboards/[id]`(items 含む)
- ✅ メインビジュアル表示(cover_image_url or プレースホルダ)
- ✅ コンセプト(description)表示 + 編集モーダル(`PATCH /api/moodboards/[id]`)
- ✅ items グリッド表示(`order_index` 順)
- ✅ 画像追加:file → `uploadMoodboardImage()` → `POST /api/moodboards/[id]/items`
- ✅ 画像 caption 編集モーダル(`PATCH /api/moodboards/[id]/items/[itemId]`)
- ✅ 画像削除(`DELETE /api/moodboards/[id]/items/[itemId]`)
- ✅ MB メタ編集モーダル(name / description / is_public / cover_image_url)
- ✅ MB 削除(`DELETE /api/moodboards/[id]` + 一覧画面に戻る)
- 🟡 「チャットに渡す」ボタン(Sprint C-3 で配線・段階3-B では placeholder)
- 🟡 ガイド表示(空 MB / items 1-2 件時)
- 🟡 プロセス誘導 placeholder 文言

### 6.4 ★ 段階3-B 規模見当(★ 案 A 前提)

| 機能 | 行数 |
|---|---|
| データ取得 + 状態管理 | ~30 |
| メインビジュアル | ~20 |
| コンセプト表示 + 編集モーダル | ~80 |
| items グリッド + Card 子コンポ | ~80 |
| 画像追加(file → upload → POST) | ~70 |
| caption 編集モーダル | ~50 |
| MB メタ編集モーダル | ~80 |
| MB 削除 confirm | ~30 |
| プロセス誘導 UI(ガイド + placeholder)| ~40 |
| アクションボタン(チャットに渡す placeholder)| ~20 |
| ヘッダ + import + コメント | ~50 |
| **合計** | **+550 行**(目安 +400-600 行・段階3-A の 2 倍規模) |

時間: **60-90 分**(段階3 最大規模・段階3-A の 30-45 分の 2 倍)

---

## 7. ★ 既存達成への影響評価(★ コード 0 変更・全保持)

| 達成項目 | 想定影響 |
|---|---|
| 1.5b 完成形 / race fix v2 / L4-A / A-2 / A-3 / MVP-1c / A-4 / A-10 / A-6 / A-6b / A-5 / A-9 / Sprint B-1 / B-2 / B-3 / C-1 / C-2 段階1 / 段階2 / 段階3-A | **0**(コード 0 変更)|
| リグレッションテスト | **399 PASS 維持**(本工程はコード 0 変更)|
| 既存 v1 各 intent API + UI | **0** |
| 既存 migrations(001-026)| **0**(★ 案 A は migration 027 不要)|
| `lib/storage.ts` / `lib/utils/image-pipeline.ts` | **0**(参照 only) |
| `types/moodboard.ts` / API 4 route | **0**(参照 only) |
| `app/(app)/moodboard/page.tsx`(段階3-A 一覧)| **0**(参照 only) |
| 本体 `ac834bb` 6 章 / 7 章 / 判断 6 | **diff 0 行** |
| 本体 `ac834bb` / doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` / 各設計案 | **diff 0 行** |
| 既存設計判断 1-10 | **文言不変** |

---

## 8. 推奨案(★ 結論)

### 8.1 推奨実装方針

- ★ 本工程 = 設計調査 doc 1 件のみ origin 保全
- ★ **案 A(最小拡張)採用** = スキーマ変更なし + 段階3-B UI でプロセス誘導
- ★ 段階3-B 実装 = 別工程(+550 行 / 60-90 分)
- ★ Sprint C-3 連鎖は **自由記述ベース** で設計(段階 B prompt 注入)
- ★ 区切り良い節目で止まる(M5 刻む作法・原則 3)

### 8.2 ★ 6 項目 結論サマリ

| 項目 | 結論 |
|---|---|
| ビジョン要素 × 現状マッピング | 必須要素 8 のうち ★ **3 つは既存対応(name/cover/参考画像)・5 つは description/caption 自由記述で対応可** |
| 拡張案 3 比較 | 案 A(最小・スキーマ変更なし)/ 案 B(中・列追加)/ 案 C(大・全構造化) |
| 推奨案 | ★ **案 A 採用**(既存無傷 + 漸進的拡張可能 + Sprint C-3 自由記述ベース対応可) |
| 段階3-B UI 設計 | ★ ヘッダ + メインビジュアル + コンセプト + items グリッド + アクション(★ プロセス誘導 placeholder + ガイド表示込み) |
| プロセス誘導 UI 工夫 | placeholder 5 箇所 + Empty CTA(Vogue/Pinterest 誘導)+ items 少時ガイド(必須要素 8) |
| Sprint C-3 連鎖準備 | ★ 自由記述 → 段階 B prompt 注入(LLM 解釈)・A-6/A-6b 4 作法踏襲で +130-230 行 / 1 セッション(Sprint C-1 §7 試算と整合) |

### 8.3 ★ 次工程

- 本 commit(設計 doc 1 件)→ オーナー判断 → origin 保全
- 次工程: 段階3-B 詳細画面 実装(★ +550 行 / 60-90 分)
- 段階3-B 完了 → 段階3-C 公開ルート(`(public)/m/[id]`)→ 段階3-D MoodboardPickerModal → 段階3-E InputAttachments 改修
- → 段階3 完遂 → Sprint C-2 完遂 → Sprint C-3 連鎖 → C-4 完成 → Phase 2 達成

---

## 9. 結論

| 観点 | 結論 |
|---|---|
| ★ ビジョン拡張 設計判断 | **★ 案 A(最小拡張)採用**(既存無傷 + UI 工夫でプロセス誘導 + 漸進的拡張可能)|
| 規模 | **+~400-500 行 / 30-45 分**(本 commit)+ 段階3-B 実装 +550 行 / 60-90 分(別工程)|
| 既存達成保持 | コード 0 変更で **全保持**(399 PASS 維持・tsc EXIT 0 維持) |
| ★ スキーマ | ★ **変更なし**(migration 027 不要)|
| ★ 段階3-B UI 青写真 | ★ **完遂**(プロセス誘導 placeholder + ガイド + アクション 全て設計済) |
| ★ Sprint C-3 連鎖 | ★ **自由記述ベース** で LLM 解釈可(prompt 注入例も提示) |
| ★ 次工程 | オーナー判断 → 本 commit origin 保全 → 段階3-B 実装(+550 行 / 60-90 分)|
| 不可侵 | 本体 6 章 / 7 章 / 判断 6 / コスト試算 / 整合性点検 / ロードマップ / 各設計案 / 既存設計判断 1-10 / 既存 migrations / API 4 route / types / 段階3-A 一覧 ★ **全不変** |

→ ★ **ビジョン拡張 設計青写真 完遂**(段階3-B 詳細画面 + Sprint C-3 連鎖の実装可能粒度確立)

---

## 10. 制約遵守チェックリスト

- [x] 新規 docs ファイル 1 件のみ(本 doc)
- [x] 本体 `ac834bb` / コード(app/api/lib/scripts/package.json/tsconfig.json)/ doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` / 各設計案(B-2 / B-3 / C-1 / C-2 段階1/2)/ 他 docs **全 0 変更**
- [x] 既存 migrations(001-026) **不変**
- [x] 既存 API 4 route / types/moodboard.ts / 段階3-A 一覧画面 **不変**
- [x] 本体 6 章 / 7 章 / 判断 6 diff 0 行
- [x] 既存設計判断 1-10 文言不変
- [x] view + grep + 静的解析のみ・実装なし
- [x] tsc EXIT 0 維持(本 doc は markdown のみ・コード 0 変更)
- [x] リグレッションテスト 399 PASS 維持(本工程はコード 0 変更)
- [x] 実装は ★ 別工程(本 doc では実施しない)
- [x] commit はあり / push はなし
