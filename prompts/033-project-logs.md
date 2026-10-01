# Project logs: a live terminal for every project on Vercel

## Goal

A new **/logs** page shows each project's errors, warnings and builds from Vercel in a terminal-style view, live while the page is open, so client issues show up while the user is working on something else. Every project card on /projects gets a Logs button. Design: `design/project-logs.png`.

## Skills read

`.opencode/skills/nextjs.md`, `prisma.md`, `react.md`, `tailwind.md`, `typescript.md`; local Next docs: `route.md` (streaming), `route-segment-config/maxDuration.md`; prompts 027 and 031 (the infra pattern).

## Code and API inspected

- **Schema:** `Project` has `neonProjectId` and `vercelHosting Boolean`, with no Vercel project link.
- **Places using `vercelHosting`:** `ProjectForm.tsx` (checkbox), `ProjectCard.tsx`, `validations.ts`, `types/index.ts`, `api/monthly-costs/apps-summary`.
- **Other code:**
  - `src/lib/neon.ts` is the pattern for a server-only API client;
  - the sidebar is `shadcn-space/blocks/sidebar-06/app-sidebar.tsx`;
  - the crons are in `vercel.json`.
- **Vercel API with your token** (`VERCEL_API_TOKEN` added to `.env.local`, gitignored):
  - team `aymenjdilys-projects` (`team_ocshhsgDE4oMtjjdW25HIJ7J`), plan **Hobby**, 83 projects;
  - **Log drains are not available on Hobby.**
  - `GET /v1/projects/{id}/deployments/{dpl}/runtime-logs` **works on Hobby**:
    - it is a live stream (`application/stream+json`), one JSON line per log: `level, message, source, timestampInMs, requestMethod, requestPath, domain, responseStatusCode, rowId`;
    - it has no history (only new lines) and a rate limit of 100 per window.
  - `GET /v6/deployments?projectId&target=production` returns state, created time and commit message; `/v3/deployments/{id}/events` returns build output.

## Decisions

1. **Linking:**
   - `Project` gets `vercelProjectId String?` and `vercelProjectName String?`.
   - In the project form, the "Hosted on Vercel" checkbox becomes a **Vercel project picker**, listed from the API and cached 10 minutes, server-side like the Neon picker.
   - Picking one also sets `vercelHosting = true`, so the Vercel cost logic is unchanged; choosing None leaves `vercelHosting` as it was.
2. **Saving logs:** a new `ProjectLog` model, scoped by userId and projectId:
   - fields: `level` (error | warn | build), `fingerprint`, `method`, `path`, `status`, `message` (≤ 4 KB, including the stack), `deploymentId`, `count`, `firstAt`, `lastAt`, `build` fields (`state`, `commit`, `branch`, `durationS`);
   - `@@unique([projectId, fingerprint])`;
   - grouping: fingerprint = level + path + the first line of the message with digits and ids normalised, per day; the same line again increments `count` and `lastAt`;
   - only errors (level error, or status ≥ 500) and warnings (level warn, or status 4xx) are saved; info lines are only passed to the open terminal;
   - `User.logsSeenAt` drives the "new since you last looked" count and the sidebar badge.
3. **Live stream (Hobby-friendly):** `GET /api/logs/stream?project=<id|all>` is a server-sent events route (`maxDuration = 300`):
   - for each of the user's linked projects (or the one selected), it finds the current production deployment and opens Vercel's runtime-logs stream;
   - it filters and saves lines as above, and forwards them to the browser;
   - before Vercel times out, it closes cleanly and the browser's `EventSource` reconnects; every reconnect re-checks for a newer deployment.
   - **Limit:** logs are only captured while a Logs page is open. This is stated on the page, as in the design.
