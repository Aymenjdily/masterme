# Settings Page Redesign (+ profile and security)

## Goal

Rebuild `/settings` to match `design/settings@2x.png` (source `design/settings.html`): Profile, Your stack and Security cards with a section nav. Profile (name) and Security (change password, sign out) are new; they use Better Auth's built-in endpoints, so there are no new API routes or schema changes.

## Skills read

- `.opencode/skills/nextjs.md`, `react.md`, `tailwind.md`, `typescript.md`
- Better Auth 1.7.5 (`updateUser`, `changePassword` with `revokeOtherSessions`, `signOut`; password length 8–128)
- Prompts 010 (design system), 019 (stack logos)

## Code inspected

- `src/app/(dashboard)/settings/page.tsx` — renders `SkillsEditor` only.
- `src/components/settings/SkillsEditor.tsx` — skills chips, add input, suggestions, `PATCH /api/user/skills`.
- `src/lib/auth.ts` — credentials only, 7-day sessions. `src/lib/auth-client.ts` — `createAuthClient`.
- `src/app/(dashboard)/layout.tsx` — the header gets `{name, email, image}` from the server session.

## Decisions and assumptions

1. **Page:** a server component reads the session and passes `{ name, email, image }` to a client `SettingsView`.
2. **Section nav:** Profile / Your stack / Security anchor links. The active item follows scroll (IntersectionObserver) with the amber bar; clicking smooth-scrolls.
3. **Profile:**
   - Avatar (`image` or `/images/avatar.png`), editable Name, Email read-only with a lock.
   - **Save profile** is primary only when the name changed (1–60 chars).
   - Calls `authClient.updateUser({ name })`, then `router.refresh()` so the header name updates. Shows "Saved" inline.
4. **Your stack** (the existing skills editor, restyled):
   - Logo chips (`StackLogo`) with remove, the add input (Enter or button, dedupe case-insensitively), and logo suggestion chips.
   - "Jobs" and "Tech radar" usage pills. Same `PATCH /api/user/skills`; also refreshes the tech-radar query.
5. **Security:**
   - Current / new / confirm password fields. Client checks: new must be 8–128 chars, confirm must match.
   - "Sign out of other devices" checkbox (on by default).
   - **Update password** is disabled until all three fields are filled.
   - Calls `authClient.changePassword`. A wrong current password shows under that field; success clears the fields and shows "Password updated".
   - "This device" row with **Sign out** (`authClient.signOut`, then back to the login page).
6. No avatar upload (no file storage in the app); no email change.

## Expected files

- `src/app/(dashboard)/settings/page.tsx`
- `src/components/settings/SettingsView.tsx`, `ProfileCard.tsx`, `SecurityCard.tsx` (**new**)
- `src/components/settings/SkillsEditor.tsx` (rewrite)

## Security considerations

- Password changes go through Better Auth with the current password required; nothing is stored client-side.
- Revoking other sessions is on by default after a password change.
- Only the signed-in user's own profile is editable (Better Auth scopes to the session).

## Acceptance criteria

- The page matches the reference.
- The name saves and the header updates; skills add/remove persist; the password changes with inline errors; sign-out works.
- Lint shows no new errors; typecheck passes. (No production build while the dev server is running; see the dev-cache issue.)

## Checks to run

`npm run lint`, `npm run typecheck`, and screenshots on the dev server with a seeded preview.

## Manual test steps

1. Change your name and save. The header shows the new first name.
2. Add "Docker" by typing and a suggestion by clicking; remove one. `/news` reflects the stack.
3. Change password with a wrong current password: an inline error appears. With the right one: "Password updated". Sign in again with the new password.
4. Click **Sign out**: you land on the login page.
