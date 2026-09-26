# Monthly Cost Page Redesign

## Goal

Rebuild `/monthly-cost` to match `design/monthly-cost@2x.png` (source `design/monthly-cost.html`). There are no API or schema changes; the existing `/api/monthly-costs` (CRUD), `/api/monthly-costs/apps-summary` and `/api/projects` cover the design.

## Skills read

- `.opencode/skills/react.md`, `tailwind.md`, `typescript.md`, `nextjs.md`
- Prompt 009 (Neon live cost), 010 (design system), 013/014 (shared popups)

## Code inspected

- `src/app/(dashboard)/monthly-cost/page.tsx` — a client page with a single home-bills total, the apps summary, and home/other sections.
- `src/components/monthly-cost/AppsServicesSummary.tsx` — Neon (estimate) and Vercel lists from the apps summary.
- `src/components/monthly-cost/MonthlyCostSection.tsx` — inline add/edit form, suggestions, delete without confirmation.
- `src/lib/validations.ts` — `monthlyCostSchema` / `monthlyCostUpdateSchema`.
- `ProjectCard` shows linked monthly costs as infra, so the popup hint "Linked costs also show on that project's card" is accurate.

## Decisions and assumptions

1. **Three stat cards:**
   - Apps & services (USD, with an ESTIMATE tag, plus a project count).
   - Home bills and Other (sum of the largest currency as the headline; other currencies listed in the subtitle).
   - Currencies are never converted.
2. **Apps & services card:** a LIVE marker, Neon (estimate) and Vercel groups with per-project rows and totals, and an info hint.
   - Shares one query (`queryKeys.appsSummary`) with the stat card.
3. **Home bills / Other cards:**
   - Rows have an icon and tint picked from the bill name (EN/FR keywords, fallback receipt), notes, a linked-project chip, and the amount in mono.
   - Edit/delete appear on hover or focus.
   - Home also gets "Quick add" chips for the suggestions not yet added, and a total per currency.
   - The empty home state shows all the suggestion chips. "Other" renders only when it has items (as before).
4. **Add/edit:** a centered popup.
   - Fields: Name, Category (Home/Other; an existing `app` cost keeps an "App" option so it isn't silently moved), Amount plus a currency select (MAD/USD/EUR, and any other existing value), Notes, Link to a project.
   - A quick-add chip opens the popup with the name prefilled and focuses the amount.
5. **Delete:** confirmation popup (new; previously it deleted instantly).
6. The old `MonthlyCostSection.tsx` is removed (replaced by `CostList` + `MonthlyCostForm`).

## Expected files

- `src/app/(dashboard)/monthly-cost/page.tsx`
- `src/components/monthly-cost/MonthlyCostView.tsx` (**new**)
- `src/components/monthly-cost/CostList.tsx` (**new**)
- `src/components/monthly-cost/cost-utils.ts` (**new**)
- `src/components/monthly-cost/AppsServicesSummary.tsx` (rewrite)
- `src/components/forms/MonthlyCostForm.tsx` (**new**)
- `src/lib/query-keys.ts` — `appsSummary`
- Deleted: `src/components/monthly-cost/MonthlyCostSection.tsx`

## Security considerations

No API changes. The Neon key stays server-side in the apps-summary route; the browser only calls same-origin routes.

## Acceptance criteria

- The page matches the reference.
- Add/edit/delete (with confirm) work for home and other costs; quick-add prefills the name.
- Totals are per currency; apps show the estimate label.
- Lint shows no new errors; typecheck and build pass.

## Checks to run

`npm run lint`, `npm run typecheck`, `npm run build`, and screenshots with sample data.

## Manual test steps

1. Open `/monthly-cost`. The stats and both cards render with your real data.
2. Click the **Water** chip. The popup opens with "Water" filled in; enter an amount and save.
3. Edit a bill and link it to a project. The project chip appears, and the project card shows the infra cost.
4. Delete a bill (confirm). The totals update.
5. Add a cost with category **Other**. The Other card appears.
