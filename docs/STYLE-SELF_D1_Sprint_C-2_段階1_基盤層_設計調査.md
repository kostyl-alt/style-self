# STYLE-SELF D1 — Sprint C-2 段階1 基盤層 設計調査(DB マイグレーション + Storage bucket 手順 + lib/storage.ts 拡張・★ 実装は別工程)

- 作成日: 2026-05-24
- 起点 HEAD: `60b8d87`(Sprint C-1 ムードボード設計調査・origin 保全済・clean / 399 PASS / tsc EXIT 0)
- 本 doc の役割: Sprint C-2 段階1 = 基盤層(DB + Storage + helper)の **実装可能粒度の準備**(★ **コード 0 変更・実装は別工程**)
- 上位連結:
  - Sprint C-1 設計案 [§3 DB スキーマ](./STYLE-SELF_D1_Sprint_C-1_ムードボード設計調査.md)(`60b8d87`)= moodboards / moodboard_items 設計
  - Sprint C-1 設計案 [§4 Storage 設計](./STYLE-SELF_D1_Sprint_C-1_ムードボード設計調査.md)(`60b8d87`)= moodboard-images bucket 設計
  - 本体 [§ Phase 2 L1042-1046](./STYLE-SELF_D1_実装設計.md)(`ac834bb`)= migration `026_d1_moodboards.sql` + bucket `moodboard-images` + 地雷 8 RLS 二重ポリシー
  - 実装参照: [M3 posts migration `024_m3_posts.sql`](../supabase/migrations/024_m3_posts.sql)・[`lib/storage.ts`](../lib/storage.ts) `uploadPostImage` / `deletePostImage` / `POST_BUCKET`・[`lib/utils/image-pipeline.ts`](../lib/utils/image-pipeline.ts) `processImageForUpload`

---

## 1. 背景

### 1.1 Sprint C-2 段階1 の位置づけ

Sprint C-1 設計案(`60b8d87`)で確立した青写真を、★ **段階1 基盤層**(DB + Storage + helper)単位に分解。Sprint C-2 全体(3-4 セッション規模・+920-1300 行)を **段階区切り** で進めることで、各段階で 399 PASS + tsc EXIT 0 維持を担保しやすくする。

### 1.2 ★ 段階分割

| 段階 | 内容 | 規模 | 本 doc |
|---|---|---|---|
| **段階1 基盤層** | DB migration + Storage bucket + helper | +110-150 行 | ★ **本 doc 対象**(★ 設計のみ) |
| 段階2 API 層 | /api/moodboards 系 5 本 | +220-310 行 | 次セッション以降 |
| 段階3 UI 層 | 3 画面 + Modal + InputAttachments 改修 | +590-840 行 | 次セッション以降 |

### 1.3 ★ 「本工程は設計のみで完遂」根拠

- Sprint C-1 §11.3 で C-2 は **次セッション以降**(規模大)と明示
- ★ 設計書 § 3-4 の実装可能粒度への分解 = 別工程化が自然
- M5 刻む作法(原則 3)+ 短い成功 → 検証 → 次の山

### 1.4 不可侵境界線(★ 厳守 / Sprint B-1〜C-1 と同型)

