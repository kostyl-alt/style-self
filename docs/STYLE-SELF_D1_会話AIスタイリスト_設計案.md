# STYLE-SELF D-1 会話 AI スタイリスト 設計案(2 段構成:intent 裏 / 会話表)

作成日: 2026-05-20
位置づけ: 本ドキュメントは **設計"案"**。本体設計書
          `docs/STYLE-SELF_D1_実装設計.md`(現 HEAD `4fdbab1`・案A 確定)は
          **書き換えない**。オーナー合意後に本体へ反映する議論材料。

背景(オーナー核心 FB・2026-05-20 P1-C-1 完了 `0fd4168` 後):

```
問題は画面の見た目ではなく AI の返答そのもの。
P1-C-1 で器(ChatPage 常時表示)はできたが、中身は
「ページ案内 AI」のまま:
  入力 → intent 判定 → ResultView/NavigateConfirm で「移動する →」カード
  → これは ChatGPT ではなく「機能カタログにラベルを貼っただけ」

欲しいのは「会話する AI スタイリスト」。
→ 2 段構成(intent 裏・会話表)で再設計する。
```

---

## 0. 確定方針(オーナー指定・本案の前提)

```
1. intent 判定は裏側に残す(D1-1 資産は破棄しない)
2. intent は「どのデータを見るか・どの処理を使うか」の判断に使う(ユーザー非表示)
3. ユーザーに見える返答は ★必ず自然な文章
4. 「移動する」カードは ★最初に出さない
5. 必要な場合だけ ★文章の後に補助アクションボタン
```

### オーナー提示の良い例(★ 到達基準・MVP で必達)

```
[1] 「診断したい」 →
  「了解。あなたの世界観を見つけるために、まず今の服選びで一番困っていることを
   教えてください。似合う服が分からないのか、自分らしい服が分からないのか、
   買っても着こなせない不安なのか、どれが近いですか?」

[2] 「クローゼット見せて」 →
  「今登録されている服を確認します。ブラック系アイテム、ベージュ系のボトムス、
   バッグが登録されています。この中からコーデを組みますか?それとも一覧で見ますか?」

[3] 「黒系で静かだけど印象に残るコーデにしたい」 →
  「あなたの世界観なら、黒をただ暗く使うより、素材と重心で差を出す方が合います。
   低光沢の黒、短丈トップス、長めのパンツ、重めの靴で組むと、静かだけど印象に
   残ります。手持ち服で組みますか?それとも買える商品から探しますか?」
```

→ AI スタイリストとして **会話**。ページ案内係にしない。

---

## 1. 現 ChatPage と理想の差分

### 現状(P1-C-1 / 0fd4168)

```
ChatPage の handleSubmit フロー:
  1. ユーザー入力
  2. user message append
  3. loading append
  4. POST /api/overlay/intent(Haiku ¥0.001/件)
     → { intent, mode, params, confidence, suggestions }
  5. レスポンスをそのまま intent-result Message として履歴に積む
  6. Bubble → AssistantContent → ResultView → mode で分岐:
     - mode="navigate" → NavigateConfirm「○○を開きます」+ [移動する→]
     - mode="none"     → NoneNotice「まだ準備中です」
     - confidence<0.7  → SuggestionList 候補ボタン
     - mode="api"/"hybrid" → ApiHybridPlaceholder「判定結果のみ表示」

→ ★ 全部「カード」だけで「会話文」が一切ない。
   intent 判定結果を UI で見せている = ページ案内 AI そのもの。
```

### 理想(本案・2 段構成)

```
ChatPage の新 handleSubmit フロー:
  1. ユーザー入力
  2. user message append
  3. loading append
  4. ★ 2 段処理:
     段階 A: POST /api/overlay/intent(裏・既存 D1-1 そのまま)
            → { intent, mode, params, confidence }
            ★ この結果はユーザーに見せない
     段階 B: POST /api/ai/stylist-chat(新規・会話応答生成)
            body: { text, intent, contextData, history }
            → { reply: "自然文", actions: [...任意] }
  5. assistant message として ★自然文の reply を積む
  6. 必要なら reply の下に補助アクションボタン群

→ ★ ユーザーが見るのは自然文の会話のみ。intent / mode / confidence / suggestions
   等の内部識別子は一切表示されない。
```

