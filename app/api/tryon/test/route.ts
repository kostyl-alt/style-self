// C-1 第一歩: FASHN.ai 接続テスト route(★ 最小)。
//
// 設計: docs/STYLE-SELF_D1_着用イメージ_リアル試着_ビジュアル対話_設計調査.md(ac33f90) C-Phase1
//
// 役割: ★ ★ POST で FASHN /v1/run を product-to-model で叩き、
//       予測 id で /v1/status をポーリングし、完成画像 URL を返すだけ。
//       UI / アバター / マッチング / 対話修正 は別工程(C-2 以降)。
//
// セキュリティ:
//   ・FASHN_API_KEY は ★ サーバー側 process.env のみ(クライアントに露出させない)
//   ・認証必須(createSupabaseServerClient で auth.getUser・未認証は 401)
//   ・ログには ★ API key value / 画像 URL を出さない(status code とエラー文のみ)
//
// プライバシー(本体 6 章 ③ 専章整合):
//   ・MVP C-Phase1 は ★ 顔写真ゼロ・ユーザー写真ゼロ(product-to-model = 服画像のみ入力)
//   ・FASHN 規約: 24h 自動削除 + 訓練利用なし(オーナー確認済・ac33f90 §7.2)

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic     = "force-dynamic";
// FASHN 生成 5-17 秒 + ポーリング余裕(Vercel hobby max 60 秒)
export const maxDuration = 60;

const FASHN_BASE         = "https://api.fashn.ai/v1";
const POLL_INTERVAL_MS   = 2000;
const POLL_MAX_ATTEMPTS  = 20;   // = 40 秒タイムアウト

// 既定のテスト用 product image(★ 平置きアイテムの公開 URL)。
// オーナーが productImage を渡せばそれを優先。
const DEFAULT_PRODUCT_IMAGE = "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=512";
const DEFAULT_PROMPT        = "professional studio, neutral background";

interface TryOnTestBody {
  productImage?: string;
  prompt?:       string;
}

interface TryOnTestSuccess {
  ok:           true;
  predictionId: string;
  imageUrl:     string;
  elapsedMs:    number;
}

interface TryOnTestError {
  ok:            false;
  predictionId?: string;
  error:         string;
}

type TryOnTestResponse = TryOnTestSuccess | TryOnTestError;

export async function POST(req: NextRequest): Promise<NextResponse<TryOnTestResponse>> {
  // 1) 認証(自分用テスト・FASHN クレジット消費するので必須保護)
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json<TryOnTestError>({ ok: false, error: "auth required" }, { status: 401 });
  }

  // 2) API key
  const apiKey = process.env.FASHN_API_KEY;
  if (!apiKey) {
    return NextResponse.json<TryOnTestError>(
      { ok: false, error: "FASHN_API_KEY not configured on server" },
      { status: 500 },
    );
  }

  // 3) body 解析(全フィールド optional・空 body も許容)
  let body: TryOnTestBody = {};
  try { body = (await req.json()) as TryOnTestBody; } catch { /* 空 body OK */ }
  const productImage =
    typeof body.productImage === "string" && body.productImage.trim() !== ""
      ? body.productImage
      : DEFAULT_PRODUCT_IMAGE;
  const prompt =
    typeof body.prompt === "string" && body.prompt.trim() !== ""
      ? body.prompt
      : DEFAULT_PROMPT;

  const startedAt = Date.now();

  // 4) Prediction 投入(POST /v1/run)
  let predictionId: string;
  try {
    const runRes = await fetch(`${FASHN_BASE}/run`, {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_name: "product-to-model",
        inputs: { product_image: productImage, prompt, output_format: "png" },
      }),
    });
    if (!runRes.ok) {
      const text = await runRes.text();
      // ログには status code のみ・本文は短縮して error 文に同梱(値はクライアント返却のみ)
      console.warn(`[tryon/test] FASHN /run ${runRes.status}`);
      return NextResponse.json<TryOnTestError>(
        { ok: false, error: `FASHN /run ${runRes.status}: ${text.slice(0, 200)}` },
        { status: runRes.status === 401 || runRes.status === 402 ? runRes.status : 500 },
      );
    }
    const runJson = (await runRes.json()) as { id?: string };
    if (!runJson.id) {
      return NextResponse.json<TryOnTestError>(
        { ok: false, error: "FASHN /run response missing id" },
        { status: 500 },
      );
    }
    predictionId = runJson.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[tryon/test] FASHN /run network error");
    return NextResponse.json<TryOnTestError>(
      { ok: false, error: `FASHN /run network: ${msg}` },
      { status: 500 },
    );
  }

  // 5) Status ポーリング(GET /v1/status/{id})
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    try {
      const statusRes = await fetch(`${FASHN_BASE}/status/${predictionId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!statusRes.ok) {
        const text = await statusRes.text();
        console.warn(`[tryon/test] FASHN /status ${statusRes.status}`);
        return NextResponse.json<TryOnTestError>(
          { ok: false, predictionId, error: `FASHN /status ${statusRes.status}: ${text.slice(0, 200)}` },
          { status: 500 },
        );
      }
      const statusJson = (await statusRes.json()) as {
        status?: string;
        output?: string[];
        error?:  string | { message?: string };
      };

      if (statusJson.status === "completed") {
        const imageUrl = statusJson.output?.[0];
        if (typeof imageUrl !== "string" || imageUrl === "") {
          return NextResponse.json<TryOnTestError>(
            { ok: false, predictionId, error: "completed but no output URL" },
            { status: 500 },
          );
        }
        return NextResponse.json<TryOnTestSuccess>({
          ok:           true,
          predictionId,
          imageUrl,
          elapsedMs:    Date.now() - startedAt,
        });
      }
      if (statusJson.status === "failed" || statusJson.status === "canceled") {
        const errMsg =
          typeof statusJson.error === "string"
            ? statusJson.error
            : statusJson.error?.message ?? statusJson.status ?? "unknown";
        return NextResponse.json<TryOnTestError>(
          { ok: false, predictionId, error: errMsg },
          { status: 500 },
        );
      }
      // starting / in_queue / processing → continue polling
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json<TryOnTestError>(
        { ok: false, predictionId, error: `FASHN /status network: ${msg}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json<TryOnTestError>(
    { ok: false, predictionId, error: `polling timeout after ${POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS / 1000}s` },
    { status: 504 },
  );
}