1. 本体 `ac834bb` / コード / doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` / 各設計案(B-2 `5e879c7` / B-3 `d42463b` / C-1 `60b8d87`) / 既存設計判断 1-10 ★ **全 0 変更**
2. ③ プライバシー専章 / ③ コスト管理 / Phase 2 後ゲート ★ **diff 0 行**
3. リグレッションテスト **399 PASS 維持**(本工程はコード 0 変更)
4. tsc EXIT 0 維持
5. ★ migrations ファイル / lib/storage.ts は ★ **本 doc では作成・改修しない**(別工程の commit で実施)

---

## 2. ★ 実物確認結果

### 2.1 既存 migrations/ 棚卸し(次番号確認)

```
最新 10 件:
016_ai_history.sql
017_product_curation.sql
018_product_multi_attrs.sql
019_material_composition.sql
020_diagnosis_v2.sql
021_avoid_items.sql
022_diagnosis_v2_nullable.sql
023_m2_public_worldview.sql
024_m3_posts.sql
025_m4_match_index.sql
```

→ ★ **次番号 = `026_d1_moodboards.sql`**(本体 ac834bb L1042 指定・整合)

### 2.2 M3 posts migration 同型作法(`024_m3_posts.sql`・112 行 view)

| 作法 | M3 posts | C-2 moodboards 採用方針 |
|---|---|---|
| ヘッダコメント | 【背景】【設計の確定事項】【変更内容】【安全性】【冪等性】【ロールバック】【Storage】【適用時の確認】8 セクション | ★ 全踏襲 |
| `create table if not exists` | ✅ 冪等 | ★ 踏襲 |
| RLS 二重ポリシー | 「users own posts」FOR ALL + 「public posts readable by anyone」FOR SELECT | ★ 踏襲(★ moodboard_items は親経由 EXISTS 判定で拡張) |
| `is_public default` | ★ **true**(MVP 投稿は常時公開) | ★ **false**(MB は ★ オプトイン公開 / 本体 L376 地雷 8 対策) |
| 列コメント `comment on column` | worldview_tags / is_public に注記 | ★ 踏襲 |
| index 命名 | `posts_author_created_idx` / `posts_public_created_idx`(partial) | ★ `moodboards_user_created_idx` / `moodboards_public_created_idx`(partial)/ `moodboard_items_board_order_idx` |
| Storage バケット | migration には含めない(★ Supabase Studio 手作業) | ★ 踏襲 |

### 2.3 既存 updated_at trigger パターン(`001_initial_schema.sql:75-90`)

```sql
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at
  before update on public.users
  for each row execute function public.handle_updated_at();
