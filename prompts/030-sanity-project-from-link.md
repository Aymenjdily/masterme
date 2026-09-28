# AI: add a Sanity portfolio project from a link

## Goal

Build "Add a project from a link" to match `design/project-from-link@2x.png` (source `design/project-from-link.html`).

You paste the live site (and optionally the GitHub repo and a few notes). MasterMe reads them, and the AI fills every field of your Sanity `project` document, cover image included. You review and edit, then it's saved to Sanity as an **unpublished draft**. You publish it in the Studio.

**Scope:** extends the approved "AI blog writer (Sanity drafts)" line in AGENTS.md to "AI blog and project writer (Sanity drafts)".

## Skills read

- `sanity-best-practices` (Sanity generates the ids, drafts use `drafts.`, references for relations, image assets)
- `.opencode/skills/nextjs.md`, `react.md`, `typescript.md`
- Prompt 029 (AI blog writer): reuses `src/lib/sanity.ts`, the Blog card pattern, the draft flow and the logging.

## Code and data inspected

- **Sanity, read-only:** 21 `project` documents. The fields in use:
  - `title`, `slug` (`{_type: slug, current}`), `description` (80–160 characters), `overview`, `problem`, `solution` (~250–580 characters each, plain text with blank lines).
  - `businessImpact` (plain text, one point per line), `body` (Portable Text, 3–5 normal paragraphs).
  - `type` (`client-work` / `product` / `project`), `status` (`live` / `beta`), `year` (string), `featured` (boolean).
  - `technologies` (array of strings; 25 in use, with duplicate spellings such as "Next js" and "Next.js").
  - `preview` (site URL), `source` (GitHub URL; 5 projects), `mainImage` (image asset; all 21), `author` (reference), `publishedAt`.
  - `categories` (5 projects) and `keyFeatures` (1, empty) are left out.
- **MasterMe:** `src/lib/og-preview.ts` (finds a cover image that really loads), `src/lib/sanity.ts`, `src/lib/ai/*`, the Blog card and writer.

## Decisions and assumptions

1. **Entry:** a **Portfolio projects** card on /portfolio (the latest Sanity projects with type, status and draft labels, plus **Add from link**) opens `/portfolio/projects/new`.
2. **Reading, server-side** (`POST /api/ai/sanity-project/read`):
   - **The site:** the title, meta and og description, the visible text (scripts, nav and footer stripped, max ~12k characters), and a cover image via `og-preview`.
     - A page that is mostly a login form or has almost no text is marked "login page / empty"; only its title and image are used.
     - Only public `http(s)` URLs are fetched; `localhost` and private IP ranges are refused. Timeouts are 5 s.
   - **The GitHub repo** (if given): repo description, topics, created year, README (max ~8k characters) and `package.json` dependencies, through the GitHub API (`GITHUB_TOKEN` if set).
   - **Duplicate check:** an existing project with the same preview host or source repo shows the warning with its title.
3. **Writing:**
   - **One `decide()` call:** `type` (choice of the 3 values), `status` (choice of 2), and which of your existing technology names match (a yes/no per candidate). Each comes with its %.
   - **One `generateObject` call:** title, description (≤ 160 characters), overview, problem, solution, businessImpact (3–6 lines) and body (3–4 paragraphs), in your portfolio's voice.
     - The prompt includes 2 existing projects as style examples (their description, problem and solution).
     - **Facts** come only from the site, the repo and your notes; no invented clients, numbers or results.
   - **Technologies:** the stack is read from `package.json` and the page, then mapped to your **existing spellings** (e.g. "next" → "Next.js", using the most common spelling). Anything new is shown with a "new" tag.
   - **Year:** from the repo's creation year, otherwise the current year. **Slug:** from the title, with `-2` if it's taken.
4. **Review:**
   - every field is editable; AI-filled fields have an amber dot;
   - type and status are segmented controls showing the AI's %;
   - technologies are chips you can add or remove;
   - the cover image can be swapped for another candidate the page offers, or removed;
   - overview and body are collapsed by default.
5. **Send** (`POST /api/sanity/projects`):
   - the cover image is uploaded as a Sanity image asset;
   - the document is created as `drafts.` with `_type: "project"`, your author reference, `publishedAt` = now (editable), and `featured` false by default;
   - `body` is converted with the existing Portable Text converter;
   - never published, never overwriting an existing document.
   - Toast: "{title} saved to Sanity · draft · Open in Studio →".
6. **Log:** `AiEvent` rows with feature `sanityproject.*` and outcomes (accepted / edited / rejected), never the text. **Rate limit:** 20 events per 10 minutes.

## Expected files

- `src/lib/site-reader.ts` (safe page fetch, text extraction, login detection) and `src/lib/github-repo.ts` (repo, README, package.json)
- `src/lib/ai/sanity-project.ts` + `sanity-project-kinds.ts`
- `src/lib/sanity.ts`: `listProjects`, `projectTechnologies`, `projectStyleSamples`, `findProjectDuplicate`, `createProjectDraft` (image upload)
- Routes:
  - `src/app/api/ai/sanity-project/read/route.ts` and `…/write/route.ts`
  - `src/app/api/sanity/projects/route.ts` (GET the list, POST a draft)
- `src/app/(dashboard)/portfolio/projects/new/page.tsx` + `src/components/sanity-projects/*` (ProjectsCard, ProjectFromLink)
- Edits: Portfolio page (the card), AGENTS.md (scope line)

## Security considerations

- The Sanity token and GitHub token are server-only; every route checks the session.
- Page fetches are limited to public http(s) hosts (no SSRF to localhost or private IPs), with size and time limits.
- Only the page text, README, dependencies and your notes go to OpenAI; the log stores counts and outcomes only.
- Drafts only: nothing is published or overwritten.

## Acceptance criteria

- Matches the board: writer page, Projects card, reading steps, "already in your portfolio" warning, blocked site, sent toast.
- MasterMe (site + repo) produces a complete draft: every field filled, cover uploaded, technologies using your existing spellings, preview and source set.
- Opened in the Studio, it looks like your other projects and is unpublished.
- A site already in your portfolio shows the warning.
- Lint shows no new errors; typecheck and build pass.

## Checks to run

`npm run lint`, `npm run typecheck`, `npm run build`, the URL guard (localhost refused), plus one real draft (MasterMe) sent to Sanity for you to review.

## Manual test steps

1. Portfolio → **Add from link** → `https://masterme-azure.vercel.app` + `https://github.com/Aymenjdily/masterme` → Read.
2. Check "What I found", edit a field, remove a technology, then **Send to Sanity as draft**.
3. Open it in the Studio: a draft with a cover image, all text fields, the right type and status.
4. Try `https://www.smartbudget.ma/en`: it says it's already in your portfolio.
