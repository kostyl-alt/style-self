# STYLE-SELF D-1 実装設計 — 自然言語オーバーレイ(18機能を1入口に)

作成日: 2026-05-19
位置づけ: MVP(M1〜M5)完結後の **UX 再編フェーズ第一弾**。既存 18 機能を温存しつつ、
          1 つの自然言語入口を新層として被せ、中心動線(診断 → 世界観 → 商品 → 投稿 → 繋がる)を
          「→」として表現する。
          上位 = [docs/STYLE-SELF_ビジョン統合マップ.md](STYLE-SELF_ビジョン統合マップ.md)
ステータス: 設計確定。この順序で実装する。
前提: M1〜M5 完結(origin/main HEAD = `0f86efc` 時点で M5-4a 完了・楽天 83 件 coreTags 付与済・
      ②変換空回り解消を実機実証)。

---

## 0. D-1 の本質

```
MVP(M1〜M5): 機能はすべて揃った
  ├ M1 診断・M2 公開・M3 投稿・M4 マッチング・M5 商品提案
  └ → 18 機能(5 BottomNav タブ + 13 サブタブ + new-post 等)

しかしオーナーの違和感:
  「ボタンが多く分散していて分かりにくい」
  「ChatGPT のように『少ない入口で多機能』にしたい」

棚卸し実物で確定した問題:
  ・引き出し合計 18(ボトム 5 + サブ 13)
  ・世界観関連が 4 箇所に分散(/home /self /discover /u/[id])
  ・カルチャー 2 箇所重複(/home + /discover)
  ・M5 商品提案が /outfit「理想を探す」サブタブ内のみ = 発見極めて困難
  ・診断完了 → 次に何をすべきか の明示動線がコード上不在
  ・中心動線「→」がコード上一切表現されていない(並列カタログ構造)
```

D-1 = **「機能追加でなく『18 機能を世界観で 1 本に繋ぐ 1 入口』を新層として被せる」**。
オーバーレイ型で既存 18 機能・全ルート・M2-3 プライバシー・M4-2 RLS・M3 画像処理は
**一切変更しない**。中心動線「→」を意図ルーターで自然言語から駆動する。

---

## 1. 確定した設計判断(オーナー確定)

```
判断1: D-1 オーバーレイ型(既存温存・新層追加のみ)
       既存 18 機能・全ルート・M2-3/M4-2/M3 プライバシー設計を一切変更しない

判断2: 確定スコープは ①②③(②③は利用者の声で必須化済)
       ① 意図ルーター + 既存 18 機能配線
       ② ムードボード
       ③ リアル試着(自分写真 + 服 → 着せた合成画像生成)

判断3: 統一実装基盤 = callClaudeJSON + Haiku 4.5
       M5-4a `0f86efc` で lazy 化済の lib/claude.ts を再利用。
       意図分類は単純タスク・Haiku で十分・¥0.001/件想定。

判断4: 繋ぎ方の 3 分類(intent 出力に mode を含める)
       - mode: "api"      → 既存 API を直叩いて結果を対話で返す(7 機能)
       - mode: "navigate" → 既存ページに誘導する(8 機能)
       - mode: "hybrid"   → API 結果を対話表示しつつ編集はページ誘導(3 機能)

判断5: state は MVP stateless 開始
       1 発言 = 1 intent。会話履歴は D-1 後半または将来段階で追加。
       「さっきの〜」は MVP では未対応・該当時は再入力を促す。

判断6: ★ ③ は D1-3 完了後の GO ゲートで再判断
       D1-4(調査専用ステップ)を挟む。外部 try-on API 選定 + コスト見積もり +
       プライバシー設計確定 + 規約整備が GO 条件。
```

---

## 2. 真因 / 背景(棚卸し実物で確定)

### 構造的問題(2026-05-19 棚卸しで実測確定)

