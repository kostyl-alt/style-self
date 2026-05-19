# STYLE-SELF D-1 Phase 1 P1-C 設計調査

作成日: 2026-05-20
位置づけ: 本ドキュメントは **設計調査 + サブ分割案**。本体設計書
          `docs/STYLE-SELF_D1_実装設計.md`(現 HEAD `4fdbab1`・案A 確定)は
          **書き換えない**。P1-C 着手前に実物コードを突き合わせて作成。
背景: P1-C は D-1 最大の改修(ChatPage 構築 + 下部ナビ廃止 + 右上メニュー +
      OverlayFab 廃止 + チャットコマンド配線)。一度に推測実装すると地雷を踏む
      ため、実物を見てサブ分割案を出す(M4-2 / M5-3 教訓)。

---

## A. 現状の実物確認

### A1. OverlayModal.tsx(D1-2b' 資産・483cef4・567 行)

**保持して ChatPage に転用するもの**(シグネチャ無変更):

| 要素 | 役割 |
|---|---|
| `useEffect` / `useRef` / `useState` imports(L32)| state 管理基盤 |
| `Message` 型 / `MessageContent` 型 | 履歴 state の型定義 |
| `text` / `loading` / `messages` 3 state | 入力・送信中・履歴 |
| `endRef`(L86)+ `useEffect`(L89 自動スクロール)| 末端追従 |
| `handleSubmit` フロー | user append → 入力クリア → loading append → /api/overlay/intent → 成功 intent-result 置換 / 失敗 error 置換 |
| `executeNavigate`(L145 等)| navigate-map 経由の遷移 |
| `newMessageId`(L71)| 履歴の id 生成ヘルパ |
| `trimByMax`(L226)+ `MAX_MESSAGES=30` | 履歴肥大防止 |
| `replaceMessage`(L231)| loading → result 置換ヘルパ |
| `EmptyHistoryHint`(L241)| 履歴空時の例文表示 |
| `Bubble`(L258)/ `AssistantContent`(L287)| 吹き出しレンダリング |
| **5 サブ(L326-548)**: ResultView / NavigateConfirm / NoneNotice / SuggestionList / ApiHybridPlaceholder + KeyVal | ★ シグネチャ無変更で再利用 |

**廃止する要素**(モーダル制御):

| 要素 | 廃止理由 |
|---|---|
| `OverlayModal({ onClose })` 関数本体(L79)| Page 化 = props 不要 |
| L155 `<div className="fixed inset-0 z-50 ... bg-black/50 ...">` モーダル背景 | ChatPage は通常画面 |
| L158-159 `<div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden">` モーダル枠 | min-h-screen の通常画面構造に置換 |
| ヘッダの `[×]` ボタン(onClose 呼出)| ChatPage は閉じる概念なし |
| `onClick={onClose}` の外側クリック閉じる動作 | 同上 |

### A2. layout.tsx + BottomNav.tsx(P1-B 後・79a76be)

```typescript
// app/(app)/layout.tsx 現状(13 行)
import BottomNav from "@/components/BottomNav";
import DevAuthBadge from "@/components/dev/DevAuthBadge";
import OverlayFab from "@/components/overlay/OverlayFab";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-20">{children}</div>
      <BottomNav />
      <OverlayFab />
      <DevAuthBadge />
    </>
  );
}
```

```typescript
// components/BottomNav.tsx(P1-B 後)
NAV_ITEMS: 3 件(AI /ai / 保存 /saved / 自分 /self)
if (pathname === "/onboarding") return null;
fixed bottom-0 left-0 right-0 z-40 bg-white border-t
```

**案A での廃止戦略**:
- `<BottomNav />` を layout から削除(P1-C で 1 行削除)
- `<OverlayFab />` を layout から削除(P1-C で 1 行削除 + ファイル本体は将来削除でも可)
- `BottomNav.tsx` ファイル自体は **残しておく**(将来再利用 / git history 保持・P1-C では layout から外すだけで十分)
- `pb-20`(BottomNav 分の bottom padding)も削除推奨(通常画面に戻す)

→ ★ 「下部ナビなし完全チャット型」の物理的実現は **layout.tsx の 4 行削除程度** で済む。

### A3. app/(app)/ai/page.tsx(P1-A プレースホルダ・34 行)

`AiPage()` 関数本体を ChatPage に置換するだけ。`"use client"` ディレクティブ、`min-h-screen bg-white` 等の最外枠は流用可。

### A4. navigate-map.ts + OVERLAY_INTENT_PROMPT — チャットコマンド裏取り

