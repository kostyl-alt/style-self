# STYLE-SELF D1 — A-5 P1-D 設計調査(上部世界観カード + 提案チップ 5 + 入力欄近接 4 ボタン)

- 作成日: 2026-05-24
- 起点 HEAD: `3589dcc`(A-6b brand-learn 実装完了・`origin/main` 整合・clean)
- 本 doc の役割: A-5 着手前の **静的解析中心の設計調査**(本体・コード・他 doc 0 変更)
- 上位連結:
  - ロードマップ [§3.5 / §11.1 優先 4](./STYLE-SELF_D1_ビジョン完全達成_ロードマップ.md)
  - A-6 / A-6b で確立した 5 intent 五角(`diagnose`/`closet`/`coordinate`/`style-consult`/`brand-learn`)の上に **UI 完成形** を実装
  - 最終ビジョン `df36d82` MVP 優先項目 6「商品画像・商品 URL・MB をチャットに渡す」直対応
- 実装方針: ★ **既存 ChatPage ロジック(handleSubmit / sessionIntent / race fix v2 / L4-A / 5 intent)に 1 行も触らない**(本 A-5 は ★UI 層のみ追加)

---

## 1. 背景

### 1.1 ChatGPT の服版 中身完成 → 見た目完成への遷移
- A-4 / A-10 / A-6 / A-6b 完遂で **5 intent 五角(中身完成)** を達成
- A-5 = **コア体験 UI 完成**(見た目完成)= ビジョン本文の MVP 優先項目 6 直対応
- ビジョン本文「コア体験」13 例文から提案チップ 5 を選定 → 発話の発火点を UI に集約

### 1.2 不可侵境界線(本セッション再宣言)
1-8: 既存 8 条 + ★ **既存 ChatPage ロジック(handleSubmit / 5 サブコンポーネント / hydrate / persist / sessionIntent / executeNavigate)に 1 行も触らない**
9: ★ **既存 v1 各 intent API(brand-recommend / style-consult / coordinate / wardrobe 等)無変更**

---

## 2. 現状実装サマリ(静的解析)

### 2.1 `app/(app)/ai/page.tsx` ChatPage 構造(A-6b 完了時)
- **header**(行 307-320): タイトル「STYLE-SELF AI / 何を相談しますか?」+ 右上 [≡] MenuDrawer 開閉
- **履歴エリア**(行 323-334): `messages.length === 0` → `EmptyHistoryHint`(行 425-438) / それ以外 → Bubble マップ
- **入力欄**(行 337-362): textarea + 送信ボタン(下部固定 `border-t border-gray-100 px-5 py-3`)
- **MenuDrawer**(行 365-369): 右スライド・navigate 7 + new-chat + placeholder 2 = 10 項目
- **★ 上部 hero 領域は不在**(header と履歴エリアの間に世界観カードを挿入する余地)
- **★ 入力欄左に余白**(textarea 全幅・近接ボタン群を入力欄上 or 左に追加する余地)

### 2.2 既存 EmptyHistoryHint(行 425-438)
- 「自然言語で書いてください」+ 3 例(「世界観の近い人を…」「黒い服のコーデが…」「診断したい」)
- ★ **A-5 では提案チップ 5 がこの役割を引き継ぐ**(EmptyHistoryHint は廃止 or 縮約)

### 2.3 `worldview_profiles` テーブル(`020_diagnosis_v2.sql`)
- `user_id`(主キー)/ `pattern_id` / `pattern_name` / `result jsonb` / `source_session` / `updated_at`
- `result` jsonb 内: `worldviewName`, `worldview_keywords[]`, `coreIdentity`, `idealSelf`, …(A-10 fetchDiagnoseContext 既存利用)
- RLS: 本人のみ
- ★ A-5 で **列絞り SELECT** `result->{worldviewName,worldview_keywords,coreIdentity}` を行う(A-10 同形・worldview_tags 列を取得しない構造的安全)

### 2.4 `wardrobe_items` GET API
- `app/api/wardrobe/route.ts:44-67` `GET` 公開済(認証必須・本人のみ)
- 戻り値: `WardrobeItem[]`(id / name / category / color / brand / imageUrl / etc.)
- ★ A-5 クローゼットボタンで **そのまま流用**(新規 API 不要)

### 2.5 ★ 重要発見: `moodboards` テーブル ★ 不在
- `grep moodboard supabase/` → **0 件**
- ★ **MB ボタンは A-5 では骨格のみ**(クリックで「準備中(Sprint C で実装)」notice 表示)・本実装は Sprint C(ロードマップ §5)

