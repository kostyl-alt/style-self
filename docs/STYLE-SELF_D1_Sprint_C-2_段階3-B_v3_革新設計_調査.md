# STYLE-SELF D1 — Sprint C-2 段階3-B v3 革新設計 調査(★ 画像自動分析 + 外部プラットフォーム連携・MVP リリース条件・★ 実装は別工程)

- 作成日: 2026-05-24
- 起点 HEAD: `1e79de8`(Sprint C-2 段階3-B v2 改訂 実装・origin 保全済・clean / 399 PASS / tsc EXIT 0)
- 本 doc の役割: v2 実装完遂後、★ オーナー提案 1+2 を受けた **革新設計** = MVP リリース条件への引き上げ(★ **コード 0 変更・実装は別工程**)
- 上位連結:
  - 段階3-B v2 改訂 [設計](./STYLE-SELF_D1_Sprint_C-2_段階3-B_v2_改訂_設計調査.md)(`d515428`)+ [実装](../app/\(app\)/moodboard/[id]/page.tsx)(`1e79de8`)= ★ **完全保持基盤**(手動 select は補助手段)
  - ★ オーナー提案(2026-05-24・実機 verify 後):
    - 提案 1: 画像から LLM Vision で自動分析 → ユーザーは画像入れるだけ
    - 提案 2: Pinterest / Instagram / Vogue URL ペースト → 直接 MB 登録
    - 提案 3: 「しっくりこなかったら後で変えれる」= MVP マインド
  - 既存 Vision 先例: [app/api/admin/analyze-product-image/route.ts](../app/api/admin/analyze-product-image/route.ts) + [lib/prompts/analyze-product-image.ts](../lib/prompts/analyze-product-image.ts)(Sprint 41.2)= ★ ★ **同型作法で安全に流用可能**

---

## 1. 背景

### 1.1 v2 の限界(★ 厳密な再評価)

段階3-B v2(`1e79de8`)で達成:
- ✅ 必須要素 8 進捗バー + チェックリスト
- ✅ カテゴリ select(画像追加 + caption 編集)
- ✅ items Card にカテゴリバッジ
- ✅ 撮影前 CTA(8/8 達成時)
- ✅ ヒューリスティック判定(プレフィックス + 日本語キーワード)

★ **しかし限界がある**:
- 手動カテゴリ select(画像 upload 時)
- 手動 caption 記述
- description 自由記述
- → ★ ユーザーが「言葉にして書く」必要

**問題**:
- 画像を見ても「これが何の画像か」言語化が難しい
- 8 要素のうちどれに該当するか判断負荷
- ★ ビジョン文書「① Vogue 観察 → 保存 → MB 更新」フローが「途中の言語化」で止まる

### 1.2 ★ オーナー宣言の解釈

> 「使ってくれた人が本当に使える」= MVP リリース時点で提案 1+2 実装必須

→ v2 は「使えるが入力負荷高い」/ v3 で「魔法のような体験」へ引き上げる

### 1.3 MVP リリース条件の引き上げ

| 観点 | 現状(v2 完了)| v3 完了で MVP リリース条件 |
|---|---|---|
| MB 機能 | ✅ 動作 | ★ ✅ 自動化 |
| ユーザー負荷 | 中(言語化必要) | ★ 低(画像入れるだけ)|
| Vogue 観察フロー | 言語化で止まる | ★ URL ペーストで完結 |
| 差別化 | Pinterest クローン感 | ★ プロ品質ツール |

### 1.4 不可侵境界線(★ 厳守)

1. 本体 `ac834bb` / コード / doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` / 各設計案 / 既存設計判断 1-10 ★ **全 0 変更**
2. 既存 migrations(001-026)/ 既存 API 4 route / types/moodboard.ts / 段階3-A 一覧 / ★ **段階3-B v2 既存実装(`1e79de8`)** ★ **不変**
3. ③ プライバシー専章 / ③ コスト管理 / Phase 2 後ゲート ★ **diff 0 行**
4. リグレッションテスト **399 PASS 維持**(本工程はコード 0 変更)
5. tsc EXIT 0 維持
6. ★ 実装は別工程(本 doc では実施しない)

---

## 2. ★ 提案 1: 画像自動分析(Vision LLM)

### 2.1 アーキテクチャ

```
[クライアント]
  file select
    ↓
  既存 EXIF 除去(processImageForUpload)
    ↓
  Storage upload(uploadMoodboardImage)
    ↓
  ★ 新規 API 呼出:POST /api/moodboards/[id]/items/analyze
    ↓