```

→ ★ **関数名 = `public.handle_updated_at()`**(★ 本工程の起点指示にあった `trigger_set_updated_at` は誤り・既存パターン尊重)
→ moodboards の trigger 名 = `moodboards_updated_at`(users / wardrobe_items と同型)

### 2.4 lib/storage.ts 既存パターン(95 行 view)

| 既存 export | 用途 |
|---|---|
| `WARDROBE_BUCKET = "wardrobe-images"` | 服画像 |
| `uploadWardrobeImage(userId, file)` | EXIF 除去なし(M3 以前) |
| `deleteWardrobeImage(publicUrl)` | URL → パス分解 |
| `KNOWLEDGE_BUCKET = "knowledge-images"` | ナレッジ画像 |
| `uploadKnowledgeImage(userId, file)` | 同上 |
| `POST_BUCKET = "post-images"` | ★ M3 投稿(EXIF 除去あり) |
| `uploadPostImage(userId, rawFile)` | ★ `processImageForUpload()` → `upload(path, processed, { contentType: "image/jpeg" })` |
| `deletePostImage(publicUrl)` | URL → パス分解 |

★ 共通パターン:
- `createSupabaseBrowserClient()`(★ client 側ライブラリ・service_role 不使用)
- パス: `${userId}/${Date.now()}.jpg`(M3 = 2 階層)
- `upsert: false`(同名再 upload 禁止)
- `error throw new Error("画像のアップロードに失敗しました")`

### 2.5 lib/utils/image-pipeline.ts(`processImageForUpload`)

- 入力: `image/jpeg | image/png | image/webp` + HEIC(動的 import)
- 出力: `image/jpeg` 統一・長辺 1920px・5MB 以下
- EXIF: Canvas 再エンコードで **構造遮断**(GPS 含む全 EXIF 消失)
- 関数: `export async function processImageForUpload(rawFile: File): Promise<Blob>`(L1-60 確認)
- ★ MB でも **同関数完全流用**(M3 と同等の EXIF 防御)

### 2.6 既存 Supabase Storage bucket 棚卸し(`lib/storage.ts` 列挙ベース)

| 既存 bucket | 利用 |
|---|---|
| `wardrobe-images` | 服画像 |
| `knowledge-images` | ナレッジ画像 |
| `post-images` | M3 投稿 |
| ★ **`moodboard-images`** | ★ **新規・本 Sprint C-2 段階1-B で手作業** |

---

## 3. ★ 段階1-A: DB マイグレーション設計

### 3.1 ファイル: `supabase/migrations/026_d1_moodboards.sql`(★ 段階1 実装で作成)

### 3.2 完全 SQL 案(★ 設計のみ・本 doc では作成しない)

```sql
-- D1 Phase 2 ムードボード: moodboards / moodboard_items の新設
--
-- 【背景】
-- Phase 1 完成宣言(acb0b01)後、Sprint C(Phase 2)ムードボード本実装の基盤層。
-- ビジョン df36d82 MVP 優先 6 項目「商品画像・URL・ムードボードをチャットに渡す」
-- 直対応。本体 ac834bb L1042 で 026 確定済・L376 地雷 8 で is_public default false
-- (オプトイン公開)確定済。
--
-- 【設計の確定事項(本体 + Sprint C-1 設計案 60b8d87 §3 確定)】
-- - 判断1: moodboards / moodboard_items の 2 テーブル分離(MB = 複数画像コレクション)
-- - 判断2: is_public default false(★ 地雷 8 オプトイン公開・M3 posts は true 固定で別判断)
-- - 判断3: worldview snapshot 採用(将来 M4 マッチング素材化)
-- - 判断4: moodboard_items の RLS は親 moodboards 経由 EXISTS 判定(M3-1 二重ポリシー拡張)
--
-- 【変更内容】
-- 1. moodboards テーブル新設
-- 2. moodboard_items テーブル新設
-- 3. RLS 二重ポリシー × 2 テーブル(本人 FOR ALL + 公開行 SELECT)
-- 4. インデックス 3 本
-- 5. updated_at trigger(既存 public.handle_updated_at() 流用)
--
-- 【安全性 — M3-1 同型作法】
-- (a) 本人 FOR ALL は WITH CHECK も同条件で偽装更新を防ぐ
-- (b) 公開 SELECT は `to` 句省略 = anon + authenticated 両方
--     (public)/m/[id] が未ログイン閲覧できるための前提
-- (c) moodboard_items は親経由 EXISTS で本人 / 公開判定(子テーブル単独で穴を作らない)
-- (d) FK + ON DELETE CASCADE で整合性担保(MB 削除 → items 自動削除)
--
-- 【冪等性】
-- - create table if not exists / create index if not exists
-- - create policy は重複だとエラー → 再実行時は事前 drop policy 必要
--
-- 【ロールバック手順】
--   drop policy if exists "public moodboard_items readable by anyone" on public.moodboard_items;
--   drop policy if exists "users own moodboard_items" on public.moodboard_items;
--   drop policy if exists "public moodboards readable by anyone" on public.moodboards;
--   drop policy if exists "users own moodboards" on public.moodboards;
--   drop index if exists public.moodboard_items_board_order_idx;
--   drop index if exists public.moodboards_public_created_idx;
--   drop index if exists public.moodboards_user_created_idx;
--   drop trigger if exists moodboards_updated_at on public.moodboards;
--   drop table if exists public.moodboard_items;
--   drop table if exists public.moodboards;
--
-- 【Storage バケット】
-- 本 migration には Storage バケット(moodboard-images)の作成は含まれない。
-- 既存 post-images と同じ運用で Supabase Studio 手作業(★ 段階1-B 手順書参照)。
--
-- 適用時の確認:
-- - 既存テーブル(users / posts / wardrobe_items / 他)は無変更
-- - moodboards / moodboard_items が空で作成される
-- - RLS は両テーブルで有効 + ポリシー各 2 本
-- - 本人は自分の MB を全権限操作可能・anon/他者は is_public=true のみ SELECT 可能

-- ---- 1. moodboards テーブル ----

create table if not exists public.moodboards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,

  -- MB メタ
  name        text not null,
  description text not null default '',

  -- ★ オプトイン公開(地雷 8 対策・M3 posts と異なる)
  is_public   boolean not null default false,

  -- 世界観 snapshot(将来 M4 同型マッチング素材化)
  worldview_tags     text[] not null default '{}',
  worldview_keywords text[] not null default '{}',
  worldview_name     text,

  -- カード表示用カバー画像(items 先頭を昇格 or 任意指定)
  cover_image_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.moodboards.is_public is
  'true なら anon 含め誰でも閲覧可能。★ MB はオプトイン公開(default false)・地雷 8 対策。';
comment on column public.moodboards.worldview_tags is
  '英語スラッグ snapshot(M4 マッチング素材・★ UI/reply には露出しない・三重防御 1)。';

