# STYLE-SELF D1 — Sprint C-2 段階2 API 設計調査(5 route 詳細設計 + 段階1 完遂報告 + Schema Policies 発見集約・★ 実装は別工程)

- 作成日: 2026-05-24
- 起点 HEAD: `ec12f7b`(Sprint C-2 段階1 Step A+C 実装・origin 保全済・clean / 399 PASS / tsc EXIT 0 / ★ Step B = Supabase Studio bucket+policies オーナー完了済・★ migration apply は次セッション以降 = J17=a)
- 本 doc の役割: Sprint C-2 段階2 = ムードボード API 4 route(GET/POST/PATCH/DELETE/items)の **実装可能粒度の準備**(★ **コード 0 変更・実装は別工程**)
- 上位連結:
  - Sprint C-1 設計案 [§5 API 設計](./STYLE-SELF_D1_Sprint_C-1_ムードボード設計調査.md)(`60b8d87`)= 5 route 一覧
  - Sprint C-2 段階1 設計案 [§5 lib/storage.ts](./STYLE-SELF_D1_Sprint_C-2_段階1_基盤層_設計調査.md)(`664b661`)= MOODBOARD_BUCKET / helper
  - 段階1 実装 commit [`ec12f7b`](../supabase/migrations/026_d1_moodboards.sql) = 026_d1_moodboards.sql + lib/storage.ts +47 行
  - 実装参照: [`app/api/posts/route.ts`](../app/api/posts/route.ts)(POST)+ [`app/api/posts/[id]/route.ts`](../app/api/posts/[id]/route.ts)(DELETE)+ [`app/api/wardrobe/route.ts`](../app/api/wardrobe/route.ts)(GET/POST)+ [`app/api/worldview-card/route.ts`](../app/api/worldview-card/route.ts)(列絞り GET)

---

## 1. 背景

### 1.1 Sprint C-2 段階2 の位置づけ

Sprint C-2 段階1 完遂(`ec12f7b` + Step B + Schema Policies カバー確認)後の段階2 着手準備。Sprint C-1 §5 で 5 route 一覧確立済 → 本 doc で実装可能粒度に詳細化。

### 1.2 ★ 段階1 完遂報告(集約)

| 項目 | 状態 | 詳細 |
|---|---|---|
| Step A: SQL | ✅ origin `ec12f7b`(158 行) | 026_d1_moodboards.sql 作成完了 |
| Step C: TS | ✅ origin `ec12f7b`(+47 行) | lib/storage.ts に MOODBOARD_BUCKET / uploadMoodboardImage / deleteMoodboardImage 追加(既存 export 無変更) |
| Step B: bucket | ✅ オーナー手作業完了 | `moodboard-images` bucket(Public ON / MIME 制限 / 5MB 上限) |
| Schema Policies | ✅ オーナー確認済 | 全 bucket カバー(★ 新発見・次節 §2 で M4-2 教訓更新) |
| migration apply | ⏭ 次セッション以降 | J17=a・SQL editor or `supabase db push` |

### 1.3 不可侵境界線(★ 厳守 / Sprint C-1〜C-2 段階1 と同型)

