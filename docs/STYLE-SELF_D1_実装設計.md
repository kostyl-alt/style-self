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

## 0. D-1 の本質(対話中心・改訂版)

```
MVP(M1〜M5): 機能はすべて揃った
  ├ M1 診断・M2 公開・M3 投稿・M4 マッチング・M5 商品提案
  └ → 18 機能(5 BottomNav タブ + 13 サブタブ + new-post 等)

しかしオーナーの違和感:
  「ボタンが多く分散していて分かりにくい」
  「ChatGPT / Gemini / Claude Code のような対話形式が良い」

棚卸し実物で確定した問題:
  ・引き出し合計 18(ボトム 5 + サブ 13)
  ・世界観関連が 4 箇所に分散(/home /self /discover /u/[id])
  ・カルチャー 2 箇所重複(/home + /discover)
  ・M5 商品提案が /outfit「理想を探す」サブタブ内のみ = 発見極めて困難
  ・診断完了 → 次に何をすべきか の明示動線がコード上不在
  ・中心動線「→」がコード上一切表現されていない(並列カタログ構造)
```

### 改訂のきっかけ(2026-05-19 オーナー実機フィードバック)

```
当初は navigate 中心(intent 判定→ router.push で既存画面に飛ばす)で D1-2a を実装。
実機確認で「俺ですら使いにくい・離脱が多すぎる。ChatGPT / Claude Code のような
対話形式が良い」とのオーナー判断。体験方針を navigate 中心 → 対話中心 に転換。
詳細経緯は docs/STYLE-SELF_D1_対話中心_改訂案.md(本本体に統合済)。
```

### D-1 の本質(対話中心)

```
D-1 = 「18 機能を 1 つの対話画面で 1 本に繋ぐ 1 入口」を新層として被せる。

普通の応答は対話画面の中で完結し、
専用 UI が本質的に必要な機能だけ「○○しますね →」と一拍置いて引き継ぐ。

= ChatGPT / Claude / Gemini / Claude Code が、
  普通の応答は会話で返し、画像生成・コード編集・ファイル操作などの
  「本質的に専用 UI が要るもの」だけキャンバスや専用 UI に展開するのと同じ思想。
```

オーバーレイ型で既存 18 機能・全ルート・M2-3 プライバシー・M4-2 RLS・M3 画像処理は
**一切変更しない**。中心動線「→」を意図ルーター + 対話の流れで自然言語から駆動する。

---

## 1. 確定した設計判断(オーナー確定・対話中心 5 判断を含む)

```
判断1: D-1 オーバーレイ型(既存温存・新層追加のみ)
       既存 18 機能・全ルート・M2-3/M4-2/M3 プライバシー設計を一切変更しない

判断2: 確定スコープは ①②③(②③は利用者の声で必須化済)
       ① 意図ルーター + 既存 18 機能配線(対話完結 8 + 専用 UI 引き継ぎ 10)
       ② ムードボード
       ③ リアル試着(自分写真 + 服 → 着せた合成画像生成)

判断3: 統一実装基盤 = callClaudeJSON + Haiku 4.5
       M5-4a `0f86efc` で lazy 化済の lib/claude.ts を再利用。
       意図分類は単純タスク・Haiku で十分・¥0.001/件想定。

判断4: 機能の 2 分類(対話中心・改訂後)
       - 対話完結         (8 機能): 結果を吹き出し / 結果カードで返し対話の中で見せる
       - 専用 UI 引き継ぎ (10 機能): 「○○しますね →」ボタン + navigate-map 転用で
                                      専用画面に滑らかに引き継ぐ
       (旧 navigate / api / hybrid の 3 分類は廃止・上記 2 分類に統合)

判断5: ★ オーナー実機フィードバックを受けた 5 判断(対話中心化の確定)
       ① 対話画面の表示形態     = モーダル拡張(全画面化は将来検討)
       ② 会話文脈の永続化       = セッション内 React state のみ(MVP)
                                  localStorage / DB 保存は将来
       ③ virtual-coordinate → product-match 連鎖 = MVP に含む
                                  (product-match は単独叩き不可と D1-2a で確定済)
       ④ 本体設計書の改訂タイミング = 改訂を先行し、実装は本体改訂後
       ⑤ ?tab= バグ修正(/self が useSearchParams を読まない既存仕様の不具合)
                                  = D1-2x として独立 commit

判断6: ★ ③ は D1-3 完了後の GO ゲートで再判断(★完全不変)
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

### 🔴 地雷5: 既存 BottomNav との共存(★判断5-①: モーダル拡張で確定)

```
オーバーレイは追加層。既存 BottomNav 5 タブを消すか・隠すか・共存させるかの判断。