### 何を保持・何を変える

| 要素 | 扱い |
|---|---|
| `messages: Message[]` 履歴 state | ✅ 保持(MessageContent に新 kind 追加:`reply`)|
| Bubble / AssistantContent | ✅ 保持(新 kind `reply` の分岐追加)|
| `/api/overlay/intent`(D1-1)| ✅ 保持・**裏側で呼ぶ**(処理選択用)|
| `lib/overlay/navigate-map.ts`(D1-2a)| ✅ 保持・**補助アクションのリンク表**として転用 |
| `ResultView` / `NavigateConfirm` 等 D1-2a 5 サブ | **降格**:メイン表示から「文章後の補助アクション」に転用(NavigateConfirm 全画面表示はやめる)|
| `EmptyHistoryHint` | ✅ 保持(初回案内)|
| handleSubmit | **変更**:段階 A + 段階 B の 2 段処理に |
| 新規 API `/api/ai/stylist-chat` | ★ **新規追加**(会話応答生成)|

---

## 2. intent 判定を裏側でどう活かすか

### intent → 参照データ + 処理選択 マップ

| intent | 段階 B で参照すべきデータ | 段階 B での処理意図 |
|---|---|---|
| `diagnose` | `users.style_analysis`(既存診断結果がある場合)| 初回ヒアリング質問を返す(オーナー良い例 1)|
| `worldview-profile` | `worldview_profiles.result`(本人 RLS) | 自分の世界観を会話で要約 |
| `coordinate` | `users.body_profile / style_preference` + `worldview` + `wardrobe_items` | 世界観 × 身体 × 手持ち でコーデを会話で提案 |
| `style-consult` | `body_profile / style_preference / style_analysis` | 体型悩み解消を会話で提案 |
| `virtual-coordinate` | `worldview` + `body_profile` + コンセプト入力 | 概念翻訳 + コーデ提案を会話で |
| `product-match` | 直前の `virtual-coordinate` 結果 | 商品を会話で紹介(連鎖) |
| `match-users` | `worldview_profiles.worldview_tags`(本人 + 候補)| 似た世界観の人を会話で紹介 |
| `match-posts` | 同上 | 似た世界観の投稿を会話で紹介 |
| `closet` | `wardrobe_items`(本人 RLS)| クローゼット中身を会話で要約(オーナー良い例 2)|
| `inspiration` | `worldview` + 抽象語入力 | 抽象→具体の会話変換 |
| `brand-learn` | `worldview` + ブランド DB | ブランド推薦を会話で |
| `culture` | `worldview` + 既存 culturalAffinities | カルチャー解説を会話で |
| `saved` | `coordinates` 等(本人 RLS) | 保存リスト要約を会話で |
| `history` | `ai_history` 直近 | 履歴要約を会話で |
| `body-edit` / `preference-edit` | (編集要求 = 引き継ぎ系)| 「身体情報を変えますね」会話 + 補助アクション [編集画面を開く] |
| `create-post` / `my-posts` | (引き継ぎ系)| 「投稿作りますね」会話 + 補助アクション |
| `moodboard` / `tryon` | (将来)| 「まだ準備中です。今できる範囲で…」会話 |
| `unknown` | (全文脈)| 「もう少し詳しく教えてください」+ 例示会話 |

→ ★ intent はあくまで **裏側の処理選択スイッチ**。会話文には intent 名が一切出ない。

### 既存 API との関係

```
段階 A:
  POST /api/overlay/intent → 既存 D1-1 そのまま使う

段階 B(新規 /api/ai/stylist-chat):
  intent ごとに既存 API を内部で呼ぶ:
    coordinate/style-consult/inspiration → 既存 /api/ai/coordinate 等を呼んで結果を会話化
      or 会話 LLM がコーデ生成も同時にやる(コスト判断:後述 8 章)
    match-users/match-posts → 既存 /api/match/users 等を呼んで結果を会話化
    closet/saved/history → DB SELECT(本人 RLS・既存ヘルパ経由)
  会話プロンプトに「intent + 参照データ + 会話履歴」を入れて Sonnet で自然文生成
```

