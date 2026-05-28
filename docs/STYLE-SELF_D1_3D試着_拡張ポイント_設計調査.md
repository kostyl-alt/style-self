# STYLE-SELF D1 — 3D 試着 拡張ポイント 設計調査(★ オーナー本意「服 3D は需要が出たら作る・拡張ポイントを先に用意してスムーズに対応できるように」・★ 設計のみ・実装しない)

- 作成日: 2026-05-28
- 起点 HEAD: `2ecdb26`(リアル試着 MVP R-1〜R-3 設計調査・origin 保全済・clean / 399 PASS / tsc EXIT 0)
- 本 doc の役割: ★ オーナー本意「服 3D データは世の中になく最難関・★ 今は完全実装しない・★ ★ ただし顧客の意見が多かったら作れる構造を ★ 先に用意」を ★ 拡張ポイント設計として記録(★ **コード 0 変更・実装は別工程**)
- E-0b(`feac265`)「3D 試着は将来の拡張ポイントとして API 連携できる構造」の ★ **具体化**

---

## 1. オーナー方針 verbatim(★ 改変禁止)

```
★ 服 3D データ = 世の中にない・最難関
★ ★ だから ★ 今は完全実装しない
★ ★ ★ ただし ★ 「顧客の意見が多かったら作れる」構造を ★ 先に用意
★ ★ ★ ★ 意見が出たら ★ スムーズに対応
```

### 1.1 E-0b との位置関係

| E-0b 記述 | 本 doc での対応 |
|---|---|
| 「3D アバター生成 API や SMPL 系モデル連携できる設計」(§1.3)| ★ §4 API 抽象化設計 で具体化 |
| 「商品側 3D データ揃えばアバター上で服表示」(§1.7)| ★ §3.2 DB 予約 + §4 抽象化 で具体化 |
| 「Meshcapade / SMPL 系モデル連携想定」(§1.7)| ★ §4.2 ベンダー差し替え可能 で具体化 |
| 「サイズ推薦 / 360 度確認 / 顔・髪型・メイク・カラコン」(§1.7)| ★ §5 段階的実現ロードマップ で具体化 |

→ ★ ★ ★ E-0b ビジョンの ★ **拡張ポイント部分の具体化**(★ コード 0 変更)

### 1.2 不可侵境界線(★ 厳守)

- ★ 本体 `ac834bb` / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ / コスト試算 / 各 Sprint 設計案 ★ **全 0 変更**
- ★ ③ プライバシー専章(6 章)/ ③ コスト管理(7 章)/ Phase 2 後ゲート(判断 6)★ **diff 0 行**
- ★ 既存設計判断 1〜10 文言不変
- ★ コード 0 変更(設計のみ)
- ★ リグレッションテスト 399 PASS 維持 / tsc EXIT 0 維持

---

## 2. ★ A: 3D 試着の段階構造の整理

### 2.1 3D 試着の部品分解(★ 4 部品)

| 部品 | 内容 | 実現可能性(今) | 実現可能性(将来) | 依存 | 拡張ポイント化 |
|---|---|---|---|---|---|
| **部品 1: 3D 体型アバター** | SMPL / Meshcapade で採寸値から ★ 3D メッシュ生成 | 🟡 ★ 外部 API 利用なら可能(料金確認必要)| ✅ 業界標準 SMPL 確立済 | Meshcapade API or SMPL OSS | ★ ★ **可能** |
| **部品 2: 3D 表示(360 度回転・WebGL)** | three.js / R3F でブラウザ上に 3D 表示 | ✅ ライブラリ確立 | ✅ 同左 | three.js(MIT)| ★ ★ **可能** |
| **部品 3: 服 3D データ** | コーデ提案アイテムの ★ 3D メッシュ・テクスチャ | ❌ ★ ★ ★ **世の中にない**(★ 最難関) | 🟡 商品 3D 提供増加に依存 | 楽天 / ZOZO / ブランド側 3D 提供 | ★ ★ **可能(空き口のみ)** |
| **部品 4: 物理シミュレーション(服を着せる)** | 布シミュレーション(風 / 重力 / 接触)| ❌ ★ 部品 3 がないと無意味 | 🟡 部品 3 揃えば可能 | 部品 3 + three-cloth / cannon.js | ★ ★ **可能(空き口のみ)** |

