# Jobs Page Redesign (follow-up only)

## Goal

Rebuild `/jobs` to match `design/jobs@2x.png` (source `design/jobs.html`). The scope stays follow-up only (the user confirmed: no scraped-offers tab). There are no API or schema changes: `/api/job-applications` (GET/POST manual, PATCH status/notes/markFollowedUp, DELETE) and `/api/recruiter-contacts` (CRUD + markContacted) cover the design.

## Skills read

- `.opencode/skills/react.md`, `tailwind.md`, `typescript.md`, `nextjs.md`
- Prompts 004/005 (jobs + follow-up reminders), 010 (design system), 013/014 (shared popups)

## Code inspected

- `src/app/(dashboard)/jobs/page.tsx` renders `FollowUpTab` (Applications / Recruiter Contacts tabs).
- `src/components/jobs/FollowUpTab.tsx` — manual application form, rows with a status select, notes textarea (saves on blur), "Mark followed up today", and a due banner.
- `src/components/jobs/RecruiterContactList.tsx` — contact CRUD, "Mark contacted today", and a due banner.
- `src/lib/validations.ts` — `manualApplicationSchema`, `jobApplicationUpdateSchema`, `recruiterContactSchema` (email/linkedin are `.optional()`, so an empty string fails; the old form couldn't save a contact with a blank email).
- The 3-day reminder rule lives server-side (`dueForFollowUp` flags on the list responses).

## Decisions and assumptions

1. **Header:** "Jobs" plus a description and a primary **Add application** button (on the Recruiters tab it reads **Add recruiter**).
2. **Stats:** Applied (status `applied`), Interviewing, Follow-ups due (applications + recruiters, amber), and Recruiters (count, with the number due).
3. **Due banner** (shown only when something is due): one chip per due application/recruiter with a **Done** action (mark followed up / contacted).
4. **Tabs:** Applications / Recruiters with counts and "N due" pills, plus an All / Open / Closed filter for applications (Open = applied/interviewing, Closed = rejected/accepted).
5. **Application row:**
   - A company monogram, the title (↗ when the URL is real, not `manual://`), the company, and a notes preview.
   - "Applied 12 Sep · 11 days ago · last follow-up 6d ago", plus "Follow up due".
   - A status pill that doubles as a menu to change status.
   - **Followed up** (soft amber when due; hidden for closed), plus edit and delete.
   - Closed rows are muted.
6. **Recruiter card:** initials, name, company, Email / Call / LinkedIn chips (`mailto:`, `tel:`, link), notes, last contact, and **Contacted**. Due cards are amber. Edit/delete sit in the card corner on hover/focus.
7. **Popups:**
   - Add application (Company, Job title, Applied on, Job URL).
   - Edit application (Status segmented control, Follow-up notes).
   - Add/edit recruiter (Name, Company, Email, Phone, LinkedIn URL, Notes).
   - Delete confirm for both.
8. Empty optional recruiter fields are sent as "not set", which fixes the blank-email validation bug. Clearing a previously-set optional field isn't supported by the current update schema (unchanged).
9. Marking followed up / contacted also refreshes the header bell count (`notificationsSummary`).
10. Old `FollowUpTab.tsx` / `RecruiterContactList.tsx` are replaced and removed.

## Expected files

- `src/app/(dashboard)/jobs/page.tsx`
- `src/components/jobs/JobsView.tsx`, `ApplicationRow.tsx`, `RecruiterCard.tsx`, `job-utils.ts` (**new**)
- `src/components/forms/ApplicationForms.tsx`, `RecruiterContactForm.tsx` (**new**)
- Deleted: `src/components/jobs/FollowUpTab.tsx`, `src/components/jobs/RecruiterContactList.tsx`

## Security considerations

No API changes; all routes are already session-scoped. External links use `rel="noreferrer"`.

## Acceptance criteria

- The page matches the reference.
- Add/edit/delete work for applications and recruiters; status changes from the pill; Followed up / Contacted reset the reminder; the banner and badges update.
- Lint shows no new errors; typecheck and build pass.

## Checks to run

`npm run lint`, `npm run typecheck`, `npm run build`, and screenshots with sample data.

## Manual test steps

1. Add an application dated 4+ days ago. It shows "Follow up due" and appears in the banner and the header bell.
2. Click **Followed up** (or **Done** in the banner). The due state clears.
3. Change status via the pill to Rejected. The row mutes and moves under **Closed**.
4. Add a recruiter with only a name and company. It saves (previously blocked). Mark contacted, then edit and delete.