### 2.6 既存 UI パターン
- Modal: `components/wardrobe/AddItemModal.tsx`, `components/knowledge/AddSourceModal.tsx`, `components/chat/MenuDrawer.tsx`
- Card: `components/BrandCard.tsx`, `components/DiagnosisDisplay.tsx`
- 画像 upload: `lib/storage.ts` `uploadWardrobeImage`(既存)
- ★ A-5 はこれらと整合する Tailwind スタイル(rounded-xl, border-gray-100, text-gray-800)で構築

---

## 3. A-5 構成要素 詳細設計

### 3.1 上部世界観カード

| 項目 | 設計 |
|---|---|
| **配置** | `header` 直下・履歴エリアの上(`<div className="px-5 pt-3 pb-2">` 想定)|
| **表示要素(★ 3 要素)** | (a) `worldviewName`(例: 「黒い美術館の住人」)・h2 級 / (b) `worldview_keywords` 上位 5 件 を pill 表示 / (c) 「詳しく見る →」リンクで `/self?tab=diagnosis` 遷移 |
| **読まない要素** | `coreIdentity` / `idealSelf` 全文(カードに重すぎる・遷移先で表示)|
| **未診断時 fallback** | 「世界観を診断する →」CTA カード(`/onboarding` 遷移)|
| **データ取得** | ★ 新規 API 不要 = `app/api/worldview/route.ts` を **直接使わず**、**新規 SSR fetch** で `worldview_profiles` から列絞り SELECT(A-10 fetchDiagnoseContext と同形)or **Client side fetch**(useEffect で初回取得・loading state)|
| **推奨実装** | Client side fetch(`/api/worldview-card`(新規最小 API)or 既存 `/api/worldview` 流用)→ React state に保持・hydrate と同型 useEffect で 1 回取得 |
| **★ 三重防御** | (1) jsonb 列絞り `result->worldviewName,worldview_keywords,coreIdentity` — worldview_tags 列を取得しない(A-10 同形)/ (2) `worldview_keywords` は日本語タグ前提(PRODUCT_WORLDVIEW_TAGS 31 英語スラッグとは別語彙)/ (3) UI 表示前に念のため英語スラッグ除去 helper(任意)|

★ **推奨**: 既存 `/api/worldview` の戻り値 `Worldview | null` を流用するのが最小コスト。ただし `worldview` は **legacy `users.worldview` 列**(Sprint 11)で、新しい `worldview_profiles.result` とは別ソース。 **★ A-5 では新 API `/api/worldview-card` を作る(列絞り SELECT で `worldview_profiles.result` から `worldviewName / worldview_keywords / coreIdentity` のみ取得)** ことを推奨(A-10 fetchDiagnoseContext のコピー)。

### 3.2 提案チップ 5(★ ビジョン df36d82 13 例文から選定)

| # | 文言 | 想定 intent | 選定理由 |
|---|---|---|---|
| 1 | 「黒い服のコーデが見たい」 | coordinate | 既存 EmptyHistoryHint にあった主力例・MVP-1c 完成形を起爆 |
| 2 | 「自分の世界観に合うブランドを知りたい」 | brand-learn | ★ A-6b 良い例 8 直対応・5 intent 完成形を体感 |
| 3 | 「低身長だけどロングコートを着たい」 | style-consult | ★ A-6 良い例 5 + ビジョン df36d82 直接例文 |
| 4 | 「クローゼットを見せて」 | closet | 1.5b 完成形(集計サマリ)を起爆・手持ち服把握の入口 |
| 5 | 「診断したい」 | diagnose | 既存 EmptyHistoryHint にあった主力例・1.5a 完成形を起爆 |

- ★ **5 つで 5 intent 全てを 1 タップで体験可能**(diagnose / closet / coordinate / style-consult / brand-learn が各 1 つずつ起動)
- **動作**: タップ → **textarea に挿入**(直接送信しない・ユーザーが編集可)
  - 理由: 体験「世界観の住人として、ChatGPT に話すように編集して送る」を保つ
  - 直接送信案は「AI を試す」体験になるので非推奨
- **レイアウト**: 折返し(`flex flex-wrap gap-2`)・モバイルでも見やすい(横スクロールはチップ数 5 で過剰)
- **配置**: `EmptyHistoryHint` 内 or **常時表示**(履歴 0 件時のみ表示 or 常に表示)
  - ★ **推奨: 履歴 0 件時のみ表示**(セッション開始時の発火点に集中・連続発話時はノイズ)

