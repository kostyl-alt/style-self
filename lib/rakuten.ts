const RAKUTEN_API_BASE    = "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601";
const RAKUTEN_RANKING_BASE = "https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601";

const RAKUTEN_HEADERS = {
  "Referer": process.env.NEXT_PUBLIC_APP_URL || "https://style-self.vercel.app",
  "Origin":  process.env.NEXT_PUBLIC_APP_URL || "https://style-self.vercel.app",
};

// ---- 楽天ファッション ジャンルID ----
export const RAKUTEN_GENRE = {
  ladiesFashion: "100371",
  mensFashion:   "100433",
  shoes:         "100006",
  bags:          "558929",
  accessories:   "100533",
} as const;

// ---- 楽天APIレスポンスの型 ----
interface RakutenImageUrl {
  imageUrl: string;
}

interface RakutenItem {
  itemName:        string;
  itemCode:        string;
  itemPrice:       number;
  itemUrl:         string;
  affiliateUrl:    string;
  catchcopy:       string;
  itemCaption:     string;
  shopName:        string;
  mediumImageUrls: RakutenImageUrl[];
  smallImageUrls:  RakutenImageUrl[];
  availability:    number;
  genreId:         string;
}

interface RakutenSearchResponse {
  count:     number;
  page:      number;
  pageCount: number;
  hits:      number;
  Items:     { Item: RakutenItem }[];
}

// ---- アプリ内で扱う商品データ型 ----
export interface RakutenProduct {
  source:       "rakuten";
  externalId:   string;
  name:         string;
  shopName:     string;
  price:        number;
  productUrl:   string;
  affiliateUrl: string;
  imageUrl:     string | null;
  isAvailable:  boolean;
  rawCaption:   string;
}

// ---- 検索オプション ----
export interface RakutenSearchOptions {
  hits?:    number;   // 取得件数 1〜30（デフォルト: 20）
  page?:    number;   // ページ番号（デフォルト: 1）
  genreId?: string;   // ジャンルID（未指定で全ジャンル）
  sort?:    "-reviewCount" | "-itemPrice" | "+itemPrice" | "standard";
}

// ---- API呼び出し共通 ----
async function fetchRakuten(params: Record<string, string>): Promise<RakutenSearchResponse> {
  const appId = process.env.RAKUTEN_ACCESS_KEY ?? process.env.RAKUTEN_APP_ID;
  if (!appId) throw new Error("RAKUTEN_ACCESS_KEY または RAKUTEN_APP_ID が設定されていません");

  const affiliateId = process.env.RAKUTEN_AFFILIATE_ID ?? "";

  const query = new URLSearchParams({
    applicationId: appId,
    accessKey:     appId,        // 新API（openapi.rakuten.co.jp/ichibams/...）は accessKey を必須
    affiliateId,
    format:        "json",
    formatVersion: "2",
    hits:          params.hits ?? "20",
    page:          params.page ?? "1",
    sort:          params.sort ?? "standard",
    ...params,
  });

  const url = `${RAKUTEN_API_BASE}?${query.toString()}`;
  const res = await fetch(url, { next: { revalidate: 3600 }, headers: RAKUTEN_HEADERS });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`楽天API エラー: ${res.status} ${text}`);
  }

  // 新API（openapi.rakuten.co.jp/ichibams/...）は Items がフラット配列、
  // 旧API（app.rakuten.co.jp/...）は { Item: ... } ネスト。両方を吸収する。
  const data = await res.json() as Partial<RakutenSearchResponse> & {
    Items?: (RakutenItem | { Item: RakutenItem })[];
  };
  const items = (data.Items ?? []).map((i) =>
    "Item" in i ? (i as { Item: RakutenItem }) : { Item: i as RakutenItem },
  );
  return { ...data, Items: items } as RakutenSearchResponse;
}

// ---- レスポンス → RakutenProduct 変換 ----
function toRakutenProduct(item: RakutenItem): RakutenProduct {
  const image =
    item.mediumImageUrls?.[0]?.imageUrl ??
    item.smallImageUrls?.[0]?.imageUrl ??
    null;

  return {
    source:       "rakuten",
    externalId:   item.itemCode,
    name:         item.itemName,
    shopName:     item.shopName,
    price:        item.itemPrice,
    productUrl:   item.itemUrl,
    affiliateUrl: item.affiliateUrl || item.itemUrl,
    imageUrl:     image,
    isAvailable:  item.availability === 1,
    rawCaption:   [item.catchcopy, item.itemCaption].filter(Boolean).join(" ").slice(0, 500),
  };
}

// ---- ランキング取得 ----
export async function getRanking(
  genreId: string,
  hits: number = 30
): Promise<RakutenProduct[]> {
  const appId = process.env.RAKUTEN_ACCESS_KEY ?? process.env.RAKUTEN_APP_ID;
  if (!appId) throw new Error("RAKUTEN_ACCESS_KEY または RAKUTEN_APP_ID が設定されていません");

  const affiliateId = process.env.RAKUTEN_AFFILIATE_ID ?? "";

  const query = new URLSearchParams({
    applicationId: appId,
    accessKey:     appId,
    affiliateId,
    format:        "json",
    formatVersion: "2",
    genreId,
    hits:          String(Math.min(hits, 30)),
  });

  const url = `${RAKUTEN_RANKING_BASE}?${query.toString()}`;
  const res = await fetch(url, { cache: "no-store", headers: RAKUTEN_HEADERS });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`楽天ランキングAPI エラー: ${res.status} ${text}`);
  }

  // 新API(openapi.rakuten.co.jp)は Items がフラット配列（旧APIは { Item: ... } ネスト）
  const data = await res.json() as { Items?: (RakutenItem | { Item: RakutenItem })[] };
  return (data.Items ?? []).map((i) => {
    const item = "Item" in i ? i.Item : i as RakutenItem;
    return toRakutenProduct(item);
  });
}

// ---- ブランド名で検索 ----
export async function searchByBrand(
  brand: string,
  options: RakutenSearchOptions = {}
): Promise<RakutenProduct[]> {
  const data = await fetchRakuten({
    keyword: brand,
    hits:    String(options.hits ?? 20),
    page:    String(options.page ?? 1),
    sort:    options.sort ?? "standard",
    ...(options.genreId ? { genreId: options.genreId } : {}),
  });

  return data.Items.map((i) => toRakutenProduct(i.Item));
}

// ---- キーワード＋ジャンルで検索 ----
export async function searchByKeyword(
  keyword: string,
  options: RakutenSearchOptions = {}
): Promise<RakutenProduct[]> {
  const data = await fetchRakuten({
    keyword,
    hits:    String(options.hits ?? 20),
    page:    String(options.page ?? 1),
    sort:    options.sort ?? "standard",
    ...(options.genreId ? { genreId: options.genreId } : {}),
  });

  return data.Items.map((i) => toRakutenProduct(i.Item));
}

// ---- ブランド＋カテゴリで絞り込み検索 ----
export async function searchForPairing(
  brand: string | null,
  categoryKeyword: string,
  options: RakutenSearchOptions = {}
): Promise<RakutenProduct[]> {
  const keyword = [brand, categoryKeyword].filter(Boolean).join(" ");

  const data = await fetchRakuten({
    keyword,
    hits:    String(options.hits ?? 15),
    page:    String(options.page ?? 1),
    sort:    options.sort ?? "-reviewCount",
    ...(options.genreId ? { genreId: options.genreId } : {}),
  });

  return data.Items.map((i) => toRakutenProduct(i.Item));
}
