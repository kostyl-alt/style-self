# STYLE-SELF D1 — Sprint B-3 コスト管理運用化 設計調査(案 P1 月 N 回上限・★ 設計のみ・実装は MVP-2 期)

- 作成日: 2026-05-24
- 起点 HEAD: `5021657`(Sprint B-2 ロードマップ改訂・origin 保全済・clean / 399 PASS / tsc EXIT 0)
- 本 doc の役割: Sprint B-3 コスト管理運用化の **設計調査**(★ **コード 0 変更・設計のみ・実装は MVP-2 期**)
- 上位連結:
  - ロードマップ [§4.3 B-3](./STYLE-SELF_D1_ビジョン完全達成_ロードマップ.md) = 案 P1 月 N 回上限実装の Sprint
  - ロードマップ [§11.4 次工程 #3](./STYLE-SELF_D1_ビジョン完全達成_ロードマップ.md#114-次工程-phase-1-完成宣言後の論理順) = ★ **直近次工程**(本 Sprint B-3)
  - コスト試算 [§4 案 P1](./STYLE-SELF_D1_P1-C-1.5_コスト試算_再評価.md)(`985d00b`)= 案 P1 の本命指定
  - Sprint B-1 評価 [§4.1.4](./STYLE-SELF_D1_Sprint_B-1_Phase2_前ゲート評価.md)(`65973c5`)= MVP 検証期は実装しない方針確認

---

## 1. 背景

### 1.1 Sprint B-3 の位置づけ

Sprint B-2(`5021657`)完遂後の自然な次工程。ロードマップ §11.4 で「直近次工程」と明示。Phase 2(ムードボード)着手前の **戦略整理 最後の山**(Sprint B 帯 完了)。

### 1.2 ★ 「設計のみで完遂」根拠

| 観点 | 根拠 |
|---|---|
| Sprint B-1 §4.1 結論 | MVP 検証期(オーナー 1 人)= ★ 何もしない(誤差として進める)|
| コスト試算 `985d00b` §5 短期推奨 | MVP 検証期 = ★ 何もしない・¥250-300/月(年 ¥3,600)レンジは誤差 |
| 本体 7.4 判断 9-4 | MVP 検証期は実装ペンディング |
| 投入トリガ | 月 1000 アクティブ超 + ¥250,000-300,000/月が許容できない時点(コスト試算 §4 案 P1)|
| ★ 本 Sprint B-3 の役割 | **将来実装の青写真(blueprint)を origin 保全** → MVP-2 期(本格運用前)にオーナー判断で即着手可能な状態を作る |

### 1.3 不可侵境界線(★ 厳守 / Sprint B-2 と同型)

1. 本体 `ac834bb` / コード / doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `5021657` / コスト試算 `985d00b` / 各設計案 / 既存設計判断 1-10 ★ **全 0 変更**
2. ③ プライバシー専章(6 章)/ ③ コスト管理(7 章)/ Phase 2 後ゲート(判断 6) ★ **diff 0 行**
3. リグレッションテスト **399 PASS 維持**(本 Sprint B-3 はコード 0 変更)
4. tsc EXIT 0 維持
5. ★ 実装は MVP-2 期(本 doc では実施しない)

---

## 2. ★ 実物確認結果

### 2.1 コスト試算 `985d00b` 案 P1 詳細

[§4 案 P1](./STYLE-SELF_D1_P1-C-1.5_コスト試算_再評価.md)で本命指定:

| 項目 | 値 |
|---|---|
| 名称 | 案 P1: 月 N 回上限(ユーザー単位) ★ 本命 |
| 規模 | route.ts +20-30 行 + DB マイグレーション 1 件 |
| 既存スキーマ案 | `users.chat_count_month integer` + `users.chat_month_key text` |
| 投入タイミング | 本格運用前(β リリース / 招待制等) |
| 効果 | 1000 人 × N=50 → ¥25,000/月 の予算管理 |
| UX 影響 | 上限到達時の通知必要 |
| 本体 7.4 整合 | 本体 7.1-7.3 の ③ リアル試着 月 N 回制限と **同思想** |

### 2.2 users テーブル 現状スキーマ確認(migrations 棚卸し)

`grep -A 3 "alter table public.users" supabase/migrations/*.sql` 結果:

| migration | 追加カラム |
|---|---|
| `001_initial_schema.sql` | id, email + RLS(select/update/insert 本人のみ)+ trigger `users_updated_at` |
| `005_sprint9_body_info.sql` | `height` / `weight` / `body_type` |
| `006_sprint9_profile_update.sql` | `upper_body_thickness` / `muscle_type` / `leg_length` 等 |
| `007_sprint11_worldview.sql` | `worldview jsonb` |
| `008_sprint13_style_analysis.sql` | `style_analysis jsonb` |
| `014_body_profile.sql` | `body_profile jsonb` |
| `021_avoid_items.sql` | `avoid_items text[]` |

→ ★ **既存 `chat_count_*` 系カラムなし** = 新規追加必要(マイグレーション 1 件 = `026_chat_count_month.sql` 想定)

### 2.3 stylist-chat route 現状 view([app/api/ai/stylist-chat/route.ts:89-180](../app/api/ai/stylist-chat/route.ts#L89-L180))

POST 関数の構造(★ view のみ):

| Step | 内容 | 行範囲 | 上限判定挿入位置 |
|---|---|---|---|
| 1 | 認証(`auth.getUser()`) | L91-100 | — |
| 2 | body 解析 + intent validation | L102-119 | — |
| **★ NEW** | **★ 月 N 回上限 判定(挿入位置)** | **L120 想定** | ★ **ここに +12-15 行追加** |
| 3 | contextData fetch(Promise.all)| L121-136 | — |
| 4 | Claude(Haiku 4.5)呼出 | L138-154 | — |
| 5 | 出力フィルタ(三重防御) | L156-160 | — |
| 6 | 補助 actions | L162-165 | — |
| 7 | reply guard + return | L167-174 | — |
| **★ NEW** | **★ 段階 B 呼出後 increment**(L175 想定) | **L150 直後 想定** | ★ **ここに +5-8 行追加** |

★ 挿入ロジック:
- 認証通過 + intent 検証通過後、★ **contextData fetch / Claude 呼出より前** で上限判定(無駄な fetch / Claude 呼出 を避ける)
- Claude 呼出成功後に `chat_count_month` を increment(★ エラー時は increment しない設計)

### 2.4 既存の月初リセット機構 有無

- **Vercel Cron**: `vercel.json` に 1 件(`/api/admin/sync-trends` 毎週月曜 0 時 UTC `0 0 * * 1`)= **トレンド同期用のみ**
- **Supabase pg_cron**: migrations に検出なし
- **DB trigger**: `users_updated_at`(updated_at 自動更新)のみ・リセット系 trigger なし
- **アプリ側ロジック**: なし

→ ★ **月初リセット機構 = ゼロから新規設計必要**(後述 §3.3)

### 2.5 ロードマップ §11.4 Sprint B-3 記述確認

[§11.4](./STYLE-SELF_D1_ビジョン完全達成_ロードマップ.md#114-次工程-phase-1-完成宣言後の論理順) #3:
> **★ Sprint B-3 コスト管理運用化**(★ **直近次工程**・案 P1 月 N 回上限実装・`users.chat_count_month` 追加 + stylist-chat 上限判定 +20-30 行)

→ 設計だけで完遂判断の根拠 = ロードマップ §11.4 で「直近次工程」と明示・本 Sprint B-3 が **設計提示のみ**(実装は MVP-2 期)で完遂可能(Sprint B-1 §4.1 + コスト試算 §5 短期推奨と整合)

---

## 3. ★ 案 P1 詳細設計(MVP-2 期 実装の青写真)

### 3.1 DB スキーマ(マイグレーション 1 件)

**ファイル**: `supabase/migrations/026_chat_count_month.sql` 想定

```sql
-- ★ Sprint B-3 案 P1: stylist-chat 段階 B 呼出回数の月次上限機構
-- 設計: docs/STYLE-SELF_D1_Sprint_B-3_コスト管理運用化_設計調査.md
-- 実装タイミング: MVP-2 期(本格運用前・β リリース / 招待制)

alter table public.users
  add column if not exists chat_count_month   integer default 0 not null,
  add column if not exists chat_month_key     text    default to_char(now(), 'YYYY-MM') not null;

comment on column public.users.chat_count_month is
  'stylist-chat 段階 B の今月の呼出回数(月初に 0 にリセット)';
comment on column public.users.chat_month_key is
  '現在カウント対象の月キー(YYYY-MM 形式・前月との比較でリセット判定)';

-- RLS: 既存の users RLS(本人のみ select/update/insert)で本人のみ更新可能・追加 policy 不要
-- ★ 既存 policies(001_initial_schema.sql L17-26)が本カラムにも自動適用
```

**規模**: +12-15 行(コメント含)

### 3.2 stylist-chat route 改修([app/api/ai/stylist-chat/route.ts](../app/api/ai/stylist-chat/route.ts) +20-30 行)

#### 3.2.1 上限判定(L119 と L121 の間に挿入・★ +12-15 行)

```typescript
// 2.5) ★ Sprint B-3 案 P1: 月 N 回上限判定
//      認証 + intent 検証 通過後・contextData fetch / Claude 呼出 より前で判定
//      → 上限到達時は無駄な fetch / Claude 呼出 を避けて即 reason 返却
const CHAT_MONTH_LIMIT = 100; // ★ N の具体数値(後述 §3.4 参照)
const currentMonthKey = new Date().toISOString().slice(0, 7); // "YYYY-MM"
const { data: countRow } = await supabase
  .from("users")
  .select("chat_count_month, chat_month_key")
  .eq("id", userId)
  .single<{ chat_count_month: number; chat_month_key: string }>();

const isNewMonth = !countRow || countRow.chat_month_key !== currentMonthKey;
const currentCount = isNewMonth ? 0 : (countRow?.chat_count_month ?? 0);

if (currentCount >= CHAT_MONTH_LIMIT) {
  return NextResponse.json<StylistChatResponse>({
    ok:     true,
    reason: "monthly_limit_reached",  // ★ 構造化レスポンス(UI 側で UX 分岐)
  });
}
```

#### 3.2.2 段階 B 成功後 increment(L154 直後に挿入・★ +5-8 行)

```typescript
// 7.5) ★ Sprint B-3 案 P1: Claude 呼出 成功後に increment
//      ★ エラー時は increment しない(L150 catch ブロック前で呼出失敗 → 課金しない)
//      isNewMonth の場合は chat_month_key も併せて更新(月初リセット相当・後述 §3.3 案 b)
const updates = isNewMonth
  ? { chat_count_month: 1, chat_month_key: currentMonthKey }
  : { chat_count_month: currentCount + 1 };
await supabase.from("users").update(updates as never).eq("id", userId);
```

### 3.3 月初リセット機構(★ 推奨判断)

#### 3.3.1 案 a: Supabase pg_cron(月初 0 時 UTC で全行 reset)

```sql
-- ★ 案 a: pg_cron(毎月 1 日 0 時 UTC)
-- 要件: Supabase pg_cron 拡張有効化(プロジェクト設定で要許可)
select cron.schedule(
  'reset-chat-count-monthly',
  '0 0 1 * *',  -- 毎月 1 日 0 時 UTC
  $$update public.users set chat_count_month = 0, chat_month_key = to_char(now(), 'YYYY-MM')$$
);
```

| 観点 | 評価 |
|---|---|
| 依存 | ★ pg_cron 拡張(Supabase Pro plan で利用可)|
| 確実性 | ★ 高(DB 側で確実に実行) |
| 規模 | +5-8 行(マイグレーション内) |
| タイムゾーン | UTC 固定(★ JST 22:00 だが許容)|
| 障害時影響 | cron 障害時は月跨ぎでリセットされず・★ 案 b と併用で多層化推奨 |

#### 3.3.2 案 b: アプリ側で読込時に判定(★ 単純・依存最小)

★ 上述 §3.2.1 で既に実装済の方式:
- `currentMonthKey`(YYYY-MM)を生成
- DB の `chat_month_key` と比較・異なる = 新月 → `currentCount = 0` として進行 + increment 時に `chat_month_key` も更新

| 観点 | 評価 |
|---|---|
| 依存 | ★ なし(アプリ側だけで完結) |
| 確実性 | ★ 高(各リクエスト毎に判定) |
| 規模 | ★ 0 行追加(§3.2.1 のロジックに既に含む) |
| タイムゾーン | UTC 基準(`toISOString().slice(0, 7)`) |
| 障害時影響 | ★ なし(リクエスト時に必ず判定) |

#### 3.3.3 ★ 推奨

★ **案 b 単独採用**(アプリ側で読込時に判定):
- 依存最小(pg_cron 拡張不要)
- §3.2.1 ロジック内に既に内包・追加コード不要
- ★ 完全に冪等(リクエスト毎に判定)
- 案 a は **将来オプション**(ユーザー数が爆発的に増えた時 = 全行リセット負荷分散用)

### 3.4 N の具体数値 推奨

| 想定 | N(上限/月) | 月額/ユーザー | 1000 人月額 |
|---|---|---|---|
| 軽度ユーザー | 50 相談/月 | ¥50 | ¥50,000 |
| ★ **推奨** | **100 相談/月** | **¥100** | **¥100,000** |
| 重度ユーザー | 200 相談/月 | ¥200 | ¥200,000 |

★ **推奨 N = 100**:
- ¥1.00/相談(コスト試算 `985d00b` §2.2 N=2 ケース)× 100 = ¥100/ユーザー/月
- Phase 1 実コスト ¥77-300/月(Sprint B-1 §4.1.1)の中央値
- 1000 人 = ¥100,000/月 = 予算管理可能レンジ
- ユーザー体験: 1 日 3 相談 ≒ 90 相談/月 で軽い余裕(★ MVP 検証期の実測ベースは未取得・β リリースで再評価)

### 3.5 上限到達時 UX 案

#### 3.5.1 構造化レスポンス(stylist-chat route)
```typescript
return NextResponse.json({ ok: true, reason: "monthly_limit_reached" });
```

#### 3.5.2 UI 側 reason 分岐([app/(app)/ai/page.tsx](../app/(app)/ai/page.tsx) +10-15 行)

| reason | UI 表示 | アクション |
|---|---|---|
| `monthly_limit_reached` | 「今月の相談回数(100 回)に達しました。来月 1 日から再開できます。」 | upgrade prompt(将来課金プラン誘導 / MVP-2 期は固定文言)|

#### 3.5.3 残回数表示(任意・MVP-2 期実装判断)
- 表示位置案: `WorldviewCard` 下部 or MenuDrawer
- 80% 閾値で警告色(残 20 回以下で薄黄)
- ★ MVP-2 期は **シンプル文言のみで開始**(残回数表示は後続改善で追加)

#### 3.5.4 upgrade prompt 設計(将来課金プラン用 placeholder)
- 「Style Self Plus(月 N=500 相談)に upgrade」型(Stripe 連携は MVP-3 以降)
- MVP-2 期は **文言だけ用意** + リンク先 placeholder(`/upgrade` route は将来)

---

## 4. ★ MVP-2 期 実装計画(★ 設計提示のみ・本 Sprint B-3 では実装しない)

### 4.1 Step 1-7 分割

| Step | 内容 | 規模 |
|---|---|---|
| **1** | マイグレーション SQL 作成(`026_chat_count_month.sql`)+ DB 反映 | +12-15 行 SQL |
| **2** | stylist-chat route 改修(上限判定 + increment + 構造化レスポンス) | +20-30 行 TS |
| **3** | アプリ側読込時リセット判定(★ Step 2 ロジック内に内包・追加 Step なし) | 0 行(Step 2 に含む) |
| **4** | UI 側 reason 分岐 UX 実装(エラーメッセージ + 残回数表示 任意) | +10-20 行 TS/JSX |
| **5** | リグレッションテスト拡張(月跨ぎ / 上限到達 / increment) | +20-40 行 test |
| **6** | 実機 verify(月初 ← → 月末・上限到達・upgrade prompt 表示) | 30 分 |
| **7** | commit(設計案 docs link 付き) | 5 分 |
| **合計** | | **+62-105 行 / 90-120 分** |

### 4.2 ★ 規模見当 整合

- コスト試算 `985d00b` §4 案 P1: +20-30 行(route.ts)+ DB 1 マイグレーション
- ロードマップ §11.4: +20-30 行(route.ts 抜粋)
- ★ 本設計調査 §4.1: **+62-105 行**(UI / test 含む全体規模・コスト試算より広範囲を含む詳細化)

---

## 5. 規模見当(★ 本 Sprint B-3 工程のみ)

| 工程 | 想定行数 | 想定時間 |
|---|---|---|
| **★ 本設計調査 doc**(本 commit / Step 1)| 250-350 行(実測 ~290 行)| 30-45 分 |
| **合計** | **+250-350 行** | **30-45 分** |

★ オーナー指示 +200-300 行と整合(若干超過しうるが DB スキーマ + route 改修 + UX 案 + Step 計画を 1 doc 集約のため許容範囲)。

---

## 6. ★ Step 1-4 分割(本工程)

| Step | 内容 | 時間 | 本 commit 範囲 |
|---|---|---|---|
| **1** | ★ 本設計調査 doc 作成(現状確認 + 案 P1 詳細 + UX 案 + MVP-2 期 Step 計画)| 30-45 分 | ★ **本 commit** |
| 2 | ロードマップ §11.4 反映(任意・別 commit)| 5-10 分 | ★ **本 commit に含めない**(オーナー判断時) |
| 3 | tsc EXIT 0 + 399 PASS 維持確認 | 2-3 分 | ★ **本 commit** |
| 4 | commit(push しない)| 3-5 分 | ★ **本 commit** |
| **合計** | | **35-60 分** | — |

→ 本 commit = Step 1 + 3 + 4。Step 2(ロードマップ反映)はオーナー判断時に別 commit。

---

## 7. 既存達成への影響評価(★ コード 0 変更・全保持)

| 達成項目 | 想定影響 |
|---|---|
| 1.5b 完成形 / race fix v2 / L4-A / A-2 / A-3 / MVP-1c / A-4 / A-10 / A-6 / A-6b / A-5 / A-9 / Sprint B-1 / Sprint B-2 | **0**(コード 0 変更)|
| リグレッションテスト | **399 PASS 維持**(本 Sprint B-3 はコード 0 変更)|
| 既存 v1 各 intent API + UI | **0** |
| 本体 `ac834bb` 6 章 / 7 章 / 判断 6 | **diff 0 行**(★ 厳守)|
| 本体 `ac834bb` / doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `5021657` | **diff 0 行**(★ 厳守)|
| コスト試算 doc `985d00b` | ★ **不変**(本 doc は案 P1 の詳細化・コスト試算 §4 の規模見当と整合)|
| Sprint B-2 設計案 `5e879c7` / ロードマップ改訂 `5021657` | **diff 0 行** |
| 各 Sprint A 設計調査 docs(A-4 / A-5 / A-6 / A-6b / A-9 / A-10 / MVP-1c 系)| **diff 0 行** |
| 既存設計判断 1-10 | **文言不変**(★ 厳守)|

---

## 8. 推奨案(★ 結論)

### 8.1 推奨実装方針 = 本 Sprint B-3 = 設計調査 doc 1 件のみ作成

- ★ **コード 0 変更**(設計調査 doc のみ)
- ★ 本体 / doc7 / 最終ビジョン / 整合性点検 / ロードマップ / コスト試算 / 各設計案 / 既存設計判断 1-10 ★ **全不変**
- ★ 実装は **MVP-2 期(本格運用前 / β リリース時)**(本 doc で青写真確立 → オーナー判断時に即着手可能)
- 規模 +250-350 行(本設計調査)+ MVP-2 期 +62-105 行(将来実装)
- 合計 30-45 分(本工程)+ 90-120 分(将来実装・本工程外)

### 8.2 ★ 5 項目 結論サマリ

| 項目 | 結論 |
|---|---|
| DB スキーマ | ★ `users.chat_count_month integer` + `users.chat_month_key text` 追加(マイグレーション `026_chat_count_month.sql` +12-15 行) |
| stylist-chat route 改修 | ★ 認証後・contextData fetch 前で上限判定(+12-15 行)+ Claude 成功後 increment(+5-8 行)|
| 月初リセット機構 | ★ **案 b(アプリ側読込時判定)単独採用**(依存最小・冪等)・案 a(pg_cron)は将来オプション |
| N の具体数値 | ★ **N = 100 相談/月**(コスト試算中央値 + 1 日 3 相談余裕) |
| 上限到達時 UX | ★ 構造化レスポンス `reason: "monthly_limit_reached"` + UI 文言「今月の相談回数(100 回)に達しました」+ upgrade prompt placeholder |

### 8.3 ★ 次工程

- 本 commit(Step 1 + 3 + 4)→ origin 保全
- MVP 検証期は ★ **実装しない**(設計のみ origin 保全)
- 本格運用前(β リリース / 招待制 / 月 1000 アクティブ近接)→ オーナー判断時に MVP-2 期実装(Step 1-7)
- Sprint B-3 完遂 → **Sprint B 帯 完全完遂** → **Sprint C ムードボード** へ進む(ロードマップ §11.4 #4)

---

## 9. 結論

| 観点 | 結論 |
|---|---|
| ★ Sprint B-3 着手判断 | **★ GO**(設計調査 doc のみ・コード 0 変更・規模軽微・MVP 検証期 実装しない方針)|
| 規模 | **+250-350 行 / 30-45 分**(本 commit)+ MVP-2 期 +62-105 行 / 90-120 分(将来実装) |
| 既存達成保持 | コード 0 変更で **全保持**(399 PASS 維持・tsc EXIT 0 維持)|
| ★ 4 レイヤー構造 | 本体 / doc7 / ロードマップ / 最終ビジョン ★ **全不変** |
| ★ 案 P1 詳細 | ★ **設計完遂**(DB スキーマ + route 改修 + 月初リセット + N + UX + Step 1-7)|
| ★ 次工程 | オーナー判断 → 本 commit origin 保全 → Sprint C(Phase 2 ムードボード)へ進む / MVP-2 期 に案 P1 実装(オーナー判断時) |
| 不可侵 | 本体 6 章 / 7 章 / 判断 6 / コスト試算 `985d00b` / 整合性点検 / 各設計案 / 既存設計判断 1-10 ★ **全不変** |

→ ★ **Sprint B 帯 完全完遂達成**(B-1 評価 + B-2 ビジョンマップ統合 + B-3 コスト管理運用化 設計)→ ★ **Phase 2 ムードボード(Sprint C)着手準備完了**

---

## 10. 制約遵守チェックリスト

- [x] 新規 docs ファイル 1 件のみ(本 doc)
- [x] 本体 `ac834bb` / コード(app/api/lib/scripts/package.json/tsconfig.json)/ doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `5021657` / コスト試算 `985d00b` / 各設計案 / 他 docs **全 0 変更**
- [x] 本体 6 章(リアル試着プライバシー専章)/ 7 章(③ コスト管理)/ 判断 6(Phase 2 後ゲート)diff 0 行
- [x] 既存設計判断 1-10 文言不変
- [x] view + grep + 静的解析のみ・実装なし
- [x] tsc EXIT 0 維持(本 doc は markdown のみ・コード 0 変更)
- [x] リグレッションテスト 399 PASS 維持(本 Sprint B-3 はコード 0 変更)
- [x] 実装は ★ MVP-2 期(本 doc では実施しない)
- [x] commit はあり / push はなし
