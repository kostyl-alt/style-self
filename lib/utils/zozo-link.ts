// ZOZOTOWN search URL builder (Sprint 35 / Phase 1)
//
// Phase 1: シンプルなキーワード検索URLを生成する。
// アフィリエイトIDは NEXT_PUBLIC_ZOZO_AFFILIATE_ID から読む。
// ValueCommerce 提携承認後は本ファイルの実装のみを VC のクリック計測URLに差し替える。

const ZOZO_SEARCH_BASE = "https://zozo.jp/search/";

const CATEGORY_KEYWORD_JP: Record<string, string> = {
  tops:        "トップス",
  bottoms:     "ボトムス",
  outerwear:   "アウター",
  jacket:      "ジャケット",
  vest:        "ベスト",
  inner:       "インナー",
  dress:       "ワンピース",
  setup:       "セットアップ",
  shoes:       "シューズ",
  bags:        "バッグ",
  accessories: "アクセサリー",
  hat:         "帽子",
  jewelry:     "ジュエリー",
  roomwear:    "ルームウェア",
  other:       "",
};

export interface ZozoSearchParams {
  keyword:   string;
  category?: string;
  color?:    string;
}

// AI生成の詳細キーワードをZOZO検索でヒットしやすい短い語に正規化する。
// 例: 「オーガンジー・シルクサテン（光沢面）」 → 「オーガンジー」
//     「黒のセンタープレスワイドパンツ・くるぶし丈・ハイウエスト」 → 「黒のセンタープレスワイドパンツ」（30字でカット）
export function toZozoKeyword(raw: string): string {
  if (!raw) return "";
  // 括弧内（全角・半角）を除去
  let s = raw.replace(/[（(][^）)]*[）)]/g, "");
  // 「・」「/」「×」で分割
  const parts = s.split(/[・/×]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return raw.trim().slice(0, 30);
  // 最初のセグメントを採用。短すぎる場合のみ2つ目まで連結
  s = parts[0];
  if (s.length < 6 && parts[1]) s = `${s} ${parts[1]}`;
  // 30字以上は切り捨て
  if (s.length > 30) s = s.slice(0, 30);
  return s.trim();
}

export function buildZozoSearchUrl({ keyword, category, color }: ZozoSearchParams): string {
  const tokens: string[] = [];
  const cleanedKeyword = toZozoKeyword(keyword);
  if (cleanedKeyword) tokens.push(cleanedKeyword);
  if (category) {
    const jp = CATEGORY_KEYWORD_JP[category];
    if (jp && !tokens.some((t) => t.includes(jp))) tokens.push(jp);
  }
  if (color && !tokens.some((t) => t.includes(color))) tokens.push(color);

  const finalKeyword = tokens.filter(Boolean).join(" ");

  if (!finalKeyword) return ZOZO_SEARCH_BASE;

  const url = new URL(ZOZO_SEARCH_BASE);
  url.searchParams.set("p_keyv", finalKeyword);

  // TODO: ValueCommerce 提携承認後は VC のクリック計測URL（https://ck.jp.ap.valuecommerce.com/...）でラップする方式に置換する。
  // 現状はプレースホルダとして "vt" パラメータでアフィリエイトIDを付与する。
  const affiliateId = process.env.NEXT_PUBLIC_ZOZO_AFFILIATE_ID;
  if (affiliateId) {
    url.searchParams.set("vt", affiliateId);
  }

  return url.toString();
}