[サーバ]
  image_url 受け取り(SSRF 検証:moodboard-images bucket prefix のみ許可)
    ↓
  Claude Vision API 呼出(claude-sonnet-4-6・image_url 渡し)
    ↓
  prompt: 「画像を分析して以下を出力:
    1. 主要カテゴリ(必須要素 8 から 1-3 個)
    2. detailed caption(50 字以内・日本語)
    3. dominant colors(主要色 2-3 個・hex)」
    ↓
  JSON 受領 → 検証 → moodboard_items INSERT(caption に [hair] 等自動付与)
    ↓
  返却 {item: MoodboardItemRow}
```

### 2.2 ★ 既存 Vision 先例の流用(★ 重要)

★ **`Sprint 41.2` で既に Vision 経路が確立済**:
- `app/api/admin/analyze-product-image/route.ts`(管理者用商品 Vision 解析)
- `lib/prompts/analyze-product-image.ts`(prompt template)
- `claude-sonnet-4-6` モデル(`lib/claude.ts:20`)
- → ★ ★ **設計作法・SDK 統合・エラーハンドリング が全て先例にある**

★ **DRY by design**: 同型作法で実装可能 = 設計コストほぼゼロ。

### 2.3 LLM 選択

| モデル | コスト/image | 精度 | 一貫性 |
|---|---|---|---|
| **claude-sonnet-4-6**(★ 推奨)| ~$0.003 | 高 | ★ 既存 stylist + product-image と同 |
| claude-haiku-4-5 | ~$0.001 | 中 | ★ 既存 step2 と同・Vision 対応 |
| GPT-4V | ~$0.01 | 高 | × 別ベンダー(SDK 追加必要)|

★ **推奨: claude-sonnet-4-6**(コスト + 一貫性・既存 `analyze-product-image` 同型)。
★ **代替: claude-haiku-4-5**(コスト抑制が必要になったとき検討)。

### 2.4 コスト試算(★ Phase 2 後ゲート評価対象)

| シナリオ | 月画像数 | 月コスト |
|---|---|---|
| MVP(オーナー 1 人・10 画像 / 月)| 10 | **$0.03 / 月** = 誤差 |
| 検証期(100 ユーザー・10 画像 / 月)| 1,000 | **$3 / 月** |
| 本格運用(1,000 ユーザー・20 画像 / 月)| 20,000 | $60 / 月 |
| スケール(10,000 ユーザー)| 200,000 | $600 / 月 |

★ Sprint B-3 案 P1(月 N 回上限)と同思想で **Vision 呼出上限** を設定可。

### 2.5 ★ fallback 設計(★ v2 完全保持)

| 失敗ケース | fallback |
|---|---|
| Vision API 失敗(timeout / 5xx)| ★ v2 手動 select に切替・items は category 未指定で INSERT |
| JSON 解析失敗 | 同上 |
| Anthropic API 上限 | 同上 |
| 画像形式エラー | エラー alert・upload キャンセル |

★ ★ **v2 機能は ★ 削除しない**(補助手段として保持・「自動分析失敗時の救命ボート」)。

### 2.6 UX

```
画像追加ボタン
  ↓
file select(既存)
  ↓
画像追加モーダル(v2 既存)開く
  ↓
★ NEW: 「画像を自動分析(beta)」チェックボックス(default ON)
        or 「カテゴリを手動選択」モード(v2 既存)
  ↓
[自動分析 ON]
  「追加」ボタン → upload → 「分析中...」(2-5 秒)
    → 自動カテゴリ + caption が items に出現
    → ★ ユーザーは確認するだけ
    → ★ 不満なら caption 編集モーダル(v2 既存)で修正可
[手動 ON]
  v2 と同じフロー
```

★ ★ **「魔法のような体験」**(画像入れるだけ → 自動カテゴライズ完了)。

### 2.7 ★ 三重防御維持

- 列絞り SELECT: 既存 API パターン継承(worldview_tags 含めず)
- ★ Vision prompt に system 明示禁止文言(英語スラッグ非露出指示)
- 出力フィルタ: Vision JSON の caption に `stripCanonicalSlugs` 適用(三重防御 3)

---

## 3. ★ 提案 2: 外部プラットフォーム連携(URL ペースト)

### 3.1 アーキテクチャ

```
[クライアント]
  「URL から追加」ボタン(画像追加ボタンの隣)
    ↓
  URL 入力モーダル(autoFocus)
    ↓
  paste & 確定 → POST /api/moodboards/[id]/items/from-url
    ↓