★ ★ ★ **結論**: 部品 1+2 は ★ 今でも実現可能 / 部品 3+4 は ★ ★ 世の中の前提データ次第(★ 需要が出てから着手)

### 2.2 部品ごとの拡張ポイント化判定

| 部品 | 拡張ポイントとして用意 |
|---|---|
| 部品 1(3D 体型アバター) | ★ ★ DB 予約 + API 抽象化(後述 §3.2 + §4) |
| 部品 2(3D 表示) | ★ コンポーネント境界定義(後述 §3.3) |
| 部品 3(服 3D データ) | ★ ★ DB 予約 `product.3d_model_url`(後述 §3.2) |
| 部品 4(物理シミュ) | ★ レンダラー差し替え抽象化(後述 §4.3) |

---

## 3. ★ B: 拡張ポイント設計(★ ★ 核心)

### 3.1 設計原則(★ 4 原則)

1. ★ ★ **「今は null・将来埋める」**: DB 予約フィールドは ★ 全 optional(★ jsonb / nullable column)= 既存運用 0 変更
2. ★ ★ **「インターフェース先 / 実装後」**: TypeScript interface 定義のみ・実装は ★ stub or 空関数
3. ★ ★ **「ベンダー差し替え可」**: Meshcapade / SMPL / try-on どれが来ても同じ口で繋ぐ
4. ★ ★ **「需要をデータで計測」**: フィードバックで「3D 試着欲しい」が N 件 → 段階 2/3 着手判断

### 3.2 ★ DB の拡張ポイント設計

#### 3.2.1 ★ `users.body_profile` jsonb への予約フィールド(★ 今 null・将来埋める)

```typescript
// types/index.ts BodyProfile に ★ optional 追加(R-1 拡張に ★ 追加で予約):
interface BodyProfile {
  // 既存(Sprint 32 + R-1 拡張・後方互換)
  height:          number;
  weight?:         number;
  bodyType:        ...;
  skeletonType:    ...;
  concerns:        BodyConcern[];
  proportionNote?: string;
  shoulderWidthCm?: number;
  waistCm?:         number;
  inseamCm?:        number;
  neckLength?:      "short" | "normal" | "long";

  // ★ ★ ★ 3D 試着 拡張ポイント(★ 全 optional・★ 今 null)
  avatar3d?: {
    provider?:   "meshcapade" | "smpl" | "custom";  // ★ ベンダー差し替え可
    modelUrl?:   string;       // ★ 3D メッシュ URL(Storage signed URL)
    smplParams?: Record<string, number>;  // ★ SMPL ベクトル(β / θ)
    generatedAt?: string;       // ISO timestamp
    consentVersion?: string;    // ★ プライバシー同意バージョン(将来再評価)
  };
}
```

★ ★ ★ migration ★ **DDL 0 行**(jsonb なので予約は ★ 型定義のみ)

#### 3.2.2 ★ `external_products` 拡張ポイント(★ 商品 3D データが来たら入れる)

```sql
-- ★ 拡張ポイント migration 候補(★ 段階 3 着手時に投入・今は ★ 0 行)
-- ALTER TABLE external_products
--   ADD COLUMN IF NOT EXISTS model3d_url text,             -- ★ 商品 3D メッシュ URL
--   ADD COLUMN IF NOT EXISTS model3d_format text,          -- ★ glb / gltf / fbx
--   ADD COLUMN IF NOT EXISTS model3d_metadata jsonb;       -- ★ サイズ / 素材 / 物理パラメータ
```

