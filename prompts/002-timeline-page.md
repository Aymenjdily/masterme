# Daily Timeline (8-hour blocks)

## Goal

Build the Timeline page: a single day's view showing exactly 8 hour slots (0-7), where the user can fill each slot with a task, track its status/priority, reorder blocks, and see a completed-vs-planned summary. Default to today, with prev/next day navigation.

## Skills read

- `.opencode/skills/nextjs.md`
- `.opencode/skills/prisma.md`
- `.opencode/skills/tailwind.md`
- `.opencode/skills/react.md`
- `.opencode/skills/typescript.md`
- Local Next.js docs already reviewed in the portfolio-page prompt (Route Handlers, TanStack Query) — same conventions apply here.

## Code inspected

- `prisma/schema.prisma` — `Timeline` (userId, date, blocks[]) and `TimeBlock` (timelineId, hour 0-7, title, description?, status, priority) already exist. No unique constraints on `(userId, date)` or `(timelineId, hour)` yet — see Decisions.
- `src/app/(dashboard)/timeline/page.tsx`, `src/components/forms/TimelineForm.tsx` — both scaffolded, return `null`.
- `src/lib/validations.ts` — `timelineSchema` (`{ date }`) and `timeBlockSchema` (`hour 0-7, title, description?, status, priority`) already defined.
- `src/types/index.ts` — `Timeline`, `TimeBlock` interfaces already defined.
- No `/api/timeline` routes exist yet.
- Reusing the pattern established on the portfolio page: Route Handlers scoped by session + userId, TanStack Query on the client, React Hook Form + Zod for the block form, `QueryClientProvider` already wired into `(dashboard)/layout.tsx`.
- Available UI primitives: `Card`, `Button`, `Input`, `Field*`, `Label`. No `Select`, `Textarea`, or `Badge` components exist yet — plan uses native `<select>`/`<textarea>` styled to match `Input`'s Tailwind classes rather than introducing new shadcn components for two small fields.

## Decisions and assumptions

1. **One Timeline per user per date.** Add `@@unique([userId, date])` to `Timeline` so a GET can safely upsert ("find or create") the day's row without racing duplicates. Requires `npx prisma db push` (no migrations folder exists yet — project uses `db push`, consistent with current workflow).
2. **One TimeBlock per hour per Timeline.** Add `@@unique([timelineId, hour])` to `TimeBlock` so "no more than 8 blocks per day" is enforced at the database level, not just in application code, and so "fill this hour" is a clean upsert.
3. **Blocks start empty.** An hour slot with no `TimeBlock` row renders as an empty slot with an "Add task" affordance — matches the schema (title is required, so we don't pre-create 8 blank rows with fake titles).
4. **Date navigation**: `?date=YYYY-MM-DD` query param on `/timeline`, defaulting to today (server-local date) when absent. Prev/Day/Next controls update the query param — no calendar picker, no external calendar sync (explicitly out of scope per AGENTS.md).
5. **Reordering** = swap the `hour` of two adjacent blocks via up/down buttons on each filled block (simplest way to reorder within a fixed 8-slot grid; no drag-and-drop library introduced).
6. **Summary**: a small header stat showing "X/8 completed", "Y planned", "Z in progress", computed client-side from the fetched blocks — no new endpoint needed.
7. Creating/updating a block is a single upsert endpoint keyed by `(date, hour)` rather than separate "create for empty hour" vs "edit existing" endpoints — simpler client code, and naturally respects the new unique constraint.

## Expected files

- `prisma/schema.prisma` — add the two `@@unique` constraints (then `npx prisma db push`)
- `src/app/api/timeline/route.ts` — GET `?date=YYYY-MM-DD` (find-or-create the day's Timeline, return it with its blocks ordered by hour)
- `src/app/api/timeline/blocks/route.ts` — POST (upsert a block for `{ date, hour, title, description?, status, priority }`, scoped to user's timeline for that date)
- `src/app/api/timeline/blocks/[id]/route.ts` — PATCH (update status/priority/title/description), DELETE (clear the slot), and a `PATCH .../swap` style handled via a `reorder` route — see below
- `src/app/api/timeline/blocks/[id]/reorder/route.ts` — POST `{ direction: "up" | "down" }`, swaps `hour` with the adjacent block (or moves into an empty adjacent slot)
- `src/app/(dashboard)/timeline/page.tsx` — reads `date` search param, renders `TimelineView`
- `src/components/timeline/TimelineView.tsx` — new, date nav header + summary stat + 8-slot grid
- `src/components/timeline/TimeBlockSlot.tsx` — new, renders a filled or empty hour slot, opens `TimelineForm` inline for add/edit
- `src/components/forms/TimelineForm.tsx` — implement add/edit form for a single block (title, description, status, priority)
- `src/lib/query-keys.ts` — add a `timeline(date)` key factory

## Requirements

- All routes call `auth.api.getSession`; `401` if missing.
- Every Prisma query scoped to `userId: session.user.id` (via the owning `Timeline.userId`, verified with `findFirst` before block writes).
- `timeBlockSchema` validates `hour` (0-7), `title`, `status`, `priority` server-side before any write.
- GET `/api/timeline` upserts the `Timeline` row for `(userId, date)` — never creates a second row for the same day (relies on the new unique constraint + `upsert`).
- Reorder endpoint rejects out-of-range moves (hour 0 can't move up, hour 7 can't move down) with `400`.
- Empty state per slot vs filled state are visually distinct; status/priority shown as small text/color, no new badge component required.

## Security considerations

- Session + userId scoping identical to the portfolio page's pattern.
- `date` query param parsed and validated (reject malformed dates) before being used in a Prisma query.
- Block IDs are verified to belong to the requesting user's own Timeline before update/delete/reorder — prevents cross-user tampering via guessed IDs.

## Acceptance criteria

- Visiting `/timeline` while logged out redirects to `/` (existing middleware, unaffected).
- Logged in, `/timeline` shows today's date and 8 empty slots (hour 0 through 7) on first visit.
- Filling a slot with a task persists it; reloading the page shows the same data.
- Editing a filled slot's status/priority/title persists.
- Deleting a filled slot returns it to the empty state.
- Attempting to fill a 9th slot is impossible by construction (only 8 hour slots are ever rendered).
- Reordering (up/down) swaps two blocks' positions and persists after reload; boundary slots (0 and 7) don't allow moving further out.
- Prev/Next day navigation loads a different day's (initially empty) timeline.
- Summary stat reflects the current day's block statuses correctly.

## Checks to run

1. `npx prisma db push` (apply the two new unique constraints)
2. `npm run lint`
3. `npm run typecheck`
4. `npm run build`
5. `npm run dev` + manual browser/API test of the flows above

## Manual test steps

1. `npm run dev`, log in.
2. Go to `/timeline` — confirm today's date and 8 empty slots.
3. Fill hour 2 with a task ("Deep work", status planned, priority high) — confirm it appears, reload, confirm it persists.
4. Edit it to status "completed" — confirm summary stat updates (e.g., "1/8 completed").
5. Fill an adjacent hour (3), then move hour 2's block down — confirm the two swap and persist after reload.
6. Try moving the hour-0 block up and the hour-7 block down — confirm both are no-ops (button disabled or rejected).
7. Delete a filled block — confirm it returns to empty state.
8. Navigate to the next day — confirm a fresh, empty 8-slot timeline (independent of today's).
9. Log out, hit `/timeline` directly, confirm redirect to `/`.
