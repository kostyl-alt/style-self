# STYLE-SELF D1 — リアル試着 MVP スコープ R-1〜R-3 設計調査(★ オーナー本意「リアル試着は使ってくれた人が欲しい機能・★ MVP 必須」反映・★ 設計のみ・★ 実装しない)

- 作成日: 2026-05-28
- 起点 HEAD: `e4fffdc`(Sprint D Phase 2 後ゲート評価 設計調査・origin 保全済・clean / 399 PASS / tsc EXIT 0)
- 本 doc の役割: ★ オーナー本意「リアル試着は ★ 利用者が必須化した機能・★ MVP に入れる・★ Phase 3 後回しは本意に反する」を反映した、R-1〜R-3 の **実装スコープ詳細設計**(★ **コード 0 変更・実装は別工程**)
- E-0b(`feac265`)で記録済の ★ オーナー壮大ビジョンを、★ R-1 から着工可能な粒度に具体化する設計案

---

## 1. 背景・オーナー方針(★ 最重要)

### 1.1 オーナー本意 verbatim(★ 改変禁止)

```
★ リアル試着は ★ 利用者が必須化した機能(本体判断 2)
★ ★ 「使ってくれた人の意見」= ★ MVP に入れる
★ ★ ★ Phase 3 後回しは ★ 本意に反する
```

### 1.2 Sprint D(`e4fffdc`)で確認済の前提

- ★ リアル試着 MVP R-1〜R-3 = GO 条件 4 件 **全充足**(コスト誤差レンジ / 既存資産流用 / 浅い変換禁止 / ビジョン明確化)
- ★ MVP は ★ 採寸値のみ(★ 顔写真は Phase 3)= プライバシー軽負荷
- ★ `users.body_profile`(Sprint 32 / `014_body_profile.sql`)既存流用可能

### 1.3 本 doc の不可侵境界線(★ 厳守)

- ★ 本体 `ac834bb` / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ / コスト試算 / 各 Sprint 設計案 ★ **全 0 変更**
- ★ ③ プライバシー専章(6 章)/ ③ コスト管理(7 章)/ Phase 2 後ゲート(判断 6)★ **diff 0 行**
- ★ 既存設計判断 1〜10 文言不変
- ★ コード 0 変更(設計のみ・実装は別工程)
- リグレッションテスト 399 PASS 維持 / tsc EXIT 0 維持

---

## 2. ★ A: R-1 user_body_profiles 実装スコープ詳細設計

### 2.1 既存 `users.body_profile` 構造の確認

#### 2.1.1 個別カラム(★ Sprint 9 / `005_sprint9_body_info.sql` + `006_sprint9_profile_update.sql`)

| カラム | 型 | 内容 | E-0b 必要項目との対応 |
|---|---|---|---|
| `height` | integer | 身長(cm)| ✅ E-0b §1.5「身長」直接対応 |
| `weight` | integer | 体重(kg)任意 | ✅ E-0b §1.5「体重」直接対応 |
| `body_type` | text | 骨格: straight/wave/natural/unknown | 🟡 体型分類(MVP では維持) |
| `body_tendency` | text | 体型傾向: upper/lower/balanced/slim/solid | 🟡 重心 + 体型を粗く表現 |
| `weight_center` | text | 重心: upper/lower/balanced | ✅ E-0b §1.5「重心」直接対応 |
| `shoulder_width` | text | 肩幅: wide/normal/narrow | ✅ E-0b §1.5「肩幅」対応(★ ただし定性のみ・cm 値なし)|
| `upper_body_thickness` | text | 上半身の厚み: thin/normal/thick | 🟡 体型補助 |
| `muscle_type` | text | 筋肉感: slim/standard/muscular/solid | 🟡 体型補助 |
| `leg_length` | text | 脚の見え方: long/normal/short | ✅ E-0b §1.5「脚の長さ感」直接対応 |
| `preferred_fit` | text | 目指すサイズ感: tight/just/relaxed/oversized | 🟡 MVP では維持 |
| `style_impression` | text | 見せたい印象 | 🟡 MVP では維持 |
| `emphasize_parts` | text[] | 強調したい部位 | 🟡 MVP では維持 |
| `hide_parts` | text[] | 隠したい部位 | 🟡 MVP では維持 |
| `fit_recommendation` | text | AI 生成の推奨サイズ感コメント | 🟡 R-2 と重複可能性 |