★ ★ ★ 今は ★ **migration 作成しない**(★ §5.2 段階 3 着手時に投入)

#### 3.2.3 ★ `user_style_events` 拡張ポイント(★ 需要計測・★ 既存テーブル流用)

★ Sprint 42 既存(`020_diagnosis_v2.sql:49`):
```sql
create table public.user_style_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  event_type text not null,    -- ★ 拡張ポイント: 「3d_request」「3d_demand_vote」追加可能
  payload jsonb,               -- ★ 詳細(どこから / 何を求めたか)
  created_at timestamptz not null default now()
);
```

★ ★ event_type に ★ 新規追加(★ migration 不要 / コード変更 0):
- `3d_avatar_request` — 3D アバター生成希望ボタン押下
- `3d_tryon_request` — 服 3D 試着希望
- `3d_demand_vote` — 需要投票

→ ★ **既存テーブル ★ 0 変更 ★ で需要計測可能**(★ DRY by design 完璧)

### 3.3 ★ コードの拡張境界設計

#### 3.3.1 ★ 関数境界: 「ここに 3D アバター生成が入る」

```typescript
// ★ lib/3d/avatar.ts(★ 段階 2 着手時に新規作成・★ 今は空 stub 設計のみ)
//
// ★ stub 設計(★ 実装しない):
//
// export interface AvatarGenerator {
//   generate(profile: BodyProfile): Promise<Avatar3dResult>;
// }
//
// export interface Avatar3dResult {
//   modelUrl: string;
//   smplParams?: Record<string, number>;
// }
//
// // ★ ベンダー差し替え可(★ Meshcapade / SMPL / 自作 OSS)
// // → ★ 段階 2 着手時に concrete 実装を 1 つ選んで実装

// MeshcapadeGenerator implements AvatarGenerator { ... }
// SmplGenerator implements AvatarGenerator { ... }
```

★ ★ ★ ★ **今は ★ ファイル作成しない**(★ コード 0 変更)= 設計のみ記録

#### 3.3.2 ★ 関数境界: 「ここに服 3D レンダリングが入る」

```typescript
// ★ lib/3d/tryon.ts(★ 段階 3 着手時に新規作成・★ 今は空 stub 設計のみ)
//
// export interface TryOnRenderer {
//   render(avatar: Avatar3dResult, garments: Garment3d[]): Promise<TryOnFrame>;
// }
//
// export interface Garment3d {
//   modelUrl:  string;       // ★ external_products.model3d_url
//   format:    "glb" | "gltf" | "fbx";
//   metadata?: Record<string, unknown>;
// }
//
// // ★ レンダラー差し替え可
// // - WebGL/three.js だけで完結する軽量 fit(物理シミュ無し)
// // - cannon.js / three-cloth 物理シミュ付き
// // - AI 画像 try-on(★ 道 B・★ 3D 不要・2D 合成)
```

#### 3.3.3 ★ コンポーネント境界: 「ここに 3D ビューワーが入る」

```typescript
// ★ components/3d/AvatarViewer.tsx(★ 段階 2 着手時)
// ★ components/3d/TryOnViewer.tsx(★ 段階 3 着手時)
//
// ★ 今は ★ UI 設計のみ:
// - app/(app)/self/page.tsx に ★ 「3D アバター(将来)」セクション placeholder のみ
// - ★ ★ Coming Soon バッジ + 需要投票ボタン(3d_demand_vote 記録用)
//   → ★ 拡張トリガー §5.1 のデータ源
```

### 3.4 ★ ベンダーロックイン回避(★ 設計原則)