対策(MVP・判断5-①: モーダル拡張で確定):
  - 既存 BottomNav は完全保持(オーナーの「全機能を残したい」要件)
  - オーバーレイは追加 UI(FAB + モーダル拡張)で被せる
  - 全画面化は MVP では採用せず・将来検討
  - 既存タブからの遷移も維持(オーバーレイ未使用ユーザーへの後方互換)
  - 将来 D-2 で BottomNav 簡素化を再検討(本ドキュメントスコープ外)
```

### 🔴 地雷6: 会話履歴 state(★判断5-②: セッション内 state で確定)

```
対話中心なので「さっきの理想コーデの商品をマッチ」を成立させる必要がある。
特に virtual-coordinate → product-match 連鎖は MVP 含有(★判断5-③)。

対策(MVP・判断5-② 確定):
  - 会話文脈はセッション内 React state のみで保持(永続化なし)
  - モーダル/オーバーレイを閉じると履歴消滅(MVP 想定の体験)
  - 直前の virtual-coordinate 結果(items + conceptKeywords + coreTags)を
    state に保持し、product-match 連鎖で再利用
  - localStorage / DB 保存は将来(MVP 範囲外)
  - 上記以外の「さっきの〜」は MVP 未対応・該当時は再入力誘導
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

### 4.1 `/api/overlay/intent` 設計(★ D1-1 で実装済・対話中心化で不変)

```
POST /api/overlay/intent
  body:    { text: string }
  cookie:  認証必須(既存パターン同等・anon client)
  returns:
    {
      ok:          true,
      intent:      "match-users" | "virtual-coordinate" | "diagnose" | ...,
      mode:        "api" | "navigate" | "hybrid" | "none",
      params:      { ... },          // API 直叩き時の payload(該当 API の body 形)
      confidence:  0.0 - 1.0,
      suggestions?: [                // confidence 低時の候補 2-3
        { intent: "...", label: "○○ですか?" }
      ],
    }

実装(D1-1 commit 6acfec9・対話中心化後も変更なし):
  - lib/claude.ts の callClaudeJSON + HAIKU_MODEL を使用
  - systemPrompt に 既存 18 機能の intent 列挙(enum)+ 各機能の説明を明示
  - JSON 構造化出力で {intent, mode, params, confidence, suggestions} を取り出し
  - 辞書外を返した場合は ALLOWED_INTENTS / ALLOWED_MODES のフィルタで弾く
  - 失敗時は fallback intent("unknown" / mode="none")+ 候補 2-3 提示

★対話中心化での扱い(対話 UI 側の解釈):
  - mode は内部識別子として残るが、対話 UI は最終的に「対話完結 / 引き継ぎ」の 2 分類で処理
  - api / hybrid / none を「対話完結 8 + 連鎖 1」に集約
  - navigate を「専用 UI 引き継ぎ 10」に集約
  - intent ルーター自体は不変・解釈側で対話中心に変換
```

### 4.2 既存 18 機能の対話中心 対応表(対話完結 vs 専用 UI 引き継ぎ)

#### A. 対話完結群(8 機能・吹き出し / 結果カードで返す)

