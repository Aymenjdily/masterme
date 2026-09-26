# AI 01 — Paste anything

## Goal

Build **Paste anything** to match `design/paste-anything@2x.png` (source `design/paste-anything.html`). You paste a message, job post or link; the AI decides what it is, fills the right form, and you review and save.

## Skills read

- `.opencode/skills/nextjs.md`, `react.md`, `typescript.md`, `tailwind.md`
- Prompt 022 (AI foundation), prompts 010–021 (design system, dialogs, jobs, learning, news, portfolio)

## Code inspected

- `src/lib/ai/*` (decide, generateObject, gate, log)
- `src/components/layout/app-header.tsx` (entry button)
- `src/components/ui-patterns/dialogs.tsx` (FormDialog)
- Create routes and validations for recruiter contacts, job applications, learning items, tech news and portfolio links (`src/lib/validations.ts`)
- `queryKeys` for cache refreshes

## Decisions and assumptions

1. **Targets (5):** recruiter contact, application, learning step, radar item, portfolio link.
2. **Entry points:**
   - A "Paste anything" button in the header on every page.
   - `Ctrl+Shift+V` from anywhere. Plain `Ctrl+V` is left alone, so normal pasting into inputs still works.
3. **Flow (two server calls, so the dialog can show progress):**
   1. `POST /api/ai/paste/classify` `{text}`:
      - `decide()` with `kind` (a choice of the 5 targets plus `other`).
      - For learning: a `path` choice over your active paths.
      - For recruiters: `alsoApplication` (a yes/no on whether the text also describes a specific job).
      - Returns the answers, their probabilities, the gate and `eventId`.
   2. `POST /api/ai/paste/extract` `{text, kind}`:
      - `generateObject()` with a zod schema per target.
      - It returns `null` for missing fields and never invents values.
      - A follow-up date is only suggested for recruiters and applications (today + 3 days, matching the existing rule).
4. **Gating (from `gate()`):**
   - ≥ 90%: the type is set, and "Change" lets you switch.
   - 50–90%: you pick between the top two, with their percentages.
   - < 50%: you choose from the 5 tiles; no extraction runs until you pick.
   - Fields are always reviewed; nothing is ever saved automatically.
5. **Save** uses the **existing create APIs**. No new write routes; validation and user scoping stay where they are.
   - "Also add an application" creates both records.
   - **Undo** on the toast deletes what was just created, using the existing DELETE routes.
6. **Log:** outcome is recorded via `POST /api/ai/events/[id]/outcome`:
   - `accepted` when saved unchanged;
   - `edited` when any AI field was changed;
   - `rejected` when cancelled after a result.

   This is what the observability panel measures later.
7. **Limits:**
   - Text is 1–4,000 characters (zod).
   - A simple per-user rate limit of 20 runs per 10 minutes, counted from `AiEvent` rows.
   - The fill step times out at 30 s and shows the error state, with "Try again" and "Fill it myself" (the plain form).

## Expected files

- `src/app/api/ai/paste/classify/route.ts`, `src/app/api/ai/paste/extract/route.ts`, `src/app/api/ai/events/[id]/outcome/route.ts`
- `src/lib/ai/paste.ts` (targets, questions, extraction schemas)
- `src/components/ai/PasteAnything.tsx` (dialog and states), `PasteButton.tsx`, `ConfidenceMeter.tsx`
- `src/components/layout/app-header.tsx` (button + shortcut)

## Security considerations

- Session required on every route.
- Only the pasted text and your active path titles are sent to OpenAI.
- The log stores type, confidence and outcome, never the text.
- Saving goes through the existing validated, user-scoped routes.

## Acceptance criteria

- Matches the board: main result, empty, reading, not sure, learning step, don't know, toast and error.
- A French recruiter message → Recruiter, with fields filled and the application checkbox offered.
- A course link → Learning step, with a path suggested.
- Gibberish → the "don't know" tiles.
- Save and Undo work; the Jobs, Learning, News and Portfolio pages update without a reload.
- Lint shows no new errors; typecheck passes; build passes.

## Checks to run

`npm run lint`, `npm run typecheck`, `npm run build` (dev server stopped first), plus a dev-server walkthrough with screenshots of each state.

## Manual test steps

1. Click **Paste anything** in the header and paste a recruiter message. Check the fields, uncheck or keep the application, then Save. Both appear in `/jobs`.
2. Press `Ctrl+Shift+V` on any page and paste a course URL. It suggests a learning path; save, and the step appears in `/learning`.
3. Paste an ambiguous job post. It asks you to pick between two types.
4. Paste "ok see you tomorrow". It shows the 5 tiles.
5. Save, then click **Undo** on the toast. The record is gone.
6. Open `npm run db:studio` → **AiEvent**. Rows show the outcome `accepted`, `edited` or `rejected`.