| 観点 | 実測値 / 実物根拠 |
|---|---|
| 引き出し総数 | **5 BottomNav + 13 サブタブ + new-post 等 = 18 機能の並列カタログ** |
| 世界観関連の分散 | **4 箇所**(`/home` 表示 / `/self` タブ / `/discover/?tab=worldview-match` / `/u/[id]` 公開)|
| カルチャー重複 | **2 箇所**(`/home` セクション + `/discover` タブ)|
| M5 商品提案の発見性 | `/outfit` → 「理想を探す」サブタブ → virtual-coordinate 経由でのみ表示 = 4 階層目 |
| 「→」のコード上の表現 | **不在**(各機能は別タブ・別サブタブで並列・遷移ヒントなし)|
| `/self` の負荷 | サブタブ 5 + Link/button 24 + ファイル約 800 行 = 最も重い画面 |
| 新規ユーザー動線 | onboarding 完了後の明示遷移なし(grep 0 件)|

→ オーナーの違和感「ボタンが多い・分散」は **実物にもそのまま現れている構造的問題**。
機能追加でなく「並列カタログを 1 入口に集約する新層」が必要。

### 中心動線が無いことの実害

```
診断 → 世界観 → 商品 → 投稿 → 繋がる

これが各 5 BottomNav タブにバラバラに配置されており、
ユーザーが自力で動線を組み立てる必要がある = ChatGPT 的体験と真逆。
```

D-1 はこの「→」を自然言語入口で表現する。「○○したい」と書けば、その時点で次にやるべきことが
自動で見える。

---

## 3. D-1 の隠れ地雷(M2-3 / M4-2 / M4-4 / M5 教訓を継承)

### 🔴 地雷1: オーバーレイが既存 DB を直接触らない境界線(最重要)

```
オーバーレイは「対話 UI + 意図ルーター API + 既存 API 直叩き」の 3 層構造。
既存 DB を直接 SELECT/INSERT/UPDATE しない設計が必須。

理由:
  - M2-3 プライバシー(SELECT 列絞り)
  - M4-2 RLS(public_users view 経由)
  - M5 coreTags 並列(設計思想 B)
  すべて「既存 API 内で守られている」前提。
  オーバーレイから DB 直接触ると これらの守り を迂回しうる。

対策:
  - オーバーレイは既存 API(/api/ai/* /api/match/* /api/products/match /api/posts)経由のみ
  - 新規 API は /api/overlay/intent のみ(意図分類専用・DB 触らない)
  - 例外なし。設計時に逸脱しそうな箇所は審査
```

### 🔴 地雷2: 意図分類の誤判定 → 別機能起動

```
「商品検索」と言ったのに診断が起動する等の事故。

対策:
  - intent 出力に confidence を含める
  - confidence 低時(< 0.7 等)は「○○ですか?」確認 + 候補 2-3 個提示の対話 fallback
  - ユーザー選択肢を返す配信形式(自動実行しない)
  - 既存 機能列挙を systemPrompt に明示 enum で渡す(辞書外を返させない・M5-2 と同型)
```

### 🔴 地雷3: ③リアル試着の顔写真漏洩(★最大の地雷)

```
ユーザーの顔・身体写真を外部 API に送信する設計。
M2-3「量産型」HTML inline 漏洩 / M3 EXIF/GPS 構造的除去 の教訓を最大適用すべき場所。

対策(D1-4 で確定):
  - 外部 API は no-data-retention 契約のもののみ選定
  - 専用バケット tryon-images + RLS foldername[1]=auth.uid()
  - アップロード時に M3 processImageForUpload 経由必須(EXIF 除去)
  - default 非公開(is_public=false)
  - 公開は M3-4 既存フロー(/p/[id] 投稿)にオプトイン合流のみ
  - 顔写真の本人責任を規約に明示
  - 顔検出 + 「本人ですか?」確認(技術的補助・法的責任はユーザーに残る)
```

### 🔴 地雷4: ③コスト爆発