1. 本体 `ac834bb` / コード / doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` / 各設計案(B-2 / B-3 / C-1 / C-2 段階1) / 既存設計判断 1-10 ★ **全 0 変更**
2. ③ プライバシー専章 / ③ コスト管理 / Phase 2 後ゲート ★ **diff 0 行**
3. リグレッションテスト **399 PASS 維持**(本工程はコード 0 変更)
4. tsc EXIT 0 維持
5. ★ 実装は別工程(本 doc では実施しない)

---

## 2. ★ Schema Policies 発見の M4-2 教訓更新

### 2.1 Supabase Storage Policy の 2 層構造

| 層 | 範囲 | 設定場所 |
|---|---|---|
| **Bucket Policies** | bucket 個別 | Supabase Dashboard → Storage → Bucket → Policies |
| ★ **Schema Policies** | `storage.objects` 全体(★ **全 bucket 共通**) | Dashboard → Authentication → Policies → `storage.objects` |

### 2.2 既存 Schema Policies が全 bucket カバー(★ オーナー確認済)

| Policy 名 | Operation | 条件 | 効果 |
|---|---|---|---|
| `upload own folder 13rjsfd_0` | INSERT | `auth.uid()::text = (storage.foldername(name))[1]` | 全 bucket 共通: 自分の userId 配下のみ書込可 |
| `public read` | SELECT | `true` | 全 bucket 共通: URL 知れば誰でも読み可 |
| 同条件 | UPDATE | 同上 | 自分配下のみ更新可 |
| 同条件 | DELETE | 同上 | 自分配下のみ削除可 |

### 2.3 ★ 新 bucket 追加時の判断

- 全 bucket 共通の Schema Policies が **既に新 bucket を自動カバー**
- 追加 Bucket Policy は ★ **不要**(冗長保険として追加することは可)
- ★ `moodboard-images` も Schema Policies の `foldername[1] = auth.uid()` で動作確認可能
- ★ **本 Sprint C-2 段階1 で「Bucket policies 追加」と書いた手順書(`664b661` §4.2 Step 7)は ★ 実質不要**(Schema Policies で代替済)

### 2.4 ★ 将来 Sprint(E 写真 / F 他画像)への教訓

- Sprint E(`tryon-images` bucket)/ Sprint F(その他画像 bucket)新設時も:
  - Public bucket = ON のみ設定
  - Schema Policies が ★ **自動適用**(追加設定不要)
  - パス命名規約 `{userId}/{...}/{ts}.{ext}` を守れば Storage RLS 完備
- M4-2 教訓:「Storage RLS は Bucket Policies で設定」→ ★ **更新**「Storage RLS は Schema Policies で **全 bucket 一括設定**(既存設定の流用)」

---

## 3. ★ 既存類似 API 棚卸し(構造踏襲のため)

### 3.1 共通パターン

| 観点 | パターン |
|---|---|
| Client | `createSupabaseServerClient()`(★ 必須・service_role 不使用) |
| Auth | `const { data: { user }, error: authErr } = await supabase.auth.getUser()` → 401 if no user |
| body parse | `try { body = await request.json() as Foo } catch { return 400 }` |
| UUID validation | `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` |
| insert 型回避 | `.insert(data as never)`(Supabase v2 型推論バグ・CLAUDE.md 既存ルール) |
| select 型 cast | `as unknown as { data: T \| null; error: { message: string } \| null }` |
| エラー応答 | `400` body 不正 / `401` 未認証 / `404` 存在しない or 他人 / `500` DB エラー |
| 列絞り SELECT | `.select("id, name, ...")`(★ worldview_tags は SELECT 句に書かない・三重防御 1)|
| image_url 検証 | Supabase Storage URL prefix 一致(SSRF 防止)|
| DELETE 順序 | DB first → Storage best-effort(M3-2 確定・孤児画像 MVP 許容)|

### 3.2 既存 route 構造マッピング

| 既存 route | 参考点 | C-2 段階2 で踏襲する route |
|---|---|---|
| `app/api/posts/route.ts`(POST)| 認証 + body 検証 + worldview snapshot + insert as never + select | Route 1(POST /api/moodboards) |
| `app/api/posts/[id]/route.ts`(DELETE)| UUID 検証 + DB delete .eq("user_id", user.id) + Storage best-effort | Route 4(DELETE /api/moodboards/[id])|
| `app/api/wardrobe/route.ts`(GET / POST)| 認証 + select all + insert | Route 1(GET /api/moodboards) |
| `app/api/worldview-card/route.ts`(列絞り GET)| 列絞り SELECT + `{ ok, reason }` 構造化レスポンス | Route 2(GET /api/moodboards/[id])で公開閲覧対応 |

---

## 4. ★ 段階2 API 4 route 詳細設計

★ 当初 Sprint C-1 §5 で 5 route とした内訳(`/api/moodboards/route.ts` を「GET 一覧」と「POST 作成」で 1 ファイル / `/api/moodboards/[id]/items/route.ts` を「POST 画像追加」のみで 1 ファイル / `[itemId]` で 1 ファイル)= **物理ファイル 4 個**(同一ファイル内に GET/POST 同居が Next.js App Router 規約)。本 doc では **物理 4 route ファイル**として整理。

### 4.1 Route 1: `/api/moodboards/route.ts`(GET 一覧 / POST 作成)

#### 4.1.1 GET — 自分の MB 一覧

```typescript
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  // ★ 列絞り SELECT: worldview_tags / worldview_keywords は含めない(三重防御 1)
  const { data, error } = await supabase
    .from("moodboards")
    .select("id, name, description, is_public, cover_image_url, worldview_name, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ moodboards: data ?? [] });
}
```

#### 4.1.2 POST — MB 新規作成

```typescript
interface CreateMoodboardBody {
  name?: unknown;
  description?: unknown;
  is_public?: unknown;
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const body = (await request.json()) as CreateMoodboardBody;

