// Shift_JIS (CP932) パーセントエンコード（ZOZOTOWN の検索パラメータ p_keyv 用）。
//
// ⚠️ なぜ必要か: ZOZO の検索は p_keyv を Shift_JIS として解釈する（実ブラウザで確定）。UTF-8 でも
//   EUC-JP でも遷移先の検索窓で日本語が文字化けし「該当する商品が見つかりません」になる。
//   メルカリ/Pinterest は UTF-8 で正しく動くので、この変換は ZOZO 専用。
//
// 依存追加なしで実装: ブラウザ標準の TextDecoder("shift_jis")（WHATWG Encoding・全モダンブラウザ対応）で
//   2 バイト面と半角カナ（1 バイト）を 1 度だけ逆引きし「文字→バイト列」マップを作る（lazy・初回のみ）。
//   未収録文字は UTF-8 にフォールバック（graceful・壊さない）。

let reverseMap: Map<string, number[]> | null = null;

function buildReverseMap(): Map<string, number[]> {
  const map = new Map<string, number[]>();
  // 2 バイト面（lead 0x81-0x9F, 0xE0-0xFC / trail 0x40-0xFC・0x7F は除外）。
  for (let hi = 0x81; hi <= 0xfc; hi++) {
    if (hi >= 0xa0 && hi <= 0xdf) continue;  // この帯は 1 バイト半角カナ
    for (let lo = 0x40; lo <= 0xfc; lo++) {
      if (lo === 0x7f) continue;
      try {
        const ch = new TextDecoder("shift_jis", { fatal: true }).decode(new Uint8Array([hi, lo]));
        if (ch.length === 1 && !map.has(ch)) map.set(ch, [hi, lo]);
      } catch { /* 未割当の組合せは無視 */ }
    }
  }
  // 半角カナ（1 バイト 0xA1-0xDF）。
  for (let b = 0xa1; b <= 0xdf; b++) {
    try {
      const ch = new TextDecoder("shift_jis", { fatal: true }).decode(new Uint8Array([b]));
      if (ch.length === 1 && !map.has(ch)) map.set(ch, [b]);
    } catch { /* noop */ }
  }
  return map;
}

function pct(bytes: number[]): string {
  return bytes.map((b) => `%${b.toString(16).toUpperCase().padStart(2, "0")}`).join("");
}

// 文字列を Shift_JIS パーセントエンコードする。ASCII は通常の encodeURIComponent、
// Shift_JIS に存在しない文字は UTF-8 にフォールバック（壊さない）。
export function sjisPercentEncode(input: string): string {
  if (!reverseMap) reverseMap = buildReverseMap();
  let out = "";
  for (const ch of input) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x80) {
      out += encodeURIComponent(ch);  // 半角スペースは %20 等・ASCII はそのまま安全に
      continue;
    }
    const bytes = reverseMap.get(ch);
    out += bytes ? pct(bytes) : encodeURIComponent(ch);  // 未収録は UTF-8 フォールバック
  }
  return out;
}