---

## 3. 会話応答生成をどう追加するか

### 新規 API: `/api/ai/stylist-chat`

```
POST /api/ai/stylist-chat
  body: {
    text:         string,        // ユーザー発話
    intent:       string,        // 段階 A の結果
    contextData?: object,        // intent ごとに収集したデータ(下記)
    history:      Message[]      // 直近 N 件(後述コスト抑制)
  }
  returns: {
    ok:     true,
    reply:  string,              // ★ 自然文(これだけがユーザーに見える)
    actions?: [                  // ★ 任意・補助アクション(intent ごと)
      { kind: "navigate", intent: string, label: string }   // navigate-map 経由
      { kind: "follow-up", text: string }                    // 「手持ち服で組む」等の次入力候補
    ]
  }
```

### contextData の構造(intent 別)

```typescript
type ContextData =
  | { intent: "coordinate";     worldview: WorldviewSummary; body: BodyProfile; wardrobe: WardrobeSummary }
  | { intent: "closet";         wardrobe: WardrobeSummary }  // オーナー良い例 2
  | { intent: "match-users";    matches: MatchUsersResult }   // 既存 /api/match/users 経由
  | { intent: "diagnose";       hasExisting: boolean; analysis?: StyleDiagnosisResult }  // 良い例 1
  | ...

★ WorldviewSummary は worldview_name(日本語) + worldview_keywords(日本語) のみ。
   worldview_tags 英語スラッグは 含めない(本ドキュメント 6 章プライバシー境界)。
★ WardrobeSummary は色系統 + カテゴリ + 件数の要約(全件画像 URL は渡さない)。
```

### 会話 system プロンプトの方針

```
あなたは STYLE-SELF の AI スタイリスト。ユーザーの世界観 / 体型 / 好み / 手持ち服を
踏まえて、自然な会話で提案する。

[人格]
  ・ ChatGPT のように丁寧に・端的に
  ・ ページ案内係ではなく スタイリスト
  ・ ユーザーを「あなた」と呼ぶ
  ・ 機能名や intent 名(英語スラッグ)を返答に出さない

[返答構成]
  1. 自然な返事(短く・一文)
  2. 意図理解の言い換え(必要なら)
  3. 参照情報からの提案(具体的に・服の形・素材・色で)
  4. 必要なら 1 つだけ質問(複数質問しない)

[避けること]
  ・「ボタンを押して」「画面を開いて」等の操作指示(補助アクションは別レイヤー)
  ・ 「あなたの worldview_tags は dark, gothic」等の内部識別子の露出
  ・ 100 字を大きく超える長文(モバイルで読み疲れる)
```

### モデル選定(コスト試算・8 章詳細)

```
段階 A intent 判定: Haiku 4.5(¥0.001/件・既存)
段階 B 会話応答:   Sonnet 4.6(¥0.01-0.03/件・推奨)or Haiku(品質要検証)

→ Sonnet が会話品質的に必要と推定。8 章でコスト概算とトレードオフ詳細。
```

### 会話履歴を渡す範囲

```
history: 直近 N 件(N=5-10 案・オーナー良い例の文脈長から推定)
  ・ Message を user/assistant role + text(または reply)に整形して LLM に渡す
  ・ system プロンプト内に直接埋め込む(別 turn でなく文脈として)
  ・ MAX_MESSAGES=30 のうち、過去 N 件を渡す(全部渡すとコスト爆発)
```

---

## 4. 「移動する」カードの廃止 / 補助化

### 廃止対象(P1-C-1 までの ChatPage 内挙動)

```
- ResultView が mode="navigate" → NavigateConfirm 表示「○○を開きます」+ [移動する→] ボタン
  → これがユーザーから見えると「ページ案内 AI」に見える主犯
```

### 降格後(本案)

```
段階 B の返答:
  reply: 「○○の編集画面を開きますね。準備できたら言ってください。」(自然文)
  actions: [
    { kind: "navigate", intent: "body-edit", label: "身体情報を編集する" }
  ]

→ assistant message の reply 本文の下に、控えめなボタン 1〜2 個。
   「最初に出すカード」ではなく「文章を読んだ後の補助操作」。
   ボタンが押されたら resolveNavigateTarget(intent) で URL 解決 → router.push(D1-2a 転用)。
```

