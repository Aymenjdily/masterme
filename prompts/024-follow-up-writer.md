# AI 02 — Smart follow-up writer

## Goal

Build the follow-up writer to match `design/follow-up-writer@2x.png` (source `design/follow-up-writer.html`).

For a job application or a recruiter, the AI decides:
- **what to say**,
- **the language**,
- **the tone**.

It then drafts the message. You edit it, then copy it or open it in your email app. Nothing is ever sent by MasterMe.

## Skills read

- `.opencode/skills/nextjs.md`, `react.md`, `typescript.md`, `tailwind.md`
- Prompts 022 (AI foundation), 023 (Paste anything), 017 (Jobs), 021 (Dashboard)

## Code inspected

- `src/lib/ai/*` (decide, generateObject, gate, log), `src/components/ai/*` (ConfidenceMeter, PasteAnything patterns, toast)
- Jobs:
  - `ApplicationRow` and `RecruiterCard`;
  - `api/job-applications/[id]` PATCH (`markFollowedUp`) and `api/recruiter-contacts/[id]` PATCH (`markContacted`);
  - `lib/follow-up.ts` (3-day rule).
- Dashboard `FollowUpsWidget`.
- Data used: application → offer title, company, location, status, applied date, last follow-up, notes. Recruiter → name, company, email, LinkedIn, notes, last contact. User → name, skills.

## Decisions and assumptions

1. **Entry points:** a **Draft** button (sparkle) in three places:
   - open application rows (status applied or interviewing);
   - every recruiter card;
   - each row of the dashboard Follow-ups widget.

   It's amber-highlighted when the follow-up is due.
2. **One route:** `POST /api/ai/follow-up` with `{ target: "application" | "recruiter", id, action?, language?, tone?, channel?, shorter?, force? }`.
   - The server loads the record, scoped to the user. It never trusts details sent by the browser.
   - **Decisions** run in one `decide()` call; any value you already chose is skipped:
     - `action`, a choice of: ask about next steps, thank for the interview, share an update or new work, polite check-in, wait;
     - `language`, English or Français, judged from company, location and notes;
     - `tone`, friendly or formal.
   - If the AI picks **wait** and you didn't press "Write anyway", the server returns the wait state without drafting.
   - Otherwise **`generateObject`** writes `{ subject, body }`:
     - email: a subject plus 60–130 words;
     - LinkedIn: no subject, at most 300 characters (checked, and retried once if too long);
     - it's signed with your name;
     - it never invents facts, numbers, salaries or dates. It only uses what's in the record.
3. **Wait reason:** the text ("You applied yesterday… comes back on Sat 26 Sep") is worked out from the dates, not written by the AI, so it's always correct.
4. **Channel:**
   - Recruiter: Email when they have an email address, otherwise LinkedIn.
   - Application: Email by default, with no recipient.
   - Buttons: **Open in email** (a `mailto:` link, only when a recruiter email exists) and **Open profile** (the LinkedIn URL).
5. **Change / Rewrite / Shorter** call the route again with your choices fixed. Each call is logged.
6. **Copy & mark followed up / contacted:**
   - Copies to the clipboard, then uses the existing PATCH, which restarts the 3-day reminder.
   - **Undo** restores the previous date. This needs one small addition, `restoreFollowUpAt` / `restoreContactedAt` (ISO or null), on the two existing update schemas.
7. **Log outcomes:**
   - `accepted`: copied unchanged;
   - `edited`: copied after edits;
   - `rejected`: closed without copying, or undone.
   - Decisions also record whether you changed what to say, the language or the tone.
8. **Rate limit:** 40 AI events per 10 minutes for `followup.*`, the same method as Paste anything.

## Expected files

- `src/lib/ai/follow-up.ts` (questions, prompt, schemas, wait text) and `src/app/api/ai/follow-up/route.ts`
- `src/components/ai/FollowUpWriter.tsx` (dialog and states) and `DraftButton.tsx`
- Edits:
  - `ApplicationRow`, `RecruiterCard`, dashboard `widgets.tsx` (Draft button);
  - `lib/validations.ts` + the two PATCH routes (restore date for Undo);
  - move the shared toast out of `PasteButton` into `src/components/ai/Toast.tsx` so both features use it.

## Security considerations

- Session required; the record is loaded with `userId`, so drafting someone else's data isn't possible.
- Only the fields listed above are sent to OpenAI. The log stores type, choices and outcome, never the draft text.
- Nothing is sent to anyone. `mailto:` just opens your own email app.

## Acceptance criteria

- Matches the board: main email draft, entry buttons, writing, too soon, LinkedIn, change menu, copied toast and error.
- A French-context application gets a French draft; a recruiter with no email gets LinkedIn.
- A draft never contains numbers or facts that aren't in the record.
- Copy & mark restarts the reminder, and Undo restores it.
- Lint shows no new errors; typecheck and build pass.

## Checks to run

`npm run lint`, `npm run typecheck`, `npm run build` (dev server stopped first), plus a real-API run on your data with screenshots of each state.

## Manual test steps

1. On `/jobs`, click **Draft** on a due application. Check what the AI suggests, the language and tone, and the draft.
2. Switch to LinkedIn: it's shorter with a character counter. Click Shorter, then Rewrite.
3. **Change** → pick "Thank them for the interview". The draft is rewritten.
4. **Copy & mark followed up** → paste somewhere to check; the row is no longer due. Click **Undo** and it's due again.
5. Draft for an application added today: it shows "Wait"; "Write anyway" still drafts.
6. On a recruiter card with an email, **Open in email** opens your mail app with the subject and body filled in.