```
M5-4a の Haiku ¥0.001/件 とはオーダーが違う。
virtual try-on は ¥10-30 / 1 試着。100 アクティブユーザー × 月 10 回 = ¥10k-30k/月。

対策:
  - 月 N 回制限を DB で管理(users.tryon_count_month など)
  - 上限到達時はフォールバック(「来月再開」等)
  - 利用ログを残し可視化
  - D1-4 でコスト見積もりを実測 → GO 判断後に D1-5 実装
```

### 🔴 地雷5: 既存 BottomNav との共存

```
オーバーレイは追加層。既存 BottomNav 5 タブを消すか・隠すか・共存させるかの判断。

対策(MVP):
  - 既存 BottomNav は完全保持(オーナーの「全機能を残したい」要件)
  - オーバーレイは追加 UI(FAB / 上部入力欄)で被せる
  - 既存タブからの遷移も維持(オーバーレイ未使用ユーザーへの後方互換)
  - 将来 D-2 で BottomNav 簡素化を再検討(本ドキュメントスコープ外)
```

### 🔴 地雷6: 会話履歴 state が無いことのユーザー混乱

```
MVP stateless では「さっきの理想コーデの商品をマッチ」が動かない。

対策(MVP):
  - intent 出力に「直前の入力が必要です」フォールバック intent を含める
  - 会話 UI で過去発話を画面上に表示(UI 上は履歴あり・サーバ側は stateless)
  - 将来 D-1 後半で会話履歴 state を追加
```

### 🔴 地雷7: middleware.ts への新ルート追加

```
- /api/overlay/* は api/ 配下 → middleware の matcher で除外済(影響なし)
- 新規画面(/overlay 等を作る場合)は middleware.ts:39 の appRoutes に追加が必要

対策:
  - MVP は新規画面ルートを作らず、既存ページにオーバーレイ UI を被せる方式で開始
  - 必要になったら appRoutes に追加(タブ追加と同型)
```

### 🔴 地雷8: ムードボード公開 RLS

```
新規テーブル moodboards / moodboard_items に M3 と同型の二重ポリシーが必要。
本人 FOR ALL + 公開行 SELECT を最初から組む(M3-1 確立パターン)。

対策:
  - M3-1 migration(024)の RLS パターンをそのまま流用
  - is_public default false(オプトイン公開)
```

### 🔴 地雷9: 公開ページ URL 互換

```
- /u/[id] / /p/[id] は M2-3 / M3-4 で SNS シェア用に確立
- D-1 で絶対に URL 構造を変えない

対策:
  - オーバーレイから人/投稿へ遷移する場合は href={`/u/${id}`} / `/p/${id}` を維持
  - 新規 URL を作らない
```

### 🔴 地雷10: M2-3/M4 プライバシー(worldview_tags 非露出)

```
オーバーレイが対話で「あなたの世界観は dark / minimal です」のような表示で
英語スラッグを露出するとレグレッション。

対策:
  - 意図ルーターは内部処理用・対話表示には日本語 worldview_name / coreIdentity 等を使う
  - M4 で確立した「common_tag_count 数値のみ抽象表現」を守る
  - View Source 漏洩点検を D1-2 完了時に実施(M4 同型)
```

### 🔴 地雷11: 旧ルート redirect shim 9 個

```
/shop /style /closet /learn /coordinate /inspire /profile /wardrobe /worldview
すべて既存 BottomNav 内タブへの redirect。

対策:
  - D-1 では一切触らない(将来 D-2 で再検討)
  - オーバーレイは新規 URL に依存しない
```

### 🔴 地雷12: M5 検証データ残置

```
6 ペルソナ + 10 投稿 + 6番目 No Diagnosis が本番 DB に残置中。
D-1 検証中も残置(マッチ素材として有用)・最終 teardown は MVP 完結時に判断。
```

---

## 4. アーキテクチャ

### 4.1 `/api/overlay/intent` 設計

