# STYLE-SELF D1 P1-C-3 設計調査(MenuDrawer + ChatPage [≡] + 新しいチャット機能)

> ★ 設計調査 doc(実装しない・本体 [STYLE-SELF_D1_実装設計.md](./STYLE-SELF_D1_実装設計.md) `ac834bb` は書き換えない)。
> 上位ロードマップ: [STYLE-SELF_D1_ビジョン完全達成_ロードマップ.md](./STYLE-SELF_D1_ビジョン完全達成_ロードマップ.md) 章 3.3 **A-3**(`fe8e15d`)
>
> 前提コミット: `59fa4d6`(A-2 完遂・案 A タブなし完全チャット型 物理移行完了)
> 投入条件: 判断 8 補助機能集約点(右上メニュー [≡])の実装 +
> **オーナー指摘**「履歴残ってる状態でしか動作確認できない」→ A-3 スコープに **新しいチャット機能** を統合

---

## 1. 現状確認サマリ(実物確認結果)

### 1.1 本体 `ac834bb` の MenuDrawer 仕様(4.3 §「右上メニュー [≡] 設計」抽出)

**展開方式**: タップで右からスライド展開
**メニュー項目 8 件**(本体行 569-586):
```
あなたの世界観    → /self?tab=diagnosis(navigate-map: worldview-profile)
クローゼット       → /outfit?tab=closet(navigate-map: closet)
保存              → /saved(navigate-map: saved)
身体・好み・避けたい → /self?tab=body / =worldview(navigate-map: body-edit / preference-edit)
履歴              → /self?tab=history(navigate-map: history)
投稿              → /self?tab=posts(navigate-map: my-posts)
─────────────
設定              → (将来)
ログアウト         → (既存 /auth/signout 想定・★ 実装確認結果: 既存実装なし)
```

**位置づけ**: 「毎日使う機能(コーデ提案・相談・マッチ)はチャット完結のため、右上メニューは実質『設定とプロフィール管理の入口』として残す」(本体行 585-586)

**P1-C-3 工程の指示**(本体 P1-C 工程表・行 988):
> `components/overlay/MenuDrawer.tsx`(仮称・新規)+ ChatPage 上部 `[≡]` ボタン。展開で「あなたの世界観 / クローゼット / 保存 / 身体・好み / 履歴 / 投稿 / 設定 / ログアウト」を表示し navigate-map 経由で各画面へ

> 注: `components/overlay/` は A-2(`59fa4d6`)で空ディレクトリ自動削除済 → ★ 配置場所再選定が必要(章 4 参照)

### 1.2 現状 ChatPage ヘッダ([app/(app)/ai/page.tsx:283-286](../app/(app)/ai/page.tsx#L283-L286))
```tsx
<header className="px-5 pt-5 pb-3 border-b border-gray-100">
  <p className="text-xs tracking-widest text-gray-400 uppercase">STYLE-SELF AI</p>
  <h1 className="text-lg font-light text-gray-900 mt-0.5">何を相談しますか?</h1>
</header>
```
- コメント「P1-C-3 で [≡] 右上メニュー追加予定」明記(伏線実装の合致タイミング)
- [≡] ボタン配置: header 右端(`<header>` 内 flex 化で実現)

### 1.3 navigate-map 9 entries([lib/overlay/navigate-map.ts](../lib/overlay/navigate-map.ts))
| intent | url | メニュー連動 |
|---|---|---|
| `diagnose` | `/onboarding` | (メニュー外・チャットコマンド経由)|
| `worldview-profile` | `/self?tab=diagnosis` | ✅ **あなたの世界観** |
| `create-post` | `/self/new-post` | (メニュー外・「投稿」は my-posts に寄せる)|
| `my-posts` | `/self?tab=posts` | ✅ **投稿** |
| `closet` | `/outfit?tab=closet` | ✅ **クローゼット** |
| `saved` | `/saved` | ✅ **保存** |
| `history` | `/self?tab=history` | ✅ **履歴** |
| `body-edit` | `/self?tab=body` | ✅ **身体** |
| `preference-edit` | `/self?tab=worldview` | ✅ **好み**(タブ命名トリック吸収済)|

