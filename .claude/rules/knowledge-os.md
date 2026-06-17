---
paths:
  # cwd 相対 / プロジェクト相対の両対応
  - "lib/knowledge*/**"
  - "app/api/ai/**"
  - "style-self/lib/knowledge*/**"
  - "style-self/app/api/ai/**"
---

# Knowledge OS 連携

このプロジェクトは Knowledge OS（管理者専用ナレッジOS）に MCP 経由で接続されている。
過去の判断ルール・本のメモ・画像分析・影響源分析・改善履歴が参照可能。

## コードを書く前に必ず実行すること
1. **query_knowledge** で関連ナレッジを取得（例: `query_knowledge({ question: "コーデ提案を改善したい" })`）
2. **get_decision_rules** で適用すべき判断ルールを確認（例: `{ category: "コーデ提案", importance_min: 4 }`）
3. **get_failure_patterns** で過去の失敗を回避（例: `{ context: "AI出力の浅さ" }`）
4. **get_fashion_rules**（ファッション関連の機能の場合・例: `{ worldview_tags: ["minimal", "street"] }`）
5. **get_influences**（世界観関連の場合・例: `{ subject_name: "ジードラゴン" }`）

## 参照の優先順位
1. まず query_knowledge で全体像 → 2. get_decision_rules で具体ルール → 3. 重要変更前に get_failure_patterns → 4. ファッション/コーデなら get_fashion_rules + get_influences 併用

## ナレッジが矛盾している場合
importance が高い方 → confidence が高い方 → より新しい created_at → それでも判断できなければユーザーに確認。

## ナレッジを使った後の報告ルール
コード実装後に必ず報告: 使用したナレッジ（query_knowledge の関連IDs）/ 適用した判断ルール / 回避した失敗パターン。

## 重要
新機能を実装する前に、必ず該当する判断ルール・失敗パターンを確認する。過去の知見を活用し、同じ失敗を繰り返さず一貫した世界観を保つ。

> 注: コード内の `lib/knowledge/`（brand-match / brand-facts / STYLE_AXES 等のローカル辞書ロジック）と、この MCP 接続の「Knowledge OS」は別物。前者は決定的なローカル知識、後者は外部 MCP 参照。
