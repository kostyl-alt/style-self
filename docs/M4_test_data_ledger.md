# M4 検証用テストデータ台帳

> このファイルは「投入したテストデータの素性」を一元記録する台帳である。
>
> **趣旨**: 2026-05-17〜18 に「admin user_id = `6bd309dd-...`」と誤認した
> 幽霊 id で1日分混乱した教訓を踏まえ、テストデータの id・素性・用途・
> 後片付け手順を明示し、同種の取り違えを構造的に防ぐ。

## 目的

M4(世界観マッチング)の実装と検証には、オーナー(7ed5d391)から見て
`worldview_tags` の overlap が階段状に変化する「他人」のデータが必要。
本台帳の規約に従い、5 ペルソナ + 各 2 投稿(計 10 件)を Supabase に投入する。

## 構造的な印(多重)

| レベル | 印 | 検索方法 |
|---|---|---|
| Email | `test+seed{N}@style-self.local`(N=1..5) | `select * from auth.users where email like 'test+seed%@style-self.local';` |
| display_name | `[TEST] <persona名>` プレフィックス | `select * from public.users where display_name like '[TEST]%';` |
| caption | `[TEST] ` プレフィックス | `select * from public.posts where caption like '[TEST]%';` |
| user_id | deterministic UUID `00000000-0000-4000-8000-00000000000{N}` | 連続したゼロ + 末尾 1 桁で本物の UUID と一目で区別可能 |
| post_id | deterministic UUID `00000000-0001-4000-8000-0000000000{N}{P}` | 同上(`-0001-` セグメントで「テスト投稿」と判別) |

### TLD `.local` の根拠

`.local` は RFC 6762 で内部用に予約されており、**インターネット上で
メール配信されない**。万が一 Supabase が確認メールを送ってもバウンスして
外部到達しない設計。

## 5 ペルソナ(設計)

| N | user_id | email | display_name | worldview_name | target_overlap |
|---|---------|-------|--------------|----------------|---------------|
| 1 | 00000000-0000-4000-8000-000000000001 | test+seed1@style-self.local | [TEST] Dark Adjacent      | 退廃を装う観察者 | 3(近)|
| 2 | 00000000-0000-4000-8000-000000000002 | test+seed2@style-self.local | [TEST] Structured Refined | 構造で語る大人   | 2(中)|
| 3 | 00000000-0000-4000-8000-000000000003 | test+seed3@style-self.local | [TEST] Quiet Intellectual | 静謐な観察者     | 2(中)|
| 4 | 00000000-0000-4000-8000-000000000004 | test+seed4@style-self.local | [TEST] Edge Experimental  | 逸脱する作り手   | 1(縁)|
| 5 | 00000000-0000-4000-8000-000000000005 | test+seed5@style-self.local | [TEST] Soft Natural       | やわらかな自然体 | 0(遠)|

### tags 構築ルール

各ペルソナの `worldview_tags`(5 個固定)は、シード実行時にオーナーの
アンカー(`worldview_profiles.result.worldview_tags` を service_role で取得)
に対し、以下のルールで動的構築される:

```
final_tags = anchor[rotate(idx * 2)][0 .. target_overlap]
            + filler[anchor と被らないもの][0 .. (5 - target_overlap)]
            + EXTRA_FILLER で 5 個に達するまで補充
```

### filler tags(ペルソナ固有)

| N | filler tags |
|---|---|
| 1 | sensual, romantic |
| 2 | clean, structured, mature |
| 3 | quiet, intellectual, nostalgic |
| 4 | raw, rebellious, expressive, sharp |
| 5 | soft, natural, relaxed, approachable, youthful |

`EXTRA_FILLER`(全ペルソナ共通の補充候補・anchor と被るものは除外):
`soft, natural, relaxed, approachable, open, youthful, expressive, mysterious, light`

→ filler は worldview-patterns.ts の coreTags 語彙に統一(全員 `minimal` で
全員マッチになる現象を避ける設計)。

### 実投入時の actual_overlap

`actual_overlap` は filler が anchor と偶然被るケースでは target より大きく
なりうる(設計セクション 8 で許容)。seed スクリプトの実行ログで実値を確認する。
seed 実行時に「actual=N」として全 5 ペルソナを表示する。

## 投稿(各ペルソナ × 2 = 10 件)

| post_id 末尾 12 桁 | author | image | caption |
|---|---|---|---|
| `0000000000{N}{P}` | persona{N} | `placehold.co/600x600/{bgHex}/{textHex}?text=...` | `[TEST] <worldview_name> - sample {P}` |

- 画像は **外部プレースホルダ URL のみ**。Supabase Storage の `post-images`
  バケットには **1 件も書き込まない** → 孤児ファイル発生がゼロ
- `worldview_tags` / `worldview_keywords` / `worldview_name` は profile と同一
  (M3-2 の snapshot 仕様を再現)
- `is_public = true`(M4 マッチ対象になるため)

## 投入手順(オーナー実行)

### 1. アンカー事前確認(オーナーが診断完了している前提)

Supabase Studio SQL Editor で:

```sql
select result->'worldview_tags' as my_tags
from public.worldview_profiles
where user_id = '7ed5d391-5e47-40ae-adc5-68464b380a50';
```

`my_tags` が空 / 行なし の場合は **先に診断完了が必要**(seed スクリプトが
abort する)。

### 2. シード実行

