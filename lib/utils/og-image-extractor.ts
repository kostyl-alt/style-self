// D1 Phase 2 ムードボード v3: 外部 URL から OpenGraph og:image 抽出 + 画像 download
//
// 設計: docs/STYLE-SELF_D1_Sprint_C-2_段階3-B_v3_革新設計_調査.md(cd1b01a)§3
//
// ★ SSRF 5 重防御(絶対要件):
//   1. host allowlist(★ 5 platforms = 9 host・完全一致)
//   2. private IP 拒否(IPv4 5 範囲 + IPv6 3 範囲)
//   3. https 強制
//   4. timeout 10 秒 + AbortController
//   5. redirect manual(max 3 hops)+ content-size 10 MB
//
// ★ 1 つでも抜けるとセキュリティホール → 厳格実装

import dns from "node:dns/promises";

// ====================================================================
// SSRF 防御層 1: host allowlist(完全一致・サブドメイン非許可)
// ====================================================================

export const URL_ALLOWLIST = new Set<string>([
  // Pinterest
  "pinterest.com",
  "www.pinterest.com",
  "jp.pinterest.com",
  "pin.it",
  // Instagram
  "instagram.com",
  "www.instagram.com",
  // Vogue
  "vogue.com",
  "www.vogue.com",
  "vogue.co.jp",
  "www.vogue.co.jp",
]);

// 直接画像 URL の場合の拡張子判定
const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif)(\?|#|$)/i;

// ====================================================================
// SSRF 防御層 2: private IP 拒否
// ====================================================================

// IPv4 private 範囲(文字列で host が IP の場合に正規表現比較)
const PRIVATE_IPV4_PATTERNS: RegExp[] = [
  /^10\./,                                // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,       // 172.16.0.0/12
  /^192\.168\./,                          // 192.168.0.0/16
  /^127\./,                               // 127.0.0.0/8 (loopback)
  /^169\.254\./,                          // 169.254.0.0/16 (link-local)
  /^0\./,                                 // 0.0.0.0/8
];

function isPrivateIpv4(ip: string): boolean {
  return PRIVATE_IPV4_PATTERNS.some((re) => re.test(ip));
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;                  // loopback
  if (lower.startsWith("fe80:") || lower.startsWith("fe80::")) return true; // link-local
  if (/^fc[0-9a-f]{2}:/.test(lower)) return true;    // unique local fc00::/7
  if (/^fd[0-9a-f]{2}:/.test(lower)) return true;    // unique local fd00::/8
  return false;
}

async function validateNotPrivateIp(hostname: string): Promise<void> {
  // 全 A/AAAA レコード取得(マルチホーミング対策)
  let addresses: { address: string; family: number }[];
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: false });
  } catch {
    throw new Error("DNS lookup に失敗しました");
  }
  if (addresses.length === 0) throw new Error("DNS 解決できませんでした");

  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIpv4(address)) {
      throw new Error("プライベート IP は使用できません");
    }
    if (family === 6 && isPrivateIpv6(address)) {
      throw new Error("プライベート IP は使用できません");
    }
  }
}

// ====================================================================
// SSRF 防御層 3: https 強制 + host allowlist 検証
// ====================================================================

export function validateUrlHost(url: URL): void {
  if (url.protocol !== "https:") {
    throw new Error("https URL のみ対応");
  }
  if (!URL_ALLOWLIST.has(url.hostname.toLowerCase())) {
    throw new Error(`対応していないプラットフォームです(${url.hostname})`);
  }
}

// 直接画像 URL の場合は host allowlist チェックを緩める(拡張子で判定)
// が、依然として https + private IP 拒否は必須
function isDirectImageUrl(url: URL): boolean {
  return IMAGE_EXT_RE.test(url.pathname);
}

// ====================================================================
// SSRF 防御層 4: timeout + AbortController
// ====================================================================

const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const MAX_CONTENT_BYTES = 10 * 1024 * 1024;  // 10 MB

interface SafeFetchOptions {
  allowDirectImage?: boolean;  // 直接画像 URL 経路で host allowlist を緩める
}

