import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Server-only: imported by route handlers and scripts, never by client components.

export type AiKind = "decision" | "generation";
export type AiProvider = "openai" | "jev";
export type AiOutcome = "applied" | "suggested" | "accepted" | "edited" | "rejected" | "failed";

export type AiUsage = {
  model: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
};

/** USD per 1M tokens [input, output]. Models missing here log a null cost. */
const PRICES: Record<string, [number, number]> = {
  "gpt-4.1": [2, 8],
  "gpt-4.1-mini": [0.4, 1.6],
  "gpt-4.1-nano": [0.1, 0.4],
  "gpt-4o-mini": [0.15, 0.6],
};

export function estimateCostUsd(model: string, inputTokens: number | null, outputTokens: number | null) {
  const price = PRICES[model] ?? PRICES[model.replace(/-\d{4}-\d{2}-\d{2}$/, "")];
  if (!price || inputTokens === null || outputTokens === null) return null;
  return (inputTokens * price[0] + outputTokens * price[1]) / 1_000_000;
}

/** Writes one AiEvent row. Never throws: a logging failure must not break the feature. */
export async function logAiEvent(event: {
  userId: string;
  feature: string;
  kind: AiKind;
  provider: AiProvider;
  usage: AiUsage;
  confidence?: number | null;
  outcome?: AiOutcome;
  summary?: Prisma.InputJsonValue;
}): Promise<string | null> {
  try {
    const row = await prisma.aiEvent.create({
      data: {
        userId: event.userId,
        feature: event.feature,
        kind: event.kind,
        provider: event.provider,
        model: event.usage.model,
        latencyMs: Math.round(event.usage.latencyMs),
        inputTokens: event.usage.inputTokens,
        outputTokens: event.usage.outputTokens,
        costUsd: event.usage.costUsd,
        confidence: event.confidence ?? null,
        outcome: event.outcome ?? "suggested",
        summary: event.summary,
      },
      select: { id: true },
    });
    return row.id;
  } catch (err) {
    console.error("[ai-log] failed to write AiEvent:", err);
    return null;
  }
}

/** Records what the user did with a suggestion (accepted as-is, edited, rejected). Scoped to the user. */
export async function setAiEventOutcome(userId: string, eventId: string, outcome: AiOutcome) {
  const result = await prisma.aiEvent.updateMany({ where: { id: eventId, userId }, data: { outcome } });
  return result.count > 0;
}

/** True when the user logged at least `max` AI events for this feature prefix in the window. */
export async function aiRateLimited(userId: string, featurePrefix: string, max: number, windowMs = 10 * 60 * 1000) {
  const count = await prisma.aiEvent.count({
    where: { userId, feature: { startsWith: featurePrefix }, createdAt: { gte: new Date(Date.now() - windowMs) } },
  });
  return count >= max;
}
