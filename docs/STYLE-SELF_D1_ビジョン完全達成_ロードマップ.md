# STYLE-SELF D1 ビジョン完全達成 ロードマップ(Sprint A〜G)

> 設計軸: [docs/STYLE-SELF_D1_実装設計.md](./STYLE-SELF_D1_実装設計.md)(本体 `ac834bb` = `41e9139` + 判断 10)
> 思想: [docs/STYLE-SELF_診断システム_再設計.md](./STYLE-SELF_診断システム_再設計.md)(doc7・①知る再定義)
> 実装順序: ★ **本 doc**(セッション内整理 2026-05-22・A-1 完遂直後)
>
> 3 レイヤー構造: **本体(設計軸)+ doc7(思想)+ 本 doc(実装順序)**
> 本 doc は新規設計判断や工程追加をしない・セッション内整理を忠実に doc 化したもの

---

## 1. 背景

### 1.1 究極ビジョン
**ChatGPT の服版 × リアル試着 × 世界観一貫** — 服を通して「自分を知る・選ぶ・組む・買う」
を世界観を軸に一つの判断フローで扱えるワードローブ OS。Phase 1-4 で段階構築。

### 1.2 既存達成サマリ(2026-05-23 時点・origin/main `2ef689e`)
| commit | 内容 | 状態 |
|---|---|---|
| `040078c` | 履歴永続化 race fix v2 案 C(useState 化 + 多層防御) | ✅ |
| `60c7fa8` | L4-A 切替検出投入(SWITCH_THRESHOLD=0.85)| ✅ 1.5b 完成形 |
| `3e39f99` | リグレッションテスト(97 → 119 assertion)| ✅ 安全網 |
| `985d00b` | コスト試算 再評価別 doc(¥250-300/月・将来制限策 P1-P5)| ✅ |
| `ac834bb` | A-1-T1 doc7 ①知る再定義 最小統合(判断 10 確定)| ✅ |
| `3d1a740` | A-1-T2 8 パターン廃止 監査(Phase C 準備資料)| ✅ |
| `59fa4d6` | A-2 BottomNav / OverlayFab / OverlayModal 廃止(-632 行)| ✅ |
| `11cf3de` | A-3 MenuDrawer + ChatPage [≡] + 新しいチャット(案 A シンプル) | ✅ |
| `182c25b` | MVP-1c coordinate intent 単体投入(3 intent 拡張・119 PASS) | ✅ |
| `2ef689e` | 段階 A プロンプト修正(virtual narrow / coordinate broad・MVP-1c 完成形) | ✅ |

### 1.3 本 doc の位置づけ(★ 4 レイヤー構造)
- 本体 `ac834bb` = **設計軸**(章 0-11・確定設計判断 1-10)
- doc7 = **思想**(①知る再定義・アプローチ 2)
- ★ 本 doc = **実装順序**(Sprint A〜G・27-36 セッション・1-3 ヶ月見当)
- ★ 最終ビジョン `df36d82` = **北極星**([STYLE-SELF_最終ビジョン.md](./STYLE-SELF_最終ビジョン.md)・「何を作るか」最終形)
- 整合性点検: [STYLE-SELF_D1_最終ビジョン_ロードマップ_整合性点検.md](./STYLE-SELF_D1_最終ビジョン_ロードマップ_整合性点検.md)(`ddb86f7`・ギャップ 4 件 + 改訂案)

---

## 2. 設計原則(順序判断の基準・9 箇条)

1. **既存積み上げを壊さない**(1.5b 完成形 / race fix v2 / L4-A / リグレッションテスト / コスト試算)
2. **③ 安全装置 diff 0 行を最後まで守る**(③ プライバシー専章 / ③ コスト管理 / Phase 2 後ゲート)
3. **短い成功 → 検証 → 次の山**(M5 刻む作法・1 Sprint で 1 山)
4. **体験のコア → 補完 → 拡張 → 先の Phase**(Phase 1 完成 → Phase 2 → ゲート → Phase 3/4)
5. **ビジョンマップは「正解の問い」見直しの機会**・節目(Sprint 完了時)で統合
6. **リスク大の工程(リアル試着)は最後**・Phase 2 後ゲートで GO/NO-GO 判断
7. **実機で発見された課題は推測せず実物コードで真因切り分け**(本セッション仮説 H1 確定の作法・コード参照付き分析)
8. **LLM 分類差はプロンプト精緻化で解決**(コード改修ではなく・段階 A 修正 `2ef689e` の作法)
9. **3 レイヤー構造を維持**(本体 `ac834bb` 設計軸 + doc7 思想 + 本 doc 実装順序の役割分担)

