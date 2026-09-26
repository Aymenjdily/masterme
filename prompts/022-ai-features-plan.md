# AI Features — overall plan (Jev + OpenAI)

## Goal

Add eight AI features that make MasterMe stand out to recruiters, using **Jev** (TypeSafe's System One model: fast typed decisions with confidence) for decisions and **OpenAI** for writing. The job match breakdown is dropped (no LinkedIn data).

Features:
1. ⌘K command bar
2. Paste anything
3. AI day planner
4. Smart follow-up writer
5. Interview prep
6. Learning path generator
7. Weekly AI review
8. AI observability panel

Each feature gets its own design board → approval → build, like the pages. This prompt covers the **shared foundation** and the order.

## Skills and docs read

- `.opencode/skills/nextjs.md`, `prisma.md`, `react.md`, `typescript.md`
- TypeSafe docs:
  - API reference (`POST https://api.typesafe.ai/v1/systemone`, Bearer key, `model: "jev-latest"`, `state` + `questions` map).
  - Primitives: Choice (≤255 options), Score (2–10 levels), Noul (yes/no probability).
  - Confidence (≥0.9 act, 0.5–0.9 confirm, <0.5 don't act).
  - JS SDK `@typesafe-ai/sdk`.
- OpenRouter Jev guide (`typesafe/jev-1.13`, `usage.cost`, 32k context).
- OpenAI: official `openai` SDK with structured (JSON-schema) outputs.

## Code inspected

- All module APIs: timeline, learning, job applications, recruiter contacts, projects, monthly costs, tech news, user skills. They're all session-scoped route handlers.
- `src/lib/validations.ts` (zod everywhere), `src/lib/query-keys.ts`, `src/components/ui-patterns/dialogs.tsx`, header (`app-header.tsx`) for the ⌘K entry point.
- `prisma/schema.prisma` — no AI/log tables; the project uses `prisma db push`.

## Update — Jev signups paused

TypeSafe has paused new Jev signups. **Decisions run on OpenAI for now, behind a Jev-shaped interface**, so switching later is one env flag (`DECISION_PROVIDER=openai|jev`) plus the Jev provider file. The feature code doesn't change.

- **OpenAI decision provider:** structured output limits the answer to the allowed option keys, and the token logprobs of the answer give per-option probabilities, and so a confidence value.
  - This is less well calibrated than Jev; the thresholds are tuned later using the `AiEvent` accept/edit data.
  - Latency is roughly 1–3 s instead of 70–500 ms.
- **Jev provider:** written against the documented REST API when access opens, then compared with OpenAI in the observability panel (latency, cost, accuracy).

## Decisions and assumptions

1. **Who does what:**
   - **Jev** handles every *decision*: intent, category, priority, which item, next action, difficulty. Its 70–500 ms latency and confidence make these usable while you type.
   - **OpenAI** handles everything that needs *free text*: extracting a name, email or title from pasted text; writing messages, questions, paths and reviews. Jev cannot produce strings.
2. **Server only.** `TYPESAFE_API_KEY`, `OPENAI_API_KEY` and `OPENAI_MODEL` live in `.env.local`. The browser only calls our own `/api/ai/*` routes; every route is session-scoped and validated with zod.
3. **`src/lib/ai/decisions.ts`:** the Jev-shaped decision interface (`choice()`, `score()`, `noul()`, typed answers + probabilities + confidence) with provider selection by env. `src/lib/ai/providers/openai-decisions.ts` implements it now; `src/lib/ai/providers/jev.ts` (a small typed wrapper over the REST API) comes when Jev access opens.
   - Helpers `choice()`, `score()`, `noul()`; answer types are inferred from the questions.
   - Retries with backoff on 429/529 and a timeout.
   - Base URL is configurable via env, so OpenRouter can be used instead.
   - Plain `fetch` rather than the SDK, so we control typing, logging and retries. The SDK can be swapped in later.
4. **`src/lib/ai/openai.ts`:** a wrapper around the official SDK.
   - Structured outputs are validated with zod, plus a plain-text helper.
   - The model comes from `OPENAI_MODEL`; I won't hard-code a model id I can't verify.
5. **Confidence gating** (`src/lib/ai/confidence.ts`), following TypeSafe's guidance:
   - ≥ 0.9 → apply automatically (only for low-risk actions).
   - 0.5–0.9 → show as a suggestion to confirm.
   - < 0.5 → don't act; ask the user.
   - Risky actions (delete, status to rejected) always need confirmation.
6. **AI log** (new Prisma model `AiEvent`, scoped to the user):
   - Fields: feature, provider (jev/openai), model, latency ms, input/output tokens, cost USD, confidence, outcome (applied / suggested / accepted / edited / rejected), and a small JSON summary.
   - Every AI call writes one row. This feeds the observability panel and "accuracy" (how often you accepted a decision as-is).
   - Adding it needs `npx prisma db push`.
7. **Honest limits:**
   - AI output is always shown as a draft or suggestion unless it's high-confidence and low-risk.
   - Nothing is sent to recruiters automatically.
   - Only the needed fields are sent to the models, never passwords or tokens.
8. **Scope:** add an "AI assistance (Jev + OpenAI)" section to AGENTS.md listing these eight features, since AGENTS.md says "build nothing beyond what is listed".

## Build order (each: design → approval → build)

| # | Phase | Why this order |
|---|---|---|
| 0 | Foundation: wrappers, `AiEvent` log, keys, AGENTS.md | Everything depends on it |
| 1 | AI observability panel | Makes every later feature measurable from day one |
| 2 | ⌘K command bar | Jev intent + item/time choices over your real data; strongest demo |
| 3 | Paste anything | Jev classifies/routes, OpenAI extracts fields |
| 4 | Smart follow-up writer | Jev next action → OpenAI draft |
| 5 | AI day planner | Jev assigns pending items to the 8 blocks with priorities |
| 6 | Learning path generator | OpenAI steps → Jev difficulty/time |
| 7 | Interview prep | Paste the job description → Jev gaps vs your stack → OpenAI questions + study path |
| 8 | Weekly AI review | Scheduled (cron, like `news:fetch`) → stored review, Jev flags |

## Expected files (phase 0)

- `src/lib/ai/decisions.ts`, `src/lib/ai/providers/openai-decisions.ts`, `src/lib/ai/openai.ts`, `src/lib/ai/confidence.ts`, `src/lib/ai/log.ts` (Jev provider later)
- `prisma/schema.prisma` — `AiEvent` model (+ `User.aiEvents`)
- `.env.example` — `OPENAI_API_KEY`, `OPENAI_MODEL`, `DECISION_PROVIDER` (default `openai`), and `TYPESAFE_API_KEY` / `TYPESAFE_BASE_URL` placeholders for later
- `package.json` — `openai`
- `AGENTS.md` — AI scope section

## Security considerations

- Keys are server-only; every route checks the session and validates input and output with zod.
- User data sent to the providers is minimal and task-specific; the AI log stores summaries, not full prompts.
- Rate limits are respected with backoff; costs are logged per call.

## Acceptance criteria (phase 0)

- A server smoke test runs one `choice()` decision (OpenAI provider, with probabilities + confidence) and one OpenAI structured-output call successfully, and both write `AiEvent` rows.
- Lint shows no new errors; typecheck passes; the schema is pushed.

## Checks to run

`npm run lint`, `npm run typecheck`, `npx prisma db push` (with your OK), and a smoke-test script against both APIs.

## Resolved

- Models: `OPENAI_MODEL=gpt-5.4-mini` (writing), `OPENAI_DECISION_MODEL=gpt-4.1-mini` (decisions; needs logprobs).
- `AiEvent` table approved and pushed.
- Choice/score labels are sent to OpenAI as numbers ("1".."N"), which are single tokens, so one token's top-20 logprobs give the option probabilities.
- Smoke test: `npm run ai:smoke`.