| # | 機能 | intent | API | 対話に乗せる形 |
|---|---|---|---|---|
| 1 | AI コーデ提案 | `coordinate` | POST `/api/ai/coordinate` body `{scene, mood?}` | コーデ JSON を結果カード(各アイテム名 + 色 + 素材 + 理由)で吹き出しに |
| 2 | 着こなし相談 | `style-consult` | POST `/api/ai/style-consult` body `{consultation}` | 相談回答テキストを通常の吹き出しで |
| 3 | インスピレーション | `inspiration` | POST `/api/ai/abstract-coordinate` body `{abstractWords?, theme?}` | 抽象語→コーデを結果カードで |
| 4 | 人マッチ(M4) | `match-users` | GET `/api/match/users?limit=` | 似た人カード列(display_name + worldview_name + 共通点 N) |
| 5 | 投稿マッチ(M4) | `match-posts` | GET `/api/match/posts?limit=` | 投稿サムネ列(image + caption + 共通 N) |
| 6 | カルチャー解説 | `culture` | POST `/api/ai/culture-explain` body `{culturalAffinities}` | music / films / fragrance の 3 セクションカード |
| 7 | ブランド推薦 | `brand-learn` | POST `/api/brands/recommend` body `{styleAnalysis?, userId?}` | ブランドカード列(name + 哲学・worldview_tags は日本語表現で) |
| 8 | 理想コーデ生成(概要)| `virtual-coordinate` | POST `/api/ai/virtual-coordinate` body `{scene, concept, mood?}` | conceptInterpretation + items + 商品概要を結果カードで(詳細編集だけ `/outfit?tab=virtual` 引き継ぎ)|

#### B. 専用 UI 引き継ぎ群(10 機能・「○○しますね →」+ navigate-map 転用)

| # | 機能 | intent | 引き継ぎ先 | 理由 |
|---|---|---|---|---|
| 9  | 世界観診断 | `diagnose` | `/onboarding` | 16 問 + 体型 + 確認・対話 1 往復で完結不能 |
| 10 | 公開プロフィール / 公開設定 | `worldview-profile` | **`/self?tab=diagnosis`** ★ | SelfTab 命名トリック(value=diagnosis = label「世界観」)|
| 11 | 投稿作成 | `create-post` | `/self/new-post` | EXIF 除去 / HEIC / Storage アップロードの専用 UI 必須 |
| 12 | 自分の投稿一覧 | `my-posts` | `/self?tab=posts` | 投稿一覧 + 削除確認モーダルの管理 UI |
| 13 | クローゼット | `closet` | `/outfit?tab=closet` | 一覧 + 編集 |
| 14 | 保存一覧 | `saved` | `/saved` | 3 セクション(コーデ・商品・投稿)|
| 15 | 履歴 | `history` | `/self?tab=history` | AI 履歴一覧(タイプ別カード)|
| 16 | 体型情報編集 | `body-edit` | `/self?tab=body` | フォーム UI |
| 17 | 好み情報編集 | `preference-edit` | **`/self?tab=worldview`** ★ | SelfTab 命名トリック(value=worldview = label「好み」)|
| 18 | 商品マッチ(M5)| `product-match` | virtual-coordinate の連鎖 → `/outfit?tab=virtual` | 単独叩き不可(body に items 必須・virtual-coordinate 結果が前提)|

#### C. 将来機能 2(両用)

| 機能 | intent | 扱い |
|---|---|---|
| ムードボード | `moodboard` | 対話で「ボード作成しますね」→ 作成 UI 起動 / 閲覧は対話に乗せる |
| リアル試着 | `tryon` | 対話で「自分の写真を選んでください」→ アップロード UI → 結果は対話に乗せる |

#### 集計

```
対話完結:           8 機能
専用 UI 引き継ぎ:  10 機能
合計:              18 機能
将来両用:           2 機能(moodboard / tryon)
```

#### ★ 対話中心化 知見(2026-05-19 D1-2a 実機 FB 起点で確定)

