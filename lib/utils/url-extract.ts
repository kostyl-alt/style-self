// Sprint 38: URL→本文抽出ユーティリティ
//
// シンプルなHTML strip 戦略（依存追加なし）。
// SPA や認証必須ページ、Cloudflare 等でブロックされるサイトは取得不能。
// 失敗時はユーザーに「メモにコピペしてください」と案内する方針。

const FETCH_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_CHARS = 8000;
const USER_AGENT = "Mozilla/5.0 (compatible; StyleSelfBot/1.0; +https://style-self.vercel.app)";

export async function extractTextFromUrl(url: string, maxChars = DEFAULT_MAX_CHARS): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
        "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
      },
      signal: controller.signal,
      redirect: "follow",
    });
  } catch (err) {
    clearTimeout(timeout);
    const reason = err instanceof Error ? err.message : "unknown";
    throw new Error(`URL fetch failed: ${reason}`);
  }
  clearTimeout(timeout);

  if (!res.ok) {
    throw new Error(`URL fetch failed: HTTP ${res.status}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("html") && !contentType.includes("text")) {
    throw new Error(`URL is not HTML (content-type: ${contentType})`);
  }

  const html = await res.text();

  // ノイズ除去
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length > maxChars) text = text.slice(0, maxChars);
  if (text.length < 100) {
    throw new Error("抽出された本文が短すぎます（おそらくJSレンダリング必須のサイト）");
  }
  return text;
}
