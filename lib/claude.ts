import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MODEL = "claude-sonnet-4-6";

export interface ClaudeRequestOptions {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
}

export async function callClaude({
  systemPrompt,
  userMessage,
  maxTokens = 2048,
}: ClaudeRequestOptions): Promise<string> {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
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
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`JSON parse failed: ${msg}`);
  }
}