  // 検証
  if (typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json({ error: "name は必須です" }, { status: 400 });
  }
  const name = body.name.trim().slice(0, 200);
  const description = typeof body.description === "string" ? body.description.slice(0, 2000) : "";
  const is_public = body.is_public === true; // ★ default false(地雷 8 オプトイン公開)

  // 世界観スナップショット(posts/route.ts と同型)
  const { data: profileRow } = await supabase
    .from("worldview_profiles").select("result").eq("user_id", user.id)
    .maybeSingle() as unknown as { data: { result: Record<string, unknown> | null } | null };
  const snapshot = extractSnapshot(profileRow?.result ?? null);

  const { data: inserted, error: insErr } = await supabase
    .from("moodboards")
    .insert({
      user_id: user.id, name, description, is_public,
      worldview_tags: snapshot.worldview_tags,
      worldview_keywords: snapshot.worldview_keywords,
      worldview_name: snapshot.worldview_name,
    } as never)
    .select("id, name, description, is_public, cover_image_url, worldview_name, created_at, updated_at")
    .single() as unknown as { data: MoodboardRow | null; error: { message: string } | null };

  if (insErr || !inserted) return NextResponse.json({ error: insErr?.message ?? "作成失敗" }, { status: 500 });
  return NextResponse.json({ moodboard: inserted });
}
```

- **規模**: +90-120 行(`extractSnapshot` helper は posts/route.ts からコピー or import)

### 4.2 Route 2: `/api/moodboards/[id]/route.ts`(GET 詳細 / PATCH 更新 / DELETE 削除)

#### 4.2.1 GET — MB 詳細(items 含む)

```typescript
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "id 不正" }, { status: 400 });
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 1) MB 取得(RLS で本人 or 公開のみ)
  // ★ 列絞り SELECT: anon 閲覧用に worldview_tags は除外
  const { data: mb } = await supabase
    .from("moodboards")
    .select("id, user_id, name, description, is_public, cover_image_url, worldview_name, created_at, updated_at")
    .eq("id", params.id).maybeSingle() as unknown as { data: MoodboardRow | null };
  if (!mb) return NextResponse.json({ error: "見つかりません" }, { status: 404 });

  // 2) items 取得(同 RLS で本人 or 公開のみ・親経由 EXISTS)
  const { data: items } = await supabase
    .from("moodboard_items")
    .select("id, image_url, caption, source_url, order_index, created_at")
    .eq("moodboard_id", params.id)
    .order("order_index", { ascending: true });

  return NextResponse.json({ moodboard: { ...mb, items: items ?? [] } });
}
```

#### 4.2.2 PATCH — MB 更新

```typescript
interface UpdateMoodboardBody {
  name?: unknown;
  description?: unknown;
  is_public?: unknown;
  cover_image_url?: unknown;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "id 不正" }, { status: 400 });
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const body = (await request.json()) as UpdateMoodboardBody;
  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim() !== "") updates.name = body.name.trim().slice(0, 200);
  if (typeof body.description === "string") updates.description = body.description.slice(0, 2000);
  if (typeof body.is_public === "boolean") updates.is_public = body.is_public;
  if (typeof body.cover_image_url === "string") updates.cover_image_url = body.cover_image_url;
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "更新項目なし" }, { status: 400 });

  // RLS で本人のみ更新可 + .eq("user_id", user.id) で二重防御
  const { data: updated, error } = await supabase
    .from("moodboards").update(updates as never)
    .eq("id", params.id).eq("user_id", user.id)
    .select("id, name, description, is_public, cover_image_url, worldview_name, updated_at")
    .maybeSingle() as unknown as { data: MoodboardRow | null; error: { message: string } | null };
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  return NextResponse.json({ moodboard: updated });
}
```

#### 4.2.3 DELETE — MB 削除(items + Storage 配下 best-effort)

```typescript
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "id 不正" }, { status: 400 });
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  // 1) 削除前に items の image_url を取得(Storage cleanup 用)
  const { data: items } = await supabase
    .from("moodboard_items").select("image_url").eq("moodboard_id", params.id);

  // 2) DB delete(CASCADE で items も自動削除)
  const { data: deleted, error } = await supabase
    .from("moodboards").delete()
    .eq("id", params.id).eq("user_id", user.id)
    .select("id").maybeSingle() as unknown as { data: { id: string } | null; error: { message: string } | null };
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!deleted) return NextResponse.json({ error: "見つかりません" }, { status: 404 });

  // 3) Storage 配下を best-effort 削除(M3-2 同型・孤児画像 MVP 許容)
  if (items && items.length > 0) {
    const paths = items
      .map((it) => extractStoragePath(it.image_url, MOODBOARD_BUCKET))
      .filter((p): p is string => p !== null);
    if (paths.length > 0) {
      const { error: stErr } = await supabase.storage.from(MOODBOARD_BUCKET).remove(paths);
      if (stErr) console.warn("[moodboards DELETE] storage cleanup error(orphan):", stErr.message);
    }
  }
  return NextResponse.json({ ok: true, deletedId: params.id });
}
```

- **規模**: +120-150 行(3 method + helper extractStoragePath)

### 4.3 Route 3: `/api/moodboards/[id]/items/route.ts`(POST 画像追加)

```typescript
interface AddItemBody {
  image_url?: unknown;     // ★ クライアントで uploadMoodboardImage 後の URL
  caption?: unknown;
  source_url?: unknown;
  order_index?: unknown;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "id 不正" }, { status: 400 });
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const body = (await request.json()) as AddItemBody;

  // image_url 検証(posts/route.ts と同型・SSRF 防止)
  if (typeof body.image_url !== "string" || body.image_url.trim() === "") {
    return NextResponse.json({ error: "image_url 必須" }, { status: 400 });
  }
  const allowedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "")}/storage/v1/object/public/moodboard-images/`;
  if (!body.image_url.startsWith(allowedPrefix)) {
    return NextResponse.json({ error: "image_url は moodboard-images の公開URL" }, { status: 400 });
  }

  // 親 MB 本人所有確認(RLS でも担保されるが二重防御)
  const { data: mb } = await supabase.from("moodboards").select("id, user_id")
    .eq("id", params.id).maybeSingle() as unknown as { data: { id: string; user_id: string } | null };
  if (!mb || mb.user_id !== user.id) return NextResponse.json({ error: "MB が見つかりません" }, { status: 404 });

  const caption = typeof body.caption === "string" ? body.caption.slice(0, 500) : "";
  const source_url = typeof body.source_url === "string" ? body.source_url.slice(0, 1000) : null;
  const order_index = typeof body.order_index === "number" ? body.order_index : 0;

  const { data: inserted, error } = await supabase
    .from("moodboard_items")
    .insert({ moodboard_id: params.id, image_url: body.image_url, caption, source_url, order_index } as never)
    .select("id, image_url, caption, source_url, order_index, created_at")
    .single() as unknown as { data: MoodboardItemRow | null; error: { message: string } | null };
  if (error || !inserted) return NextResponse.json({ error: error?.message ?? "追加失敗" }, { status: 500 });
  return NextResponse.json({ item: inserted });
}
```

