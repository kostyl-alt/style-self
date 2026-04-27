// ZOZOTOWN search URL builder (Sprint 35 / Phase 1)
//
// Phase 1: シンプルなキーワード検索URLを生成する。
// アフィリエイトIDは NEXT_PUBLIC_ZOZO_AFFILIATE_ID から読む。
// ValueCommerce 提携承認後は本ファイルの実装のみを VC のクリック計測URLに差し替える。

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

export function buildZozoSearchUrl(params: ZozoSearchParams): string {
  const keyword = toZozoKeyword(params.keyword);
  if (!keyword) return "https://zozo.jp/search/";

  // encodeURIComponent で UTF-8 パーセントエンコード（スペースは %20）
  const encoded = encodeURIComponent(keyword);
  const base = `https://zozo.jp/search/?p_keyv=${encoded}`;

  // TODO: ValueCommerce 提携承認後は VC のクリック計測URL（https://ck.jp.ap.valuecommerce.com/...）でラップする方式に置換する。
  // 現状はプレースホルダとして "vt" パラメータでアフィリエイトIDを付与する。
  const affiliateId = process.env.NEXT_PUBLIC_ZOZO_AFFILIATE_ID;
  return affiliateId ? `${base}&vt=${affiliateId}` : base;
}
