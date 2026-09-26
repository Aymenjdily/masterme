# Tech Radar Page Redesign (+ real stack logos)

## Goal

Rebuild `/news` to match `design/news@2x.png` (source `design/news.html`) and, per the user, show the **real logo** of each stack skill. There are no API or schema changes; the radar still only fills from the scheduled `news:fetch` job.

## Skills read

- `.opencode/skills/react.md`, `tailwind.md`, `typescript.md`, `nextjs.md`
- Prompt 007 (tech news radar), 010 (design system)

## Code inspected

- `src/app/(dashboard)/news/page.tsx` — skills + tech news queries, time filter select, stack sidebar, list, pagination.
- `src/components/news/StackSidebar.tsx`, `TechNewsList.tsx`, `TimeFilterSelect.tsx`, `ui/pagination-controls.tsx`.
- `src/lib/github-trending.ts` — `title` is the repo `full_name` (`owner/repo`), `publishedDate` = last push, `tags` = matched skill.
- `src/lib/date-ranges.ts` — `TIME_FILTERS`, `getDateRange`, `isWithinRange`.

## Decisions and assumptions

1. **Logos:** the `simple-icons` package (CC0, `sideEffects: false`).
   - A curated map of ~70 common skill spellings → icon, so only those icons are bundled.
   - No external image requests (AGENTS.md: the browser only calls our own routes).
   - Unknown skills fall back to a stable palette dot. Missing upstream (trademark): Java, AWS, OpenAI; C# maps to .NET.
2. **Logo color:** the brand color. Pale brands (e.g. React) are darkened until readable on the light page; near-black brands (Next.js, Vercel) use `currentColor` so they also work in dark mode.
3. **Layout:**
   - Time filters as tabs, plus mono meta ("N repos · N updated today · last fetch HH:MM", from the newest item's `createdAt`).
   - Stack sidebar: All + skills with logo tiles and counts, amber active bar, "Edit stack in Settings" link.
   - Feed grouped by last update (Today / Yesterday / Earlier this week / Month Year / Undated). Rows show an owner monogram, `owner / repo` mono link, description, skill tags with logos, and relative + absolute date.
   - Pagination with page numbers, ellipses and per-page size.
4. **Empty states:** no skills → Settings CTA; no data → explains the scheduled fetch with the `npm run news:fetch` command.
5. Removed: `TimeFilterSelect.tsx` (replaced by tabs).

## Expected files

- `src/app/(dashboard)/news/page.tsx`
- `src/components/news/NewsView.tsx` (**new**), `StackLogo.tsx` (**new**)
- `src/components/news/StackSidebar.tsx`, `TechNewsList.tsx` (rewrites)
- `src/types/index.ts` — `TechNews.createdAt?`
- `package.json` — `simple-icons`
- Deleted: `src/components/news/TimeFilterSelect.tsx`

## Security considerations

No API changes, no new external requests from the browser; the logos are bundled SVG paths.

## Acceptance criteria

- The page matches the reference with real logos.
- The filters (time, skill) and pagination work.
- Lint shows no new errors; typecheck and build pass.

## Checks to run

`npm run lint`, `npm run typecheck`, `npm run build`, and screenshots with sample data.

## Manual test steps

1. Open `/news`. The skills show their logos in the sidebar and on the tags.
2. Switch the time tabs and click a skill. The feed, counts and pagination update.
3. With no skills, the Settings CTA shows; with no data, the fetch command shows.
