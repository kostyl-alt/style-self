// D1-2a: 自然言語オーバーレイ・navigate intent → URL 対応表
//
// 設計: docs/STYLE-SELF_D1_実装設計.md セクション 4.2 / 5(D1-2a)
//
// 【★/self タブ命名トリック(D1-2a で確定した知見)】
// SelfTab value と label が直感と逆転している:
//   value="diagnosis" → label「世界観」(世界観診断結果表示 + 公開設定)
//   value="worldview" → label「好み」 (preference 編集)
// → worldview-profile  intent は /self?tab=diagnosis に飛ばす
// → preference-edit    intent は /self?tab=worldview  に飛ばす
// 本対応表で吸収する(配線時に間違えない構造的解決)。
//
// 【スコープ(D1-2a)】
// navigate 群 9 intent のみ。api / hybrid / none は別経路で扱う。

export interface NavigateTarget {
  url:         string;
  description: string;   // UI で「○○ に移動します」と短く案内する用(任意)
}

export const NAVIGATE_MAP: Record<string, NavigateTarget> = {
  diagnose: {
    url:         "/onboarding",
    description: "世界観診断を始めます",
  },

  // ★ タブ命名トリック: value="diagnosis"(label「世界観」)に寄せる
  "worldview-profile": {
    url:         "/self?tab=diagnosis",
    description: "あなたの世界観プロフィールを開きます",
  },

  moodboard: {
    url:         "/moodboard",
    description: "ムードボードを開きます",
  },

  "create-post": {
    url:         "/self/new-post",
    description: "投稿作成画面を開きます",
  },

  "my-posts": {
    url:         "/self?tab=posts",
    description: "あなたの投稿一覧を開きます",
  },

  closet: {
    url:         "/outfit?tab=closet",
    description: "クローゼットを開きます",
  },

  saved: {
    url:         "/saved",
    description: "保存済みを開きます",
  },

  history: {
    url:         "/self?tab=history",
    description: "AI履歴を開きます",
  },

  "body-edit": {
    url:         "/self?tab=body",
    description: "体型情報の編集画面を開きます",
  },

  // ★ タブ命名トリック: value="worldview"(label「好み」)に寄せる
  "preference-edit": {
    url:         "/self?tab=worldview",
    description: "好みの編集画面を開きます",
  },
};

export function resolveNavigateTarget(intent: string): NavigateTarget | null {
  return NAVIGATE_MAP[intent] ?? null;
}