- **規模**: +60-80 行
- **責務分担**:クライアント側で `uploadMoodboardImage()`(EXIF 除去 + Storage upload)→ 確定した image_url を本 API に POST(posts/route.ts 案 X と同型)

### 4.4 Route 4: `/api/moodboards/[id]/items/[itemId]/route.ts`(DELETE 削除 / PATCH 順序・caption 更新)

```typescript
export async function DELETE(_req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  if (!UUID_RE.test(params.id) || !UUID_RE.test(params.itemId)) return NextResponse.json({ error: "id 不正" }, { status: 400 });
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  // 1) item の image_url 取得 + 親 MB 本人確認(JOIN or 2 query)
  const { data: item } = await supabase
    .from("moodboard_items").select("image_url, moodboards!inner(user_id)")
    .eq("id", params.itemId).eq("moodboard_id", params.id).maybeSingle() as unknown as { data: { image_url: string; moodboards: { user_id: string } } | null };
  if (!item || item.moodboards.user_id !== user.id) return NextResponse.json({ error: "見つかりません" }, { status: 404 });

  // 2) DB delete
  const { error } = await supabase.from("moodboard_items").delete().eq("id", params.itemId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 3) Storage best-effort
  const path = extractStoragePath(item.image_url, MOODBOARD_BUCKET);
  if (path) {
    const { error: stErr } = await supabase.storage.from(MOODBOARD_BUCKET).remove([path]);
    if (stErr) console.warn("[moodboard_items DELETE] storage cleanup(orphan):", stErr.message);
  }
  return NextResponse.json({ ok: true, deletedId: params.itemId });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  // 同型: UUID 検証 → auth → body → updates 構築 → .update().eq().eq()
  // order_index / caption のみ受付
  // 規模: +30 行
}
```