### navigate-map(D1-2a)の扱い

```
完全に保持。actions.navigate.intent → navigate-map[intent].url で URL 解決。
タブ命名トリック吸収済の 9 entry がそのまま補助アクションのリンク表として機能。
```

---

## 5. 8 種類の相談を自然文で返す具体(★ オーナー良い例を到達基準に)

### 5.1 オーナー良い例(到達基準・既出)

| # | ユーザー入力 | 想定 intent | reply(到達基準) |
|---|---|---|---|
| 1 | 「診断したい」 | `diagnose` | 「了解。あなたの世界観を見つけるために、まず今の服選びで一番困っていることを教えてください。似合う服が分からないのか、自分らしい服が分からないのか、買っても着こなせない不安なのか、どれが近いですか?」 |
| 2 | 「クローゼット見せて」 | `closet` | 「今登録されている服を確認します。ブラック系アイテム、ベージュ系のボトムス、バッグが登録されています。この中からコーデを組みますか?それとも一覧で見ますか?」 |
| 3 | 「黒系で静かだけど印象に残るコーデにしたい」 | `virtual-coordinate` or `coordinate` | 「あなたの世界観なら、黒をただ暗く使うより、素材と重心で差を出す方が合います。低光沢の黒、短丈トップス、長めのパンツ、重めの靴で組むと、静かだけど印象に残ります。手持ち服で組みますか?それとも買える商品から探しますか?」 |

### 5.2 残り 5 種類の到達イメージ(本案で具体化)

| # | ユーザー入力 | intent | reply(到達イメージ) | actions(任意) |
|---|---|---|---|---|
| 4 | 「コーデ作って」 | `coordinate` | 「今日のシーンは何ですか?例えば仕事・休日・人と会う、で素材と重心が変わります。」(初回)or 「あなたの世界観と体型を踏まえて、上は◯◯、下は◯◯、靴は◯◯で組むと整います。理由は…」(2 回目)| 保存 / 別案 / 手持ちで組む |
| 5 | 「この服に何合わせれば」 | `coordinate` + 商品 URL/画像 | 「写真の◯◯系アイテムですね。世界観的には◯◯と相性が良く、色は◯◯、靴は◯◯にすると合います。」 | 保存 / 商品を探す |
| 6 | 「世界観に合う服が見たい」 | `product-match` or `inspiration` | 「あなたの世界観は『黒い美術館の住人』。低光沢ウール、ロング丈、墨色系が合います。具体的な商品を見ますか?」 | 商品を探す |
| 7 | 「買うか迷ってる」 | `style-consult` + 商品情報 | 「迷っているのは合うか分からないからですよね。あなたの世界観と体型に対して、この◯◯は△△の点で合います。ただし□□は注意点です。」 | 手持ちで試す / 似た商品を探す |
| 8 | 「体型の悩み聞いて」 | `style-consult` | 「今気になっているのは、骨格、丈、シルエットのどれが近いですか?」(初回)or 既存身体情報を見て具体提案 | 身体情報を編集 |

→ MVP は **オーナー良い例 1〜3 を完全達成**で「会話している感覚」を確立。残り 5 は同じ型で順次対応。

---

## 6. 世界観・身体・好み・クローゼットを文脈にどう入れるか(★プライバシー境界)

### 既存データ参照経路(実物確認済)

| データ | 参照経路 | プライバシー注意 |
|---|---|---|
| `users.style_analysis`(診断結果)| 既存:`/api/ai/coordinate` L61 同型 `.select("style_axis, worldview, ..., style_preference, body_profile, avoid_items")` | M2-3 列絞り遵守・公開公開でない |
| `worldview_profiles.result`(本人)| 本人 RLS `select` | **★ result の中の `worldview_tags` 英語スラッグは LLM に渡さない**(`worldview_name` / `worldview_keywords` 日本語のみ渡す)|
| `users.body_profile`(JSONB) | 同上 | プライベート情報(身長・体重・骨格)・本人 RLS で守られている・LLM プロンプトに渡すが返答には数値露出しない |
| `users.style_preference` | 同上 | 好み・避けたい印象 |
| `wardrobe_items`(クローゼット)| 本人 RLS `select` | **画像 URL や個別商品名は LLM に大量に渡さない**(色系統 + カテゴリの要約に整形)|

