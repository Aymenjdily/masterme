# Projects Page Redesign

## Goal

Rebuild `/projects` to match `design/projects@2x.png` (source `design/projects.html`). There are no API or schema changes: `/api/projects` (CRUD + OG preview on save), `/api/projects/[id]/billing`, `/api/project-billing/[id]`, `/api/projects/[id]/neon-cost`, `/api/neon/projects` and `/api/monthly-costs/apps-summary` cover the design.

## Skills read

- `.opencode/skills/react.md`, `tailwind.md`, `typescript.md`, `nextjs.md`
- Prompts 006 (projects + billing), 009 (Neon), 010 (design system), 013–017 (shared popups/patterns); the Vercel shared-plan rule (one flat $20/mo)

## Code inspected

- `src/app/(dashboard)/projects/page.tsx` — inline add form and a card grid.
- `src/components/projects/ProjectCard.tsx` — preview, badges, revenue/infra text, inline edit, an "Infra cost" expander, and delete without confirmation.
- `src/components/projects/ProjectBillingSheet.tsx` + `forms/BillingForm.tsx` — income side sheet.
- `src/components/forms/ProjectForm.tsx` — project fields, Neon picker, Vercel checkbox, first build cost / monthly revenue.
- `projectSchema.url` is `url().optional()`, so an empty string fails. The old form couldn't save without a URL.

## Decisions and assumptions

1. **Stats:**
   - Active projects ("N of M" plus a type split).
   - One-time income and Monthly recurring (sum of billings per currency, green).
   - Monthly infra (linked monthly costs per currency plus the apps-summary USD total, which counts Vercel once; red).
2. **Filters:** type tabs (All/Client/Personal/SaaS with counts) and status chips (Any/Active/Paused/Completed).
3. **Card:**
   - The preview image (or a tinted monogram + "No preview image") with type/status badges on it; edit/delete float on the image on hover/focus.
   - The title (↗ when a URL is set), "Client · name" for client projects, and a 2-line description.
   - A One-time / Monthly / Infra strip in mono; infra = linked costs + Neon estimate.
   - Neon / "Vercel shared" chips and an **Income · N** button.
4. **New/edit project:** a wide popup (`FormDialog` gets an optional `className`).
   - Main fields: Title, Client name (client only), Type and Status segmented controls, Live URL, Description.
   - **Hosting** section: Neon select + Vercel checkbox ("shared $20/mo plan").
   - **First income** section (new projects only): build cost, monthly revenue, currency; creates billing records after the project.
   - Empty optional fields are sent as "not set" (fixes the empty-URL bug).
5. **Income popup** (replaces the side sheet):
   - One-time and monthly totals.
   - Records with a type tag, description, date and amount; edit inline in the popup; delete with an inline confirm.
   - **Add income record** opens the compact form in the popup.
6. **Delete project:** confirmation popup. Mutations also refresh the apps summary / monthly costs where relevant.
7. Removed: `ProjectBillingSheet.tsx`.

## Expected files

- `src/app/(dashboard)/projects/page.tsx`
- `src/components/projects/ProjectsView.tsx`, `IncomeDialog.tsx`, `project-utils.ts` (**new**)
- `src/components/projects/ProjectCard.tsx`, `src/components/forms/ProjectForm.tsx`, `src/components/forms/BillingForm.tsx` (rewrites)
- `src/components/ui-patterns/dialogs.tsx` — `FormDialog` `className`
- Deleted: `src/components/projects/ProjectBillingSheet.tsx`

## Security considerations

No API changes. The Neon key stays server-side; OG preview fetching stays server-side.

## Acceptance criteria

- The page matches the reference.
- Create/edit/delete projects; add/edit/delete income; the filters work.
- Totals are per currency; Vercel is never counted per project.
- Lint shows no new errors; typecheck and build pass.

## Checks to run

`npm run lint`, `npm run typecheck`, `npm run build`, and screenshots with sample data.

## Manual test steps

1. Create a client project with a live URL, build cost 35000 and monthly 4500. The card shows the preview (if the site exposes og:image), badges and money strip.
2. Create a project with no URL. It saves (previously blocked).
3. Open **Income**; add, edit and delete a record. Totals update.
4. Use the type tabs and status chips.
5. Delete a project (confirm).