#### 2.1.2 jsonb カラム(★ Sprint 32 / `014_body_profile.sql`)

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS body_profile jsonb;
```

★ jsonb 構造(★ types/index.ts:302 `BodyProfile`):

```typescript
interface BodyProfile {
  height:         number;
  weight?:        number;
  bodyType:       "slim" | "standard" | "curvy" | "muscular";
  skeletonType:   "straight" | "wave" | "natural";
  concerns:       BodyConcern[];  // 7 種
  proportionNote?: string;
}

type BodyConcern =
  | "looks_young" | "short_legs" | "broad_shoulders" | "wide_hips"
  | "short_torso" | "top_heavy"  | "bottom_heavy";
```

#### 2.1.3 既存 RLS

- ★ `users` テーブルは `001_initial_schema.sql` で ★ 本人 FOR ALL 設定済
- → ★ `body_profile` / 個別カラム共に ★ 本人のみ閲覧可

### 2.2 ★ E-0b 必要項目との対比(★ 何が既にあり・何が新規か)

| E-0b §1.5 項目 | 既存カバー | 状態 |
|---|---|---|
| 身長 | `users.height` + `body_profile.height` | ✅ 既存 |
| 体重 | `users.weight` + `body_profile.weight` | ✅ 既存 |
| 肩幅 | `users.shoulder_width`(定性のみ) | 🟡 **cm 値が新規**(定性 wide/normal/narrow のみ既存) |
| ウエスト | なし | ❌ **新規** |
| 股下 | なし | ❌ **新規** |
| 首の長さ | なし | ❌ **新規** |
| 脚の長さ感 | `users.leg_length` | ✅ 既存 |
| 重心 | `users.weight_center` + `body_profile.bodyType` | ✅ 既存 |
| 体型の悩み | `body_profile.concerns`(7 種) | ✅ 既存 |

→ ★ **既存カバー 6 / 新規 3**(ウエスト・股下・首の長さの cm 値 + 肩幅 cm 値)

### 2.3 ★ R-1 実装方針(★ 拡張 or 新規)

#### 2.3.1 ★ ★ 推奨: 既存 `users.body_profile jsonb` を ★ **拡張**(★ 専用テーブル新規ではない)

★ 理由:
1. ★ 既存資産流用(DRY by design)= Sprint 32 既存 jsonb の拡張のみで完結
2. ★ 既存 RLS 流用(本人 FOR ALL)= プライバシー設計の追加 0
3. ★ 既存 stylist-chat MVP-1c 注入経路がそのまま使える(`extractBodyProfile` の拡張のみ)
4. ★ E-0b §3.1 マッピング表「DRY by design 効率: 中」と整合
5. ★ jsonb なら ★ マイグレーション最小(`022_body_profile_v2.sql` で拡張記録のみ)

#### 2.3.2 ★ jsonb 拡張案

```typescript
// types/index.ts:302 BodyProfile を拡張
interface BodyProfile {
  // 既存(Sprint 32)
  height:          number;
  weight?:         number;
  bodyType:        "slim" | "standard" | "curvy" | "muscular";
  skeletonType:    "straight" | "wave" | "natural";
  concerns:        BodyConcern[];
  proportionNote?: string;

  // ★ R-1 新規(E-0b §1.5)
  shoulderWidthCm?: number;     // ★ 肩幅(cm 値)
  waistCm?:         number;     // ★ ウエスト(cm)
  inseamCm?:        number;     // ★ 股下(cm)
  neckLength?:      "short" | "normal" | "long";  // ★ 首の長さ(定性)
}
```

→ ★ **既存フィールド 0 変更 + 新規 4 フィールド追加のみ**(★ 後方互換性 100%)

#### 2.3.3 ★ migration 設計(★ 1 ファイルのみ)

```sql
-- supabase/migrations/022_body_profile_v2.sql
-- Sprint R-1: body_profile jsonb 拡張(★ 個別カラム不要・jsonb のみ拡張)
-- ★ ALTER TABLE 不要(jsonb なので migration は ★ 記録のみ)
-- 既存 body_profile jsonb の構造を拡張するため、コード側 type 定義のみ更新。