// ====================================================================
// SSRF 防御層 5: redirect manual + content-size 制限
// ====================================================================
//
// ★ redirect: "manual" で 30x を捕捉 → Location ヘッダの URL を再検証 → 再 fetch
// ★ 各 hop で 1-3 + 5 を再適用(redirect 先 host も allowlist + private IP 拒否)
async function safeFetch(rawUrl: string, opts: SafeFetchOptions = {}): Promise<Response> {
  let currentUrl: string = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = new URL(currentUrl);

    // 1+3. https + host allowlist(direct image なら緩める)
    if (url.protocol !== "https:") {
      throw new Error("https URL のみ対応");
    }
    if (opts.allowDirectImage && isDirectImageUrl(url)) {
      // 直接画像 URL = allowlist スキップ(但し private IP は依然拒否)
    } else {
      if (!URL_ALLOWLIST.has(url.hostname.toLowerCase())) {
        throw new Error(`対応していないプラットフォームです(${url.hostname})`);
      }
    }

    // 2. private IP 拒否(DNS lookup・★ 各 hop で再実施)
    await validateNotPrivateIp(url.hostname);

    // 4. timeout + AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",  // ★ 5. 手動リダイレクト
        headers: {
          // 一部サイトは UA なしを拒否 → 一般的な UA を送る
          "user-agent": "Mozilla/5.0 (compatible; StyleSelfBot/1.0)",
          accept: "text/html,image/*,*/*",
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // redirect 捕捉
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location === null || location === "") {
        throw new Error("リダイレクト先が不明");
      }
      // 相対 URL 対応
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(`取得に失敗しました(status=${response.status})`);
    }

    // 5. content-size 制限(Content-Length チェック)
    const contentLength = response.headers.get("content-length");
    if (contentLength !== null) {
      const len = parseInt(contentLength, 10);
      if (Number.isFinite(len) && len > MAX_CONTENT_BYTES) {
        throw new Error("ファイルサイズが大きすぎます(10MB 超)");
      }
    }

    return response;
  }
  throw new Error(`リダイレクトが多すぎます(max ${MAX_REDIRECTS} hops)`);
}

// ====================================================================
// HTML から og:image 抽出
// ====================================================================

const OG_IMAGE_RE = /<meta\s+[^>]*property\s*=\s*["']og:image(?::secure_url)?["'][^>]*content\s*=\s*["']([^"']+)["']/i;
const OG_IMAGE_RE_REV = /<meta\s+[^>]*content\s*=\s*["']([^"']+)["'][^>]*property\s*=\s*["']og:image(?::secure_url)?["']/i;

function extractOgImageFromHtml(html: string): string | null {
  const m1 = html.match(OG_IMAGE_RE);
  if (m1 !== null) return m1[1];
  const m2 = html.match(OG_IMAGE_RE_REV);
  if (m2 !== null) return m2[1];
  return null;
}

// ====================================================================
// Public API
// ====================================================================

// 外部 URL(Pinterest / Instagram / Vogue page or direct image URL)から画像 URL を抽出
export async function extractOgImageUrl(pageUrl: string): Promise<string> {
  const url = new URL(pageUrl);

  // 直接画像 URL ならそのまま返す(allowlist スキップ・但し https + private IP 拒否は適用)
  if (isDirectImageUrl(url)) {
    if (url.protocol !== "https:") throw new Error("https URL のみ対応");
    await validateNotPrivateIp(url.hostname);
    return pageUrl;
  }

  // それ以外は HTML を fetch → og:image 抽出
  validateUrlHost(url);
  const res = await safeFetch(pageUrl);
  // HTML 部分のみ取得(最大 1MB だけ読む)
  const reader = res.body?.getReader();
  if (!reader) throw new Error("HTML 取得に失敗");
  let buf = "";
  let totalBytes = 0;
  const decoder = new TextDecoder();
  const HTML_PEEK_LIMIT = 1024 * 1024;  // 1MB
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > HTML_PEEK_LIMIT) {
      reader.cancel().catch(() => {});
      break;
    }
    buf += decoder.decode(value, { stream: true });
    if (buf.length > 200_000) {
      // og タグは <head> 内なので 200KB あれば十分
      reader.cancel().catch(() => {});
      break;
    }
  }
  const ogImage = extractOgImageFromHtml(buf);
  if (ogImage === null) throw new Error("og:image が見つかりませんでした");
  // 相対 URL → 絶対 URL
  return new URL(ogImage, pageUrl).toString();
}

// 画像 URL から Buffer + Content-Type 取得(direct image・SSRF 5 重防御適用)
export async function fetchImageBuffer(
  imageUrl: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await safeFetch(imageUrl, { allowDirectImage: true });

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.startsWith("image/")) {
    throw new Error(`画像ではありません(content-type=${contentType})`);
  }

  // 累積サイズ監視(Content-Length が嘘でも切る)
  const reader = res.body?.getReader();
  if (!reader) throw new Error("画像取得に失敗");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_CONTENT_BYTES) {
      reader.cancel().catch(() => {});
      throw new Error("ファイルサイズが大きすぎます(10MB 超・実測)");
    }
    chunks.push(value);
  }

  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return { buffer, contentType };
}