→ **8 メニュー項目中 6 件が navigate-map 即時利用可能**(身体・好みは別エントリ分担で 2 件カウント)

### 1.4 logout 既存実装(grep 結果)
```bash
$ grep -rn "signout\|signOut\|logout" --include="*.ts" --include="*.tsx" app components/
→ (empty)
```
★ **既存実装なし** — Supabase Auth の `supabase.auth.signOut()` を新規呼び出し or A-3 ではプレースホルダ。

### 1.5 race fix v2 の「将来クリア機能」伏線([ai/page.tsx:145](../app/(app)/ai/page.tsx#L145))
```ts
// ★ 空配列で上書きしない(多層防御・将来クリア機能の地雷予防)
if (messages.length === 0) return;
```
**race fix v2(`040078c`)時点で既に「将来クリア機能」を地雷予防として設計済** → A-3 で実装する新しいチャット機能は `localStorage.removeItem(STORAGE_KEY)` で **明示分離経路** を通る(persist effect は通らない・race 不発生)

---

## 2. メニュー項目の優先順位(★ オーナー判断項目)

| 項目 | 本体仕様 | navigate-map | A-3 投入推奨 |
|---|---|---|---|
| あなたの世界観 | ✅ 明示 | ✅ `worldview-profile` | ★ **必須** |
| クローゼット | ✅ 明示 | ✅ `closet` | ★ **必須** |
| 保存 | ✅ 明示 | ✅ `saved` | ★ **必須** |
| 履歴 | ✅ 明示 | ✅ `history` | ★ **必須** |
| 身体 | ✅ 明示 | ✅ `body-edit` | ★ **必須** |
| 好み | ✅ 明示 | ✅ `preference-edit` | ★ **必須** |
| 投稿 | ✅ 明示 | ✅ `my-posts` | ★ **必須**(判断 7-5)|
| **新しいチャット** | (本体未記載・★ オーナー指摘で追加)| (機能・navigate なし) | ★★ **必須**(A-3 統合) |
| 設定 | ✅ 明示(将来) | ❌ 未配線 | 🟡 プレースホルダ(disabled or 「準備中」)|
| ログアウト | ✅ 明示 | ❌ 既存実装なし | 🟡 **本実装**(Supabase auth.signOut() 新規)or プレースホルダ |

★ 推奨: **必須 8 項目**(navigate 6 + 新しいチャット 1 + ログアウト 1)+ **設定はプレースホルダ**

---

## 3. ★「新しいチャット」機能の要件比較

| 案 | 内容 | 規模 | UX | 判定 |
|---|---|---|---|---|
| **A シンプル** | `setMessages([])` + `localStorage.removeItem(STORAGE_KEY)` + 確認モーダル「履歴を消して新しく始めますか?」(キャンセル/OK) | **+30-50 行** | 履歴一覧なし・現在の会話だけクリア | ★★ **A-3 採用** |
| B ChatGPT 風 | 過去会話を別キー(`messages:archive`)に保存 + 履歴一覧サイドバー + 過去会話復元機能 | +200-400 行 + storage 構造拡張 | 過去会話に戻れる | A-3 範囲外(将来 Sprint・MVP-2 以降) |
| C ハイブリッド | 案 A + 「履歴」メニューで保存(navigate 履歴とは別) | +100-150 行 | 「履歴」項目の意味が二重(AI 履歴 + チャット履歴) | A-3 範囲外(命名衝突) |

### ★ 推奨: 案 A シンプル
- race fix v2 設計時の伏線「将来クリア機能の地雷予防」と完全整合(`localStorage.removeItem` 明示分離経路)
- 規模最小・スコープ確実
- B / C は MVP 検証後の別 Sprint で別 doc 起こす

