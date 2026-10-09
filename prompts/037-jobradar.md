# 037 — JobRadar: Apify-powered job collection for Morocco + France

> Approved decisions (2026-10-09):
> 1. Phase 1 approved for build.
> 2. Apify is the primary source; the old guest-endpoint scraper is kept as a
>    manual fallback (`npm run scrape:jobs`), not deleted.
> 3. Notification channel = **email** (P4).
> 4. UI: no reference images — Phase 3 UI follows the app's existing
>    Tailwind/shadcn patterns (Jobs page conventions).

## Goal

Upgrade the existing jobs feature into JobRadar: automatic job discovery via the Apify
LinkedIn Jobs Scraper actor (`curious_coder/linkedin-jobs-scraper`, actor ID
`hKByXkMQaC5Qt9UMN`) for Morocco and France, deterministic match scoring against the
user's profile, quota/budget enforcement, and Telegram notifications. Existing
application tracking (JobOffer/JobApplication/RecruiterContact) stays and gets extended.

This is a personal, single-user project. No multi-tenant complexity.

## Skills read

- `.opencode/skills/nextjs.md` (App Router, server action boundaries)
- `.opencode/skills/prisma.md` (schema, unique constraints, transactions)
- `.opencode/skills/typescript.md`, `.opencode/skills/react.md`, `.opencode/skills/tailwind.md`
- AGENTS.md

## Code inspected

- `prisma/schema.prisma` — `JobOffer` (@@unique [userId, url]), `JobApplication`,
  `RecruiterContact`, `User.skills` (used as current search terms)
- `src/lib/scraper-linkedin.ts` — current guest-endpoint scraper (Morocco only,
  no France, no scoring)
- `src/lib/job-matcher.ts` + `scripts/scrape-jobs.ts` — current offline ingestion
- `src/components/jobs/*` — current JobsView, ApplicationRow, RecruiterCard
- `src/lib/validations.ts` — job offer status enum:
  `new | applied | interviewing | rejected | accepted`
- `.env.example` — has `CRON_SECRET` pattern to reuse for `APIFY_TOKEN`
- Latest prompt file is 036; this is 037

## Apify actor verified (not assumed)

- **Actor**: `curious_coder/linkedin-jobs-scraper` (`hKByXkMQaC5Qt9UMN`)
- **Pricing**: pay-per-event, **$1.00 per 1,000 results** (cheaper at higher Apify
  plans). Apify platform usage billed separately. So cost scales with results
  retrieved — 200 results/day ≈ $0.20/day ≈ ~$6/month at list price.
- **Input**: `urls[]` (LinkedIn search URLs) **or** AI filters (`keywords`,
  `location`, `datePosted`); `limitPerSource` (per URL/search max) — this is where
  per-search result limits are applied at the actor level; `scrapeCompany` adds
  extra requests → keep `false` to save cost; `workRemoteAllowed`, `employmentType`
  come back per job.
- **Output**: `id`, `link`, `title`, `companyName`, `location`, `postedAt`,
  `descriptionText`, `employmentType`, `workplaceTypes`, `workRemoteAllowed`,
  `salaryInfo`, `seniorityLevel`, `applyUrl`. Validate with Zod; never trust shape.
- Cost/usage: read run usage from the Apify API (`run{name,status,costTotalUsd? }`
  via `GET /v2/actor-runs/{runId}`) when available; if not reliable, show "unknown".

## Decisions and assumptions

1. **Supersedes AGENTS.md decision #6** (Morocco-only): target markets are now
   Morocco + France, per the user's request.
2. **Apify replaces the guest-endpoint LinkedIn scraper** as the primary source.
   `scraper-linkedin.ts` (guest) is kept only as a manual fallback script until Apify
   is validated, then optional to delete; Indeed scraper stays untouched for now
   (not part of this feature).
3. Extend the **existing `JobOffer` table** instead of creating a parallel `Job`
   table — one place for jobs avoids two sources of truth in the dashboard.
4. New supporting tables: `JobRadarConfig` (profile, queries, quotas, weights,
   budget, timezone, schedule), `JobSearch`, `CollectionRun`, `DailyUsage`,
   `Notification` (dedup + history). Match score/explanation/reasons stored **on
   JobOffer** (score, scoreReasons Json, matchedSkills, missingSkills) rather than a
   separate JobMatch row per user-job.
5. Matching is deterministic only (no LLM, no cost). Match levels configurable.
6. Application status enum extended to
   `new | interested | to_apply | applied | interviewing | offer | rejected | archived`
   — existing applications migrate (`applied`→`applied`, `accepted`→`offer`).
7. Schedule: external cron hitting a bearer-token-protected server route every 6h
   (`CRON_SECRET` pattern), same as existing ingestion; script wrapper also kept
   for manual runs. Server-side quota/budget checks prevent overlap and overrun.