| ベンダー | 用途 | 差し替え可能か |
|---|---|---|
| Meshcapade | 3D 体型アバター生成 | ✅(`AvatarGenerator` 抽象で差し替え可) |
| SMPL OSS | 同上(自前ホスト) | ✅(同上) |
| 楽天 / ZOZO 3D | 商品 3D データ | ✅(`Garment3d.modelUrl` で吸収) |
| try-on AI(★ 道 B)| 2D 画像 try-on(★ 3D 不要) | ✅(`TryOnRenderer` で差せる) |
| 自作 SMPL fit | 自前実装 | ✅(同インターフェース) |

→ ★ ★ ★ ★ **将来どの技術が来ても対応**(★ 抽象化が効いた)

---

## 4. ★ API 連携の抽象化設計

### 4.1 抽象化レイヤ(★ 3 層)

```
[UI 層]
   ↓
[抽象インターフェース層]  ← ★ AvatarGenerator / TryOnRenderer
   ↓
[ベンダー実装層]          ← MeshcapadeGenerator / SmplGenerator / AiTryOnRenderer
   ↓
[外部 API / OSS]          ← Meshcapade API / SMPL OSS / Stability AI try-on
```

★ ★ ★ ★ 「どの実装を選ぶか」は ★ 段階 2/3 着手時の判断(★ 今は決めない)

### 4.2 ★ Meshcapade / SMPL の差し替え設計

```typescript
// ★ ファクトリ関数(★ 段階 2 着手時)
export function createAvatarGenerator(
  provider: "meshcapade" | "smpl" | "custom"
): AvatarGenerator {
  switch (provider) {
    case "meshcapade": return new MeshcapadeGenerator();
    case "smpl":       return new SmplGenerator();
    case "custom":     return new CustomGenerator();
  }
}
```

★ ★ 環境変数 / DB 設定で ★ provider 切替可(★ 特定ベンダーロックイン回避)

### 4.3 ★ try-on(道 B・★ 3D 不要)も同じ口で繋ぐ

★ ★ 「3D 試着」と「AI 画像 try-on(2D)」は ★ 別技術だが、★ UI 体験は近い:

```typescript
// ★ 共通 try-on インターフェース(★ 段階 3 着手時):
export interface TryOnAdapter {
  type: "3d" | "ai_image_2d";    // ★ 切替可能
  render(input: TryOnInput): Promise<TryOnOutput>;
}

// 3D 実装(段階 3)
class Avatar3dTryOn implements TryOnAdapter { ... }

// AI 画像 2D 実装(★ 道 B・★ 段階 2.5 で先行可)
class AiImageTryOn implements TryOnAdapter { ... }
```

★ ★ ★ ★ ★ → ★ ★ 「3D 試着」が難しすぎても ★ ★ 「AI 画像 try-on」で先行可(★ 同インターフェース)

---

## 5. ★ C: 段階的実現ロードマップ

### 5.1 ★ 拡張トリガー設計(★ ★ 需要をデータで計測)

#### 5.1.1 計測手段(★ 既存 `user_style_events` 流用)

| event_type | 計測タイミング | 用途 |
|---|---|---|
| `3d_avatar_request` | 「3D アバター生成希望」ボタン押下 | 段階 2 着手判断 |
| `3d_tryon_request` | 「服 3D 試着希望」フィードバック | 段階 3 着手判断 |
| `3d_demand_vote` | Coming Soon 投票 | 全段階の需要把握 |

#### 5.1.2 ★ 着手判断閾値(★ オーナー判断の参考値)

| 段階 | 閾値候補 | オーナー判断材料 |
|---|---|---|
| 段階 2(3D 体型アバター)着手 | 例: 30 日で `3d_avatar_request` 100 件 | ★ オーナーが運用見て決める |
| 段階 3(服 3D 試着)着手 | 例: 30 日で `3d_tryon_request` 200 件 + 商品 3D データ入手 | ★ 同上 + 商品側 3D 提供普及 |

★ ★ → ★ ★ 「データで需要を見てから ★ 後出しじゃんけん」可能(★ オーナー本意「需要が出たら作る」直接対応)