> 1. `/self` のタブ命名トリック(配線時の最大の落とし穴・★ 引き継ぎ表で吸収):
>    - SelfTab `value="diagnosis"` → label **「世界観」**(世界観診断結果表示 + 公開設定)
>    - SelfTab `value="worldview"` → label **「好み」**(preference 編集)
>    対応:
>    - `worldview-profile`  → `/self?tab=diagnosis`(value 名と意味が逆転)
>    - `preference-edit`    → `/self?tab=worldview`(同上)
>    → D1-2a で `lib/overlay/navigate-map.ts` に定数化済・対話中心化後も転用。
>
> 2. `/self?tab=` が画面に反映されない既存バグ(D1-2a で顕在化):
>    `/self/page.tsx` は useSearchParams を読まず固定 "diagnosis" 初期値で常に
>    「世界観」タブが開く。`/outfit` `/discover` と同パターン(useSearchParams +
>    useEffect 同期)を追加で修正可能。**D1-2x として独立 commit**(★判断5-⑤)。
>
> 3. `product-match` は単独叩き不可:
>    body に items 必須 = `virtual-coordinate` 結果が前提。
>    対話中心では「virtual-coordinate の連鎖」として処理(★判断5-③ MVP 含む)。

### 4.3 オーバーレイ UI の配置(★判断5-①: モーダル拡張で確定)

| 候補 | 評価 | 採用 |
|---|---|---|
| (A) FAB(右下浮動ボタン)→ タップで**対話モーダル展開** | BottomNav と共存・対話画面はモーダル内で完結 | ★ **MVP 採用**(判断5-①)|
| (B) 全画面オーバーレイ | ChatGPT 型・対話に集中できる | 将来検討(D-2 候補)|
| (C) 専用画面 `/overlay` | 中心動線として最強だが既存 BottomNav の意味が薄れる | 将来検討(D-2)|

#### 対話モーダル UI の構造(D1-2b' で実装)

```
モーダル(D1-1 OverlayModal を拡張):
  上部     : メッセージ履歴(吹き出し列・ユーザー / アシスタント交互)
  中部     : 結果カード(コーデ / 似た人 / 投稿 / カルチャー 等を吹き出し内に展開)
  下部固定 : 入力欄(常時表示・連続発話可能)
  右上     : [×] 閉じる

会話文脈(★判断5-②):
  - セッション内 React state のみ(履歴 / 直前の virtual-coordinate 結果 等)
  - モーダル閉じると state 消滅
  - 永続化(localStorage / DB)は将来
```

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

### D1-1: 意図ルーター API + オーバーレイ UI 骨格(★ 完了・commit 6acfec9)

| 項目 | 内容 |
|---|---|
| 新規ファイル | `app/api/overlay/intent/route.ts` / `lib/prompts/overlay-intent.ts` / `components/overlay/OverlayFab.tsx` / `components/overlay/OverlayModal.tsx` |
| 既存変更 | `app/(app)/layout.tsx` に `<OverlayFab />` 1 行追加(M4-4 DevAuthBadge と同型)|
| 外部依存 | なし(Haiku ¥0.001/件)|
| 完了条件 | FAB タップでモーダル開く・入力 → intent JSON が返る・confidence 表示 |
| 地雷度 | **低** |

→ **対話中心化後も完全に温存**(intent ルーター本体は不変・対話 UI 側で結果の処理方法を変えるだけ)。

### D1-2a: 旧 navigate 配線(★ 完了・commit db63f4f・対話中心化で更新対象)

| 項目 | 内容 |
|---|---|
| 配線 | navigate 群 9 + 未配線案内 3 を OverlayModal.tsx に追加 |
| 新規 | `lib/overlay/navigate-map.ts`(タブ命名トリック吸収済)|
| 設計書 | 本文 7/8/3 を 7/9/2 に修正 + D1-2a 知見(タブ命名トリック)追記 |

→ **navigate-map.ts は破棄せず、専用 UI 引き継ぎ群 10 の URL 表として対話中心化後も転用**。
   OverlayModal.tsx の判定結果分岐は D1-2b' 以降で段階的に対話 UI に書き換え。