```
POST /api/overlay/intent
  body:    { utterance: string, contextHint?: string }
  cookie:  認証必須(既存パターン同等)
  returns:
    {
      ok:          true,
      intent:      "match-users" | "virtual-coordinate" | "diagnosis" | ...,
      mode:        "api" | "navigate" | "hybrid",
      params:      { ... },          // API 直叩き時の payload(該当 API の body 形)
      route:       "/discover?tab=worldview-match",  // navigate 時の遷移先
      confidence:  0.0 - 1.0,
      suggestions?: [                // confidence 低時の候補 2-3
        { intent: "...", label: "○○ですか?" }
      ],
    }

実装方針:
  - lib/claude.ts の callClaudeJSON + HAIKU_MODEL を使用
  - systemPrompt に 既存 18 機能の intent 列挙(enum)+ 各機能の説明を明示
  - userMessage = utterance を渡す
  - JSON 構造化出力で {intent, mode, params, confidence} を取り出し
  - M5-2 と同型の「辞書外を返させない」厳格 prompt
  - 失敗時は fallback intent("unknown")+ 候補 2-3 提示
```

### 4.2 既存 18 機能の intent 対応表

| # | 機能 | 起動 API / 遷移先 | mode | 根拠 |
|---|---|---|---|---|
| 1 | 世界観診断 | `/onboarding` | **navigate** | 16 問 + 体型 + 確認・対話 1 往復では収まらない |
| 2 | 公開プロフィール表示 | `/u/[id]` | **navigate** | URL シェアが本質的価値 |
| 3 | 公開設定変更 | `/self?tab=worldview` | **navigate** | 設定 UI 必要 |
| 4 | AI コーデ提案 | `POST /api/ai/coordinate` | **api** | 1 ターン応答可能 |
| 5 | 着こなし相談 | `POST /api/ai/style-consult` | **api** | 対話と相性良 |
| 6 | 理想コーデ生成 | `POST /api/ai/virtual-coordinate` body `{scene, concept, mood}` | **hybrid** | 結果対話表示 + 編集なら `/outfit?tab=virtual` 誘導 |
| 7 | 商品マッチ(M5) | `POST /api/products/match` body `{items, conceptKeywords, ngElements, coreTags}` | **hybrid** | items 必須・virtual-coordinate 経由で得る前提 |
| 8 | 人マッチ(M4)| `GET /api/match/users?limit=` | **api** | cookie 認証・1 ターンで返る |
| 9 | 投稿マッチ(M4) | `GET /api/match/posts?limit=` | **api** | 同上 |
| 10 | 投稿作成 | `/self/new-post` | **navigate** | EXIF 除去・HEIC・Storage 重い |
| 11 | 投稿閲覧 | `/p/[id]` | **navigate** | URL シェア本質 |
| 12 | 自分の投稿一覧 | `/self?tab=posts` | **navigate** | 管理 UI 必要 |
| 13 | クローゼット | `/outfit?tab=closet` | **navigate** | 一覧 + 編集 UI |
| 14 | インスピレーション(抽象語コーデ) | `POST /api/ai/abstract-coordinate` | **api** | 対話と相性良 |
| 15 | ブランド推薦 | `POST /api/brands/recommend` | **api** | 単発レスポンス |
| 16 | カルチャー解説 | `POST /api/ai/culture-explain` | **api** | 30 日キャッシュあり |
| 17 | 保存一覧 | `/saved` | **navigate** | 一覧 UI |
| 18 | 履歴 | `/self?tab=history` | **navigate** | 一覧 UI |

**集計**: api=**7** / navigate=**8** / hybrid=**3** = 計 18(全機能網羅)

### 4.3 オーバーレイ UI の配置

| 候補 | 評価 | 採用 |
|---|---|---|
| (A) FAB(右下浮動ボタン)→ タップでモーダル展開 | BottomNav と被らない・モーダル内で対話 | ★ 推奨(MVP)|
| (B) 上部固定入力欄(常時表示)| 入口の発見性最高・スクロールで邪魔になる | 検討余地 |
| (C) 専用画面 `/overlay` | 中心動線として最強だが既存 BottomNav の意味が薄れる | D-2 で検討 |

