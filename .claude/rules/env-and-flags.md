---
paths:
  # cwd 相対 / プロジェクト相対の両対応
  - ".env*"
  - "lib/flags.ts"
  - "app/api/**"
  - "style-self/.env*"
  - "style-self/lib/flags.ts"
  - "style-self/app/api/**"
---

# 環境変数・フィーチャーフラグ

## 環境変数（.env.local・gitignore済み / 本番は Vercel env）

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 楽天API（詳細は rakuten.md）
RAKUTEN_APP_ID=        # UUIDまたは数字形式
RAKUTEN_AFFILIATE_ID=
RAKUTEN_ACCESS_KEY=    # 管理画面のアクセスキー（RAKUTEN_APP_ID より優先）

# ZOZOTOWN（ValueCommerce 承認後に値を設定）
NEXT_PUBLIC_ZOZO_AFFILIATE_ID=

# Admin Access（/admin/* にアクセス可能な email のカンマ区切り）
ADMIN_EMAILS=
```

## フィーチャーフラグ（lib/flags.ts・`NEXT_PUBLIC_*`・原則 default OFF）

| フラグ | 役割 |
|---|---|
| `MB_CONTEXT_OBJECT` | MB→チャットを長文prompt でなく moodboard_analysis(context object) 経由に（既定 ON＝`!== "false"`） |
| `FEEDBACK_LOOP` | コーデの好き/違う/保存フィードバック + judgment_rules 反映 |
| `TEMPORARY_CHAT_MODE` | 一時チャット（履歴非保存・育成非反映の ChatGPT 同等モード） |
| `AUTOSAVE_THREAD` | チャット履歴 ChatGPT 型 第1段。ON時のみ1通目送信成功後に thread作成＋`?thread=id`をURLに載せ自動DB保存＆リロード復元（OFF/未設定で現状維持・temporary無改修・raceガード付） |
| `ASPIRATION_PHOTO` | 憧れ写真分析（チャットで写真添付→分解） |
| `STYLE_MATCH` | Style Match Result（理想写真→「買える言葉」→すぐ探せる。写真一覧/抽出タグ/検索ワード/外部検索ボタン。写真は aspiration-images に Storage 化＝第2段） |
| `CHATGPT_PERSIST` | ChatGPT 型統一 第3段。ON時のみ feedbackDisplayText の ephemeral を廃し全kind（style-match/photos-sent/photos-structure/products/image）を thread があれば DB 保存＆履歴/リロード復元（写真は storagePaths のみ・base64 は載せない）。OFF/未設定で現状維持（ephemeral・回帰ゼロ）。第4段=空thread発火防止（autosaveEnsureThread が保存対象1件以上で thread 作成＆保存成功後に URL 切替） |
| `RESTORE_LAST_THREAD` | ChatGPT 型統一 第5段。ON時のみ cold open（素の /ai・?thread 無し）で最後の thread（last_message_at 最新）を復元（?thread=id へ replace→既存 load effect が復元）。「新しいチャット」は ?thread を落として新規（一度だけ復元する ref で再復元しない）。OFF/未設定で現状維持（常に新規・中央は空・回帰ゼロ）。?thread 直接指定/temporary/進行中は対象外 |
| `GENERAL_BRAIN_MODE` | 本対話モード（fashion ゲートを迂回し汎用応答） |
| `PRODUCTS_ENABLED` | 実商品候補/購入導線（本番 false） |
| `ENABLE_VISUALIZE` | コーデのビジュアル生成ボタン |
| `ENABLE_CLOSET` | クローゼット添付導線 |

⚠️ **フラグ OFF / 該当 state false で「現状維持（回帰ゼロ）」を保つ**のが本プロジェクトの慣習。新機能はフラグで包み、OFF 時は従来挙動を1ミリも変えない。
