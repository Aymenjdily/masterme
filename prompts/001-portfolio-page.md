# Portfolio & Links Hub

## Goal

Build the Portfolio page: a hub where the user manages their portfolio link(s) and social apps. Seed the user's real portfolio URL (`https://aymenjdily.com`) as the first portfolio link on first load via the empty state / add form (not hardcoded — the user adds it through the UI, but the add form defaults are convenient for that).

## Skills read

- `.opencode/skills/nextjs.md`
- `.opencode/skills/prisma.md`
- `.opencode/skills/tailwind.md`
- `.opencode/skills/react.md`
- `.opencode/skills/typescript.md`
- Better Auth conventions (existing `src/lib/auth.ts`)
- Local Next.js docs: `01-app/01-getting-started/15-route-handlers.md`, `01-app/02-guides/client-side-data-fetching/tanstack-query.md` (this Next.js version generates typed `RouteContext<'/path'>` helpers for dynamic route params — used below instead of manually typing `params`)

## Code inspected

- `prisma/schema.prisma` — `PortfolioLink` (title, url, icon, order) and `SocialApp` (platform, username, url, icon) models already exist, scoped to `User` via `userId`, cascade delete.
- `src/app/(dashboard)/portfolio/page.tsx`, `src/components/forms/PortfolioForm.tsx` — both scaffolded, return `null`.
- `src/lib/validations.ts` — `portfolioLinkSchema`, `socialAppSchema` already defined with Zod.
- `src/types/index.ts` — `PortfolioLink`, `SocialApp` interfaces already defined.
- `src/app/(dashboard)/layout.tsx` — protected layout, redirects to `/` if no session, wraps children in `SidebarProvider` + `AppSidebar`. No `QueryClientProvider` exists anywhere yet.
- `src/components/shadcn-space/blocks/sidebar-06/app-sidebar.tsx` — nav already links to `/portfolio`.
- `src/lib/auth.ts`, `src/middleware.ts` — Better Auth (credentials only) with cookie-based session, `auth.api.getSession`.
- `src/components/ui/` — `Card`, `Button`, `Input`, `Field*`, `Label` available; no `Dialog`/`Sheet`-based form pattern used yet except `Sheet` primitive exists (unused so far). No toast component exists.
- `package.json` — `@tanstack/react-query` is installed but has no provider wired up anywhere. `react-hook-form` + `@hookform/resolvers` installed.
- No existing API route handlers for any CRUD resource (only auth, jobs/scrape, news/fetch).
- No reference image provided; user confirmed proceeding with a self-designed layout using existing shadcn/Tailwind patterns.

## Decisions and assumptions

1. **Scope**: page covers both Portfolio Links and Social Apps (per AGENTS.md: "Portfolio and links hub (portfolio URL, social apps, other apps)"). Two sections on one page: "Portfolio Links" and "Social Apps".
2. **Data layer**: Route Handlers under `src/app/api/portfolio-links/` and `src/app/api/social-apps/`, each scoped to `auth.api.getSession`. Client fetches/mutates via TanStack Query (`useQuery`/`useMutation`), per AGENTS.md (no separate state library, use React Query).
3. **Query provider**: add a `Providers` client component wrapping `QueryClientProvider`, mounted in `src/app/(dashboard)/layout.tsx` (only place currently missing it; keeps provider scoped to the authenticated app instead of the whole root layout).
4. **Forms**: `PortfolioForm` (add/edit portfolio link) and a new `SocialAppForm` built with `react-hook-form` + `zodResolver` + existing `Field` components, rendered inline in a small add/edit panel (no dialog primitive currently styled — using inline card-based form to match existing patterns, avoids introducing an unstyled Dialog).
5. **Delete**: simple button with `useMutation`, optimistic removal from the list via query cache update — no confirmation modal (no Dialog component available yet); a plain `Button variant="destructive"` is enough for this scope.
6. **Ordering**: `PortfolioLink.order` is set via simple "add to end" (`max(order) + 1`) on create. No drag-and-drop reordering — not requested, avoids overbuilding.
7. **Icon field**: kept as a plain optional text input (icon name or URL) since no icon picker exists — out of scope to build one.
8. Do not hardcode `https://aymenjdily.com` into the schema/seed; user adds it once through the form after the page ships (keeps the feature generic and reusable, per "all user data belongs to the authenticated user").

## Expected files

- `src/app/api/portfolio-links/route.ts` — GET (list, scoped to user), POST (create)
- `src/app/api/portfolio-links/[id]/route.ts` — PATCH (update), DELETE
- `src/app/api/social-apps/route.ts` — GET, POST
- `src/app/api/social-apps/[id]/route.ts` — PATCH, DELETE
- `src/app/(dashboard)/providers.tsx` — new, `QueryClientProvider` wrapper
- `src/app/(dashboard)/layout.tsx` — wrap children in `Providers`
- `src/app/(dashboard)/portfolio/page.tsx` — page composing both sections
- `src/components/forms/PortfolioForm.tsx` — implement add/edit form
- `src/components/forms/SocialAppForm.tsx` — new, add/edit form
- `src/components/portfolio/PortfolioLinkList.tsx` — new, list + row actions
- `src/components/portfolio/SocialAppList.tsx` — new, list + row actions
- `src/lib/query-keys.ts` — new, shared query key constants (small helper, avoids typo'd keys across list/mutation hooks)

## Requirements

- All API routes call `auth.api.getSession({ headers: await headers() })`; return `401` if no session.
- All Prisma queries filter by `userId: session.user.id` — never trust a client-supplied `userId`.
- Create/update routes validate body with `portfolioLinkSchema` / `socialAppSchema` (Zod) before touching Prisma; return `400` with parsed error on failure.
- Update/delete routes verify the record belongs to the requester (`findFirst({ where: { id, userId } })`) before mutating — prevents cross-user access via guessed IDs.
- Empty states: "No portfolio links yet" / "No social apps yet" with an inline add action.
- Loading and error states for each list (`isPending`, `isError` from `useQuery`).
- Responsive: sections stack in a single column on narrow widths, two-column grid on wider desktop.

## Security considerations

- Session check + user-scoped `userId` filter on every route (list, create, update, delete) — no cross-user data exposure.
- `url` fields validated as URLs by Zod on the server, not just the client.
- No secrets/tokens involved in this feature; nothing sent to the browser beyond the user's own records.

## Acceptance criteria

- Visiting `/portfolio` while logged out redirects to `/` (existing middleware/layout behavior, unaffected).
- Logged in, `/portfolio` renders two sections, each starting empty.
- Adding a portfolio link (e.g., title "Portfolio", url `https://aymenjdily.com`) persists it, shows it in the list immediately, and survives a page reload.
- Editing and deleting a portfolio link and a social app both work and persist.
- Invalid URL in either form shows a client-side validation error and never reaches the server.
- A second test user (if manually created) never sees the first user's links.

## Checks to run

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm run dev` + manual browser test of add/edit/delete for both sections, empty states, invalid URL input, logged-out redirect

## Manual test steps

1. `npm run dev`, log in (or register) as `aymenjdily@gmail.com`.
2. Go to `/portfolio` — confirm empty states for both sections.
3. Add portfolio link: title "Portfolio", url `https://aymenjdily.com` — confirm it appears, reload page, confirm it persists.
4. Edit the link's title, confirm update persists.
5. Add a social app (e.g., platform "GitHub", username, url), confirm it appears and persists.
6. Delete both, confirm empty states return.
7. Try submitting an invalid URL, confirm inline validation error, no network request/toast of success.
8. Log out, hit `/portfolio` directly, confirm redirect to `/`.
