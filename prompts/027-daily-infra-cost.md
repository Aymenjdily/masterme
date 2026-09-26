# Daily infra cost + Recalculate button

## Goal

Calculate each project's infra cost **once a day**, store it in the database, and add a **Recalculate** button to `/projects`. The pages then show stored values (fast, same number everywhere) with an "updated …" time, instead of calling Neon on every page load.

## Skills read

- `.opencode/skills/nextjs.md`, `prisma.md`, `react.md`, `typescript.md`

## Code inspected

- `src/lib/neon.ts`: `getNeonProjectCostEstimate` computes the month-to-date cost from usage. There's a 5-minute cache for the picker only.
- `api/projects/[id]/neon-cost` calls Neon live for each card.
- `api/monthly-costs/apps-summary` calls Neon live for every linked project, plus the flat $20 for Vercel.
- `ProjectCard`: Infra shows linked monthly costs if there are any, otherwise the live Neon estimate.
- `ProjectsView`: the "Monthly infra" total adds linked costs **and** every Neon estimate, which double-counts when a project has both.
- Scheduled jobs: `vercel.json` crons + `CRON_SECRET`-protected GET routes (`/api/jobs/scrape`, `/api/news/fetch`), with a script twin for local runs.

## Decisions and assumptions

1. **New table `InfraCostSnapshot`** (scoped to the user):
   - Fields: `userId`, `projectId`, `day` (date), `neonUsd`, `createdAt`.
   - Unique per project and day: running it again on the same day replaces that day's value, so there are no duplicates.
   - You get a daily history for free; a trend chart can use it later.
   - Needs `npx prisma db push`, which only adds a table.
2. **What gets calculated:** only the part that changes, the Neon usage estimate.
   - Vercel stays the flat $20, counted once.
   - Linked monthly costs are already in the database.
3. **Daily job:** `GET /api/infra/recalculate` with the `CRON_SECRET` check, added to `vercel.json` at `0 5 * * *` (before jobs and news), for all users. Plus `npm run infra:recalc` for local runs.
4. **Recalculate button** on `/projects`, next to the "Monthly infra" stat, showing "Updated today 05:00".
   - `POST /api/infra/recalculate` (session): recalculates only your projects, then refreshes the page data.
   - Limited to once per minute. It shows a spinner while running, then "Updated just now".
5. **Pages read the stored values:**
   - Cards show the latest snapshot ("~$X").
   - The "Monthly infra" total and the Monthly cost page's Apps & services summary use the same stored numbers.
   - The per-card live Neon call is removed.
6. **Double counting fixed:** the total follows the card's rule for each project (linked costs if there are any, otherwise the Neon estimate), plus Vercel once.
7. **Failures:** if Neon fails for a project, its last good value is kept and marked "stale" on hover; the button reports "1 project couldn't be updated".
8. **New projects:** saving a project with a Neon link calculates its first value right away, so it doesn't wait until tomorrow.

## Expected files

- `prisma/schema.prisma`: `InfraCostSnapshot` (+ relations on `User` and `Project`)
- `src/lib/infra-cost.ts` (recalculate for a user / for all users; read the latest per project)
- `src/app/api/infra/recalculate/route.ts` (GET cron, POST session)
- `scripts/recalc-infra.ts` + `package.json` script `infra:recalc`
- `vercel.json` (new cron)
- Edits: `ProjectCard`, `ProjectsView` (button, updated time, total rule), `api/monthly-costs/apps-summary`, `api/projects` (+ `[id]`) (first value when a Neon link is set). The `api/projects/[id]/neon-cost` route is removed once nothing uses it.

## Security considerations

- Cron route: `CRON_SECRET` only. POST: session only, recalculates only your own projects.
- `NEON_API_KEY` stays on the server.

## Acceptance criteria

- `/projects` loads without calling Neon and shows the stored value plus an "Updated …" time.
- Recalculate updates the values and the time. Running it twice in a day keeps one row per project per day.
- The total no longer double-counts, and the Projects and Monthly cost pages show the same numbers.
- Lint shows no new errors; typecheck and build pass; the schema is pushed.

## Checks to run

`npx prisma db push` (with your OK), `npm run lint`, `npm run typecheck`, `npm run build`, `npm run infra:recalc`, a curl of the cron route with and without the secret, and a browser check of the button.

## Manual test steps

1. Open `/projects`: cards show "~$X" and the stat shows "Updated …".
2. Click **Recalculate**: spinner, then "Updated just now"; the numbers match Monthly cost.
3. Run `npm run infra:recalc`, then check `InfraCostSnapshot` in `npm run db:studio`: one row per Neon project for today.
4. Link a Neon project to another project: its cost appears right away.