### 案 A 実装ポイント(参考)
```ts
async function startNewChat() {
  if (messages.length === 0) return;  // 既に空なら何もしない
  if (!confirm("現在の会話を消して新しく始めますか?")) return;
  setMessages([]);
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
```
- `confirm()` ネイティブ → MVP は十分(Phase 2 で美しいモーダル化候補)
- persist effect は `messages.length === 0` で早期 return → `removeItem` 後の persist 上書き race なし(race fix v2 案 C の防御線が機能)

---

## 4. MenuDrawer 配置候補

| 候補 | パス | 評価 |
|---|---|---|
| a | `components/MenuDrawer.tsx`(top-level)| 機能別整理(`components/chat/` 等)と不整合 |
| **b** | `components/chat/MenuDrawer.tsx`(chat 機能サブ)| ★ **推奨** — ChatPage 専用 + 既存 `components/{coordinate,discover,history,saved,style,wardrobe}/` 機能別整理に整合 |
| c | `components/menu/MenuDrawer.tsx`(menu テーマ)| 将来別画面のメニューも入れる前提なら・現状 ChatPage 専用のため過剰 |

### ★ 推奨: **案 b** = `components/chat/MenuDrawer.tsx`
- 既存 `components/` 構造(機能別フォルダ多数)と整合
- ChatPage 専用と明示
- `components/overlay/` は A-2 で消滅・新規 `chat/` で清算

---

## 5. ChatPage [≡] ボタン配置

### 5.1 現状ヘッダ
```tsx
<header className="px-5 pt-5 pb-3 border-b border-gray-100">
  <p className="text-xs tracking-widest text-gray-400 uppercase">STYLE-SELF AI</p>
  <h1 className="text-lg font-light text-gray-900 mt-0.5">何を相談しますか?</h1>
</header>
```

### 5.2 改修方針(本体 4.3 図示準拠・行 540)
```
┌─────────────────────────────────────────────┐
│ STYLE-SELF AI     [世界観カード(小)]    [≡] │
│ 何を相談しますか?                          │
└─────────────────────────────────────────────┘
```
- header を `flex justify-between items-start` 化
- 左:既存テキスト 2 行
- 右:[≡] ボタン(`button` 単体・MenuOpen state トリガ)
- 世界観カード(小)は **P1-D(A-5)で投入予定** → A-3 では [≡] のみ追加

### 5.3 規模見当
- header の class 変更 + [≡] button 追加 + open state: **+10-15 行**

---

## 6. 実装手順 Step 分割

| Step | 内容 | 規模 |
|---|---|---|
| 1 | `components/chat/MenuDrawer.tsx` 新規(右スライド・背景 overlay・項目リスト・close 機構)| **+80-120 行** |
| 2 | ChatPage に `[≡]` ボタン + `useState(menuOpen)` 追加・header flex 化 | +10-15 行 |
| 3 | MenuDrawer 開閉ロジック(背景クリック / ESC で閉じる)| (Step 1 内に含む)|
| 4 | メニュー 6 件 = `navigate-map` 経由 `router.push` + drawer close | +10-20 行(MenuDrawer 内 onClick)|
| 5 | **新しいチャット**(案 A・`setMessages([])` + `removeItem` + `confirm()`)| +20-30 行(ChatPage 側に handler + MenuDrawer から prop で受け渡し)|
| 6 | ログアウト(Supabase `auth.signOut()` 新規 or プレースホルダ「準備中」)| +5-15 行(本実装か placeholder で分かれる)|
| 7 | `tsc --noEmit` + 実機確認(下記章 11)| 検証 |

合計規模: **+125-180 行**(本実装込み)・**+115-160 行**(ログアウト placeholder の場合)
推定実装時間: **1-1.5 時間**

---

## 7. 既存達成への影響評価

