# STYLE-SELF Sprint H-4b — 出力UI 7+5 + MB context object化 細部設計調査(★ E-0e §12 をプロダクトの顔に・stylist-chat 応答形式の構造化 + クライアント分解レンダ + MB context・★ コード 0 変更・doc のみ)

- 作成日: 2026-05-31
- 起点 HEAD: `191046e`(H-4a thread接続+localStorage自動移行・実機verify 6項目クリア・clean / 399 PASS / tsc EXIT 0)
- 本 doc の役割: H-4 設計(`700f61f`)§B 工程3+4 を実装可能な細部に翻訳。E-0e §12 の「表示順7 + 折りたたみ5」と MB の context object 化を確定する(★ コード 0 変更・実装は次の指示)
- 確定論点: H4-3 JSON metadata / H4-4 固定+動的併用 / H4-5 初回送信時構築 / H4-7 構造化JSON
- Layer 1 進捗: 4/5(H-1〜H-4a 完了)→ H-4b は出力体験の中核

---

## 0. ★ ★ ★ 既存資産 verify 結果(2026-05-31 実機確認・★ ★ 重大な前提補正)

| # | タスク前提 | ★ 実機確認結果 | 補正の重み |
|---|---|---|---|
| 1 | reply は text + editorScore | ✅ そのとおり。**ただし system prompt は「`返答本文のみ・JSON/タグ/括弧注釈/絵文字 一切付けない`」**(stylist-chat.ts:85-86)= 出力は**意図的に自然文プロース** | ★★★ H-4b は「JSON 禁止 → JSON 強制」の**出力契約の反転**。additive でなく**根本変更**。後述の三重防御に波及 |
| 2 | 折りたたみ「11項目」= editor 11項目 | ⚠️ editor は **10軸**(novelty/rarity/mb_translation/daily_use/photogenic/post_worthy/searchable/personal/whitespace/signature_anomaly)。**「11項目」は `buildMoodboardPrompt` の入力指示**(比率・素材・色・カット・シルエット・ライン・重量・構造・調和・機能・テーマ / moodboard-prompt.ts:142-143) | ★★ 11項目は**出力に存在しない**。折りたたみ b に出すには構造化出力へ新規に含める必要 |
| 3 | KO 参照ルールを折りたたみ d に表示 | ⚠️ KO は `fetchKnowledgeOSContext` で取得し **LLM context に注入するのみ・クライアントに返していない** | ★★ route が `koRules` を**追加で応答に含める**必要 |
| 4 | (前提なし) | ⚠️ **三重防御**: route は `stripCanonicalSlugs(replyRaw)`(L225)で reply 文字列から英語スラッグを除去。system prompt もスラッグ/ID/JSON 禁止 | ★★★ JSON 出力化で strip は**JSON 文字列フィールド走査**に変更必須。privacy 退行ゼロが至上 |
| 5 | LLM が CoordinateReply を返す | ⚠️ 1 回の Haiku 呼出で **入れ子 JSON(direction/summary/items[]/sources[]/imageAnalysis[]/items11[]/quickActions...)** を完全出力するのは parse 失敗リスク高 | ★★ H4b-4 フォールバック必須・b1/b2 分割を後押し |
| 6 | buildMoodboardPrompt を context に転用 | ✅ 可能(裏で再利用)。MB_PROMPT_SIGNATURE は **H-4c で根治・H-4b では触らない** | ─ スコープ確認 |

> ★ ★ 結論: H-4b は「表示の足し算」ではなく **出力契約(プロース→構造化JSON)の作り替え + privacy 機構の再設計**を含む。親設計の +200-300 行見積は楽観的で、**+480-780 行**が現実的(§H)。

---

## A. 既存資産 verify(§0 に集約)
対象: `lib/prompts/stylist-chat.ts`(出力=プロース・JSON禁止)/ `app/api/ai/stylist-chat/route.ts`(reply text + stripCanonicalSlugs + KO は context のみ)/ `lib/prompts/editor-prompt.ts`(10軸+6チェック)/ `lib/prompts/moodboard-prompt.ts`(11項目は入力指示)/ `lib/knowledge-os/client.ts`(DecisionRule/FailurePattern/InfluenceData 型)。

---

## B. 出力 UI 表示順 7項目(細部)
| # | 項目 | JSON フィールド | レンダ |
|---|---|---|---|
| 1 | 今回の方向性 1-2文 | `direction: string` | 太字段落・上部 |
| 2 | コーデ案の要約 | `summary: string` | 通常段落(3-5行) |
| 3 | 具体アイテム一覧 | `items: {category, description}[]` | カテゴリ別縦リスト(アウター/トップス/ボトムス/靴/小物/ヘア/メイク) |
| 4 | MB由来の要素 | `sources: {imageIdx, caption, mapping}[]` | 「画像N→反映先」行リスト |
| 5 | 画像 | `visualization?: {imageUrl, generatedPrompt}` | ★ 既存 VisualizeButton(C-2g)流用・生成後 inline |
| 6 | 修正ボタン | `quickActions[]`(固定)+ `customActions[]`(動的1-2) | クリック→そのまま送信 |
| 7 | 詳細分析 | (下記5項目) | `<details>` デフォルト closed |