**OVERLAY_INTENT_PROMPT(D1-1)の intent 列挙**(`lib/prompts/overlay-intent.ts:20-40`):

```
21 intent 全部既に列挙済:
  diagnose / worldview-profile / coordinate / style-consult / virtual-coordinate /
  product-match / match-users / match-posts / create-post / my-posts / closet /
  inspiration / brand-learn / culture / saved / history / body-edit / preference-edit /
  moodboard / tryon / unknown
```

**navigate-map.ts(D1-2a)の URL 表**(`lib/overlay/navigate-map.ts`):

```
9 entry 全部既に揃っている = 専用 UI 引き継ぎ 9 機能完全カバー:
  diagnose          → /onboarding
  worldview-profile → /self?tab=diagnosis(タブ命名トリック吸収)
  create-post       → /self/new-post
  my-posts          → /self?tab=posts
  closet            → /outfit?tab=closet
  saved             → /saved
  history           → /self?tab=history
  body-edit         → /self?tab=body
  preference-edit   → /self?tab=worldview(タブ命名トリック吸収)
```

### ★ 裏取り結論: 本体設計書「新規実装ゼロで成立」の **コード上の証拠**

```
チャットコマンドが要求する経路は:
  発話 → /api/overlay/intent(D1-1)で intent 判定
       → navigate-map(D1-2a)で URL 解決
       → router.push() で遷移

これら 3 要素すべて 既に実装済 + P1-B 時点で動作実証済(D1-2a 実機 OK)
→ ★ チャットコマンド = 新規 intent / 新規 navigate-map エントリ / 新規 API 追加ゼロで成立。
   P1-C で書く新規コードは「ChatPage の器 + 右上メニュー + layout 削除」のみ。
```

---

## B. P1-C 設計案

### B1. ChatPage 化の設計

**OverlayModal の対話ロジックを ChatPage に発展させる方針**:

```
方針: OverlayModal.tsx の 567 行から「モーダル枠の外側 div(L155-160)+ ×ボタン」だけを
      除去し、残り(state / handleSubmit / useEffect / Bubble / 5 サブ / 各ヘルパ)を
      新規 `app/(app)/ai/ChatPage.tsx` or ai/page.tsx 内に移植。

具体的な切り分け:
  保持: L1-149 の type/state/handler 群 + L226-548 の Bubble/5 サブ/ヘルパ群
  変更: L150-225 の return JSX(モーダル枠の外側 → ChatPage の通常画面構造に置換)
  廃止: onClose prop と外側クリック閉じる動作
```

**ChatPage の起動画面構成(P1-C スコープ内)**:

```
┌─────────────────────────────────────────────┐
│ STYLE-SELF AI                          [≡] │ ← 上部(ヘッダ・右上メニュー)
├─────────────────────────────────────────────┤
│ [履歴がここに積まれる・末端 ref で自動スクロール] │ ← 中央(履歴エリア)
├─────────────────────────────────────────────┤
│ [入力欄] [送信→]                            │ ← 下部固定入力
└─────────────────────────────────────────────┘

※ 下部ナビなし(BottomNav layout から削除)
※ FAB なし(OverlayFab layout から削除)
※ ★ P1-C スコープ外: 世界観カード(小)・近接 4 ボタン・初回提案チップ 5・結果カード化(D1-2c'/D1-2d'/D1-2e' 相当 = P1-D / P1-E / P1-F で実装)
```

### B2. 下部ナビ廃止 + OverlayFab 廃止の設計

**layout.tsx の最小変更**(4 行削除):

```diff
 import BottomNav from "@/components/BottomNav";
 import DevAuthBadge from "@/components/dev/DevAuthBadge";
-import OverlayFab from "@/components/overlay/OverlayFab";

 export default function AppLayout({ children }: { children: React.ReactNode }) {
   return (
     <>
-      <div className="pb-20">{children}</div>
-      <BottomNav />
-      <OverlayFab />
+      <div>{children}</div>
       <DevAuthBadge />
     </>
   );
 }
```

**旧画面(/home /discover /outfit 等)直アクセス時の挙動**:

| URL 直アクセス | P1-C 後 |
|---|---|
| `/home` | 既存画面が表示・**下部ナビなし**(layout から削除済)|
| `/discover` | 同上 |
| `/outfit` | 同上 |
| `/self` | 同上 |
| `/saved` | 同上 |

→ ナビ無しで旧画面に直アクセスした時、戻る手段は **ブラウザの戻るボタン or /ai 直入力**。
   判断 2(URL 残置・段階削除)は維持されているが、**ナビ撤去後のユーザビリティ確認**が
   P1-C 完了時の実機確認項目に追加が必要(セクション B6 地雷リスト参照)。