→ **MVP は (A) FAB + モーダル**で開始・BottomNav と完全共存。

### 4.4 既存機能を「壊さない」境界線(明文化)

```
オーバーレイの責務:
  ・ 自然言語入力 → 意図分類(/api/overlay/intent)
  ・ 既存 API を呼ぶ(同一オリジン fetch・cookie 自動引継)
  ・ 結果を対話 UI で表示 or 既存ページへ遷移

オーバーレイがしないこと(★絶対不可侵):
  ・ 既存 DB を直接 SELECT/INSERT/UPDATE しない
  ・ M2-3 SELECT 列絞り / M4-2 public_users view / M5 coreTags 並列 を迂回しない
  ・ 既存 API の入出力契約を変更しない
  ・ 既存ルート / URL 構造を変更しない
  ・ 既存 BottomNav / サブタブを変更しない(MVP)
  ・ worldview_tags 英語スラッグを対話 UI に露出しない(M4 教訓)
  ・ service_role を使わない(MVP)
```

---

## 5. ステップ分割(確定)

### D1-1: 意図ルーター API + オーバーレイ UI 骨格

| 項目 | 内容 |
|---|---|
| 新規ファイル | `app/api/overlay/intent/route.ts` / `lib/prompts/overlay-intent.ts` / `components/overlay/OverlayFab.tsx` / `components/overlay/OverlayModal.tsx` |
| 既存変更 | `app/(app)/layout.tsx` に `<OverlayFab />` 1 行追加(M4-4 DevAuthBadge と同型)|
| 外部依存 | なし(Haiku ¥0.001/件)|
| 完了条件 | FAB タップでモーダル開く・入力 → intent JSON が返る・confidence 表示 |
| 地雷度 | **低** |

### D1-2: ①18 機能の intent 配線

| 項目 | 内容 |
|---|---|
| 変更 | `OverlayModal.tsx` 内で intent ごとに分岐(api/navigate/hybrid)|
| api 機能(7)| 同一オリジン fetch + 結果を対話表示 |
| navigate 機能(8)| `router.push(route)` + モーダル閉じる |
| hybrid 機能(3)| api で得た結果を対話表示 + 「編集する」ボタンで navigate |
| 誤判定 fallback | confidence < 0.7 → 候補 2-3 表示 → ユーザー選択 → 再実行 |
| 完了条件 | 全 18 機能に到達可能・誤判定時 fallback 動作 + worldview_tags 漏洩ゼロ点検 |
| 地雷度 | **中** |

### D1-3: ②ムードボード

| 項目 | 内容 |
|---|---|
| 新規 migration | `026_d1_moodboards.sql`(`moodboards` + `moodboard_items` + RLS 二重ポリシー・M3-1 同型)|
| 新規 Storage バケット | `moodboard-images`(M3 POST_BUCKET 同型運用)|
| 新規 API | `/api/moodboards/route.ts`(CRUD)|
| UI | オーバーレイの intent="create-moodboard" / "view-moodboard" 等から到達 |
| 再利用 | M3 [image-pipeline.ts](../lib/utils/image-pipeline.ts) + [storage.ts](../lib/storage.ts) パターン |
| 外部依存 | なし(M3 資産再利用)|
| 完了条件 | 画像追加/削除 + 公開トグル + /u/[id] で公開ボードが見える(M3-4 と同型導線)|
| 地雷度 | **中**(RLS 二重防御)|

### ★ D1-3 完了後 GO ゲート ★

```
D1-3 完了時点で:
  ・ ①②が安全に動作確認(漏洩ゼロ・既存無影響・auth/RLS 正常)
  ・ コスト実測(Haiku ¥0.001/件・Storage 無料枠内)

D1-4 以降(③)の実装 GO は ここで再判断:
  - 外部 try-on API 選定が完了したか
  - コスト見積もりが許容範囲か(月 N 回制限の試算)
  - プライバシー設計が確定したか
  - 規約整備の準備があるか
  - これらの GO 条件が揃わなければ D-1 は ①②までで一時停止
```