| 既存達成 | 影響 | 根拠 |
|---|---|---|
| 1.5b 完成形(`60c7fa8`)| **なし** | handleSubmit / 5 サブ / Bubble / EmptyHistoryHint / sessionIntent / L4-A 不変 |
| race fix v2(`040078c`)| **整合・拡張**(削除なし) | 「将来クリア機能の地雷予防」伏線と完全整合・`removeItem` は persist 経路外で動作 |
| L4-A 切替検出(`60c7fa8`)| **なし** | handleSubmit 内部・MenuDrawer 経路外 |
| リグレッションテスト(`3e39f99`)| **なし**(★ ただし簡易テスト追加余地) | simulator は UI コンポーネントテストせず・新しいチャット handler は別 case で追加可能(任意)|
| コスト試算(`985d00b`)/ A-1-T1 / A-1-T2 / ロードマップ / P1-C-2 設計 | **なし** | doc 群・コード不変 |
| **A-2(`59fa4d6`)layout.tsx** | **なし** | `(app)/layout.tsx` 触れない・MenuDrawer は ChatPage 内で完結 |
| **public ルート `/u` `/p`** | **なし** | 別 layout 独立 |
| **DevAuthBadge** | **なし** | layout 残置・触れない |
| **既存 18 機能** | **なし** | ChatPage 内のみ改修 |
| ③ プライバシー専章 | **なし** | UI のみ・顔写真 / worldview 露出経路非変更 |
| ③ コスト管理 | **なし** | UI のみ・新 API なし |
| Phase 2 後ゲート | **なし** | UI のみ |
| 既存設計判断 1-10 | **なし** | 本体 doc 触れない |

---

## 8. 不可侵境界線(ロードマップ章 12)整合

| # | 境界線 | 整合 |
|---|---|---|
| 1 | 既存 DB 直触禁止 | ✅ 案 A は localStorage のみ・新 DB 列なし |
| 2 | 列絞り迂回禁止 | ✅ 該当なし |
| 3 | 既存 API 契約不変 | ✅ Supabase auth.signOut() は既存 API |
| 4 | 公開 URL 不変 | ✅ `/u` `/p` 別 layout |
| 5 | 旧画面ファイル残置 | ✅ ファイル削除なし |
| 6 | worldview_tags 英語スラッグ非露出 | ✅ UI のみ |
| 7 | service_role 不使用 | ✅ クライアント側のみ |
| 8 | ★ ③ 専章 / ③ コスト / Phase 2 後ゲート diff 0 行 | ✅ UI のみ |

---

## 9. ★ 設計者推奨案

### 9.1 推奨セット
- **メニュー項目 8 件**: あなたの世界観 / クローゼット / 保存 / 履歴 / 身体 / 好み / 投稿 / **新しいチャット** + **ログアウト** + **設定(プレースホルダ)**
- **新しいチャット**: 案 A シンプル(`setMessages([])` + `removeItem` + `confirm()`)
- **MenuDrawer 配置**: `components/chat/MenuDrawer.tsx`(案 b)
- **ログアウト**: Supabase `auth.signOut()` 本実装(規模 +5-10 行・既存 `lib/supabase-browser.ts` 使用)
- **設定**: プレースホルダ「準備中」(disabled or 軽い案内)

### 9.2 規模・実装時間
| 項目 | 規模 |
|---|---|
| MenuDrawer 新規 | +80-120 行 |
| ChatPage [≡] + state | +10-15 行 |
| ナビゲーション wiring | +10-20 行 |
| 新しいチャット handler | +20-30 行 |
| ログアウト本実装 | +5-10 行 |
| **合計** | **+125-195 行** |
| 実装時間 | **1-1.5 時間** |

### 9.3 達成 UX
- 右上 [≡] からチャット外の補助機能 9 経路すべてに到達(設定はプレースホルダ)
- 「新しいチャット」で履歴クリア → 新規状態の動作確認が常時可能(オーナー指摘解消)
- 案 A タブなし完全チャット型の補助機能集約点が完成 → 判断 8 物理実装完了

---

## 10. リスク + エッジケース