---

## 3. Sprint A: Phase 1 中身完成(8-10 セッション)

### 3.1 A-1 ビジョンマップ統合(★①知る再定義 doc7)
- **T1**: 本体最小統合(判断 10・4.7・11 章注記) → ✅ **完了** `ac834bb`
- **T2**: 8 パターン legacy 監査(全参照リスト・3 分類)→ ✅ **完了** `3d1a740`
- **T3**: Phase C 実装(コード -600 行・マイグレ 0 件)→ **MVP-1c 完了後の別 Sprint**

### 3.2 A-2 P1-C-2 — BottomNav / OverlayFab 廃止 → ✅ **完了** `59fa4d6`
判断 8(タブなし完全チャット型・案 A)の物理実装。BottomNav / OverlayFab / OverlayModal の
3 ファイル完全削除(-632 行)・`(app)/layout.tsx` を DevAuthBadge + children のみに簡素化。

### 3.3 A-3 P1-C-3 — MenuDrawer + ChatPage 右上 [≡] → ✅ **完了** `11cf3de`
判断 8 補助機能集約点の実装。`components/chat/MenuDrawer.tsx`(137 行)新規・navigate 7 件
+ 新しいチャット(案 A シンプル・race fix v2 伏線回収)+ placeholder 2 件。

### 3.4 A-4 P1-C-4 — チャットコマンド + 到達点検 + プライバシー漏洩点検 → ✅ **完了** `66dd5bb`
設計調査 `66dd5bb` で 全画面到達経路マトリクス(18 dir / 22 page.tsx × 4 経路)を整理し、
全 intent が navigate-map 経由で正しく到達することと worldview_tags 英語スラッグの非露出を
構造的に証明。三重防御 (1)(2)(3) を 3 reply 経路全てで維持確認。コード 0 変更で完遂。

### 3.5 A-5 P1-D — 上部世界観カード + 提案チップ 5 + 入力欄近接 4 ボタン → ✅ **完了** `c126f76` + `fcbe065`
設計調査 `c126f76` + 実装 `fcbe065`(+663/-16 行)で UI 完成形達成。
`WorldviewCard`(worldviewName + keywords 5 pill + 詳しく見るリンク + 未診断 CTA)+
`SuggestionChips`(5 intent 各 1 つの提案チップ・textarea 挿入)+ `InputAttachments`(📎 写真 /
🔗 URL / 👕 服 / 🎨 MB の 4 ボタン)+ `ClosetPickerModal`(★ 完全実装・GET /api/wardrobe 流用)
の 4 新規コンポーネント + `/api/worldview-card` 新規 API(列絞り SELECT)。
★ MVP 優先項目 6「商品画像・商品 URL・MB をチャットに渡す」直対応達成。

### 3.6 A-6 MVP-1c — 残 5 intent 会話化 → 🟡 **部分完了**(coordinate / style-consult / brand-learn 完遂・残 3 intent 拡張領域)
- **coordinate**: ✅ 完遂 `182c25b` + `2ef689e`(段階 A プロンプト修正で完成形達成)
- **style-consult**(A-6・残 5 第 1 弾): ✅ 完遂 `4cabf4a` + `626b57d`(4 intent 拡張・fetchStyleConsultContext + few-shot 3 件・119 → 327 PASS)
- **brand-learn**(A-6b・残 5 第 2 弾): ✅ 完遂 `65bad33` + `3589dcc`(5 intent 拡張・fetchBrandLearnContext + KOS getInfluences 統合・327 → 399 PASS)
- **残 3 intent**(virtual-coordinate / product-match / match-users): ★ **Phase 1 強化期間 = 拡張領域**(MVP 優先 7/8 達成済のため緊急性低・Sprint B-G の中で段階的着手)
  本体 4.7 マップ + A-6 / A-6b で確立した 4 作法を完全踏襲(段階 A 修正 + MVP-1c fetcher + A-4 三重防御 + A-10 KOS 共通注入)で +130-200 行 / 60-80 分 規模想定。