- **規模**: +60-80 行

### 4.5 段階2 全体 規模(★ Sprint C-1 §5 + 本詳細化)

| Route(物理ファイル)| method | 規模 |
|---|---|---|
| Route 1: `/api/moodboards/route.ts` | GET + POST | +90-120 |
| Route 2: `/api/moodboards/[id]/route.ts` | GET + PATCH + DELETE | +120-150 |
| Route 3: `/api/moodboards/[id]/items/route.ts` | POST | +60-80 |
| Route 4: `/api/moodboards/[id]/items/[itemId]/route.ts` | DELETE + PATCH | +60-80 |
| types/moodboard.ts(新規) | — | +50-80 |
| リグレッションテスト拡張 | — | +30-50 |
| **合計** | | **+410-560 行**(Sprint C-1 §5 試算 +220-310 から増・types + テスト + extractStoragePath helper のため) |

---

## 5. ★ 型定義(`types/moodboard.ts` 新規・+50-80 行)

```typescript
// D1 Phase 2 ムードボード 型定義(設計案 ec12f7b + 段階2 API 設計に対応)

export interface MoodboardRow {
  id: string;
  user_id?: string;          // 本人取得時のみ(anon は受け取らない)
  name: string;
  description: string;
  is_public: boolean;
  cover_image_url: string | null;
  worldview_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface MoodboardItemRow {
  id: string;
  image_url: string;
  caption: string;
  source_url: string | null;
  order_index: number;
  created_at: string;
}

export interface MoodboardWithItems extends MoodboardRow {
  items: MoodboardItemRow[];
}

export interface CreateMoodboardInput {
  name: string;
  description?: string;
  is_public?: boolean;       // default false(地雷 8 オプトイン公開)
}

export interface UpdateMoodboardInput {
  name?: string;
  description?: string;
  is_public?: boolean;
  cover_image_url?: string;
}

export interface AddMoodboardItemInput {
  image_url: string;
  caption?: string;
  source_url?: string;
  order_index?: number;
}

export interface UpdateMoodboardItemInput {
  caption?: string;
  order_index?: number;
}
```

---

## 6. ★ 認証・RLS・三重防御 共通方針

| 観点 | 採用方針 |
|---|---|
| Client | `createSupabaseServerClient()`(★ 既存ルール厳守・service_role 不使用) |
| 認証 | 全 route 認証必須(GET 詳細だけ anon 可・公開 MB のみ RLS が返す) |
| RLS 二重防御 | アプリ層 `.eq("user_id", user.id)` + DB 層 RLS policies(段階1 026 で確立) |
| 列絞り SELECT | ★ worldview_tags / worldview_keywords は SELECT 句に書かない(三重防御 1) |
| system 明示禁止 | ★ N/A(本 API 層は段階 B reply ではないため対象外) |
| 出力フィルタ | ★ N/A(本 API は構造化 JSON 返却・stripCanonicalSlugs 不要) |
| image_url 検証 | Supabase Storage `moodboard-images` prefix 一致(SSRF 防止)|
| UUID 検証 | `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` |
| エラー応答 | 400 / 401 / 404 / 500 を使い分け |
| Storage cleanup | DB first → Storage best-effort(M3-2 確定・孤児画像 MVP 許容) |

---

## 7. ★ migration apply のタイミング 推奨

