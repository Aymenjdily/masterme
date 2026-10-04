# Notes: a page for personal notes

## Goal

A new **/notes** page where the user writes and keeps their own notes: a list on the left, an editor on the right, with tags, pins, search and autosave. Design: `design/notes.png` (source `design/notes.html`).

Notes is not in the AGENTS.md scope list. The user asked for it directly, so it is added as a small, self-contained module.

## Skills read

`.opencode/skills/nextjs.md`, `prisma.md`, `react.md`, `tailwind.md`, `typescript.md`; the board style from `design/project-logs.html` and `design/learning.html`.

## Code inspected

- **Schema:** `prisma/schema.prisma` has no migrations folder, so changes ship with `npm run db:push`. `User` has the per-module relations.
- **API pattern:** `src/app/api/portfolio-links/route.ts` and `[id]/route.ts`: `auth.api.getSession`, Zod from `src/lib/validations.ts`, `where: { userId }`.
- **Other code:** the sidebar is `src/components/shadcn-space/blocks/sidebar-06/app-sidebar.tsx`; the query keys are in `src/lib/query-keys.ts`; the UI primitives are in `src/components/ui` (button, card, input, textarea, dialog, popover, badge).

## Decisions

1. **Model `Note`:**
   - fields: `id`, `userId`, `title String @default("")`, `body String @db.Text @default("")`, `tags String[]`, `pinned Boolean @default(false)`, `createdAt`, `updatedAt`;
   - index `@@index([userId, pinned, updatedAt])`;
   - limits (Zod): title ≤ 200 characters, body ≤ 20,000, ≤ 5 tags, each lowercase `[a-z0-9-]`, ≤ 24 characters.
2. **Plain text only.** No markdown and no rich text. The body is rendered with `whitespace-pre-wrap`.
3. **Order:** pinned notes first, then by `updatedAt` descending. The list is grouped into Pinned / This week / Earlier.
4. **Search:** a case-insensitive Prisma `contains` on the title and body, plus `has` on tags. This is done on the server (`GET /api/notes?q=&tag=&pinned=`). There are no embeddings.
5. **Autosave:** the editor saves 800 ms after typing stops, and on blur or ⌘S, with `PATCH /api/notes/[id]`. The header shows the state: Saving… / Saved / Not saved · Retry.
   - "New note" opens a blank editor, and the note is only created on the first keystroke, so the list never fills with empty notes.
6. **The URL keeps the open note** (`/notes?id=…`). Keyboard shortcuts: `/` focuses search, `N` creates a new note, `Esc` goes back to the list on small screens.
7. **Delete** asks for confirmation in a dialog. There is no trash or undo.
8. **Sidebar:** a "Notes" item (lucide `StickyNote`) under Life management, after Timeline.
9. **Responsive:** on small screens the page is one column. The list shows first; tapping a note opens the editor, which has a back arrow.
10. **Not included:** sharing, attachments, linking notes to projects or jobs, routing notes from Paste Anything or ⌘K, and AI features. Each of these can be added later.

## Expected files

- **Schema:** `prisma/schema.prisma` (`Note` model and the `User.notes` relation).
- **Server code:**
  - `src/app/api/notes/route.ts` (GET list, POST create);
  - `src/app/api/notes/[id]/route.ts` (PATCH, DELETE);
  - `src/lib/validations.ts`, `src/types/index.ts`, `src/lib/query-keys.ts`.
- **Page and components:**
  - `src/app/(dashboard)/notes/page.tsx`;
  - `src/components/notes/NotesView.tsx`, `NoteList.tsx`, `NoteListItem.tsx`, `NoteEditor.tsx`, `TagPicker.tsx`, `DeleteNoteDialog.tsx`;
  - the sidebar file.

## Requirements

- Match the board exactly: the 372 px list card, the editor card, tag chips, pinned section, Saved indicator, footer hints, and the three empty or dialog states.
- Reuse the existing Tailwind tokens and shadcn components. Add no new libraries.
- Use React Query for the list and for mutations. Updates are optimistic so typing never lags.

## Security

- Every route checks the session. Every query and mutation filters by `userId`, and `[id]` routes use `updateMany` / `deleteMany` with `{ id, userId }` and return 404 when nothing matches.
- Zod validates every input and the length limits are enforced on the server. Notes are rendered as text, never as HTML.

## Acceptance criteria

- The user can create, edit (with autosave), pin or unpin, tag, search, filter by tag and delete a note.
- Pinned notes stay on top, and a reload keeps the open note.
- An empty account shows "No notes yet", and a search with no match shows "No notes match …".
- Another user's note id returns 404.

## Checks to run

`npm run db:push`, `npm run lint`, `npm run typecheck`, `npm run build`, then `npm run dev` and test in the browser.

## Manual test steps

1. Open /notes and check the empty state.
2. Click New note, type, and wait until it shows Saved; then reload.
3. Add tags, pin the note, and create two more notes; check the order and the groups.
4. Search for a word from a note's body, then filter by tag.
5. Delete a note and confirm it.
6. Make the window narrow and check list → editor → back.
7. Sign in as another user and open `/api/notes/<id>` for a note that isn't theirs; it should return 404.
