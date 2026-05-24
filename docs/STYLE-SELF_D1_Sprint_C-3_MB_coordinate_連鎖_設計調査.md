# STYLE-SELF D1 — Sprint C-3 MB→coordinate 連鎖 設計調査(prompt 注入配線 + 撮影前 CTA 本配線・★ 実装は別工程)

- 作成日: 2026-05-24
- 起点 HEAD: `4343a96`(Sprint C-2 完遂・段階3-D + 3-E・origin 保全済・clean / 399 PASS / tsc EXIT 0)
- 本 doc の役割: Sprint C-2 完遂後、★ **MB の内容を段階 B coordinate に prompt 注入** + **撮影前 CTA 本配線** の設計(★ **コード 0 変更・実装は別工程**)
- 上位連結:
  - Sprint C-1 設計案 [§7 MB → coordinate 連鎖](./STYLE-SELF_D1_Sprint_C-1_ムードボード設計調査.md)(`60b8d87`)= 規模 +130-230 行 / 1 セッション 試算
  - Sprint C-2 段階3-B v3 設計案 [§7 Sprint C-3 連鎖接続](./STYLE-SELF_D1_Sprint_C-2_段階3-B_v3_革新設計_調査.md)(`cd1b01a`)= prompt 注入例 提示
  - 段階3-B v3 実装 [`970ecbe`](../app/\(app\)/moodboard/[id]/page.tsx) Step 7 撮影前 CTA(disabled・「Sprint C-3 で配線予定」placeholder)
  - 段階3-E 実装 [`4343a96`](../app/\(app\)/ai/page.tsx) MoodboardPickerModal onPick(MVP: MB 名のみテキスト挿入)

---

## 1. 背景

### 1.1 Sprint C-3 の位置づけ

Sprint C-2 完遂(`4343a96`)で **Phase 2 ムードボード UI 完全完成** を達成。残るは「**MB の内容を段階 B coordinate に prompt 注入する配線**」のみ。これにより:
- ChatPage で MB を attach → MB の必須要素 8 + コンセプト + items の caption が prompt に注入 → LLM がコーデ提案
- 段階3-B v3 「撮影前 CTA」(8/8 達成時)→ 「このムードボードで撮影する」ボタン → 直接 ChatPage に遷移して coordinate 呼出

★ 「魔法のような体験」と chat の連携が完成する **MVP リリース前の最後の機能実装**。

### 1.2 ★ 「コンセプト → 服」の正解パターン実現

ビジョン文書「服 → コンセプト NG / コンセプト → 服 OK」がワークフローとして実現:
```
ユーザー: MB 作成(コンセプト + 必須要素 8 構造化)
   ↓ 撮影前 CTA(8/8 達成時)
ChatPage: 「『○○』のムードボードに合うコーデを提案して」+ MB content prompt
   ↓ 段階 B coordinate LLM
LLM: コンセプトに沿った服を提案(+ 不足要素を補完)
```

### 1.3 不可侵境界線(★ 厳守 / Sprint C-2 と同型)

