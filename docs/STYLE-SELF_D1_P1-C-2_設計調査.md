# STYLE-SELF D1 P1-C-2 設計調査(BottomNav / OverlayFab 廃止・案 A タブなし完全チャット型)

> ★ 設計調査 doc(実装しない・本体 [STYLE-SELF_D1_実装設計.md](./STYLE-SELF_D1_実装設計.md) `ac834bb` は書き換えない)。
> 上位ロードマップ: [STYLE-SELF_D1_ビジョン完全達成_ロードマップ.md](./STYLE-SELF_D1_ビジョン完全達成_ロードマップ.md) 章 3.2 **A-2**(`fe8e15d`)
>
> 前提コミット: `fe8e15d`(origin/main・1.5b 完成形 + 安全網 + A-1 完遂 + ロードマップ)
> 投入条件: 判断 8(案 A・タブなし完全チャット型)の物理実装

---

## 1. 現状実装サマリ(実物確認結果)

### 1.1 ファイル
| ファイル | 行数 | 役割 |
|---|---|---|
| [app/(app)/layout.tsx](../app/(app)/layout.tsx) | 11 | `BottomNav` + `OverlayFab` + `DevAuthBadge` を `(app)` グループ全画面に配置 |
| [components/BottomNav.tsx](../components/BottomNav.tsx) | 58 | 3 タブ(AI / 保存 / 自分)・`/onboarding` のみ非表示・`fixed bottom-0` `z-40` |
| [components/overlay/OverlayFab.tsx](../components/overlay/OverlayFab.tsx) | 30 | 右下浮動 FAB(`fixed bottom-24 right-4` `z-40`)→ クリックで `OverlayModal` 開く |
| [components/overlay/OverlayModal.tsx](../components/overlay/OverlayModal.tsx) | 540 | D1-2b' 旧モーダル本体(対話 UI 旧版)— P1-C-1 `0fd4168` で対話ロジックは ChatPage に transfer 済 |

### 1.2 `app/(app)/layout.tsx`(現状・11 行)
```tsx
import BottomNav from "@/components/BottomNav";
import DevAuthBadge from "@/components/dev/DevAuthBadge";
import OverlayFab from "@/components/overlay/OverlayFab";

export default function AppLayout({ children }) {
  return (
    <>
      <div className="pb-20">{children}</div>  {/* pb-20 = BottomNav 分の余白 */}
      <BottomNav />
      <OverlayFab />
      <DevAuthBadge />
    </>
  );
}
```