#### 5.1.3 ★ Coming Soon UI の役割(★ 計測の入口)

★ `app/(app)/self/page.tsx` に ★ 「3D アバター(将来)」セクション:
- ★ Coming Soon バッジ + 機能説明
- ★ 「興味あり」投票ボタン → `3d_demand_vote` 記録
- ★ ユーザー教育 + 需要計測の ★ 二重効果

### 5.2 ★ 各段階の前提条件(★ 「着手条件」明示)

| 段階 | スコープ | 前提条件 | 想定規模 |
|---|---|---|---|
| **段階 1(★ MVP)** | R-1〜R-3 採寸値 + 世界観フィッティング | ★ ★ ★ 今すぐ着手可(R-1 設計案 `2ecdb26`)| +400〜720 lines / 5-7 セッション |
| **段階 1.5(任意)** | 3D アバター(横シルエット・服なし)| Meshcapade 料金確認 + three.js 導入 | +200〜400 lines / 2-3 セッション |
| **段階 2(★ 需要待ち)** | 3D 体型アバター(360 度回転)| ★ `3d_avatar_request` 閾値到達 + Meshcapade 料金確認 + 6 章 ③ プライバシー再評価 | +500〜1000 / 5-10 セッション |
| **段階 2.5(★ 任意)** | AI 画像 try-on(2D 合成・道 B)| ★ Stability AI / Replicate などの 2D try-on API 入手 | +300〜600 / 3-5 セッション |
| **段階 3(★ ★ 需要 + 商品 3D 揃ったら)** | 服 3D 試着(物理シミュ付き) | ★ 商品 3D データ普及 + 段階 2 完成 + `3d_tryon_request` 閾値到達 + 規約再整備 | +1000〜2500 / 10-20 セッション |

★ ★ ★ ★ ★ → ★ ★ 「段階 1 + 段階 2.5(AI 画像 try-on)」だけで ★ ★ MVP+α の擬似 3D 試着体験を ★ 短期実現可能

### 5.3 ★ 段階の組み合わせパターン(★ オーナー判断材料)

| パターン | 内容 | 規模 |
|---|---|---|
| ★ ★ 最小(★ 推奨) | 段階 1 のみ(R-1〜R-3 + 拡張ポイント設計記録) | 短期 |
| ★ 軽量拡張 | 段階 1 + 段階 1.5(横シルエット 3D・★ 服なし)| 中期 |
| ★ AI 画像 try-on 先行 | 段階 1 + 段階 2.5(2D 合成 try-on)| 中期 |
| ★ ★ 3D 本格 | 段階 1 + 段階 2 + 段階 3 | 長期(需要待ち)|

→ ★ ★ オーナー本意「今は完全実装しない・需要が出たら作る」= ★ ★ ★ **最小パターン推奨**

---

## 6. ★ D: プライバシー・コスト(★ 段階別)

### 6.1 段階別プライバシー

| 段階 | データ | プライバシー扱い |
|---|---|---|
| 段階 1(採寸値のみ) | 身長 / 体重 / 肩幅 / 股下 / etc. | ★ ★ ③ 専章範囲内(★ 既存 `users` 本人 FOR ALL 流用) |
| 段階 1.5(横シルエット 3D) | 採寸値 + 3D メッシュ(★ 顔なし)| ★ 同上(顔なし = 既存範囲内) |
| 段階 2(3D 体型・顔写真?) | 顔写真 → 3D 体型 | ★ ★ ★ **本体判断 6 GO 条件再評価**(顔写真 = 機微情報) |
| 段階 2.5(AI 画像 try-on)| 全身写真 / 商品画像 | ★ 同上(写真扱い再評価) |
| 段階 3(服 3D 試着) | 体型 3D + 服 3D | ★ 段階 2 が GO していれば追加負荷小(★ 写真は段階 2 で扱う) |

### 6.2 段階別コスト試算

