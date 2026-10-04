# Timeline: tasks from your notes

## Goal

Notes tagged **#todo** become task recommendations on the timeline, in two places:

1. A **"From your notes"** card under Day progress. You add a note to a free hour by hand; no AI is involved.
2. A new **Notes** source in **Plan with AI**, so the planner can score and place #todo notes like your other open items.

Design: `design/timeline-notes.png` (source `design/timeline-notes.html`).

## Skills read

`.opencode/skills/nextjs.md`, `prisma.md`, `react.md`, `typescript.md`, `tailwind.md`; prompts 013 (Timeline), 025 (AI day planner), 034 (Notes).

## Code inspected

- **Timeline:**
  - `TimelineView.tsx`: the right column is `DayProgress`, or `PlanPanel` while previewing a plan; `acceptPlan` creates blocks through `POST /api/timeline/blocks`.
  - `TimeBlockSlot.tsx`.
  - `api/timeline/blocks/route.ts` upserts by `(timelineId, hour)`.
  - `timeBlockSchema` (hour 0–7, title, description, status, priority).
- **AI day planner:**
  - `src/lib/ai/day-plan.ts`: `collect` → `candidates` → `decide` score → fixed placement → naming;
  - `day-plan-kinds.ts`: `PlanSource`, `PlanInclude`, `PlanCounts`, `PlanSuggestion`;
  - `DayPlanner.tsx`: `SOURCE_STYLE`, `INCLUDE_ROWS`, the counts query, `PlanPanel`;
  - `api/ai/day-plan/route.ts`.
- **Notes:** `Note` (tags `String[]`, pinned); `noteTitle` and `notePreview` in `components/notes/note-utils.ts`. `NotesView` doesn't read `?tag=` yet.

## Decisions

1. **Which notes:** notes that have the tag `todo`, pinned ones first, then the most recently edited.
2. **Link block → note:** `TimeBlock` gets `noteId String?`, related to `Note` with `onDelete: SetNull`.
   - **A note is recommended for a day unless** it already has a block on that day, or any block made from it is completed (done).
   - Clearing the block brings it back. Removing `#todo` drops it for good. Deleting the note keeps the block and only removes the link.
3. **Recommendations API:** `GET /api/timeline/note-tasks?date=YYYY-MM-DD` returns `{ notes: [{ id, title, preview, pinned }], total }`.
   - The title uses `noteTitle`; the preview is the first line of `notePreview`, up to 90 characters.
   - It is scoped to the user, and the exclusion rule above runs in one Prisma query.
4. **"From your notes" card** under Day progress, hidden while a plan preview is shown:
   - it shows 3 notes, then "N more · Open in Notes →" linking to `/notes?tag=todo`; `NotesView` will start with the tag filter taken from `?tag=`;
   - each row has an **Add** button that opens a popover with the day's free hours (the first one marked "next free"; on today, past hours are skipped when a later free hour exists);
   - choosing an hour creates a block with: the note's title, description `From your note "<title>"`, priority medium (you can change it with Edit), status planned, and the `noteId`;
   - the toast offers Undo, and the timeline and card refresh;
   - **states:** no #todo notes (the empty state, with an Open Notes button); day full ("All 8 hours are filled", with Add disabled); no wake-up hour (the card is hidden, as the whole timeline is).
5. **Blocks from a note** show a small amber **Note** chip (in `TimeBlockSlot`, when `noteId` is set).
6. **Plan with AI:**
   - new source `notes`: `PlanInclude.notes`, defaulting to on when there are any; `PlanCounts.notes`; an Include row "Notes · tagged #todo";
   - the candidates are recommended #todo notes (the same rule, at most 5), with detail `To-do from the user's notes: "<title>": <first 160 chars>`;
   - the "why" line is "pinned #todo note" or "tagged #todo in Notes";
   - placement: notes go with the morning sources (project, follow-ups), since they are concrete tasks;
   - `PlanSuggestion.noteId` is passed into `acceptPlan`, so accepted blocks keep the link;
   - `SOURCE_STYLE.notes` uses the amber chip with the `StickyNote` icon; the Plan panel counts Notes hours.
7. **Validation:** `noteId` is optional on block create and update. The server checks that the note belongs to the user and returns 400 if not.

## Expected files

- **Schema:** `prisma/schema.prisma` (`TimeBlock.noteId`, plus the `Note.timeBlocks` relation).
- **Server code:**
  - new: `src/lib/note-tasks.ts` (the shared "recommended #todo notes" query), `src/app/api/timeline/note-tasks/route.ts`;
  - edited: `src/app/api/timeline/blocks/route.ts`, `src/lib/validations.ts`, `src/types/index.ts`, `src/lib/query-keys.ts`;
  - edited: `src/lib/ai/day-plan.ts`, `src/lib/ai/day-plan-kinds.ts`.
- **UI:**
  - new: `src/components/timeline/NoteTasksCard.tsx`;
  - edited: `src/components/timeline/TimelineView.tsx`, `TimeBlockSlot.tsx`;
  - edited: `src/components/ai/DayPlanner.tsx`, `src/components/notes/NotesView.tsx` (`?tag=`), `src/app/(dashboard)/notes/page.tsx`.

## Security

- Every query filters by `userId`. A `noteId` that isn't the user's returns 400, so nobody can link someone else's note.
- Note text goes to OpenAI only when Notes is ticked in Plan with AI, and only the title plus the first 160 characters of #todo notes. The AI log stores counts, not text.
- Blocks still go through the existing validated route, so the 8-block limit holds.

## Acceptance criteria

- **Card:** tagging a note `#todo` makes it appear in the card; Add → 10:00 creates the block with a Note chip, and the note leaves the card for that day.
- **When a note comes back:** completing that block hides the note on other days too. Clearing the block brings it back.
- **Plan with AI:** with Notes ticked it can suggest #todo notes; accepted blocks keep the Note chip.
- **States:** the card's empty, day-full and loading states match the board.
- **Link to Notes:** `/notes?tag=todo` opens Notes filtered to #todo.
- **Checks:** lint, typecheck and build pass.

## Checks to run

`npm run db:push`, `npm run lint`, `npm run typecheck`, `npm run build`, then a browser run on the dev server with a temporary test user, which is deleted afterwards.

## Manual test steps

1. In Notes, tag two notes `#todo` and pin one.
2. Open `/timeline` (today, with the wake-up hour set). Both notes show in "From your notes", with the pinned one first.
3. Click Add → the next free hour. The block appears with a Note chip and the note leaves the card. Undo removes the block.
4. Add it again, then mark the block completed and go to tomorrow: the note isn't recommended.
5. Click Plan with AI. The Notes row shows the count; plan and accept, and check for the Note chip.
6. Click "Open in Notes →". Notes opens filtered to #todo.
