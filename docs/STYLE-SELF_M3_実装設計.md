# STYLE-SELF M3 実装設計 — 投稿の最小版

作成日: 2026-05-17
位置づけ: ビジョン統合マップ MVP「M3」の実装設計。
          上位 = docs/STYLE-SELF_ビジョン統合マップ.md(③繋がる の基盤)
ステータス: 設計確定。この順序で実装する。
前提: M1(診断本番化)完了。M2(世界観プロフィール公開化)完結
      (5f9968f/b569a90/f02d20b/50fca72)。投稿テーブルはゼロから新設。

---

## 0. M3 の本質

```
M2: 自動生成された世界観プロフィールを「公開できる」ようにした
M3: ユーザーが能動的に「自分の世界観/コーデを投稿」できる

= ③繋がる の基盤。M4(世界観マッチング)の素材を生む。
  投稿が「世界観タグ」を内蔵することで、M4 で
  「近い世界観の投稿/人」を出せるようになる。
```

M3 が無いと「世界観で繋がる」の "繋がる中身(投稿)" が存在しない。

---

## 1. 確定した設計判断(オーナー確定)

```
判断1: 画像必須(ファッションSNSとして視覚が核)
       ※ EXIF除去・サイズ/形式制限を必須スコープに含める
判断2: 投稿=公開固定(MVP。is_public列は持つがUIで選ばせない。
       将来「下書き」「フォロワー限定」で活用)
判断3: 置き場所は全部:
       - /u/[userId] に投稿一覧統合(M2 公開ページに並ぶ)
       - /p/[postId] 個別ページ((public)グループに同居)
       - /self に投稿作成UI + 自分の投稿一覧・削除
       ※ 全体フィードは M4(マッチングと同時)
世界観の持ち方: スナップショット型(投稿時にコピー・以後不変)
```

---

## 2. 最重要: M3 の隠れ地雷(調査で判明)

### 🔴 地雷1: 画像 EXIF 位置情報漏洩(最優先)

```
スマホ写真の EXIF に GPS座標・撮影時刻・カメラ機種が入る。
コーデ写真 = 自宅で撮る = GPS が自宅 = 投稿で自宅がバレる。

M2-3 の「HTMLソースに内面が漏れる」と同じ構造の地雷:
画面に出てなくてもデータに埋まってると漏れる。
一度公開されたら取り返しがつかない(位置が特定される)。

対策(M3-2 のスコープに必須で含める):
- アップロード前にクライアントで EXIF を完全除去
- browser-image-compression 等のライブラリ、または
  Canvas 経由の再エンコードで EXIF を落とす
- 「EXIF が落ちていること」を実機で確認する工程を必ず入れる
```

### 🔴 地雷2: 画像サイズ・形式バリデーション

```
50MB の RAW 画像等を上げられたら Storage 破綻。
対策(M3-2):
- < 5MB 程度の上限
- jpg/png/webp のみ許可
- クライアント側で圧縮・リサイズ(EXIF除去と同時に行える)
```

### 🔴 地雷3: 削除後の /p/[postId] 挙動

```
SNS で URL シェア後に投稿削除 → 存在しない postId。
M2-3 と同じ「存在しない/非公開/削除済みを区別しない
fallback」が必要(同じ「見られません」UI・HTTP200)。
区別すると postId 総当りで投稿の存在判定が漏れる。
```

---

## 3. M2 から継承する作法(再発明しない)

```
✅ RLS 二重ポリシー(本人 FOR ALL + 公開行 SELECT)
   M2-1 で確立した型をそのまま posts に適用
✅ 認証 client のみ・service_role 不使用(RLSが最後の砦)
✅ fallback で「存在/非公開/削除済み」を区別しない(M2-3)
✅ 楽観的更新なし(投稿作成は API 成功確認後に画面遷移・M2-4)
✅ (public) グループに公開ページ・(app) に作成UI(M2-3 哲学)
✅ caption は本人が書く = AI引用漏洩なし
   (M2-3 の pickPublicFields 的マスクは不要。
    ただし EXIF だけは別問題なので地雷1で対応)
```

---

## 4. データ設計

### posts テーブル(新設)