### D1-4: ③ 調査専用ステップ(実装なし)

| 項目 | 内容 |
|---|---|
| 調査 1 | 外部 try-on API 候補比較(fal.ai virtual-tryon / Replicate IDM-VTON / Google Gemini 2.5 image-gen / Kling 等)|
| 調査 2 | 各候補の no-data-retention 契約 / API 利用規約 / 1 枚あたり料金 |
| 調査 3 | コスト見積もり(M5-4a 同型・1 ユーザー月 N 回想定)|
| 調査 4 | プライバシー設計確定(セクション 6 参照)|
| 調査 5 | 規約整備(顔写真本人責任 / アップロード対象が本人であることの確認)|
| 完了条件 | D1-5 実装 GO 判断材料が揃う |
| 地雷度 | (実装なし)|

### D1-5: ③ リアル試着実装

| 項目 | 内容 |
|---|---|
| 新規 migration | `027_d1_tryon.sql`(`tryon_history` + RLS + 月 N 回制限 column)|
| 新規 Storage バケット | `tryon-images`(専用・本人専用 RLS)|
| 新規 API | `/api/tryon/route.ts`(POST: 服画像 + 自分画像 → 外部 API → 合成画像 URL 返却)|
| 新規プロンプト / SDK | 選定された外部 API のクライアント追加 |
| UI | オーバーレイ intent="virtual-tryon" → 自分画像アップロード(M3 パイプライン経由)+ 服指定 → 結果表示 |
| 利用回数制限 | 月 N 回 / ユーザー(N は D1-4 で決定)|
| 公開フロー | default 非公開・公開は M3-4 既存 `/p/[id]` フローにオプトイン合流 |
| 外部依存 | 外部画像生成 API(D1-4 で選定)|
| コスト | ¥10-30 / 試着 |
| 完了条件 | 試着画像生成成功 + EXIF 除去 + RLS 本人専用 + 利用回数制限動作 + プライバシー漏洩ゼロ |
| 地雷度 | **★最大**(顔写真 + コスト)|

### 依存関係

```
D1-1(意図ルーター + UI 骨格)
  ↓ 新規外部依存ゼロ・Haiku のみ
D1-2(18 機能配線)
  ↓ 既存 API 直叩き / navigate / hybrid を全網羅
D1-3(ムードボード)
  ↓ M3 資産再利用・新規外部依存ゼロ
★ D1-3 完了後 GO ゲート ★
  ↓
D1-4(③調査専用・実装なし)
  ↓ GO 条件が揃えば
D1-5(③実装・最大地雷)
  ↓
D-1 完結
```

---

## 6. ③ リアル試着 プライバシー設計(M2-3 / M3 教訓の最大適用先・専章)

ユーザーの顔・身体写真を扱う最も繊細な機能。M2-3「画面に出ていなくても HTML に漏れる」/
M3「EXIF/GPS 構造的除去」の教訓を最大限適用する。

### 6.1 設計原則 8 項目(D1-4 で確定 → D1-5 で実装)

| # | 原則 | 実装 |
|---|---|---|
| 1 | **自分写真は本人専用バケット**(`tryon-images`)| Storage RLS `foldername[1]=auth.uid()` で本人のみアクセス可(M3 POST_BUCKET 同型)|
| 2 | **default 非公開**(`is_public=false`)| `tryon_history.is_public` 列 + 二重ポリシー(本人 FOR ALL + 公開行 SELECT・M3-1 同型)|
| 3 | **EXIF/GPS 必ず除去**(M3 パイプライン経由)| `processImageForUpload()` を必ず通る・raw File 直送禁止 |
| 4 | **外部 API はデータ保持なし契約のもののみ**| D1-4 で選定。fal.ai 等の no-retention オプション有 API を優先 |
| 5 | **公開はオプトインで M3-4 既存フローに合流**| 「投稿として公開する」ボタン → `/api/posts` POST(M3 既存)|
| 6 | **顔写真の本人責任を規約で明示**| 規約整備(D1-4)・アップロード前に同意チェック |
| 7 | **顔検出 + 「本人ですか?」確認(技術的補助)**| Vision API で顔検出・ただし最終責任はユーザー |
| 8 | **試着結果の生成画像も EXIF 除去経由で保存**| 外部 API レスポンス → Storage 保存時に再度 EXIF 除去パイプライン |