### D1-2x: `/self?tab=` バグ修正(★判断5-⑤: 独立 commit)

| 項目 | 内容 |
|---|---|
| 変更 | `app/(app)/self/page.tsx` に useSearchParams + useEffect 同期パターン追加(`/outfit` `/discover` と同型)|
| 差分 | 10-15 行程度 |
| 既存 | 既存 SelfTab / タブ UI / 認証ガードは無変更 |
| 完了条件 | `/self?tab=body` 等の URL で正しいタブが開く(M2 以前から潜在していた既存バグの修正)|
| 地雷度 | **低**(既存仕様のバグ修正のみ・対話中心化と独立)|

→ **D1-2b'(対話 UI 土台)着手前に独立 commit**。専用 UI 引き継ぎ群 10 の遷移が動作する前提。

### D1-2b': 対話 UI 土台(OverlayModal 拡張・★判断5-① モーダル拡張 / ②セッション内 state)

| 項目 | 内容 |
|---|---|
| 変更 | `components/overlay/OverlayModal.tsx` を対話画面に拡張 |
| 構造 | 上部: メッセージ履歴(吹き出し列)/ 中部: 結果カード展開エリア / 下部固定: 入力欄(連続発話)/ 右上: 閉じる |
| state | React state のみで履歴保持(セッション内・モーダル閉で消滅)|
| 入力 | 連続発話可能(履歴が積み上がる)・既存の判定結果分岐(D1-2a)を吹き出しに置換 |
| 既存 | D1-1 `/api/overlay/intent` は無変更で再利用 |
| 完了条件 | モーダルが対話画面として動作・連続発話 → 履歴蓄積 → 結果は吹き出し内に表示される土台ができる |
| 地雷度 | **中**(履歴 state の管理・既存 D1-2a の判定結果 UI と段階置換)|

### D1-2c': 対話完結群 8 配線(結果カード)

| 項目 | 内容 |
|---|---|
| 配線対象 | 対話完結群 8(coordinate / style-consult / inspiration / match-users / match-posts / culture / brand-learn / virtual-coordinate 概要)|
| 各 intent | 同一オリジン fetch で既存 API を叩く + レスポンスを結果カードで吹き出しに展開 |
| 結果カード型 | intent ごとに専用カード(セクション 4.2 A 群参照)|
| プライバシー | worldview_tags 英語スラッグを **絶対露出させない**(M4 / M5-3 確立)。「共通点 N 個」等の抽象表現 |
| 完了条件 | 対話完結 8 全てが吹き出し / 結果カードで返る + 既存 18 機能無変更 |
| 地雷度 | **中**(結果カードのサイズ管理・プライバシー漏洩点検)|

### D1-2d': 専用 UI 引き継ぎ群 10 配線(「○○しますね →」ボタン)

| 項目 | 内容 |
|---|---|
| 配線対象 | 専用 UI 引き継ぎ群 10(diagnose / worldview-profile / create-post / my-posts / closet / saved / history / body-edit / preference-edit / product-match)|
| 引き継ぎ方式 | 「○○しますね →」アシスタント吹き出し + [開く] ボタン → モーダル閉じ + `router.push(navigate-map[intent].url)` |
| 前提 | **D1-2x で `/self?tab=` バグ修正済**(タブ命名トリック吸収済の navigate-map と整合)|
| navigate-map 転用 | D1-2a で作成した定数表をそのまま「専用 UI 引き継ぎ表」として再利用 |
| 既存 | 既存画面の認証ガード(middleware appRoutes)が裏で守る |
| 完了条件 | 専用 UI 引き継ぎ群 10 全てが「対話で一拍 → 滑らかに専用画面へ引き継ぐ」動作 + ?tab= が正しく開く |
| 地雷度 | **中**(タブ命名トリック・引き継ぎ表現の自然さ)|

### D1-2e': virtual-coordinate → product-match 連鎖 + 仕上げ + 点検(★判断5-③ 連鎖 MVP 含む)