[サーバ]
  URL 受け取り(body 検証)
    ↓
  ★ SSRF 防止:
    ・host allowlist(pinterest.com / instagram.com / vogue.com / etc)
    ・private IP 範囲拒否(10.x / 192.168.x / 127.x / IPv6 link-local)
    ・redirect 先も再検証(max 3 hops)
    ・timeout 10 秒
    ・max content size 10 MB
    ↓
  fetch HTML(or 直接画像 URL)
    ↓
  ・HTML → OpenGraph `<meta property="og:image" content="...">` 抽出
  ・直接画像 URL → そのまま使用
    ↓
  画像 download(Storage RLS user_id フォルダに保存)
    ↓
  ★ 提案 1 の自動分析パイプラインに通す(★ DRY)
    ↓
  items INSERT(caption に [hair] 等 + source_url に元 URL)
    ↓
  返却 {item: MoodboardItemRow}
```

### 3.2 ★ 対応プラットフォーム(MVP)

| プラットフォーム | host | 取得方法 |
|---|---|---|
| Pinterest | `pinterest.com` / `pin.it` | OpenGraph og:image |
| Instagram | `instagram.com` | OpenGraph(★ 公開投稿のみ・ログイン必須投稿は失敗)|
| Vogue | `vogue.com` / `vogue.co.jp` | OpenGraph |
| 一般 web | `*`(allowlist 外)| × 拒否(MVP)|
| 直接画像 URL | `*.jpg / .png / .webp` | そのまま download |

★ MVP allowlist:**pinterest.com / pin.it / instagram.com / vogue.com / vogue.co.jp**(+ 将来追加可)

### 3.3 ★ SSRF 防止(★ 最重要)

```typescript
// 概念設計(実装時詳細化)
async function safeFetch(url: string): Promise<Response> {
  const parsed = new URL(url);

  // 1. allowlist check
  const ALLOWED_HOSTS = ["pinterest.com", "pin.it", "instagram.com", "vogue.com", "vogue.co.jp"];
  if (!isAllowedHost(parsed.host)) throw new Error("対応していないプラットフォームです");

  // 2. private IP 拒否(host が IP の場合 + リダイレクト先 IP)
  if (isPrivateIp(parsed.host)) throw new Error("プライベート IP は使用できません");

  // 3. https 強制
  if (parsed.protocol !== "https:") throw new Error("https URL のみ対応");

  // 4. fetch with timeout + redirect 制限
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  const res = await fetch(url, {
    signal: controller.signal,
    redirect: "follow",
    // ★ Next.js 14 では fetch options で redirect 制限が直接できないため
    //   res.url を最終確認 → 最終 URL も allowlist check
  });
  clearTimeout(timeoutId);

  // 5. 最終 URL 再検証(redirect 後)
  const finalUrl = new URL(res.url);
  if (!isAllowedHost(finalUrl.host)) throw new Error("リダイレクト先が対応外");

  // 6. content size 制限
  const contentLength = res.headers.get("content-length");
  if (contentLength !== null && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
    throw new Error("ファイルサイズが大きすぎます");
  }

  return res;
}
```

### 3.4 UX

```
「URL から追加」ボタンタップ
  ↓
URL 入力モーダル(autoFocus・「Pinterest / Instagram / Vogue の URL を貼り付け」placeholder)
  ↓
paste & 確定 → 「取得中...」(5-10 秒)
  ↓
items に画像 + 自動分析結果出現(★ 提案 1 と同じ)
  ↓
