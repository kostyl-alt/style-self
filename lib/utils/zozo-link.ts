// ZOZOTOWN search URL builder (Sprint 35 / Phase 1)
//
// Phase 1: シンプルなキーワード検索URLを生成する。
// アフィリエイトIDは NEXT_PUBLIC_ZOZO_AFFILIATE_ID から読む。
// ValueCommerce 提携承認後は本ファイルの実装のみを VC のクリック計測URLに差し替える。
//
// 注意: ZOZOTOWN の検索パラメータ p_keyv は Shift-JIS percent-encoding を要求する。
// UTF-8 percent-encoding (encodeURIComponent) を渡すと結果ページで日本語が文字化けする
// （「白シャツ」→「逋ｽ繧ｷ繝｣繝」のように UTF-8 バイトが Shift-JIS として解釈される）。
// そのため encoding-japanese で Shift-JIS バイト列を生成してからパーセントエンコードする。

import Encoding from "encoding-japanese";

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

// Unicode 文字列を Shift-JIS バイト列に変換し、各バイトをパーセントエンコードする。
function shiftJisPercentEncode(s: string): string {
  const unicodeArray = Encoding.stringToCode(s);
  const sjisBytes = Encoding.convert(unicodeArray, { to: "SJIS", from: "UNICODE" });
  return Array.from(sjisBytes)
    .map((b) => "%" + b.toString(16).padStart(2, "0").toUpperCase())
    .join("");
}

export function buildZozoSearchUrl(params: ZozoSearchParams): string {
  const keyword = toZozoKeyword(params.keyword);
  if (!keyword) return "https://zozo.jp/search/";

  const encoded = shiftJisPercentEncode(keyword);
  const base = `https://zozo.jp/search/?p_keyv=${encoded}`;

  // TODO: ValueCommerce 提携承認後は VC のクリック計測URL（https://ck.jp.ap.valuecommerce.com/...）でラップする方式に置換する。
  // 現状はプレースホルダとして "vt" パラメータでアフィリエイトIDを付与する。
  const affiliateId = process.env.NEXT_PUBLIC_ZOZO_AFFILIATE_ID;
  return affiliateId ? `${base}&vt=${affiliateId}` : base;
}
