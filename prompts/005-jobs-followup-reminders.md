# Jobs Follow-up: manual entries + 3-day reminders (applications & recruiters)

## Goal

Let the user manually log a job they applied to (not only via "Apply" on a scraped offer) and a recruiter they messaged, and surface an in-app reminder every 3 days since the last logged contact until they mark it followed-up.

## Skills read

- Same as `prompts/004-jobs-page.md` — this builds directly on that work.

## Code inspected

- `src/app/api/job-applications/route.ts` — `POST` currently only creates an application from an existing `jobOfferId` (the "Apply" button flow from a scraped `JobOffer`). No manual/standalone entry path.
- `src/components/jobs/FollowUpTab.tsx` — lists applications (joined to their `JobOffer`), editable status + follow-up notes, no reminder logic, no manual-add form.
- `src/components/jobs/RecruiterContactList.tsx` — plain CRUD, no "last contacted" tracking, no reminder.
- `prisma/schema.prisma` — `JobApplication` has no "last followed up" timestamp; `RecruiterContact` has no "last contacted" timestamp. `JobOffer.url` is required and `jobOfferSchema.source` is `enum(["linkedin", "indeed"])` — no `"manual"` source.

## Decisions and assumptions (please confirm)

1. **Manual application entry stays on the existing `JobOffer` + `JobApplication` shape** — no schema redesign needed. Adding a manual entry creates a `JobOffer` with `source: "manual"` (widening the enum) and a placeholder unique `url` (`manual://<generated-id>`) when the user doesn't paste a real one, then a `JobApplication` for it in the same transaction. This keeps one consistent list (scraped-then-applied and manually-entered both show up the same way) instead of a second parallel data model.
2. **Reminder cadence = recurring every 3 days since the last logged contact, not a one-time ping.** Concretely: `dueForFollowUp = now - (lastFollowUpAt ?? applicationDate) >= 3 days`, and it stays true (re-triggers) until the user logs a new follow-up action, which resets the clock. Only applies while the application is still "open" (`applied` or `interviewing` — not `rejected`/`accepted`).
3. **New field `JobApplication.lastFollowUpAt DateTime?`.** Set automatically at creation (`= applicationDate`) and updated whenever the user clicks a new "Mark followed up today" action (separate from editing the free-text notes, so logging a reminder doesn't require writing something).
4. **Same pattern for recruiters**: new field `RecruiterContact.lastContactedAt DateTime?`, set when the user clicks "Mark contacted today" (first click = "I messaged them", later clicks = "I followed up again"). No reminder shown until at least one contact is logged — matches "same for the recruiters... I send them too."
5. **Notification = in-app only**, not email/push (out of scope per AGENTS.md — "Notify the user" is listed as optional/later even for job offers, and there's no notification infra in this app). Surfaced as: a small "Needs follow-up" banner/list at the top of the Follow-up tab, plus a count badge on the "Follow-up" tab trigger itself so it's visible without opening the tab.
6. **"Mark followed up" doesn't require notes.** Editing `followUpNotes` (free text) and logging a follow-up date are separate actions — you can log "I followed up today" with one click, and optionally also write what you said.

## Expected files

- `prisma/schema.prisma` — add `JobApplication.lastFollowUpAt DateTime?`, `RecruiterContact.lastContactedAt DateTime?`
- `src/lib/validations.ts` — widen `jobOfferSchema`/relevant source enum to include `"manual"`; add `manualApplicationSchema` (`company`, `title`, `url?`, `appliedOn?`)
- `src/app/api/job-applications/route.ts` — `POST` accepts **either** `{ jobOfferId }` (existing Apply flow) **or** `{ company, title, url? }` (new manual flow); both paths end up creating a `JobOffer` (if needed) + `JobApplication`
- `src/app/api/job-applications/[id]/route.ts` — add a way to bump `lastFollowUpAt` (e.g. `{ markFollowedUp: true }` alongside existing `status`/`followUpNotes` PATCH body)
- `src/app/api/recruiter-contacts/[id]/route.ts` — same, add `{ markContacted: true }` handling to bump `lastContactedAt`
- `src/components/jobs/FollowUpTab.tsx` — add manual-entry form, "needs follow-up" banner, "Mark followed up today" button per row, badge count
- `src/components/jobs/RecruiterContactList.tsx` — add "Mark contacted today" button, "needs follow-up" indicator
- `src/app/(dashboard)/jobs/page.tsx` — tab trigger shows a small badge count of items due for follow-up

## Requirements

- `dueForFollowUp` computed server-side in the `GET` responses (`/api/job-applications`, `/api/recruiter-contacts`) so the client doesn't duplicate date-math logic — each item gets a `dueForFollowUp: boolean` field.
- Manual entry validates `company`/`title` required, `url` optional (auto-generated placeholder when omitted); still session/user-scoped like every other route.
- `@@unique([userId, url])` on `JobOffer` still holds — generated placeholder URLs are unique per creation (e.g. `manual://<cuid>`).

## Security considerations

- No new external calls; same session + userId scoping pattern throughout.

## Acceptance criteria

- Follow-up tab: "Add application" form (company, title, applied date, optional URL) creates an entry that shows up immediately, independent of the Jobs tab / scraper.
- An application/recruiter contact with no recent contact and 3+ days since `applicationDate`/`lastContactedAt` shows in the "needs follow-up" banner and the tab badge count.
- Clicking "Mark followed up today" / "Mark contacted today" clears it from the due list immediately; it reappears automatically 3 days later.
- Marking an application `rejected`/`accepted` removes it from the follow-up-due calculation entirely.
- Existing "Apply" flow from a scraped `JobOffer` (Jobs tab) still works unchanged and feeds the same Follow-up list.

## Checks to run

1. `npx prisma db push` (two additive nullable columns — will confirm with you if Prisma's safety gate triggers, though additive nullable fields haven't so far)
2. `npm run lint`
3. `npm run typecheck`
4. `npm run build`
5. `npm run dev` + manual test via temp account, including backdating an `applicationDate`/`lastContactedAt` in the DB to simulate "3 days have passed" (can't literally wait 3 days to test)

## Manual test steps

1. Follow-up tab → "Add application": company "Acme", title "Backend Engineer", applied today. Confirm it appears, not due yet.
2. Directly backdate that application's `applicationDate` to 4 days ago (via a one-off script, cleaned up after) → reload → confirm it now shows in the "needs follow-up" banner and the tab badge count increments.
3. Click "Mark followed up today" → confirm it disappears from the due list and `lastFollowUpAt` updates.
4. Mark the application "rejected" → confirm it no longer counts toward follow-up due, even if old.
5. Recruiter Contacts: add a contact, click "Mark contacted today", backdate `lastContactedAt` 4 days → confirm it shows due; mark contacted again → confirm it clears.
6. Confirm the existing "Apply" button on a Jobs-tab offer still creates an application that shows up in Follow-up.
