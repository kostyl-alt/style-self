// Sprint 40: 色名の表記揺れ吸収マップ
//
// item.color（AI生成、例：「白」「ホワイト」「墨色」）と
// product.normalized_color（DB上の正規化値）を柔軟に照合するため、
// カノニカル名と一般的な表記揺れをマッピングする。

export const COLOR_ALIASES: Record<string, string[]> = {
  "ホワイト":     ["白", "オフホワイト", "アイボリー", "クリーム", "生成り"],
  "ブラック":     ["黒", "ジェットブラック", "墨色"],
  "グレー":       ["灰", "ライトグレー", "チャコール", "石灰グレー"],
  "ベージュ":     ["ベージュ", "ヌード", "サンド", "土色", "キャメル"],
  "ネイビー":     ["濃紺", "インクブルー"],
  "ブラウン":     ["茶", "ダークブラウン", "ココア"],
  "ブルー":       ["青", "サックス", "ライトブルー"],
  "グリーン":     ["緑", "カーキ", "オリーブ"],
  "レッド":       ["赤", "ボルドー", "ワイン"],
  "ピンク":       ["ピンク", "ローズ", "サーモン", "ベビーピンク"],
  "イエロー":     ["黄", "マスタード", "クリームイエロー"],
  "オレンジ":     ["オレンジ", "テラコッタ"],
  "パープル":     ["紫", "ラベンダー"],
  "シルバー":     ["銀", "メタリックシルバー"],
  "ゴールド":     ["金", "メタリックゴールド"],
};

// 与えられた色名のエイリアス配列（自身を含む）を返す
export function expandColorAliases(color: string): string[] {
  if (!color) return [];
  for (const [canonical, aliases] of Object.entries(COLOR_ALIASES)) {
    if (canonical === color || aliases.includes(color)) {
      return [canonical, ...aliases];
    }
  }
  return [color];
}

// 2つの色文字列が「同じ系統」と判定できるか
export function isColorMatch(itemColor: string, productColor: string | null): boolean {
  if (!productColor || !itemColor) return false;
  const aliases = expandColorAliases(itemColor);
  return aliases.some((a) => productColor.includes(a) || a.includes(productColor));
}