1. 本体 `ac834bb` / コード / doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` / 各設計案(B-2 / B-3 / C-1 / C-2 段階1-3 全て)/ 既存設計判断 1-10 ★ **全 0 変更**
2. 既存 migrations(001-026)/ 既存 API 7 route(MB CRUD 4 + items 系 3)/ types/moodboard.ts 既存型 / 段階3-A/3-B/3-C/3-D/3-E 既存実装 ★ **不変**(★ ただし MoodboardPickerModal は **onPick シグネチャ拡張のみ仕様明示の改訂**)
3. ③ プライバシー専章 / ③ コスト管理 / Phase 2 後ゲート ★ **diff 0 行**
4. リグレッションテスト **399 PASS 維持**(本工程はコード 0 変更)
5. tsc EXIT 0 維持
6. ★ 実装は別工程(本 doc では実施しない)

---

## 2. ★ Sprint C-3 のスコープ

### 2.1 含むもの(★ 本 Sprint C-3)

| # | 機能 | 規模 |
|---|---|---|
| 1 | `buildMoodboardPrompt(mb)` クライアント側 helper | +50-80 行 |
| 2 | `MoodboardPickerModal` onPick シグネチャ強化(text → MoodboardWithItems)| +30-50 行 |
| 3 | ChatPage 統合(MB content prompt 注入) | +10-20 行 |
| 4 | 撮影前 CTA 本配線(disabled → router.push)| +20-30 行 |
| 5 | ChatPage URL param 受け取り(`?mb_prompt=`)| +10-15 行 |
| 6 | types/moodboard.ts(onPick 型拡張)| +5-10 行 |
| **合計** | | **+125-205 行 / 1 セッション**(Sprint C-1 §7 試算 +130-230 行 範囲内) |

### 2.2 含まないもの(★ 別 Sprint)

| 領域 | Sprint |
|---|---|
| リアル試着 / 顔写真 | Sprint D 判断 6 / Sprint E |
| 退行点検 / リグレッション拡張 | Sprint C-4 |
| コスト v3 再評価(Vision + Sprint B-3 案 P1) | Sprint D |
| ロードマップ更新(C-3 完遂マーク等) | Step 3 別 commit(オーナー判断) |

---

## 3. ★ 既存資産の実物確認

### 3.1 既存 5 intent 段階 B 構造(`app/api/ai/stylist-chat/route.ts`)

- 既存 `coordinate` intent 分岐(MVP-1c `182c25b` 起源・A-6 で安定化)
- `fetchCoordinateContext()`(worldview + body_profile + wardrobe 3 並列 SELECT)
- KOS 共通注入(A-10・`566e3b2`)
- system prompt + user message 構築 → Claude Haiku 4.5
- ★ **本 Sprint C-3 では route.ts は ★ 変更しない**(クライアント側 prompt 構築方式採用)

### 3.2 MB attach の現状(`4343a96`)

```typescript
// ChatPage(app/(app)/ai/page.tsx L391-397):
<MoodboardPickerModal
  isOpen={isMbOpen}
  onClose={() => setIsMbOpen(false)}
  onPick={(insertText) => setText((cur) => cur ? `${cur} ${insertText}` : insertText)}
/>
```

```typescript
// MoodboardPickerModal(components/chat/MoodboardPickerModal.tsx):
function handlePick(mb: MoodboardRow): void {
  // ★ MVP: テキスト挿入のみ
  const text = `「${mb.name}」のムードボードに合うコーデを提案して`;
  onPick(text);
  onClose();
}
```

→ ★ Sprint C-3 では `handlePick` を強化(MB 詳細取得 + buildMoodboardPrompt)。

### 3.3 撮影前 CTA の現状(`970ecbe` 段階3-B v3 page.tsx Step 7)

```typescript
{coverage.size === 8 && (
  <div className="border border-gray-800 bg-gray-50 rounded-2xl ...">
    <p>✨ 必須要素 8/8 カバー完了!</p>
    <button disabled>このムードボードで撮影する</button>
    <p>(Sprint C-3 で配線予定)</p>
  </div>
)}
```

→ ★ Sprint C-3 では `disabled` を外し `onClick={handleShoot}` で ChatPage に遷移。

### 3.4 A-6 / A-6b 4 作法(★ 本 Sprint C-3 で踏襲)

| 作法 | A-6 / A-6b 適用 | Sprint C-3 適用 |
|---|---|---|
| 段階 A プロンプト修正(`2ef689e`)| intent 分類 narrow / broad の精緻化 | ★ **不要**(MB attach は coordinate intent への自然延長・新 intent 不要)|
| MVP-1c fetcher Promise.all(`182c25b`)| 複数 SELECT 並列 | ★ **不要**(MB 詳細取得は単一 API)|
| A-4 三重防御 構造証明(`66dd5bb`)| 列絞り SELECT で worldview_tags 遮断 | ★ **必須**(`buildMoodboardPrompt` で worldview_tags / keywords を含めない)|
| A-10 KOS 共通注入(`566e3b2`)| stylist-chat に KOS context 注入 | ★ **不変**(既存 KOS 注入はそのまま・MB prompt は ★ **追加** 注入) |

---

## 4. ★ MB → prompt 構築設計

### 4.1 `lib/prompts/moodboard-prompt.ts` 新規(+50-80 行)

```typescript
// D1 Sprint C-3 MB → coordinate 連鎖 prompt 構築
//
// 設計: docs/STYLE-SELF_D1_Sprint_C-3_MB_coordinate_連鎖_設計調査.md §4
// クライアント側構築(★ サーバー prompt は不変・既存 route.ts に influence なし)
// 三重防御 1: worldview_tags / worldview_keywords を ★ 含めない(構造遮断)

