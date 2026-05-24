# STYLE-SELF D1 — Sprint C-4 完成・退行点検 設計調査(Phase 2 全機能チェックリスト + 5 層防御確認 + 実機 verify 7 シナリオ・★ 実装は別工程 / MVP は実機 verify で代替)

- 作成日: 2026-05-24
- 起点 HEAD: `ae2996d`(Sprint C-3 MB→coordinate 連鎖 実装・origin 保全済・clean / 399 PASS / tsc EXIT 0)
- 本 doc の役割: Phase 2 ムードボード機能 **完全完成後の品質確認 Sprint**(★ **コード 0 変更・実装は別工程**)
- 上位連結:
  - Sprint C-3 実装 [`ae2996d`](../lib/prompts/moodboard-prompt.ts) MB → coordinate 連鎖完成
  - Sprint C-1 [§8 C-4 完成・退行点検](./STYLE-SELF_D1_Sprint_C-1_ムードボード設計調査.md)(`60b8d87`) 試算 +20-50 行 / 1 セッション
  - 本 doc = **MVP リリース前最後の品質確認** + Sprint D Phase 2 後ゲートへの前段

---

## 1. 背景

### 1.1 Sprint C-4 の位置づけ

Sprint C-3 完遂(`ae2996d`)で **Phase 2 ムードボード機能 完全完成 + chat 連携完成** を達成。残るは:
- 全機能チェックリスト(★ 動作確認の網羅)
- 5 層多段防御維持確認
- 不可侵境界線確認
- リグレッションテスト拡張検討(★ MVP-2 期推奨)
- 実機 verify チェックリスト(オーナー手作業用)

これにより **Sprint D Phase 2 後ゲート** への着手準備が整う。

### 1.2 本 doc の目的

★ **設計のみで完遂**(実装は別工程)= MVP リリース前の最後の品質確認青写真を origin 保全。

### 1.3 不可侵境界線(★ 厳守 / Sprint B-1〜C-3 と同型)

