# Neon: real account cost in Apps & services

## Goal

Make the Neon cost match the Neon bill. Today MasterMe estimates cost only for the 6 Neon projects linked to a MasterMe project, from a rough per-project reading ($27.18, while Neon shows $53.12). This change reads Neon's own daily usage for **all** projects in the account and shows the real account total, the project count and the linked breakdown in Apps & services on `/monthly-cost`.

## Skills read

`.opencode/skills/prisma.md`, `nextjs.md`, `react.md`; prompt 027 (daily infra cost).

## Code and data inspected

- `src/lib/neon.ts`: per-project estimate from `GET /projects/{id}` usage fields; org lookup.
- `src/lib/infra-cost.ts`: daily snapshots per linked project, the Recalculate button and the cron.
- `api/monthly-costs/apps-summary`, `AppsServicesSummary`, `ProjectsView` (Monthly infra), dashboard `MoneyWidget`.
- **Neon API with your key:**
  - org `aymen`, **Launch** plan;
  - `GET /consumption_history/v2/projects?granularity=daily&metrics=…` works on Launch and returns 36 projects;
  - `/consumption_history/projects` (v1) is Scale-only;
  - `/billing/*` isn't allowed for org keys.
- **Check with this month's v2 usage:** compute 498.6 CU-h × $0.106 = $52.85, plus storage 0.80 GiB-month × $0.35 = $0.28, gives **$53.13**. Neon shows $53.12.

## Decisions

1. **New `getNeonAccountUsage()`:** v2 consumption for the current billing period, daily granularity, all projects (paginated). For each project, and for the whole account:
   - compute: `compute_unit_seconds` / 3600 × $0.106;
   - storage: (`root_branch_bytes_month` + `child_branch_bytes_month`) / GiB × $0.35;
   - restore history: `instant_restore_bytes_month` / GiB × $0.20;
   - transfer: public transfer beyond the free allowance × $0.10.
   - The prices stay as constants in `neon.ts`; `extra_branches_month` is not charged, which matches the bill.
2. **Daily job and Recalculate** use this one call for everything:
   - per-project snapshots (linked projects) get the exact v2 figure;
   - a new **`NeonAccountSnapshot`** row stores the account total, compute, storage, project count and period start, one per user per day (unique), replaced when recalculated the same day;
   - if v2 fails, it falls back to the old per-project estimate and marks the value stale.
3. **Apps summary:**
   - Neon total = the account total, minus the Neon usage of projects that have linked monthly costs (those are already counted by the linked cost, as before);
   - the items are the linked projects plus **"Other Neon projects (n)"** for the rest;
   - it returns `accountProjects` and `linkedProjects`.
4. **UI:** Apps & services shows "Neon account · 36 projects · 6 linked", each linked project, the "Other Neon projects" row, and **Total apps & services**. The Projects "Monthly infra" and dashboard totals follow the same numbers.
5. **Schema:** a new table, pushed with `npx prisma db push`; nothing existing changes.

## Expected files

`prisma/schema.prisma`, `src/lib/neon.ts`, `src/lib/infra-cost.ts`, `src/app/api/monthly-costs/apps-summary/route.ts`, `src/components/monthly-cost/AppsServicesSummary.tsx`

## Security

`NEON_API_KEY` stays on the server. Snapshots are scoped to the user.

## Acceptance criteria

- After Recalculate, the Neon total on /monthly-cost is within a few cents of Neon's dashboard.
- The card shows the project count, the linked projects and the other projects.
- Projects "Monthly infra" = Neon account + Vercel.
- Typecheck and lint are clean; the schema is pushed.

## Checks

`npx prisma db push`, `npm run typecheck`, `npm run lint`, `npm run infra:recalc`, then compare the total with Neon's billing page.

## Manual test

1. /projects → ↻ Recalculate.
2. /monthly-cost → Apps & services: the Neon total ≈ Neon's dashboard, "36 projects · 6 linked", "Other Neon projects (30)".