import type { MoodboardWithItems } from "@/types/moodboard";
import {
  ESSENTIAL_CATEGORIES,
  ESSENTIAL_LABELS,
  detectEssentials,
  extractCategory,
  stripCategoryPrefix,
} from "@/lib/utils/moodboard-essentials";

export function buildMoodboardPrompt(mb: MoodboardWithItems): string {
  const coverage = detectEssentials(mb.description, mb.items);

  // 必須要素 8 hit/miss を明示
  const essentialsLines = ESSENTIAL_CATEGORIES.map((c) => {
    const label = ESSENTIAL_LABELS[c];
    const covered = coverage.has(c);
    if (covered) {
      // items から該当 category のメモを抽出(複数あれば最初の 1 件)
      const hit = mb.items.find((it) => extractCategory(it.caption) === c);
      const hint = hit !== undefined ? stripCategoryPrefix(hit.caption) : "(description から推定)";
      return `- ${label}: ${hint}`;
    }
    return `- ${label}: 不明(コンセプトから推定してください)`;
  });

  // items の参考メモ(カテゴリ別整理)
  const itemNotes = mb.items
    .filter((it) => it.caption.trim() !== "")
    .map((it, i) => `  ${i + 1}. ${it.caption}`);

  const lines: string[] = [];
  lines.push("[ムードボード]");
  lines.push(`テーマ: ${mb.name}`);
  if (mb.description.trim() !== "") {
    lines.push(`コンセプト: ${mb.description}`);
  }
  if (mb.worldview_name !== null && mb.worldview_name !== "") {
    lines.push(`世界観: ${mb.worldview_name}`);  // ★ 日本語名のみ・worldview_tags は含めない(構造遮断)
  }
  lines.push("");
  lines.push(`[必須要素カバー: ${coverage.size}/8]`);
  lines.push(...essentialsLines);
  if (itemNotes.length > 0) {
    lines.push("");
    lines.push("[参考画像メモ]");
    lines.push(...itemNotes);
  }
  lines.push("");
  lines.push("このムードボードに合うコーデを提案してください。");
  lines.push("不明な要素はコンセプトから推定して補完してください。");

  return lines.join("\n");
}
```

### 4.2 ★ 三重防御維持(構造遮断)

- `mb.worldview_tags` / `mb.worldview_keywords` を ★ **prompt に含めない**(三重防御 1)
- `mb.worldview_name`(日本語名)のみ使用
- `items[].caption` は `[category]` プレフィックス付き(英語スラッグではなく内部分類用ラベル)
- 出口フィルタ: ChatPage 既存 `stripCanonicalSlugs` で reply は引き続き保護

### 4.3 例 prompt 出力

```
[ムードボード]
テーマ: 孤独な富裕層の夕方
コンセプト: 25 歳富裕旅行者 / 海岸 / 夕方の光 / カラー: 濃紺・白・砂色
世界観: ミニマル

[必須要素カバー: 7/8]
- モデル: 25 歳富裕旅行者
- ライフスタイル: 富裕・孤独
- ヘア: 濡れ髪のラフな束ね
- メイク: 不明(コンセプトから推定してください)
- 服: 不明(コンセプトから推定してください)
- 光: 夕方の柔らかい逆光
- ロケーション: 海岸の白砂
- 色: 濃紺・白・砂色

[参考画像メモ]
  1. [hair] 濡れ髪のラフな束ね
  2. [light] 夕方の柔らかい逆光
  3. [location] 海岸の白砂

このムードボードに合うコーデを提案してください。
不明な要素はコンセプトから推定して補完してください。
```

---

## 5. ★ MoodboardPickerModal onPick 強化

### 5.1 onPick シグネチャ拡張

```typescript
// 旧(段階3-D・MVP):
onPick: (insertText: string) => void;

