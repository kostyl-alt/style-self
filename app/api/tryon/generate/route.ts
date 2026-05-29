// C-2a: 着用イメージ本番生成 route。
//
// 設計: docs/STYLE-SELF_D1_着用イメージ_リアル試着_ビジュアル対話_設計調査.md(ac33f90) C-Phase1
//   C-2 設計合意の判断 1=A(/ai ボタン)/ 2=Z(仮画像)/ 3=Claude Haiku 動的 / 4=判断 3 統合 / 5=II(C-2b で本格)
//
// 役割:
//   POST { coordinateText, moodboardId? } を受け、
//   ① MB データ取得(moodboardId 指定時のみ・RLS で本人 or 公開のみ)
//   ② body_profile 取得(本人のみ)
//   ③ buildTryonPrompt で英語 FASHN prompt 生成(Claude Haiku 1 回)
//   ④ FASHN /v1/run product-to-model 投入(仮の服画像 URL)
//   ⑤ /v1/status ポーリング(120 秒タイムアウト)
//   ⑥ レスポンス: { ok, predictionId, imageUrl, generatedPrompt, elapsedMs }
//
// セキュリティ / プライバシー(本体 6 章 ③ 専章整合):
//   ・FASHN_API_KEY / ANTHROPIC_API_KEY は ★ サーバー側 process.env のみ(クライアント露出なし)
//   ・認証必須(createSupabaseServerClient.auth.getUser・未認証 401)
//   ・ログには status code とエラー文のみ(API key 値 / 画像 URL / Claude 生成 prompt 内容は出さない)
//   ・MVP は ★ 顔写真ゼロ・ユーザー写真ゼロ(product-to-model = 服画像のみ入力)
//   ・FASHN 規約: 24h 自動削除 + 訓練利用なし(ac33f90 §7.2 オーナー確認済)
//
// コスト(1 件): FASHN $0.075 + Claude Haiku ≈ ¥0.5 = 約 ¥12 / 件。
//                月 5 件 / user = ¥60 / 月。
// TODO(C-2c): Sprint B-3 案 P1(月 N 回上限)を導入。本 route は ★ 未実装。

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { buildTryonPrompt, type TryonMoodboardInput } from "@/lib/prompts/tryon-prompt";
import type { BodyProfile } from "@/types/index";

export const dynamic     = "force-dynamic";
// FASHN 公式 docs: 処理時間 20-120 秒(モデル + 混雑度に依存)。
// Vercel hobby 10/60 秒上限・Pro 300 秒対応・ローカル npm run dev は制約ゆるい。
export const maxDuration = 120;

const FASHN_BASE        = "https://api.fashn.ai/v1";
const POLL_INTERVAL_MS  = 2000;
const POLL_MAX_ATTEMPTS = 60;  // = 120 秒タイムアウト

// MVP 仮画像(C-2c でクローゼットマッチング・C-3 で楽天マッチングに置換予定)。
// 公開 Unsplash の平置きアイテム URL(FASHN サーバーが GET 取得可)。
const PLACEHOLDER_PRODUCT_IMAGE = "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=512";

interface GenerateRequest {
  coordinateText?: unknown;
  moodboardId?:    unknown;
}

interface GenerateSuccess {
  ok:               true;
  predictionId:     string;
  imageUrl:         string;
  generatedPrompt:  string;  // ★ オーナー verify 用(世界観反映を確認するため)
  elapsedMs:        number;
}

interface GenerateError {
  ok:            false;
  predictionId?: string;
  error:         string;
}

type GenerateResponse = GenerateSuccess | GenerateError;