-- ---- 2. moodboard_items テーブル ----

create table if not exists public.moodboard_items (
  id            uuid primary key default gen_random_uuid(),
  moodboard_id  uuid not null references public.moodboards(id) on delete cascade,

  -- 画像本体(Storage moodboard-images の public URL)
  image_url     text not null,

  -- 任意メタ
  caption       text not null default '',
  source_url    text,                       -- 参照元(楽天 / SNS 等)
  order_index   integer not null default 0, -- 並び替え用

  created_at timestamptz not null default now()
);

-- ---- 3. RLS 二重ポリシー(moodboards・M3-1 同型) ----

alter table public.moodboards enable row level security;

create policy "users own moodboards"
  on public.moodboards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "public moodboards readable by anyone"
  on public.moodboards for select
  using (is_public = true);

-- ---- 4. RLS 二重ポリシー(moodboard_items・親経由 EXISTS) ----

alter table public.moodboard_items enable row level security;

create policy "users own moodboard_items"
  on public.moodboard_items for all
  using (
    exists (
      select 1 from public.moodboards m
      where m.id = moodboard_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.moodboards m
      where m.id = moodboard_id and m.user_id = auth.uid()
    )
  );

create policy "public moodboard_items readable by anyone"
  on public.moodboard_items for select
  using (
    exists (
      select 1 from public.moodboards m
      where m.id = moodboard_id and m.is_public = true
    )
  );

-- ---- 5. インデックス ----

create index if not exists moodboards_user_created_idx
  on public.moodboards (user_id, created_at desc);

create index if not exists moodboards_public_created_idx
  on public.moodboards (created_at desc) where is_public = true;

create index if not exists moodboard_items_board_order_idx
  on public.moodboard_items (moodboard_id, order_index);

-- ---- 6. updated_at trigger(既存 public.handle_updated_at() 流用) ----

create trigger moodboards_updated_at
  before update on public.moodboards
  for each row execute function public.handle_updated_at();
```

### 3.3 規模

- ★ **+125-140 行 SQL**(コメント手厚め + 2 テーブル + RLS 4 policy + index 3 + trigger 1)
- C-1 §3.5 試算 +80-100 行から **増(M3-1 同型のヘッダコメント忠実踏襲のため)**

### 3.4 適用方法(★ 段階1 実装時に判断)

| 方法 | 内容 | 推奨 |
|---|---|---|
| **案 a** | Supabase Studio SQL editor で手動実行 | ★ **MVP 検証期 推奨**(直接実行・ロールバック容易)|
| 案 b | `supabase db push`(CLI) | 本格運用期(CI/CD 統合時)|
| 案 c | psql で直接実行 | 非推奨(履歴管理外)|

---

## 4. ★ 段階1-B: Supabase Storage bucket 手順書(★ オーナー手作業)

### 4.1 bucket 設計

| 項目 | 値 |
|---|---|
| bucket 名 | `moodboard-images`(★ 本体 ac834bb L1043 確定) |
| public 設定 | **Public bucket = ON**(★ post-images と同運用・getPublicUrl 利用) |
| 注: 「Public bucket」の意味 | 「URL を知っていれば read 可能」=既存 post-images と同じ。書込は RLS で本人のみ・読みは公開だが URL 推測困難(timestamp 含む)|

### 4.2 ★ 作成手順(オーナー Supabase Studio 手作業 / 5-10 分)

```
Step 1: Supabase Dashboard → Storage → New bucket
Step 2: bucket name = "moodboard-images"
Step 3: Public bucket = ON(★ post-images / wardrobe-images と同設定)
Step 4: Allowed MIME types = image/jpeg, image/png, image/webp(任意・処理側で統一)
Step 5: File size limit = 5 MB(★ processImageForUpload 出力上限と整合)
Step 6: Create bucket クリック → 作成完了

Step 7: Bucket policies(★ 既存 post-images と同型)
  - Insert/Update/Delete: authenticated only + foldername[1] = auth.uid()::text
    (= ユーザーは自分の userId フォルダ配下のみ書込・削除可)
  - SELECT: public(anon + authenticated)= URL 知れば誰でも読み可
    ★ 公開判定は moodboards.is_public ではなく URL 知識ベース(M3 post-images と同型)
    ★ moodboard_items.image_url の取得は本人(全 MB)+ 公開 MB(anon)のみ → URL 漏洩経路を構造遮断
