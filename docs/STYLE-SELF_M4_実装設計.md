# STYLE-SELF M4 実装設計 — 世界観マッチング

作成日: 2026-05-18
位置づけ: ビジョン統合マップ MVP「M4」の実装設計。
          上位 = [docs/STYLE-SELF_ビジョン統合マップ.md](STYLE-SELF_ビジョン統合マップ.md)(③繋がる **本体**)
ステータス: 設計確定。この順序で実装する。
前提: M1(診断本番化)/ M2(公開世界観プロフィール)/ M3(投稿機能)完結。
      検証データ 5 ペルソナ + 10 投稿が seed 済み(台帳: [docs/M4_test_data_ledger.md](M4_test_data_ledger.md))。

---

## 0. M4 の本質

```
M1: 自分の世界観を「言葉にできる」(診断)
M2: その世界観を「人に見せられる」(公開プロフィール)
M3: 投稿を通じて世界観を「表現できる」(画像+caption+tag snapshot)
M4: 世界観で「人/投稿に出会える」  ← 本質的な ③繋がる の中核
```

M4 が無いと、世界観は「自分の中に閉じた言語」のままで、Style-Self の
「世界観で繋がる」という標語は実体を持たない。M3 までは個人の表現基盤、
M4 は集団の発見基盤。

---

## 1. 確定した設計判断(オーナー確定)

```
判断1: マッチ対象は「両方」
       - 投稿マッチ: posts.worldview_tags 同士の overlap
       - 人マッチ:   worldview_profiles.worldview_tags 同士の overlap

判断2: 配信面は /discover に「世界観が近い」専用タブ追加
       (既存 inspiration / learn / culture は無変更・タブ1つ足すだけ)
       = M3-5 で /self に "posts" タブを足したのと同じ作法

判断3: 配信からの導線
       投稿 → /p/[postId](M3-4 既存)
       人   → /u/[userId](M2-3 / M3-4 既存)
       = M4 で新規ページは作らない。「発見面 → 既存導線」のみ

判断4: マッチ計算式は単純 overlap 数(後述セクション 2)

判断5: M3 由来のプライバシー作法を完全踏襲
       - anon client + RLS + 列絞り(SELECT 句)
       - 自己除外(.neq)
       - worldview_tags(英語スラッグ)を HTML/API レスポンスに出さない
       - 楽観的更新なし
```

---

## 2. マッチ計算式の確定 — **単純 overlap 数**

### 検証データから見た式の妥当性

オーナーアンカー(8 tags):
```
minimal, dark, structured, deconstruction, refined, gothic, monochrome, avant-garde
```

検証 5 ペルソナの各 tags(5 固定)に対する:

| ペルソナ | overlap 数 | Jaccard |
|---|---|---|
| Dark Adjacent      | 3 | 3 / (8+5−3) = 0.30 |
| Structured Refined | 2 | 2 / (8+5−2) = 0.18 |
| Quiet Intellectual | 2 | 2 / 11 = 0.18 |
| Edge Experimental  | 1 | 1 / 12 = 0.083 |
| Soft Natural       | 0 | 0 |

→ 各 persona の **tag 件数が 5 で揃っている間、Jaccard と単純 overlap 数の
順位は完全に一致**(分母が単調)。MVP では計算が単純で UI 表現も
直感的(「3 個共通」)な **単純 overlap 数を採用**。

将来 tag 件数が大きく(例: 10〜20)・少なく(例: 1〜2)分散したら
Jaccard 切替を検討。本ドキュメントには切替判断の余白を残す。

### overlap=0 の扱い

- `.overlaps()` フィルタで **1 個以上重なるもののみ表示**
- 0 件結果は「該当なし」UI(「もう少し投稿してみよう / 他のユーザーが
  公開を始めるまで少々お待ちください」程度の文言)

### 同 overlap 内の tie-break

```
ORDER BY overlap_count DESC, created_at DESC, id DESC
```

- 第1: overlap 数(主軸)
- 第2: 新着優先(`created_at desc`)
- 第3: id desc(完全 deterministic な順序保証)

### 計算をどこでやるか

**段階1+2(MVP)**:
1. `.overlaps("worldview_tags", myTags)` で SQL 側絞り込み(GIN index 効く)
2. 取得した行 ×〜数百件をサーバ(Route Handler)で intersection 数計算 → sort
3. limit を切って返す