### LLM プロンプトに入れる / 入れないの境界(設計書 4.4 厳守)

```
入れる(日本語・抽象表現):
  ・ worldviewName(日本語名・例「黒い美術館の住人」)
  ・ worldview_keywords(3-5 語・日本語)
  ・ body_profile の概要(身長 / 体型 / 悩み)
  ・ style_preference の概要(好む系統 / 避けたい印象)
  ・ wardrobe_items の要約(色系統別件数 + カテゴリ別件数)

入れない(★ 露出ゼロ):
  ・ worldview_tags 英語スラッグ(dark / gothic 等・M4 教訓)
  ・ pattern_id / 内部識別子
  ・ 画像 URL の生データ(モデル説明にも不要)
  ・ user_id / email / その他個人識別子
  ・ 他人の wardrobe_items / worldview_profiles(本人以外の RLS で守られている)
```

→ ★ 既存 API 経由 or 既存 SELECT パターン経由(M2-3 列絞り遵守)で取り、LLM に渡す前に
   **日本語抽象に変換** する整形ステップを設ける。

### M4 / M5 教訓の継承

```
M2-3「量産型」HTML inline 漏洩教訓:
  → 会話 reply に worldview_tags 英語スラッグが偶然出ない保証が必要
  → system プロンプトに「英語スラッグを出力しない」を明示
  → 出力後の text-level フィルタ(英語スラッグ正規表現で弾く)も検討
```

---

## 7. アクションボタンを文章の後にどう出すか

### 配置と振り分け

```
返答カード:
  ┌────────────────────────────────────┐
  │ [reply の自然文]                     │  ← 主役・常時表示
  │ 「あなたの世界観なら、黒をただ暗く  │
  │  使うより、素材と重心で…」        │
  ├────────────────────────────────────┤
  │ [actions(あれば)]                  │  ← 補助・「あれば」だけ
  │ [手持ち服で組む] [買える商品から]   │
  └────────────────────────────────────┘

intent ごとの actions 出し分け:
  coordinate          → [保存] [別案] [手持ちで組む]
  product-match       → [保存] [この商品を見る] [似た商品]
  closet              → [一覧を開く] [このアイテムから組む]
  body-edit/preference→ [編集画面を開く]
  diagnose/create-post→ [診断を始める] / [投稿を作る](← navigate 経由)
  none/unknown        → なし
```

### 5 サブの転用

```
NavigateConfirm  → actions の navigate 用ボタンとして縮小転用(「移動する」テキスト → 動詞ボタン)
SuggestionList   → confidence 低時の対話フォールバック「○○ですか?」を reply に文脈統合 or 削除
NoneNotice       → reply 内に「準備中」を自然文で書く(カードでなく文章で)
ApiHybridPlaceholder → 廃止(段階 B が会話応答を生成するので不要)
ResultView       → AssistantContent の switch から外す(または `reply` kind に置換)
```

→ ★ 5 サブのうち NavigateConfirm のスタイルだけ「補助ボタン」として残し、他は段階 B の reply に統合。

---

## 8. ★ API コスト試算(M5-4a 作法)

### 2 段構成での 1 相談あたりコスト概算

```
段階 A: /api/overlay/intent(Haiku)
  入力 ~900 tokens(プロンプト + 発話)
  出力 ~80 tokens(intent JSON)
  Haiku: (900 × $0.80 + 80 × $4) / 1M = $0.001  / 件
  → ¥0.15 (USD/JPY=150) / 件

段階 B: /api/ai/stylist-chat(会話生成)
  入力 ~2,000 tokens(system プロンプト 800 + contextData 500 + history N=5 × 100 + 発話 200)
  出力 ~200 tokens(自然文 reply)
  ★ モデル別:
    Haiku: (2000 × $0.80 + 200 × $4) / 1M = $0.0024 → ¥0.36 / 件
    Sonnet: (2000 × $3   + 200 × $15)  / 1M = $0.009 → ¥1.35 / 件

→ 2 段合計:
  Haiku 採用: ¥0.15 + ¥0.36 = ¥0.51 / 相談
  Sonnet 採用: ¥0.15 + ¥1.35 = ¥1.50 / 相談
```

