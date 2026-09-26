# Timeline: ask wake-up hour, generate 8 blocks from it

## Goal

Change the timeline flow so that each day, the first thing the user does is set their wake-up hour; the 8 hour slots are then generated starting from that hour (e.g. wake at 07:00 → slots show 07:00–14:00) instead of the current fixed 00:00–07:00 labeling.

## Skills read

- Same as `prompts/002-timeline-page.md` (Next.js, Prisma, Tailwind, React, TypeScript skills; Route Handlers + TanStack Query conventions already established).

## Code inspected

- `prisma/schema.prisma` — `Timeline` currently has no `wakeUpHour` field. `TimeBlock.hour` is currently used both as (a) the storage slot / sort key and (b) the displayed clock hour (`00:00` to `07:00`).
- `src/app/api/timeline/route.ts` — `GET` currently **auto-upserts** a `Timeline` row for any requested date, with no concept of "not yet configured."
- `src/components/timeline/TimelineView.tsx`, `TimeBlockSlot.tsx` — render 8 slots labeled `String(hour).padStart(2,"0")+":00"`, i.e. slot index == clock hour today.
- `src/lib/date.ts` — date param validation/parsing helpers, reusable as-is.

## Decisions and assumptions

1. **`TimeBlock.hour` stays a relative slot index (0-7)**, not a clock hour. This is the key design choice: it means changing the wake-up hour later just **relabels** the 8 slots — it never needs to move, renumber, or touch any `TimeBlock` row. Reordering (swap adjacent slots) is completely unaffected.
2. **`Timeline.wakeUpHour Int?`** (nullable, 0-23) is added to the `Timeline` model. A day's timeline is "not configured" until this is set.
3. **Displayed clock time for slot `i`** = `(wakeUpHour + i) % 24`, formatted `HH:00`. E.g. wake at 22 (10pm, night-shift case), slot 3 displays `01:00` (next day) — modulo handles wraparound; no special-casing needed.
4. **GET no longer silently creates a Timeline row.** `GET /api/timeline?date=` now does a plain `findFirst` (no upsert). If none exists, it returns `{ timeline: null }` and the UI shows a "What time did you wake up?" prompt instead of the 8-slot grid.
5. **New endpoint** `PUT /api/timeline` — body `{ date, wakeUpHour }` — upserts the `Timeline` row for `(userId, date)`, setting/updating `wakeUpHour`. This is what both the initial prompt and a later "edit wake-up hour" action call.
6. **Wake-up hour is editable after the fact** (small "Wake up: 07:00 · Edit" control next to the date nav) — since relabeling is free per decision #1, this is low-cost and matches "ask every day" without being a one-way door if the user misremembers or wants to correct it.
7. Existing block create/update/reorder endpoints (`/api/timeline/blocks*`) are unchanged — they already operate on slot index 0-7 and don't know about clock time.
8. This is a dev database with the timeline feature not yet used in practice (per our last testing session, all test rows were cleaned up) — no backfill/migration logic needed for existing `Timeline` rows without a `wakeUpHour`.

## Expected files

- `prisma/schema.prisma` — add `wakeUpHour Int?` to `Timeline`
- `src/app/api/timeline/route.ts` — change `GET` to `findFirst` (no auto-create); add `PUT` for set/update wake-up hour
- `src/components/timeline/TimelineView.tsx` — branch on `timeline === null` → render `WakeUpPrompt`; otherwise render the date/summary header (now showing wake-up hour + edit control) and the 8-slot grid with clock-time labels derived from `wakeUpHour`
- `src/components/timeline/WakeUpPrompt.tsx` — new, small form: "What time did you wake up?" (hour select 0-23), submits to `PUT /api/timeline`
- `src/components/timeline/TimeBlockSlot.tsx` — accept a `label` (clock time string) prop instead of computing it from `hour` directly
- `src/lib/query-keys.ts` — unchanged (same `timeline(date)` key covers both "unset" and "set" states)

## Requirements

- `PUT /api/timeline` validates `wakeUpHour` is an integer 0-23 (Zod) and requires a session; scoped to `userId`.
- `GET /api/timeline` still requires a session; returns `401` if missing, `400` on invalid date, `{ timeline: null }` (200) when nothing exists yet for that date.
- No behavior change to block CRUD/reorder — still slot-index based, still capped at 8, still session/user-scoped.

## Security considerations

- Same session + userId scoping pattern as every other route in this app; `PUT` verified against `session.user.id`, never a client-supplied `userId`.

## Acceptance criteria

- Visiting `/timeline` for a date with no `wakeUpHour` set shows a wake-up-hour prompt, not an 8-slot grid.
- Submitting a wake-up hour (e.g. 7) immediately shows 8 slots labeled `07:00` through `14:00`.
- Filling/editing/reordering/deleting blocks behaves exactly as before (now just relabeled).
- Editing the wake-up hour to a different value (e.g. 9) instantly relabels all 8 slots to `09:00`–`16:00` **without losing any filled block's content or order**.
- A wake-up hour near the day boundary (e.g. 22) wraps correctly (`22:00, 23:00, 00:00, 01:00, ...`).
- Each new date defaults back to "not configured" (prompt shown) — wake-up hour is per-day, not remembered across days.
- Logged-out access still redirects; cross-user isolation unaffected (unchanged from prior testing).

## Checks to run

1. `npx prisma db push` (adds the nullable `wakeUpHour` column — additive, no data-loss prompt expected, but I will show you the exact command and confirm before running if Prisma's safety gate triggers again)
2. `npm run lint`
3. `npm run typecheck`
4. `npm run build`
5. `npm run dev` + manual test of the flows above (via curl against a temp test account, same as before, then cleanup)

## Manual test steps

1. Visit `/timeline` for a fresh date → confirm wake-up prompt.
2. Submit wake-up hour 7 → confirm slots labeled 07:00–14:00, all empty.
3. Fill slot 2 (label 09:00) with a task → confirm persists on reload.
4. Change wake-up hour to 9 → confirm slots now labeled 09:00–16:00, and the task filled in step 3 is still in the same relative position (still 3rd slot, now labeled 11:00) with its content intact.
5. Navigate to the next day → confirm prompt shown again (not remembered from the previous day).
6. Test wraparound: set wake-up hour to 22 → confirm labels read 22:00, 23:00, 00:00, 01:00, 02:00, 03:00, 04:00, 05:00.
