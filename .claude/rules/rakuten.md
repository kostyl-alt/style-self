---
paths:
  # cwd 相対 / プロジェクト相対の両対応
  - "lib/rakuten.ts"
  - "app/api/admin/sync-*/**"
  - "style-self/lib/rakuten.ts"
  - "style-self/app/api/admin/sync-*/**"
---

# 楽天 API（Ichiba Item Search）

## 認証の二系統（lib/rakuten.ts の fetchRakuten が両対応）
- **新エンドポイント** `openapi.rakuten.co.jp/ichibams/...`: `accessKey` クエリ必須・レスポンスは `Items` フラット配列。
- **旧仕様**: `applicationId` のみ + `Items: [{Item: ...}]` ネスト。
- `fetchRakuten` は両方を併送・両形式を吸収する設計（Sprint 40 で解決済み）。

## キー優先順位
`RAKUTEN_ACCESS_KEY` を優先し、未設定なら `RAKUTEN_APP_ID` にフォールバック。
⚠️ 現状 **UUID 形式の ID は API に拒否される問題あり（未解決）**。

## 楽天商品同期コマンド
```bash
# dryRun
curl -X POST http://localhost:3000/api/admin/sync-rakuten \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"brand": "BEAMS", "hits": 5, "dryRun": true}'

# 本番
curl -X POST http://localhost:3000/api/admin/sync-rakuten \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"brand": "BEAMS", "hits": 20, "dryRun": false}'
```
