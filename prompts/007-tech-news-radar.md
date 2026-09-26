# Tech News Radar: stack sidebar + GitHub ecosystem activity

## Goal

Build `/news`: a small sidebar listing the user's stack (from Settings → Skills), and clicking one instantly shows GitHub activity (recently-updated repos) for that language/framework — pre-fetched offline so the click itself feels instant, not a live API call.

## Skills read

- Same Next.js/Prisma/Tailwind/React/TypeScript skills and Route Handler/TanStack Query conventions used throughout.

## Code inspected

- `prisma/schema.prisma` — `TechNews` (title, url, source, description?, publishedDate?, tags[]) exists, scoped to user, **no unique constraint** (dedup risk on repeated ingestion).
- `src/lib/github-trending.ts`, `src/lib/tech-news.ts`, `src/app/api/news/fetch/route.ts`, `src/app/(dashboard)/news/page.tsx` — all scaffolded, empty/`501`.
- `src/lib/validations.ts` — `techNewsSchema` already defined.
- `User.skills String[]` already exists (added for job matching) — reused here per your answer, no duplicate "stack" field.
- The job-scraper feature already established the exact pattern this needs: `src/lib/job-matcher.ts` + `scripts/scrape-jobs.ts` (`npm run scrape:jobs`) + bearer-token-protected `POST /api/jobs/scrape` (via `CRON_SECRET`, with a middleware bypass for that one route). This build reuses that pattern verbatim for tech news.

## Decisions and assumptions (per your answers)

1. **Not literally real-time.** An offline script (`npm run news:fetch`, same shape as `scrape:jobs`) fetches GitHub activity per skill ahead of time and stores it. Clicking a stack in the sidebar filters already-loaded data — instant from the user's perspective, but not a live GitHub call on click. This keeps AGENTS.md's "should not scrape in real-time" rule intact.
2. **Stack = `User.skills`**, the same list used for job matching. The sidebar has no separate data entry.
3. **GitHub Trending's `github.com/trending/{language}` only supports actual programming languages** (javascript, python, go, ...), not frameworks — so a skill like "React" or "Next.js" wouldn't work against it. Instead, use **GitHub's public REST Search API** (`GET api.github.com/search/repositories?q=<skill>&sort=updated&order=desc`), which works uniformly for both languages and framework/library names, and sorting by "recently pushed" directly matches "latest updates" better than a stars-based trending list anyway. No scraping needed — this is an official, documented API.
4. **Unauthenticated GitHub API rate limit is low** (10 requests/min for search, 60/hr general). Fine for occasional manual runs of `npm run news:fetch` for one user's skill list, but I'll read an optional `GITHUB_TOKEN` env var if present (raises the search limit to 30/min) — not required to make this work, just a nice-to-have if you hit limits.
5. **Dedup**: add `@@unique([userId, url])` to `TechNews`, same as `JobOffer` — re-running the fetch never creates duplicates.
6. **No star count field added** — keeping the existing schema as-is; `description` stays the repo's own description, `publishedDate` becomes the repo's last-pushed date (the actual "latest update" signal), `tags` stores the matched skill.
7. **Sidebar behaviour**: "All" (default) + one entry per configured skill; clicking one client-side-filters the already-fetched list by tag — no network round-trip per click.

## Expected files

- `prisma/schema.prisma` — add `@@unique([userId, url])` to `TechNews`
- `src/lib/github-trending.ts` — real implementation: `fetchGithubActivity(keyword): Promise<{title, url, description, publishedDate}[]>` via the Search API
- `src/lib/tech-news.ts` — orchestrator (per-user, per-skill fetch + dedupe + save), mirroring `job-matcher.ts`
- `scripts/fetch-tech-news.ts` — new, `npm run news:fetch`
- `src/app/api/news/fetch/route.ts` — `POST`, bearer-token protected (reuses `CRON_SECRET`)
- `src/middleware.ts` — add `/api/news/fetch` to the same bypass list as `/api/jobs/scrape`
- `src/app/api/tech-news/route.ts` — `GET` (list current user's items, optional `?tag=`)
- `src/app/(dashboard)/news/page.tsx` — sidebar + list layout
- `src/components/news/StackSidebar.tsx` — new, "All" + skill list, active state
- `src/components/news/TechNewsList.tsx` — new, repo cards (title, description, last-updated, tag, link out)

## Requirements

- All user-facing routes session/user-scoped; `/api/news/fetch` bearer-token-scoped like `/api/jobs/scrape`, looping server-side over all users with skills.
- `techNewsSchema` validates before any write.
- GitHub API failures per-skill are caught/logged/skipped, never abort the whole run (same resilience pattern as the job scraper).

## Security considerations

- No GitHub credentials required for the base flow; `GITHUB_TOKEN` (if you choose to add one) is read server-side only, never sent to the browser.
- Same session + userId scoping pattern as every other feature.

## Acceptance criteria

- `/news` with no skills configured shows guidance to add skills in Settings.
- After adding skills and running `npm run news:fetch`, the sidebar lists each skill; clicking one filters instantly (no loading spinner, since it's already-fetched data being filtered client-side).
- Re-running `npm run news:fetch` doesn't create duplicate entries.
- Each item links out to the real GitHub repo.

## Checks to run

1. `npx prisma db push` (additive unique constraint — will confirm with you if it needs `--accept-data-loss`, though `TechNews` should currently be empty)
2. `npm run lint`
3. `npm run typecheck`
4. `npm run build`
5. `npm run dev`, then `npm run news:fetch` against real skills, inspect what GitHub actually returns
6. Manual browser/API test of the sidebar filter and dedup-on-rerun

## Manual test steps

1. Ensure Settings has skills (e.g. "React", "TypeScript") from the earlier jobs work.
2. `npm run news:fetch` — check console summary (items found/saved per skill).
3. `/news` → confirm sidebar shows "All", "React", "TypeScript"; main panel shows recently-updated real GitHub repos.
4. Click "React" → confirm the list filters to only React-tagged items, instantly.
5. Re-run `npm run news:fetch` → confirm no duplicates appear.
6. Click a repo link → confirm it opens the real GitHub repo.