| 段階 | 月額/ユーザー(粗算) | 内訳 |
|---|---|---|
| 段階 1 | ¥0 | ルールベース・既存 Vision/Claude 不使用 |
| 段階 1.5 | ¥+10〜30 | three.js は無料 / Meshcapade 試算次第(★ 段階 2 で精緻化) |
| 段階 2 | ¥+50〜200 | Meshcapade API 料金($0.05〜0.20/生成) |
| 段階 2.5 | ¥+30〜100 | Stability AI / Replicate try-on($0.02〜0.05/生成) |
| 段階 3 | ¥+100〜500 | 商品 3D ストレージ + 物理シミュ計算 |

★ ★ ★ → ★ ★ **段階 1 のみは ¥0 で誤差レンジ**(★ 現状 Sprint D 試算 ¥264 維持)

### 6.3 ★ 本体判断 6「Phase 2 後ゲート」との関係

| GO 条件 | 段階 1 | 段階 2 | 段階 3 |
|---|---|---|---|
| 外部 try-on API 選定 | ★ 不使用 | Meshcapade or SMPL | 段階 2 + 物理シミュ |
| コスト見積もり | ¥0(完全充足) | ★ 要試算(★ 着手時) | ★ 要試算(★ 着手時) |
| プライバシー設計確定 | ★ 既存範囲内 | ★ ★ 顔写真規約再整備 | 同左 |
| 規約整備 | 既存規約範囲内 | ★ ★ 規約改訂必須 | 同左 |

★ ★ ★ ★ → ★ ★ **段階 1 のみは Phase 2 後ゲート GO 条件 4 件全充足**(★ Sprint D `e4fffdc` で確認済)

---

## 7. ★ E: 検証(★ 設計のみ)

| 項目 | 値 |
|---|---|
| 新規 doc | ★ 本ファイル 1 件のみ |
| コード変更 | ★ **0**(設計のみ・★ stub すら書かない) |
| migration | ★ **0**(jsonb 予約は型定義のみ・★ ALTER 文 0 行) |
| 本体 / 最終ビジョン / ロードマップ / コスト試算 / 各設計案 | ★ **全 0 変更** |
| ③ 専章 / ③ コスト / Phase 2 後ゲート diff | ★ **0 行** |
| 既存設計判断 1〜10 文言 | ★ **不変** |
| tsc | ★ EXIT 0(コード 0 変更) |
| リグレッションテスト | ★ 399 PASS 維持 |

---

## 8. 既存達成への影響評価(★ コード 0 変更・全保持)

| 既存達成 | 状態 |
|---|---|
| Sprint B-1 B-2 B-3 設計 | ★ 全保持 |
| Sprint C-1 C-2 C-3 C-4 設計 + 実装 | ★ 全保持 |
| Sprint D Phase 2 後ゲート評価 | ★ 全保持 |
| Sprint E-0a / E-0b ビジョン | ★ 全保持 |
| ★ リアル試着 MVP R-1〜R-3 設計(`2ecdb26`) | ★ 全保持 |
| 399 PASS リグレッション | ★ 維持 |
| tsc EXIT 0 | ★ 維持 |

---

## 9. 結論

### 9.1 ★ ★ ★ 3D 試着 拡張ポイント設計サマリ

