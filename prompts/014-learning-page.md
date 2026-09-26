# Learning Page — paths and steps

## Goal

Build `/learning` to match `design/learning@2x.png` (source `design/learning.html`): create learning paths, add ordered steps, and track progress. The page is currently empty (`return null`) and has no API routes.

## Skills read

- `.opencode/skills/nextjs.md` (route handlers, typed `RouteContext`), `prisma.md`, `react.md`, `tailwind.md`, `typescript.md`
- Better Auth session pattern from existing routes
- Design system (prompt 010), shared popups from the Portfolio page (prompt 013)

## Code inspected

- `prisma/schema.prisma`:
  - `LearningPath` (userId, title, description?, status) has many `LearningItem` (title, description?, resourceUrl?, status, order), with cascade delete.
- `src/lib/validations.ts` — `learningPathSchema`, `learningItemSchema` (already defined, unused).
- `src/types/index.ts` — `LearningPath`, `LearningItem`.
- `src/lib/status-styles.ts` — `learningStatusVariant`.
- Route patterns: `api/portfolio-links/[id]/route.ts` (ownership check, then update), `api/timeline/blocks/[id]/reorder/route.ts` (swap in a transaction).
- UI: `components/portfolio/shared.tsx` (`FormDialog`, `DeleteDialog`, `EmptyState`), `ui/dialog`, `ui/tabs`, `ui/badge`, `ui/skeleton`.

## Decisions and assumptions

1. **API** (every route checks the session, and every query is scoped to `session.user.id`):
   - `GET /api/learning-paths` returns paths (oldest first) with items ordered by `order`.
   - `POST /api/learning-paths` creates a path.
   - `PATCH /api/learning-paths/[id]` edits the path or changes its status. `DELETE` removes it and its items (cascade).
   - `POST /api/learning-paths/[id]/items` adds a step at the end (`max(order) + 1`).
   - `PATCH /api/learning-items/[id]` edits a step or changes its status. `DELETE` removes it. Ownership is checked through `learningPath.userId`.
   - `POST /api/learning-items/[id]/reorder` with `{ direction: "up" | "down" }` swaps order with the neighboring step (in a transaction).
2. **One query key** (`learningPaths`) for everything. Mutations invalidate it.
   - Step status changes update the cache optimistically, so clicking the circle feels instant.
3. **Selected path** is local state. It defaults to the first path in the current filter.
4. **Status:**
   - Path: active, paused, completed. The header button pauses an active path and resumes a paused one; completed is set from the edit popup.
   - Step: clicking the circle cycles not_started → in_progress → completed → not_started.
5. **Progress** = completed steps / total steps. "Next" = the first step that isn't completed.
6. **Popups:** reuse `FormDialog` / `DeleteDialog` / `EmptyState`, moved from `components/portfolio/shared.tsx` into `components/ui-patterns/` so both pages share them. Status inputs are a small segmented control.
7. An empty `resourceUrl` / `description` from the form is sent as `null` (clears the field). The schemas accept `nullable`.
8. **Responsive:** below `lg` the path list stacks above the detail panel.

## Expected files

- `src/app/api/learning-paths/route.ts`, `[id]/route.ts`, `[id]/items/route.ts`
- `src/app/api/learning-items/[id]/route.ts`, `[id]/reorder/route.ts`
- `src/lib/validations.ts` — nullable optional fields for learning schemas
- `src/lib/query-keys.ts` — `learningPaths`
- `src/components/ui-patterns/dialogs.tsx` — shared `FormDialog`, `DeleteDialog`, `EmptyState`, `SegmentedControl` (moved/added)
- `src/components/learning/LearningView.tsx`, `PathCard.tsx`, `PathDetail.tsx`, `StepRow.tsx`
- `src/components/forms/LearningPathForm.tsx`, `LearningItemForm.tsx`
- `src/app/(dashboard)/learning/page.tsx`

## Security considerations

- Every handler returns 401 without a session and 404 for paths or items that belong to someone else.
- Input is validated with zod. URLs must be valid `http(s)`, and links open with `rel="noreferrer"`.

## Acceptance criteria

- The page matches the reference.
- Creating, editing, pausing/resuming and deleting a path all work.
- Adding, editing, deleting, reordering and cycling the status of a step all work, and progress updates.
- Tabs filter paths; the empty and loading states render.
- Lint shows no new errors; typecheck and build pass.

## Checks to run

`npm run lint`, `npm run typecheck`, `npm run build`, a 401 check on the new routes, and screenshots with sample data.

## Manual test steps

1. Open `/learning` with no data. The empty state shows; click **New path** and create one.
2. Add 3 steps. Click a circle: to do → in progress → done. The progress bar and "Next" update.
3. Move a step up and down. The order persists after a refresh.
4. Pause and resume the path; the tabs filter correctly.
5. Edit and delete a step and the path (confirm popups).
