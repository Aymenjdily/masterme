# Jobs Page: LinkedIn Morocco ingestion + skill matching + Jobs/Follow-up tabs

## Goal

Build `/jobs` with two tabs — **Jobs** (scraped LinkedIn offers for Morocco, filtered to the user's skills) and **Follow-up** (applications + recruiter contacts). Add a real (best-effort) LinkedIn scraper and a per-user skills list to match against.

## Skills read

- `.opencode/skills/nextjs.md`, `prisma.md`, `tailwind.md`, `react.md`, `typescript.md`
- Same Route Handler / TanStack Query conventions established in the portfolio and timeline builds.

## Code inspected

- `prisma/schema.prisma` — `JobOffer`, `JobApplication`, `RecruiterContact`, `User` all exist. `User` has no `skills` field. `JobOffer` has no unique constraint to prevent duplicates.
- `src/app/(dashboard)/jobs/page.tsx`, `src/components/forms/JobOfferCard.tsx`, `src/lib/scraper-linkedin.ts`, `src/lib/scraper-indeed.ts`, `src/app/api/jobs/scrape/route.ts` — all scaffolded, empty/`501`.
- `src/app/(dashboard)/settings/page.tsx` — scaffolded, empty.
- `src/lib/validations.ts` — `jobOfferSchema`, `jobApplicationSchema`, `recruiterContactSchema` already defined.
- `src/components/ui/` — no `Tabs` component. `@base-ui/react` (already a dependency, used for `Button`/`Input`) ships a `Tabs` primitive — will wrap it the same way `button.tsx`/`input.tsx` wrap their primitives, rather than pulling in a new UI library.
- No HTML-parsing library (`cheerio`) installed yet — needed for scraping.
- Package scripts already include `seed` (`tsx scripts/seed.ts`) as the pattern for a standalone script run outside the request lifecycle.

## Decisions and assumptions (please confirm before I build)

1. **LinkedIn source**: fetch LinkedIn's public "guest" job-search endpoint (`https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=...&location=Morocco&start=...`) — no login/session cookies, no account-ban risk. This is the same endpoint LinkedIn's own public job-search page calls for pagination. **Caveat, per AGENTS.md's own warning**: this is unofficial, undocumented, and LinkedIn can change its markup or start blocking the User-Agent at any time — this is explicitly a best-effort integration, not a guaranteed one. I'll add a realistic User-Agent and small delays between requests, and log+skip on failure rather than retrying aggressively.
2. **Skills-based matching = one search per skill.** For each of the user's configured skills, run a LinkedIn search with `keywords=<skill>&location=Morocco`, merge and de-duplicate results by URL. A job "matches" if it shows up under any of the user's skills — simplest correct interpretation of "jobs that match my skills," no scoring/ranking model.
3. **Morocco scoping** relies primarily on LinkedIn's own `location=Morocco` filter; add a safety-net check that the scraped location string contains "Morocco" or is empty (LinkedIn sometimes omits it), dropping anything that clearly isn't Morocco (e.g. a different country name appears).
4. **No full descriptions stored** (per AGENTS.md) — the guest search endpoint doesn't return full descriptions anyway; store the title/company/location/url/posted-date only, `description` left null. Fits the existing schema.
5. **Dedup**: add `@@unique([userId, url])` to `JobOffer`; scraper does `createMany({ skipDuplicates: true })` (or a manual existence check) keyed on that.
6. **Scraping is not triggered from the browser.** Per AGENTS.md ("should not require user interaction to trigger", "runs on a schedule"): the scrape logic lives in `src/lib/scraper-linkedin.ts` + `src/lib/job-matcher.ts`, invoked by:
   - `scripts/scrape-jobs.ts` (new, same pattern as `scripts/seed.ts`) — runs for every user who has at least one skill configured; runnable via `npm run scrape:jobs`, meant to be wired into an OS/CI scheduler (cron, Windows Task Scheduler, GitHub Actions) since this app has no deployed serverless cron yet.
   - `POST /api/jobs/scrape` — reimplemented to require a `Authorization: Bearer <CRON_SECRET>` header (new env var) instead of a user session, so it can be safely called by an external scheduler without a logged-in browser. **No "Sync now" button in the UI** — matches the explicit "not on-demand" rule.
7. **Skills live on `User.skills String[]`** (default `[]`), edited on the (currently empty) Settings page via a small tag-list editor. Minimal scope: add/remove a skill string, nothing else added to Settings right now.
8. **Follow-up tab** shows: (a) `JobApplication` list (joined with its `JobOffer` for title/company), with editable `followUpNotes` and `status`; (b) a separate `RecruiterContact` list (add/edit/delete), matching the existing data model — no forced linking between an application and a specific recruiter contact beyond the existing schema (`JobApplication` has no `recruiterContactId` field currently, so I'm not adding one — recruiter contacts are tracked as their own list, same as portfolio's pattern).
9. **Applying** = clicking "Apply" on a `JobOffer` in the Jobs tab creates a `JobApplication` (`applicationDate: now`) and flips the offer's `status` to `"applied"` in one action — avoids a separate "mark as applied" step.

## Expected files

- `prisma/schema.prisma` — add `skills String[] @default([])` to `User`; add `@@unique([userId, url])` to `JobOffer`
- `src/lib/scraper-linkedin.ts` — real implementation (cheerio parse of the guest search endpoint, per-skill search, Morocco safety-net filter)
- `src/lib/job-matcher.ts` — new, orchestrates "for this user's skills, fetch + dedupe + save new offers"
- `scripts/scrape-jobs.ts` — new, iterates all users with skills, calls the matcher, logs a summary
- `src/app/api/jobs/scrape/route.ts` — `POST`, bearer-token protected (not session-protected)
- `src/app/api/jobs/route.ts` — `GET` (list current user's offers, optional `?status=`)
- `src/app/api/jobs/[id]/route.ts` — `PATCH` (status), `DELETE` (dismiss)
- `src/app/api/job-applications/route.ts` — `GET` (list, joined with offer), `POST` (create + flips offer status)
- `src/app/api/job-applications/[id]/route.ts` — `PATCH` (status/followUpNotes), `DELETE`
- `src/app/api/recruiter-contacts/route.ts` + `[id]/route.ts` — same CRUD pattern as portfolio links/social apps
- `src/app/api/user/skills/route.ts` — `PATCH` (replace the current user's skill list)
- `src/components/ui/tabs.tsx` — new, thin wrapper over `@base-ui/react`'s `Tabs`, styled like the rest of `components/ui`
- `src/app/(dashboard)/jobs/page.tsx` — tabs shell (Jobs / Follow-up)
- `src/app/(dashboard)/settings/page.tsx` — skills editor
- `src/components/jobs/JobsTab.tsx`, `FollowUpTab.tsx`, `RecruiterContactList.tsx` — new
- `src/components/forms/JobOfferCard.tsx` — implement (offer display + Apply/status actions)
- `.env.example` — add `CRON_SECRET`

## Requirements

- Every route session-scoped to `userId` except `/api/jobs/scrape`, which is bearer-token-scoped and loops over all users server-side (never trusts a client-supplied userId).
- `jobOfferSchema`/`jobApplicationSchema`/`recruiterContactSchema` validate all writes.
- Scraper never blocks a page request — only invoked by the script/cron path.
- Scraper failures (network error, markup change) are caught, logged, and skipped per-skill — one bad skill search doesn't abort the whole run.

## Security considerations

- `CRON_SECRET` read from env, compared with a constant-time-safe check is unnecessary here (low-value secret, single-user app) but still never logged or exposed to the client.
- No LinkedIn credentials/cookies anywhere — the whole point of the guest-endpoint approach.
- Standard session + userId scoping on every user-facing route.

## Acceptance criteria

- Settings page: add/remove skills, persists.
- Running `npm run scrape:jobs` (with at least one skill configured) populates `JobOffer` rows with `source: "linkedin"`, Morocco-scoped, status `"new"`, deduplicated on re-run.
- `/jobs` Jobs tab lists those offers, can filter by status, "Apply" creates a `JobApplication` and flips status.
- `/jobs` Follow-up tab shows applications (with offer title/company) and a separate recruiter-contacts manager; editing follow-up notes persists.
- `/api/jobs/scrape` rejects requests without the correct bearer token (`401`), and is not reachable/callable from any page in the app.

## Checks to run

1. `npm install cheerio`
2. `npx prisma db push` (additive `skills` column; `@@unique([userId, url])` on `JobOffer` — will show you the exact command since a uniqueness constraint on a table that likely has no rows yet, but I'll verify row count first as before)
3. `npm run lint`
4. `npm run typecheck`
5. `npm run build`
6. `npm run dev` + manual test of tabs, skills editor, and API flows
7. `npm run scrape:jobs` against your real skills, inspect what actually comes back from LinkedIn (this is the part most likely to need iteration — I'll report exactly what it finds, including if the guest endpoint returns nothing or gets blocked)

## Manual test steps

1. Go to `/settings`, add skills (e.g. "React", "Next.js").
2. Run `npm run scrape:jobs` from a terminal — check console summary (offers found/saved per skill).
3. Go to `/jobs` → Jobs tab, confirm offers appear, filter by status.
4. Click Apply on one offer — confirm it moves to `applied` and shows up in Follow-up tab.
5. Add a follow-up note, confirm it persists.
6. Add/edit/delete a recruiter contact in Follow-up tab.
7. Re-run `npm run scrape:jobs` — confirm no duplicate offers created.
8. `curl -X POST http://localhost:3000/api/jobs/scrape` without a bearer token — confirm `401`.