→ サーバ実装は 50 行未満で済む。RPC や事前計算は MVP 不要。

---

## 3. M4 の隠れ地雷(M2/M3 教訓を継承)

### 🔴 地雷1: worldview_tags(英語スラッグ)の HTML inline 漏洩

```
M2-3 で「量産型」が公開ページの HTML ソースに 6 回見えた事象と同型。
worldview_tags は商品マッチング/M4 内部計算用の英語スラッグ
(dark / gothic / minimal 等)。ユーザーには「3 個共通」のような
抽象表現で出す約束。

地雷:
- API レスポンスに worldview_tags をそのまま含めると、
  Network タブで他人の tags が見える(/u/ 同様の漏洩)
- React コンポーネントに props で渡して表示しなくても、
  __NEXT_DATA__ や hydration data に乗ると HTML inline 漏洩

対策(M4-2 / M4-3 必須):
- API レスポンスに worldview_tags を含めない(overlap 数だけ返す)
- サーバ側で overlap 計算してから tags を捨てる
- M3-4 「SELECT 句で公開対象だけ取る」と同型の作法
```

### 🔴 地雷2: 自己除外漏れ

```
自分の投稿/プロフィールがマッチ結果に紛れ込むと:
- overlap が常に最大(自分 tags = 自分 tags)で 1位に来る
- 「自分しかいない」状態になる

対策(M4-2 / M4-3 必須):
- .neq("author_user_id", user.id) / .neq("user_id", user.id)
- 未ログイン時は除外不要(全件公開を見せる)
- 「自分が居ない」が成り立つ最小単体テスト(M4-5 実機確認)
```

### 🔴 地雷3: 診断未完了ユーザー

```
M3 で「診断無しでも投稿可」としたため、診断未完了で発見タブを
開くケースが必然的に発生する。マッチ素材(自分の tags)が無い。

対策(M4-2 / M4-3 / M4-5):
- 自分の worldview_profiles 行なし / tags 空 → 400 や 500 ではなく
  ok:true で空結果 + 「診断してマッチを見る」UI を返す
  (M3-4 fallback HTTP 200 と同型・存在判定リーク防止は不要だが
   「壊れた発見タブ」を作らない)
```

---

## 4. M4-1: DB 基盤(migration 025)

### 🎯 目的
posts.worldview_tags への `&&`(overlaps)演算を高速化する GIN
インデックスを追加。worldview_profiles 側は当面追加しない。

### worldview_profiles に GIN を入れない根拠

```
worldview_profiles.worldview_tags は直接列ではなく
result jsonb の中(result->'worldview_tags')。GIN を入れるなら
式インデックス(create index ... using gin ((result->'worldview_tags')))
が必要だが:

- 公開プロフィール母数 = is_public=true ユーザー数 = 当面〜数十人
- 数十件の全件 SELECT で十分(50ms 以内)
- 母数が数百〜数千になってから式インデックスを足せばよい
- MVP で先に作っても効果なし・式インデックスのメンテ負担だけ残る

→ M4-1 では posts の GIN だけ。worldview_profiles は M4 完了後の
  運用で必要性を見て判断。
```

### migration 内容(025_m4_match_index.sql)

```sql
-- M4-1: posts.worldview_tags を `&&` で絞り込む GIN インデックス
--
-- 【背景】
-- M4 投稿マッチで .overlaps(worldview_tags, myTags) を多用する。
-- 公開投稿が数千件規模になると seq scan は遅くなる。GIN なら msec オーダー。
--
-- 【冪等性】 create index if not exists
-- 【ロールバック】 drop index if exists public.posts_worldview_tags_gin_idx;

create index if not exists posts_worldview_tags_gin_idx
  on public.posts using gin (worldview_tags);
```

### reversibility

- `drop index if exists` で即座にロールバック可能
- 元データには触らない(index 追加だけ)
- 失敗しても本番の posts データに影響ゼロ

### 完了基準

- migration 025 適用後、Supabase Studio で `posts_worldview_tags_gin_idx`
  が存在すること
- `explain (analyze) select * from posts where worldview_tags && array['dark']`
  で `Bitmap Index Scan on posts_worldview_tags_gin_idx` が出ること

---

## 5. M4-2: 投稿マッチ API