### 3.7 A-7 P1-E — 対話完結 8 結果カード + 漏洩点検 → ⬜ **拡張領域**(Phase 2 領域隣接)
intent ごとの結果カード(NavigateConfirm 等)を会話完結型に。三重防御(列絞り / system 明示 /
出力フィルタ)維持確認。★ Phase 1 強化期間として Sprint B-G の中で段階的着手。

### 3.8 A-8 P1-F — virtual → product 連鎖 + 次アクション 3 → ⬜ **拡張領域**(Phase 2 領域隣接)
判断 5-③ MVP 含む。virtual-coordinate 結果から product-match への自然遷移。★ Phase 2 / 3 への
布石として Sprint B-G の中で段階的着手。

### 3.9 A-9 P1-G — 仕上げ + 退行点検 + 知見 docs 追記 → ✅ **完了** `0d38e99` + 本セッション最終 commit
設計調査 `0d38e99` で 4 作法体系化 + 三重防御の進化(5 層多段化)+ MVP 優先 7/8 達成整理 +
退行点検 10 項目チェックリスト。本 commit で Sprint A 進捗反映 + CHANGES.md 追記 +
★ **ChatGPT の服版 Phase 1 完成宣言**。コード 0 変更で完遂(399 PASS 維持)。

### 3.10 ★ A-10 Knowledge OS 連携(★ 整合性点検 `ddb86f7` ギャップ C・緊急性最高)
- 内容: `lib/knowledge-os/client.ts`(MCP 接続済)を stylist-chat 段階 B から呼出 +
  `lib/dictionaries/`(素材 14 / 色 15 / ライン 10 / 比率 8)を contextData に統合・
  `getDecisionRules` / `getFailurePatterns` 呼出 → プロンプト統合
- 効果: ビジョン本文「黒の重心・光沢」「素材と重心で差を出す」「白すぎるスニーカーは
  静かな世界観を壊す」型の知識ベース返答を段階 B reply で達成(MVP 優先 7 番目)
- 規模(当初予測): +50-100 行 / 60-90 分
- 規模(設計案 `9bfb0cc` 再計測): +100-155 行 / 75-105 分
- 規模(実装完了時実測): **+340 insertions / 9 deletions(コード +189・test +155・ロードマップ +5)**
  - 上振れ要因: `getFailurePatterns` wrapper が `lib/knowledge-os/client.ts` 未実装(MCP server 側にはあり)→ 新規追加 +23 行 / `getRatioContext` helper が `lib/dictionaries/inject.ts` 未実装 → 同形追加 +17 行 / route.ts は `fetchKnowledgeOSContext` + `matchDictionaryKeys` + Promise.all 統合 + 入口 sanitize で +101 行 / prompt 型 + buildMessage KOS ブロック + system 1 行追加 で +48 行 / リグレッション拡張(case K1-K5)で 119 PASS → **266 PASS**(`PRODUCT_WORLDVIEW_TAGS` 31 語イテレーションが入口 sanitize / dictionaries 出力 / user message の 3 経路 × 31 語で +147 assertion 上乗せ)
  - コスト軽微(¥0.0001 級・三重防御維持)は不変
- ★ A-4 と経路独立(A-4 = UI 側 routing / A-10 = API 側 reply 生成)→ **並走可能**(章 11 案 Y)

→ **Phase 1 完全達成**

---

## 4. Sprint B: Phase 1 完成後 戦略整理(2-3 セッション)

### 4.1 B-1 Phase 2 前ゲート評価
Phase 1 の体験品質・コスト実績・残課題の評価。Phase 2(ムードボード)着手判断。

### 4.2 B-2 ビジョンマップ統合(残り doc 群)
doc3(アプリ全体方向性)/ doc4(ビジュアルコンセプト)/ doc5(トレンドリサーチ)/
doc6(AI Knowledge OS)を本体に統合(A-1-T1 と同形の最小統合方式)。

### 4.3 B-3 コスト管理運用化(案 P1 月 N 回上限実装)
コスト試算 `985d00b` 案 P1(月 N 回上限)を実装。`users.chat_count_month` 追加 +
stylist-chat route で上限判定 +20-30 行。