★ ユーザー: Vogue 観察 → 良い画像見つける → URL コピー → MB ペースト → 完了
```

### 3.5 ★ 法的考慮(著作権)

| 観点 | 方針 |
|---|---|
| 個人 MB 用途(非公開) | ★ fair use 範囲(私的利用)|
| 公開(`is_public=true`) | ★ ユーザー責任(将来規約で明示)|
| MVP スコープ | ★ **個人 MB(非公開)用途として実装** |
| 規約整備 | 将来(Phase 2 後ゲート前 or MVP リリース前)|
| 二次配布警告 | UI で「公開時は著作権に注意」notice 推奨(将来)|

★ MVP では **個人 MB 非公開** を default として運用可。

---

## 4. ★ v2 との関係(★ 完全保持)

### 4.1 v2 完全保持(★ 削除なし)

| v2 機能 | v3 での扱い |
|---|---|
| 手動カテゴリ select(画像追加モーダル) | ★ **保持**(「カテゴリを手動選択」モードとして残す) |
| caption 編集モーダル(category select) | ★ **保持**(自動分析結果の編集用)|
| 必須要素 8 進捗バー / チェックリスト | ★ **保持**(自動分析でも進捗判定される)|
| items Card カテゴリバッジ | ★ **保持**(同上)|
| 撮影前 CTA(8/8)| ★ **保持** |
| description 編集モーダル + 例文 | ★ **保持** |
| MB メタ編集 / 削除 / 一覧画面 | ★ **保持** |

### 4.2 v3 で追加する機能

| 機能 | 説明 |
|---|---|
| 画像自動分析(主機能)| Vision LLM でカテゴリ + caption + 色 自動判定 |
| URL から追加(別経路)| Pinterest / Instagram / Vogue URL → og:image → 自動分析 |
| 「自動分析(beta)」チェックボックス | default ON・OFF で v2 手動モード |
| 「分析中...」表示 | 2-10 秒の UX 改善 |

### 4.3 ★ DRY by design

提案 2 は ★ **提案 1 のパイプラインを完全流用**(URL fetch → Storage upload → 自動分析)。実装時の重複コードゼロ。

---

## 5. ★ 段階3-B v3 規模見当

### 5.1 新規ファイル

| ファイル | 内容 | 規模 |
|---|---|---|
| `lib/utils/vision-analyzer.ts` | Claude Vision API 呼出 + prompt template + JSON 検証 | +80-120 行 |
| `lib/utils/og-image-extractor.ts` | OpenGraph meta タグ抽出 + SSRF 防止 helper | +80-120 行 |
| `app/api/moodboards/[id]/items/analyze/route.ts` | POST 画像自動分析(Vision)→ items INSERT | +200-300 行 |
| `app/api/moodboards/[id]/items/from-url/route.ts` | POST URL から追加(fetch + og + 自動分析)→ items INSERT | +200-300 行 |

### 5.2 改訂ファイル(★ v2 既存実装は ★ **削除なし・追加のみ**)

| ファイル | 内容 | 規模 |
|---|---|---|
| `app/(app)/moodboard/[id]/page.tsx`(910 行)| 「自動分析」チェックボックス + 「URL から追加」ボタン + 「分析中...」表示 + UrlAddModal | +120-180 行 |
| `types/moodboard.ts`(59 行)| VisionAnalysisResult 型 + UrlAddInput 型 | +20-30 行 |

### 5.3 合計

★ **+700-1,050 行** / ★ **1-2 セッション**(★ 1 セッション完走はギリギリ)

---

## 6. ★ 実装計画(★ 段階分割推奨・2 セッション)

### 6.1 セッション 1: API 層(Step 1-4)

| Step | 内容 | 規模 | 時間 |
|---|---|---|---|
| 1 | `lib/utils/vision-analyzer.ts` 新規 | +80-120 | 20-30 分 |
| 2 | `lib/utils/og-image-extractor.ts` 新規 | +80-120 | 20-30 分 |
| 3 | `/api/moodboards/[id]/items/analyze/route.ts` 新規 | +200-300 | 40-60 分 |
| 4 | `/api/moodboards/[id]/items/from-url/route.ts` 新規 | +200-300 | 40-60 分 |
| 5 | `types/moodboard.ts` 拡張 | +20-30 | 5-10 分 |
| 検証 + commit | tsc + 399 PASS + commit | — | 5-10 分 |
| **合計** | | **+580-870 行** | **130-200 分** |

### 6.2 セッション 2: UI 層(Step 6-7)

| Step | 内容 | 規模 | 時間 |
|---|---|---|---|
| 6 | `app/(app)/moodboard/[id]/page.tsx` 改訂(UI 統合)| +120-180 | 40-60 分 |
| 7 | 実機 verify + 微調整 + commit | — | 20-30 分 |
| **合計** | | **+120-180 行** | **60-90 分** |

→ ★ 段階分割で品質確保(1 セッション完走は ★ ギリギリのため非推奨)

---

## 7. ★ Phase 2 後ゲート(Sprint D)との関係

### 7.1 影響

| 項目 | 影響 |
|---|---|
| ③ コスト管理 | ★ **Vision API 月額追加**(MVP $3 / スケール $600)→ Sprint B-3 案 P1 月 N 回上限を **Vision にも適用** 検討 |
| ③ プライバシー専章 | ★ **外部 URL fetch 追加**(SSRF 防止必須)→ 6 章「顔写真」とは別軸の新リスク追加 |
| Sprint D 判断 6(リアル試着 GO)| ★ **不変**(Vision は MB 用途・リアル試着とは別軸) |

### 7.2 ★ MVP リリース条件の引き上げ

| 観点 | v2 段階(現状)| v3 段階(MVP リリース条件)|
|---|---|---|
| MB CRUD | ✅ | ✅ |
| 必須要素 8 可視化 | ✅(手動) | ✅(自動) |
| 外部観察フロー | × placeholder | ✅ URL ペースト |
| Sprint D 後ゲート | コスト v2 で評価 | ★ **コスト v3 で評価**(Vision 含) |

→ ★ ★ **v3 完成が MVP リリース条件**(オーナー宣言)→ Sprint D 厳格化

---

## 8. ★ 既存達成への影響評価(★ コード 0 変更・全保持)

| 達成項目 | 想定影響 |
|---|---|
| 1.5b 完成形 / race fix v2 / L4-A / A-2 / A-3 / MVP-1c / A-4 / A-10 / A-6 / A-6b / A-5 / A-9 / Sprint B-1 / B-2 / B-3 / C-1 / C-2 段階1/2 / 段階3-A / 段階3-B / v2 改訂(`1e79de8`) | **0**(コード 0 変更)|
| リグレッションテスト | **399 PASS 維持** |
| 既存 v1 各 intent API + UI | **0** |
| 既存 migrations(001-026)| **0**(★ スキーマ変更なし)|
| `lib/storage.ts` / `lib/utils/image-pipeline.ts` / `lib/utils/moodboard-essentials.ts` | **0**(参照 only)|
| `types/moodboard.ts` / 既存 API 4 route / 段階3-A 一覧 / 段階3-B v2 実装 | **0**(参照 only)|
| 既存 Vision 先例(`analyze-product-image`) | **0**(参照 only / 同型作法で v3 新規実装)|
| 本体 `ac834bb` 6 章 / 7 章 / 判断 6 | **diff 0 行** |
| 本体 / doc7 / 最終ビジョン / 整合性点検 / ロードマップ / コスト試算 / 各設計案 | **diff 0 行** |
| 既存設計判断 1-10 | **文言不変** |

---

## 9. ★ リスク・懸念

### 9.1 Vision API コスト
- MVP: 月数ドル(誤差)
- スケール後: Sprint B-3 案 P1 適用検討(月 N 回上限)
- ★ Phase 2 後ゲート(Sprint D)で再評価

### 9.2 自動分析精度
- LLM 誤判定可
- ★ fallback 必須(v2 手動 select 完全保持)
- ユーザー編集可(caption 編集モーダル v2 既存流用)
- ★ ★ オーナーマインド「しっくりこなかったら後で変えれる」を UX に反映

### 9.3 外部 URL fetch のセキュリティ
- SSRF 防止 ★ 必須(本 doc §3.3)
- allowlist 厳格(MVP は 5 host のみ)
- private IP 拒否
- timeout / max size 制限
- redirect 先再検証

### 9.4 著作権
- 個人 MB 非公開なら fair use
- public 化はユーザー責任(将来規約)
- MVP は **個人 MB 非公開** default

### 9.5 実装規模
- 1 セッション ギリギリ
- ★ **2 セッション分割推奨**(API 層 + UI 層)

---

## 10. 推奨案(★ 結論)

### 10.1 推奨実装方針

- ★ 本工程 = 設計調査 doc 1 件のみ origin 保全
- ★ **提案 1 + 提案 2 採用**(MVP リリース条件)
- ★ 段階3-B v3 実装 = ★ **2 セッション分割**(API 層 + UI 層)
- ★ v2 完全保持(手動 select は補助手段として永続)
- ★ 既存 Vision 先例(`analyze-product-image`)を同型作法で流用 = DRY by design

### 10.2 ★ 5 項目 結論サマリ

| 項目 | 結論 |
|---|---|
| 提案 1 アーキテクチャ | ★ Claude Vision(claude-sonnet-4-6)+ prompt + fallback(v2 手動 select)+ 既存 `analyze-product-image` 同型作法流用 |
| 提案 2 アーキテクチャ | ★ OpenGraph + SSRF(allowlist 5 host + private IP 拒否 + timeout 10s + max 10MB)+ 提案 1 パイプライン流用 |
| v2 完全保持 | ★ 7 機能 全保持(手動 select / caption 編集 / 進捗バー / チェックリスト / バッジ / 撮影前 CTA / description 例文)|
| 規模 | ★ +700-1,050 行 / 2 セッション(API 層 130-200 分 + UI 層 60-90 分)|
| コスト試算 | ★ MVP $3/月(100 ユーザー)/ スケール $60-600/月(1k-10k ユーザー)→ Sprint B-3 案 P1 適用検討 |
| SSRF / 著作権 | ★ allowlist + private IP 拒否 + redirect 再検証 / 個人 MB 非公開 default |
| Phase 2 後ゲート影響 | ★ コスト評価 v3 で実施 / プライバシー 6 章は不変(顔写真とは別軸) |

### 10.3 ★ 次工程

- 本 commit(設計 doc 1 件)→ オーナー判断 → origin 保全
- セッション 1: API 層(Step 1-5・+580-870 行 / 130-200 分)
- セッション 2: UI 層(Step 6-7・+120-180 行 / 60-90 分)
- → 段階3-B v3 完遂 → 段階3-C(公開ルート)→ 段階3-D(MoodboardPickerModal)→ 段階3-E(InputAttachments)
- → Sprint C-2 段階3 完遂 → Sprint C-3 MB→coordinate 連鎖 → C-4 完成 → ★ **MVP リリース可能状態**

---

## 11. 結論

| 観点 | 結論 |
|---|---|
| ★ 段階3-B v3 革新設計 判断 | **★ 提案 1 + 2 採用**(★ MVP リリース条件・v2 完全保持・既存 Vision 先例流用)|
| 規模 | **+500-600 行 / 60-90 分**(本 commit・設計のみ)+ 段階3-B v3 実装 +700-1,050 行 / 2 セッション(別工程)|
| 既存達成保持 | コード 0 変更で **全保持**(399 PASS 維持・tsc EXIT 0 維持)|
| ★ オーナー宣言への応答 | ★ 「使ってくれた人が本当に使える」= 画像入れるだけで完了 + URL ペーストで Vogue 観察フロー完結 |
| ★ MVP リリース条件 | ★ **引き上げ済**(v2 完了 → v3 完了)|
| ★ 段階3-B v3 青写真 | ★ **完遂**(Vision + OG + SSRF + コスト + 法的考慮 全て設計済) |
| ★ 次工程 | オーナー判断 → 本 commit origin 保全 → セッション 1(API 層)→ セッション 2(UI 層) |
| 不可侵 | 本体 6 章 / 7 章 / 判断 6 / コスト試算 / 整合性点検 / ロードマップ / 各設計案 / 既存設計判断 1-10 / 既存 migrations / API 4 route / types / 段階3-A 一覧 / 段階3-B v2 実装(`1e79de8`) ★ **全不変** |

→ ★ **段階3-B v3 革新設計青写真 完遂**(「魔法のような体験」への引き上げ・実装可能粒度確立)

---

## 12. 制約遵守チェックリスト

- [x] 新規 docs ファイル 1 件のみ(本 doc)
- [x] 本体 `ac834bb` / コード(app/api/lib/scripts/package.json/tsconfig.json)/ doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` / 各設計案(B-2 / B-3 / C-1 / C-2 段階1/2/3 ビジョン拡張 / v2 改訂)/ 他 docs **全 0 変更**
- [x] 既存 migrations(001-026) **不変**
- [x] 既存 API 4 route / types/moodboard.ts / 段階3-A 一覧 / 段階3-B v2 実装(`1e79de8`) **不変**
- [x] 既存 Vision 先例(`analyze-product-image`) **不変**(参照 only / v3 で同型作法流用)
- [x] 本体 6 章 / 7 章 / 判断 6 diff 0 行
- [x] 既存設計判断 1-10 文言不変
- [x] view + grep + 静的解析のみ・実装なし
- [x] tsc EXIT 0 維持(本 doc は markdown のみ・コード 0 変更)
- [x] リグレッションテスト 399 PASS 維持(本工程はコード 0 変更)
- [x] 実装は ★ 別工程(本 doc では実施しない)
- [x] commit はあり / push はなし