### 🎯 目的
`GET /api/match/posts` — 自分の世界観に近い公開投稿を overlap 数
降順で返す。

### エンドポイント設計

```
GET /api/match/posts?limit=24
→ 200 { ok: true, items: [{ id, image_url, caption, author_user_id,
                            author_display_name, common_tag_count,
                            created_at }, ...] }
   (自分の tags 取得失敗時) 200 { ok: true, items: [], reason: "diagnosis_required" }
   (未ログイン) 200 { ok: true, items: [], reason: "auth_required" }
```

### 取得経路(M3-4 作法踏襲)

```
1. createSupabaseServerClient()(認証クッキー経由)
   → service_role 不使用・anon 相当の権限
2. supabase.auth.getUser() で自分の user.id
3. 自分の worldview_tags を取得:
   from worldview_profiles where user_id = self.id
   select result
   → result->'worldview_tags' を string[] にパース
   行なし / 空 → reason:"diagnosis_required" で早期 return
4. .from("posts").select(...).overlaps("worldview_tags", myTags)
                            .neq("author_user_id", self.id)
                            .eq("is_public", true)              ★ アプリ層+RLS 二重防御
                            .order("created_at", { ascending: false })
                            .limit(200)                          ★ overlap 計算のための母集団
   → RLS "public posts readable by anyone" が is_public=true のみに絞る
5. サーバ側で overlap 数計算 + sort:
   items.map((p) => ({ ...p, common: intersect(myTags, p.worldview_tags).length }))
   .sort((a,b) => b.common - a.common || (b.created_at > a.created_at ? 1 : -1))
   .slice(0, limit)
6. author の display_name を public_users view から取得(実装時再検証で確定)
   .from("public_users").select("id, display_name").in("id", authorIds)
   ※ public.users 直接読みは RLS "users can read own profile"
     (auth.uid()=id)で他人が構造的に弾かれ全件 null になる。
     M2-1(023)の public_users view は SECURITY DEFINER +
     INNER JOIN worldview_profiles.is_public=true で is_public=true
     ユーザーの id+display_name だけ露出する厳格設計。M4-3 人マッチと
     同じ view を使う統一的な経路。
     → worldview 非公開ユーザーは display_name=null(UI プレースホルダ)
7. レスポンス:worldview_tags を含めない(プライバシー設計セクション 9)
```

### レスポンス形(プライバシー要件)

```ts
type MatchPostItem = {
  id:                  string;   // /p/[id] 導線
  image_url:           string;   // M3-4 と同じ範囲
  caption:             string;   // 同上
  author_user_id:      string;   // /u/[id] 導線
  author_display_name: string;   // 表示用
  common_tag_count:    number;   // ★ overlap 数(数値のみ・tag 本体は出さない)
  created_at:          string;
};
```

→ **worldview_tags は API レスポンスに含めない**。common_tag_count
だけ。「3 個共通」「2 個共通」と数値で表現する(地雷1 対策)。

### 診断未完了時

- 200 + `{ ok: true, items: [], reason: "diagnosis_required" }`
- 400 / 500 にしない(M3-4 fallback HTTP 200 思想・「壊れた発見タブ」を作らない)

### 失敗時

- DB エラー: 500 `{ error: <message> }`(M3 既存パターン)
- 認証失敗: 200 + `{ items: [], reason: "auth_required" }`

---

## 6. M4-3: 人マッチ API

### 🎯 目的
`GET /api/match/users` — 自分の世界観に近い公開ユーザー(他者)を
overlap 数降順で返す。

### エンドポイント設計

```
GET /api/match/users?limit=12
→ 200 { ok: true, items: [{ user_id, display_name, worldview_name,
                            common_tag_count }, ...] }
   (診断未完了) 200 { ok: true, items: [], reason: "diagnosis_required" }
   (未ログイン) 200 { ok: true, items: [], reason: "auth_required" }
```

### 取得経路(投稿マッチと違う点を明記)

