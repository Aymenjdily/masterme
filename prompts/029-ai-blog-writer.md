# AI blog writer (Sanity drafts)

## Goal

Build the AI blog writer to match `design/ai-blog-writer@2x.png` (source `design/ai-blog-writer.html`).

1. Pick a topic from your real work, or type your own.
2. The AI drafts a post in your voice.
3. You edit it in MasterMe.
4. It is saved to your Sanity blog as an **unpublished draft**. You publish it yourself in the Studio.

**New scope:** add "AI blog writer (Sanity drafts)" to the AI assistance list in AGENTS.md.

## Skills read

- `.opencode/skills/nextjs.md`, `react.md`, `typescript.md`, `tailwind.md`
- The `sanity-best-practices` skill (Portable Text, drafts, client usage), read before building
- Prompts 022–026 (AI foundation and features)

## Code and data inspected

- **Sanity project** `latuc0m0` / `production`, read-only queries with your token:
  - 25 `post` documents, 1 `author` (Aymen Jdily), 4 `category` documents (unused by any post).
  - **Post fields:** `title`, `slug` (`{_type: slug, current}`), `author` (reference), `excerpt` (string), `publishedAt`, `mainImage`.
  - **Body:** Portable Text using `block` (styles normal / h1–h4, `bullet` lists at level 1, `strong` mark) and `code` blocks (`{_type: "code", language, code}`).
- **Env:** `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `NEXT_PUBLIC_SANITY_API_VERSION`, `SANITY_API_WRITE_TOKEN`
- **MasterMe:** Portfolio page components; projects, learning paths and tech news data; `src/lib/ai/*`; `src/components/ai/*`.

## Decisions and assumptions

1. **Sanity access is server-only**, through `@sanity/client` with the write token, `useCdn: false`. No Sanity call ever runs in the browser.
2. **Blog card on /portfolio:**
   - the latest 6 posts, marked Draft / Published / Unpublished, each linking to the Studio;
   - a count, "Connected to Sanity", and a **Write with AI** button;
   - if the env variables are missing, it shows a short "Connect Sanity" note instead.
3. **Writer page `/portfolio/blog/new`:**
   - **Topic suggestions** (3):
     - candidates come from your projects (title, type, description), active learning paths and recent radar items;
     - one `decide()` call scores how well each fits your blog, given your existing post titles, and the top 3 are shown with their %;
     - you can also type your own topic, and add notes.
   - **"Already covered?":** a yes/no decision against your existing titles. At ≥ 60% it shows the warning with the closest post; you can continue anyway.
   - **Language:** English / Français, pre-picked by the AI with its %. **Length:** Short (~500 words) / Medium (~1,000) / Long (~1,600).
   - **Voice:** the prompt includes the titles and excerpts of your last 5 published posts, never full bodies.
   - **Writing:** `generateObject` returns `{ title, slug, excerpt, sections: [{ heading, markdown }] }`, where the markdown is limited to paragraphs, `###` subheadings, `-` lists, `**bold**` and fenced code blocks.
   - **Facts:** only from your notes and the chosen item. The prompt forbids invented numbers, clients, results or quotes. A "Facts used" line lists the sources.
4. **Editing:** each section has Edit (plain text with light marks), Rewrite (just that section) and Delete. Title, slug and excerpt are editable.
5. **Send to Sanity:**
   - The markdown is converted to your exact Portable Text (h2 section headings, h3 subheadings, normal paragraphs, bullet lists, strong, code blocks with a language), with `_key`s.
   - It's created as `drafts.<uuid>` with `_type: "post"`, your author reference and no `publishedAt`.
   - A slug clash with an existing post gets `-2`.
   - Toast: "Draft saved to Sanity · Open in Studio →". It's never published, and no image is set.
6. **"Open in Studio"** needs your Studio URL, e.g. `https://yoursite.com/studio`. It's read from a new env variable, `SANITY_STUDIO_URL`. Without it, the link goes to sanity.io/manage.
7. **Log:** `AiEvent` rows for suggest, write and rewrite, with outcomes: `accepted` (sent unchanged), `edited`, `rejected` (discarded). Never the text.
8. **Rate limit:** 20 AI events per 10 minutes for `blog.*`.

## Expected files

- `src/lib/sanity.ts` (server client, posts list, draft create, slug check)
- `src/lib/portable-text.ts` (markdown to Portable Text, tested)
- `src/lib/ai/blog.ts` + `src/lib/ai/blog-kinds.ts`
- `src/app/api/blog/posts/route.ts` (GET list), `src/app/api/ai/blog/suggest`, `write`, `rewrite` routes, `src/app/api/blog/drafts/route.ts` (POST to Sanity)
- `src/app/(dashboard)/portfolio/blog/new/page.tsx` + `src/components/blog/*` (BlogCard, Writer, SectionEditor)
- Edits: Portfolio page (Blog card), AGENTS.md (scope), `.env.example` (Sanity variables + `SANITY_STUDIO_URL`)
- `package.json`: `@sanity/client`

## Security considerations

- The token is only in server code and never sent to the browser. Every route checks your session.
- Only your notes, the chosen item and your post titles and excerpts go to OpenAI.
- Drafts only: MasterMe never publishes and never deletes Sanity documents.

## Acceptance criteria

- Matches the board: writer page, Blog card, writing steps, already-covered warning, section edit, sent toast, error.
- A sent draft opens in your Studio with the right title, slug, excerpt, author, and headings, lists, bold and code rendered correctly.
- Nothing is published, and existing posts are untouched.
- Lint shows no new errors; typecheck and build pass; the Portable Text converter has a unit-style check script.

## Checks to run

`npm run lint`, `npm run typecheck`, `npm run build`, the converter check, plus one real draft sent to Sanity. It stays as a draft for you to review, or I delete it if you prefer.

## Manual test steps

1. Portfolio: the Blog card lists your posts and the Studio links work.
2. **Write with AI** → pick "daily infra cost" → add notes → Medium → Write.
3. Edit one section, rewrite another, then **Send to Sanity**.
4. Open it in the Studio: it's a draft, formatted like your other posts, with no publish date.