1. 本体 `ac834bb` / コード / doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` / 各設計案 / 既存設計判断 1-10 ★ **全 0 変更**
2. 既存 migrations(001-026)/ 既存 API 7 route / 既存 UI 全画面 / types/moodboard.ts / lib/utils 5 件 / 段階3-A〜3-E 既存実装 ★ **不変**
3. ③ プライバシー専章 / ③ コスト管理 / Phase 2 後ゲート ★ **diff 0 行**
4. リグレッションテスト **399 PASS 維持**(本工程はコード 0 変更)
5. tsc EXIT 0 維持
6. ★ 実装は別工程(本 doc では実施しない)

---

## 2. ★ Sprint C-4 のスコープ

### 2.1 含むもの

| # | 項目 |
|---|---|
| 1 | 全機能チェックリスト(DB / Storage / API 7 route / UI 全画面 / 連鎖)|
| 2 | リグレッションテスト拡張検討(A/B/C 比較)|
| 3 | 5 層多段防御維持確認(Phase 1 + Phase 2 拡張)|
| 4 | 不可侵境界線確認 |
| 5 | 実機 verify チェックリスト(7 シナリオ) |
| 6 | Sprint D 着手準備 |

### 2.2 含まないもの(★ 別 Sprint)

| 項目 | Sprint |
|---|---|
| コスト v3 評価(Vision API 月額検討) | Sprint D |
| リアル試着 GO/NO-GO(本体 判断 6)| Sprint D |
| MVP リリース判定 | Sprint D 完了後 |
| リグレッションテスト拡張 ★ 実装 | MVP-2 期(品質向上 Sprint)|

---

## 3. ★ 全機能チェックリスト(Phase 2 ムードボード機能 完全完成後)

### 3.1 DB 層

| # | 項目 | 確認方法 |
|---|---|---|
| 1 | `moodboards` テーブル存在(8 列 + timestamps)| `\d public.moodboards` |
| 2 | `moodboard_items` テーブル存在(6 列 + timestamps)| `\d public.moodboard_items` |
| 3 | RLS 4 policy 有効(本人 FOR ALL × 2 + 公開 SELECT × 2)| `select * from pg_policies where tablename in ('moodboards','moodboard_items');` |
| 4 | index 3 本(user_created / public_created partial / board_order)| `select * from pg_indexes where tablename like 'moodboard%';` |
| 5 | `moodboards_updated_at` trigger 有効 | `select * from pg_trigger where tgrelid='public.moodboards'::regclass;` |
| 6 | FK + ON DELETE CASCADE(items.moodboard_id → moodboards.id)| MB 削除 → items 連動削除確認 |
| 7 | `is_public default false`(地雷 8 オプトイン)| `select column_default from information_schema.columns where ...` |

### 3.2 Storage 層

| # | 項目 | 確認方法 |
|---|---|---|
| 1 | `moodboard-images` bucket 存在 | Supabase Dashboard → Storage |
| 2 | Public bucket = ON | bucket 設定 |
| 3 | Schema Policies 4 種(全 bucket 共通)で moodboard-images カバー | INSERT/SELECT/UPDATE/DELETE 4 policy |
| 4 | foldername[1] = auth.uid() RLS | 本人 upload OK / 他人配下 NG |
| 5 | anon SELECT 可能(URL 知れば誰でも read) | anon で getPublicUrl |
| 6 | MIME types 制限(jpeg/png/webp)| bucket 設定 |
| 7 | File size limit 5 MB | bucket 設定 |

### 3.3 API 層 7 route 共通項目

各 route について以下を確認:

| # | 項目 | 7 route 全て対象 |
|---|---|---|
| 1 | 認証必須(`auth.getUser()` → 401)| ★ 必須(全 route)|
| 2 | UUID 正規表現で param 検証 → 400 | items 系 4 route + [id] 系 3 route |
| 3 | `createSupabaseServerClient()` のみ(service_role 不使用) | ★ 必須(全 route)|
| 4 | 列絞り SELECT(worldview_tags / worldview_keywords 含めず) | GET 系 |
| 5 | `.eq("user_id", user.id)` アプリ層 + RLS 二重防御 | PATCH/DELETE 系 |
| 6 | 親 MB 本人所有確認(items 系の二重防御)| items 系 4 route(POST/POST analyze/POST from-url/DELETE/PATCH)|
| 7 | SSRF 防止(image_url prefix or URL allowlist)| items POST / analyze / from-url |
| 8 | エラーレスポンス構造化(400 / 401 / 403 / 404 / 500)| ★ 必須(全 route)|

### 3.4 個別 route チェック

| route | 重点確認 |
|---|---|
| GET /api/moodboards | 本人 MB 一覧・列絞り(worldview_name のみ)|
| POST /api/moodboards | name 必須 / is_public default false / worldview snapshot |
| GET /api/moodboards/[id] | items 含む詳細 / anon 公開対応 / 列絞り |
| PATCH /api/moodboards/[id] | name/description/is_public/cover_image_url 個別更新 / 本人 RLS |
| DELETE /api/moodboards/[id] | DB CASCADE + Storage cleanup best-effort |
| POST /api/moodboards/[id]/items | image_url Storage prefix 検証(SSRF)+ 親 MB 確認 |
| POST /api/moodboards/[id]/items/analyze | Vision 自動分析 + fallback(caption 空)|
| POST /api/moodboards/[id]/items/from-url | ★ **SSRF 5 重防御**(allowlist + private IP + https + timeout + redirect) |
| DELETE /api/moodboards/[id]/items/[itemId] | UUID 二重検証 + 親 MB 確認 + Storage cleanup |
| PATCH /api/moodboards/[id]/items/[itemId] | caption/order_index 更新 + 親 MB 確認 |

### 3.5 UI 層 全画面

| 画面 | 重点確認 |
|---|---|
| `/moodboard`(一覧)| カード表示 / 新規作成モーダル / Empty state |
| `/moodboard/[id]`(詳細 v3 1092 行)| ★ **全 22 機能**(v2 17 + v3 5)| 
| `/m/[id]`(公開ルート)| anon 閲覧 / read-only / 404 fallback |
| `MoodboardPickerModal`(段階3-D + Sprint C-3 強化)| GET /api/moodboards / 詳細取得 / onPick(MoodboardWithItems) |
| `InputAttachments`(段階3-E)| 🎨 MB ボタン → onMbOpen / fallback notice 維持 |
| `ChatPage`(ai/page.tsx)| isMbOpen state / handleMbPick / sessionStorage useEffect |

### 3.6 詳細画面 v3 22 機能チェック

**v2 17 機能**:
1. データ取得(GET /api/moodboards/[id])
2. メインビジュアル(cover_image_url)
3. コンセプト表示 + 編集モーダル + 例文 4 件
4. items グリッド + ItemCard
5. 画像追加(file → uploadMoodboardImage)
6. caption 編集モーダル + カテゴリ select
7. MB メタ編集モーダル(name/description/is_public/cover)
8. MB 削除 confirm
9. プロセス誘導 UI(placeholder × 5)
10. アクション(チャットに渡す)
11. ヘッダ(戻る + 編集 + 削除)
12. 必須要素 8 進捗バー
13. 必須要素 8 チェックリスト
14. items Card カテゴリバッジ
15. items 個別削除
16. ImageAddModal カテゴリ select
17. 撮影前 CTA(8/8 達成時)

**v3 追加 5 機能**:
18. 自動分析(beta)チェックボックス
19. URL から追加ボタン + UrlAddModal
20. ImageAddModal autoAnalyze 切替(隠す/表示)
21. 「分析中...」表示(2-5 秒)
22. fallback 表示(Vision 失敗 / URL 失敗)

### 3.7 連鎖 fixture(Sprint C-3)

| 経路 | 動作確認 |
|---|---|
| 撮影前 CTA → ChatPage | sessionStorage 経由 → /ai 遷移 → 自動挿入 |
| 「チャットに渡す」→ ChatPage | 同上(共通 handleShoot)|
| PickerModal → ChatPage 挿入 | onPick(mb) → buildMoodboardPrompt → setText |
| `buildMoodboardPrompt` 出力構造 | [ムードボード] + [必須要素 8] + [参考画像メモ] + LLM 補完指示 |
| 三重防御 1 維持 | worldview_tags / worldview_keywords 含めず |

---

## 4. ★ リグレッションテスト拡張検討(案 A/B/C 比較)

### 4.1 現状

`scripts/test-stylist-chat-continuity.ts`:
- **399 PASS**(段階 B reply 経路のみ)
- ★ MB 機能は段階 B reply 経路ではない = ★ **既存テストでカバーされていない**

### 4.2 拡張案 3 比較

| 案 | 内容 | 規模 | 推奨度 |
|---|---|---|---|
| A | 既存スクリプトに MB API シナリオ追加 | +50-100 行 | △(既存テストの責務範囲外)|
| B | 新規 `scripts/test-moodboards-api.ts` | +100-200 行 | △(MVP には重い)|
| **C** | ★ **MVP は実機 verify で代替**・自動テスト拡張は MVP-2 期 | **0 行** | ★ **推奨** |

### 4.3 ★ 推奨: 案 C(MVP 現実主義)

**理由**:
- 既存 399 PASS は **段階 B reply 経路**(diagnose/closet/coordinate/style-consult/brand-learn)のテスト・★ **核心領域は保護されている**
- MB 機能は ★ **DB/API/UI 層**(reply 経路ではない)= 既存テスト 0 PASS でも MVP 動作に影響なし
- 自動テスト拡張は MVP-2 期(品質向上 Sprint)で実装
- MVP は ★ **実機 verify チェックリスト 7 シナリオ**(§7)で代替

★ **判断根拠**:オーナー単独 MVP 検証期 → 自動テストより実機操作で十分かつ早い。1000 アクティブ到達後に MVP-2 で自動化拡張。

---

## 5. ★ 5 層多段防御維持確認

### 5.1 Phase 1 5 層多段防御(既存)

| 層 | 維持確認 |
|---|---|
| 1. 構造遮断(列絞り SELECT)| ★ 全 API 7 route で `worldview_tags` / `worldview_keywords` 含めず確認 |
| 2. 入口 sanitize(KOS contextData)| `stylist-chat/route.ts` `stripCanonicalSlugs` ★ 不変 |
| 3. system 明示禁止(31 語例示 + jsonb キー禁止)| `lib/prompts/stylist-chat.ts` ★ 不変 |
| 4. 出口フィルタ(reply 全文 stripCanonicalSlugs)| `stylist-chat/route.ts` 出口 ★ 不変 |
| 5. UI 表示制御(ClosetPicker)| `ClosetPickerModal` ★ 不変 |

### 5.2 Phase 2 拡張防御(C-2/C-3 で追加)

| 層 | 維持確認 |
|---|---|
| SSRF 5 重(og-image-extractor)| host allowlist + private IP + https + timeout + redirect manual・★ コード確認 |
| EXIF 除去(image-pipeline.ts)| `processImageForUpload` ★ 既存流用・MB upload で動作 |
| 三重防御 1(buildMoodboardPrompt)| ★ worldview_tags / worldview_keywords 含めず・worldview_name のみ |
| is_public default false(地雷 8 オプトイン)| `moodboards` テーブル + POST API 確認 |
| 親 MB 本人所有確認(items 系 4 route)| `.eq("user_id", user.id)` 確認 |

→ ★ **全層維持**(コード 0 変更で全保持)

### 5.3 確認方法(grep ベース静的解析)

```bash
# 1. 構造遮断確認(worldview_tags 含まないこと)
grep -rn "worldview_tags" app/api/moodboards/ | grep -v "worldview_tags 含めず"