-- 拡張フィールド(★ optional・後方互換 100%):
--   shoulderWidthCm: number    (肩幅 cm)
--   waistCm:         number    (ウエスト cm)
--   inseamCm:        number    (股下 cm)
--   neckLength:      'short'|'normal'|'long'
```

★ ★ ★ migration は ★ **記録のみ**(SQL DDL 0 行・jsonb なので拡張不要)。

#### 2.3.4 RLS(★ 既存流用・追加 0)

```sql
-- users テーブルの既存 RLS(001_initial_schema.sql):
--   create policy "Users can manage own data" on users for all using (auth.uid() = id);
-- → ★ body_profile も ★ 本人のみ閲覧/更新可
-- → ★ R-1 追加 RLS 不要
```

### 2.4 ★ R-1 実装規模

| 領域 | 規模 |
|---|---|
| `types/index.ts` BodyProfile 拡張 | +4 lines |
| `supabase/migrations/022_*.sql` 記録 | +15 lines(コメントのみ) |
| `app/(app)/self/page.tsx` 体型入力 UI 拡張 | +50〜100 lines |
| `app/api/profile/route.ts` PATCH 拡張(★ 既存) | +10〜20 lines |
| `extractBodyProfile`(stylist-chat) 拡張 | +5〜10 lines |
| **合計 R-1** | **+85〜150 lines** |

→ ★ ★ E-0b 想定「150-300 lines」より ★ 軽量(★ 既存資産流用が効いた)

---

## 3. ★ B: R-2 body_shape_analysis 設計

### 3.1 体型特徴 AI 言語化の目的

E-0b §1.5 Step 3:
> 体型特徴を AI で言語化(低身長/胴長/脚長/肩幅広/腰位置/重心)

★ 役割: ★ R-1 採寸値 → ★ 自然文「あなたは胴長 + 脚短めで、上半身に重心がある体型です。」

### 3.2 ★ 実装方針: ★ ルールベース ★ +(必要時のみ) Claude

#### 3.2.1 ★ ★ ★ 推奨: ★ ルールベース MVP(★ Claude 不使用)

★ 理由:
1. ★ ★ 既存 `lib/utils/body-rules.ts`(96 行)がほぼ完成形
   - height 帯アドバイス + skeletonType 別ルール + concerns 組合せルール
2. ★ R-2「体型特徴の言語化」= ★ 既存 `body-rules.ts` の出力を ★ 拡張するだけ
3. ★ ★ ★ コスト 0(★ Vision API 不使用・Claude API 不使用)
4. ★ ★ 決定論的(同一入力 → 同一出力)= テスト容易・リグレッション安定

#### 3.2.2 ★ 拡張内容

```typescript
// lib/utils/body-rules.ts 拡張:
// 既存 getBodyAdjustments(profile) は維持(後方互換 100%)。
// ★ 新規 describeBodyShape(profile): BodyShapeDescription を追加。

