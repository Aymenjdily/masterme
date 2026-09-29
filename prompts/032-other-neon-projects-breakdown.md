# Other Neon projects: per-project breakdown

## Goal

In Apps & services on `/monthly-cost`, the "Other Neon projects (29)" row opens like a dropdown and lists each unlinked Neon project with its name and its cost this billing period.

## Skills read

`.opencode/skills/prisma.md`, `nextjs.md`, `react.md`, `tailwind.md`; prompt 031.

## Code inspected

- `src/lib/neon.ts`:
  - `getNeonAccountUsage()` already returns per-project costs for all 36 projects, but by Neon id only, with no names;
  - `listNeonProjects()` holds the id → name lookup.
- `src/lib/infra-cost.ts`: `NeonAccountSnapshot` keeps only the account totals, so the per-project figures for the unlinked projects are lost after the recalculation.
- `api/monthly-costs/apps-summary`: `other` is `{ count, totalUsd }`.
- `AppsServicesSummary.tsx`: `other` is a static row.

## Decisions

1. **Schema:** `NeonAccountSnapshot` gets a `projects Json @default("[]")` column holding `[{ id, name, totalUsd }]` for every Neon project. Adding it is additive, pushed with `npx prisma db push`.
2. **Names:** the recalculation also calls Neon's project list once (the same call the "Link Neon project" picker uses) and stores each project's name. If that call fails, the Neon id is shown instead of the name.
3. **Route:** `other.items` = the snapshot projects not linked to a MasterMe project, sorted by cost (highest first).
4. **UI:**
   - the "Other Neon projects (29) · $15.68" row becomes a button with a chevron; clicking it expands an indented list: name on the left, `$x.xx / mo` on the right;
   - projects at $0.00 are grouped into one muted line, "n projects at $0.00", so the list stays short;
   - the row starts collapsed;
   - it uses the existing row styles, with no new component library.
5. **Stored readings only:** nothing on this page calls Neon directly.

## Expected files

`prisma/schema.prisma`, `src/lib/neon.ts`, `src/lib/infra-cost.ts`, `src/app/api/monthly-costs/apps-summary/route.ts`, `src/components/monthly-cost/AppsServicesSummary.tsx`

## Security

`NEON_API_KEY` stays on the server. The snapshot is scoped to the user.

## Acceptance criteria

- After Recalculate, clicking "Other Neon projects" lists each unlinked project with its cost.
- The listed costs add up to the row total (± rounding).
- Typecheck and lint are clean.

## Checks

`npx prisma db push`, `npm run infra:recalc`, `npm run typecheck`, `npm run lint`

## Manual test

1. Restart the dev server, go to /projects and click ↻ Recalculate.
2. On /monthly-cost → Apps & services, click "Other Neon projects (29)": the list opens with names and prices; click again and it closes.