### 3.3 入力欄近接 4 ボタン

| ボタン | A-5 スコープ | A-5 動作 | 本実装 Sprint |
|---|---|---|---|
| 📎 写真 | **骨格のみ** | クリック → `<input type="file" accept="image/*" hidden>` 起動・ファイル選択後は「✅ 画像を選択しました(Phase 3 で実装予定)」テキスト表示・送信動作なし | Sprint E(リアル試着・既存 `lib/storage.ts` 流用予定)|
| 🔗 商品 URL | **骨格のみ** | クリック → 簡易モーダル(URL 入力欄 + キャンセル + 確認)・確認後は「✅ URL を受け付けました(Sprint C で実装予定)」テキスト表示・送信動作なし | Sprint C(ムードボード + 商品連鎖)|
| 👕 クローゼット | **完全実装** | クリック → モーダル(`GET /api/wardrobe` 取得・カテゴリ別グリッド表示)→ アイテム選択 → textarea に「『○○』(白シャツ・綿)に合うコーデを考えて」型の文字列挿入 | A-5 で完了 |
| 🎨 MB | **骨格のみ**(★ moodboards テーブル不在)| クリック → 「📌 MB は Sprint C で実装予定です」notice 表示・送信動作なし | Sprint C(C-2 実装) |

- **★ 推奨方針 A**(骨格 + クローゼットのみ完全実装)・規模 +150-250 行
- **方針 B**(全部実装)= +400-600 行・集中力後半リスク → ★ 非推奨
- **配置**: 入力欄 textarea の **上**(`border-t` の直下)・横一列 4 ボタン

### 3.4 クローゼットボタン 完全実装の詳細

| 項目 | 設計 |
|---|---|
| 取得 API | `GET /api/wardrobe`(既存) |
| Modal コンポーネント | 新規 `components/chat/ClosetPickerModal.tsx`(既存 `AddItemModal.tsx` パターン踏襲)|
| 表示 | カテゴリ別グリッド(トップス / ボトムス / アウター / シューズ / バッグ / 小物)・各サムネイル + 名前 |
| 選択 | 1 アイテム選択 → modal close → textarea にチャット用文字列挿入 |
| 挿入文字列形式 | `「{name}」({color} {material})` 形式・例: `「白シャツ」(白 綿)`(★ 過剰情報なし・ユーザーが編集可)|
| Empty state | 「クローゼットに服が登録されていません。先に登録してください →」CTA(`/outfit?tab=closet` 遷移)|
| 性能 | 大量アイテム時は `WardrobeItem[]` を category で `.filter()`(★ ページネーション不要・100 件級まで快適)|
| ★ 三重防御 | 列絞り SELECT は **GET /api/wardrobe 側** で既存実装(`select("*")` ★ worldview_tags も含む)。 **本 A-5 UI 表示時に英語スラッグを露出しないこと** を表示テンプレで制御(name / color / material / brand のみ表示・worldviewTags は表示しない) |

★ 重要(A-5 で念のため確認): `GET /api/wardrobe` は本人 RLS で他人のデータは出ない・worldviewTags は表示テンプレが拾わなければ画面に出ない(M2-3/M4 教訓)。

---

## 4. ボタン群の本実装 vs 骨格のみ(★ 推奨方針 A)

### 4.1 推奨方針 A(★ A-5 採用案)
- 写真 / 商品 URL / MB = 骨格(クリック動作 + Phase 表示のみ)
- クローゼット = 完全実装
- 規模 +150-250 行 / 60-90 分
- ★ 利点: A-5 の本旨「UI 完成」を達成しつつ、深い実装は適切な Sprint(Phase 3 写真 / Sprint C MB+URL)に委ねる

### 4.2 方針 B(全部完全実装)
- 写真: 画像 upload + Vision 解析 API 呼出 +150 行
- 商品 URL: URL → 楽天 API 経由メタ取得 +100 行
- MB: テーブル新規 +100 行 + UI +150 行
- 規模 +400-600 行 / 3-4 セッション規模
- ★ 非推奨(M5 教訓・原則 3「刻む」違反)

---

## 5. 実装範囲(規模見当)

