# AI 03 — AI day planner

## Goal

Build the AI day planner to match `design/ai-day-planner@2x.png` (source `design/ai-day-planner.html`).

From your open items (due follow-ups, the next learning steps, active projects and, optionally, new radar items), the AI suggests blocks for **today's free slots**. You keep, drop or edit each suggestion, then accept. Nothing is saved until you accept, and your own blocks never move. This keeps the AGENTS rule: the user fills the timeline; the AI only suggests.

## Skills read

- `.opencode/skills/nextjs.md`, `react.md`, `typescript.md`, `tailwind.md`
- Prompts 022–024 (AI foundation, Paste anything, Follow-up writer), 013 (Timeline)

## Code inspected

- Timeline:
  - `TimelineView`, `TimeBlockSlot`, `DayProgress`, `WakeUpPrompt`;
  - `api/timeline` (GET by date, wake-up hour) and `api/timeline/blocks` (create, update, delete, reorder);
  - schema: 8 slots (0–7), unique per hour, priority low/med/high.
- Data sources: job applications and recruiters (`dueForFollowUp`), learning paths and items (order, status), projects (type, status), tech news (createdAt).
- `src/lib/ai/*` (decide, generateObject, gate, log, aiRateLimited), `src/components/ai/*` (ConfidenceMeter, Toast).

## Decisions and assumptions

1. **Entry point:** a **Plan with AI** button next to "Today". It's enabled once the wake-up hour is set and at least one slot is free; otherwise it explains why. It opens a small dialog:
   - "What matters most today?" (optional);
   - checkboxes for Follow-ups, Learning, Projects and Radar (radar is off by default), each with its count.
2. **Route:** `POST /api/ai/day-plan` with `{ date, focus?, include }`. Everything is loaded server-side and scoped to the user.
   - **Candidates** (deterministic, at most 12):
     - all due follow-ups combined into one "Follow-ups" item;
     - the next unfinished step of each active learning path;
     - active projects;
     - radar items from the last 2 days, when ticked.
   - **Decision:** one `decide()` call with a **score** question per candidate: 1 = not today, 2 = low, 3 = medium, 4 = high. It takes your focus text and today's date into account, and each answer has its own %.
   - **Placement** is deterministic and explainable:
     - high-priority project work goes in the first free morning slots;
     - follow-ups get one combined block;
     - learning goes after lunch;
     - a **lunch break** is suggested in the free slot nearest 12:00 when 4 or more hours of work are planned;
     - one slot is left free as a buffer when possible.
   - **Naming:** one `generateObject` call writes short titles and descriptions for the placed items. It uses only their real names, never invents tasks.
   - The **"why"** line under each block (e.g. "next step in an active path") comes from the data, not the model.
   - **Returns:** suggestions `{ slot, title, description, priority, source, count, confidence, why }`, a "Not today" list with reasons, the event ids and timing.
3. **Preview on the timeline:**
   - suggestions show as dashed amber blocks, each with its %, keep ✓, drop ✕ and edit ✎;
   - your blocks are tagged "yours";
   - above the timeline, a banner with Discard / Replan / **Accept N blocks**;
   - the right column becomes the **AI plan** panel (time mix, Not today, actions), replacing Day progress while previewing.
4. **Edit dialog:** title, priority, and a "Why here" note, with Drop it / Keep with changes.
5. **Accept:**
   - creates the kept blocks through the existing blocks API (status planned);
   - shows a toast "N blocks added · Undo", and Undo deletes exactly those blocks;
   - if a slot got filled in the meantime, that suggestion is skipped and the toast says so.
6. **Log:** decision and naming events are recorded as:
   - `accepted` when all kept blocks were unchanged;
   - `edited` when any was edited or dropped;
   - `rejected` when discarded or undone.
7. **Rate limit:** 20 AI events per 10 minutes for `dayplan.*`.

## Expected files

- `src/lib/ai/day-plan.ts` (candidates, scoring questions, placement, naming) and `src/app/api/ai/day-plan/route.ts`
- `src/lib/ai/day-plan-kinds.ts` (shared types)
- `src/components/ai/DayPlanner.tsx`: the plan dialog, preview state, banner, AI plan panel and edit dialog
- Edits:
  - `TimelineView` (Plan with AI button; preview mode swaps the right panel and renders suggestion rows);
  - `TimeBlockSlot` (suggestion variant, or a small `SuggestedSlot`).

## Security considerations

- Session required; every source is loaded with `userId`.
- Only titles, dates, statuses and your optional focus text go to OpenAI; the log stores counts and outcomes only.
- Blocks are created through the existing validated routes, so the 8-block limit still holds.

## Acceptance criteria

- Matches the board: preview with banner, kept and dropped blocks, AI plan panel, plan dialog, planning steps, edit dialog, nothing to plan, day full, accepted toast and error.
- Only free slots are suggested; your blocks never change.
- No invented tasks: every suggestion traces back to a real item, or is the lunch break.
- Accept creates exactly the kept blocks, and Undo removes them.
- Lint shows no new errors; typecheck and build pass.

## Checks to run

`npm run lint`, `npm run typecheck`, `npm run build` (dev server stopped first), plus a real-API run on your data with screenshots.

## Manual test steps

1. Open `/timeline` (today), set a wake-up hour, add one block yourself.
2. Click **Plan with AI**, type a focus, then Plan my day. Suggestions only fill free slots.
3. Drop one, edit another's title, then **Accept**. The blocks appear as normal blocks.
4. Click **Undo** on the toast. The suggested blocks are gone and yours are still there.
5. Fill all 8 blocks: Plan with AI says the day is full.
