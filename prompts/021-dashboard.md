# Dashboard

## Goal

Build `/dashboard` (it was empty) to match `design/dashboard@2x.png` (source `design/dashboard.html`): an overview of every module, built only from the existing APIs. There are no new routes or schema changes.

## Skills read

- `.opencode/skills/nextjs.md`, `react.md`, `tailwind.md`, `typescript.md`
- Prompts 010–020 (design system and every module page)

## Code inspected

- `src/app/(dashboard)/dashboard/page.tsx` — returned `null`.
- Module data and query keys: timeline (`queryKeys.timeline(date)`), job applications and recruiters (`dueForFollowUp`), learning paths, projects (billings), monthly costs, apps summary, tech news, portfolio links and social apps, user skills.
- Reusable helpers: `pathProgress`, `StackLogo`, `platformMark`/`linkIcon`/`tintAt`/`CopyButton`, `formatAmount`, `EstimateTag`/`usd`, `shortAgo`/`initials`, `hourLabel`, `AddApplicationForm`, `FormDialog`.

## Decisions and assumptions

1. **Page:** the server reads the session for the first name; the client `DashboardView` does the rest.
2. **Shared clock:** `useLocalNow` (new, `src/hooks/use-local-now.ts`), extracted from `TimelineView`, which now uses it too.
   - Drives the greeting (morning/afternoon/evening), today's local date, and the NOW slot.
3. **Header:** greeting + date + "N of 8 blocks done · N follow-ups due". Actions: **Add application** (opens the existing add popup) and **Plan today** (→ `/timeline`, primary).
4. **KPIs:**
   - Today (done/8 + bar).
   - Follow-ups due (amber when > 0; split into applications and recruiters).
   - Learning (done/total steps across active paths + bar).
   - Monthly recurring (largest currency total, green).
5. **Widgets** (each with its own loading, error and empty state plus an "Open … →" link):
   - **Today:** 8-slot strip with status colors and a NOW line.
   - **Follow-ups due:** up to 5, with **Done** (mark followed up / contacted; also refreshes the header bell).
   - **Tech radar:** latest 4 with stack logos.
   - **Learning:** up to 3 active paths with progress and the next step.
   - **Money this month:** monthly income, home bills, other (per currency), apps (USD estimate), and "Left over (MAD)" = MAD income − MAD home − MAD other; nothing is converted.
   - **Portfolio:** primary link with copy/open, plus social chips.
6. The same query keys as each module page, so data is shared and cached.

## Expected files

- `src/app/(dashboard)/dashboard/page.tsx`
- `src/components/dashboard/DashboardView.tsx`, `widgets.tsx`, `Widget.tsx`, `data.ts` (**new**)
- `src/hooks/use-local-now.ts` (**new**); `src/components/timeline/TimelineView.tsx` uses it

## Security considerations

Read-only aggregation over existing session-scoped routes; the only writes are the existing mark-followed-up / mark-contacted PATCHes and the existing add-application POST.

## Acceptance criteria

- The page matches the reference with real data.
- Every widget has an empty state; **Done** clears a follow-up; **Add application** works from the dashboard.
- Lint shows no new errors; typecheck passes.

## Checks to run

`npm run lint`, `npm run typecheck`, and dev-server screenshots with seeded data (full and empty).

## Manual test steps

1. Open `/dashboard`. The greeting matches the time of day, and the KPIs match each page.
2. Click **Done** on a follow-up. It disappears here and on `/jobs`; the bell count drops.
3. **Add application** → save. It appears on `/jobs`.
4. With no plan for today, the Today widget offers **Plan today**.