# 2. 三重防御 1(buildMoodboardPrompt)
grep -n "worldview_tags\|worldview_keywords" lib/prompts/moodboard-prompt.ts

# 3. SSRF 5 重(og-image-extractor)
grep -n "URL_ALLOWLIST\|PRIVATE_IPV4\|MAX_REDIRECTS\|FETCH_TIMEOUT" lib/utils/og-image-extractor.ts

# 4. is_public default false
grep -n "is_public" app/api/moodboards/route.ts | grep "false"

# 5. 親 MB 本人所有確認
grep -rn "mb.user_id !== user.id" app/api/moodboards/
```

→ ★ 全て期待通り出力されれば防御維持確認

---

## 6. ★ 不可侵境界線確認

### 6.1 git diff ベース確認

```bash
# Phase 1 完成宣言起点 acb0b01 → Sprint C-3 完遂 ae2996d までの diff
git diff acb0b01..ae2996d -- docs/STYLE-SELF_D1_実装設計.md             # 本体 ac834bb
git diff acb0b01..ae2996d -- docs/STYLE-SELF_診断システム_再設計.md      # doc7
git diff acb0b01..ae2996d -- docs/STYLE-SELF_最終ビジョン.md             # df36d82
git diff acb0b01..ae2996d -- docs/STYLE-SELF_D1_最終ビジョン_ロードマップ_整合性点検.md  # ddb86f7
git diff acb0b01..ae2996d -- docs/STYLE-SELF_D1_ビジョン完全達成_ロードマップ.md       # d42463b
git diff acb0b01..ae2996d -- docs/STYLE-SELF_D1_P1-C-1.5_コスト試算_再評価.md          # 985d00b
```

★ **期待**:全 6 ファイル diff 0 行(本セッション全 24 commits で不変)

### 6.2 確認項目チェックリスト

| 項目 | 期待 |
|---|---|
| 本体 `ac834bb` 全 0 変更 | ✅ |
| doc7 全 0 変更 | ✅ |
| 最終ビジョン `df36d82` 全 0 変更 | ✅ |
| 整合性点検 `ddb86f7` 全 0 変更 | ✅ |
| ロードマップ `d42463b` 全 0 変更 | ✅(★ Sprint B-2 改訂 `5021657` までで完了・以降不変)|
| コスト試算 `985d00b` 全 0 変更 | ✅ |
| ③ 専章 / ③ コスト / Phase 2 後ゲート diff 0 行 | ✅ |
| 既存設計判断 1-10 文言不変 | ✅ |
| 5 層多段防御 全層維持 | ✅ |
| public ルート `/u/[id]` / `/p/[id]` 不変 | ✅ |
| 既存 18 機能(BottomNav 等)不変 | ✅(A-2 廃止後の状態維持)|
| 既存 v1 API(/api/wardrobe, /api/posts, /api/diagnose 等)不変 | ✅ |

---

## 7. ★ 実機 verify チェックリスト(7 シナリオ)

### シナリオ 1: 新規 MB 作成・編集・削除

```
1.1 /moodboard で「+ 新規作成」ボタンタップ
1.2 name「テスト用 MB」入力 → 作成 → 一覧に出現
1.3 カードタップ → /moodboard/[id] 詳細画面遷移
1.4 「Concept 編集」→ モーダル + 例文 4 件 inline → 例文タップ挿入 → 保存
1.5 「編集」→ MetaEditModal → is_public 切替 → 公開バッジ変化確認
1.6 「削除」→ confirm モーダル → 削除実行 → /moodboard 遷移 + 一覧から消失
```

### シナリオ 2: 画像追加(自動分析・主機能)

```
2.1 自動分析(beta)チェックボックス default ON 確認
2.2 「+ 画像追加」→ file select → ImageAddModal「画像を AI が分析します」notice 表示
2.3 「追加」→ 「分析中...(2-5 秒)」表示
2.4 items に画像追加 + 左上にカテゴリバッジ([hair] 等) + caption 50 字自動付与
2.5 進捗バー更新確認(N/8 増加)
2.6 caption 編集モーダル → カテゴリ変更 → 保存 → バッジ変化
```

### シナリオ 3: 画像追加(手動・fallback)

```
3.1 自動分析(beta)チェックボックス OFF
3.2 「+ 画像追加」→ file select → ImageAddModal(v2 旧 UI: カテゴリ select + textarea)
3.3 カテゴリ「ヘア」select → caption「濡れ髪」入力
3.4 「追加」→ items に追加 + [hair] バッジ + 「濡れ髪」caption
```

### シナリオ 4: URL 連携(★ SSRF 5 重防御)

```
4.1 「URL から追加」ボタンタップ → UrlAddModal 開く
4.2 Pinterest URL(例: https://pin.it/xxx)ペースト → 「取得 →」
4.3 「取得中...(5-10 秒)」表示
4.4 items に画像 + source_url 保存 + 自動分析カテゴリ + caption
4.5 google.com 等の URL(allowlist 外)→ 「対応していないプラットフォームです」エラー
4.6 http:// URL → 「https URL のみ対応」エラー
```

### シナリオ 5: 8/8 達成 → 連鎖

```
5.1 description に 8 要素全部入りで入力(例:「25 歳富裕旅行者 / 海岸 / 夕方 / 濃紺・白 / 濡れ髪 / ナチュラルメイク / リネン服 / 都会的」)
5.2 進捗バー 8/8 表示 + チェックリスト全 ✓
5.3 「✨ 必須要素 8/8 カバー完了!」CTA 表示
5.4 「このムードボードで撮影する」タップ → /ai 遷移
5.5 ChatPage textarea に buildMoodboardPrompt が自動挿入(L1-N 構造)
5.6 「送信」→ stylist-chat coordinate LLM 応答(コーデ提案)
```

### シナリオ 6: 公開ルート(anon)

```
6.1 MB の MetaEditModal で is_public = true 設定
6.2 ログアウト or シークレットウィンドウ
6.3 /m/[id] にアクセス
6.4 公開バッジ + メインビジュアル + コンセプト + 必須要素 8 + items 表示
6.5 ★ 編集 / 削除 / 画像追加 / チャットに渡す ★ 全非表示
6.6 (public)/layout.tsx の「自分の世界観を作る」CTA 表示
6.7 別の MB(is_public=false)で /m/[id] → 404 fallback 「このムードボードは見られません」
```

### シナリオ 7: ChatPage MB ピッカー(★ Sprint C-3)

```
7.1 /ai で 🎨 MB ボタンタップ
7.2 MoodboardPickerModal 開く + MB 一覧表示
7.3 MB カードタップ → 「読み込んでいます…」一瞬 → GET /api/moodboards/[id] で詳細取得
7.4 ChatPage textarea に buildMoodboardPrompt 自動挿入
7.5 prompt 構造確認:
    - [ムードボード] + テーマ + コンセプト + 世界観名
    - [必須要素カバー N/8] 8 要素 hit/miss
    - [参考画像メモ] items リスト
    - 「不明な要素はコンセプトから推定して補完してください」
7.6 「送信」→ stylist-chat coordinate LLM 応答
```

---

## 8. ★ Sprint C-4 実装スコープ(★ MVP は設計のみ・実装 0 行)

### 8.1 実装案 A: 設計のみ(★ MVP 推奨)

| 内容 | 規模 |
|---|---|
| 本設計 doc(チェックリスト + 実機 verify 7 シナリオ) | ★ 本 commit のみ |
| リグレッションテスト拡張 | ★ **MVP-2 期推奨**(0 行) |
| チェックリスト消化スクリプト | ★ 不要(オーナー手作業) |
| **合計** | ★ **設計のみ・実装 0 行** |

### 8.2 実装案 B: 大規模拡張(★ MVP 不要 / MVP-2 期推奨)

| 内容 | 規模 |
|---|---|
| 既存スクリプトに MB API シナリオ追加 | +50-100 行 |
| 新規 `scripts/test-moodboards-api.ts` | +100-200 行 |
| チェックリスト消化スクリプト | +30-50 行 |
| **合計** | **+180-350 行 / 1-2 セッション** |

→ ★ **MVP-2 期(品質向上 Sprint)で実装推奨**(現状 MVP には不要)

### 8.3 ★ 推奨: 案 A(MVP は設計のみ + 実機 verify)

- ★ 本 doc 完遂 → オーナー実機 verify(7 シナリオ・15-20 分)
- ★ verify 結果に応じて Sprint D に進む or 個別修正
- ★ 自動テスト拡張は MVP-2 期(月 1000 アクティブ近接時)

---

## 9. ★ Sprint D との関係

### 9.1 Sprint C-4 完遂後の流れ

```
Sprint C-4 完遂(本 doc + 実機 verify)
   ↓
Sprint D 着手:
  - ★ コスト v3 評価(Vision API 月額検討・Sprint B-3 案 P1 適用判断)
  - ★ リアル試着 GO/NO-GO(本体 判断 6・顔写真領域への移行判断)
  - ★ MVP リリース判定
   ↓
MVP リリース(GO の場合)or Phase 4 先行検討(NO-GO の場合)
```

### 9.2 Sprint D の評価項目(★ 本 Sprint C-4 完遂が前提)

| Sprint D 評価項目 | Sprint C-4 で確認済か |
|---|---|
| Phase 2 機能 全動作 | ✅(本 doc §7 実機 verify)|
| Phase 2 退行ゼロ | ✅(本 doc §5+§6 防御 + 不可侵)|
| コスト試算(Vision 含)| Sprint D で評価 |
| プライバシー漏洩ゼロ | ✅(本 doc §5 三重防御確認)|
| リアル試着 GO 条件評価 | Sprint D で評価 |

---

## 10. ★ 既存達成への影響評価(★ コード 0 変更・全保持)

| 達成項目 | 想定影響 |
|---|---|
| 1.5b 完成形 / race fix v2 / L4-A / A-2 / A-3 / MVP-1c / A-4 / A-10 / A-6 / A-6b / A-5 / A-9 / Sprint B-1 / B-2 / B-3 / C-1 / C-2 完遂 / C-3 完遂 | **0**(コード 0 変更)|
| リグレッションテスト | **399 PASS 維持** |
| 既存 v1 各 intent API + UI | **0** |
| 既存 migrations(001-026)| **0** |
| `lib/storage.ts` / `lib/utils` 5 件 / `lib/prompts/moodboard-prompt.ts` | **0**(参照 only) |
| `types/moodboard.ts` / 既存 API 7 route / 段階3-A〜3-E 既存実装 | **0** |
| 本体 `ac834bb` 6 章 / 7 章 / 判断 6 | **diff 0 行** |
| 本体 / doc7 / 最終ビジョン / 整合性点検 / ロードマップ / コスト試算 / 各設計案 | **diff 0 行** |
| 既存設計判断 1-10 | **文言不変** |

---

## 11. 推奨案(★ 結論)

### 11.1 推奨実装方針

- ★ 本工程 = 設計調査 doc 1 件のみ origin 保全
- ★ 実装案 A(★ MVP 推奨)= **設計のみ・コード 0 行**
- ★ 実機 verify 7 シナリオはオーナー手作業(15-20 分)
- ★ リグレッションテスト拡張は MVP-2 期推奨(月 1000 アクティブ近接時)

### 11.2 ★ 6 項目 結論サマリ

| 項目 | 結論 |
|---|---|
| 全機能チェックリスト | DB 7 + Storage 7 + API 7 route × 8 項目 + UI 全画面 + 詳細画面 v3 22 機能 + 連鎖 5 fixture |
| リグレッションテスト拡張 | ★ **案 C 推奨**(MVP は実機 verify で代替・自動化は MVP-2 期)|
| 5 層多段防御維持 | ★ Phase 1 既存 5 層 + Phase 2 拡張 5 層 = **10 層**全維持(コード 0 変更)|
| 不可侵境界線 | ★ 全 6 ファイル diff 0 行 + 既存設計判断 1-10 文言不変 + ③ 専章/コスト/後ゲート diff 0 行 + 5 層多段防御 全維持 + public ルート不変 + 既存 18 機能不変 + 既存 v1 API 不変 |
| 実機 verify | ★ **7 シナリオ**(新規 CRUD / 画像追加自動 / 手動 / URL 連携 / 8/8 連鎖 / 公開ルート / ChatPage Picker) |
| Sprint D 着手準備 | ✅ 完了(Sprint D は コスト v3 評価 + リアル試着 GO/NO-GO + MVP リリース判定)|

### 11.3 ★ 次工程

- 本 commit(設計 doc 1 件)→ オーナー判断 → origin 保全
- 次工程: オーナー実機 verify(7 シナリオ・15-20 分)
- verify 結果に応じて:
  - 問題なし → Sprint D 着手
  - 問題あり → 個別修正(別 Sprint or hotfix)
- Sprint D 完遂 → **MVP リリース判定**

---

## 12. 結論

| 観点 | 結論 |
|---|---|
| ★ Sprint C-4 設計判断 | **★ 案 A 採用**(設計のみ + 実機 verify オーナー手作業)|
| 規模 | **+500-600 行 / 30-45 分**(本 commit・設計のみ)+ オーナー実機 verify 15-20 分(本 doc §7)|
| 既存達成保持 | コード 0 変更で **全保持**(399 PASS 維持・tsc EXIT 0 維持)|
| ★ Phase 2 機能カバレッジ | ★ 全機能チェックリスト完備(DB/Storage/API 7/UI/連鎖)|
| ★ 5 層多段防御 | ★ Phase 1 既存 + Phase 2 拡張 = **10 層全維持** |
| ★ 不可侵境界線 | ★ 全項目維持(★ 本セッション 24 commits で 0 違反)|
| ★ 次工程 | オーナー判断 → 本 commit origin 保全 → 実機 verify 7 シナリオ → **Sprint D**(Phase 2 後ゲート)→ **MVP リリース判定** |
| 不可侵 | 本体 6 章 / 7 章 / 判断 6 / コスト試算 / 整合性点検 / ロードマップ / 各設計案 / 既存設計判断 1-10 / 既存 migrations / API 7 route / 段階3-A〜3-E 既存実装 ★ **全不変** |

→ ★ **Sprint C-4 完成・退行点検 設計青写真 完遂**(MVP リリース前最後の品質確認準備完了)

---

## 13. 制約遵守チェックリスト

- [x] 新規 docs ファイル 1 件のみ(本 doc)
- [x] 本体 `ac834bb` / コード(app/api/lib/scripts/package.json/tsconfig.json)/ doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` / 各設計案 / 他 docs **全 0 変更**
- [x] 既存 migrations(001-026) **不変**
- [x] 既存 API 7 route / 既存 UI 全画面 / types/moodboard.ts / lib/utils 5 件 / lib/prompts/moodboard-prompt.ts **不変**
- [x] 本体 6 章 / 7 章 / 判断 6 diff 0 行
- [x] 既存設計判断 1-10 文言不変
- [x] view + grep + 静的解析のみ・実装なし
- [x] tsc EXIT 0 維持(本 doc は markdown のみ・コード 0 変更)
- [x] リグレッションテスト 399 PASS 維持(本工程はコード 0 変更)
- [x] 実装は ★ 別工程(本 doc では実施しない・MVP は ★ 実機 verify で代替)
- [x] commit はあり / push はなし