固定修正ボタン(H4-4): もっと日常的に / もっと不穏に / 靴だけ変更 / アイテム削減 / 色味を変えて。動的(LLM)は MB 文脈特有 1-2 個。

## C. 折りたたみ 5項目(細部)
| 記号 | 項目 | JSON | 補足 |
|---|---|---|---|
| a | 参考画像の反映 | `imageAnalysis: {imageIdx, caption, surfaceVsEssence, translation}[]` | ★ E-0a「表面真似禁止」の翻訳を表現 |
| b | 11項目 | `items11: {name, content}[]` | ★ 補正: buildMoodboardPrompt 入力11項目を**出力にも含める**新規要件 |
| c | 品質評価 | `editorScore`(既存10軸+verdict+attempts) | ★ 既存 EditorScoreFold 流用 |
| d | Knowledge OS 参照ルール | `koRules: {type, content}[]` | ★ 補正: route が追加返却(現状 context のみ) |
| e | 生成プロンプト | `promptDebug: {systemPrompt, userPrompt}` | C-2g 透明性慣習・`<pre>` |

## D. CoordinateReply JSON 構造(全体)
```ts
type CoordinateReply = {
  type: "coordinate_v2";                    // ★ Message 判別共用体に追加(後方互換: 旧 "reply" 維持)
  // 表示順 7
  direction: string; summary: string;
  items: { category: string; description: string }[];
  sources: { imageIdx: number; caption: string; mapping: string }[];
  visualization?: { imageUrl: string; generatedPrompt: string };  // 後付け
  quickActions: { label: string; prompt: string }[];
  customActions: { label: string; prompt: string }[];
  // 折りたたみ 5
  imageAnalysis: { imageIdx: number; caption: string; surfaceVsEssence: string; translation: string }[];
  items11: { name: string; content: string }[];
  editorScore?: EditorScorePayload;        // 既存型
  koRules: { type: string; content: string }[];
  promptDebug: { systemPrompt: string; userPrompt: string };
};
```

### 5 intent との切替(H4b-7)
- **coordinate intent のみ** `coordinate_v2`。diagnose / closet / style-consult / brand-learn は**旧プロース形式維持**(H-4b で触らない)。
- 判定は現行 `isMbCoordinate`(= `MB_PROMPT_SIGNATURE` 先頭一致)を流用。★ moodboard_id ベースへの置換は **H-4c**(H-4b では signature 判定不変)。

---

## E. MB context object 化
- 現状: sessionStorage `mb_prompt` を本文に prepend(ユーザーに長文露出 = E-0e 問題1)
- H-4b 後: thread.moodboard_id(H-1 列)から**サーバー側で context 構築**(ユーザー非表示):
```
context = { moodboard{id,theme,concept,worldview_name,captionedItems}, bodyProfile, worldview_profile }
→ buildMoodboardPrompt(裏で再利用)で long prompt を作り LLM へ。ユーザーには見せない。
```
- 構築タイミング: **初回メッセージ送信時**(H4-5)・以降 thread に紐づく
- `buildMoodboardPrompt` は**廃止しない**(裏で再利用)/ `MB_PROMPT_SIGNATURE` は**不変**(H-4c)
- thread.moodboard_id への紐付け: H-4b では既存 sessionStorage 経路を維持しつつ thread 新規作成時に列保存。**MB 選択モーダル UI は H-5**(段階的)

---

## F. stylist-chat route の応答形式変更
- coordinate のみ: `reply: string` → `coordinate: CoordinateReply`(構造化)
- system prompt: 「本文のみ・JSON禁止」→ **「指定 JSON スキーマで出力」**(coordinate 経路のみ・他 intent のプロンプトは不変)
- ★ ★ ★ 三重防御の再設計(必須): `stripCanonicalSlugs` を **CoordinateReply の全 string フィールドに再帰適用**(現状は単一 reply text のみ)。privacy 退行ゼロを担保
- ★ JSON parse 失敗時(H4b-4): **旧プロース形式へフォールバック**(`reply` text として表示)を推奨 = 退行ゼロ・体験は劣化するが壊れない

---

## G. クライアント分解レンダ(新規 component)
| component | 役割 |
|---|---|
| CoordinateMessage.tsx | 7項目メインレンダ(分岐の親) |
| CoordinateItems.tsx | ③カテゴリ別アイテム |
| MoodboardSources.tsx | ④MB由来 |
| QuickActionButtons.tsx | ⑥固定+動的(★ H-3 で未作成・本工程で新規) |
| DetailsFold.tsx | ⑦折りたたみ枠 |
| Items11.tsx / ImageAnalysis.tsx / KoRules.tsx / PromptDebug.tsx | 折りたたみ b/a/d/e |
| (①direction ②summary は CoordinateMessage 内で直接描画・小component化は任意) |
- 既存流用: **VisualizeButton(C-2g)**・**EditorScoreFold(C-2c-1)**
- page.tsx: Message 判別共用体に `coordinate_v2` 追加 + 分岐レンダ。旧 `reply`/`coordinate` は後方互換表示(DB 過去 message)

