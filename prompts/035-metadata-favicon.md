# Metadata and favicon

## Goal

Give MasterMe its own icon in browser tabs, bookmarks and the phone home screen, and proper page titles ("Notes · MasterMe") on every page. Keep the app out of search engines, since it is private. Icon options: `design/app-icon-options.png`.

## Skills read

`.opencode/skills/nextjs.md`; local Next docs: `01-metadata/app-icons.md`, `01-metadata/index.md`, `generate-metadata.md` (title templates, robots, viewport).

## Code inspected

- **Root layout:** `src/app/layout.tsx` has one static `metadata` (title and description) and no viewport or theme color.
- **Favicon:** `src/app/favicon.ico` is still the stock Next.js icon from the first commit. There is no `icon.*`, `apple-icon.*` or manifest.
- **Pages:** every `page.tsx` is a server component, so each can export its own `metadata`.
- **Brand:** amber `#E9B03F` and ink `#0E0F14` / `#1B1E29`; chalk background `#F6F4EF`, dark background `#15171F` (from `globals.css`).

## Decisions

1. **Icon:** option **A**, an ink "M" drawn as a stroke path on an amber rounded square. It is readable at 16 px and on both light and dark tab bars; B (amber on ink) almost disappears on dark tabs. The "M" is a path, not text, so it doesn't depend on a font.
2. **Files (Next file conventions):**
   - `src/app/icon.svg`: the sharp icon modern browsers use;
   - `src/app/favicon.ico`: replaced with the new icon at 16, 32 and 48 px, for older browsers and bookmarks;
   - `src/app/apple-icon.png`: 180 × 180, full-bleed amber with no transparency (iOS rounds the corners itself).
3. **Metadata in the root layout:**
   - `title: { default: "MasterMe", template: "%s · MasterMe" }`, the existing description, `applicationName`;
   - `robots: { index: false, follow: false }`, because the app is private and behind a login;
   - `appleWebApp: { title: "MasterMe" }`, `formatDetection: { telephone: false }` (so recruiter phone numbers aren't auto-styled by iOS).
   - `viewport.themeColor`: `#F6F4EF` for light and `#15171F` for dark, so the mobile browser bar matches the app.
4. **Page titles** come from the page name in the sidebar, or the page's heading where it has one:
   - Sign in (`/`), Dashboard, Portfolio, New blog post, New portfolio project, Learning, Timeline, Notes, Monthly cost;
   - Jobs, Projects, Logs, Tech radar (`/news`), Settings.
5. **Not included:** a web app manifest (installing to the home screen), Open Graph share images, sitemap. None is needed for a private app; each can be added later.

## Expected files

- **New files:** `src/app/icon.svg`, `src/app/apple-icon.png`.
- **Replaced:** `src/app/favicon.ico`.
- **Edited:** `src/app/layout.tsx`, `src/app/page.tsx`, and every `src/app/(dashboard)/**/page.tsx` (one `metadata` export each).

## Security

No secrets are involved. `noindex` keeps the login page and any leaked links out of search results.

## Acceptance criteria

- The tab shows the amber "M" icon, and the title changes per page, e.g. "Notes · MasterMe".
- The page head has `icon.svg`, `favicon.ico`, `apple-touch-icon`, `robots noindex,nofollow` and `theme-color` for light and dark.
- `/favicon.ico`, `/icon.svg` and `/apple-icon.png` load without errors.

## Checks to run

`npm run lint`, `npm run typecheck`, `npm run build`; then open the page in a browser and check the `<head>` tags and the tab.

## Manual test steps

1. Run `npm run dev` and open `/`. The tab shows the amber "M" and the title "Sign in · MasterMe".
2. Click through the sidebar; each tab title changes.
3. On a phone, use "Add to Home Screen" and check the icon.
4. A hard refresh (Ctrl+Shift+R) may be needed because browsers cache favicons.
