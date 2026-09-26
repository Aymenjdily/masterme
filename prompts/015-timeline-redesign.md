# Timeline Page Redesign

## Goal

Rebuild `/timeline` to match `design/timeline@2x.png` (source `design/timeline.html`). No API or schema changes: the existing routes (`GET/PUT /api/timeline`, `POST /api/timeline/blocks`, `PATCH/DELETE /api/timeline/blocks/[id]`, `POST .../reorder`) already cover the design.

## Skills read

- `.opencode/skills/nextjs.md`, `react.md`, `tailwind.md`, `typescript.md`
- Prompts 002 and 003 (timeline behavior), 010 (design system), 014 (shared popups, status cycling)

## Code inspected

- `src/app/(dashboard)/timeline/page.tsx` — reads `?date=`, defaults to `todayDateParam()` (UTC date).
- `src/components/timeline/TimelineView.tsx`, `TimeBlockSlot.tsx`, `WakeUpPrompt.tsx`, `src/components/forms/TimelineForm.tsx`.
- `src/lib/validations.ts` — `timeBlockSchema` (hour 0–7 slot index), `timeBlockUpdateSchema`, `wakeUpHourSchema`.
- `src/components/ui-patterns/dialogs.tsx` — `FormDialog`, `DeleteDialog`, `SegmentedControl`.

## Decisions and assumptions

1. **Header:** "Timeline" plus a description on the left. On the right, the date navigator:
   - A **Today** button (disabled when already on today).
   - Prev/next arrows, and the long date with the ISO date in mono.
   - "Today" uses the same server default as before (`todayDateParam`, passed as a prop).
2. **Your day card:**
   - The wake-up chip opens a popup with the hour picker.
   - 8 rows, each with start/end times in mono, a rail dot colored by status, and the block or a dashed **Add task** slot.
   - **Block:** a status circle that cycles planned → in progress → completed (optimistic), the title with a priority tag (HIGH clay, MED neutral, LOW outline), and an optional description.
   - Hover/focus actions: move up/down, edit, clear (with a confirm popup).
3. **NOW:** when the viewed date is today and the browser's current hour matches a slot's clock hour, that block gets the amber outline and a NOW tag and shows in "Right now". Rendered client-side only (blocks load via React Query, so there's no SSR mismatch).
4. **Day progress card:** a ring (completed green plus in-progress amber over 8 slots), counts for completed / in progress / planned / free, "N of 8 filled", and a **Right now** box (hidden if no block is running now).
5. **Wake-up picker:** chips for 05:00–12:00 plus "Pick any hour", which reveals a 24-hour select. Used both on the first visit of the day (full card) and in the edit popup.
6. **Add/edit block:** a centered popup (`FormDialog`) with the slot time range in mono in the description. Fields: Title, Description (textarea), Priority and Status as segmented controls.
7. Styling uses only design tokens; the old palette classes are removed.

## Expected files

- `src/app/(dashboard)/timeline/page.tsx`
- `src/components/timeline/TimelineView.tsx` (rewrite)
- `src/components/timeline/TimeBlockSlot.tsx` (rewrite, presentational row)
- `src/components/timeline/DayProgress.tsx` (**new**)
- `src/components/timeline/WakeUpPrompt.tsx` (rewrite: `WakeUpPicker` + first-visit card)
- `src/components/forms/TimelineForm.tsx` (dialog layout, segmented controls)

## Security considerations

No API changes; the existing routes are already session-scoped. The browser only calls same-origin routes.

## Acceptance criteria

- The page matches the reference.
- All existing behaviors still work: date navigation, wake-up hour (set/edit), add/edit/clear, reorder, 8-block limit.
- Status cycling and the NOW highlight work.
- Lint shows no new errors; typecheck and build pass.

## Checks to run

`npm run lint`, `npm run typecheck`, `npm run build`, and screenshots with sample data (day view, wake-up card, add popup).

## Manual test steps

1. Open `/timeline` on a day without a wake-up hour. Pick 07:00 and click **Generate timeline**.
2. Add tasks in several hours, click circles to change status, and watch the ring update.
3. Move blocks up and down, edit one, clear one (confirm).
4. Use prev/next and **Today**; edit the wake-up hour from the chip.
5. On today's date, the current hour's block shows NOW and appears in "Right now".