### 1 ユーザー月コスト(150 相談想定)

```
Haiku 採用(段階 B も Haiku):
  ¥0.51 × 150 = ¥77 / 月 / ユーザー  → 1000 アクティブで月 ¥77,000

Sonnet 採用(段階 B Sonnet):
  ¥1.50 × 150 = ¥225 / 月 / ユーザー → 1000 アクティブで月 ¥225,000

★ 本体設計書 4.6 想定 ¥3.7/月 → ¥77〜225/月 = ★ 20〜60 倍に増加
```

### モデル選定のトレードオフ

| 選択肢 | コスト | 会話品質 | 推奨 |
|---|---|---|---|
| **Sonnet 4.6** | 高(¥1.50/相談)| ★ オーナー良い例レベルに到達可能性高 | **推奨**(MVP 必達)|
| **Haiku 4.5** | 安(¥0.51/相談)| 会話品質要検証・オーナー良い例の自然さに届くか不明 | 検証後判断 |

### 抑制策(M5-4a 作法)

```
1. 1 段に統合できないか:
   intent 判定 + 会話生成 を Sonnet 1 回 で行う(プロンプト工夫)
   → 段階 A の Haiku を省ける(¥0.15 節約)
   → ただし intent 出力の構造化が崩れる懸念(D1-2a navigate-map 連携)
   → MVP では 2 段維持・将来統合検討

2. history を絞る:
   N=5 → N=3 で入力 200 tokens 減 → ¥0.05 削減

3. 提案チップ経由は段階 A スキップ:
   チップタップ = intent 確定 → 段階 A 省ける(¥0.15 節約)

4. contextData は最小化:
   wardrobe_items 全件でなく色系統別件数のみ など

5. 連投レート制限・loading 中入力無効化(P1-C-1 既存)

6. ★ ③ リアル試着のコスト管理(本ドキュメント 7 章)は完全不変
```

### コスト試算結論

```
推奨: Sonnet 採用(MVP で会話品質を担保)・¥1.50/相談 ≒ ¥225/月/1 ユーザー
   100 アクティブで月 ¥22,500 / 1000 アクティブで月 ¥225,000

許容判断はオーナー。Haiku で会話品質が成立すれば月コスト 1/3。
段階 A + B の合算で見ると、本体 4.6 試算(¥3.7/月)から大幅増のため、
MVP の利用者数を絞る or 1 ユーザー月相談数を絞る等の判断が必要かもしれない。
```

---

## 9. MVP で最初に対応する相談パターン

### 確定 8 種類(オーナー指定)

```
1. 診断したい(オーナー良い例 1)
2. クローゼット見せて(オーナー良い例 2)
3. 黒系で静かに(オーナー良い例 3)
4. コーデ作って
5. この服に何合わせれば
6. 世界観に合う服が見たい
7. 買うか迷ってる
8. 体型の悩み聞いて
```

### MVP 着手順序(段階分割)

```
MVP-1(まず 2 種で型を確立):
  ・ オーナー良い例 1(診断)
  ・ オーナー良い例 2(クローゼット)
  → 「会話している感覚」を実機で達成

MVP-2(コーデ系 3 種):
  ・ オーナー良い例 3(黒系で静かに)
  ・ コーデ作って(4)
  ・ この服に何合わせれば(5)

MVP-3(残り 3 種):
  ・ 世界観に合う服(6)・買うか迷ってる(7)・体型悩み(8)
```

### 8 種類以外 / 未対応が来た時

```
intent="unknown" or 未配線 intent:
  reply: 「まだその相談は完全には対応していませんが、
          ◯◯(近い intent)として近い提案を出すこともできます。
          どちらが近いですか?」
  → 「移動する」カードだけで返さない(オーナー方針)
  → 自然文で「対応可能性」を伝え、選択肢を会話で提示
```

---

## 10. 実装前に確認すべきリスク

