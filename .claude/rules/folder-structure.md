---
paths:
  # cwd 相対 / プロジェクト相対の両対応(セッションがどの階層で起動しても発火)
  - "app/**"
  - "components/**"
  - "lib/**"
  - "types/**"
  - "supabase/**"
  - "style-self/app/**"
  - "style-self/components/**"
  - "style-self/lib/**"
  - "style-self/types/**"
  - "style-self/supabase/**"
---

# フォルダ構成（style-self/）

⚠️ **新しいファイルを作成したら、このファイルのフォルダ構成に追記する**（旧 CLAUDE.md の追記ルールはここへ移設）。マイグレーション追加時は `database.md` にも記載する。

## app/
- **`(app)/`** 認証済みページ:
  - `home` / `discover`(3タブ: インスピレーション/ブランドを学ぶ/カルチャー) / `saved`(コーデ/商品/将来:投稿・カルチャー) / `outfit`(4タブ: コーデ提案/着こなし相談/クローゼット/理想を探す) / `self`(4タブ: 診断/身体/好み/履歴) / `onboarding`(世界観診断・全画面・BottomNav非表示)
  - `ai/page.tsx`(チャット主役のメイン画面・AIスタイリスト) / `moodboard/[id]/page.tsx`(MB詳細・画像グリッド+設計図表示)
  - `admin/{knowledge,products,products/new}`(管理者専用・middleware で認可)
  - **旧ルート群(リダイレクトのみ)**: `shop/style/closet/learn/coordinate/inspire/profile/wardrobe/worldview` → `/outfit` `/discover` `/self` 等へ redirect
  - `layout.tsx`(BottomNav) / トップ `app/page.tsx`(認証状態でリダイレクト)
- **`(auth)/`** 未認証: `login` / `signup` / `callback/route.ts`
- **`api/`**
  - `ai/`: AI機能 route 群 — `coordinate` `abstract-coordinate` `analyze`(診断) `analyze-item`(画像) `analyze-look`(参考写真) `style-consult` `culture-explain` `learn-insight` `profile-fit` `purchase-check` `trend-translate` `virtual-coordinate`(+`concepts`/`translate`) / **`stylist-chat`**(チャット段階B・自然文/coordinate_v2) / **`aspiration-photo`**(写真相談・1枚)
  - `overlay/intent`: チャット段階A（自然言語→intent分類・Haiku）
  - `moodboards/[id]/`: `analyze`(board単位解析・brief生成・GET/POST) / `items/analyze`(per-image Vision) / `items/from-url`(URL→画像追加)
  - `threads/`: 対話AIスタイリストのスレッドCRUD（`[id]` / `[id]/messages` / `[id]/feedback`・親thread経由EXISTS二重防御・user_id 非受領）
  - `admin/`: `sync-rakuten` `sync-trends` `products`(+`[id]`) `knowledge-keywords` `fetch-product-info` `analyze-product-image` `analyze-product-text`
  - `knowledge/`: `rules` `sources`(+`[id]`, `[id]/analyze`)
  - その他: `brands/{list,recommend}` `coordinate`(保存) `history`(+`[id]`) `inspirations` `products/match` `profile` `trends` `wardrobe` `worldview`

## components/
ドメイン別:
- ルート直下: `BottomNav` `BrandCard` `DiagnosisDisplay`(診断結果v3・onboarding/self 共用)
- `chat/`: チャットUI — `ChatSessionProvider`(messages/temporaryMode を持ち上げ) `CoordinateReplyCard`(コーデカード) `ThreadsSidebar` `MoodboardPickerModal` `ClosetPickerModal` `ProductCardList` `MenuDrawer` `InputAttachments` 等
- `style/StyleTabs`(Coordinate/Virtual/Consult/Saved) / `closet/` `discover/`(Inspiration/Culture) `learn/` `saved/` `coordinate/`(CoordinateCard/SilhouetteDiagram/ProductMatch*) `knowledge/` `history/` `wardrobe/`

## lib/
- `claude.ts`(Claude client・`MODEL`/`HAIKU_MODEL`・`callClaude`/`callClaudeJSON`/`callClaudeWithImage`/`callClaudeWithImageText`) `rakuten.ts` `storage.ts` `supabase-{browser,server}.ts` / `supabase.ts`(service role)
- `flags.ts`(NEXT_PUBLIC_* フラグ・→ env-and-flags.md) `style-taxonomy.ts`(`STYLE_AXES` 8軸: genre/culture/era/color/silhouette/material/mood)
- `stylist-chat/context.ts`(intent別 context fetcher・サーバ自前SELECT)
- `knowledge/`: `brand-match`(matchBrands) `brand-facts`(computeBrandMatches) `brand-render`(renderBrandMatchCards) `fashion-axes` `worldview-patterns` `worldview-concepts` `diagnosis-questions` `product-worldview-tags`(31語) `wardrobe-color-systems`
- `utils/`: `silhouette-map` `body-rules` `zozo-link` `season` `knowledge-merge` `url-extract` `history-helper` `color-aliases` `product-match` `admin-check` `worldview-matcher` `strip-raw-json-reply`(生JSON安全網) `parse-coordinate-reply` `strip-canonical-slugs` `moodboard-analysis-service` `moodboard-essentials`(必須要素8) `vision-analyzer`(per-image Vision) `judgment-rules-service`
- `dictionaries/`: `material`(14素材) `color`(15色) `line`(10シルエット) `ratio`(8比率) `index`(re-export) `inject`(getMaterialContext 等)
- `validators/`: `coordinate` `analyze` `purchase-check` `analyze-item`（validateAndFix* 群）
- `prompts/`: 各AI機能のプロンプト — `coordinate` `analyze` `analyze-item` `style-consult` `stylist-chat`(チャット段階B・persona+coordinate_v2契約) `overlay-intent`(分類) `moodboard-analysis`(MB board解析) `moodboard-prompt`(MB→長文prompt) `editor-prompt`(コーデ評価AI) `virtual-coordinate` `concept-translate` `abstract-coordinate` `purchase` `brand-recommend` `trend-translate`/`trend-extract` `learn-insight` `culture-explain` `extract-product-info` `analyze-product-image`/`analyze-product-text` `normalize-product`/`normalize-interpretation` `knowledge-extract` 等

## types/
`index.ts`(アプリ型) `database.ts`(DB型) `chat-thread.ts` `moodboard.ts`(MoodboardRow/Item/Analysis/Brief/ItemVision 等) `coordinate-reply.ts` `chat-ui.ts` `product-candidate.ts` 等

## supabase/
`migrations/`(連番 001〜033・最新 033。**全リストと内容は database.md**) / `seeds/`

## ルート直下
`middleware.ts`(認証) `vercel.json`(Vercel Cron) `.env.local`(gitignore) `CLAUDE.md`