| ファイル / 機能 | 想定行数 |
|---|---|
| `app/(app)/ai/page.tsx`(WorldviewCard + 提案チップ 5 + 4 ボタン + state)| **+80-120** |
| `components/chat/WorldviewCard.tsx`(新規)| **+30-50** |
| `components/chat/SuggestionChips.tsx`(新規)| **+25-40** |
| `components/chat/InputAttachments.tsx`(新規・4 ボタン群)| **+40-60** |
| `components/chat/ClosetPickerModal.tsx`(新規)| **+60-90** |
| `app/api/worldview-card/route.ts`(新規・worldview_profiles 列絞り SELECT)| **+25-40** |
| `scripts/test-stylist-chat-continuity.ts` | **+0-10**(★ UI テストは simulator 範囲外・既存 399 PASS 維持確認のみ)|
| **合計** | **+260-410 行**(起点指示 +150-250 行 を上振れ・★ 推奨案でも 5 ファイル新規が要因)|
| 実装時間 | **70-100 分**(起点指示 60-90 分とほぼ整合)|

★ **行数縮小案**: WorldviewCard / SuggestionChips / InputAttachments を `app/(app)/ai/page.tsx` 内ローカル関数にして 3 ファイル削減 → +200-300 行 / 60-80 分

---

## 6. Step 分割(★ 推奨 9 段階)

| Step | 内容 | 想定時間 |
|---|---|---|
| 1 | `app/api/worldview-card/route.ts` 新規(`worldview_profiles.result` 列絞り SELECT)| 10 分 |
| 2 | `WorldviewCard` 実装(ChatPage 内 or 別ファイル)+ ChatPage に useEffect で取得・hydrate と独立 | 15-20 分 |
| 3 | `SuggestionChips` 実装(ChatPage 内 or 別ファイル)+ EmptyHistoryHint に組込 + textarea 挿入動作 | 10-15 分 |
| 4 | `InputAttachments` 4 ボタン骨格(写真 / URL / クローゼット / MB)+ 各 click handler | 15-20 分 |
| 5 | `ClosetPickerModal` 実装(`GET /api/wardrobe` 取得・カテゴリ別グリッド・選択 → textarea 挿入)| 20-25 分 |
| 6 | `npx tsc --noEmit` → EXIT 0 | 2 分 |
| 7 | リグレッションテスト **399 PASS 維持**(UI は simulator 範囲外・データロジックの不変を確認)| 2 分 |
| 8 | 実機 verify(オーナー実施推奨・★ 別途共有)| 10 分 |
| 9 | commit(push しない)| 3-5 分 |
| **合計** | | **87-119 分**(中央値 ≒ 100 分)|

---

## 7. 既存達成への影響評価

| 達成項目 | 想定影響 |
|---|---|
| 1.5b 完成形 / race fix v2 / L4-A / A-2 / A-3 / MVP-1c / A-4 / A-10 / A-6 / A-6b | **0**(handleSubmit / 5 サブ / hydrate / persist / 5 intent ロジックに 1 行も触らない)|
| リグレッションテスト | **399 PASS 維持**(UI 追加は simulator スコープ外)|
| 既存 v1 各 intent API + UI | **0**(別経路保持)|
| ③ 専章 / ③ コスト / Phase 2 後ゲート | **diff 0 行**(★ 厳守)|
| 既存設計判断 1-10 | **文言不変**(★ 厳守)|
| コスト | 新規 `/api/worldview-card` は SELECT のみ・¥0 / `GET /api/wardrobe` 既存・クローゼットボタン使用時のみ呼出 |

---

## 8. 三重防御 維持(★ A-4 / A-10 / A-6 / A-6b 基盤継承)

| 層 | 適用 |
|---|---|
| (1) 列絞り SELECT | `/api/worldview-card` で `worldview_profiles.result->{worldviewName,worldview_keywords,coreIdentity}` のみ・worldview_tags 列を SELECT 句に書かない / `GET /api/wardrobe` は既存実装(本 A-5 不変)|
| (2) UI 表示テンプレ | WorldviewCard / ClosetPicker で **worldview_tags 系の列を表示しない**(name / keywords / color / material / brand のみ表示)|
| (3) ChatPage 段階 B reply | ★ 既存(本 A-5 で変更なし)・stripCanonicalSlugs 維持 |

---

## 9. リスク + エッジケース

### 9.1 未診断ユーザー fallback
- WorldviewCard: 「世界観を診断する →」CTA(`/onboarding` 遷移)
- 提案チップ 5: ★ 診断未完了でも 5 つ全て表示(タップ → 段階 A で auth 通過 → 段階 B で intent 別 fallback)