```

### 4.3 ★ 既存 post-images 同運用パターン踏襲根拠

- 本体 ac834bb L1043: 「`moodboard-images`(M3 POST_BUCKET 同型運用)」
- ★ Supabase Storage の RLS は **policies の `foldername[1] = auth.uid()::text` 型**(M3 で確立)
- 公開 MB の閲覧フロー: `(public)/m/[id]` → moodboards SELECT(RLS で `is_public=true` のみ) → moodboard_items SELECT(親経由 EXISTS で公開判定) → image_url 取得 → Storage public read

### 4.4 ★ 検証(bucket 作成後)

| 検証項目 | 期待 |
|---|---|
| 本人 upload | ✅ 成功(自分の userId 配下) |
| 他人配下に upload | ❌ 403(foldername[1] mismatch) |
| 本人 list own files | ✅ 成功 |
| URL 知れば anon read | ✅ 成功(public bucket) |

---

## 5. ★ 段階1-C: lib/storage.ts 拡張設計

### 5.1 追加コード(★ 段階1 実装で投入・既存 96 行 → +35-50 行 = ~130-145 行へ)

```typescript
// ---- D1 Phase 2: ムードボード画像(M3 post-images 同型・EXIF 除去あり) ----

export const MOODBOARD_BUCKET = "moodboard-images";