| # | リスク | 緩和策 |
|---|---|---|
| 1 | スライド展開の SSR / StrictMode 影響 | `useState(false)` 初期値・client component 化(既に ChatPage は `"use client"`)で SSR セーフ |
| 2 | 確認モーダル誤タップで履歴消失 | `confirm()` で 1 段確認 + 「現在の会話を消して新しく始めますか?」明示文言 / Phase 2 で美しいモーダル化候補 |
| 3 | `localStorage.removeItem` 後の persist 上書き race | race fix v2 の `messages.length === 0` 早期 return で防御済(章 1.5 確認)|
| 4 | drawer 開いた状態で `/ai` 外遷移 → 戻ると drawer 開きっぱなし | `useEffect` で route 変化検出 → close or Drawer 内で `router.push` 後に close 明示 |
| 5 | 外側クリック・ESC で閉じる UX | MenuDrawer 内に `onClick` / `keydown` ハンドラ実装(Step 1 内)|
| 6 | ログアウト失敗時のエラー処理 | `try/catch` + toast 通知 or fallback redirect to `/login` |
| 7 | 設定プレースホルダの「準備中」UX が中途半端 | 表示しない選択肢もあり(オーナー判断項目) |
| 8 | MenuDrawer の z-index が世界観カード(P1-D・A-5)と衝突 | `z-50` / `fixed inset-0` パターン(既存 OverlayModal の z-index 思想踏襲) |

---

## 11. 実機確認手順(A-3 実装後)

1. `npm run dev` → `/ai` 開く
2. ★ **右上に [≡] ボタン表示**
3. **[≡] タップ → 右からスライドで MenuDrawer 展開**
4. **メニュー項目 8 件表示**(設定はプレースホルダ表示確認)
5. **各 navigate 項目をタップ → 対応画面へ遷移**:
   - あなたの世界観 → `/self?tab=diagnosis`
   - クローゼット → `/outfit?tab=closet`
   - 保存 → `/saved`
   - 履歴 → `/self?tab=history`
   - 身体 → `/self?tab=body`
   - 好み → `/self?tab=worldview`
   - 投稿 → `/self?tab=posts`
6. **「新しいチャット」タップ → 確認モーダル → OK で履歴クリア**
7. **クリア後 EmptyHistoryHint 表示**(★ オーナー指摘「新規状態の動作確認」が常時可能に)
8. **ログアウト → `/login` リダイレクト**(本実装の場合)
9. **背景クリック / ESC で MenuDrawer 閉じる**
10. **リロード後も新しいチャット = 履歴空のまま**(localStorage 確実消去確認)
11. **1.5b 完成形 + race fix v2 + L4-A 動作維持**(diagnose / closet / 切替 / 永続化 / プライバシー)
12. **`npx tsx scripts/test-stylist-chat-continuity.ts` → exit 0**(97/97 PASS 維持)

---

## 12. 結論

- **A-3 全体規模**: 約 **+125-195 行**(新規 + 変更)・**1-1.5 時間**
- 達成 UX:
  - 右上 [≡] メニュー = 案 A 補助機能集約点の物理実装完了(判断 8 完全達成)
  - 新しいチャット機能でオーナー指摘「新規状態動作確認」常時可能化
  - race fix v2 設計時の伏線「将来クリア機能」を地雷ゼロで実装
- 次工程 A-4(チャットコマンド + 到達点検 + プライバシー漏洩点検)で:
  - MenuDrawer 経路 + チャットコマンド経路の **二重到達網羅性** を点検
  - 18 機能 + 公開 `/u` `/p` への到達確認
  - worldview_tags 英語スラッグ非露出 全 reply 検証

### 次工程
1. オーナーレビュー → 推奨案確定(メニュー項目 / 新しいチャット案 A / MenuDrawer 配置 b)
2. A-3 実装(本 doc Step 1-7・別 commit)
3. A-4 着手判断(本日続行 or 別 Sprint)
