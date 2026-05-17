# STYLE-SELF M2 実装設計 — 世界観プロフィールを人に見せる形に

作成日: 2026-05-17
位置づけ: ビジョン統合マップ MVP「M2」の実装設計。
          上位 = docs/STYLE-SELF_ビジョン統合マップ.md(③繋がる の土台)
ステータス: 設計確定。この順序で実装する。
前提: M1(診断本番化)完了済み。analyze-v2 が本番稼働。

---

## 0. M2 の本質

```
今: DiagnosisDisplay は「自分が自分の診断結果を見る」もの
   = 全テーブルが RLS で本人しか読めない
   = 他者の世界観を見る手段がゼロ

M2: 「他者に見せられる世界観プロフィール」を作る
   = これが M3(投稿)・M4(世界観マッチング)の前提
   = ③繋がる 全体のブロッカー。最優先の土台
```

M2 が無いと「世界観で繋がる」の "繋がる対象" が存在しない。

---

## 1. 最重要: 隠れていた地雷(調査で判明)

```
RLS(Row Level Security)が全テーブル「本人のみ」:
  worldview_profiles … auth.uid() = user_id
  users              … auth.uid() = id

→ /u/[userId] のような他者ページを作っても、
  RLS が必ずブロックして空が返る。
  ルート新設だけでは絶対に動かない。
  RLS の変更(オプトイン公開)が M2 の核心。
```

フェーズBの「pattern_id NOT NULL」と同じ構造の地雷。
M2-1(DB + RLS)を最初に必ずやる。

---

## 2. 設計の核心思想: オプトイン公開

```
is_public boolean NOT NULL default false

- 既存ユーザー全員、デフォルト非公開のまま(誤公開ゼロ)
- ユーザーが明示的にトグルONにして初めて公開される
- 公開行(is_public=true)だけ、誰でも読める SELECT ポリシーを
  「追加」する(既存の本人限定ポリシーは温存)
- users は全列公開せず、id + display_name だけの
  public_users view を作る(プライベート情報の漏洩を構造的に防ぐ)
```

安全側に倒す。「見せたい人だけが見せる」設計。

---

## 3. 実装ステップ(4段階・低リスク→高リスク順)

### M2-1: DBスキーマ + RLS 追加 🟢 (30分)

```
目的: 他者が公開プロフィールを読める土台(これが無いと全部動かない)
作業(migration 023 想定):
  - worldview_profiles に is_public boolean NOT NULL default false 追加
  - 公開行への SELECT ポリシー追加:
    using (is_public = true) ← 既存の本人限定ポリシーは残す
  - public_users view 作成(id, display_name のみ)
    grant select to authenticated, anon
リスク: 低(非破壊・default false で既存全員 非公開のまま)
適用: オーナーが Supabase Studio で手動実行(migration 022 と同じ要領)
確認: is_public 列が default false で入るか・既存データ無影響か
```

### M2-2: DiagnosisDisplay に viewer モード 🟢 (1〜2時間)

```
目的: 本人向け要素を他者には見せない出し分け
作業:
  - DiagnosisDisplay に viewer: "self" | "public" prop 追加
    (showShare の上位概念。デフォルト "self" で既存呼出は無変更)
  - viewer="public" の時に非表示にするもの:
    - Actions セクション(共有・再診断ボタン)
    - 「もっと詳しく見る」折りたたみ
      (dailyAdvice / buyingPriority / actionPlan)
    - inputMapping / whyThisResult(「あなたの回答からこう判断」)
    - avoidElements / avoidItems(避ける服は他者に見せる意味薄い)
  - viewer="public" でも見せるもの(公開の中心):
    - 世界観カード(name + coreIdentity + tags)
    - Fashion Translation(色/素材/シルエット/小物/ブランド)
    - Culture Translation(音楽/映画/香水/アート)← 他者に刺さる
    - Kindred Spirits(近い世界観の人)← 他者に刺さる
  - 「避けている印象」「無意識の傾向」など本人色が強い項目は
    public で出すか要判断 → オーナーと相談ポイント(下記§5)
リスク: 低(props 拡張・既存は self デフォルトで無変更)
確認: /dev/diagnosis-preview に viewer="public" 表示を足して目視
```

### M2-3: 公開ルート /u/[userId] 新設 🟡 (2〜3時間)

```
目的: 他者の世界観プロフィールを見るページ
作業:
  - app/(app)/u/[userId]/page.tsx 新設(初の動的 UI ルート)
  - worldview_profiles の is_public=true 行を userId で fetch
  - public_users から display_name を取得
  - DiagnosisDisplay を viewer="public" で表示
  - fallback 設計(重要):
    - userId が存在しない → 404 or 「見つかりません」
    - is_public=false(非公開) → 「このプロフィールは非公開です」
    - 診断未実施 → 適切なメッセージ
  - middleware 判断:
    - 未ログインでも見れる(URLシェア体験重視)なら
      appRoutes に /u を追加しない
    - ログイン必須なら追加
    → これは設計判断(§5 でオーナーに確認)
リスク: 中(初の動的UIルート・fallback 設計・middleware 判断)
確認: 自分の userId を URL 直打ちして表示されるか
      (M2-1 で is_public=true に手動更新したテストデータで)
```