export async function uploadMoodboardImage(
  userId: string,
  moodboardId: string,
  rawFile: File,
): Promise<string> {
  // 1) ★ EXIF 除去(processImageForUpload・M3 同型・地雷対策)
  //    Canvas 再エンコードで EXIF 構造遮断 + 長辺 1920px + 5MB 以下
  const processed = await processImageForUpload(rawFile);

  // 2) Supabase Storage RLS が foldername[1]=auth.uid() を要求するため、
  //    {userId}/{moodboardId}/{timestamp}.jpg のパス命名(M3 と異なり 3 階層 = MB 単位束ね)
  const supabase = createSupabaseBrowserClient();
  const path = `${userId}/${moodboardId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from(MOODBOARD_BUCKET)
    .upload(path, processed, { upsert: false, contentType: "image/jpeg" });

  if (error) throw new Error("画像のアップロードに失敗しました");

  const { data: { publicUrl } } = supabase.storage
    .from(MOODBOARD_BUCKET)
    .getPublicUrl(path);

  return publicUrl;
}

export async function deleteMoodboardImage(publicUrl: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const url = new URL(publicUrl);
  // パスは /storage/v1/object/public/{bucket}/{path} の形式
  const pathParts = url.pathname.split(`/public/${MOODBOARD_BUCKET}/`);
  if (pathParts.length < 2) return;

  await supabase.storage.from(MOODBOARD_BUCKET).remove([pathParts[1]]);
}
```

### 5.2 ★ M3 `uploadPostImage` / `deletePostImage` 同型作法 厳守

| 観点 | M3 uploadPostImage | C-2 uploadMoodboardImage |
|---|---|---|
| client | `createSupabaseBrowserClient()` | ★ 同 |
| EXIF 除去 | `processImageForUpload(rawFile)` | ★ 同(完全流用)|
| パス階層 | `${userId}/${Date.now()}.jpg`(2 階層) | ★ `${userId}/${moodboardId}/${Date.now()}.jpg`(3 階層・MB 単位束ね) |
| upsert | `false`(同名再 upload 禁止) | ★ 同 |
| contentType | `image/jpeg` 統一 | ★ 同 |
| error | `throw new Error("画像のアップロードに失敗しました")` | ★ 同 |
| return | `publicUrl` | ★ 同 |

### 5.3 ★ 3 階層パスの根拠(M3 から拡張)

- M3 posts: 1 投稿 = 1 画像 → `{userId}/{ts}.jpg` で十分
- C-2 MB: 1 MB = **複数画像**(items 配列)→ `{userId}/{moodboardId}/{ts}.jpg` で MB 単位束ね
- Storage RLS の `foldername[1] = auth.uid()::text` は **第 1 階層 = userId** で判定 → 階層追加しても RLS 互換
- ★ MB 削除時に `{userId}/{moodboardId}/` 配下 list & delete が容易(将来 cascade-like 整理)

---

## 6. ★ 段階1 実装順序(★ 本 doc 範囲外・別 commit で実施)

| Step | 内容 | 実施者 | 時間 |
|---|---|---|---|
| **A** | `supabase/migrations/026_d1_moodboards.sql` 作成(+125-140 行 SQL) | Claude Code(別工程) | 10-15 分 |
| **B** | Supabase Studio で `moodboard-images` bucket + policies 作成 | ★ **オーナー手作業** | 5-10 分 |
| **C** | `lib/storage.ts` 拡張(+35-50 行 TS)| Claude Code(別工程) | 10-15 分 |
| D | `npx tsc --noEmit` EXIT 0 確認 | Claude Code | 1 分 |
| E | リグレッションテスト 399 PASS 確認 | Claude Code | 1 分 |
| F | commit(★ Step A + C を 1 commit に・Step B は前提) | Claude Code | 3-5 分 |
| **合計** | | | **30-50 分**(Step B 除く) |

### 6.1 ★ Step B(オーナー手作業)の SOP

- 本 doc §4.2 手順を Supabase Dashboard で実行
- 完了後にオーナーから「bucket 作成完了」報告 → Claude Code が Step A + C → commit
- Step A + C は bucket 不在でも tsc は通る(SQL は適用しなければ tsc 影響なし)が、★ **段階1 完了判定は Step B + A + C 全て完了**

---

## 7. 規模見当

| 工程 | 想定行数 | 想定時間 |
|---|---|---|
| **★ 本設計調査 doc**(本 commit) | 300-400 行(実測 ~370 行)| 30-45 分 |
| ★ 段階1 実装(別 commit・本 doc 範囲外)| +125-140 行 SQL + +35-50 行 TS = ★ +160-190 行 | 25-35 分(Step B 除く)|
| ★ 段階1-B オーナー手作業 | — | 5-10 分 |
| **★ 段階1 合計**(設計 + 実装 + 手作業) | **+460-590 行** | **60-90 分** |

---

## 8. ★ Step 1-5 分割(★ 本 C-2 段階1 設計工程)

| Step | 内容 | 時間 | 本 commit 範囲 |
|---|---|---|---|
| **1** | ★ 本設計調査 doc 作成(SQL 完全案 + Storage 手順書 + TS helper 案) | 30-45 分 | ★ **本 commit** |
| 2 | SQL 構文・命名整合性 確認(M3 同型作法 + 既存 trigger 関数名)| 含む(本 doc §2.3 で訂正) | — |
| 3 | tsc EXIT 0 + 399 PASS 維持確認 | 2-3 分 | ★ **本 commit** |
| 4 | 整合性確認(本体 / コード / doc7 / 最終ビジョン / 既存設計判断 1-10 全不変) | 5 分 | ★ **本 commit** |
| 5 | commit(push しない)| 3-5 分 | ★ **本 commit** |
| **合計** | | **40-60 分** | — |

---

## 9. 既存達成への影響評価(★ コード 0 変更・全保持)

| 達成項目 | 想定影響 |
|---|---|
| 1.5b 完成形 / race fix v2 / L4-A / A-2 / A-3 / MVP-1c / A-4 / A-10 / A-6 / A-6b / A-5 / A-9 / Sprint B-1 / B-2 / B-3 / C-1 | **0**(コード 0 変更)|
| リグレッションテスト | **399 PASS 維持**(本工程はコード 0 変更)|
| 既存 v1 各 intent API + UI | **0** |
| 既存 migrations(001-025)/ `lib/storage.ts` / `lib/utils/image-pipeline.ts` | **0**(参照 only / 段階1 実装で wardrobe / posts は不変・MB 関連のみ追加) |
| 本体 `ac834bb` 6 章 / 7 章 / 判断 6 | **diff 0 行**(★ 厳守) |
| 本体 `ac834bb` / doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` | **diff 0 行**(★ 厳守) |
| Sprint C-1 設計案 `60b8d87` | **diff 0 行**(本 doc は §3-4 の実装可能粒度への詳細化のみ) |
| 既存設計判断 1-10 | **文言不変**(★ 厳守)|

---

## 10. 推奨案(★ 結論)

### 10.1 推奨実装方針

- ★ 本工程 = 設計調査 doc 1 件のみ origin 保全
- ★ 段階1 実装(Step A + C)= **別 commit**(Step B = オーナー手作業の bucket 作成 完了報告後に着手)
- ★ 段階2(API)/ 段階3(UI)は **次セッション以降**
- ★ 区切り良い節目で止まる(M5 刻む作法・原則 3)

### 10.2 ★ 6 項目 結論サマリ

| 項目 | 結論 |
|---|---|
| 次 migration 番号 | ★ **026**(本体 ac834bb L1042 指定通り)|
| M3 同型作法 | ★ ヘッダコメント 8 セクション + RLS 二重ポリシー + 命名規約 全踏襲(★ `is_public default false` だけ MB 用に変更) |
| 026 完全 SQL 案 | ★ **+125-140 行**(2 テーブル + RLS 4 policy + index 3 + updated_at trigger)|
| Storage bucket 手順書 | ★ Supabase Studio 手作業(★ オーナー 5-10 分)+ post-images 同設定踏襲 |
| lib/storage.ts 拡張 | ★ `MOODBOARD_BUCKET` + `uploadMoodboardImage`(★ 3 階層パス)+ `deleteMoodboardImage`(+35-50 行 / M3 完全同型作法) |
| EXIF 除去 | ★ `processImageForUpload()` 完全流用(Canvas 再エンコードで構造遮断・M3 と同等防御) |

### 10.3 ★ 次工程

- 本 commit(Step 1 + 3 + 4 + 5)→ オーナー判断 → origin 保全
- 次: ★ オーナー Step B(bucket 作成・手作業)実施
- 次: Claude Code Step A + C(migration + storage.ts)= 別 commit(本 doc 完了後)
- 段階1 完了 → 段階2(API 5 本)→ 段階3(UI 3 画面 + Modal)→ 段階3 完了で C-2 完遂

---

## 11. 結論

| 観点 | 結論 |
|---|---|
| ★ Sprint C-2 段階1 設計判断 | **★ GO**(設計調査 doc のみ・コード 0 変更・規模軽微・Sprint C-1 §3-4 の実装可能粒度への分解)|
| 規模 | **+300-400 行 / 30-45 分**(本 commit)+ 段階1 実装 +160-190 行 / 25-35 分(別 commit)+ Step B 手作業 5-10 分 |
| 既存達成保持 | コード 0 変更で **全保持**(399 PASS 維持・tsc EXIT 0 維持)|
| ★ 4 レイヤー構造 | 本体 / doc7 / ロードマップ / 最終ビジョン ★ **全不変** |
| ★ 段階1 基盤層 設計 | ★ **完遂**(SQL + bucket 手順 + TS helper 全て実装可能粒度)|
| ★ 次工程 | オーナー判断 → 本 commit origin 保全 → Step B(bucket・オーナー手作業)→ Step A + C(別 commit)|
| 不可侵 | 本体 6 章 / 7 章 / 判断 6 / コスト試算 / 整合性点検 / ロードマップ / 各設計案 / 既存設計判断 1-10 ★ **全不変** |

→ ★ **段階1 基盤層 設計青写真 完遂**(実装可能粒度で組立・段階2 / 3 への引継ぎ準備完了)

---

## 12. 制約遵守チェックリスト

- [x] 新規 docs ファイル 1 件のみ(本 doc)
- [x] 本体 `ac834bb` / コード(app/api/lib/scripts/package.json/tsconfig.json)/ doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` / 各設計案(B-2 / B-3 / C-1)/ 他 docs **全 0 変更**
- [x] migrations/ ファイルは ★ 本 doc では作成しない(別工程)
- [x] 本体 6 章(リアル試着プライバシー専章)/ 7 章(③ コスト管理)/ 判断 6(Phase 2 後ゲート)diff 0 行
- [x] 既存設計判断 1-10 文言不変
- [x] view + grep + 静的解析のみ・実装なし
- [x] tsc EXIT 0 維持(本 doc は markdown のみ・コード 0 変更)
- [x] リグレッションテスト 399 PASS 維持(本工程はコード 0 変更)
- [x] 実装は ★ 別工程(本 doc では実施しない)
- [x] commit はあり / push はなし