| # | リスク | 対策 |
|---|---|---|
| 1 | 会話生成 AI が誤情報を出す(他人の世界観/身体を混入)| ★ contextData は本人 RLS 経由のみ・LLM に他人データを渡さない |
| 2 | worldview_tags 英語スラッグの会話露出(M2-3 / M4 教訓)| ★ system プロンプトで明示禁止 + 出力 text-level フィルタ |
| 3 | コスト増(2 段で 20-60 倍)| 8 章の抑制策・モデル選定をオーナー確定 |
| 4 | 既存 5 サブ / navigate-map / intent を壊さず会話化する境界 | ResultView 等は AssistantContent から外す or `reply` kind に置換・実装本体は破壊しない |
| 5 | ③ プライバシー専章 / コスト管理 / Phase 2 後ゲート | ★ 完全不変(段階 B の会話化は ③ に干渉しない)|
| 6 | 一度に 8 種類作り込む危険 | ★ MVP-1 → 2 → 3 の段階分割厳守 |
| 7 | 会話品質が「ページ案内よりマシ」程度で止まる | ★ オーナー良い例 1-3 を **客観的到達基準**として実機で比較・到達しなければプロンプト再調整 |
| 8 | 会話履歴が文脈として無理に効く誤解 | 単発相談として完結する設計を基本に・連鎖は MVP 範囲外(virtual→product 連鎖は P1-F でカバー)|
| 9 | LLM が「ボタンを押して」「画面を開いて」と返す | system プロンプトで明示禁止 + 出力検査 |
| 10 | 既存 API(/api/ai/coordinate 等)と会話 API の二重起動 | 段階 B 内で既存 API を呼ぶ場合は 1 リクエスト内で完結(クライアントから 2 回叩かない)|

---

## 11. P1-C への影響とステップ再構成

### 現状の Phase 1 工程(本体設計書 4fdbab1)

```
P1-A 起動導線(完了 c77a54c)
P1-B BottomNav 5→3(完了 79a76be)
P1-C-1 ChatPage 器化(完了 0fd4168)← 今ここ
P1-C-2 BottomNav + OverlayFab 廃止
P1-C-3 MenuDrawer 追加
P1-C-4 チャットコマンド動作確認 + 仕上げ
P1-D 上部世界観カード + 提案チップ 5 + 入力欄近接 4 ボタン
P1-E 対話完結 8 結果カード化
P1-F virtual→product 連鎖 + 次アクション 3
P1-G 仕上げ + 退行点検
```

### 本案を組み込んだ再構成案(オーナー判断要)

**案 X:P1-C-1.5 として会話 AI を挟む**

```
P1-C-1(完了)
P1-C-1.5(新)会話 AI スタイリスト(本案)
  ・ /api/ai/stylist-chat 新規実装(段階 B)
  ・ ChatPage の handleSubmit を 2 段構成に書き換え
  ・ MessageContent に kind:"reply" 追加・AssistantContent 分岐追加
  ・ ResultView の主表示を「reply 主体・補助 actions」に変える
  ・ MVP-1(良い例 1-2)で会話品質達成
P1-C-2 BottomNav + OverlayFab 廃止(器の完成)
P1-C-3 MenuDrawer(器の完成)
P1-C-4 チャットコマンド + 残り 6 種 / MVP-2 / MVP-3
P1-D 〜 P1-G 既定通り(チップ / 結果カード / 連鎖 / 仕上げ)
```

**案 Y:P1-D を会話 AI 中心に再定義**

```
P1-C-2 / C-3 を先に完了(器の完成)
P1-D を 「会話 AI スタイリスト + 提案チップ + 世界観カード + 入力欄ボタン」に再定義
  ・ 中核 = 会話 AI(本案)
  ・ チップ / 世界観カード / 近接ボタンは UI 補助
P1-E 〜 P1-G は会話 AI 前提に書き換え
```

**推奨**: **案 X**(P1-C-1.5)

```
理由:
  ・ P1-C-1 完了直後にオーナー FB「中身がページ案内 AI」が出た = 中身は最優先で対応
  ・ P1-C-2/3(ナビ廃止 / Drawer)は器の話で会話 AI に直接関係しない
  ・ 案 X は「中身 → 器」の順で順序が自然(中身ができれば器の完成は後でも体験できる)
  ・ MVP-1(良い例 1-2)で会話品質が達成できることを早期確認・失敗なら方針再検討可
```

