# STYLE-SELF D1 — stylist-chat MB intent 判定問題 調査(★ オーナー実機 verify で発見・MVP リリース前重大問題・★ 調査のみ・実装は別工程)

- 作成日: 2026-05-27
- 起点 HEAD: `d2ce6bc`(Sprint C-2 段階3-B v4 hotfix・origin 保全済・clean / 399 PASS / tsc EXIT 0)
- 本 doc の役割: ★ オーナー実機 verify で発見された **MB → coordinate 連鎖が古い placeholder にルーティングされる問題** の **調査**(★ **コード 0 変更・実装は別工程**)
- 上位連結:
  - Sprint C-3 実装 [`ae2996d`](../lib/prompts/moodboard-prompt.ts)`buildMoodboardPrompt` 出力構造
  - Sprint C-4 設計 [`4d6cf83`](./STYLE-SELF_D1_Sprint_C-4_完成_退行点検_設計調査.md)実機 verify シナリオ 5(★ 本問題発見の起点)

---

## 1. 背景

### 1.1 オーナー実機 verify 報告(2026-05-27)

★ シナリオ 5「8/8 達成 → 連鎖」実機検証中の発見:

```
1. /moodboard/[id] で MB 作成(8/8 達成)
2. 「チャットに渡す」or 撮影前 CTA → ChatPage 遷移
3. ★ ChatPage に prompt 自動挿入 OK:
   「[ムードボード] テーマ: 冷たいアンドロジナス
    コンセプト: 自然光、ノーメイク
    世界観: 黒い美術館の住人...
    [必須要素カバー: 8/8]
    [参考画像メモ] 6件
    このムードボードに合うコーディネートを提案してください...」
4. 送信
5. ★ ★ ★ 返答:
   「ムードボードはまだ準備中です。世界観を視覚化するボード機能は
    D1-3 で実装予定です。少々お待ちください。」
```

### 1.2 ★ 問題の重大性

- ★ **MVP リリース前の重大な機能未配線**
- MB → coordinate 連鎖(Sprint C-3 で実装したはず)が ★ **実機で機能していない**
- 古い placeholder が MB-prompt をハイジャックしている

### 1.3 不可侵境界線(★ 厳守)

1. 本体 `ac834bb` / コード / doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` / 各設計案 / 既存設計判断 1-10 ★ **全 0 変更**
2. ★ 本 doc は **調査のみ・実装しない**
3. リグレッションテスト **399 PASS 維持**
4. tsc EXIT 0 維持

---

## 2. ★ 静的解析結果(grep ベース)

### 2.1 placeholder テキスト出所

```bash
grep -rn "ムードボードはまだ準備中\|D1-3" app/ lib/ components/
```

**ヒット**:
- [`app/(app)/ai/page.tsx:696-700`](../app/\(app\)/ai/page.tsx#L696-L700)
  ```typescript
  function NoneNotice({ intent }: { intent: string }) {
    if (intent === "moodboard") {
      return (
        <div className="border border-gray-100 rounded-xl p-4 space-y-2">
          <p className="text-sm text-gray-900">ムードボードはまだ準備中です</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            世界観を視覚化するボード機能は D1-3 で実装予定です。少々お待ちください。
          </p>
        </div>
      );
    }
    // ...
  }
  ```

### 2.2 NoneNotice 呼出経路

[`app/(app)/ai/page.tsx:629-632`](../app/\(app\)/ai/page.tsx#L629-L632):
```typescript
// D1-2a: none(moodboard / tryon / unknown)
if (mode === "none") {
  return <NoneNotice intent={intent} />;
}
```

→ `mode === "none"` + `intent === "moodboard"` の組み合わせで placeholder 表示。

### 2.3 段階 A intent 判定

[`lib/prompts/overlay-intent.ts:42, 69`](../lib/prompts/overlay-intent.ts):
```
[intent 一覧と説明]
- moodboard           : ムードボード(将来機能・現在未配線)
- tryon               : リアル試着(将来機能・現在未配線)

[mode の付与ルール]
- none     : unknown / moodboard / tryon(現時点で配線されていない)
```

→ 段階 A LLM(Haiku 4.5)は「ムードボード」キーワードを見ると `intent="moodboard"` + `mode="none"` を返す仕様。

### 2.4 完全なルーティング経路

```
ChatPage 送信
   ↓