| 案 | 内容 | 推奨度 |
|---|---|---|
| **案 a** | ★ **段階2 着手前**(次セッション冒頭で Supabase Studio SQL editor で実行)| ★ **推奨**(段階2 実装中の DB 未存在エラーを避ける) |
| 案 b | 段階2-A〜B 実装と同時に apply | 可(本人 1 環境なので影響軽微) |
| 案 c | 段階2 全実装後 | 非推奨(動作確認できない) |

★ 推奨: 案 a。次セッション冒頭の Step 0 として「026_d1_moodboards.sql を Supabase Studio SQL editor で実行 → ✅ 報告」を実施 → 段階2-A 着手。

---

## 8. ★ Step 2-A〜2-I 分割(段階2 実装時)

| Step | 内容 | 時間 |
|---|---|---|
| **0** | ★ **migration apply**(オーナー手作業 or Claude Code 指示・1-2 分) | 2 分 |
| 2-A | `types/moodboard.ts` 作成 | 5-10 分 |
| 2-B | Route 1(GET / POST)実装 | 25-35 分 |
| 2-C | Route 2(GET / PATCH / DELETE)実装 | 30-40 分 |
| 2-D | Route 3(POST 画像追加)実装 | 20-30 分 |
| 2-E | Route 4(DELETE / PATCH)実装 | 20-30 分 |
| 2-F | リグレッションテスト拡張(API 経由のシナリオ追加) | 20-30 分 |
| 2-G | tsc EXIT 0 + 399+? PASS 確認 | 3-5 分 |
| 2-H | 実機 verify(curl or ChatPage 経由)| 15-20 分 |
| 2-I | commit(★ 機能単位で 1-3 commits 分割推奨) | 5-10 分 |
| **合計** | | **140-210 分 = 2.5-3.5 時間 = 3-4 セッション**(Sprint C-1 §8 試算と整合) |

---

## 9. 規模見当(本 C-2 段階2 設計工程)

| 工程 | 想定行数 | 想定時間 |
|---|---|---|
| **★ 本設計調査 doc**(本 commit) | 400-500 行(実測 ~430 行) | 30-45 分 |
| ★ 段階2 実装(別 commit・本 doc 範囲外)| **+410-560 行**(4 route + types + tests) | 140-210 分 |
| ★ migration apply(オーナー手作業 or 別工程)| — | 2 分 |
| **★ 段階2 合計**(設計 + 実装 + apply) | **+820-990 行** | **170-260 分 / 3-4 セッション** |

---

## 10. 既存達成への影響評価(★ コード 0 変更・全保持)