interface BodyShapeDescription {
  natural: string;        // ★ 自然文 1-2 段落(stylist-chat 注入用)
  features: string[];     // ★ 特徴タグ(低身長 / 胴長 / 脚短 / 肩幅広 / etc.)
}
```

★ ロジック(★ ルールベース):
- height ≤ 155 → 「低身長」タグ + 自然文「身長は低めの体型」
- shoulderWidthCm / 身長比 で 「肩幅広」/ 「肩幅狭」判定
- inseamCm / 身長比 で 「脚長」/ 「脚短」判定
- waistCm でくびれ強弱判定(任意)
- concerns 配列を自然文に変換

#### 3.2.3 ★ Claude 拡張は ★ R-2 完成後の判断

★ MVP では ★ Claude 不使用(★ コスト 0 / 既存資産流用)
★ 「ルールベースで物足りない」と判明 → ★ R-2 後の評価で Claude 追加判断

### 3.3 ★ R-2 実装規模

| 領域 | 規模 |
|---|---|
| `lib/utils/body-rules.ts` 拡張(`describeBodyShape` 追加) | +60〜100 lines |
| `app/(app)/self/page.tsx` 体型分析結果 表示 UI | +30〜50 lines |
| `extractBodyProfile`(stylist-chat) で `describeBodyShape` 呼出 | +5〜10 lines |
| **合計 R-2** | **+95〜160 lines** |

→ ★ ★ E-0b 想定「100-200 lines」と整合

### 3.4 ★ R-2 コスト評価

| 項目 | コスト |
|---|---|
| Vision API | **0**(★ 使わない) |
| Claude API | **0**(★ ルールベース) |
| Supabase ストレージ | 1 ユーザー 1 jsonb で数百 bytes |

→ ★ ★ ★ ★ コスト誤差レンジ(¥0/月/ユーザー)

---

## 4. ★ C: R-3 silhouette_rules 設計

### 4.1 体型別シルエットルールの目的

E-0b §1.5 Step 4:
> 体型ごとの似合う丈・重心・シルエット・靴・小物のルール

### 4.2 ★ 既存資産マッピング

| 既存 | 内容 | R-3 対応 |
|---|---|---|
| `lib/dictionaries/line.ts`(80 lines)| シルエット 10 種(オーバーサイズ / スリム / ワイド / テーパード / フレア / A ライン / I ライン / Y ライン / コクーン / クロップド)| ✅ シルエット ★ 辞書側 100% カバー |
| `lib/dictionaries/ratio.ts`(66 lines)| 比率 8 パターン | ✅ 比率 ★ 辞書側 100% カバー |
| `lib/utils/body-rules.ts`(96 lines)| concerns + skeletonType + height 別 推奨/回避 ルール | ✅ ★ R-3 ★ ルールエンジン 既存 |
| `lib/prompts/stylist-chat.ts` 良い例 5 | 低身長ロングコート 3 法則(縦比率演出)| ✅ ★ プロンプト DSL の起源 |

→ ★ ★ ★ R-3 は ★ ★ 既存資産で 90% 完成済(★ 残 10% = 拡張のみ)

### 4.3 ★ R-3 実装方針: ★ **既存 `body-rules.ts` 拡張 + 辞書連携**(★ ルール DB 不要)

#### 4.3.1 ★ ★ ★ 推奨: ★ ルール DB 不要 / 既存 `body-rules.ts` の prompt 注入を強化

★ 理由:
1. ★ ★ 既存 `body-rules.ts` の `CONCERN_RULES` + skeletonType 分岐が ★ ルールエンジンそのもの
2. ★ R-3「体型別ルール」= ★ 既存ルールを ★ ★ stylist-chat / coordinate prompt に注入するパスを強化するだけ
3. ★ ★ DB 新規不要 → ★ migration 0 / RLS 不要 / コスト 0
4. ★ E-0b §3.1 マッピング表「silhouette_rules: 辞書既存・ルール DB は新規」だが ★ MVP では ★ 辞書 + body-rules.ts で代替

#### 4.3.2 ★ 拡張内容

```typescript
// lib/utils/body-rules.ts 拡張:
// 既存 getBodyAdjustments(profile) を ★ 拡張(★ 後方互換維持):

interface BodyAdjustments {
  // 既存
  recommendedSilhouettes: string[];
  avoidElements:          string[];
  weightCenterAdvice:     string;
  heightAdvice:           string;