### M2-4: 公開トグル UI + 共有導線 🟡 (2時間)

```
目的: ユーザーが自分で公開ON/OFFを制御・URLを人に渡せる
作業:
  - /self?tab=worldview 等に「世界観を公開する」トグル追加
  - トグルON時に確認(誤公開防止):
    「あなたの世界観プロフィールが URL を知る人に
     見えるようになります」+ 何が公開され何が公開されないかの明示
  - 公開URL(/u/[自分のuserId])のコピーボタン
  - 「他者にどう見えるか」プレビュー(viewer="public" で自分の
    プロフィールを表示)があると親切
  - is_public のON/OFFを保存する API(/api/profile 拡張 or 新設)
リスク: 中(誤公開防止のUX設計・公開状態の管理)
確認: トグルON → URLコピー → シークレットウィンドウ等で開く →
      公開モードで見える / トグルOFFで「非公開です」になる
```

---

## 4. ステップ依存関係

```
M2-1(DB+RLS)
  ↓ これが無いと他者SELECTが100%ブロックされる。絶対最初。
M2-2(DiagnosisDisplay viewer)
  ↓ public表示の中身。/dev で先に目視できる
M2-3(/u/[userId] ルート)← M2-1 必須(RLS無いと空)
  ↓ 他者ページが動く
M2-4(公開トグルUI)← M2-3 必須(公開先ページが無いと無意味)
  ↓ ユーザーが自分で制御できる = M2 完成
```

順序厳守。特に M2-1 が全ステップの前提。

---

## 5. オーナーと相談すべき設計判断ポイント

実装前に決める必要がある論点(M2 開始時に確認):

```
判断1: 公開プロフィールは「未ログインでも見れる」か
  - 見れる: URLシェアの体験が良い(SNS的・拡散しやすい)
            ただし誰でも見れる = より慎重な公開設計
  - ログイン必須: クローズド。安全だが拡散しにくい
  → ③繋がる(SNS的世界)を目指すなら「見れる」寄りだが、
    オーナーの意向次第

判断2: 「避けている印象」「無意識の傾向」を public で見せるか
  - 見せる: その人の世界観がより深く伝わる(共感・マッチング精度)
  - 隠す: 「避けている印象」はネガティブにも読める。本人専用に
  → M2-2 の出し分けに直結。オーナーの感覚で決める

判断3: 公開の単位は「最新の世界観1つ」でよいか
  - 調査結論: worldview_profiles は1ユーザー1行(最新)。
    これを公開対象にするのが自然。履歴公開は不要
  → 基本これで確定。念のため確認

判断4: M2 のスコープに username / avatar / bio を入れるか
  - 調査推奨: 入れない。UUID URL(/u/[userId])で M2 完成。
    username(/@handle)は M2.1、avatar/bio は M3(投稿)時に
  → スコープを膨らませない。基本この方針で確認
```

これらは M2-1 着手前に ask_user_input で確認する。

---

## 6. スコープ外(切り離す・将来)

```
- username カラム + /@[username] URL → M2.1(後追い)
- avatar_url / bio → M3(投稿)で SNS 感強化時に同時
- 「他者の世界観を発見する UI」(一覧・レコメンド)→ M4
- フォロー機能 → M4 以降
- タブ構成変更(保存→投稿)→ M3
```

M2 は「URLを知っていれば1人の世界観を見れる」最小状態まで。
発見・フォロー・投稿は M3/M4。膨らませない。

---

## 7. M3/M4 との関係(なぜ M2 が最優先か)

```
M3「投稿の最小版」← M2 が前提
  投稿はユーザーの世界観に紐づく。世界観の公開モデル
  (is_public)が無いと「世界観 × 投稿」が成立しない

M4「世界観マッチング」← M2 が前提
  近い世界観の人を表示するには、他者の世界観プロフィールが
  公開されている必要がある

→ M2 は M3・M4 のブロッカー。MVP で最も依存される土台。
  だから M1 の次に M2 をやる順序は正しい。
```

---

## 8. 今日のスコープ(提案)

```
今日: M2 開始 → §5 の設計判断をオーナーと確定 → M2-1 着手

M2-1(DB+RLS migration)は30分・低リスク。
M1 の migration 022 と同じ要領(オーナーが Supabase で手動適用)。
M2-1 が終われば「他者が公開行を読める土台」ができる。

M2-2 以降は次セッションでも綺麗に繋がる
(設計がこのドキュメントに残るため)。
ただし今日どこまでやるかはオーナーが決める。
```

---

## 9. このドキュメントの位置づけ

```
docs/STYLE-SELF_ビジョン統合マップ.md(最上位)
  ├ STYLE-SELF_診断システム_再設計.md(①知る 思想)
  ├ STYLE-SELF_フェーズB_実装設計.md(①知る 実装・完了)
  └ STYLE-SELF_M2_実装設計.md(このファイル・③繋がる の土台)

Knowledge OS再設計・フェーズB と同じ「調査→設計→
ステップ実装」の型。M2 もこの地図に沿って4ステップで進める。
```