### D1 資産の転用方針(本案)

| 資産 | 転用 | 注 |
|---|---|---|
| `/api/overlay/intent`(D1-1)| ★ 段階 A で裏使用(ユーザー非表示)| 完全保持 |
| `OVERLAY_INTENT_PROMPT` | ★ 完全保持 | 21 intent 全部段階 B の処理選択に活きる |
| `lib/overlay/navigate-map.ts`(D1-2a)| ★ 補助アクション(actions.navigate)のリンク表に転用 | 完全保持 |
| `ResultView` / `AssistantContent`(D1-2b')| 改変:`reply` kind の分岐を追加・既存 `intent-result` kind は段階 B 移行後に廃止可 | シグネチャ は維持・実装本体は段階的に縮小 |
| `NavigateConfirm` | ★ スタイルだけ補助アクションボタンに転用(全画面表示やめる)| ヘルパとして残せる |
| `NoneNotice` / `SuggestionList` / `ApiHybridPlaceholder` | 廃止 or 段階 B の reply 内に文章化 | 5 サブのうち 3 つは段階 B 移行で不要に |
| `EmptyHistoryHint` | ★ 保持 | 初回案内・変更なし |
| 履歴 state(messages: Message[])| ★ 保持 + `reply` kind 追加 | MAX_MESSAGES=30・自動スクロールも維持 |

---

## 12. 設計者推奨と次のアクション

### 推奨

```
1. ステップ: 案 X(P1-C-1.5 として会話 AI を P1-C-2 の前に挟む)
2. モデル: 段階 A Haiku(既存)・段階 B Sonnet(会話品質優先)
3. MVP-1 で良い例 1-2 を完全達成 → 達成すれば MVP-2 / 3 → 本案を本体設計書に統合
4. 段階 A + B の合算コスト ¥225/月/ユーザーは MVP の利用者数で許容判断
5. ③ プライバシー専章 / コスト管理 / Phase 2 後ゲート は完全不変
6. オーナー良い例 1-3 を ★ 客観的到達基準として実機で比較
```

### 次のアクション(オーナー判断項目)

| # | 判断 | 候補 | 推奨 |
|---|---|---|---|
| 1 | ステップ組込 | 案 X(P1-C-1.5)/ 案 Y(P1-D 再定義)| 案 X |
| 2 | 段階 B モデル | Sonnet / Haiku | Sonnet(MVP 必達)|
| 3 | MVP 初手 | MVP-1(良い例 1-2 から)/ 8 種一気 | MVP-1(M5 教訓)|
| 4 | コスト許容 | ¥225/月/ユーザー OK / 制限要 | オーナー判断 |
| 5 | 本体改訂タイミング | 本案合意直後 / MVP-1 完了後 | 合意直後(本体と実装の乖離を最小化)|

実装はまだしない。本ドキュメントを判断材料に、上記 5 判断確定後 → 本体改訂 → 実装の順で進む。

---

## 13. 位置づけ

```
docs/STYLE-SELF_ビジョン統合マップ.md(最上位)
  ├ ... M1〜M5 設計
  ├ STYLE-SELF_D1_実装設計.md(本体・4fdbab1・案A タブなし完全チャット型)
  ├ STYLE-SELF_D1_対話中心_改訂案.md(中間 1・統合済)
  ├ STYLE-SELF_D1_チャット主役型_設計案.md(中間 2・統合済)
  ├ STYLE-SELF_D1_案A案B比較.md(最終純化・統合済)
  ├ STYLE-SELF_D1_P1-C設計調査.md(P1-C 4 サブ分割)
  └ STYLE-SELF_D1_会話AIスタイリスト_設計案.md(このファイル・中身の会話化)

オーナー合意が取れたら:
  - 本案を本体設計書に統合(P1-C-1.5 を追加 + Section 4.5 を「reply 主体・補助 actions」に再構成)
  - その後 P1-C-1.5 実装(新規 API + ChatPage 2 段構成書き換え)
```