| 項目 | 結論 |
|---|---|
| ★ 3D 試着部品分解 | 部品 1(体型)+ 部品 2(表示)= 今でも可能 / 部品 3(服 3D)+ 部品 4(物理シミュ)= ★ 世の中の前提次第 |
| ★ ★ DB 拡張ポイント | `users.body_profile.avatar3d?`(★ jsonb 予約・★ DDL 0)+ `external_products.model3d_url?`(★ 将来 ALTER)|
| ★ ★ コード拡張境界 | `AvatarGenerator` / `TryOnRenderer` / `TryOnAdapter` インターフェース設計記録(★ 今は ★ コード作成 0)|
| ★ API 抽象化 | Meshcapade / SMPL / try-on AI / 自作 ★ 全差し替え可(★ ベンダーロックイン回避)|
| ★ 拡張トリガー | ★ 既存 `user_style_events` の event_type 拡張で需要計測(★ 既存テーブル 0 変更)|
| ★ 段階的実現ロードマップ | 段階 1(MVP)+ 段階 1.5(任意・3D 横シルエット)+ 段階 2(3D 体型・需要待ち)+ 段階 2.5(AI 画像 try-on)+ 段階 3(服 3D・需要 + 商品 3D 揃ったら)|
| ★ プライバシー段階設計 | 段階 1: ③ 専章範囲内 / 段階 2+: ★ 顔写真規約再整備必須 |
| ★ コスト段階設計 | 段階 1: ¥0 / 段階 1.5: ¥+10〜30 / 段階 2: ¥+50〜200 / 段階 2.5: ¥+30〜100 / 段階 3: ¥+100〜500 |
| ★ E-0b ビジョンとの整合 | ★ ★ ★ E-0b §1.3「3D アバター生成 API や SMPL 系モデル連携できる設計」を ★ ★ 具体化 |
| ★ ★ オーナー本意整合 | ★ ★ ★ ★ 「服 3D は需要が出たら作る・拡張ポイントを先に用意」直接対応 |

### 9.2 ★ 推奨フロー

★ 段階 1(R-1〜R-3 + 拡張ポイント設計記録)→ ★ MVP リリース → ★ user_style_events で需要計測 → ★ 閾値到達 → ★ 段階 2 or 2.5 着手判断(オーナー判断)→ 段階 3(★ 商品 3D 普及待ち)

★ ★ ★ ★ ★ → ★ ★ ★ ★ **「データで需要を見てから後出しじゃんけん」**(★ オーナー本意直接対応)

---

## 10. 制約遵守チェックリスト

- ✅ 本体 `ac834bb` 全 0 変更
- ✅ 最終ビジョン `df36d82` 全 0 変更
- ✅ 整合性点検 `ddb86f7` 全 0 変更
- ✅ ロードマップ 全 0 変更
- ✅ コスト試算 `985d00b` 全 0 変更
- ✅ 既存設計判断 1〜10 文言不変
- ✅ ③ プライバシー専章 / ③ コスト / Phase 2 後ゲート diff 0 行
- ✅ 新規 docs 1 件のみ
- ✅ コード 0 変更(★ stub すら書かない)
- ✅ migration ALTER 文 0 行(★ 全 ★ jsonb 予約 + 将来候補のコメント記述のみ)
- ✅ 既存 SQL / Storage / RLS / API / UI / utility 全保持
- ✅ tsc EXIT 0(コード 0 変更)
- ✅ リグレッションテスト 399 PASS 維持
- ✅ 実装は ★ 別工程(需要が出たら段階 2/3 着手)

---

## 付録 A: 起点 SHA / origin 状態

- 起点 HEAD: `2ecdb26`(リアル試着 MVP R-1〜R-3 設計調査)
- origin/main HEAD: `2ecdb26`
- ahead: 0(本 doc commit 前)
- working tree: clean
- リグレッション: 399 PASS
- tsc: EXIT 0

---

## 付録 B: ★ 用語集

| 用語 | 説明 |
|---|---|
| SMPL | Skinned Multi-Person Linear model(★ 業界標準の人体パラメータモデル・OSS) |
| Meshcapade | SMPL ベースの ★ 3D 体型アバター生成 SaaS |
| try-on | ★ ユーザー写真に服を合成する技術(2D AI / 3D 物理シミュ 双方を含む)|
| glb / gltf | ★ Web 3D 標準フォーマット(★ three.js でロード可)|
| three.js | ★ ブラウザ 3D ライブラリ(WebGL 抽象化・MIT)|
| R3F | React Three Fiber(★ three.js の React バインディング)|