8. Telegram notifications first channel (simple bot API, one chat id in env/settings).
9. localStorage-based browser settings stays for UI prefs only; all quotas/budget/
   profile live in DB and are enforced server-side.

## Expected files

- `prisma/schema.prisma` — new models + JobOffer fields + status enum update; migration
- `src/lib/apify-jobs.ts` — Apify client wrapper (run actor, fetch dataset, fetch run cost)
- `src/lib/jobradar/normalize.ts` — Zod schemas, normalize Apify items, dedupe keys
- `src/lib/jobradar/matcher.ts` — deterministic scoring, weights, reasons
- `src/lib/jobradar/collector.ts` — quota/budget checks, run orchestration, persist with
  transactions, logging into CollectionRun/DailyUsage
- `src/lib/jobradar/notify.ts` — Telegram notification builder/sender + dedup
- `src/lib/validations.ts` — extended job schemas
- `src/app/api/jobradar/collect/route.ts` — bearer-token POST route for cron
- `scripts/jobradar-collect.ts` — manual test run (`npm run jobradar:collect`)
- Settings + Jobs UI updates: profile/config editors, feed with match score, filters,
  usage/cost panel ( extend `JobsView`, new components under `src/components/jobs/`)
- `src/lib/query-keys.ts` additions as needed
- `.env.example`: `APIFY_TOKEN=`, `TELEGRAM_BOT_TOKEN=`, `TELEGRAM_CHAT_ID=`
- Update `src/lib/scraper-linkedin.ts` header comments (fallback role)

## Requirements

- Per-search `limitPerSource` at actor level; independent Morocco/France daily quotas
  enforced server-side before each run (DailyUsage per country per day, configurable
  timezone); max results per search configurable.
- Monthly budget cap with safety margin; collection suspends itself when budget is
  reached or cost is un-verifiable; app remains fully usable while paused.
- Dedupe by external job ID (`id`) when present; fallback normalized URL + company +
  title; a job found via multiple searches appears once.
- Match score 0–100 from weighted factors: title relevance, skill match, experience,
  location compatibility, remote compatibility, employment type, recency; reasons
  always displayed; missing info never auto-rejects; visible explanation stored.
- Notifications only for new jobs above configurable threshold, never duplicates,
  include title/company/location/country/score/reasons/link.
- Never auto-apply; never store full HTML descriptions (store `descriptionText`).
- Apify token never leaves the server; no browser calls to Apify.
- LinkedIn search URLs for configured queries are built from keywords + location
  (`f_TPR` last-24h filter); queries stored per country in JobSearch.

## Security

`APIFY_TOKEN`, `TELEGRAM_BOT_TOKEN`, DB creds server-only via env; collect route
protected by `CRON_SECRET` bearer token; Zod-validated Apify responses; timeouts +
error capture recorded in CollectionRun; no secrets committed.

## Acceptance criteria

- Configurable searches for Morocco and France exist and are editable in Settings.
- A test run with 1 search × small limit stores normalized jobs with source=linkedin-
  apify, dedup works across repeated runs (no growth on re-run).
- Quota block: second same-country run same day outside quota is refused and logged.
- Jobs scored with visible reasons; filters work (country, remote, score, status).
- Status values extended and old data migrated.
- One Telegram notification per qualifying new job, no duplicates.
- Collector logs Apify run id, results, cost (or "unknown"), failures.
- `npm run lint`, `npm run typecheck`, `npm run build` pass.

## Checks to run

1. `npx prisma migrate dev` (or `db:push` + generate) — schema applies cleanly
2. `npm run lint`
3. `npm run typecheck`
4. `npm run build`
5. `npm run jobradar:collect` — one small manual test (1 search, limit ~10) with
   real APIFY_TOKEN, verify: rows created, second run saves 0 new (dedup), run logged
6. Verify quota/budget refusal paths via forced low limits
7. Verify protected route rejects without bearer token
8. Verify Telegram notification for threshold job, no re-notify on re-run

## Manual test steps

1. Settings → JobRadar tab: set Morocco quota 10, France 10, budget $5, save.
2. Run collect once; check feed for new jobs with scores/reasons.
3. Run collect again same day: usage counters visible, dedup (no new rows).
4. Wait/force exceed quota: run refused, logged, dashboard still usable.
5. Open a job: description, match explanation, apply link; set status to "apply".
6. Existing features regression: old jobs, applications, recruiters still visible.

## Out of scope

Indeed/Apify Indeed integration, email channel, France eligibility heuristics beyond
location filters, LLM-based matching, multiple users.

## Phases (separate approval each)

- **P1**: schema + config + Apify wrapper + normalize/dedupe + collector + quota/budget
- **P2**: matcher + tests (Vitest not currently installed — install as devDependency)
- **P3**: UI (needs desktop reference images from you before building)
- **P4**: notifications + cron wiring + cost panel polish