**onboarding / 公開ページへの影響**: ゼロ
- `/onboarding`: BottomNav.tsx の L19 `if (pathname === "/onboarding") return null;` で元々非表示
- `/u/[id]` `/p/[id]`: app/(public)/ ルートグループ独立で BottomNav 元から無関係

### B3. 右上メニュー(MenuDrawer)の設計

**新規コンポーネント**: `components/overlay/MenuDrawer.tsx`(仮称)

```typescript
// 構造案(P1-C で実装):
- props: { open: boolean, onClose: () => void }
- state: なし(ChatPage 側で open/close 管理)
- レイアウト: 右からスライドイン(fixed right-0 + transform translate-x)
- z-index: z-50(モーダル相当)
- 中身: 8 リンク(navigate-map 9 entry のうち diagnose と create-post を除く 7
   + 「あなたの世界観 = worldview-profile」+ 「設定(将来)」+ 「ログアウト」)

メニュー項目(本体 4.3 右上メニュー設計):
  1. あなたの世界観 → /self?tab=diagnosis(navigate-map[worldview-profile].url)
  2. クローゼット   → /outfit?tab=closet(navigate-map[closet].url)
  3. 保存           → /saved(navigate-map[saved].url)
  4. 身体・好み・避けたい → /self?tab=body 等(navigate-map[body-edit/preference-edit].url)
  5. 履歴           → /self?tab=history(navigate-map[history].url)
  6. 投稿           → /self?tab=posts(navigate-map[my-posts].url・判断 7-5)
  ──────────────
  7. 設定(将来)
  8. ログアウト    → /auth/signout(既存・ログアウト API)

→ ★ navigate-map から 6 件を再利用(create-post / diagnose は提案チップ or
  チャットコマンド側で吸収)+ 設定・ログアウトは固定リンク。新規 navigate-map
  エントリ追加ゼロ。
```

**ChatPage 上部ヘッダから `[≡]` ボタン → MenuDrawer 展開**(P1-C で実装)。

### B4. チャットコマンドの設計(★ 新規実装ゼロ・実物コードで裏取り済)

```
チャットコマンド = ユーザー自然文 → 既存 D1-1 + D1-2a で intent 判定 → 遷移

実装手順:
  1. ユーザー「保存見せて」と発話
  2. ChatPage の handleSubmit(D1-2b' から転用)が /api/overlay/intent を呼ぶ
  3. レスポンス: { intent: "saved", mode: "navigate", ... }
  4. アシスタント吹き出しに ResultView(D1-2a 5 サブ)が描画
  5. ResultView 内で mode==="navigate" → NavigateConfirm 表示
     「保存を開きますね →」+ [移動する →] ボタン
  6. ボタンタップ → resolveNavigateTarget("saved") → /saved に router.push

→ ★ 全て既存コード(D1-1 + D1-2a + D1-2b')で実現。P1-C で書く新規コードは
  ChatPage の器のみ。チャットコマンドのために intent / navigate-map に
  1 行も追加しない。
```

### B5. 既存資産 到達マップの実装後成立確認

本体設計書 4.4 の到達マップ(★ 迷子ゼロ)が P1-C 実装後に成立するか:

| 既存資産 | P1-C 後の到達手段 | 既存資産 |
|---|---|---|
| 対話完結 8 機能 | P1-C ではまだチャットコマンドで intent 判定→ ApiHybridPlaceholder 表示(結果カード化は P1-E)| ✅ |
| 専用 UI 引き継ぎ 9 機能 | チャットコマンド → NavigateConfirm → 遷移 | ✅(navigate-map で全カバー)|
| M3 投稿作成 | チャットコマンド「投稿作りたい」→ create-post → /self/new-post | ✅ |
| M3 自分の投稿管理 | チャットコマンド「自分の投稿」or 右上メニュー「投稿」| ✅ |
| **M2-3 公開 /u/[id]** | ★ public ルートグループ独立 = layout 影響なし | ✅(絶対不変)|
| **M3-4 公開 /p/[id]** | 同上 | ✅(絶対不変)|
| 保存 /saved | チャットコマンド「保存見せて」or 右上メニュー「保存」| ✅ |
| クローゼット | チャットコマンド「クローゼット見せて」or 右上メニュー「クローゼット」| ✅ |
| 身体・好み・避けたい | チャットコマンド or 右上メニュー | ✅ |
| AI 履歴 | 同上 | ✅ |
| 再診断 | チャットコマンド「再診断したい」| ✅ |
| 旧 /home | 到達手段なし(機能は他で全 cover・URL 直アクセスのみ生存)| ✅(意図通り)|