```sql
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null
    references public.users(id) on delete cascade,
  image_url text not null,                 -- 画像必須(判断1)
  caption text not null default '',        -- 任意・空でも投稿可
  -- 世界観スナップショット(投稿時にコピー・以後不変)
  worldview_tags text[] not null default '{}',     -- M4マッチング素材
  worldview_keywords text[] not null default '{}', -- 表示・日本語fallback
  worldview_name text,                     -- 投稿時の世界観名
  pattern_id text,                         -- 8パターンlegacy用
  is_public boolean not null default true, -- MVPは投稿時true固定(判断2)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### RLS(M2-1 と同じ二重ポリシー型)

```sql
alter table public.posts enable row level security;

-- 本人は自分の投稿に全権限(将来の下書き含む)
create policy "users own posts"
  on public.posts for all
  using (auth.uid() = author_user_id)
  with check (auth.uid() = author_user_id);

-- 公開行は誰でも SELECT(anon + authenticated)
create policy "public posts readable by anyone"
  on public.posts for select
  using (is_public = true);
```

### Storage

```
post-images バケットを Supabase Studio で手動作成
(migration では完結しない。M2-1 の手動適用と同じ運用)
- Storage RLS: 本人(author)だけが自分のフォルダに
  upload/delete できる。読み取りは公開(公開投稿の画像を
  anon が見るため)
- パス命名: {userId}/{timestamp}.{ext}(lib/storage.ts の
  既存パターン WARDROBE_BUCKET と同じ)
```

### 世界観スナップショットの考え方

```
投稿時に worldview_profiles から worldview_tags 等をコピー。
以後その投稿は不変(再診断しても投稿の世界観は変わらない)。
= 「投稿当時のその人の世界観」を残す。これが仕様として正しい
  (時系列で世界観の変遷も将来見られる)。
将来 UI で「○○年の世界観で投稿」と明示する余地あり(M3スコープ外)。
```

---

## 5. 実装ステップ(5段階・M2 と同じ刻み)

### M3-1: DB schema + Storage 🟢 (15分 + 手動作業)

```
- migration 024: posts テーブル + RLS 2ポリシー
  (M2-1 と同じ二重ポリシー型・非破壊)
- オーナーが Supabase Studio で:
  - migration 024 を SQL Editor で適用
  - post-images バケットを手動作成
  - Storage RLS 設定(本人のみ upload/delete・読み取り公開)
- 確認: posts テーブル・ポリシー2つ・バケット存在
リスク: 低(新規テーブル・既存に影響なし)
```

### M3-2: 画像アップロード + 投稿作成 API 🟢🔴 (1〜2時間)

```
- lib/storage.ts に uploadPostImage(userId, file) 追加
  (既存 uploadWardrobeImage と同パターン)
- 🔴 EXIF 除去を必須実装(地雷1):
  - クライアントで Canvas 再エンコード or
    browser-image-compression で EXIF を落とす
  - 同時にリサイズ・圧縮(地雷2: <5MB・jpg/png/webp)
- 投稿作成 API: app/api/posts/route.ts (POST)
  - createSupabaseServerClient()(認証client・service_role不使用)
  - auth.getUser() 未認証 401
  - body から author_user_id を受けない(user.id 固定。M2-4 と同型)
  - 投稿時に worldview_profiles から worldview_tags 等を
    サーバ側でコピー(スナップショット)
  - is_public = true 固定(MVP・判断2)
リスク: 低〜中。EXIF除去が肝(地雷1)
確認: アップロードした画像の EXIF が落ちているか実機確認必須
```

### M3-3: 投稿作成 UI 🟡 (2〜3時間)

```
- /self に投稿作成UI(画像選択 + caption入力 + 投稿ボタン)
  配置は /self?tab=diagnosis 近辺 or 新タブ(M3-5 で整理)
- 画像プレビュー・アップロード中ローディング
- 世界観スナップショットは UI で見せず裏で自動付与
  (本人の最新 worldview_profiles から・M3-2 のAPIが処理)
- 楽観的更新なし(M2-4 と同じ。API成功を待って完了表示)
- 投稿後の遷移(自分の投稿一覧 or /p/[新postId])
リスク: 中(画像UIの状態管理)
確認: 投稿→画像が表示される→EXIF落ちてる→世界観タグが
      裏で付与されている(DB確認)
```

### M3-4: /u/[userId] 投稿一覧 + /p/[postId] 個別 🟡 (2〜3時間)

```
- /u/[userId](M2-3 で作った公開ページ)に
  「この人の投稿」セクション追加
  - is_public=true の投稿を created_at 降順で
  - M2-3 の anon クライアント・RLS の作法を踏襲
