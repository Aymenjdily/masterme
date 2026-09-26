import type { ChatCompletionTokenLogprob } from "openai/resources/chat/completions";
import { getOpenAI } from "@/lib/ai/openai";
import type { AnyAnswer, DecisionProvider, Question } from "@/lib/ai/decisions";

// Decisions on OpenAI: structured output restricts the answer to short labels ("1".."N", "yes"/"no"),
// and the logprobs of the answer token give a probability for every label, hence a confidence.
// Numeric labels up to 3 digits are a single token, so one token's top_logprobs covers the options
// (options outside the top 20 get probability 0).

const SYSTEM =
  "You are a decision model. Read the state, then answer the question by picking exactly one of the allowed labels. " +
  "Judge only from the state. Do not invent facts.";

function decisionModel() {
  const model = process.env.OPENAI_DECISION_MODEL;
  if (!model) throw new Error("OPENAI_DECISION_MODEL is not set");
  return model;
}

type Asked = {
  answer: string;
  probabilities: Map<string, number>;
  inputTokens: number;
  outputTokens: number;
};

/** Probabilities of each label from the logprobs of the token where the answer value starts. */
function labelProbabilities(content: string, answer: string, tokens: ChatCompletionTokenLogprob[], labels: string[]) {
  const key = content.indexOf('"answer"');
  const valueStart = content.indexOf(`"${answer}"`, key + '"answer"'.length) + 1;
  const valid = new Set(labels);
  const probabilities = new Map<string, number>();

  let offset = 0;
  for (const token of tokens) {
    const end = offset + token.token.length;
    if (end > valueStart) {
      // Some tokenizers merge the opening quote into the value token; drop that prefix.
      const cut = valueStart - offset;
      for (const alt of token.top_logprobs) {
        const label = alt.token.slice(cut).split('"')[0];
        if (valid.has(label)) probabilities.set(label, (probabilities.get(label) ?? 0) + Math.exp(alt.logprob));
      }
      if (!probabilities.has(answer)) probabilities.set(answer, Math.exp(token.logprob));
      break;
    }
    offset = end;
  }

  const total = [...probabilities.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return new Map([[answer, 1]]);
  return new Map([...probabilities].map(([label, p]) => [label, p / total]));
}

async function ask(model: string, state: string, question: string, legend: string, labels: string[]): Promise<Asked> {
  const completion = await getOpenAI().chat.completions.create(
    {
      model,
      temperature: 0,
      max_tokens: 20,
      logprobs: true,
      top_logprobs: 20,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `STATE:\n${state}\n\nQUESTION:\n${question}\n\nLABELS:\n${legend}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "decision",
          strict: true,
          schema: {
            type: "object",
            properties: { answer: { type: "string", enum: labels } },
            required: ["answer"],
            additionalProperties: false,
          },
        },
      },
    },
    { timeout: 15_000 }
  );

  const choice = completion.choices[0];
  const content = choice?.message.content ?? "";
  const answer = (JSON.parse(content) as { answer: string }).answer;
  if (!labels.includes(answer)) throw new Error(`Decision returned an unknown label "${answer}"`);

  return {
    answer,
    probabilities: labelProbabilities(content, answer, choice?.logprobs?.content ?? [], labels),
    inputTokens: completion.usage?.prompt_tokens ?? 0,
    outputTokens: completion.usage?.completion_tokens ?? 0,
  };
}

async function answer(model: string, state: string, q: Question): Promise<{ answer: AnyAnswer; asked: Asked }> {
  if (q.type === "choice") {
    const labels = q.options.map((_, i) => String(i + 1));
    const legend = q.options
      .map((option, i) => {
        const note = q.criteria?.[option];
        return `${i + 1} = ${option}${note ? ` — ${note}` : ""}`;
      })
      .join("\n");
    const asked = await ask(model, state, q.question, legend, labels);
    const probabilities = Object.fromEntries(
      q.options.map((option, i) => [option, asked.probabilities.get(String(i + 1)) ?? 0])
    );
    return {
      asked,
      answer: {
        choice: q.options[Number(asked.answer) - 1],
        probabilities,
        confidence: Math.max(...Object.values(probabilities)),
      },
    };
  }

  if (q.type === "score") {
    const labels = Array.from({ length: q.levels }, (_, i) => String(i + 1));
    const legend = labels
      .map((label) => `${label}${q.criteria?.[Number(label)] ? ` = ${q.criteria[Number(label)]}` : ""}`)
      .join("\n");
    const asked = await ask(model, state, `${q.question}\n(1 is the lowest, ${q.levels} the highest.)`, legend, labels);
    const probabilities = labels.map((label) => asked.probabilities.get(label) ?? 0);
    return {
      asked,
      answer: {
        score: Number(asked.answer),
        expected: probabilities.reduce((sum, p, i) => sum + p * (i + 1), 0),
        probabilities,
        confidence: Math.max(...probabilities),
      },
    };
  }

  const asked = await ask(model, state, q.question, "yes\nno", ["yes", "no"]);
  const probability = asked.probabilities.get("yes") ?? 0;
  return {
    asked,
    answer: { noul: asked.answer === "yes", probability, confidence: Math.max(probability, 1 - probability) },
  };
}

export const openaiDecisions: DecisionProvider = {
  name: "openai",
  async decide(state, questions) {
    const model = decisionModel();
    const entries = Object.entries(questions);
    // One call per question, in parallel, so each answer has its own clean logprobs.
    const results = await Promise.all(entries.map(([, q]) => answer(model, state, q)));
    return {
      model,
      answers: Object.fromEntries(entries.map(([id], i) => [id, results[i].answer])),
      inputTokens: results.reduce((sum, r) => sum + r.asked.inputTokens, 0),
      outputTokens: results.reduce((sum, r) => sum + r.asked.outputTokens, 0),
    };
  },
};