---

## H. ファイル影響範囲
| 区分 | ファイル | 行数 |
|---|---|---|
| 新規 component | CoordinateMessage / CoordinateItems / MoodboardSources / QuickActionButtons / DetailsFold / Items11 / ImageAnalysis / KoRules / PromptDebug(9) | +200-300 |
| 新規 type | types/coordinate-reply.ts | +50 |
| 新規 lib | lib/server/moodboard-context.ts(context 構築) | +50-80 |
| 編集 | app/(app)/ai/page.tsx(判別共用体+分岐レンダ) | +50-100 |
| 編集 | app/api/ai/stylist-chat/route.ts(応答構造化+strip再帰+KO返却) | +80-150 |
| 編集 | lib/prompts/stylist-chat.ts(JSON スキーマ指示・coordinate のみ) | +50-100 |
| **合計** | | **+480-780 行** |
> ★ 親設計 +200-300 からの上振れ理由: ①出力契約の反転 + 三重防御 JSON 対応 ②component 細分化 ③11項目/KO の新規出力化 ④後方互換 ⑤context object 構築。

---

## I. 段階分割(★ ★ 推奨: b1/b2)
| 段階 | 内容 | 行数 | verify |
|---|---|---|---|
| **H-4b1** | reply 構造化 + 表示順7 + route 応答変更 + strip再帰 + parse失敗フォールバック | +250-400 | coordinate が7項目で表示・privacy維持・壊れない |
| **H-4b2** | 折りたたみ5(a/b/c/d/e)+ KO返却 + MB context object化 | +230-380 | 折りたたみに11項目/品質/KO/prompt・MBは裏context |
- 依存 b1→b2。各段階で中央が壊れない。

---

## J. H-4c との整合(★ ちゃぶ台返し回避)
| H-4b で触る | H-4c で触る(H-4b では不変) |
|---|---|
| 出力UI 7+5 / reply 構造化 / route 応答(coordinate) / context object / strip 再帰 | MB_PROMPT_SIGNATURE 判定 / thread.moodboard_id ベース判定への置換 / editor 必須化 / KO 疎結合 |
- ★ H-4b は **signature 判定をそのまま使う**(MB 経由の検出ロジックは H-4c まで不変)。

---

## K. オーナー判断 7 論点(★ 推奨併記)
| # | 論点 | ★ 推奨 |
|---|---|---|
| H4b-1 | 表示順7の順序 | **E-0e §12 どおり**(方向性→要約→アイテム→MB由来→画像→修正→折りたたみ) |
| H4b-2 | 固定修正ボタン5個 | **妥当**(日常化/不穏/靴/削減/色)・実装後に調整可 |
| H4b-3 | 動的ボタン数 | **1-2個**(過多回避) |
| H4b-4 | JSON parse 失敗時 | **旧プロース形式へフォールバック**(退行ゼロ) |
| H4b-5 | b1/b2 分割 | **分割**(M5刻む作法) |
| H4b-6 | 後方互換範囲 | **旧形式はそのまま表示**(migrate しない・DB 過去 message を壊さない) |
| H4b-7 | 5 intent 切替 | **coordinate のみ新形式**・他は旧維持 |
| (追加) | 三重防御 | **stripCanonicalSlugs を JSON 全 string に再帰適用**(privacy 退行ゼロ) |
| (追加) | 構造化信頼性 | b1 で parse 失敗フォールバックを先に固める / 必要なら将来 2-call 構造化を検討 |

---

## L. 4本柱との整合
| 柱 | H-4b での反映 |
|---|---|
| E-0a 表面真似禁止 | 折りたたみ a(surfaceVsEssence/translation)で表現 |
| E-0b-rev2 実商品試着 | 表示順5(画像)・本格は H-7 |
| E-0c 服好き基準 | 折りたたみ c(editorScore・既存) |
| E-0d Knowledge OS | 折りたたみ d(koRules・route 追加返却) |
| E-0e UX | ★ H-4b 全体が E-0e §12 の実装 |
- 不可侵境界線: 本体 `ac834bb` / doc7 / 最終ビジョン `df36d82` / 既存戦略文書 全0変更 → H-4b 設計は侵さない。

---

## 検証(本 doc)
- ✅ コード 0 変更(doc 1 件のみ)/ tsc EXIT 0 維持 / 399 PASS 維持
- ✅ 本体 / 戦略文書(E-0a〜E-0e)/ 最終ビジョン / 各設計案 全 0 変更