```bash
# 安全装置: SEED_OK=true を明示
SEED_OK=true npx tsx scripts/seed-m4-test-data.ts
```

スクリプトの実行内容:
1. 安全装置(URL / SEED_OK フラグ / service_role)チェック
2. オーナーアンカー取得 → 失敗時は abort
3. 5 ペルソナの tags を動的構築 + actual_overlap をログ出力
4. `auth.admin.createUser({ id, ... })` で各ペルソナ作成
   (deterministic UUID 指定・既存は skip = 冪等)
5. `public.users.display_name` を `[TEST] ...` に UPDATE
6. `worldview_profiles` upsert(is_public=true)
7. `posts` × 各 2 件 upsert(deterministic UUID)
8. 投入結果サマリ + 後片付けコマンドを出力

### 3. 投入確認(オーナー Supabase Studio で)

```sql
-- ユーザー
select id, email, created_at from auth.users
where email like 'test+seed%@style-self.local'
order by email;

-- worldview_profiles
select user_id, pattern_name, is_public,
       result->'worldview_tags' as tags
from public.worldview_profiles
where user_id::text like '00000000-0000-4000-8000-%'
order by user_id;

-- posts(各2件×5=10件)
select id, author_user_id, caption, is_public,
       array_length(worldview_tags, 1) as tag_count
from public.posts
where caption like '[TEST]%'
order by id;
```

## 後片付け手順(検証完了後)

```bash
# 安全装置: TEARDOWN_OK=true を明示
TEARDOWN_OK=true npx tsx scripts/teardown-m4-test-data.ts
```

スクリプトの実行内容:
1. 安全装置チェック
2. `auth.admin.listUsers()` で `test+seed%@style-self.local` を抽出
3. 関連 posts / worldview_profiles の件数を削除前に表示
4. 各 user に `auth.admin.deleteUser()` を呼ぶ → **FK CASCADE 連鎖**で
   `public.users / posts / worldview_profiles` が自動削除
5. 残骸チェック(全テーブル 0 件を確認 + ログ出力)
6. 残骸あれば exit 1(手動確認誘導)

### CASCADE 連鎖の根拠

全 FK が `on delete cascade`:

```
auth.users
  ↓ public.users.id references auth.users(id) on delete cascade  [001:6]
public.users
  ↓ posts.author_user_id references public.users(id) on delete cascade           [024:55]
  ↓ worldview_profiles.user_id references public.users(id) on delete cascade   [020]
  ↓ diagnosis_sessions.user_id references public.users(id) on delete cascade   [020]
  ↓ user_style_events.user_id references public.users(id) on delete cascade    [020]
```

→ `auth.users` を 1 件 DELETE すれば配下全てが連鎖削除される構造。

### Storage バケットの残骸:**無し**(設計上)

`post-images` バケットに **1 件も書き込まない** 設計(image_url は
外部 placehold.co URL のみ)のため、Storage 清掃は不要。

## 安全装置(seed / teardown 共通)

| # | 対策 |
|---|---|
| 1 | `NEXT_PUBLIC_SUPABASE_URL` が読めなければ abort |
| 2 | seed は `SEED_OK=true`、teardown は `TEARDOWN_OK=true` 環境変数必須(うっかり実行防止)|
| 3 | `SUPABASE_SERVICE_ROLE_KEY` が読めなければ abort |
| 4 | `package.json scripts` に登録しない → CI に組み込まれない・手動実行のみ |
| 5 | Storage 不使用(外部画像 URL のみ)→ 孤児ファイル発生ゼロ |
| 6 | deterministic UUID で本物の UUID と一目区別可能 |
| 7 | seed 冒頭でアンカー取得 → 失敗時(行なし / tags 空)abort & 「先に診断完了が必要」と明示 |

## なぜ deterministic UUID を使うのか(6bd309dd 教訓)

2026-05-17〜18 の M3-5 検証中、admin の user_id を `6bd309dd-a52f-4d98-...`
(実在しない幽霊 id)と誤認したまま「他人の投稿を削除できた」と勘違いし、
**1 日分の長時間混乱が発生**した。実際は本人(`7ed5d391`)が自分の投稿を
削除した正常動作だったが、メモにあった id を盲信したことで取り違えが起きた。

`00000000-0000-4000-8000-00000000000{N}` の deterministic UUID は、
**連続したゼロ + 末尾 1 桁** という極めて特徴的なパターンで、本物のランダム
UUID と視覚的に区別できる。Supabase Studio / ログ / DevAuthBadge のどこで
見ても「これはテストデータだ」と一目で判別できる。

→ 同種の取り違えが構造的に起きない。

## 関連リソース

- スクリプト本体: [scripts/seed-m4-test-data.ts](../scripts/seed-m4-test-data.ts) / [scripts/teardown-m4-test-data.ts](../scripts/teardown-m4-test-data.ts)
- 関連マイグレーション: [001](../supabase/migrations/001_initial_schema.sql) / [020](../supabase/migrations/020_diagnosis_v2.sql) / [023](../supabase/migrations/023_m2_public_worldview.sql) / [024](../supabase/migrations/024_m3_posts.sql)
- 認証確定事実: [docs/STYLE-SELF_M3_実装設計.md](STYLE-SELF_M3_実装設計.md) セクション 11
- DevAuthBadge: [components/dev/DevAuthBadge.tsx](../components/dev/DevAuthBadge.tsx)(画面で実 user_id を確認できる補助)