- /p/[postId] 新設(app/(public)/p/[postId]/page.tsx)
  - M2-3 の /u/[userId] と同じ構造(Server Component・
    anon client・fallback 同UI・HTTP200)
  - 投稿 + 投稿者の世界観名 + /u/[author] へのリンク
  - 🔴 削除/非公開/不存在を区別しない fallback(地雷3)
  - author の世界観が非公開なら /u/ リンクは
    「見られません」になる(M2-3 と整合・独立制御)
リスク: 中(M2-3 の作法を踏襲するので型はある)
確認: 投稿が /u/ に並ぶ・/p/[postId] が anon で見える・
      削除後 /p/ が「見られません」
```

### M3-5: 自分の投稿一覧 + 削除UI 🟢 (1〜2時間)

```
- /self に「投稿」関連の整理(自分の投稿一覧)
- 自分の投稿を削除できる(本人RLSで DELETE 可)
  - 削除は確認あり(誤削除防止。M2-4 のモーダル思想)
  - 削除したら Storage の画像も消す(孤児ファイル防止)
- BottomNav の「投稿」タブ化は任意(M3スコープ外でも可。
  最小は /self 内に作成・一覧があれば成立)
リスク: 低
確認: 自分の投稿一覧・削除→/p/[postId]が「見られません」・
      画像もStorageから消えている
```

---

## 6. ステップ依存関係

```
M3-1(DB+Storage)
  ↓ posts テーブル・バケットが無いと何も保存できない。最初
M3-2(画像アップロード+API)← M3-1 必須
  ↓ EXIF除去がここの肝。投稿の入口
M3-3(作成UI)← M3-2 必須
  ↓ ユーザーが投稿を作れる
M3-4(/u 一覧 + /p 個別)← M3-3 必須(投稿が無いと表示できない)
  ↓ 他者が見られる = ③繋がる が成立
M3-5(自分の一覧+削除)← M3-3 必須
  ↓ 投稿を管理できる = M3 完結
```

順序厳守。特に M3-1 が全ステップの前提。M3-2 の EXIF 除去は
セキュリティの肝なので、M3-2 完了時に実機で EXIF が落ちて
いることを必ず確認してから M3-3 へ。

---

## 7. M4(世界観マッチング)を見据えた保証

```
M3 の posts は worldview_tags text[] を持つ(スナップショット)。
これにより M4 で:
  posts WHERE worldview_tags && viewer_tags
        ORDER BY (重なりタグ数) DESC
のような「近い世界観の投稿」演算が後付けでできる。

→ M3 のスキーマは M4 のブロッカーにならない。
  M3 時点で worldview_tags / worldview_keywords /
  author_user_id / created_at を持たせれば M4 は作り直し不要。
```

---

## 8. スコープ外(切り離す・将来)

```
- 全体フィード(/discover に投稿タブ)→ M4(マッチングと同時)
- 通報・モデレーション → M4以降(他者投稿が大量に出てから)
- いいね・コメント等のソーシャル機能 → 将来
- 複数画像投稿 → 将来(MVPは1枚)
- /saved の "Saved Posts"(他者投稿の保存)→ 後回し
- BottomNav「投稿」タブ化 → 任意(M3完結後に検討)
- 「○○年の世界観で投稿」表示 → 将来
- 世界観 snapshot の鮮度UI明示 → 将来
```

---

## 9. オーナー実機確認の要点(M2 の教訓)

```
M2-3 で「コードの自己検証 ≠ 実機の安全」を学んだ。
M3 でも各ステップで実機確認。特に:

M3-2 後:🔴 アップロードした画像の EXIF が落ちているか
  (実機で撮った写真を上げ、EXIF ビューア等で GPS が
   消えていることを確認。ここが M3 最大の地雷)
M3-4 後:投稿が /u/ /p/ で anon で見える・削除後
  「見られません」になる
M3-5 後:削除で Storage 画像も消える(孤児が残らない)
```

---

## 10. このドキュメントの位置づけ

```
docs/STYLE-SELF_ビジョン統合マップ.md(最上位)
  ├ STYLE-SELF_診断システム_再設計.md(①知る 思想)
  ├ STYLE-SELF_フェーズB_実装設計.md(①知る 実装・完了)
  ├ STYLE-SELF_M2_実装設計.md(③繋がる 土台・完了)
  └ STYLE-SELF_M3_実装設計.md(このファイル・③繋がる 基盤)

Knowledge OS再設計・フェーズB・M2 と同じ
「調査→設計→ステップ実装」の型。M3 も5ステップで進める。
```
