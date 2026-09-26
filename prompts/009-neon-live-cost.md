# Live Neon cost per project

## Goal

Replace manual Neon cost entries with a live-fetched estimate: link an app Project to a real Neon project, and show its current usage-based cost, fetched from Neon's API on page view rather than typed in by hand.

## Skills read

- Same Next.js/Prisma/TypeScript conventions as every prior integration (LinkedIn scraper, GitHub tech-news, OG-image preview).

## Code inspected / researched

- Confirmed via Neon's own docs (neon.com/docs/reference/api/consumption, neon.com/docs/guides/consumption-metrics) that:
  - The consumption endpoint requires a **paid plan** (Launch/Scale/Agent/Enterprise) — 403s on Free. You confirmed you're on a paid plan.
  - It returns **raw usage metrics** (compute-seconds, storage byte-hours, data-transfer bytes) — **not a dollar figure**. Any "cost" shown has to be computed here from those raw numbers using Neon's published pricing rules, so it's an **estimate**, not your actual invoice line.
  - Docs across pages showed slightly inconsistent field names for the v2 vs legacy consumption endpoints — this is a real unofficial-adjacent integration (documented, but with enough ambiguity that I expect to adjust field-parsing once I see a real response), same posture as the LinkedIn/GitHub integrations.
- `prisma/schema.prisma` — `Project` has no field linking it to an external Neon project.
- `MonthlyCost.projectId` (built last time) is a different, unrelated link — that's for manually-entered costs attributed to a project. This is additive: a project can have a live Neon cost **and** manual costs side by side.

## Decisions and assumptions

1. **New env var `NEON_API_KEY`** (server-only, like `GITHUB_TOKEN`/`CRON_SECRET`) — you'll need to generate one from the Neon console (Account Settings → API Keys) and share it the same way as the GitHub token.
2. **`Project.neonProjectId String?`** — links an app Project to a real Neon project ID. Populated via a dropdown fed by a live `GET` to Neon's project list (not stored/duplicated locally).
3. **Cost is fetched live on page view**, not pre-ingested like the job scraper/tech news (which AGENTS.md explicitly says must be offline). This is a different kind of feature — a live lookup triggered by you opening the page, not a background scrape — so a short client-side cache (a few minutes) is used just to avoid hammering Neon's API on every re-render/navigation, not to defer the fetch to a schedule.
4. **Cost is clearly labeled "estimate"** in the UI, computed from raw usage using Neon's current published pricing constants (compute per CU-hour, storage $0.10/GB over the plan's included amount, data transfer $0.10/GB over 500GB). These constants live in one file so they're easy to correct if Neon changes pricing or the numbers look wrong once we see real data.
5. **First real API call is the actual spec.** I'll hit Neon's real endpoints as soon as the key is available, inspect the actual response shape, and adjust the parsing to match — the docs I read were consistent enough to start from, but not 100% precise about which exact endpoint variant (v2 vs legacy) and org vs personal-account params apply to your account.
6. **Org vs personal account**: some Neon consumption endpoints want an `org_id`. If your Neon project isn't under an organization, I'll handle the personal-account path; if it needs an org, I'll ask for the org ID once I see the actual API error.

## Expected files

- `src/lib/neon.ts` — new: `listNeonProjects()`, `getNeonProjectCostEstimate(neonProjectId)`
- `prisma/schema.prisma` — add `Project.neonProjectId String?`
- `src/app/api/neon/projects/route.ts` — `GET`, session-protected, proxies Neon's project list (never exposes `NEON_API_KEY` to the browser)
- `src/app/api/projects/[id]/neon-cost/route.ts` — `GET`, session-protected, fetches live estimate for the project's linked Neon project
- `src/components/forms/ProjectForm.tsx` — add a "Neon project" select
- `src/components/projects/ProjectCard.tsx` — show the live estimate (with a short client cache) alongside the existing manual infra-cost line
- `.env.example` / `.env.local` — add `NEON_API_KEY`

## Requirements

- `NEON_API_KEY` read server-side only; every route session/user-scoped as usual.
- A missing/invalid key or a Neon API error degrades to "cost unavailable," never breaks the Projects page.
- The estimate is visually distinguished (e.g. "~$X/mo (estimate)") from the exact manually-entered costs already on the card.

## Security considerations

- Same session + userId scoping pattern as every other route; `NEON_API_KEY` never sent to the client.

## Acceptance criteria

- Linking a Project to a real Neon project and reloading shows a live, clearly-labeled cost estimate — not something you typed in.
- If the key or plan doesn't support it, the card says so instead of erroring.
- Unlinking removes the estimate; manually-entered `MonthlyCost` entries on the same project are unaffected.

## What I need from you before I build this

1. **A Neon API key** (Account Settings → API Keys in the Neon console), shared the same way as the GitHub token.
2. **Confirmation whether your Neon project is under a personal account or a Neon Organization** — affects whether I need an `org_id` too.

## Checks to run

1. `npx prisma db push` (additive nullable column)
2. `npm run lint` / `typecheck` / `build`
3. Manual test hitting Neon's real API once the key is available — I'll report exactly what comes back, since this is the part most likely to need a follow-up adjustment.