→ **戦略軸完全確定**

---

## 5. Sprint C: Phase 2 ムードボード(5-6 セッション)

### 5.1 C-1 ムードボード設計(doc7 後半 + 本体反映)
### 5.2 C-2 実装(画像収集・タグ付け・保存・他人 MB SNS)
### 5.3 C-3 ムードボード → コーデ提案 連鎖
### 5.4 C-4 完成・退行点検

→ **Phase 2 達成**

---

## 6. Sprint D: ★ Phase 2 後ゲート(最重要判断・1 セッション)

- **リアル試着 GO/NO-GO 判断**
- ③ プライバシー専章(顔写真)・③ コスト管理 慎重評価
- 代替案検討(2D オーバーレイ等 低コスト案)
- **GO → Sprint E** / **NO-GO → Sprint F(Phase 4)先行検討**

★ 本ロードマップ最大の判断点(判断 6「Phase 2 完了後の GO ゲート」整合)

---

## 7. Sprint E: Phase 3 簡易試着(5-8 セッション・ゲート通過時のみ)

### 7.1 E-1 試着技術選定 + プライバシー設計(本体 6 章 ③ 専章準拠)
### 7.2 E-2 簡易試着 MVP 実装
### 7.3 E-3 試着 → 保存 → 共有
### 7.4 E-4 完成・退行点検

---

## 8. Sprint F: Phase 4 高精度試着 × 購入導線(6-8 セッション)

### 8.1 F-1 購入導線設計(楽天 / Amazon 等)
### 8.2 F-2 高精度試着(Phase 3 強化)
### 8.3 F-3 試着 → 購入連鎖
### 8.4 F-4 ★ Phase 4 完成・**最終形達成**(ChatGPT の服版 × リアル試着 × 世界観一貫)

---

## 9. Sprint G: 横断ビジョン要素(随時)

### 9.1 G-1 SNS 兼コマース統合
### 9.2 G-2「日本をファッションの街に」戦略実装
### 9.3 G-3 AI Knowledge OS / Judgment OS 連動

---

## 10. 全体タイムライン

| Sprint | セッション数 | 内容 |
|---|---|---|
| A | 8-10 | Phase 1 中身完成 |
| B | 2-3 | 戦略整理 |
| C | 5-6 | Phase 2 ムードボード |
| D | 1 | ★ Phase 2 後ゲート(最大判断点) |
| E | 5-8 | Phase 3 簡易試着(GO 時のみ) |
| F | 6-8 | Phase 4 最終形 |
| G | 随時 | 横断要素 |
| **合計** | **27-36** | **1-3 ヶ月で全達成見込み**(ペース次第) |

★ Sprint D が最大の判断点(リアル試着 GO/NO-GO・最大リスク工程)

---

## 11. 直近の次の一手(★ 現状 `0d38e99` 以降・★ Phase 1 完成宣言 達成)

**現状サマリ**: Sprint A 8/14 完遂(MVP 優先工程 100%)・★ **ChatGPT の服版 Phase 1 完成宣言**
達成(本 A-9 で正式宣言)。残工程は ★ **Phase 1 強化期間 = 拡張領域** として Sprint B-G の
中で段階的着手。次工程は Sprint B-1 Phase 2 前ゲート評価へ。

### 11.1 Sprint A 完遂工程(2026-05-22 → 2026-05-24・全 8 件 ✅)

| 工程 | 内容 | コミット |
|---|---|---|
| A-1 | doc7 統合(①知る再定義 最小統合)| `ac834bb` |
| A-2 | BottomNav / OverlayFab 廃止(案 A 物理実装) | `59fa4d6` |
| A-3 | MenuDrawer + ChatPage [≡] | `11cf3de` |
| **A-4** | 到達点検 + プライバシー漏洩点検(三重防御 構造証明)| **`66dd5bb`** |
| **A-5** | P1-D UI 完成(世界観カード + 提案チップ 5 + 4 ボタン + クローゼット完全実装)| **`c126f76` + `fcbe065`** |
| **A-6** | MVP-1c 残 5 第 1 弾 = style-consult(4 intent 拡張) | **`4cabf4a` + `626b57d`** |
| **A-6b** | MVP-1c 残 5 第 2 弾 = brand-learn(5 intent 拡張・getInfluences 統合)| **`65bad33` + `3589dcc`** |
| **A-10** | Knowledge OS 連携(案 A フル統合・5 層多段防御)| **`9bfb0cc` + `566e3b2`** |
| **A-9** | 仕上げ + 退行点検 + 知見 docs 追記 + ★ **Phase 1 完成宣言** | **`0d38e99` + 本セッション最終 commit** |