```
投稿マッチは posts テーブルを直接 SELECT(worldview_tags は posts の
直接列で .overlaps() できる)。

人マッチは worldview_profiles の result jsonb 内の worldview_tags を
扱う必要があり、posts のような直接 .overlaps() は使えない:

経路:
1. self の tags 取得(投稿マッチと同じ)
2. .from("worldview_profiles").select("user_id, pattern_name, result")
                              .eq("is_public", true)
                              .neq("user_id", self.id)
                              .limit(200)
   → RLS "public worldview profiles readable by anyone" が is_public=true
     のみに絞る・M2-1 既存
3. サーバ側で各行の result->worldview_tags を取り出し、self.tags との
   overlap 数を計算 → 1 以上のみ採用 → sort → limit
4. user_id 一覧から display_name を取得:
   .from("public_users").select("id, display_name").in("id", userIds)
   → public_users view(M2-1)は is_public=true ユーザーの id+display_name
     だけ露出する厳格 view・anon にも開いている
5. レスポンスに worldview_tags は含めない(共通点数のみ)
```

### 人カードのレスポンス内容

```ts
type MatchUserItem = {
  user_id:          string;        // /u/[id] 導線
  display_name:     string | null; // public_users 経由
  worldview_name:   string;        // worldview_profiles.pattern_name
                                   // (今は「退廃を装う観察者」等の日本語名・公開可)
  common_tag_count: number;        // overlap 数
};
```

→ worldviewName は **公開対象**(/u/ で既に出ている範囲)なので含める。
worldview_tags 英語スラッグは含めない(地雷1)。

### 投稿マッチとの構造差(明記)

| 項目 | 投稿マッチ | 人マッチ |
|---|---|---|
| メインテーブル | `posts`(text[] 直接列)| `worldview_profiles`(jsonb 内)|
| `.overlaps()` 使用 | ◎ 直接使える | ✕ jsonb のため使えない |
| 候補絞り | RLS + `.overlaps()` フィルタ | RLS + サーバ側 filter |
| display_name 取得 | public.users(別経路)| public_users view |
| 母集団上限(`limit`)| 200 件 | 200 件(同じ)|

---

## 7. M4-4: 発見タブ UI

### 🎯 目的
`/discover` に「世界観が近い」タブを 1 つ追加。既存3タブは一切無変更。

### 既存 /discover との差分

```
変更前: TABS = [inspiration, learn, culture]
変更後: TABS = [inspiration, learn, culture, worldview-match]
        ↑ 末尾に 1 件追加
```

[app/(app)/discover/page.tsx](../app/(app)/discover/page.tsx) の修正:

```diff
-type DiscoverTab = "inspiration" | "learn" | "culture";
+type DiscoverTab = "inspiration" | "learn" | "culture" | "worldview-match";

 const TABS: { value: DiscoverTab; label: string; description: string }[] = [
   { value: "inspiration", label: "インスピレーション", description: "..." },
   { value: "learn",       label: "ブランドを学ぶ",     description: "..." },
   { value: "culture",     label: "カルチャー",         description: "..." },
+  { value: "worldview-match", label: "世界観が近い",
+    description: "あなたと近い世界観の投稿・人を、共通する世界観要素の数で並べます" },
 ];

 function isDiscoverTab(v: string | null): v is DiscoverTab {
-  return v === "inspiration" || v === "learn" || v === "culture";
+  return v === "inspiration" || v === "learn" || v === "culture" || v === "worldview-match";
 }
 ...
 {activeTab === "culture"     && <CultureView analysis={analysis} />}
+{activeTab === "worldview-match" && <WorldviewMatchView />}
```

→ M3-5 で `/self` に "posts" タブを足したのと同型の作法。既存3タブは
動作も無変更(diff は include に値を 1 つ加えるだけ)。

### WorldviewMatchView コンポーネント

新規: `components/discover/WorldviewMatchView.tsx`

```
構成(縦並び・2 セクション):
1. ヘッダ:
   - "あなたの世界観" badge(/self への薄い導線)
   - 説明文: 「共通する世界観要素が多い順に表示しています」
2. 「世界観が近い人」セクション(上)
   - GET /api/match/users で取得
   - 横スクロール or 2 列グリッド(8 件)
   - 各人カード: display_name + worldviewName + 「N 個共通」
   - クリック → /u/[user_id](M2-3 既存)
3. 「世界観が近い投稿」セクション(下)
   - GET /api/match/posts で取得
   - 3 列正方グリッド(M3-4 /u/ Posts と同じレイアウト・流用可)
   - 各サムネ右上に「N 個共通」バッジ
   - クリック → /p/[post_id](M3-4 既存)
4. 空状態:
   - reason="diagnosis_required" → 「世界観を診断するとマッチが見えます」
     + /onboarding ボタン
   - reason="auth_required"      → 「ログインで世界観マッチ」+ /login ボタン
   - 該当なし(両方 0 件)       → 「他のユーザーが公開を始めるまで少々お待ちください」
```

