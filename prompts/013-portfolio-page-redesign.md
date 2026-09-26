# Portfolio Page Redesign

## Goal

Rebuild `/portfolio` to match `design/portfolio@2x.png` (source `design/portfolio.html`). The data model and API routes stay the same; this is UI plus small client-side additions (copy URL, delete confirmation).

## Skills read

- `.opencode/skills/react.md`, `.opencode/skills/tailwind.md`, `.opencode/skills/typescript.md`, `.opencode/skills/nextjs.md`
- Design system: `design/masterme-design-system@2x.png`, prompt 010

## Code inspected

- `src/app/(dashboard)/portfolio/page.tsx` — title plus two list cards.
- `src/components/portfolio/PortfolioLinkList.tsx`, `SocialAppList.tsx` — React Query list, delete mutation (no confirmation), and inline add/edit forms.
- `src/components/forms/PortfolioForm.tsx`, `SocialAppForm.tsx` — react-hook-form + zod, create/update mutations.
- `src/components/ui/sheet.tsx` — Base UI dialog sheet (right side), also used by `ProjectBillingSheet`.
- API: `/api/portfolio-links` (ordered by `order` asc, new links appended), `/api/social-apps`; both are session-scoped.
- lucide-react v1 has no brand icons.

## Decisions and assumptions

1. **Page header:** "Portfolio & Links" (26px, semibold) with a muted description. Two cards in a `1.15fr / 1fr` grid on `lg`, stacked below that.
2. **Portfolio links card:** title with a mono count pill and an outline **Add link** button.
   - Each row: a tinted 42px icon tile, title, and the URL without protocol in mono.
   - Actions: copy URL (shows a check for 1.5s), open in new tab, edit, delete.
   - The first link (lowest `order`) gets an amber **Primary** badge. Display-only, no schema change.
3. **Icon field:** the free-text `icon` maps to a small curated lucide set (`globe, file, book, briefcase, code, pen, camera, video, music, mail, link, star`). Anything else falls back to `globe`. Tile tints cycle through the palette by position.
4. **Social apps card:** a two-column tile grid. Each tile shows a monogram (a known-platform map such as GitHub → GH and LinkedIn → in, otherwise the first letters) tinted from the palette by platform, plus the platform name and `@username` in mono.
   - The whole tile is a link to the profile (new tab).
   - Edit/delete appear on hover and on keyboard focus.
   - A dashed **Add app** tile ends the grid.
5. **Add/edit:** a centered popup dialog (new `ui/dialog.tsx`, Base UI Dialog), reused for add and edit. *(Changed from a side sheet at the user's request.)*
   - Link dialog: Title, URL, Icon (optional, with a hint). App dialog: Platform, Username, URL, Icon (optional).
   - Footer buttons: Cancel (ghost) and Save (primary). On success the dialog closes.
6. **Delete confirmation:** a small centered popup: "Delete {name}? This can't be undone." with Cancel and Delete. Nothing is deleted without confirming. *(Changed from an inline bar at the user's request.)*
7. **States:**
   - Loading: skeleton rows/tiles.
   - Error: a muted clay line.
   - Empty: a dashed well with an icon, a message and one call to action (primary for links, outline for apps).
8. No brand logos and no external favicon fetching; the browser only calls our own routes.

## Expected files

- `src/app/(dashboard)/portfolio/page.tsx`
- `src/components/portfolio/PortfolioLinkList.tsx` (rewrite)
- `src/components/portfolio/SocialAppList.tsx` (rewrite)
- `src/components/portfolio/shared.tsx` — **new**: icon map, monogram + tint helpers, `DeleteDialog`, `FormDialog`, `EmptyState`, `CopyButton`, `SectionCard` header
- `src/components/forms/PortfolioForm.tsx`, `SocialAppForm.tsx` — dialog layout (fields + footer); same schemas and mutations
- `src/components/ui/dialog.tsx` — **new**, Base UI Dialog wrapper

## Security considerations

- No change to the API or data scoping. External links use `target="_blank" rel="noreferrer"`.
- Only `http(s)` URLs are accepted by the existing zod `url()` schema, so no `javascript:` links.

## Acceptance criteria

- `/portfolio` matches the reference layout, spacing and colors.
- Add, edit and delete (with confirmation) work for both lists; copy puts the URL on the clipboard.
- Empty, loading and error states render.
- Lint shows no new errors; typecheck and build pass.

## Checks to run

`npm run lint`, `npm run typecheck`, `npm run build`, and a screenshot of the components with sample data.

## Manual test steps

1. Open `/portfolio`. Existing links and apps render in the new style.
2. Click **Add link**, fill it in and save. The dialog closes and the row appears. The first row shows **Primary**.
3. Edit a link. The dialog opens pre-filled, and saving updates the row.
4. Click delete, then Cancel: nothing changes. Click delete, then Delete: the row is removed.
5. Click copy and paste somewhere. You get the URL.
6. Social tile: click to open the profile; hover to edit or delete.
7. Delete everything. Both empty states show.