段階 A: POST /api/overlay/intent
   ↓ Haiku 4.5 が overlay-intent.ts プロンプトで判定
   ↓ buildMoodboardPrompt 出力の「[ムードボード]」「テーマ」「コンセプト」を見て
   ↓ intent="moodboard", mode="none" と判定(★ overlay-intent.ts L42 通り)
   ↓
ChatPage 受信: { intent: "moodboard", mode: "none" }
   ↓
mode === "none" → <NoneNotice intent="moodboard" />
   ↓
画面に「ムードボードはまだ準備中です」placeholder 表示
   ↓
★ ★ ★ 段階 B coordinate API は ★ **呼ばれない**
```

---

## 3. ★ 真の原因(★ 仮説 1 確定)

★ **古い moodboard intent placeholder が Sprint C-2 開始時に削除されずに残っていた**

### 3.1 経緯

| Sprint | 状態 |
|---|---|
| D1-1〜D1-2a | `overlay-intent.ts` に 21 intent 定義(moodboard / tryon は「将来機能・現在未配線」として `mode="none"`)|
| `ai/page.tsx` NoneNotice | moodboard / tryon / unknown の 3 ブランチで placeholder 表示 |
| Sprint C-2(MB UI 実装) | ★ **stylist-chat 側の `moodboard` intent placeholder は触らず**(MB は別ファイル群で実装)|
| Sprint C-3(MB→coordinate 連鎖) | ★ クライアント側 prompt 構築でサーバー側不変方針 → ★ **段階 A 判定は moodboard intent のまま** |
| **オーナー実機 verify(本問題発見)** | buildMoodboardPrompt 出力「[ムードボード]」がトリガーとなり古い placeholder に hijack |

### 3.2 ★ Sprint C-3 設計案(`7e9921d`)の見落とし

設計案 §6.3 で「サーバー側変更不要」と判断したが、★ **段階 A intent 判定の「moodboard」分類が prompt 内容を hijack する可能性を見落としていた**。

★ 実機 verify で初めて発見 = ★ Sprint C-4 設計案 `4d6cf83` §7 シナリオ 5 が機能した(検証手順が明示されていたから発見できた)。

---

## 4. ★ 修正方針案 A-D 比較

### 4.1 案 A: moodboard intent を削除(overlay-intent.ts + ai/page.tsx)

| 観点 | 内容 |
|---|---|
| overlay-intent.ts | L42(intent 説明)+ L69(mode rule)から moodboard 削除 / 21 → 20 intent |
| ai/page.tsx | NoneNotice の moodboard ブランチ削除 |
| 段階 A 判定 | MB-prompt は「コーデ提案」キーワードから coordinate と判定される(★ 期待)|
| サーバー側変更 | あり(prompt + NoneNotice)|
| リスク | 段階 A 再学習リスク(LLM が「ムードボード」見て unknown と誤判定する可能性)|
| 規模 | +0 -5 行(削除中心)|

### 4.2 案 B: 段階 A プロンプトに「[ムードボード] で始まる prompt は coordinate」明示

| 観点 | 内容 |
|---|---|
| overlay-intent.ts | L26 coordinate 例文に追加:「[ムードボード] のテーマに合うコーデを提案して」|
| ai/page.tsx | NoneNotice 不変(他の placeholder と共存)|
| 段階 A 判定 | LLM が「[ムードボード]」を coordinate のキーワードとして学習 |
| サーバー側変更 | あり(prompt 1-2 行追加) |
| リスク | LLM 判定の振る舞いが微妙に変わる(★ 既存 coordinate 判定の精度低下リスク)|
| 規模 | +1-2 -0 行 |

### 4.3 案 C: ★ クライアント側 buildMoodboardPrompt 改訂で「[ムードボード]」を避ける(★ 推奨)

| 観点 | 内容 |
|---|---|
| buildMoodboardPrompt | ★ 冒頭に「コーデ提案: ...」を入れ + 「[ムードボード]」を「[ムードボードの世界観]」等に変更 |
| overlay-intent.ts | ★ **完全不変**(既存 21 intent 全保持) |
| ai/page.tsx | ★ **完全不変**(NoneNotice / 既存経路全保持) |
| 段階 A 判定 | 「コーデ提案: ...」が冒頭にあるため intent="coordinate" と判定される |
| サーバー側変更 | ★ **なし** |
| リスク | ★ 極小(prompt 構造の微調整のみ)|
| 規模 | +2-3 -2 行(`lib/prompts/moodboard-prompt.ts` 内のみ)|
| **★ 重要** | ★ **Phase 2 完成 + chat 連携完成** を **MVP リリース可能な状態** に最小修正で到達 |

### 4.4 案 D: ChatPage で MB attach 時に intent="coordinate" 強制

| 観点 | 内容 |
|---|---|
| ChatPage | sessionStorage 受け取り時に hidden state `forcedIntent="coordinate"` set |
| stylist-chat API | body に `forcedIntent?` パラメータ追加・段階 A をスキップ |
| サーバー側変更 | あり(stylist-chat route 改修)|
| リスク | ★ **大**(段階 A バイパス = 既存 5 層多段防御の構造遮断パスを変える) |
| 規模 | +30-50 行(クライアント + サーバー)|

---

## 5. ★ ★ ★ 推奨案: 案 C(クライアント側 prompt 改訂)

### 5.1 推奨理由(★ 5 件)

1. ★ **サーバー側完全不変**(`overlay-intent.ts` / `ai/page.tsx` NoneNotice / 既存 5 intent 経路 / 段階 A LLM 判定 全保持)
2. ★ **クライアント側のみ最小修正**(`lib/prompts/moodboard-prompt.ts` 数行)
3. ★ **既存 21 intent 体系 + NoneNotice 維持**(将来 MB 専用 intent を作る選択肢残す)
4. ★ **リグレッションテスト 399 PASS 維持**(stylist-chat route 完全不変)
5. ★ **5 層多段防御 全層維持**(構造遮断 / 入口 sanitize / system 禁止 / 出口フィルタ / UI 表示制御 + 三重防御 1 / SSRF / EXIF 除去 / is_public default false / 親 MB 確認)

### 5.2 ★ 具体的修正案(★ 別工程・実装は別 commit)

`lib/prompts/moodboard-prompt.ts` 改訂:

```typescript
export function buildMoodboardPrompt(mb: MoodboardWithItems): string {
  // ...
  const lines: string[] = [];

  // ★ 修正前:
  // lines.push("[ムードボード]");
  // lines.push(`テーマ: ${mb.name}`);

  // ★ 修正後(案 C):
  // 1. 冒頭で「コーデ提案依頼」を明示 = 段階 A 判定 intent="coordinate" 誘導
  // 2. 「[ムードボード]」→ 「[ムードボードの世界観]」で moodboard intent キーワード回避
  lines.push("コーデ提案依頼: 以下のムードボードに合うコーディネートを提案してください。");
  lines.push("");
  lines.push("[ムードボードの世界観]");
  lines.push(`テーマ: ${mb.name}`);
  // ...
}
```

### 5.3 修正規模

- `lib/prompts/moodboard-prompt.ts`: +2-3 行 / -2 行(冒頭 + 「[ムードボード]」→「[ムードボードの世界観]」)
- ★ 純増 ~3 行 / 5-10 分

### 5.4 検証手順(実機 verify)

1. ChatPage で 🎨 MB ボタン → MB 選択 → buildMoodboardPrompt 自動挿入
2. 「送信」→ 段階 A 判定
3. ★ 期待: `intent="coordinate"`, `mode="api"` → stylist-chat coordinate LLM 応答
4. ★ NOT 期待: `intent="moodboard"`, `mode="none"` → 「準備中です」placeholder

★ 段階 A LLM(Haiku 4.5)の判定精度向上のため、コーデ提案依頼を ★ **冒頭 1 行目** に置くのが重要。

---

## 6. ★ 案 C の Phase 2 後ゲート(Sprint D)への含意

| 観点 | 含意 |
|---|---|
| MVP リリース条件 | ★ 案 C 修正後 = MB → coordinate 連鎖が **実機動作** → ★ MVP リリース GO 可能 |
| 既存 5 層多段防御 | ★ 完全維持(構造遮断 / 入口 sanitize / system 禁止 / 出口フィルタ / UI 表示制御)|
| Phase 2 拡張 5 層 | ★ 完全維持(SSRF / EXIF / 三重防御 1 / is_public / 親 MB)|
| 案 A への移行(将来)| MVP-2 期で overlay-intent.ts の moodboard intent を完全削除可(MB 機能完成後の整理)|

---

## 7. ★ Sprint C-4 退行点検チェックリストへの追加教訓

本問題は ★ Sprint C-4 設計案 `4d6cf83` §7 シナリオ 5 の検証で発見された。**Sprint C-4 設計案の価値が ★ 実機で証明された** 例。

★ 追加チェックリスト項目(MVP-2 期):
- 段階 A intent 判定キーワードと MB prompt の **キーワード衝突** チェック
- 「moodboard」「tryon」等の placeholder intent と新規機能の **rouitng 整合性**
- 新 prompt 構造の段階 A 経由 **e2e 動作確認**(LLM 判定をスタブで検証する自動テスト)

---

## 8. ★ 既存達成への影響評価(★ コード 0 変更・全保持)

| 達成項目 | 想定影響 |
|---|---|
| 1.5b 完成形 / race fix v2 / L4-A / A-2 / A-3 / MVP-1c / A-4 / A-10 / A-6 / A-6b / A-5 / A-9 / Sprint B-1 / B-2 / B-3 / C-1 / C-2 / C-3 / C-4 / v4 hotfix | **0**(コード 0 変更)|
| リグレッションテスト | **399 PASS 維持** |
| 既存 5 intent reply 経路 | **0** |
| 既存 21 intent overlay-intent | **0** |
| NoneNotice / ai/page.tsx | **0** |
| 段階 B reply 経路 | **0** |
| 本体 `ac834bb` 6 章 / 7 章 / 判断 6 | **diff 0 行** |
| 本体 / doc7 / 最終ビジョン / 整合性点検 / ロードマップ / コスト試算 / 各設計案 | **diff 0 行** |
| 既存設計判断 1-10 | **文言不変** |

---

## 9. 結論

| 観点 | 結論 |
|---|---|
| ★ 真の原因 | ★ **古い moodboard intent placeholder**(`overlay-intent.ts` L42, L69 + `ai/page.tsx` NoneNotice L693-701)が buildMoodboardPrompt 出力の「[ムードボード]」をトリガーに hijack |
| ★ 推奨案 | ★ **案 C**(クライアント側 prompt 改訂で intent 誘導 / サーバー側完全不変) |
| 修正規模 | ★ +2-3 -2 行 / 5-10 分(`lib/prompts/moodboard-prompt.ts` のみ)|
| ★ 修正後の効果 | MB → coordinate 連鎖が実機動作 → ★ **MVP リリース GO 可能** |
| 既存達成保持 | コード 0 変更で **全保持**(399 PASS 維持・tsc EXIT 0 維持)|
| 不可侵 | 本体 6 章 / 7 章 / 判断 6 / コスト試算 / 整合性点検 / ロードマップ / 各設計案 / 既存設計判断 1-10 ★ **全不変** |
| ★ 次工程 | 本 commit(調査 doc 1 件)→ オーナー判断 → 案 C 実装(別 commit・+2-3 行 / 5-10 分)→ オーナー実機 verify 再実施 → Sprint D 着手 |

→ ★ **MVP リリース前重大問題の解決青写真完遂**

---

## 10. 制約遵守チェックリスト

- [x] 新規 docs ファイル 1 件のみ(本 doc)
- [x] 本体 `ac834bb` / コード(app/api/lib/scripts/package.json/tsconfig.json)/ doc7 / 最終ビジョン `df36d82` / 整合性点検 `ddb86f7` / ロードマップ `d42463b` / コスト試算 `985d00b` / 各設計案 / 他 docs **全 0 変更**
- [x] 本体 6 章 / 7 章 / 判断 6 diff 0 行
- [x] 既存設計判断 1-10 文言不変
- [x] view + grep + 静的解析のみ・実装なし
- [x] tsc EXIT 0 維持(本 doc は markdown のみ・コード 0 変更)
- [x] リグレッションテスト 399 PASS 維持(本工程はコード 0 変更)
- [x] 実装は ★ 別工程(本 doc では実施しない)
- [x] commit はあり / push はなし