### M3-4 グリッド流用

[app/(public)/u/[userId]/page.tsx](../app/(public)/u/[userId]/page.tsx) の Posts
グリッドと同じ TailwindCSS パターン(`grid grid-cols-3 gap-1.5
aspect-square`)を流用。共通コンポーネント化は M4 完了後の余地として残す
(MVP は重複でも単純さを優先・M3 由来の「無理に共通化しない」方針)。

---

## 8. M4-5: 仕上げ

### 診断未完了 UI

```
/discover?tab=worldview-match を開いて API が
reason:"diagnosis_required" を返したら、
WorldviewMatchView は「世界観を診断するとマッチが見えます」+
[診断する → /onboarding] ボタンを表示。

= M3 の「診断無しでも投稿可」と整合(発見面でだけ
  「診断あると深く楽しめる」を訴求)。
```

### 未ログイン UI

```
middleware.ts の matcher で /discover は authRoutes ではないが、
ログインしないと self の tags が無い。
→ API は reason:"auth_required" + 空 items を返す
→ View は「ログインで世界観マッチ」+ [ログイン → /login]
```

### 自己除外の最終確認(M4-5 実機テスト項目)

```
1. オーナー(7ed5d391)でログイン
2. /discover?tab=worldview-match を開く
3. 投稿セクションに自分の posts(seed 前から 1 件あり)が出ないこと
4. 人セクションに自分自身(7ed5d391)が出ないこと
→ 確認 SQL: 各 API レスポンスの items に self.id が含まれない
```

### 検証データ 5 ペルソナでの期待結果

```
人マッチ items[] の順序(オーナーから見て):
  1. [TEST] Dark Adjacent       (common_tag_count=3)
  2. [TEST] Structured Refined  (common_tag_count=2)  ※ tie-break で created_at desc
  2. [TEST] Quiet Intellectual  (common_tag_count=2)
  4. [TEST] Edge Experimental   (common_tag_count=1)
  -- Soft Natural は overlap=0 で .overlaps() フィルタにより非表示

投稿マッチ items[] の順序(各 persona 2 投稿 × 4 persona = 8 件・Soft 除外):
  上位 6 件が common=3 または 2、下位が 1。Soft Natural の投稿は出ない。
```

これが M4-5 の合否ライン:
- 順序が overlap 数降順になっている
- Soft Natural が出ていない
- 自分自身が出ていない
- worldview_tags 英語スラッグが Network タブ / View Source に出ていない

### プライバシー View Source 点検(M2-3 教訓)

```
1. /discover?tab=worldview-match を開く
2. ブラウザの「ページのソースを表示」
3. Ctrl+F で以下が **出ないこと** を確認:
   - dark / gothic / deconstruction / monochrome / minimal / structured /
     refined / avant-garde(オーナーアンカーの 8 tags)
   - quiet / sensual / soft 等 persona 側 tags
   - "worldview_tags" という文字列(__NEXT_DATA__ 内含む)
4. Network タブで /api/match/* のレスポンス JSON も同様に点検
   → 出るのは common_tag_count(数値)だけになっていること
```

---

## 9. プライバシー設計(M2-3/M3-4 教訓を継承)

### 公開しない / 公開する 一覧

| データ | 公開? | 根拠 |
|---|---|---|
| `worldview_tags`(英語スラッグ)| ❌ 含めない | M2-3 漏洩教訓・内部マッチ用語彙 |
| `common_tag_count`(数値) | ✅ 出す | 「3 個共通」と抽象表現で UI に出す |
| `display_name` | ✅ 出す(条件付き)| M2-3 既存・public_users view 経由。**worldview 非公開ユーザーは null**(下記副作用参照)|
| `worldview_name`(日本語名) | ✅ 出す | M2-3 既存・/u/ 公開対象 |
| posts.image_url / caption | ✅ 出す | M3-4 既存範囲 |
| posts.author_user_id | ✅ 出す | /u/ への導線として必要 |
| `worldview_profiles.result` 全体 | ❌ 全体は出さない | 内省フィールド含む・M2-3 で pickPublicFields が出す範囲のみ |

