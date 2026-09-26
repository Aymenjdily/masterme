import { estimateCostUsd, logAiEvent, type AiProvider } from "@/lib/ai/log";

// Jev-shaped decisions: typed choice / score / noul answers with probabilities and confidence.
// Runs on OpenAI (logprobs) until Jev signups reopen; DECISION_PROVIDER=jev switches it later.
// Server-only.

export type ChoiceQuestion<O extends string = string> = {
  type: "choice";
  question: string;
  options: readonly O[];
  /** What each option means, so the model can judge between them. */
  criteria?: Partial<Record<O, string>>;
};

export type ScoreQuestion = {
  type: "score";
  question: string;
  /** Number of levels, 2–10. Level 1 is the lowest. */
  levels: number;
  /** What a level means, e.g. { 1: "trivial", 5: "very hard" }. */
  criteria?: Record<number, string>;
};

export type NoulQuestion = { type: "noul"; question: string };

export type Question = ChoiceQuestion | ScoreQuestion | NoulQuestion;

export type ChoiceAnswer<O extends string = string> = {
  choice: O;
  probabilities: Record<O, number>;
  confidence: number;
};

export type ScoreAnswer = {
  /** Most likely level, 1..levels. */
  score: number;
  /** Probability-weighted level. */
  expected: number;
  /** probabilities[i] is the probability of level i + 1. */
  probabilities: number[];
  confidence: number;
};

export type NoulAnswer = {
  noul: boolean;
  /** Probability of "yes". */
  probability: number;
  confidence: number;
};

export type AnyAnswer = ChoiceAnswer | ScoreAnswer | NoulAnswer;

export type AnswerOf<Q extends Question> =
  Q extends ChoiceQuestion<infer O> ? ChoiceAnswer<O> : Q extends ScoreQuestion ? ScoreAnswer : NoulAnswer;

export type Answers<Qs extends Record<string, Question>> = { [K in keyof Qs]: AnswerOf<Qs[K]> };

export function choice<const O extends string>(
  question: string,
  options: readonly O[],
  criteria?: Partial<Record<O, string>>
): ChoiceQuestion<O> {
  return { type: "choice", question, options, criteria };
}

export function score(question: string, levels: number, criteria?: Record<number, string>): ScoreQuestion {
  return { type: "score", question, levels, criteria };
}

export function noul(question: string): NoulQuestion {
  return { type: "noul", question };
}

export type ProviderResult = {
  answers: Record<string, AnyAnswer>;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

export interface DecisionProvider {
  name: AiProvider;
  decide(state: string, questions: Record<string, Question>): Promise<ProviderResult>;
}

function validate(questions: Record<string, Question>) {
  const entries = Object.entries(questions);
  if (entries.length === 0) throw new Error("decide() needs at least one question");
  for (const [id, q] of entries) {
    if (q.type === "choice" && (q.options.length < 1 || q.options.length > 255 || new Set(q.options).size !== q.options.length)) {
      throw new Error(`Question "${id}": choice needs 1–255 unique options`);
    }
    if (q.type === "score" && (!Number.isInteger(q.levels) || q.levels < 2 || q.levels > 10)) {
      throw new Error(`Question "${id}": score needs 2–10 levels`);
    }
  }
}

async function provider(): Promise<DecisionProvider> {
  const name = process.env.DECISION_PROVIDER ?? "openai";
  if (name === "openai") return (await import("@/lib/ai/providers/openai-decisions")).openaiDecisions;
  if (name === "jev") throw new Error("The Jev provider isn't available yet (signups are paused). Use DECISION_PROVIDER=openai.");
  throw new Error(`Unknown DECISION_PROVIDER "${name}"`);
}

/**
 * Asks one or more typed questions about `state` and logs a single AiEvent.
 * `confidence` is the lowest confidence across the answers — gate on it with `gate()`.
 */
export async function decide<const Qs extends Record<string, Question>>(input: {
  userId: string;
  feature: string;
  state: string | Record<string, unknown>;
  questions: Qs;
  summary?: Record<string, string | number | boolean | null>;
}): Promise<{ answers: Answers<Qs>; confidence: number; eventId: string | null }> {
  validate(input.questions);
  const state = typeof input.state === "string" ? input.state : JSON.stringify(input.state);
  const p = await provider();
  const startedAt = performance.now();

  try {
    const result = await p.decide(state, input.questions);
    const confidence = Math.min(...Object.values(result.answers).map((a) => a.confidence));
    const eventId = await logAiEvent({
      userId: input.userId,
      feature: input.feature,
      kind: "decision",
      provider: p.name,
      usage: {
        model: result.model,
        latencyMs: performance.now() - startedAt,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: estimateCostUsd(result.model, result.inputTokens, result.outputTokens),
      },
      confidence,
      summary: input.summary,
    });
    return { answers: result.answers as Answers<Qs>, confidence, eventId };
  } catch (err) {
    await logAiEvent({
      userId: input.userId,
      feature: input.feature,
      kind: "decision",
      provider: p.name,
      usage: { model: "unknown", latencyMs: performance.now() - startedAt, inputTokens: null, outputTokens: null, costUsd: null },
      outcome: "failed",
      summary: { ...input.summary, error: err instanceof Error ? err.message.slice(0, 200) : "unknown" },
    });
    throw err;
  }
}