4. **Builds:** `GET /api/logs?project=&level=&q=&since=` returns saved lines plus the last production deployments (from the deployments API, cached 60 s), saved as `build` rows so they have history even when the page wasn't open. Failed builds count in the "Builds · 24 h" card.
5. **Retention:** when a stream starts, error and warning rows older than 7 days and build rows older than 30 days are deleted for that user. No extra cron.
6. **UI** (matching the board):
   - `/logs` page:
     - 4 stat cards;
     - a project list with dot, count or "quiet", and a "Not linked" section;
     - the dark terminal: Errors / + Warnings / Builds / All, search, Last 24 h, Pause (still records in the background), grouped lines with a ×count;
     - a click opens the detail (stack, function, first and last time, Copy, Open in Vercel);
     - the footer shows the connection state;
     - empty states.
   - Sidebar: a "Logs" item with a red unseen badge.
   - Project card: the dark Logs button ("● n errors", "● Quiet", or "Link Vercel for logs").
   - The page is responsive: on small screens the project list becomes a select above the terminal.
7. **Tokens:** `src/lib/vercel.ts` is server-only, reads `VERCEL_API_TOKEN` and `VERCEL_TEAM_ID` (if unset, the team is detected once and cached). The browser only calls MasterMe routes.

## Expected files

- **Schema:** `prisma/schema.prisma`.
- **Server code:**
  - `src/lib/vercel.ts`, `src/lib/project-logs.ts` (filter, fingerprint, save, retention);
  - routes: `src/app/api/vercel/projects/route.ts`, `src/app/api/logs/route.ts`, `src/app/api/logs/stream/route.ts`, `src/app/api/logs/seen/route.ts`.
- **Page and components:**
  - `src/app/(dashboard)/logs/page.tsx`, `src/components/logs/LogsView.tsx`, `LogTerminal.tsx`, `LogLine.tsx`, `ProjectLogList.tsx`;
  - `src/components/projects/ProjectCard.tsx`, `src/components/forms/ProjectForm.tsx`;
  - the sidebar, `src/lib/validations.ts`, `src/types/index.ts`, `src/lib/query-keys.ts`.
- **Other:** `.env.example` (`VERCEL_API_TOKEN`, optional `VERCEL_TEAM_ID`).

## Security

- The token stays server-only, and every route checks the session.
- The stream only opens Vercel projects linked to the signed-in user's projects, and the `project` parameter is checked against the user's own projects.
- Messages are trimmed to 4 KB and rendered as text, never as HTML.
- Logs can contain user emails or ids from client apps; they're only visible to the user who owns the project.

## Acceptance criteria

- Linking a Vercel project in Edit project saves it. The card then shows the Logs button, and Apps & services still counts Vercel once.
- With /logs open, triggering an error or warning on a linked project shows the line within a few seconds; it's saved, and the count on the card or list updates.
- The same error repeated shows one line with ×n.
- Builds show the last production deployments with state and commit, including failed ones.
- Pause stops the screen from updating, and Resume shows what arrived in between.
- The stream reconnects on its own.
- An unlinked project shows the "Link Vercel" empty state.
- Another user's projects can't be streamed.
- Typecheck, lint and build are clean, and the schema is pushed.

## Checks

`npx prisma db push`, `npm run typecheck`, `npm run lint`, `npm run build` (with your dev server stopped), then a manual test against the live MasterMe deployment.

## Manual test

1. Restart dev. Go to /projects → Edit MasterMe → Vercel project: `masterme` → Save.
2. Open /logs: MasterMe is listed, and the Builds filter shows the last deployments.
3. In another tab, sign in on https://masterme-azure.vercel.app with a wrong password: a `WARN … User not found` line on `/api/auth/sign-in/email` appears within seconds. Do it again and you get ×2.
4. Pause, trigger again, then Resume: the line arrives.
5. Reload the page: saved lines are still there. The sidebar badge clears after viewing.

## Needs your attention (before build)

- The Vercel token was pasted in chat. Rotate it in Vercel → Account settings → Tokens after this works, and put the new one in `.env.local` and in Vercel's env vars.
- Your Vercel team is on **Hobby (free)**, but Apps & services counts Vercel at $20/mo. Not changed here unless you say so.
- Production needs `VERCEL_API_TOKEN` in Vercel's env vars.
