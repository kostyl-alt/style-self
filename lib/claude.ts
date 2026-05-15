import Anthropic from "@anthropic-ai/sdk";
import { writeFile } from "fs/promises";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MODEL = "claude-sonnet-4-6";

// JSON parse 失敗時に Claude の生レスポンスを /tmp に退避する。
// 書き込み自体が失敗しても元のパースエラーは握りつぶさずに上に投げ直すため、
// この関数は throw しない(内側で try/catch して飲み込む)。
async function saveRawResponseToTmp(text: string): Promise<void> {
  const path = `/tmp/claude-error-${Date.now()}.txt`;
  try {
    await writeFile(path, text);
    console.error(`[claude] parse failed, raw response saved to ${path}`);
  } catch {
    // 書き込みエラーは無視（元のパースエラー情報を優先）
  }
}

export interface ClaudeRequestOptions {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  // analyze-v2 (アプローチ2) で再現性をある程度確保するため optional で追加。
  // 既存呼び出しは未指定 = SDK デフォルトで挙動不変。
  temperature?: number;
}

export async function callClaude({
  systemPrompt,
  userMessage,
  maxTokens = 2048,
  temperature,
}: ClaudeRequestOptions): Promise<string> {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    ...(typeof temperature === "number" ? { temperature } : {}),
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude API");
  }

  return content.text;
}

export async function callClaudeJSON<T>(
  options: ClaudeRequestOptions
): Promise<T> {
  const text = await callClaude(options);

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Claude response does not contain valid JSON. Response length: ${text.length}`);
  }

  const jsonStr = text.slice(start, end + 1);

  try {
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    await saveRawResponseToTmp(text);
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`JSON parse failed (response length: ${text.length}, json length: ${jsonStr.length}): ${msg}`);
  }
}

export type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export async function callClaudeWithImage<T>(
  systemPrompt: string,
  base64: string,
  mediaType: ImageMediaType,
  userMessage = "この画像のアイテムを解析してください。",
  maxTokens = 1024,
): Promise<T> {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64 },
        },
        {
          type: "text",
          text: userMessage,
        },
      ],
    }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude API");
  }

  const text = content.text;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Claude response does not contain valid JSON. Response length: ${text.length}`);
  }

  const jsonStr = text.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    await saveRawResponseToTmp(text);
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`JSON parse failed (response length: ${text.length}, json length: ${jsonStr.length}): ${msg}`);
  }
}