### 11.2 ★ Phase 1 完成宣言(本 A-9 で正式宣言)

**根拠**: MVP 優先 8 項目中 7 項目達成 = **MVP 優先範囲 100% 達成**(残 1 = 項目 8「リアル試着用 身体情報設計」は Sprint E / Phase 2 後ゲート対象で MVP スコープ外)。

**完成形の中身**(★ origin/main で保全):
- 5 intent 五角(diagnose / closet / coordinate / style-consult / brand-learn)
- L4-A 切替検出(5 intent 五角・直接方向 20)
- 三重防御 → 5 層多段防御(構造遮断 + 入口 sanitize + system 禁止 + 出口フィルタ + UI 表示制御)
- Knowledge OS 連携(getDecisionRules + getFailurePatterns + getInfluences + dictionaries 4 種)全 5 intent 共通注入
- コア体験 UI(WorldviewCard + SuggestionChips + InputAttachments + ClosetPickerModal)
- リグレッションテスト 399 PASS(119 → 399・3.35 倍カバレッジ)
- race fix v2 / 履歴永続化 / MenuDrawer / handleNewChat / 既存 v1 API 全保持

### 11.3 残工程 = Phase 1 強化期間(★ 拡張領域・段階的着手)

| 工程 | 内容 | 緊急性 | 着手 Sprint |
|---|---|---|---|
| **A-6c** virtual-coordinate(残 5 第 3 弾)| concept/scene 翻訳設計 | 低 | Sprint B-G で段階的 |
| **A-6d** product-match(残 5 第 4 弾)| 自分の世界観に合う商品 | 低 | 同上 |
| **A-6e** match-users(残 5 第 5 弾)| 世界観の近い人 | 低 | 同上 |
| **A-7** 対話完結 8 結果カード | reply に商品/コーデカード統合 | 中(Phase 2 領域隣接) | Sprint B-C |
| **A-8** virtual → product 連鎖 | 試着想定の商品リコメンド連鎖 | 中(Phase 2 / 3 への布石) | Sprint B-C |

→ 各工程は ★ A-6 / A-6b で確立した 4 作法(段階 A 修正 + MVP-1c fetcher + A-4 三重防御 + A-10 KOS 共通注入)を完全踏襲で実装可能(規模 +130-200 行 / 60-80 分 想定)。

### 11.4 次工程(★ Phase 1 完成宣言後の論理順)

1. **★ Sprint B-1 Phase 2 前ゲート評価**(Phase 1 体験品質・コスト実績・残課題評価 → Phase 2 着手判断)
2. **Sprint B-2 ビジョンマップ統合**(doc3-6 統合 + 横断 TODO 13.7 取り込み)
3. **Sprint B-3 コスト管理運用化**(案 P1 月 N 回上限実装)
4. **拡張領域順次**(A-6c-e / A-7 / A-8 を必要性で順次着手)

---

## 12. 不可侵境界線(全 Sprint で厳守・8 箇条)

1. 既存 DB 直接触らず・既存 API 経由のみ
2. M2-3 / M4-2 / M5 列絞り / view / coreTags 並列 を迂回しない
3. 既存 API 入出力契約を変更しない
4. `/u/[id]` / `/p/[id]` 公開 URL 構造 不変
5. 旧画面ファイルを Phase 1 で削除しない(redirect shim 9 個維持)
6. `worldview_tags` 英語スラッグ非露出(M2-3 / M4 教訓)
7. `service_role` 不使用(本人 RLS のみ)
8. ★ **③ プライバシー専章 / ③ コスト管理 / Phase 2 後ゲート diff 0 行**(全 Sprint 通じて・本体 4.4 不可侵リスト準拠)

---

## 13. 横断 TODO(本セッション発生分・別 Sprint 管理)

Sprint A〜G の本流とは別に、本セッション(2026-05-22 → 2026-05-23)で記録された
横断 TODO を本章に整理(着手タイミングは個別判断)。