| 項目 | 内容 |
|---|---|
| 連鎖 | 直前の virtual-coordinate 結果(items + conceptKeywords + ngElements + coreTags)をセッション内 state に保持 → 次の発話で `product-match` が呼ばれたら state から items を引き継いで `POST /api/products/match` を呼ぶ |
| 連鎖外の「さっきの〜」| MVP 未対応・再入力誘導(D1 完結後の余地)|
| プライバシー点検 | View Source / Network レスポンスで worldview_tags 英語スラッグが 0 件であることを確認(M4 同型・★必須)|
| 退行点検 | 既存 BottomNav / 18 機能 / 公開ページ `/u/[id]` `/p/[id]` の通常動線が無変更 |
| 知見 docs 追記 | 設計書セクション 13(M5 と同型の知見小節)に D1-2 実装で得た知見を追記 |
| 完了条件 | 連鎖が機能 + 漏洩ゼロ + 退行ゼロ + docs 追記済 |
| 地雷度 | **中**(連鎖の state 管理・漏洩点検が肝)|

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

### 依存関係(対話中心化版)

```
D1-1(意図ルーター + UI 骨格・完了 6acfec9)
  ↓ 新規外部依存ゼロ・Haiku のみ
D1-2a(旧 navigate 配線・完了 db63f4f)
  ↓ navigate-map.ts 作成・対話中心化後は専用 UI 引き継ぎ表に転用
D1-2x(/self?tab= バグ修正・独立 commit・★判断5-⑤)
  ↓ 専用 UI 引き継ぎ群 10 の遷移が正しく動作する前提
D1-2b'(対話 UI 土台・モーダル拡張・履歴 state)
  ↓ ★判断5-① / ②
D1-2c'(対話完結 8 配線・結果カード)
  ↓ プライバシー漏洩点検(M4 同型)
D1-2d'(専用 UI 引き継ぎ 10 配線・navigate-map 転用)
  ↓ ?tab= 修正前提
D1-2e'(virtual-coordinate → product-match 連鎖・★判断5-③ + 仕上げ + 点検)
  ↓
D1-3(ムードボード・M3 資産再利用・新規外部依存ゼロ)
  ↓
★ D1-3 完了後 GO ゲート ★(完全不変)
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

## 10. オーナー実機確認の要点(M2 / M3 / M4 / M5 教訓・対話中心版)

```
D1-1 後:  ✅完了 FAB タップ → モーダル開く + 1 発話で intent JSON が返る
D1-2a 後: ✅完了 旧 navigate 配線・退行ゼロ実証(対話中心化で UI 部は段階更新)
D1-2x 後:  /self?tab=body 等 URL で正しいタブが開く + /outfit /discover の動作不変
D1-2b' 後: 対話モーダルで連続発話 → 履歴 蓄積 → 既存判定結果が吹き出しに移行
D1-2c' 後:🔴 対話完結 8 全てが結果カードで返る +
           View Source / Network で worldview_tags 英語スラッグ漏洩ゼロ(M4 同型)
D1-2d' 後: 専用 UI 引き継ぎ 10 全てが「○○しますね →」+ 専用画面に正しく遷移
D1-2e' 後: virtual-coordinate → product-match 連鎖が同一セッション内で動く +
           漏洩点検 + 退行点検(既存 18 機能 / 公開ページ無変更)+ 知見 docs 追記
D1-3 後:  ムードボード作成 + 公開 トグル + /u/[id] で公開ボードが見える +
           非公開ボードが他者から見えない(M3-4 同型)
★ D1-3 完了 = GO ゲート審査 ★(完全不変)
D1-4 後:  コスト見積もり + プライバシー設計確定 + 規約整備完了
D1-5 後: 🔴 試着画像生成 + 本人専用 RLS + 月 N 回制限動作 +
           顔写真漏洩経路ゼロ(View Source + Network + Storage URL 直叩き)
D-1 完結: 対話画面 1 つから 18 機能 + ムードボード + リアル試着の
           全てに到達できる(中心動線「→」が対話の流れで成立)
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
