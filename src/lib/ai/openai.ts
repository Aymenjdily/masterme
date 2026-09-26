import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { estimateCostUsd, logAiEvent, type AiUsage } from "@/lib/ai/log";

// Server-only: reads OPENAI_API_KEY. Import from route handlers and scripts only.

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  client = new OpenAI({ apiKey, maxRetries: 2, timeout: 30_000 });
  return client;
}

/** Model for free text (drafts, questions, paths, reviews). */
export function writingModel() {
  const model = process.env.OPENAI_MODEL;
  if (!model) throw new Error("OPENAI_MODEL is not set");
  return model;
}

export function usageOf(
  model: string,
  startedAt: number,
  usage: { prompt_tokens: number; completion_tokens: number } | undefined
): AiUsage {
  const inputTokens = usage?.prompt_tokens ?? null;
  const outputTokens = usage?.completion_tokens ?? null;
  return {
    model,
    latencyMs: performance.now() - startedAt,
    inputTokens,
    outputTokens,
    costUsd: estimateCostUsd(model, inputTokens, outputTokens),
  };
}

type GenerateInput = {
  userId: string;
  feature: string;
  system: string;
  prompt: string;
  /** A short, non-sensitive note kept in the AI log (never the full prompt). */
  summary?: Record<string, string | number | boolean | null>;
};

/** Structured output validated against a zod schema. Logs one AiEvent. */
export async function generateObject<Schema extends z.ZodType>(
  input: GenerateInput & { schema: Schema; name: string }
): Promise<{ data: z.infer<Schema>; eventId: string | null }> {
  const model = writingModel();
  const startedAt = performance.now();
  try {
    const completion = await getOpenAI().chat.completions.parse({
      model,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.prompt },
      ],
      response_format: zodResponseFormat(input.schema, input.name),
    });
    const message = completion.choices[0]?.message;
    if (message?.refusal) throw new Error(`Model refused: ${message.refusal}`);
    if (!message?.parsed) throw new Error("Model returned no structured output");

    const data = input.schema.parse(message.parsed) as z.infer<Schema>;
    const eventId = await logAiEvent({
      userId: input.userId,
      feature: input.feature,
      kind: "generation",
      provider: "openai",
      usage: usageOf(model, startedAt, completion.usage),
      summary: input.summary,
    });
    return { data, eventId };
  } catch (err) {
    await logAiEvent({
      userId: input.userId,
      feature: input.feature,
      kind: "generation",
      provider: "openai",
      usage: usageOf(model, startedAt, undefined),
      outcome: "failed",
      summary: { ...input.summary, error: err instanceof Error ? err.message.slice(0, 200) : "unknown" },
    });
    throw err;
  }
}

/** Plain text output. Logs one AiEvent. */
export async function generateText(input: GenerateInput): Promise<{ text: string; eventId: string | null }> {
  const model = writingModel();
  const startedAt = performance.now();
  try {
    const completion = await getOpenAI().chat.completions.create({
      model,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.prompt },
      ],
    });
    const text = completion.choices[0]?.message.content?.trim();
    if (!text) throw new Error("Model returned no text");

    const eventId = await logAiEvent({
      userId: input.userId,
      feature: input.feature,
      kind: "generation",
      provider: "openai",
      usage: usageOf(model, startedAt, completion.usage),
      summary: input.summary,
    });
    return { text, eventId };
  } catch (err) {
    await logAiEvent({
      userId: input.userId,
      feature: input.feature,
      kind: "generation",
      provider: "openai",
      usage: usageOf(model, startedAt, undefined),
      outcome: "failed",
      summary: { ...input.summary, error: err instanceof Error ? err.message.slice(0, 200) : "unknown" },
    });
    throw err;
  }
}