// 新(Sprint C-3):
onPick: (mb: MoodboardWithItems) => void;
```

### 5.2 handlePick 改訂

```typescript
async function handlePick(mbSummary: MoodboardRow): Promise<void> {
  // ★ MB 一覧表示時は概要(MoodboardRow)・選択時に詳細(MoodboardWithItems)取得
  try {
    const res = await fetch(`/api/moodboards/${mbSummary.id}`);
    if (!res.ok) throw new Error("MB 詳細取得失敗");
    const data = (await res.json()) as { moodboard: MoodboardWithItems };
    onPick(data.moodboard);
    onClose();
  } catch (err) {
    // fallback: 概要のみで onPick(★ 必須要素 0 件で prompt 生成)
    onPick({ ...mbSummary, items: [] } as MoodboardWithItems);
    onClose();
  }
}
```

### 5.3 ★ API 経路

- **一覧表示時**: 既存 `GET /api/moodboards`(段階2-B・概要 list)
- **選択時詳細取得**: 既存 `GET /api/moodboards/[id]`(段階2-C・items 含む)
- ★ 既存 API のまま使用 = 新規 route 不要 ✓

---

## 6. ★ ChatPage 統合設計

### 6.1 onPick callback の強化

```typescript
// app/(app)/ai/page.tsx 改訂(+10-20 行):

import { buildMoodboardPrompt } from "@/lib/prompts/moodboard-prompt";
import type { MoodboardWithItems } from "@/types/moodboard";

// ...

function handleMbPick(mb: MoodboardWithItems): void {
  const prompt = buildMoodboardPrompt(mb);
  setText((cur) => cur ? `${cur}\n\n${prompt}` : prompt);
}

// JSX:
<MoodboardPickerModal
  isOpen={isMbOpen}
  onClose={() => setIsMbOpen(false)}
  onPick={handleMbPick}  // ★ MoodboardWithItems 受け取り
/>
```

### 6.2 URL param 受け取り(撮影前 CTA からの遷移用)

```typescript
// app/(app)/ai/page.tsx に追加(+10-15 行):

import { useSearchParams } from "next/navigation";

const searchParams = useSearchParams();