### 多層防御(M3 と同型)

```
1. RLS: is_public=true 行のみ anon が SELECT 可能
   (posts: "public posts readable by anyone" / worldview_profiles: 同名ポリシー)
2. アプリ層 .eq("is_public", true):  RLS と二重防御
3. .neq("author"|"user", self.id):   自己除外
4. SELECT 句で worldview_tags は取るが、レスポンスからは外す
5. anon client(createSupabaseServerClient)・service_role 不使用
6. author display_name は public_users view 経由(worldview_profiles.is_public=true
   ユーザーの id+display_name だけ露出する厳格 view)
```

### author_display_name の null 副作用(意図的・privacy-conservative)

| 条件 | author_display_name |
|---|---|
| author の `worldview_profiles.is_public = true` | ✅ `[TEST] Dark Adjacent` 等の文字列 |
| author の `worldview_profiles.is_public = false` | `null`(UI 側でプレースホルダ表示)|
| author の `worldview_profiles` 行なし(診断未完了)| `null`(同上)|

→ 「投稿は公開しているが worldview プロフィールは非公開」のユーザーは
名前が出ない仕様。これは:
- worldview を隠している人は「世界観で見つかること」を望まない前提と整合
- 投稿サムネ / 共通点数 / `/u/` 導線 は出る → クリックすると M3-4 fallback
  「見られません」になり、構造的に privacy 一貫性が保たれる
- M2-1 `public_users` view 設計と完全整合(SECURITY DEFINER で
  is_public=true 限定露出)

### worldview_tags をサーバで使ってからレスポンスから外す手順

```ts
// M4-2 投稿マッチ Route Handler の擬コード
const { data: candidates } = await supabase
  .from("posts")
  .select("id, image_url, caption, author_user_id, created_at, worldview_tags") // tags も取る
  .overlaps("worldview_tags", myTags)
  .neq("author_user_id", user.id)
  .eq("is_public", true)
  .order("created_at", { ascending: false })
  .limit(200);

// サーバ内で計算
const scored = candidates.map((p) => ({
  id:                  p.id,
  image_url:           p.image_url,
  caption:             p.caption,
  author_user_id:      p.author_user_id,
  created_at:          p.created_at,
  common_tag_count:    intersect(myTags, p.worldview_tags).length,  // ★ ここで tags を消費
  // ↑ p.worldview_tags はこの map の外に出さない(構造的に省略)
}));

const items = scored
  .filter((s) => s.common_tag_count > 0)
  .sort(...) 
  .slice(0, limit);

return NextResponse.json({ ok: true, items });
// worldview_tags はレスポンスに乗らない(scored の prop に含めていない)
```

---

## 10. スコープ外(M4 でやらないこと)

```
- いいね / フォロー / メッセージ等のソーシャル機能
  → M4 以降(まず「出会える」を成立させてから関係性を作る)
- マッチ結果のキャッシュ / 事前計算 / マテリアライズドビュー
  → 公開行が数千件規模までは毎回計算で十分。M4 完了後に必要性を見て判断
- worldview_profiles 側の GIN 式インデックス
  → 母数小のため不要(セクション 4 で議論)
- 検証データ(5 ペルソナ + 10 投稿)の teardown
  → M4-5 実機確認完了後・台帳 docs/M4_test_data_ledger.md の手順で
- マッチ理由の自然文化(Claude が「あなたの dark と相手の gothic が
  響き合う」のように説明する機能)
  → M5 / 将来。MVP は数値表現のみ
- 「世界観タグ ×タグ」軸のマッチ(タグ同士の概念類似度を学習)
  → 母数が極小のうちは早すぎる
```

---

## 11. M3 由来パターンの踏襲(明記)

M4 は以下の M3 由来パターンを完全踏襲する:

| パターン | M3 出典 | M4 で使う場所 |
|---|---|---|
| 二重防御(`.eq + RLS`)| M3-1 RLS / M3-2 投稿作成 | M4-2 / M4-3 候補取得 |
| SELECT 句フィールド絞り | M3-4 /u/ /p/ | M4-2 / M4-3 レスポンス組み立て |
| fallback HTTP 200 | M3-4 /p/ /u/ | M4-2 / M4-3 reason: で空返却 |
| anon client 使用 | M3-4 | M4-2 / M4-3 全体 |
| 自己除外(`.neq`)| M3-5 削除 API | M4-2 / M4-3 候補取得 |
| 楽観的更新なし | M2-4 / M3-3 / M3-5 | M4-4 UI(該当箇所なしだが思想踏襲)|
| service_role 不使用 | M3 全体 | M4 全体 |
| 確認モーダル | M2-4 / M3-5 | M4 はミューテーションなしのため不要 |
| 既存タブ無変更で追加 | M3-5 /self タブ追加 | M4-4 /discover タブ追加 |