  // ★ R-3 新規
  recommendedLengths?:    string[];      // ★ 推奨丈(ロング/ミディ/クロップド)
  recommendedShoes?:      string[];      // ★ 推奨靴(厚底/濃色/etc.)
  recommendedAccessories?: string[];     // ★ 推奨小物(縦長ネックレス/縦ライン スカーフ/etc.)
}
```

★ ロジック例(★ 良い例 5「低身長ロングコート 3 法則」をルール化):
- `height ≤ 155` →
  - recommendedLengths: ["短丈トップス", "ロング丈アウター(縦比率演出)"]
  - recommendedShoes: ["厚底", "濃色"]
  - recommendedAccessories: ["縦長ネックレス", "縦ライン スカーフ"]

#### 4.3.3 ★ stylist-chat / coordinate prompt 注入

★ 既存 `extractBodyProfile` で `body_profile` jsonb 取得後、★ `getBodyAdjustments(profile)` で詳細ルール展開。
★ プロンプトに ★ 「体型別推奨/回避」セクション追加(良い例 5 の DSL を踏襲)。

### 4.4 ★ R-3 実装規模

| 領域 | 規模 |
|---|---|
| `lib/utils/body-rules.ts` 拡張(`recommendedLengths` 等) | +80〜150 lines |
| `app/api/ai/stylist-chat/route.ts` プロンプト注入拡張 | +30〜50 lines |
| `lib/prompts/moodboard-prompt.ts` プロンプト注入拡張(MB 連携) | +20〜40 lines |
| `app/(app)/self/page.tsx` 似合うシルエット表示 UI | +50〜100 lines |
| **合計 R-3** | **+180〜340 lines** |

→ ★ ★ E-0b 想定「200-400 lines」と整合

---

## 5. ★ D: 世界観フィッティング統合設計(★ 中核思想)

### 5.1 E-0b 中核思想 verbatim

```
- 黒が好きだから黒い服、の浅い提案は禁止
- ロングコートが世界観に合っても体型的に合わないなら代替案
- 体型を否定せず「その体型で一番世界観が成立する構造」を提案
- ★ 目的はバーチャル試着ではなく ★ 世界観フィッティング
```

### 5.2 ★ ★ ★ 統合点: ★ `buildMoodboardPrompt`(`2e10587`)に体型軸を追加

#### 5.2.1 現状(`2e10587`)

★ `lib/prompts/moodboard-prompt.ts:29` `buildMoodboardPrompt(mb)`:
- MB worldview / 必須要素 8 / 参考画像メモ / 11 項目応答形式 / 補完指示
- ★ ★ ★ **体型軸は未注入**(★ 統合ポイント)

#### 5.2.2 ★ ★ R-1〜R-3 完成後の統合設計案

```typescript
// lib/prompts/moodboard-prompt.ts 拡張(★ 後方互換維持):
export function buildMoodboardPrompt(
  mb: MoodboardWithItems,
  options?: { bodyProfile?: BodyProfile }   // ★ R-1〜R-3 で渡せるように
): string {
  // 既存(★ 100% 不変):
  //   - MB worldview / 必須要素 8 / 参考画像メモ / 11 項目 / 補完指示

  // ★ R-1〜R-3 統合(★ optional):
  if (options?.bodyProfile) {
    const adj = getBodyAdjustments(options.bodyProfile);
    const desc = describeBodyShape(options.bodyProfile);
    lines.push("");
    lines.push("[★ 体型プロファイル(世界観フィッティング軸)]");
    lines.push(`体型特徴: ${desc.natural}`);
    lines.push(`推奨シルエット: ${adj.recommendedSilhouettes.join(" / ")}`);
    lines.push(`推奨丈: ${(adj.recommendedLengths ?? []).join(" / ")}`);
    lines.push(`推奨靴: ${(adj.recommendedShoes ?? []).join(" / ")}`);
    lines.push(`避けたい要素: ${adj.avoidElements.join(" / ")}`);
    lines.push("");
    lines.push("★ 提案理由を「MB 由来」「体型補正由来」「世界観由来」の 3 分類で示してください。");
  }
  // ...
}
```

### 5.3 ★ ★ 既存 stylist-chat coordinate 注入(★ MVP-1c)との関係

★ 既存(`app/api/ai/stylist-chat/route.ts:300`):
- coordinate intent では `body_profile` 既に並列 SELECT + 注入済(MVP-1c)
- → ★ R-1〜R-3 拡張で ★ `body_profile` jsonb の追加項目が ★ 自動的に注入される

★ → ★ ★ ★ R-1〜R-3 拡張で ★ stylist-chat / coordinate は ★ ★ **コード 0 変更**(jsonb 拡張のみで反映)

### 5.4 ★ 統合実装規模

| 領域 | 規模 |
|---|---|
| `lib/prompts/moodboard-prompt.ts` 拡張(options.bodyProfile 注入) | +30〜50 lines |
| ChatPage 側で body_profile を MB プロンプト構築に渡す | +10〜20 lines |
| stylist-chat coordinate 注入(★ 自動・コード 0) | 0 lines |
| **合計 統合** | **+40〜70 lines** |

→ ★ E-0b 想定「50-100 lines」より ★ 軽量

---

## 6. ★ E: MVP スコープの再定義

### 6.1 ★ ★ MVP に含める範囲(★ オーナー本意反映)

| 項目 | MVP | Phase 3 |
|---|---|---|
| Phase 1 + 2(完成済) | ✅ | — |
| **R-1: 体型入力(`users.body_profile` jsonb 拡張)** | ★ ✅ | — |
| **R-2: 体型特徴 AI 言語化(ルールベース)** | ★ ✅ | — |
| **R-3: シルエットルール(`body-rules.ts` 拡張)** | ★ ✅ | — |
| **世界観フィッティング統合(体型 × 世界観 × MB)** | ★ ✅ | — |
| R-8+: 3D アバター・顔写真 | ❌ | ✅ |
| R-9+: 髪型・メイク・カラコン | ❌ | ✅ Phase 4 |

### 6.2 ★ ★ MVP リリースまでの追加工数

| Sprint | 実装内容 | 規模 | セッション数 |
|---|---|---|---|
| R-1 | user_body_profiles 拡張 + UI | +85〜150 lines | 1-2 |
| R-2 | body_shape_analysis(ルールベース) | +95〜160 lines | 1-2 |
| R-3 | silhouette_rules(body-rules.ts 拡張) | +180〜340 lines | 2 |
| 統合 | buildMoodboardPrompt 拡張 + ChatPage 連携 | +40〜70 lines | 1 |
| **合計** | **R-1〜R-3 + 統合** | **+400〜720 lines** | **5-7 セッション** |

→ ★ ★ E-0b 想定「+500-1000 / 4-6 セッション」より ★ 軽量(★ 既存資産流用が効いた)

### 6.3 ★ 既存 vs 新規の比率

★ 既存資産流用度:
- types/index.ts:302 `BodyProfile` → ★ 拡張のみ
- `body-rules.ts`(96 行) → ★ 拡張のみ
- `line.ts` + `ratio.ts` → ★ 100% 流用
- `stylist-chat` coordinate 注入 → ★ コード 0 変更
- `users.body_profile` jsonb → ★ 拡張のみ(★ DDL 不要)
- `users` RLS → ★ 流用(追加 0)

→ ★ ★ ★ ★ **既存 70% / 新規 30%**(★ DRY by design 効率: 高)

---

## 7. ★ F: 不可侵境界線・プライバシー確認

### 7.1 プライバシー(★ ★ ★ 採寸値のみ・顔写真は Phase 3)

| データ | MVP | Phase 3 |
|---|---|---|
| 身長 / 体重 / ウエスト / 肩幅 / 股下 / 首の長さ | ✅ | — |
| 写真 / 顔データ / 3D アバター | ❌(★ プライバシー軽負荷) | ✅(★ 規約整備後) |

★ → ★ ★ ★ ③ プライバシー専章(6 章)範囲内(★ 既存 `users` 本人 FOR ALL の流用のみ)

### 7.2 本体 `ac834bb` 判断 2「リアル試着 必須化済」との整合

★ 本体判断 2(オーナー定義):
> リアル試着は ★ 利用者が必須化した機能

★ → ★ MVP スコープに含める ★ 正当性 100%(オーナー本意直接対応)

### 7.3 本体 `ac834bb` 判断 6「Phase 2 後ゲート」との整合

★ 本体判断 6(GO 条件 4 件):
1. 外部 try-on API 選定 → ★ MVP は ★ 不使用(ルールベース)
2. コスト見積もり → ★ ¥0/月(★ Vision/Claude 不使用)
3. プライバシー設計確定 → ★ 採寸値のみ・既存 RLS 流用
4. 規約整備 → ★ 採寸値は既存規約範囲内(顔写真規約は Phase 3)

★ → ★ ★ ★ GO 条件 4 件 ★ 全充足(★ Sprint D `e4fffdc` で確認済)

---

## 8. ★ G: 検証(設計のみ)

| 項目 | 値 |
|---|---|
| 新規 doc | ★ 本ファイル 1 件のみ |
| コード変更 | ★ **0**(設計のみ・実装は別工程) |
| 本体 / 最終ビジョン / ロードマップ / コスト試算 / 各設計案 | ★ **全 0 変更** |
| ③ 専章 / ③ コスト / Phase 2 後ゲート diff | ★ **0 行** |
| 既存設計判断 1〜10 文言 | ★ **不変** |
| tsc | ★ EXIT 0(コード 0 変更) |
| リグレッションテスト | ★ 399 PASS 維持 |

---

## 9. 既存達成への影響評価(★ コード 0 変更・全保持)

| 既存達成 | 状態 |
|---|---|
| Sprint B-1 B-2 B-3 設計 | ★ 全保持 |
| Sprint C-1 C-2 C-3 C-4 設計 + 実装 | ★ 全保持 |
| Sprint D Phase 2 後ゲート評価 設計 | ★ 全保持 |
| Sprint E-0a / E-0b ビジョン記録 | ★ 全保持 |
| 399 PASS リグレッション | ★ 維持(本 doc コード 0 変更) |
| tsc EXIT 0 | ★ 維持 |

---

## 10. 結論

### 10.1 ★ ★ ★ R-1〜R-3 設計サマリ

| 項目 | 結論 |
|---|---|
| ★ R-1 設計 | ★ ★ `users.body_profile` jsonb 拡張(★ 専用テーブル不要・migration 記録のみ)|
| ★ R-2 設計 | ★ ★ `body-rules.ts` 拡張(★ ルールベース・Claude/Vision 不使用)|
| ★ R-3 設計 | ★ ★ `body-rules.ts` + `line.ts` + `ratio.ts` 既存活用(★ ルール DB 不要)|
| ★ 統合 | ★ ★ `buildMoodboardPrompt` に optional `bodyProfile` 注入(★ 後方互換 100%)|
| ★ MVP スコープ | ★ ★ R-1〜R-3 + 統合 = ★ ★ MVP 必須(★ オーナー本意反映)|
| ★ Phase 3 | R-8+(3D アバター・顔写真)/ Phase 4(髪型・メイク・カラコン) |
| ★ 実装規模 | ★ +400〜720 lines / 5-7 セッション |
| ★ プライバシー | ★ 採寸値のみ(★ 顔写真 Phase 3)= ③ 専章範囲内 |
| ★ コスト | ★ ¥0/月/ユーザー(★ Vision/Claude 不使用)= 誤差レンジ |
| ★ 本体判断 2 整合 | ★ ★ ★ オーナー本意直接対応 |
| ★ 本体判断 6 整合 | ★ GO 条件 4 件全充足(Sprint D で確認済) |

### 10.2 ★ 実装フロー(★ 推奨)

★ R-1 設計案 push → ★ オーナー承認 → ★ R-1 実装(1-2 セッション)→ tsc + 399 PASS + 実機 verify → push →
★ R-2 設計案 → 同様 → ★ R-3 設計案 → 同様 → ★ 統合設計案 → 同様 → ★ ★ MVP リリース

★ ★ ★ 「M5 刻む作法」厳守(★ 短い成功 → 検証 → 次の山)

---

## 11. 制約遵守チェックリスト

- ✅ 本体 `ac834bb` 全 0 変更
- ✅ 最終ビジョン `df36d82` 全 0 変更
- ✅ 整合性点検 `ddb86f7` 全 0 変更
- ✅ ロードマップ 全 0 変更
- ✅ コスト試算 `985d00b` 全 0 変更
- ✅ 既存設計判断 1〜10 文言不変
- ✅ ③ プライバシー専章 / ③ コスト / Phase 2 後ゲート diff 0 行
- ✅ 新規 docs 1 件のみ
- ✅ コード 0 変更
- ✅ 既存 SQL / Storage / RLS / API / UI / utility 全保持
- ✅ Vision API 不使用(R-2 ルールベース)
- ✅ Claude API 不使用(R-2 ルールベース)
- ✅ tsc EXIT 0(コード 0 変更)
- ✅ リグレッションテスト 399 PASS 維持

---

## 付録 A: ★ Sprint 番号付け案

| 候補 | 内容 |
|---|---|
| Sprint R-1 / R-2 / R-3 / R-統合 | ★ ★ ★ E-0b 命名規則直接踏襲(★ 推奨) |
| Sprint F-1 / F-2 / F-3 / F-4 | リアル試着新章扱い |
| Sprint E-1a / E-1b / E-1c / E-1d | Sprint E 配下統合 |

→ ★ オーナー判断材料(本 doc は ★ 命名を ★ R-1〜R-3 で記述)

---

## 付録 B: 起点 SHA / origin 状態

- 起点 HEAD: `e4fffdc`(Sprint D Phase 2 後ゲート評価)
- origin/main HEAD: `e4fffdc`
- ahead: 0(本 doc commit 前)
- working tree: clean
- リグレッション: 399 PASS
- tsc: EXIT 0