→ ★ **P1-C 完了時点で到達マップ全項目が成立**(到達できない機能ゼロ)。
   ただし対話完結 8 機能の "結果カード化" は P1-E まで進まないため、P1-C では
   ApiHybridPlaceholder(D1-2a)による「判定結果のみ表示」の状態。

### B6. 地雷リスト

| # | 地雷 | 対策 |
|---|---|---|
| 1 | D1-2b' 資産(5 サブ等)を壊さず ChatPage 化する境界 | ★ **シグネチャ無変更**で transfer・関数本体・props・型定義をコピペ移植・呼び出し位置だけ ChatPage 内に変える(D1-2b' で確立した作法を継承)|
| 2 | BottomNav 撤去で旧画面 URL 直アクセス時のナビ消失 | 判断 2(URL 残置・段階削除)維持。旧画面でナビ無しで戻る手段は **ブラウザ戻る or /ai 直入力**(オーナー実機確認項目に追加)|
| 3 | OverlayFab 廃止のタイミング | ChatPage 化と **同一 commit** で行う(FAB 経由と ChatPage 経由の二重化期間ゼロ)|
| 4 | 右上メニューと既存画面の z-index 重なり | MenuDrawer は z-50(モーダル相当)・既存 /self /saved 等は z-0 で問題なし |
| 5 | チャットコマンド誤判定 | D1-2a の SuggestionList(confidence < 0.7 で候補表示)を再利用・新規 fallback 不要 |
| 6 | ★ ③ プライバシー専章 / コスト / Phase 2 後ゲートに P1-C が干渉しない | ★ Section 6 / 7 / Phase 2 後ゲートは P1-C で **触らない**(設計書 4.4)|
| 7 | 一度に作り込む危険(P1-C は D-1 最大の改修)| ★ **サブ分割厳守**(下記 B7 で 4 サブに割る)|
| 8 | ChatPage 化で SSR / "use client" 境界の問題 | OverlayModal は既に "use client" + useState なので、page.tsx 自体も "use client" 維持(P1-A プレースホルダで既にそうなっている)|
| 9 | DevAuthBadge との共存 | layout.tsx で DevAuthBadge は保持(dev 環境のみ表示・本番無影響)|
| 10 | onboarding 直後の遷移 | P1-A で /onboarding 完了後 → /ai 遷移は app/page.tsx で確認済(P1-C 後も同じ)|

### B7. ★ P1-C サブステップ分割案(4 サブ + 仕上げ)

**D-1 最大の改修なので 4 サブに割る**(M5 教訓:小さくまとめる):

| Sub | 内容 | 地雷度 | 実機確認 |
|---|---|---|---|
| **P1-C-1**(ChatPage 器化)| `app/(app)/ai/page.tsx` を ChatPage に書き換え。OverlayModal の対話ロジック(state / handler / Bubble / 5 サブ / ヘルパ)を **シグネチャ無変更で移植**。ただしモーダル枠の外側(L155-160)+ ×ボタン + onClose を除去し、min-h-screen の通常画面構造に。**この時点では layout 不変・FAB 経由とも併存**(/ai でも FAB でも対話可能 = 二重化期間)| 中 | /ai で入力 → 履歴蓄積 → 既存 D1-2b' と同じ挙動 |
| **P1-C-2**(layout 削除 + FAB 廃止)| `app/(app)/layout.tsx` から `<BottomNav />` と `<OverlayFab />` の 2 行 + import 1 行 + pb-20 を削除。**ここで二重化解消**(全画面で FAB なし・/ai 以外の旧画面はナビなし)| 中 | /ai が下部ナビ無しで動作・旧画面直アクセスもナビ無し・onboarding / 公開 /u /p 影響ゼロ |
| **P1-C-3**(MenuDrawer 追加)| `components/overlay/MenuDrawer.tsx` 新規(8 リンクのスライドイン Drawer)+ ChatPage ヘッダに `[≡]` ボタン + open/close state 追加 | 中 | `[≡]` タップ → メニュー展開 → 各リンクで navigate-map 経由遷移 |
| **P1-C-4**(チャットコマンド動作確認 + 仕上げ)| ★ 新規実装なし(全て既存資産で動く)。実機で「保存見せて」「俺の世界観見せて」等 9 件のチャットコマンドが正しく navigate されることを **確認するだけ**。到達マップ点検(本体 4.4)+ プライバシー View Source 点検(M4 同型)| 低 | チャットコマンド 9 件 + 旧画面退行ゼロ + worldview_tags 漏洩ゼロ |