### 6.2 顔写真漏洩経路の遮断(M2-3 教訓継承)

```
M2-3 で「画面に出ていない量産型」が HTML ソースに 6 回 inline 漏洩した教訓。

リアル試着で警戒すべき経路:
  - API レスポンスに自分写真の Storage URL が含まれて他人ページに混入する経路
  - 試着履歴(tryon_history)を他人が SELECT できる経路(RLS 漏れ)
  - 公開オプトイン後に投稿として is_public=true になった画像が
    M3-4 既存フロー外で露出する経路

遮断:
  - tryon_history テーブル RLS: 本人 FOR ALL のみ(公開行 SELECT は無し)
    公開する場合は posts に「コピー」する設計(tryon と posts は別世界)
  - Storage RLS: tryon-images バケットは本人のみ(default policy で公開行 SELECT を持たない)
  - View Source 点検を D1-5 完了時に実施(M4-4 同型・私が静的解析で見落とした
    runtime レベルの漏洩経路がないか実機で確認)
```

### 6.3 本人責任の明示

```
規約に以下を明記(D1-4 で文面確定):
  - アップロードする画像は本人のものに限る
  - 他人の顔写真をアップする行為は禁止
  - 違反時のアカウント停止
  - 外部 API へのデータ送信に同意する
  - 生成画像の二次利用範囲
```

---

## 7. コスト管理(③)

### 7.1 月 N 回制限の設計方針

```
新規 column:
  users.tryon_month_key text   -- "2026-05" 等
  users.tryon_month_count int default 0

API 実行時:
  1. 現在月のキーと count を読む
  2. 月が変わっていたら count をリセット(SQL CASE で）
  3. count < N なら処理続行・count++ で UPDATE
  4. count >= N なら 429 + 「来月再開」表示

N の値:
  D1-4 で決定。MVP 想定 = 10 回 / 月(¥100-300 / ユーザー)
```

### 7.2 利用ログ

```
新規テーブル tryon_history:
  id, user_id, source_image_url, garment_image_url, result_image_url,
  cost_jpy(参考), status(success/failed), created_at

→ 利用パターン分析 + コスト実測 + 異常検知に使う
```

### 7.3 上限到達時のフォールバック

```
1. 429 レスポンス + 残り日数 / 来月再開予定日表示
2. 公式お問い合わせ導線(優先利用枠の販売検討は将来)
3. オーバーレイは「今月の試着回数を使い切りました」と対話で返す
```

---

## 8. スコープ外 / 将来

```
- 会話履歴 state(D-1 後半 または将来)
  → MVP は stateless で開始

- D-2 フルリプレース(既存 BottomNav 簡素化)
  → 別フェーズ。D-1 完結後に再判断

- ビジョン 6 ドキュメントの統合
  → 別フェーズ。docs/STYLE-SELF_ビジョン統合マップ.md と本ドキュメントは並立

- 試着画像の AI による顔ぼかし(公開時)
  → 将来。MVP は default 非公開で代替

- AI 画像生成によるムードボード生成
  → 将来。MVP は (a) ユーザーアップロード + (b) 既存画像を集める の 2 経路

- 利用枠の有料化 / プレミアム
  → MVP 完結後の運用判断

- D1-3 完了後の GO ゲートで NO と判断した場合
  → ③ なしで D-1 完結。①② のみで「18 機能を 1 入口」は成立
```