### 1.3 `/ai/page.tsx` 内の関連参照(★ 実コード参照 0・コメントのみ)
- [app/(app)/ai/page.tsx:9](../app/(app)/ai/page.tsx#L9) — `OverlayModal.tsx (D1-2b' 483cef4)` 履歴コメント
- [app/(app)/ai/page.tsx:20](../app/(app)/ai/page.tsx#L20) — 「layout の BottomNav / OverlayFab 削除 → P1-C-2」予告コメント
- [app/(app)/ai/page.tsx:291-292](../app/(app)/ai/page.tsx#L291-L292) — `pb-20`(BottomNav 分余白)残置注記

★ ChatPage は `BottomNav` / `OverlayFab` / `OverlayModal` を **import / 描画していない**(コメントのみ)→ 削除しても動作に影響ゼロ。

---

## 2. 案 A タブなし完全チャット型 最終仕様(本体 `ac834bb` 抽出)

### 2.1 判断 8 本文([本体:166-175](./STYLE-SELF_D1_実装設計.md#L166-L175))
```
判断8: ★ 案 A 確定(2026-05-20 午後・タブなし完全チャット化)
       下部ナビ(P1-B の 3 タブ AI / 保存 / 自分)= ★ 廃止
       メイン画面 = /ai のチャット画面のみ・タブなし完全チャット型
       補助機能(保存 / 自分 / クローゼット / 設定)= 右上メニュー [≡] + チャットコマンド
       チャットコマンド = D1-1 intent ルーター + D1-2a navigate-map を ★ そのまま転用
       既存資産は全て到達可(到達マップ:本ドキュメント 4.4 参照・迷子ゼロ)
       ★ /u/[id] /p/[id] 公開ページは public ルートグループ独立で BottomNav 撤去の影響ゼロ
```

### 2.2 P1-C 工程の本体記述(本体 P1-C 工程表より)
- ★ 下部ナビ廃止(判断 8):`components/BottomNav.tsx` を **撤去 or メインチャット画面では非表示化**
- 廃止: `components/overlay/OverlayFab.tsx`(削除)・`layout.tsx` の `<OverlayFab />` 1 行除去
- ★ 右上メニュー追加: `components/overlay/MenuDrawer.tsx`(新規・**P1-C-3 = A-3 で別途**)
- 既存温存: `/api/overlay/intent`(D1-1)/ `lib/overlay/navigate-map.ts`(D1-2a)完全不変
- 旧画面 URL 残置: 判断 7-2「BottomNav から外すのみ・画面 URL は残置」

### 2.3 案 A の核 = 「タブなし」
- 判断 8 表現: 「下部ナビ ★ 廃止」「タブなし完全チャット型」(条件付き非表示ではない)
- 本体 4.3 図示: 「※ 下部ナビなし(★ 判断 8 = BottomNav 撤去 = 案 A の核)」

---

## 3. 廃止範囲 案 X / Y / Z 比較

| 案 | 内容 | 規模 | 整合 | 判定 |
|---|---|---|---|---|
| **X(完全削除)** | `layout.tsx` から `BottomNav` + `OverlayFab` import + JSX 全削除・`components/BottomNav.tsx` + `OverlayFab.tsx` + `OverlayModal.tsx`(オーファン)削除・`pb-20` も不要に | layout -3 行 + 3 ファイル削除(計 -628 行) | ★ 判断 8「廃止」言語と一致・「タブなし」核と一致 | ★★ **本命** |
| Y(条件付き非表示) | `BottomNav` 内で `pathname === "/ai"` 時 `return null`・OverlayFab のみ削除 | BottomNav +2 行 + OverlayFab 関連削除 | 判断 8 補助記述「メインチャット画面では非表示化」とは整合するが、`/saved` `/self` 等で BottomNav が残る → 「タブなし完全チャット型」の核と不整合 | 不採用(過渡期案・案 A の核から外れる) |
| Z(A-2 + A-3 同 commit) | X + 加えて `MenuDrawer.tsx` 新規 + ChatPage `[≡]` ボタン投入 | X + MenuDrawer 新規 約 80-120 行 + ChatPage 改修 約 10-20 行 | 完全な案 A 状態に一気到達 | ロードマップ章 3.2 / 3.3 で A-2 / A-3 を分離した方針に逆行・1 commit 大きすぎ・M5 刻む作法と不一致 |

### ★ 推奨: 案 X(完全削除)

**理由**:
1. **判断 8 言語の明確性**: 「★ 廃止」「タブなし」(条件付き非表示ではない)
2. **案 A の核 = 全画面でタブなし**: Y は `/saved` `/self` で BottomNav 残置 → 不徹底
3. **OverlayFab は本体 P1-C 工程で明確に「削除」指示**(条件付き非表示の余地なし)
4. **OverlayModal はオーファン化**: OverlayFab 削除後の唯一の参照元消失 → 同時削除可能
5. **public ルート独立**(判断 8 明示): `/u` `/p` は別 layout で影響ゼロ
6. **旧画面 URL 残置**(判断 7-2): 直 URL アクセスは生存
7. **M5 刻む作法**: A-2(廃止)→ A-3(MenuDrawer)→ A-4(到達点検)を別 commit で投入

---

## 4. 旧画面到達経路の影響評価

### 4.1 BottomNav 削除前後の到達手段
| 画面 | 削除前 | 削除後(A-2 完了時点) | A-3 完了時点 | A-4 完了時点 |
|---|---|---|---|---|
| `/ai` | redirect / BottomNav タブ | redirect(`app/page.tsx`)| 同 | 同 |
| `/saved` | BottomNav タブ | **直 URL** + チャットコマンド(navigate-map `saved` intent) | + MenuDrawer | + チャットコマンド点検済 |
| `/self` | BottomNav タブ | **直 URL** + チャットコマンド(`worldview-profile` / `body-edit` / `history` / `posts` / `preference-edit` intent) | + MenuDrawer | + 点検済 |
| `/home` `/discover` `/outfit` | 旧 5 タブ廃止済(P1-B `79a76be` で除外済)・直 URL | 直 URL のみ | 同 | 同 |
| `/u/[id]` `/p/[id]` | (public ルート・別 layout)| **影響ゼロ** | 同 | 同 |
| `/onboarding` | BottomNav 非表示済 | 同(redirect 経路のみ)| 同 | 同 |

### 4.2 「到達できなくなる画面」評価
- ★ **なし**(全画面が直 URL + チャットコマンドで到達可能)
- A-2 から A-3 までの過渡期:UX が低下(MenuDrawer 未投入)するが、チャットコマンドで補完可能
- A-3 後:UI 完全復元(MenuDrawer で全機能アクセス)
- A-4 後:チャットコマンド到達網羅性が正式点検済

### 4.3 過渡期(A-2 から A-3 まで)のリスク
- オーナー実機検証時に「`/saved` `/self` への UI 経路」が一時的になくなる
- 緩和: チャットコマンド「保存見せて」「自分の世界観」等 9 intent が navigate-map で生存(★ judgment 8 確認済)
- 推奨: A-2 完了 → 即 A-3 着手(本日 2 時間集中で両方こなせる可能性あり)

---

## 5. 実装手順の段階分割(Step 1-5)

| Step | 内容 | 規模 |
|---|---|---|
| Step 1 | `app/(app)/layout.tsx` から `BottomNav` import + JSX 削除 + `pb-20` 削除(BottomNav 分余白不要に) | -3 行 |
| Step 2 | `app/(app)/layout.tsx` から `OverlayFab` import + JSX 削除 | -2 行 |
| Step 3 | `components/BottomNav.tsx` 削除 | -58 行(1 ファイル) |
| Step 4 | `components/overlay/OverlayFab.tsx` 削除 | -30 行(1 ファイル) |
| Step 5 | `components/overlay/OverlayModal.tsx` 削除(★ OverlayFab 削除でオーファン化)| -540 行(1 ファイル) |
| Step 6 | `tsc --noEmit` + 実機確認(`/ai` レイアウト崩れなし・直 URL `/saved` `/self` で旧画面が BottomNav なしで表示・`/u` `/p` 影響なし) | 検証 |

合計: **コード約 -628 行**・**ファイル削除 3 件**・**layout.tsx -5 行**
推定実装時間: **20-30 分**(検証含む・MVP M5 教訓に沿った小サイズ commit)

---

## 6. 既存達成への影響評価

| 既存達成 | 影響 | 根拠 |
|---|---|---|
| 1.5b 完成形(`60c7fa8`)| **なし** | ChatPage は `BottomNav` / `OverlayFab` / `OverlayModal` を実コードで参照していない(コメントのみ)|
| race fix v2(`040078c`)| **なし** | localStorage 永続化・layout 非依存 |
| L4-A 切替検出(`60c7fa8`)| **なし** | handleSubmit 内・layout 非依存 |
| リグレッションテスト(`3e39f99`)| **なし** | mock 主体・layout 非依存 |
| コスト試算(`985d00b`)| **なし** | doc のみ |
| 判断 10 / 4.7 注記(`ac834bb`)| **なし** | doc のみ |
| 8 パターン廃止監査(`3d1a740`)| **なし** | doc のみ |
| ロードマップ(`fe8e15d`)| **整合**(章 3.2 A-2 の物理実装)| doc のみ |
| **public ルート `/u/[id]` `/p/[id]`** | **★ なし** | `app/(public)/layout.tsx` 別ルートグループ・判断 8 で明示確認 |
| **既存 18 機能(各画面ファイル)** | **なし** | 各画面が独自 layout なし・`(app)/layout.tsx` 経由だが BottomNav 表示のみ依存 → 削除後も画面本体は無傷 |
| **DevAuthBadge** | **なし** | `(app)/layout.tsx` に残置(削除対象外) |
| ③ プライバシー専章 | **なし** | UI layout 改修のみ |
| ③ コスト管理 | **なし** | UI layout 改修のみ |
| Phase 2 後ゲート | **なし** | UI layout 改修のみ |

---

## 7. 不可侵境界線(ロードマップ章 12)整合

| # | 境界線 | 本変更との整合 |
|---|---|---|
| 1 | 既存 DB 直触禁止 | ✅ 該当なし(layout 改修のみ) |
| 2 | 列絞り迂回禁止 | ✅ 該当なし |
| 3 | 既存 API 契約不変 | ✅ 該当なし |
| 4 | 公開 URL 不変 | ✅ `/u` `/p` は別 layout で影響ゼロ・旧画面 URL も残置(判断 7-2) |
| 5 | 旧画面ファイル残置 | ✅ `app/(app)/home/page.tsx` 等の画面ファイルは触らず・BottomNav 経路を断つのみ |
| 6 | worldview_tags 英語スラッグ非露出 | ✅ 該当なし |
| 7 | service_role 不使用 | ✅ 該当なし |
| 8 | ★ ③ 専章 / ③ コスト / Phase 2 後ゲート diff 0 行 | ✅ 該当なし(UI layout のみ) |

---

## 8. リスク + エッジケース

| # | リスク | 緩和策 |
|---|---|---|
| 1 | A-2 から A-3 までの過渡期に `/saved` `/self` への UI 経路がない | チャットコマンド(navigate-map 9 entry)で代替可能・A-3 を即着手(本日 2 時間集中で両方可能性) |
| 2 | `pb-20` 削除で `/saved` `/self` のレイアウトに影響(下部の余白が消える) | 各画面が独自の padding を持つ場合は影響なし・実機確認 Step 6 で検証 |
| 3 | `OverlayModal` 削除で過去 commit を読む将来読者が困惑(D1-2b' 履歴) | git history で `483cef4`(D1-2b' commit)を辿れる・/ai/page.tsx 9 行目の履歴コメントで参照可能 |
| 4 | StrictMode / SSR で layout 構造変更による不具合 | 構造は `<>{children}{...}</>` から `<>{children}{DevAuthBadge}</>` に縮小のみ・SSR 動作不変 |
| 5 | 削除した component を別箇所(まだ使われていない開発中コード)で参照していた場合の tsc エラー | `grep -rn "BottomNav\|OverlayFab\|OverlayModal"` で事前確認済(`/ai/page.tsx` コメントのみ・実コード参照ゼロ)|
| 6 | `BottomNav.tsx:33` の `/onboarding` 非表示判定が無意味化 | 削除されるので問題なし |

---

## 9. 推奨案 + 規模・実装時間

### ★ 推奨: 案 X(完全削除)

| 項目 | 値 |
|---|---|
| 規模 | コード **約 -628 行**(layout -5 / BottomNav -58 / OverlayFab -30 / OverlayModal -540 + コメント整理)|
| ファイル削除 | **3 件**(`BottomNav.tsx` / `OverlayFab.tsx` / `OverlayModal.tsx`)|
| 実装時間 | **20-30 分**(Step 1-6) |
| 検証 | `npx tsc --noEmit` + ブラウザで `/ai` / `/saved` / `/self` / `/u/[id]` 確認 |

### 補足: `/ai/page.tsx` コメント整理(任意)
- L9 / L20 / L291-292 の「P1-C-2 で削除」予告コメントは本実装後に陳腐化
- 整理 or 残置は実装時の判断項目(本 doc では指示しない)

---

## 10. 結論

- **★ 案 X(完全削除)を推奨** — 判断 8「廃止」言語と完全整合・案 A の核「タブなし」を実現
- 既存達成 8 件(1.5b 完成形 / race fix v2 / L4-A / リグレッションテスト / コスト試算 / A-1-T1 / A-1-T2 / ロードマップ)への影響 ★ ゼロ
- public ルート / 旧画面 URL / DevAuthBadge / 既存 18 機能本体 ★ 不変
- 不可侵境界線 8 箇条 ★ 全保持
- 過渡期リスク(A-2 → A-3 間 UI 経路欠落)は **チャットコマンド** + **直 URL** で緩和・A-3 即着手で短縮可
- 規模 約 -628 行・ファイル削除 3 件・実装時間 20-30 分 → ★ 本日 2 時間集中で A-2 + A-3 の両方完遂可能

### 次工程
1. オーナーレビュー → 案 X 確定
2. A-2 実装(本 doc の Step 1-6・別 commit)
3. A-3(P1-C-3 MenuDrawer + [≡])着手判断(本日続行 or 別 Sprint)