### 13.1 履歴管理機能(オーナー指摘 1・MVP-2 等別 Sprint)
- **現状**: 案 A シンプル(`setMessages([])` + `localStorage.removeItem` + `confirm()`)で「現在の会話だけクリア」する最小実装
- **将来**: 案 B(過去会話 archive + 履歴サイドバー)/ 案 C(ハイブリッド)で過去会話を見返せる UX
- **規模**: 設計 1 セッション + 実装 2-3 セッション
- **着手タイミング**: Sprint A 完了後 or Phase 1 完成後の MVP-2 Sprint

### 13.2 `stripCanonicalSlugs` の export 化(将来課題)
- **現状**: [app/api/ai/stylist-chat/route.ts:299-324](../app/api/ai/stylist-chat/route.ts#L299-L324) で **non-export 内部関数**・リグレッションテスト(`3e39f99`)では同形コピー + 連動更新ルール明記で運用
- **将来**: 他 route で同フィルタが必要になった時点で `lib/utils/` に切り出し export 化
- **規模**: `lib/utils/` 新規 +30-50 行 + 既存コピー箇所の置換
- **着手タイミング**: 他 route で `stripCanonicalSlugs` が必要になった時

### 13.3 8 パターン legacy Phase C 実装(A-1-T3・MVP-1c 後)
- **監査資料**: [docs/STYLE-SELF_8パターン廃止_監査.md](./STYLE-SELF_8パターン廃止_監査.md)(`3d1a740`)
- **規模**: コード -約 600 行・マイグレ 0 件(Option B = nullable のまま keep・既適用)
- **着手タイミング**: ★ **MVP-1c 残 5 intent 完了後**(優先 3 完遂後・衝突回避)
- **判定**: X 系 6 ファイル削除 / Y 系 4 ファイル残置(案 a 過去診断温存) / Z 系 4 ファイル対応済

### 13.4 リアル試着 Phase 1-2 体型モデル可視化(整合性点検 `ddb86f7` ギャップ A)
- **現状**: `users.body_profile` 入力は M5 で達成・**体型モデルの 3D/2D 可視化は未実装**
- **改訂案**: Sprint E に E-0(体型モデル可視化)を追加
- **緊急性**: 中(Phase 2 後ゲートの GO 後 = Sprint E 着手時)

### 13.5 髪型 / メイク / カラコン(整合性点検 `ddb86f7` ギャップ B)
- **現状**: ロードマップ未明示(ビジョン Phase 4「将来的に」)
- **改訂案**: Sprint F 内に F-5(髪型/メイク/カラコン提案) or 別 Sprint H として独立
- **緊急性**: 低(MVP 後回し方針通り・Phase 4 以降)

### 13.6 画像 URL / MB 入力 本実装(整合性点検 `ddb86f7` ギャップ D)
- **現状**: A-5 P1-D で 4 ボタン骨格設計予定・本実装は Sprint C(MB)/ Sprint E-F(写真)
- **改訂案**: A-5 完了後の各 Sprint で本実装(MB ボタン → Sprint C / 写真ボタン → Sprint E)
- **緊急性**: 中(A-5 と連動・優先 4 で骨格 → 本実装は各 Sprint で順次)

### 13.7 Sprint B でまとめて統合(13.4-13.6 + B-2 統合工程)
- 13.4 / 13.5 / 13.6 は個別の Sprint 内位置を持ちつつ、Sprint B の「ビジョンマップ統合」
  ([章 4.2 B-2](#42-b-2-ビジョンマップ統合残り-doc-群))で **まとめて整理**(M5 刻む作法・原則 3)
- Sprint A 完成後 + Phase 2 前ゲート(B-1)直後の統合工程として扱う

---

## 14. 結論

- 本 doc が **ビジョン完全達成への羅針盤**
- **3 レイヤー構造**: 本体 `ac834bb`(設計軸)+ doc7(思想)+ 本 doc(実装順序)
- 各 Sprint 着手時に本 doc を参照・進捗反映可能
- 新規設計判断や工程追加は **本 doc では行わない**(セッション内整理の忠実な doc 化)
- 直近 = **A-4(P1-C-4 チャットコマンド + 到達点検 + プライバシー漏洩点検)から再開推奨**(章 11 優先 1)