export async function POST(req: NextRequest): Promise<NextResponse<GenerateResponse>> {
  // 1) 認証
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json<GenerateError>({ ok: false, error: "auth required" }, { status: 401 });
  }

  // 2) API key
  const apiKey = process.env.FASHN_API_KEY;
  if (!apiKey) {
    return NextResponse.json<GenerateError>(
      { ok: false, error: "FASHN_API_KEY not configured on server" },
      { status: 500 },
    );
  }

  // 3) body 解析
  let body: GenerateRequest;
  try { body = (await req.json()) as GenerateRequest; }
  catch {
    return NextResponse.json<GenerateError>({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }
  const coordinateText =
    typeof body.coordinateText === "string" && body.coordinateText.trim() !== ""
      ? body.coordinateText.trim()
      : "";
  if (coordinateText === "") {
    return NextResponse.json<GenerateError>({ ok: false, error: "coordinateText required" }, { status: 400 });
  }
  const moodboardId =
    typeof body.moodboardId === "string" && body.moodboardId.trim() !== ""
      ? body.moodboardId.trim()
      : null;

  // 4) MB 取得(任意・RLS で本人 or 公開のみ)
  let moodboard: TryonMoodboardInput | undefined;
  if (moodboardId) {
    const { data: mb } = await supabase
      .from("moodboards")
      .select("name, description, worldview_name")
      .eq("id", moodboardId)
      .maybeSingle() as unknown as {
        data: { name: string; description: string | null; worldview_name: string | null } | null;
      };
    if (mb) {
      moodboard = {
        name:          mb.name,
        description:   mb.description,
        worldviewName: mb.worldview_name,
      };
    }
    // MB 不在 / RLS で隠匿 → moodboard undefined で続行(direct coordinate と同じ扱い)
  }

  // 5) body_profile 取得(本人のみ・既存 RLS)
  const { data: userRow } = await supabase
    .from("users")
    .select("body_profile")
    .eq("id", user.id)
    .maybeSingle() as unknown as { data: { body_profile: BodyProfile | null } | null };
  const bodyProfile = userRow?.body_profile ?? undefined;

  // 6) Claude Haiku で英語 prompt 生成
  let generatedPrompt: string;
  try {
    generatedPrompt = await buildTryonPrompt({
      coordinateText,
      moodboard,
      bodyProfile,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[tryon/generate] prompt build failed");
    return NextResponse.json<GenerateError>(
      { ok: false, error: `prompt build: ${msg}` },
      { status: 500 },
    );
  }
  if (generatedPrompt === "") {
    return NextResponse.json<GenerateError>(
      { ok: false, error: "Claude returned empty prompt" },
      { status: 500 },
    );
  }

  const startedAt = Date.now();

  // 7) FASHN /v1/run
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
        inputs: {
          product_image: PLACEHOLDER_PRODUCT_IMAGE,
          prompt:        generatedPrompt,
          output_format: "png",
        },
      }),
    });
    if (!runRes.ok) {
      const text = await runRes.text();
      console.warn(`[tryon/generate] FASHN /run ${runRes.status}`);
      return NextResponse.json<GenerateError>(
        { ok: false, error: `FASHN /run ${runRes.status}: ${text.slice(0, 200)}` },
        { status: runRes.status === 401 || runRes.status === 402 ? runRes.status : 500 },
      );
    }
    const runJson = (await runRes.json()) as {
      id?:    string;
      error?: string | { name?: string; message?: string } | null;
    };
    if (!runJson.id) {
      const runErrMsg =
        typeof runJson.error === "string"
          ? runJson.error
          : runJson.error?.message ?? "FASHN /run response missing id";
      return NextResponse.json<GenerateError>(
        { ok: false, error: runErrMsg },
        { status: 500 },
      );
    }
    predictionId = runJson.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[tryon/generate] FASHN /run network error");
    return NextResponse.json<GenerateError>(
      { ok: false, error: `FASHN /run network: ${msg}` },
      { status: 500 },
    );
  }

  // 8) Status ポーリング
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    try {
      const statusRes = await fetch(`${FASHN_BASE}/status/${predictionId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!statusRes.ok) {
        const text = await statusRes.text();
        console.warn(`[tryon/generate] FASHN /status ${statusRes.status}`);
        return NextResponse.json<GenerateError>(
          { ok: false, predictionId, error: `FASHN /status ${statusRes.status}: ${text.slice(0, 200)}` },
          { status: 500 },
        );
      }
      const statusJson = (await statusRes.json()) as {
        status?: string;
        output?: string[];
        error?:  string | { name?: string; message?: string } | null;
      };

      if (statusJson.status === "completed") {
        const imageUrl = statusJson.output?.[0];
        if (typeof imageUrl !== "string" || imageUrl === "") {
          return NextResponse.json<GenerateError>(
            { ok: false, predictionId, error: "completed but no output URL" },
            { status: 500 },
          );
        }
        return NextResponse.json<GenerateSuccess>({
          ok:              true,
          predictionId,
          imageUrl,
          generatedPrompt,
          elapsedMs:       Date.now() - startedAt,
        });
      }
      if (statusJson.status === "failed" || statusJson.status === "canceled") {
        const errMsg =
          typeof statusJson.error === "string"
            ? statusJson.error
            : statusJson.error?.message ?? statusJson.status ?? "unknown";
        return NextResponse.json<GenerateError>(
          { ok: false, predictionId, error: errMsg },
          { status: 500 },
        );
      }
      // starting / in_queue / processing → continue
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json<GenerateError>(
        { ok: false, predictionId, error: `FASHN /status network: ${msg}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json<GenerateError>(
    { ok: false, predictionId, error: `polling timeout after ${POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS / 1000}s` },
    { status: 504 },
  );
}
