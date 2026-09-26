# Jobs — End a recruiter conversation

## Goal

Build "End conversation" for recruiters to match `design/end-conversation@2x.png` (source `design/end-conversation.html`).

You close a recruiter conversation with a reason (and an optional note). Its follow-up reminders stop everywhere. The contact and history are kept, and you can reopen it at any time.

## Skills read

- `.opencode/skills/nextjs.md`, `prisma.md`, `react.md`, `typescript.md`, `tailwind.md`
- Prompts 017 (Jobs), 024 (Follow-up writer), 025 (Day planner)

## Code inspected

- `RecruiterCard`, `JobsView` (tabs, filters, due banner, stats), `RecruiterContactForm`
- `api/recruiter-contacts` (GET with `dueForFollowUp`) and `[id]` (PATCH `markContacted`, `restoreContactedAt`)
- Places that count recruiter follow-ups:
  - `api/notifications/summary` (the bell),
  - the dashboard `FollowUpsWidget`,
  - `lib/ai/day-plan.ts`,
  - the Draft button.

## Decisions and assumptions

1. **Schema:** three nullable fields on `RecruiterContact`: `endedAt`, `endReason`, `endNote`.
   - Reasons: `offer`, `application`, `passed`, `not_interested`, `no_reply`, `other`.
   - Pushed with `npx prisma db push`; existing contacts stay open.
2. **API:** the PATCH on `recruiter-contacts/[id]` accepts:
   - `end: { reason, note? }` sets `endedAt` to now;
   - `reopen: true` clears the three fields and sets `lastContactedAt` to now, so the next reminder is in 3 days rather than immediately;
   - `restoreEnd` restores the previous values, for Undo.
   - Validated with zod and scoped to you.
3. **Reminders stop.** An ended recruiter is never `dueForFollowUp`, and it is left out of:
   - the bell count,
   - the dashboard Follow-ups widget,
   - the Jobs due banner and the "Follow-ups due" stat,
   - the day planner.
4. **Card:**
   - A "⋯" menu with Edit / End conversation / Delete replaces the hover pencil and trash buttons.
   - Ended cards are muted and show the reason tag, your note, "Ended 21 Sep", and **Reopen** instead of Draft / Contacted.
5. **Dialog:** "End conversation with {name}":
   - 6 reason tiles in a 2-column grid, an optional note (max 300 characters), and "Last contact Xd ago" in the footer;
   - **Moved to an application** adds a checkbox, "Also add an application at {company}". Continue opens the existing Add application form with the company filled in, and ends the conversation after the application is saved.
6. **Filters:** the Recruiters tab gets All / Open / Ended (**Open** by default), with the Ended count shown. The Recruiters stat shows "3 open · 2 ended".
7. **Toasts:** "Conversation ended · {name} · Undo" and "Reopened · next follow-up {date} · Undo".

## Expected files

- `prisma/schema.prisma` (3 fields)
- `src/lib/validations.ts` (`end`, `reopen`, `restoreEnd` on the recruiter update schema)
- `src/app/api/recruiter-contacts/route.ts`, `[id]/route.ts`, `api/notifications/summary/route.ts`, `src/lib/ai/day-plan.ts` (skip ended)
- `src/components/jobs/RecruiterCard.tsx` (menu, ended state), `src/components/jobs/EndConversationDialog.tsx` (new), `JobsView.tsx` (filters, stats, banner), `ApplicationForms.tsx` (optional company prefill)
- `src/types/index.ts` (`RecruiterContact` fields)

## Security considerations

Session required; the update is scoped to your own contact; reasons are validated against a fixed list; the note is plain text, max 300 characters.

## Acceptance criteria

- Matches the board: dialog, card menu, ended cards, "Moved to an application" option, toasts, filters.
- Ending one due recruiter: it drops out of the due banner, the stat, the bell and the dashboard at once. Undo brings it back.
- Reopen: the card is open again and the next reminder is 3 days out.
- Lint shows no new errors; typecheck and build pass; the schema is pushed.

## Checks to run

`npx prisma db push`, `npm run lint`, `npm run typecheck`, `npm run build`, plus a browser run of end → undo → end → reopen on a test contact (deleted afterwards).

## Manual test steps

1. Jobs → Recruiters → ⋯ on a card → **End conversation** → pick "No reply", add a note → End. The card leaves "Open"; "Ended" shows it with the reason and note.
2. Toast **Undo**: it's open again.
3. End it again, then **Reopen** from the Ended filter: it's open, with the next follow-up 3 days out.
4. Pick "Moved to an application" with the checkbox: the Add application form opens with the company filled in; save it, and the contact shows as ended.
