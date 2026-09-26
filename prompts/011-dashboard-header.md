# Dashboard Header — title, alerts, user menu

## Goal

Replace the current header (it only has the sidebar toggle) with the Amber Lens app header the user picked:

```
[≡] │ MasterMe / Jobs              Wed 23 Sep   (🔔 3)   (◉ Aymen ▾)
```

- **Left:** sidebar toggle, a divider, then a breadcrumb `MasterMe / <current page>`
- **Right:** today's date (mono), a notification bell with a count badge, and an avatar menu (name + email, Settings, Sign out)

The app has no sign-out today, so this also adds the first sign-out.

## Skills read

- `.opencode/skills/nextjs.md` — server layout passes session data to a client component; `usePathname`
- `.opencode/skills/react.md` — React Query for the alerts count
- `.opencode/skills/tailwind.md`, `.opencode/skills/typescript.md`
- `.opencode/skills/prisma.md` — `count` queries scoped by `userId`
- Better Auth — `authClient.signOut()` (client), `auth.api.getSession` (server)
- Shadcn UI conventions (base-nova on Base UI) for new `dropdown-menu` / `popover` wrappers
- Design system: `design/masterme-design-system@2x.png`, `prompts/010-design-system-foundation.md`

## Code inspected

- `src/app/(dashboard)/layout.tsx` — server component with the session; renders the header inline (`SidebarTrigger` only).
- `src/components/shadcn-space/blocks/sidebar-06/app-sidebar.tsx` — `navData` (title + href + icon) is the source for page names.
- `src/app/api/jobs/route.ts` — offers have `status: "new"`.
- `src/app/api/job-applications/route.ts`, `src/app/api/recruiter-contacts/route.ts`, `src/lib/follow-up.ts` — follow-up is due when an open application (`applied`/`interviewing`) or a contacted recruiter hasn't been touched for 3 days (`isDueForFollowUp`).
- `src/lib/auth-client.ts` — `createAuthClient` from `better-auth/react`; `signOut` is available but unused.
- `src/lib/query-keys.ts` — shared query keys.
- `src/components/ui/` — `avatar`, `button`, `badge`, `separator` exist. There's no dropdown menu or popover wrapper yet; `@base-ui/react` ships `menu` and `popover`.
- `src/app/(dashboard)/jobs/page.tsx` — the Jobs page is where offers and follow-ups live.

## Decisions and assumptions

1. **Page name:** the breadcrumb takes it from `navData` by matching `usePathname()`, so there's no second list of titles to maintain. For unknown routes it shows just `MasterMe`. Pages keep their own `<h1>` for now; that gets revisited in the page redesigns.
2. **Alert counts come from one small new endpoint**, `GET /api/notifications/summary`. It returns `{ newOffers, applicationsDue, contactsDue }`, all scoped to the session user:
   - `newOffers`: a `prisma.jobOffer.count` where `status: "new"`.
   - `applicationsDue`: open applications past the 3-day window, reusing `isDueForFollowUp`. The same flags feed the Jobs page, so the two can't drift apart.
   - `contactsDue`: recruiter contacts past the same window, also reusing `isDueForFollowUp`.

   This avoids downloading the full offer, application and contact lists just to show a number.
3. **Bell:** the badge shows the total (`newOffers + applicationsDue + contactsDue`); it's hidden at 0 and shows `9+` above 9. Clicking opens a popover with up to three rows (new job offers, applications to follow up, recruiters to follow up), each linking to `/jobs`. With nothing pending it shows the empty state "You're all caught up". The count refreshes every 5 minutes (React Query `refetchInterval`) and when the window regains focus. There are no push notifications (optional per AGENTS.md, later).
4. **Avatar menu:** the trigger shows the avatar and first name. The popup shows the full name and email, then **Settings** (links to `/settings`), a separator, and **Sign out**. The avatar image is `session.user.image`, falling back to `/images/avatar.png` (the same image the sidebar logo uses), then to initials.
5. **Sign out:** calls `authClient.signOut()`, then `router.replace("/")` and `router.refresh()`. The middleware already sends signed-out users to `/`.
6. **Date:** rendered on the client with the user's locale in mono, e.g. `Wed 23 Sep`. It's hidden below `md`.
7. **New UI primitives:** only the two this needs, `ui/dropdown-menu.tsx` (Base UI `Menu`) and `ui/popover.tsx` (Base UI `Popover`). They follow the shadcn wrapper style and the design tokens: white popup, 1px border, `shadow-popover`, `rounded-xl`, chalk hover rows.
8. **Server/client boundary:** the layout (server) passes `{ name, email, image }` from the session as props to a client `AppHeader`. No tokens reach the client. The browser only calls the new same-origin route.
9. **Style (Amber Lens):** white card header, `h-14`, `rounded-2xl`, border, `shadow-card` (as now).
   - Breadcrumb: root in `text-muted-foreground`, current page in `text-foreground font-medium`.
   - Bell: ghost icon button with an amber count pill.
   - Avatar: amber ring, matching the sidebar logo.

## Expected files

- `src/app/api/notifications/summary/route.ts` — **new**, GET, session-scoped counts
- `src/components/ui/dropdown-menu.tsx` — **new**, Base UI Menu wrapper
- `src/components/ui/popover.tsx` — **new**, Base UI Popover wrapper
- `src/components/layout/app-header.tsx` — **new**, client header (breadcrumb, date, bell, user menu)
- `src/lib/query-keys.ts` — add `notificationsSummary`
- `src/types/index.ts` — add `NotificationsSummary`
- `src/app/(dashboard)/layout.tsx` — render `<AppHeader user={...} />` in place of the inline header

## Requirements

- The endpoint returns 401 without a session. Every query filters by `userId: session.user.id`.
- No hardcoded Tailwind palette colors; only design tokens.
- Keyboard accessible: the bell and avatar are real buttons with `aria-label`. Menus open with Enter/Space, close with Esc, and support arrow keys (Base UI provides this).
- The header doesn't shift layout while counts load; the badge just appears.
- Responsive: below `md` the date and first name are hidden, and the breadcrumb truncates.

## Security considerations

- The new route only returns counts for the authenticated user; no other user's data is reachable.
- Sign-out goes through Better Auth's own endpoint, which clears the session cookie server-side.
- The user's email is shown only to that same signed-in user.

## Acceptance criteria

- On every dashboard page the header shows `MasterMe / <Page>` that matches the active sidebar item.
- The bell shows the right total. The popover lists each non-zero category and links to `/jobs`; with nothing pending it shows the empty state.
- The avatar menu shows the name and email; Settings navigates, and Sign out logs out and lands on the login page. After that, `/dashboard` redirects to `/`.
- Lint shows no new errors, and typecheck and build pass.

## Checks to run

1. `npm run lint` (expect only the 4 errors that were already there)
2. `npm run typecheck`
3. `npm run build`
4. Dev server screenshot of the header, light mode (and a dark-mode sanity check)

## Manual test steps

1. Sign in, then open `/jobs`, `/projects` and `/timeline`. The breadcrumb follows the page.
2. With at least one `new` job offer, the bell shows a count. Click it: the rows link to `/jobs`.
3. Mark all offers as non-new (or use an empty account). The badge disappears and the popover says "You're all caught up".
4. Open the avatar menu, then Settings: it lands on `/settings`.
5. Open the avatar menu, then Sign out: it lands on the login page. Visiting `/dashboard` redirects to `/`.
6. Narrow the window below 768px. The date and name hide, and the header doesn't overflow.