useEffect(() => {
  const mbPrompt = searchParams.get("mb_prompt");
  if (mbPrompt !== null && mbPrompt !== "" && text === "") {
    // ★ 初期 text が空 + URL に mb_prompt → 自動挿入
    setText(decodeURIComponent(mbPrompt));
    // ★ URL から param 削除(リロード時に再挿入を防ぐ)
    window.history.replaceState(null, "", "/ai");
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [searchParams]);
```

### 6.3 ★ サーバー側変更不要(クライアント側構築方式)

- prompt は ★ クライアント側で構築 → `text` state に挿入 → 既存送信フローで `/api/ai/stylist-chat` へ送られる
- API 側は ★ 既存処理のまま(prompt がそのまま LLM に渡る)
- ★ **route.ts / stylist-chat prompt 改訂不要**

**メリット**:
- ★ 既存 5 intent reply 経路を ★ **一切変更しない**
- 三重防御維持(既存 5 層多段防御そのまま)
- リグレッションテスト 399 PASS 維持(stylist-chat API 経路 不変)

**デメリット(MVP 許容)**:
- prompt がユーザー画面の textarea に見える = 編集可
- ★ ただし **MVP では透明性が良い**(ユーザーが prompt 確認できる + 必要なら微調整可)
- Phase 3 拡張時にサーバー側構造化可

---

## 7. ★ 撮影前 CTA 本配線設計

### 7.1 段階3-B v3 page.tsx Step 7 改訂(+20-30 行)

```typescript
// 旧(段階3-B v3 970ecbe):
{coverage.size === 8 && (
  <div className="...">
    <p>✨ 必須要素 8/8 カバー完了!</p>
    <button disabled>このムードボードで撮影する</button>
    <p>(Sprint C-3 で配線予定)</p>
  </div>
)}

// 新(Sprint C-3):
{coverage.size === 8 && (
  <div className="...">
    <p>✨ 必須要素 8/8 カバー完了!</p>
    <button
      type="button"
      onClick={handleShoot}
      className="..."  // disabled 解除
    >
      このムードボードで撮影する
    </button>
  </div>
)}

function handleShoot(): void {
  const prompt = buildMoodboardPrompt(mb);
  const encoded = encodeURIComponent(prompt);
  router.push(`/ai?mb_prompt=${encoded}`);
}
```

### 7.2 ★ 遷移後の挙動

1. `/moodboard/[id]` 詳細画面 → 「このムードボードで撮影する」ボタンタップ
2. `router.push("/ai?mb_prompt=<encoded>")`
3. ChatPage 表示 + `useEffect` で URL param 検出
4. `setText(decoded prompt)` で textarea に自動挿入
5. ユーザー: 「送信」ボタンタップ → 既存 stylist-chat フロー → coordinate 提案

### 7.3 ★ URL param 長さ制限

- items 20 枚 × caption 50 字 = ~1000 字 + 必須要素 8 メモ + コンセプト = ~2000 字
- encodeURIComponent で 2-3 倍 = ~4-6 KB
- ブラウザ URL 上限(2048 文字)を ★ **超える可能性**

### 7.4 ★ URL 制限への対策(★ MVP 推奨案)

| 案 | 内容 | 推奨 |
|---|---|---|
| 案 a | URL param で送る(現状)| ★ 短い MB なら OK・長い MB で失敗リスク |
| **案 b** | ★ **sessionStorage で受け渡し**(`sessionStorage.setItem("mb_prompt", prompt)` → `/ai` で読出 → 削除) | ★ **推奨**(長さ制限なし・同一タブ内のみ・タブ閉じれば消える)|
| 案 c | サーバー API 経由(POST /api/chat/attach-mb)| 過剰設計(MVP には重い)|

★ **推奨: 案 b**(sessionStorage 経由・shyな実装で URL を汚さない)

```typescript
// 段階3-B v3 page.tsx:
function handleShoot(): void {
  const prompt = buildMoodboardPrompt(mb);
  sessionStorage.setItem("mb_prompt", prompt);
  router.push("/ai");
}

// ChatPage useEffect:
useEffect(() => {
  const stored = sessionStorage.getItem("mb_prompt");
  if (stored !== null && stored !== "" && text === "") {
    setText(stored);
    sessionStorage.removeItem("mb_prompt");
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

---

## 8. ★ 実装計画(★ 7 Step・別工程)

| Step | 内容 | 規模 | 時間 |
|---|---|---|---|
| 1 | `lib/prompts/moodboard-prompt.ts` 新規(`buildMoodboardPrompt`)| +50-80 | 15-20 分 |
| 2 | `components/chat/MoodboardPickerModal.tsx` onPick 強化(MoodboardWithItems 化 + 詳細取得)| +30-50 | 15-20 分 |
| 3 | `app/(app)/ai/page.tsx` 統合(`handleMbPick` + sessionStorage useEffect)| +25-35 | 15-20 分 |
| 4 | `app/(app)/moodboard/[id]/page.tsx` Step 7 撮影前 CTA 本配線(disabled 解除 + sessionStorage + router.push)| +20-30 | 10-15 分 |
| 5 | `types/moodboard.ts`(onPick 型・任意・既存型流用可)| 0-10 | 0-5 分 |
| 6 | tsc + 399 PASS + 実機 verify(任意) | — | 5-10 分 |
| 7 | commit(push なし) | — | 3-5 分 |
| **合計** | | **+125-205 行** | **63-95 分**(★ 1 セッション完走可) |

→ Sprint C-1 §7 試算(+130-230 行 / 1 セッション)範囲内 ✓

---

## 9. ★ A-6 / A-6b 4 作法踏襲

| 作法 | 適用 |
|---|---|
| 段階 A プロンプト修正 | ★ **不要**(MB attach は coordinate intent への自然延長・既存分類のまま)|
| MVP-1c fetcher Promise.all | ★ **不要**(MB 詳細取得は単一 API・並列化不要)|
| A-4 三重防御 構造証明 | ★ **必須**(`buildMoodboardPrompt` で worldview_tags / worldview_keywords を含めない・worldview_name のみ使用) |
| A-10 KOS 共通注入 | ★ **不変**(既存 KOS 注入そのまま・MB prompt は **追加** 注入) |

---

## 10. ★ 既存達成への影響評価(★ コード 0 変更・全保持)

| 達成項目 | 想定影響 |
|---|---|
| 1.5b 完成形 / race fix v2 / L4-A / A-2 / A-3 / MVP-1c / A-4 / A-10 / A-6 / A-6b / A-5 / A-9 / Sprint B-1 / B-2 / B-3 / C-1 / C-2 段階1-3 全完遂(`4343a96`)| **0**(コード 0 変更)|
| リグレッションテスト | **399 PASS 維持** |
| 既存 v1 各 intent API + UI | **0** |
| 既存 migrations(001-026)| **0**(★ スキーマ変更なし)|
| 既存 API 7 route(MB CRUD 4 + items POST/analyze/from-url + items DELETE/PATCH)| **0**(★ サーバー側変更なし) |
| `lib/storage.ts` / `lib/utils/image-pipeline.ts` / `lib/utils/moodboard-essentials.ts` / `lib/utils/vision-analyzer.ts` / `lib/utils/og-image-extractor.ts` | **0**(参照 only / `moodboard-essentials.ts` は `buildMoodboardPrompt` から流用)|
| 段階3-A 一覧 / 段階3-B 詳細(1081 行)/ 段階3-C 公開(240 行)| **0**(段階3-B のみ Step 7 改訂・+20-30 行)|
| MoodboardPickerModal / InputAttachments / ChatPage | ★ MoodboardPickerModal onPick シグネチャ拡張 / ChatPage `handleMbPick` + useEffect 追加 / InputAttachments ★ **不変** |
| stylist-chat route + prompts | ★ **0**(クライアント側 prompt 構築方式)|
| 本体 `ac834bb` 6 章 / 7 章 / 判断 6 | **diff 0 行** |
| 本体 / doc7 / 最終ビジョン / 整合性点検 / ロードマップ / コスト試算 / 各設計案 | **diff 0 行** |
| 既存設計判断 1-10 | **文言不変** |

---

## 11. ★ Sprint C-4 / Sprint D との関係

| Sprint | 内容 | 本 Sprint C-3 との関係 |
|---|---|---|
| **C-4** | 完成・退行点検(全機能テスト・リグレッション 399 拡張検討)| ★ Sprint C-3 完遂後 = Phase 2 全機能動作確認 |
| **D** | Phase 2 後ゲート(コスト v3 評価 + リアル試着 GO/NO-GO)| ★ Vision API 月額 + URL fetch コスト評価 / Sprint B-3 案 P1 適用検討 |

★ Sprint C-3 完遂 → C-4 → D の順 → **MVP リリース**

---

## 12. ★ リスク

### 12.1 クライアント側 prompt 構築
- prompt がユーザー画面に見える(編集可)
- ★ **MVP 許容**(透明性が良い・将来サーバー側構造化可)

### 12.2 MB 詳細取得のレイテンシ
- 選択時に 1 API call(数百 ms)
- ★ UX 許容範囲(ローディング表示で対応)

### 12.3 prompt 長さ
- items 20 枚 + 各 caption 50 字 + 必須要素 + コンセプト = ~2000 tokens
- ★ Claude context 窓に収まる(input 200K tokens)

### 12.4 撮影前 CTA からの遷移(★ 最重要)
- URL param 長さ制限(2048 文字)を超える可能性
- ★ **対策: sessionStorage 経由**(本 doc §7.4 案 b 推奨)

### 12.5 三重防御の確認
- ★ `buildMoodboardPrompt` で worldview_tags / worldview_keywords を含めない
- ★ 既存 stripCanonicalSlugs(ChatPage + stylist-chat 出口)が引き続き保護
- → ★ **5 層多段防御維持**

---

## 13. 推奨案(★ 結論)

### 13.1 推奨実装方針

- ★ 本工程 = 設計調査 doc 1 件のみ origin 保全
- ★ **クライアント側 prompt 構築方式採用**(サーバー側変更なし・既存 5 intent reply 経路無傷)
- ★ **sessionStorage 経由 で MB attach 受け渡し**(URL param 長さ制限回避)
- ★ Sprint C-3 実装 = ★ **1 セッション完走可**(+125-205 行 / 63-95 分)
- ★ MoodboardPickerModal の onPick シグネチャのみ ★ 仕様明示の改訂(他は全保持)

### 13.2 ★ 7 項目 結論サマリ

| 項目 | 結論 |
|---|---|
| buildMoodboardPrompt 設計 | ★ 必須要素 8 hit/miss 明示 + コンセプト + items メモ + worldview_name + 「不明は LLM 補完」指示 / 三重防御 1 適用(worldview_tags 含めず)|
| MoodboardPickerModal onPick 強化 | ★ `(text) → (MoodboardWithItems)` シグネチャ拡張 + 選択時 GET /api/moodboards/[id] 詳細取得 |
| ChatPage 統合 | ★ `handleMbPick` で buildMoodboardPrompt 呼出 + textarea 挿入 + sessionStorage 受け取り useEffect |
| 撮影前 CTA 本配線 | ★ disabled 解除 + handleShoot で sessionStorage 経由 router.push("/ai") |
| サーバー側変更 | ★ **不要**(既存 stylist-chat route + prompt 全保持) |
| A-6 / A-6b 4 作法踏襲 | ★ 三重防御(構造証明)+ KOS 不変(追加注入のみ)|
| 規模 | ★ +125-205 行 / 1 セッション(Sprint C-1 §7 試算範囲内) |

### 13.3 ★ 次工程

- 本 commit(設計 doc 1 件)→ オーナー判断 → origin 保全
- 次工程: Sprint C-3 実装(★ Step 1-7・+125-205 行 / 63-95 分)
- Sprint C-3 完遂 → Sprint C-4(完成・退行点検)→ Sprint D(Phase 2 後ゲート)→ **MVP リリース**

---

## 14. 結論

| 観点 | 結論 |
|---|---|
| ★ Sprint C-3 設計判断 | **★ クライアント側 prompt 構築方式採用**(サーバー側無傷 + 既存 5 intent reply 経路 不変)|
| 規模 | **+400-500 行 / 30-45 分**(本 commit・設計のみ)+ Sprint C-3 実装 +125-205 行 / 63-95 分(別工程)|
| 既存達成保持 | コード 0 変更で **全保持**(399 PASS 維持・tsc EXIT 0 維持) |
| ★ ChatPage / stylist-chat | ★ サーバー側 **完全不変**(クライアント側のみ拡張)|
| ★ 三重防御 | ★ 維持(buildMoodboardPrompt で構造遮断 + 既存出口フィルタ流用)|
| ★ 撮影前 CTA 本配線 | ★ sessionStorage 経由(URL 長さ制限回避)|
| ★ 次工程 | オーナー判断 → 本 commit origin 保全 → Sprint C-3 実装(7 Step・1 セッション完走可)→ C-4 → D → **MVP リリース** |
| 不可侵 | 本体 6 章 / 7 章 / 判断 6 / コスト試算 / 整合性点検 / ロードマップ / 各設計案 / 既存設計判断 1-10 / 既存 migrations / API 7 route / types 既存型 / 段階3-A/3-C/3-D/3-E 既存実装 ★ **全不変**(段階3-B のみ Step 7 配線改訂) |

→ ★ **Sprint C-3 連鎖設計青写真 完遂**(MVP リリース前最後の機能実装・実装可能粒度確立)

---

## 15. 制約遵守チェックリスト

- [x] 新規 docs ファイル 1 件のみ(本 doc)
- [x] 本体 `ac834bb` / コード(app/api/lib/scripts/package.json/tsconfig.json)/ doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` / 各設計案(B-2 / B-3 / C-1 / C-2 段階1-3 全て)/ 他 docs **全 0 変更**
- [x] 既存 migrations(001-026) **不変**
- [x] 既存 API 7 route / types/moodboard.ts 既存型 / 段階3-A/3-B/3-C/3-D/3-E 既存実装 **不変**(★ Sprint C-3 実装で MoodboardPickerModal onPick + ChatPage + 段階3-B Step 7 のみ拡張・改訂は別工程)
- [x] 本体 6 章 / 7 章 / 判断 6 diff 0 行
- [x] 既存設計判断 1-10 文言不変
- [x] view + grep + 静的解析のみ・実装なし
- [x] tsc EXIT 0 維持(本 doc は markdown のみ・コード 0 変更)
- [x] リグレッションテスト 399 PASS 維持(本工程はコード 0 変更)
- [x] 実装は ★ 別工程(本 doc では実施しない)
- [x] commit はあり / push はなし
