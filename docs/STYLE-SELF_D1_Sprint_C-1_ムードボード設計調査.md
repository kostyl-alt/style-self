# STYLE-SELF D1 — Sprint C-1 ムードボード設計調査(Phase 2 本実装の全体設計・★ 本工程は設計のみ・C-2 以降で実装)

- 作成日: 2026-05-24
- 起点 HEAD: `d42463b`(Sprint B-3 コスト管理運用化 設計・origin 保全済・clean / 399 PASS / tsc EXIT 0)
- 本 doc の役割: Sprint C-1 ムードボードの **全体設計**(★ **コード 0 変更・実装は C-2 以降**)
- 上位連結:
  - ロードマップ [§5 Sprint C](./STYLE-SELF_D1_ビジョン完全達成_ロードマップ.md#5-sprint-c-phase-2-ムードボード5-6-セッション)(`d42463b`)= Phase 2 ムードボード(C-1〜C-4)
  - 本体 [§ Phase 2 ②ムードボード(L1038-1052)](./STYLE-SELF_D1_実装設計.md)(`ac834bb`)= migration `026_d1_moodboards.sql` + bucket `moodboard-images` + API `/api/moodboards/route.ts` + M3-1 同型 RLS
  - 最終ビジョン [項目 6 「商品画像・商品 URL・ムードボードをチャットに渡す」](./STYLE-SELF_最終ビジョン.md)(`df36d82`)= MVP 優先 6 項目
  - Sprint B-1 評価 [§4.2.2](./STYLE-SELF_D1_Sprint_B-1_Phase2_前ゲート評価.md)(`65973c5`)= ③ プライバシー Phase 2 5 層多段防御方針
  - A-5 [InputAttachments.tsx](../components/chat/InputAttachments.tsx) MB ボタン骨格(`fcbe065`)= notice 動作 → 本実装で置換

---

## 1. 背景

### 1.1 Sprint C-1 の位置づけ

Sprint B 帯完遂(`d42463b`)後の Phase 2 着手 = ★ **ムードボード本実装の全体設計**。Sprint C(5-6 セッション)の最初の山として **設計の青写真**を origin 保全する工程。

### 1.2 ★ 「C-1 設計のみで完遂」根拠

| 観点 | 根拠 |
|---|---|
| ロードマップ §5.1 | C-1 ムードボード設計(doc7 後半 + 本体反映)= ★ 設計工程 |
| 既存設計判断 | 本体 ac834bb L1038-1052 Phase 2 セクションで設計の枠は決定済(migration / bucket / API / RLS)|
| C-2 実装の規模 | DB + API 5 本 + UI 3 画面 + Modal = ★ 3-4 セッション規模 → 別工程に分割が自然 |
| M5 刻む作法 | 短い成功 → 検証 → 次の山(設計案 5e879c7 §1.1 で確認済) |

### 1.3 不可侵境界線(★ 厳守 / Sprint B-1〜B-3 と同型)

1. 本体 `ac834bb` / コード / doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` / 各設計案(B-2 `5e879c7` / B-3 `d42463b`) / 既存設計判断 1-10 ★ **全 0 変更**
2. ③ プライバシー専章(6 章)/ ③ コスト管理(7 章)/ Phase 2 後ゲート(判断 6) ★ **diff 0 行**
3. リグレッションテスト **399 PASS 維持**(本 Sprint C-1 はコード 0 変更)
4. tsc EXIT 0 維持
5. ★ 実装は C-2 以降(本 doc では実施しない)

---

## 2. ★ Phase 2 ムードボード機能 全体像

### 2.1 ビジョン `df36d82` 整合確認

| ビジョン本文 | 機能要件 |
|---|---|
| 例文「このムードボードっぽい服装にして」 | ★ MB → coordinate 連鎖(C-3 対象) |
| MVP 優先 6 項目「商品画像・URL・MB をチャットに渡す」 | ★ MB を選択して段階 B 文脈に渡す(C-3 対象) |
| 例文「自分の世界観に合うコーデを作って」(暗黙) | ★ MB の世界観タグから coordinate 提案 |

### 2.2 機能要件 4 軸

| # | 機能 | C-X | 規模 |
|---|---|---|---|
| 1 | ユーザーが画像を MB に追加(複数枚) | C-2 | 中 |
| 2 | MB 内画像の整理(キャプション / 順序) | C-2 | 中 |
| 3 | 自分の MB 一覧(複数 MB 保持可)| C-2 | 中 |
| 4 | 他人の MB 閲覧(`is_public=true` 行のみ・既存 `(public)/u/[id]` 同型導線)| C-2 | 中 |
| 5 | MB をチャットに渡す(MB → coordinate 連鎖)| C-3 | 大 |

### 2.3 本体 ac834bb 既存設計との関係

| 本体 ac834bb 既述 | 内容 | C-X 対応 |
|---|---|---|
| L368-377 地雷 8(MB 公開 RLS)| M3 と同型の二重ポリシー(本人 FOR ALL + 公開行 SELECT)・`is_public default false` オプトイン公開 | C-2 で migration に反映 |
| L1042 migration | `026_d1_moodboards.sql`(`moodboards` + `moodboard_items` + RLS 二重ポリシー・M3-1 同型) | C-2 |
| L1043 Storage バケット | `moodboard-images`(M3 POST_BUCKET 同型運用)| C-2(★ Supabase Studio で手動作成・migration 範囲外)|
| L1044 API | `/api/moodboards/route.ts`(CRUD) | C-2(★ 本 doc §5 で 5 本に分割)|
| L1045-1046 UI | オーバーレイ intent="create-moodboard" / "view-moodboard" + M3 image-pipeline / storage.ts 再利用 | C-2 |
| L490 統一 intent | `moodboard`(自然文「ボード作成しますね」→ 作成 UI 起動) | C-3(段階 B 拡張) |
| L1048 完了条件 | 画像追加/削除 + 公開トグル + `/u/[id]` で公開ボードが見える | C-4 完成判定 |

→ ★ **本体ですでに枠が確定済**(C-1 設計は枠に沿った詳細化)

---

## 3. ★ DB スキーマ設計

### 3.1 `moodboards` テーブル(新規・M3-1 posts と同型)

```sql
-- 026_d1_moodboards.sql(★ C-2 で適用・本 doc では作成しない)
create table if not exists public.moodboards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  name        text not null,                       -- MB 名(例: "静かな東京の夜")
  description text not null default '',            -- 自由記述
  is_public   boolean not null default false,      -- ★ 地雷 8 対策 default false(オプトイン公開)

  -- 世界観 snapshot(将来 M4 同型のマッチング素材化)
  worldview_tags     text[] not null default '{}',
  worldview_keywords text[] not null default '{}',
  worldview_name     text,

  cover_image_url text,                            -- カード表示用(items の先頭画像を昇格 or 任意指定)

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 3.2 `moodboard_items` テーブル(新規)

```sql
create table if not exists public.moodboard_items (
  id            uuid primary key default gen_random_uuid(),
  moodboard_id  uuid not null references public.moodboards(id) on delete cascade,
  image_url     text not null,                     -- Storage moodboard-images の公開 URL
  caption       text not null default '',          -- 任意キャプション
  source_url    text,                              -- 参照元(楽天/SNS等の URL・将来 product 連鎖)
  order_index   integer not null default 0,        -- 並び替え用

  created_at timestamptz not null default now()
);
```

### 3.3 RLS 二重ポリシー(M3-1 同型・本体 L371 確定)

```sql
-- moodboards
alter table public.moodboards enable row level security;

create policy "users own moodboards" on public.moodboards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "public moodboards readable by anyone" on public.moodboards
  for select using (is_public = true);

-- moodboard_items: 親 moodboards 経由で本人 / 公開判定
alter table public.moodboard_items enable row level security;

create policy "users own moodboard_items" on public.moodboard_items
  for all using (
    exists (select 1 from public.moodboards m
            where m.id = moodboard_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.moodboards m
            where m.id = moodboard_id and m.user_id = auth.uid())
  );

create policy "public moodboard_items readable by anyone" on public.moodboard_items
  for select using (
    exists (select 1 from public.moodboards m
            where m.id = moodboard_id and m.is_public = true)
  );
```

### 3.4 インデックス

```sql
create index if not exists moodboards_user_created_idx
  on public.moodboards(user_id, created_at desc);
create index if not exists moodboards_public_created_idx
  on public.moodboards(created_at desc) where is_public = true;
create index if not exists moodboard_items_board_order_idx
  on public.moodboard_items(moodboard_id, order_index);
```

### 3.5 規模見当(C-2 で実施)

- migration `026_d1_moodboards.sql`: ★ **+80-100 行 SQL**(コメント + 2 テーブル + RLS 4 policy + index 3)

---

## 4. ★ Supabase Storage 設計

### 4.1 bucket 設計

| 項目 | 値 |
|---|---|
| bucket 名 | `moodboard-images`(★ 本体 L1043 確定) |
| 作成方法 | ★ Supabase Studio で **手動作成**(M3 `post-images` と同運用・migration 範囲外) |
| 公開設定 | public bucket(reads は公開・writes は RLS 制御) |
| パス | `moodboard-images/{user_id}/{moodboard_id}/{timestamp}.{ext}`(M3 同型) |

### 4.2 lib/storage.ts 拡張(C-2 で +30-50 行)

`lib/storage.ts` に M3 `POST_BUCKET` と同型で:
```typescript
export const MOODBOARD_BUCKET = "moodboard-images";

export async function uploadMoodboardImage(
  supabase: SupabaseClient,
  userId: string,
  moodboardId: string,
  rawFile: File,
): Promise<string> {
  // 1) ★ EXIF 除去(processImageForUpload・M3 同型・地雷対策)
  const processed = await processImageForUpload(rawFile);
  // 2) Storage 投入(moodboard-images/{userId}/{moodboardId}/{ts}.jpg)
  // 3) public URL 返却
}

export async function removeMoodboardImage(supabase, url): Promise<void> { /* M3 同型 */ }
```

### 4.3 ★ EXIF / プライバシー対応(Sprint B-1 §4.2 確立済)

| 防御 | 方法 |
|---|---|
| EXIF / GPS 除去 | ★ `processImageForUpload()`(M3 既存パイプライン・Canvas 再エンコードで構造遮断) |
| 公開 RLS | ★ `is_public=true` 行のみ anon select 可・本人 FOR ALL |
| 公開ルート列絞り SELECT | ★ `(public)/m/[id]/page.tsx` で必要列のみ SELECT(M2-3 / M3-4 教訓継承) |
| 著作権同意 | ★ Phase 2-3 で規約整備(他人画像転載リスク・本体 L368-376 地雷 8) |

---

## 5. ★ API 設計(★ C-2 で実装・5 本)

| # | route | method | 用途 | 規模 |
|---|---|---|---|---|
| 1 | `/api/moodboards/route.ts` | GET | 自分の MB 一覧(列絞り SELECT) | +40-60 行 |
| 2 | 同 | POST | MB 新規作成(name + description) | +30-40 行 |
| 3 | `/api/moodboards/[id]/route.ts` | GET / PATCH / DELETE | MB 取得 / 更新(name/description/is_public) / 削除 | +60-80 行 |
| 4 | `/api/moodboards/[id]/items/route.ts` | POST | 画像追加(File → EXIF 除去 → Storage → moodboard_items INSERT) | +50-70 行 |
| 5 | `/api/moodboards/[id]/items/[itemId]/route.ts` | DELETE / PATCH | 画像削除(Storage 同時削除) / 順序変更 | +40-60 行 |
| **合計** | | | | **+220-310 行**(★ 本体 L1044 は単一 route 想定だが、CRUD 細粒度化のため 5 本に分割推奨)|

★ 全 route 共通:
- 認証必須(`auth.getUser()`)
- 本人 RLS(`auth.uid() = user_id` を policy で担保)
- 列絞り SELECT(`worldview_tags` 等は内部用・出力時は日本語 `worldview_name` のみ・三重防御 1)
- ★ service_role 不使用

---

## 6. ★ UI 設計(★ C-2 で実装・3 画面 + 1 Modal)

### 6.1 `(app)/moodboard/page.tsx` — 一覧画面(+150-200 行)

- 自分の MB カード一覧(`cover_image_url` + `name` + 公開バッジ)
- 新規作成ボタン → モーダル(name 入力)→ POST `/api/moodboards`
- カードタップ → `/moodboard/[id]` 詳細へ

### 6.2 `(app)/moodboard/[id]/page.tsx` — 詳細画面(+200-300 行)

- MB 画像グリッド表示(`moodboard_items` の `order_index` 順)
- 画像追加(file input → EXIF 除去 → POST `/api/moodboards/[id]/items`)
- 並び替え(★ C-2 ではボタン式上下移動・drag&drop は将来)
- 公開設定切替(`is_public` toggle)
- ★ **「チャットに渡す」ボタン** → `/ai?mb=<id>` に遷移(C-3 で段階 B 拡張)
- ★ 公開時の URL コピー(`/m/[id]` を clipboard・M3-4 同型)

### 6.3 `(public)/m/[id]/page.tsx` — 公開ルート(+80-120 行)

- 独立 layout(`app/(public)/layout.tsx` 既存・ロゴ + フッター CTA のみ・★ M3-4 同型)
- 認証不要(anon OK)
- ★ 列絞り SELECT(M2-3 / M3-4 教訓):`id` / `name` / `description` / `cover_image_url` / `worldview_name` / items の `image_url` `caption` のみ・★ `worldview_tags` 英語スラッグは取得経路から除外(地雷 10 対策)

### 6.4 `components/chat/MoodboardPickerModal.tsx` — MB 選択モーダル(+150-200 行)

- ChatPage の 🎨MB ボタン本実装(★ A-5 `InputAttachments.tsx:71-73` notice 動作を置換)
- 自分の MB 一覧表示(カード)
- カードタップ → 選択完了 + `onMbSelect(moodboardId)` callback
- ★ 親側(ChatPage)で MB 内容を textarea に挿入 or hidden parameter として段階 B に渡す
- ClosetPickerModal `c126f76` 同型作法で実装(モーダル + GET fetch + 親 callback)

### 6.5 InputAttachments.tsx 改修(C-2 で +10-20 行差替)

```typescript
// 現状(A-5 fcbe065 L71-73):
function handleMbClick(): void {
  showNotice("📌 ムードボードは Sprint C で実装予定です(現在テーブル未作成)");
}

// C-2 改修後:
function handleMbClick(): void {
  onMbOpen(); // ← MoodboardPickerModal を開く(親 callback)
}
```

★ Props に `onMbOpen: () => void` 追加(`onClosetOpen` と同型)

---

## 7. ★ MB → coordinate 連鎖(C-3 範囲・概要のみ)

### 7.1 連鎖フロー

1. ユーザー: MB 詳細画面で「チャットに渡す」ボタンタップ
2. 遷移: `/ai?mb=<id>` に navigate
3. ChatPage: query param `mb` を検出 → 「このムードボードの世界観に合うコーデを提案して」型のプロンプトを textarea に挿入(候補)
4. ユーザー: 確認後送信 → `/api/ai/stylist-chat` 段階 B 呼出
5. ★ stylist-chat route 拡張(C-3):
   - 段階 B context に `moodboardContext`(`moodboards.worldview_name` / `description` + `moodboard_items.caption` 配列)を追加
   - prompt template に MB 文脈ブロック注入
   - ★ A-6 / A-6b で確立した 4 作法踏襲(段階 A 修正 + MVP-1c fetcher + A-4 三重防御 + A-10 KOS 共通注入)

### 7.2 規模見当(C-3)

- 段階 B 拡張: +50-100 行(`/api/ai/stylist-chat/route.ts` に `fetchMoodboardContext` 追加)
- prompt 拡張: +30-50 行(`lib/prompts/stylist-chat.ts` に MB ブロック)
- ChatPage `mb` query param ハンドル: +20-30 行
- ★ リグレッションテスト拡張: +30-50 行(MB context シナリオ追加)
- **C-3 合計**: +130-230 行 / 1 セッション

### 7.3 A-7 結果カード / A-8 連鎖 統合判断(Sprint B-1 §4.3.1 確認済)

| 工程 | C-X 統合 | 理由 |
|---|---|---|
| A-7 結果カード(reply に商品 / コーデカード統合) | ★ **C-3 と同時**(MB → coordinate の結果カード) | MB 連鎖の reply には自然に結果カードが伴う = 別工程化のメリット薄 |
| A-8 virtual → product 連鎖 | ★ **C-3 で骨格・Sprint E で本実装** | Phase 3 寄り(自分写真試着想定の product 連鎖)= Sprint E 領域だが骨格は MB 連鎖で先行可 |

---

## 8. ★ C-1〜C-4 規模見当

| 工程 | 内容 | 規模 | セッション |
|---|---|---|---|
| **C-1** | ★ 本設計調査(本 commit) | +300-400 行 docs | ★ **0.5 セッション**(本工程) |
| **C-2** | DB(+80-100)+ Storage 拡張(+30-50)+ API 5 本(+220-310)+ UI 3 画面(+430-620)+ Modal(+150-200)+ InputAttachments 改修(+10-20)| ★ **+920-1300 行 TS/TSX/SQL** | 3-4 セッション |
| **C-3** | MB → coordinate 連鎖 + A-7 結果カード統合 + リグレッションテスト拡張 | ★ **+130-230 行** | 1 セッション |
| **C-4** | 実機 verify(投稿フロー / 公開 RLS / EXIF 除去 / MB → coordinate 連鎖)+ 退行点検 + ロードマップ §11.4 更新 | ★ **+20-50 行 docs**(verify ログ) | 1 セッション |
| **★ Sprint C 全体** | | **+1,070-1,580 行**(C-2 が最大)| **5-6 セッション**(ロードマップ §10 整合)|

---

## 9. ★ Step 1-5 分割(本 C-1 工程)

| Step | 内容 | 時間 | 本 commit 範囲 |
|---|---|---|---|
| **1** | ★ 本設計調査 doc 作成(機能要件 + DB + Storage + API + UI + 連鎖 + 規模見当)| 30-45 分 | ★ **本 commit** |
| 2 | DB スキーマ + API/UI 構造案(★ 本 doc §3-6 に内包) | 含む | 本 doc 内で確定済 |
| 3 | tsc EXIT 0 + 399 PASS 維持確認 | 2-3 分 | ★ **本 commit** |
| 4 | 整合性確認(本体 / コード / doc7 / 最終ビジョン / 既存設計判断 1-10 全不変) | 5 分 | ★ **本 commit** |
| 5 | commit(push しない) | 3-5 分 | ★ **本 commit** |
| **合計** | | **40-60 分** | — |

→ 本 commit = Step 1 + 3 + 4 + 5。Step 2 は本 doc §3-6 に集約済。

---

## 10. 既存達成への影響評価(★ コード 0 変更・全保持)

| 達成項目 | 想定影響 |
|---|---|
| 1.5b 完成形 / race fix v2 / L4-A / A-2 / A-3 / MVP-1c / A-4 / A-10 / A-6 / A-6b / A-5 / A-9 / Sprint B-1 / B-2 / B-3 | **0**(コード 0 変更)|
| リグレッションテスト | **399 PASS 維持**(本 Sprint C-1 はコード 0 変更)|
| 既存 v1 各 intent API + UI | **0** |
| M3 posts(`024_m3_posts.sql`)/ `(public)/p/[id]` / `(public)/u/[id]` | **0**(参照 only / 設計流用) |
| `lib/storage.ts` / `lib/utils/image-pipeline.ts` | **0**(参照 only / C-2 で `MOODBOARD_BUCKET` 追加予定) |
| `components/chat/InputAttachments.tsx` | **0**(参照 only / C-2 で MB ボタン改修予定) |
| 本体 `ac834bb` 6 章 / 7 章 / 判断 6 | **diff 0 行**(★ 厳守) |
| 本体 `ac834bb` / doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` | **diff 0 行**(★ 厳守) |
| Sprint B-2 / B-3 設計案 / 各 Sprint A 設計調査 docs | **diff 0 行** |
| 既存設計判断 1-10 | **文言不変**(★ 厳守)|

---

## 11. 推奨案(★ 結論)

### 11.1 推奨実装方針 = 本 Sprint C-1 = 設計調査 doc 1 件のみ

- ★ **コード 0 変更**(設計調査 doc のみ)
- ★ 本体 / doc7 / 最終ビジョン / 整合性点検 / ロードマップ / コスト試算 / 各設計案 / 既存設計判断 1-10 ★ **全不変**
- ★ 実装は **C-2 以降**(★ C-2 は規模大 = 3-4 セッション)
- 規模 +300-400 行(本設計調査) + Sprint C 全体 +1,070-1,580 行 / 5-6 セッション
- 合計 40-60 分(本 C-1 工程のみ)

### 11.2 ★ 6 項目 結論サマリ

| 項目 | 結論 |
|---|---|
| ビジョン df36d82 Phase 2 整合 | ★ MB → coordinate 連鎖(C-3)+ MVP 優先 6 項目「MB をチャットに渡す」直対応 |
| DB スキーマ | ★ `moodboards` + `moodboard_items` 2 テーブル(M3-1 同型・RLS 二重ポリシー)+ index 3 本(+80-100 行 SQL)|
| Storage | ★ `moodboard-images` bucket(M3 POST_BUCKET 同運用・手動作成)+ `lib/storage.ts` 拡張(+30-50 行・★ EXIF 除去 既存パイプライン流用) |
| API | ★ 5 本に分割(/api/moodboards / [id] / [id]/items / [id]/items/[itemId])+ 認証 + 本人 RLS + 列絞り SELECT(+220-310 行) |
| UI | ★ 3 画面(`moodboard/page.tsx` / `[id]/page.tsx` / `(public)/m/[id]/page.tsx`)+ `MoodboardPickerModal.tsx`(+430-620 行 UI / +150-200 行 Modal) + InputAttachments 改修(+10-20 行) |
| MB → coordinate 連鎖 | ★ C-3 で `stylist-chat` 拡張(+50-100 行 route + +30-50 行 prompt + +20-30 行 ChatPage / A-7 結果カード同時統合 / A-8 は骨格のみ) |

### 11.3 ★ 次工程

- 本 commit(Step 1 + 3 + 4 + 5)→ オーナー判断 → origin 保全
- 次セッション以降: **Sprint C-2 実装**(★ 規模大・3-4 セッション)
- Sprint C-2 → C-3 → C-4 を経て **Phase 2 達成**(ロードマップ §5)
- → **Sprint D ★ Phase 2 後ゲート**(リアル試着 GO/NO-GO 判断)

---

## 12. 結論

| 観点 | 結論 |
|---|---|
| ★ Sprint C-1 着手判断 | **★ GO**(設計調査 doc のみ・コード 0 変更・規模軽微・本体 ac834bb の既定枠を詳細化)|
| 規模 | **+300-400 行 / 40-60 分**(本 commit)+ Sprint C 全体 +1,070-1,580 行 / 5-6 セッション |
| 既存達成保持 | コード 0 変更で **全保持**(399 PASS 維持・tsc EXIT 0 維持)|
| ★ 4 レイヤー構造 | 本体 / doc7 / ロードマップ / 最終ビジョン ★ **全不変** |
| ★ Phase 2 設計青写真 | ★ **設計完遂**(DB + Storage + API + UI + 連鎖 + A-7/A-8 統合判断 + 規模見当) |
| ★ 次工程 | オーナー判断 → 本 commit origin 保全 → Sprint C-2(★ 規模大・3-4 セッション)へ進む |
| 不可侵 | 本体 6 章 / 7 章 / 判断 6 / コスト試算 / 整合性点検 / ロードマップ / 各設計案 / 既存設計判断 1-10 ★ **全不変** |

→ ★ **Sprint C-1 設計青写真完遂**(Sprint C 全体の実装方針確立)→ ★ **C-2 実装着手準備完了**

---

## 13. 制約遵守チェックリスト

- [x] 新規 docs ファイル 1 件のみ(本 doc)
- [x] 本体 `ac834bb` / コード(app/api/lib/scripts/package.json/tsconfig.json)/ doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` / 各設計案(B-2 `5e879c7` / B-3 `d42463b` 等)/ 他 docs **全 0 変更**
- [x] 本体 6 章(リアル試着プライバシー専章)/ 7 章(③ コスト管理)/ 判断 6(Phase 2 後ゲート)diff 0 行
- [x] 既存設計判断 1-10 文言不変
- [x] view + grep + 静的解析のみ・実装なし
- [x] tsc EXIT 0 維持(本 doc は markdown のみ・コード 0 変更)
- [x] リグレッションテスト 399 PASS 維持(本 Sprint C-1 はコード 0 変更)
- [x] 実装は ★ C-2 以降(本 doc では実施しない)
- [x] commit はあり / push はなし