### 9.2 モバイル提案チップ
- `flex flex-wrap` で 2-3 段折返し(横スクロール過剰回避)・モバイル幅 360px で問題なし想定

### 9.3 写真ボタン: ファイルサイズ / 形式
- A-5 骨格のみ → 制限不要(ファイル選択後は notice 表示のみ・upload しない)
- Phase 3 本実装時に 5MB / image/jpeg|png 制限を入れる(既存 `lib/storage.ts` 流用)

### 9.4 クローゼット大量アイテム時の UI 性能
- 100 件級まで `<grid grid-cols-3 gap-2>` で快適
- 1,000 件超は将来課題(virtualization 等)・MVP では非対象

### 9.5 MB ボタン: テーブル不在
- A-5 では「📌 MB は Sprint C で実装予定です」notice 表示のみ
- Sprint C 着手時に `moodboards` テーブル新規 + Storage bucket + RLS 一式

### 9.6 worldview_keywords が英語スラッグ混入時(★ 防御確認)
- `worldview_profiles.result.worldview_keywords` は **analyze-v2 出力**(日本語キーワード前提)
- 万一英語スラッグが混入していても WorldviewCard 表示時に念のため `stripCanonicalSlugs` 等価フィルタ適用(任意・防御的)

---

## 10. 推奨案

### 10.1 ★ 推奨実装方針 = 方針 A(骨格 + クローゼットのみ完全実装)
- 規模 +260-410 行 / 70-100 分(★ 縮小案 +200-300 行で抑制可能)
- リグレッションテスト **399 PASS 維持**(UI 追加は simulator 範囲外)
- 提案チップ 5 で 5 intent 全てを 1 タップで体験可能(中身完成 → 見た目完成の架け橋)

### 10.2 ★ A-5 完遂で達成すること
- ChatGPT の服版「ホーム画面」レベルの UI 完成形
- ビジョン df36d82 MVP 優先項目 6 直対応
- Phase 1 完成宣言(A-9)への最後の山(残: A-6c~e + A-7 + A-8 + A-9)

---

## 11. 結論

| 観点 | 結論 |
|---|---|
| 規模 | **+260-410 行 / 70-100 分**(★ 縮小案 +200-300 行)|
| 既存達成保持 | 1.5b 完成形 / race fix v2 / L4-A / A-2 / A-3 / MVP-1c / A-4 / A-10 / A-6 / A-6b **全保持**(handleSubmit / 5 intent ロジック 0 変更)|
| 三重防御 | (1) `/api/worldview-card` 列絞り / (2) UI 表示テンプレで worldview_tags 非露出 / (3) 既存出力フィルタ流用 — **★ 全層維持** |
| リグレッションテスト | **399 PASS 維持**(UI 追加は simulator スコープ外)|
| コスト | `/api/worldview-card` は SELECT のみ ¥0 / `/api/wardrobe` は既存・追加コストなし |
| 重要発見 | `moodboards` テーブル ★ 不在 → MB ボタンは骨格のみ・Sprint C で本実装 / クローゼット用 GET API 既存・新規不要 |
| ★ 推奨実装順 | Step 1-9(本 doc §6)・方針 A(骨格 + クローゼットのみ完全実装)|
| 次工程 | A-5 完遂後 → A-6c~e(MVP-1c 残 3 intent)→ A-7(結果カード)→ A-8(連鎖)→ ★ A-9 Phase 1 完成宣言 |

---

## 12. 制約遵守チェックリスト

- [x] 新規 docs ファイル 1 件のみ(本 doc)
- [x] 本体 `ac834bb` / コード(app/api/lib/scripts/package.json/tsconfig.json)/ doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `a62a36c` / A-4 設計案 `66dd5bb` / A-10 設計案 `9bfb0cc` / A-10 実装 `566e3b2` / A-6 設計案 `4cabf4a` / A-6 実装 `626b57d` / A-6b 設計案 `65bad33` / A-6b 実装 `3589dcc` / 他 docs **全 0 変更**
- [x] view + grep + 静的解析のみ・実装なし
- [x] 既存設計判断 1-10 文言不変
- [x] ③ 専章 / ③ コスト / Phase 2 後ゲート diff 0 行
- [x] tsc 通る前提(本 doc は markdown のみ・コード変更なしのため tsc 影響なし)
- [x] commit はあり / push はなし
