# Projects Page: cards with real preview + billing (one-time / monthly cost)

## Goal

Build `/projects`: add/edit projects, shown as cards with a real preview image pulled from the project's URL, plus billing tracking (one-time build cost and monthly recurring cost) per project.

## Skills read

- Same Next.js/Prisma/Tailwind/React/TypeScript skills, Route Handler + TanStack Query conventions established in prior builds.

## Code inspected

- `prisma/schema.prisma` — `Project` (title, description, type, status, dates, clientName) has **no `url` field** — needed for the preview. `ProjectBilling` already supports `billingType: "one_time" | "monthly"`, `amount`, `currency` (default `"MAD"`), `invoiceDate` — this is exactly the "one-time build cost / monthly recurring" model from AGENTS.md, just not built yet.
- `src/app/(dashboard)/projects/page.tsx`, `src/components/forms/ProjectForm.tsx`, `src/components/forms/BillingForm.tsx` — all scaffolded, empty.
- `src/lib/validations.ts` — `projectSchema`, `projectBillingSchema` already defined.
- No `/api/projects*` or `/api/project-billing*` routes exist yet.
- `cheerio` is already a dependency (added for the LinkedIn scraper) — reusable for OG-image scraping, no new package needed.
- `src/components/ui/` has `Card`, `Skeleton` (for image loading states), no image/avatar-as-preview pattern yet beyond `Avatar` (user profile pictures) — will use a plain `<img>` in the card, not the `Avatar` component (that's for circular profile photos, wrong shape/semantics for a site preview).

## Decisions and assumptions (per your answer)

1. **Preview = scraped OG image**, not a screenshot API. `Project.url` (optional) is added; when set, the server fetches the page and parses `<meta property="og:image">` → falls back to `twitter:image` → falls back to nothing (card shows a placeholder). No paid API, no API key.
2. **Fetched once and cached**: `Project.previewImageUrl String?` stores the resolved image URL. Re-fetched only when the project's `url` changes (on create/update), not on every page view — keeps the page fast and doesn't hammer the target site.
3. **Preview fetch runs server-side** in the create/update route handler, synchronously before responding (simple `fetch` + cheerio parse of one page — fast enough to not need a background job for this). If the fetch fails or times out (bad URL, site blocks bots, no OG tag), we save `previewImageUrl: null` and move on — never blocks project creation.
4. **Billing UI**: each project card shows a compact summary — total one-time revenue and current monthly recurring amount — computed from its `ProjectBilling` records. Full billing management (add/edit/delete a billing record) happens in an expandable section / inline panel on the card, using the existing `billingType: one_time | monthly` schema (no schema change needed there).
5. **Currency**: keep the existing `MAD` default from the schema, editable per billing record (already supported).

## Expected files

- `prisma/schema.prisma` — add `Project.url String?`, `Project.previewImageUrl String?`
- `src/lib/og-preview.ts` — new, `fetchPreviewImage(url): Promise<string | null>` (cheerio-based OG/Twitter image scrape, with timeout + error handling)
- `src/app/api/projects/route.ts` — `GET` (list user's projects with billing included), `POST` (create, resolves preview image)
- `src/app/api/projects/[id]/route.ts` — `PATCH` (update; re-resolves preview if `url` changed), `DELETE`
- `src/app/api/projects/[id]/billing/route.ts` — `GET`, `POST` (add a billing record for a project)
- `src/app/api/project-billing/[id]/route.ts` — `PATCH`, `DELETE`
- `src/app/(dashboard)/projects/page.tsx` — grid of project cards
- `src/components/forms/ProjectForm.tsx` — implement (title, description, type, status, dates, clientName, url)
- `src/components/forms/BillingForm.tsx` — implement (billingType, amount, currency, description, invoiceDate)
- `src/components/projects/ProjectCard.tsx` — new, preview image + summary + expandable billing panel
- `src/lib/query-keys.ts` — add `projects`, `projectBilling(projectId)` keys

## Requirements

- Every route session/user-scoped, same pattern as every prior feature.
- `projectSchema`/`projectBillingSchema` validate all writes; `url` validated as a URL when present but stays optional (not every project has a live site).
- OG-image fetch has a short timeout (e.g. 5s) and never throws past the route handler — a broken/slow URL degrades to "no preview," not a failed project save.
- Monthly recurring total and one-time total computed from `ProjectBilling` records, not stored redundantly.

## Security considerations

- The OG-image fetch is a server-side request to a user-supplied URL (SSRF-adjacent) — mitigate by only fetching `http(s)` URLs (schema's `.url()` validation already restricts to valid URLs) and applying a timeout; this is a personal single-user app, not a public multi-tenant service, so the risk is fetching a URL the user themselves typed in.
- Standard session + userId scoping on every route.

## Acceptance criteria

- Add a project with a real, public URL (e.g. your own portfolio) → card shows its actual OG image.
- Add a project with no URL, or a URL with no OG tag → card shows a clean placeholder, no broken image icon.
- Add a one-time billing record and a monthly billing record to a project → card summary shows both totals correctly.
- Editing a project's URL updates its preview image; editing other fields does not re-trigger a fetch.
- Client projects show `clientName`; personal/SaaS projects don't show an empty "Client:" line.

## Checks to run

1. `npx prisma db push` (two additive nullable columns on `Project`)
2. `npm run lint`
3. `npm run typecheck`
4. `npm run build`
5. `npm run dev` + manual test: add a project with a real URL and confirm the OG image actually renders, add billing records, verify totals

## Manual test steps

1. `/projects` → Add project: title "MasterMe", type "personal", url `https://github.com` (has a reliable OG image) → confirm the card shows GitHub's real preview image.
2. Add a project with url `https://example.com` (no OG image) → confirm placeholder, no broken image.
3. Add billing: one-time 5000 MAD, then monthly 200 MAD → confirm card shows "5000 MAD one-time" and "200 MAD/mo".
4. Edit the project's URL to a different site → confirm preview image updates.
5. Edit only the title → confirm preview image does NOT re-fetch (same `previewImageUrl`).
6. Delete a project → confirm its billing records are gone too (cascade).