---

## 9. M1〜M5 由来パターンの踏襲(明記)

D-1 は以下を完全踏襲する:

| パターン | 出典 | D-1 で使う場所 |
|---|---|---|
| 「推測で直さず実物根拠で真因確定」 | M3-5 / M4-2 / M4-4 / M5 | 棚卸し実物で確定済・D-1 全工程で同様 |
| ★ worldview_tags 英語スラッグを UI に露出しない | M2-3 / M4-2 教訓 | D1-2 完了時に View Source 漏洩点検 |
| 既存系を壊さない最小差分 | M3-5 / M4-4 | オーバーレイは新層追加のみ・既存ファイル変更は最小 |
| anon client + RLS + 列絞り | M3-4 / M4 / M5 | オーバーレイは既存 API 経由のみ・直接 DB 触らない |
| service_role 不使用 | M3 全体 / M4 全体 | D-1 全体(D1-5 の Storage 書込みも anon + RLS で完結)|
| M3 画像処理パイプライン | M3-2 | D1-3 / D1-5 で再利用(EXIF 除去・HEIC・リサイズ)|
| Storage バケット運用 | M3 POST_BUCKET | D1-3 moodboard-images / D1-5 tryon-images |
| RLS 二重ポリシー(本人 FOR ALL + 公開行 SELECT)| M3-1 / M2-1 | D1-3 moodboards |
| 公開 URL 互換 | M2-3 / M3-4 | /u/[id] / /p/[id] 構造維持 |
| fallback HTTP 200(reason)| M3-4 / M4-2 / M4-3 | /api/overlay/intent も同型(認証 NG → 200 + reason)|
| 設計→実装→実機確認→docs 記録 | M2-5 / M3-5 / M4-5 / M5 | D-1 各ステップで「知見」追記 |

---

## 10. オーナー実機確認の要点(M2 / M3 / M4 / M5 教訓)

```
D1-1 後: FAB タップ → モーダル開く + 1 発話で intent JSON が返る
D1-2 後:🔴 18 機能全てに到達できる + 誤判定 fallback 動作 +
         View Source で worldview_tags 英語スラッグ漏洩ゼロ点検(M4 同型)
D1-3 後: ムードボード作成 + 公開 トグル + /u/[id] で公開ボードが見える +
         非公開ボードが他者から見えない(M3-4 同型)
★ D1-3 完了 = GO ゲート審査 ★
D1-4 後: コスト見積もり + プライバシー設計確定 + 規約整備完了
D1-5 後:🔴 試着画像生成 + 本人専用 RLS + 月 N 回制限動作 +
         顔写真漏洩経路ゼロ(View Source + Network + Storage URL 直叩き)
D-1 完結: 自然言語入口 1 つから 18 機能 + ムードボード + リアル試着の
         全てに到達できる(中心動線「→」が成立)
```

---

## 11. このドキュメントの位置づけ

```
docs/STYLE-SELF_ビジョン統合マップ.md(最上位)
  ├ STYLE-SELF_診断システム_再設計.md(①知る 思想)
  ├ STYLE-SELF_フェーズB_実装設計.md(①知る 実装・完了)
  ├ STYLE-SELF_M2_実装設計.md(③繋がる 土台・完了)
  ├ STYLE-SELF_M3_実装設計.md(③繋がる 基盤・完了)
  ├ STYLE-SELF_M4_実装設計.md(③繋がる 本体・完了)
  ├ STYLE-SELF_M5_実装設計.md(②変換 本体・完了)
  ├ STYLE-SELF_D1_実装設計.md(このファイル・UX 再編第一弾・自然言語オーバーレイ)
  └ M4_test_data_ledger.md(検証データ台帳)

M2 / M3 / M4 / M5 と同じ「調査→設計→ステップ実装」の型。
D-1 は 5 ステップ(D1-1〜D1-5)+ D1-3 後 GO ゲート + D1-4 調査専用ステップ。
```
