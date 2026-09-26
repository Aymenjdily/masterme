# AI 04 — Learning path generator

## Goal

Build the learning path generator to match `design/learning-path-generator@2x.png` (source `design/learning-path-generator.html`).

You say what you want to learn. The AI drafts a path of 6–10 ordered steps, rates each step's difficulty, and marks the steps you probably already know from your stack. You trim and edit the steps, then create a normal path, or add the steps to an empty existing path.

## Skills read

- `.opencode/skills/nextjs.md`, `react.md`, `typescript.md`, `tailwind.md`
- Prompts 022–025 (AI foundation and the first three AI features), 012 (Learning)

## Code inspected

- Learning:
  - `LearningView`, `PathCard`, `PathDetail`, `progress.ts`, `LearningPathForm`, `LearningItemForm`;
  - `api/learning-paths` (POST) and `api/learning-paths/[id]/items` (POST);
  - `learningPathSchema` / `learningItemSchema`.
- `User.skills` (the stack from Settings), `src/lib/ai/*`, `src/components/ai/*` (ConfidenceMeter, Toast, the dialog patterns).
- `LearningItem` has title, description, resourceUrl, status and order. It has **no** type, difficulty or hours fields.

## Decisions and assumptions

1. **Entry points:**
   - **Generate with AI** next to "New path" (creates a new path);
   - **Generate steps** in the empty state of a path that has no steps (adds steps to that path; its title and description stay as they are).
2. **Form:**
   - topic (required, 3–150 characters), with 2 suggestions based on your stack;
   - level (New / Some / Solid), pre-selected by the AI from your stack, with its %;
   - time per week (2h / 5h / 10h);
   - an optional goal.
   - The level is decided by one quick `decide()` call when the dialog opens. Nothing else runs until you click Generate.
3. **Generate:** `POST /api/ai/learning-path` with `{ topic, level, hoursPerWeek, goal?, pathId? }`.
   - **Vague topics:** a yes/no decision first ("is this topic specific enough for one path?"). If it isn't, you get the "too broad" message with 2 sharper suggestions, and no path is drafted.
   - **Outline:** `generateObject` produces a title and description (new path only) plus 6–10 steps, each with `{ title, description, kind: read | watch | practice | build, hours }`.
     - The last step is a small build with **your own project** when one fits; only your real project names are sent.
   - **Per step, one `decide()` call:**
     - difficulty (a score from 1 to 5);
     - "do you already know this?" (yes/no, judged against your stack).
     - Steps you probably know (≥ 50%) start unticked, tagged "you know this · 92%".
   - **Links, never made up:**
     - The model may only pick a link from a fixed list of official docs sites (docs.docker.com, nextjs.org, react.dev, developer.mozilla.org, typescriptlang.org, postgresql.org, prisma.io, tailwindcss.com, nodejs.org, and so on), and the server checks the domain.
     - Anything else becomes a "find a resource" link, which is a search URL built from the step title.
4. **Review:**
   - tick or untick steps, reorder them (↑↓), edit inline (title, type, hours);
   - the total (~Nh, weeks at your pace) updates as you change things.
   - Buttons: Regenerate, Back (keeps your answers), **Create path · N steps** / **Add N steps to …**.
5. **Saving** goes through the existing routes: create the path (new path only), then the items in order.
   - Type and hours are kept as a short suffix in the step description, e.g. "(Build · ~3h)", so no schema change is needed. Difficulty is only shown in the preview.
   - Toast: "Path created · N steps · Open → · Undo". Undo deletes the path; in "add steps" mode it deletes only the added items.
6. **Log:**
   - `accepted` when all steps were kept unchanged;
   - `edited` when any step was dropped, edited or reordered;
   - `rejected` when closed without saving, or undone.
7. **Rate limit:** 20 AI events per 10 minutes for `learnpath.*`.

## Expected files

- `src/lib/ai/learning-path.ts` (level question, specificity check, outline schema, per-step decisions, link allowlist) and `src/lib/ai/learning-path-kinds.ts` (shared types)
- `src/app/api/ai/learning-path/route.ts` (GET: level guess and suggestions; POST: generate)
- `src/components/ai/PathGenerator.tsx` (dialog: form, drafting, review, edit, too broad, error)
- Edits: `LearningView` (Generate with AI button), `PathDetail` (Generate steps in the empty state)

## Security considerations

- Session required. Your skills and project names are read on the server and scoped to you.
- Only the topic, your answers, your stack and your project names are sent to OpenAI.
- Links are checked against the allowlist on the server. Search links are built by the server, not the model.
- Saving goes through the existing validated routes.

## Acceptance criteria

- Matches the board: review dialog, form, drafting, empty-path entry, inline edit, created toast, too broad, error.
- No made-up URLs: every link is on the allowlist or is a search link.
- Steps you already know start unticked, and you can tick them back.
- Create makes exactly the ticked steps in the shown order; Undo removes them.
- Lint shows no new errors; typecheck and build pass.

## Checks to run

`npm run lint`, `npm run typecheck`, `npm run build` (dev server stopped first), plus a real-API run with screenshots, including "Generate steps" for your empty "MERN Interview QA" path, undone afterwards.

## Manual test steps

1. On `/learning`, click **Generate with AI**. Type "Docker, to ship my Next.js apps myself", keep the suggested level, pick 5h, Generate.
2. Untick a step, move one up, edit a title. The total hours change. Create.
3. Open the new path: the steps are in order, with "(Type · ~Nh)" in each description. Click **Undo** on the toast and the path is gone.
4. Open "MERN Interview QA" → **Generate steps** → **Add N steps**. They're added to that path.
5. Type just "AI": you get the "too broad" message with suggestions.