| 達成項目 | 想定影響 |
|---|---|
| 1.5b 完成形 / race fix v2 / L4-A / A-2 / A-3 / MVP-1c / A-4 / A-10 / A-6 / A-6b / A-5 / A-9 / Sprint B-1 / B-2 / B-3 / C-1 / C-2 段階1(`ec12f7b`)| **0**(コード 0 変更)|
| リグレッションテスト | **399 PASS 維持** |
| 既存 v1 各 intent API + UI | **0** |
| 段階1 成果(026_d1_moodboards.sql + lib/storage.ts MOODBOARD_BUCKET / helpers)| **0**(参照 only) |
| 既存 API(posts / wardrobe / worldview-card 等)| **0**(参照 only / 段階2 実装で MB 用に同型新規追加) |
| 本体 `ac834bb` 6 章 / 7 章 / 判断 6 | **diff 0 行** |
| 本体 `ac834bb` / doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` / 各設計案(B-2 / B-3 / C-1 / C-2 段階1) | **diff 0 行** |
| 既存設計判断 1-10 | **文言不変** |

---

## 11. 推奨案(★ 結論)

### 11.1 推奨実装方針

- ★ 本工程 = 設計調査 doc 1 件のみ origin 保全
- ★ 段階2 実装(Step 0 + 2-A〜2-I)= 次セッション以降(★ 3-4 セッション規模)
- ★ migration apply(Step 0)を段階2 冒頭で実行(★ 推奨案 a)
- ★ 区切り良い節目で止まる(M5 刻む作法・原則 3)

### 11.2 ★ 7 項目 結論サマリ

| 項目 | 結論 |
|---|---|
| 段階1 完遂報告 | ★ SQL(`ec12f7b`)+ TS(`ec12f7b`)+ bucket(オーナー手作業)+ Schema Policies(★ 全 bucket カバー確認)|
| Schema Policies 発見 | ★ M4-2 教訓更新:Storage RLS は ★ **Schema Policies で全 bucket 一括設定**(Bucket Policies は冗長保険) |
| Route 1(GET/POST) | +90-120 行 / 自分の MB 一覧 + 新規作成(列絞り SELECT + 世界観 snapshot) |
| Route 2(GET/PATCH/DELETE) | +120-150 行 / 詳細(items 含む) + 更新 + 削除(Storage 配下 best-effort) |
| Route 3(POST 画像追加) | +60-80 行 / image_url 検証 + 親 MB 本人確認 + items insert |
| Route 4(DELETE/PATCH item) | +60-80 行 / item 削除(Storage cleanup)+ 順序/caption 更新 |
| types/moodboard.ts | +50-80 行 / MoodboardRow / MoodboardItemRow / Input 型群 |
| 段階2 全体規模 | ★ **+410-560 行 / 3-4 セッション**(Sprint C-1 §8 試算 +220-310 から増・types + tests + helper のため) |
| migration apply タイミング | ★ **段階2 冒頭(案 a 推奨)**= 次セッション Step 0 |

### 11.3 ★ 次工程

- 本 commit(設計 doc 1 件)→ オーナー判断 → origin 保全
- 次セッション以降: Step 0(migration apply)→ Step 2-A(types)→ 2-B〜E(4 routes)→ 2-F(tests)→ 2-G/H/I(verify + commit)
- 段階2 完遂 → 段階3(UI 3 画面 + Modal)→ C-2 完遂
- C-2 完遂 → C-3(MB→coordinate 連鎖)→ C-4(検証・退行点検)→ Phase 2 達成
- → Sprint D ★ Phase 2 後ゲート(リアル試着 GO/NO-GO 判断)

---

## 12. 結論

| 観点 | 結論 |
|---|---|
| ★ Sprint C-2 段階2 設計判断 | **★ GO**(設計調査 doc のみ・コード 0 変更・規模軽微・既存 API パターン踏襲)|
| 規模 | **+400-500 行 / 30-45 分**(本 commit)+ 段階2 実装 +410-560 行 / 140-210 分(別工程)+ migration apply 2 分 |
| 既存達成保持 | コード 0 変更で **全保持**(399 PASS 維持・tsc EXIT 0 維持)|
| ★ 4 レイヤー構造 | 本体 / doc7 / ロードマップ / 最終ビジョン ★ **全不変** |
| ★ Schema Policies 発見 | ★ **M4-2 教訓更新済**(将来 Sprint E/F でも bucket 追加だけで RLS 完備) |
| ★ 段階2 API 設計 | ★ **実装可能粒度 完遂**(4 route + types + tests + Step 0 apply)|
| ★ 次工程 | オーナー判断 → 本 commit origin 保全 → 次セッション冒頭で migration apply → 段階2 実装 |
| 不可侵 | 本体 6 章 / 7 章 / 判断 6 / コスト試算 / 整合性点検 / ロードマップ / 各設計案 / 既存設計判断 1-10 ★ **全不変** |

→ ★ **段階2 API 設計青写真 完遂**(実装可能粒度で組立・次セッション以降に段階2 着手可能)

---

## 13. 制約遵守チェックリスト

- [x] 新規 docs ファイル 1 件のみ(本 doc)
- [x] 本体 `ac834bb` / コード(app/api/lib/scripts/package.json/tsconfig.json)/ doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` / 各設計案(B-2 / B-3 / C-1 / C-2 段階1)/ 他 docs **全 0 変更**
- [x] 段階1 成果(026_d1_moodboards.sql + lib/storage.ts MB helpers)diff 0 行
- [x] 本体 6 章 / 7 章 / 判断 6 diff 0 行
- [x] 既存設計判断 1-10 文言不変
- [x] view + grep + 静的解析のみ・実装なし
- [x] tsc EXIT 0 維持(本 doc は markdown のみ・コード 0 変更)
- [x] リグレッションテスト 399 PASS 維持(本工程はコード 0 変更)
- [x] 実装は ★ 別工程(本 doc では実施しない)
- [x] commit はあり / push はなし