---

## 12. オーナー実機確認の要点(M2/M3 教訓)

```
M4-1 後: posts_worldview_tags_gin_idx が Supabase Studio で見える
M4-2 後: GET /api/match/posts を curl/Network で叩き、
         items に worldview_tags が無いこと・自分が出ないこと
M4-3 後: GET /api/match/users 同上
M4-4 後:🔴 ブラウザの View Source / Network で worldview_tags
         英語スラッグが見えないこと(M2-3 と同じ点検)
M4-5 後: 検証 5 ペルソナで期待順序(Dark Adjacent→...→Edge / Soft 非表示)
         が出ること。自分が出ないこと。診断未完了 UI が出ること
```

---

## 13. M4 実装で得た知見(2026-05-18 確定)

> 次の実装者が同じ落とし穴を踏まないための「次に活きる教訓」記録。
> M3 セクション 11(認証アカウント確定事実)と同型の知見蓄積層。

### 知見1: `public.users` の RLS と `worldview_profiles.is_public` は完全独立

```
事象: M4-2 実装初版で .from("users").select("display_name").in("id", authorIds)
      を anon/認証 client で叩いたところ、全件 null になった。

真因: public.users の RLS ポリシー "users can read own profile" は
      auth.uid() = id を要求し、他人の行は構造的に SELECT 結果から
      消える(エラーにならず空配列で返る)。
      [001:16-18] で定義され、後の migration でも一切緩めていない。

誤認: worldview_profiles.is_public=true にすれば「公開ユーザー」として
      他テーブルでも他人読み取りが開く、と暗黙に期待していたが、
      RLS はテーブルごとに完全独立。public_users view は M2-1 で
      意図的に SECURITY DEFINER + INNER JOIN で「is_public=true ユーザーの
      id+display_name」を露出する別経路として作られたもの。

正解: 他人の display_name を読みたい場合は必ず public_users view 経由。
      M4-2 / M4-3 / 将来の他テーブル join も同じ作法。
```

### 知見2: 「コードが正しく動いていそう」と「実機で正しい結果」は別

```
M4-2 初版は順位・overlap 計算・自己除外・プライバシー(worldview_tags
非露出)が全て完璧に動作したが、display_name だけが null だった。
コード単体テストでは「PostgREST が他人行を返さない」挙動は再現せず、
実機(=本物の RLS が効く環境)でしか発覚しない。

教訓: API ルートのレスポンスは「全フィールドに値が入っているか」を
      実機で必ず点検すること。null 容認フィールドが期待値以外の
      理由で null になっていないか、検証データの実値と突き合わせる。
```

### 知見3: M3-5 教訓「推測で直さず真因を確定する」が再び効いた

```
今回も「display_name が null だから推測で SELECT カラムを変えよう」
等の対症療法を行わず、まず RLS 仕様を確認することで設計レベルの
真因(view 経由が正しい経路)を一発で特定できた。
M3-5 の 6bd309dd 教訓と同じ作法が引き続き有効。
```

---

## 14. このドキュメントの位置づけ

```
docs/STYLE-SELF_ビジョン統合マップ.md(最上位)
  ├ STYLE-SELF_診断システム_再設計.md(①知る 思想)
  ├ STYLE-SELF_フェーズB_実装設計.md(①知る 実装・完了)
  ├ STYLE-SELF_M2_実装設計.md(③繋がる 土台・完了)
  ├ STYLE-SELF_M3_実装設計.md(③繋がる 基盤・完了)
  ├ STYLE-SELF_M4_実装設計.md(このファイル・③繋がる **本体**)
  └ M4_test_data_ledger.md(M4 検証用シードデータ台帳)

M2 / M3 と同じ「調査→設計→ステップ実装」の型。
M4 も 5 ステップ(M4-1〜M4-5)で進める。
```