→ **P1-C 全体は 4 つの commit に分割**(各 commit 後にオーナー実機確認可)。
   合計差分は推定 +300 / -50 程度(ChatPage 移植 + layout 4 行削除 + Drawer 新規)。

### B8. P1-C スコープ境界

```
【P1-C のスコープ内】
  ✅ ChatPage 器化(OverlayModal の対話ロジック転用)
  ✅ 下部ナビ廃止(BottomNav layout から削除)
  ✅ OverlayFab 廃止(layout から削除)
  ✅ 右上メニュー MenuDrawer 追加(8 リンク)
  ✅ チャットコマンド動作確認(★ 新規実装ゼロで成立確認)
  ✅ 到達マップ点検(本体 4.4)
  ✅ プライバシー漏洩点検(M4 同型・worldview_tags 露出ゼロ)
  ✅ 退行点検(旧画面 URL 直アクセス / 公開 /u /p / onboarding)

【P1-C のスコープ外(P1-D 以降)】
  ❌ 上部世界観カード(小)= P1-D
  ❌ 入力欄近接 4 ボタン(写真 / 商品 URL / クローゼット参照 / MB 追加)= P1-D
  ❌ 初回提案チップ 5 種 = P1-D
  ❌ 対話完結 8 機能の結果カード化(coordinate / match-users 等のリッチ表示)= P1-E
  ❌ virtual-coordinate → product-match 連鎖 = P1-F
  ❌ 「次アクション」3 種ボタン(保存 / 商品 / 別案)= P1-F
  ❌ ムードボード / リアル試着 = Phase 2 / Phase 4
```

**= 「ChatGPT の服版の姿(チャットがアプリそのもの)」を**実物として現す**工程。
中身の充実(チップ・結果カード・連鎖)は P1-D 以降に渡す。**

---

## C. まとめと推奨

### C1. P1-C の本質

```
P1-C = 「下部ナビなしのチャット画面 + 右上メニュー」という器を完成させる工程。
       中身(チップ / 結果カード / 連鎖)は P1-D 以降。

新規実装の最小量:
  - app/(app)/ai/page.tsx を ChatPage に書き換え(OverlayModal から transfer)
  - layout.tsx から BottomNav / OverlayFab を削除(4 行)
  - components/overlay/MenuDrawer.tsx 新規(右上メニュー)
  - チャットコマンドは★新規ゼロ(既存 D1-1 + D1-2a でカバー済)

= D-1 最大の改修 だが、新規実装量は中程度。サブ 4 分割で安全に進められる。
```

### C2. 既存資産の温存確認

| 項目 | P1-C 後の状態 |
|---|---|
| 既存 18 機能 API / DB | ✅ 0 変更 |
| /u/[id] /p/[id] 公開ページ | ✅ 0 変更(public ルートグループ独立)|
| M2-3 / M4-2 / M5 / M3 プライバシー経路 | ✅ 一切干渉なし |
| ③ プライバシー専章 / コスト管理 / Phase 2 後ゲート | ✅ 完全不変 |
| service_role | ✅ 不使用 |
| worldview_tags | ✅ 非露出維持 |
| D1-1 intent API / OVERLAY_INTENT_PROMPT | ✅ 完全保持(チャットコマンドの基盤)|
| D1-2a navigate-map | ✅ 完全保持(MenuDrawer + チャットコマンド両方で再利用)|
| D1-2b' OverlayModal の対話ロジック | ✅ シグネチャ無変更で ChatPage に transfer |

### C3. P1-C 着手の推奨手順

```
P1-C-1(ChatPage 器化)
  ↓ 実機確認: /ai で対話画面動作・既存 D1-2b' と同等
P1-C-2(layout 削除 + FAB 廃止)
  ↓ 実機確認: 下部ナビなし・FAB なし・旧画面影響確認
P1-C-3(MenuDrawer 追加)
  ↓ 実機確認: [≡] → 8 リンクの navigate-map 経由遷移
P1-C-4(チャットコマンド動作確認 + 仕上げ)
  ↓ 実機確認: 9 件のチャットコマンド + 到達マップ + プライバシー漏洩点検
P1-C 完了 → P1-D(チップ / カード / 近接ボタン)
```

実装はまだしません。本ドキュメントを判断材料に、P1-C-1 から着手するか・別アプローチを取るか、オーナー判断待ち。
