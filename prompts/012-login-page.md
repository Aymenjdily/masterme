# Login Page — simple card + shader background

## Goal

Rebuild the login page (`/`) to match `design/login@2x.png` exactly: one centered white card on an animated "shader" background made from the Amber Lens palette. Behavior (Better Auth credentials sign-in) stays the same.

## Skills read

- `.opencode/skills/nextjs.md`, `.opencode/skills/react.md`, `.opencode/skills/tailwind.md`, `.opencode/skills/typescript.md`
- Better Auth client (`authClient.signIn.email`)
- Design references: `design/login@2x.png` (source `design/login.html`), `design/masterme-design-system@2x.png`

## Code inspected

- `src/app/page.tsx` renders `LoginForm` from `src/components/shadcn-space/blocks/login-01/login.tsx`.
- `login.tsx` has a dark `bg-foreground` section with decorative circles, a `Card` with avatar, title, email/password, a submit button, and a "contact admin" note. Its state is `email`, `password`, `loading` and `error`; on success it runs `router.push("/dashboard")`.
- The UI primitives (`Card`, `Input`, `Button`, `Field*`, `Avatar`) are already on Amber Lens tokens.
- `src/app/globals.css` has Tailwind v4 `@theme inline` with design tokens.

## Decisions and assumptions

1. **Layout (from the reference):** full-screen page, card centered both ways.
   - Card: `max-w-[420px]`, `p-10`, `rounded-[20px]`, translucent white (`bg-card/90` + `backdrop-blur-md`), white border, deeper shadow.
2. **Card content, top to bottom:**
   - 64px avatar with amber ring.
   - "Welcome to MasterMe" (24px, semibold) and "Sign in to your account" (muted).
   - The error banner, only when there's an error.
   - Email field, then password field with a show/hide eye button.
   - Full-width amber **Sign in** button.
   - Muted note: "Personal project, contact admin for access."
3. **Shader background:** pure CSS, no WebGL or library.
   - Five large blurred blobs in `info` (sky), `primary` (amber), `success` (olive), `stone` and a soft amber center glow over `background`, plus an SVG-noise grain overlay.
   - Each blob drifts slowly on its own keyframes (20–28s, alternate).
   - `motion-reduce:animate-none` keeps it still for reduced-motion users.
   - Lives in its own component, `ShaderBackground`, so other auth screens can reuse it.
4. **Error:** a single generic banner (`role="alert"`) showing Better Auth's message, falling back to "Invalid email or password." It never says which field was wrong.
5. **Loading:** all fields are wrapped in a `<fieldset disabled>`, so inputs, the toggle and the button disable together. The button shows a spinner and "Signing in…", and double-submit is impossible.
6. **Password toggle:** a real `<button type="button">` with `aria-label` "Show password" / "Hide password" and `aria-pressed`.
7. Autocomplete hints: `autoComplete="email"` / `"current-password"`, and `autoFocus` on email.
8. No sign-up, social login or forgot password (not in scope).

## Expected files

- `src/components/shadcn-space/blocks/login-01/login.tsx` — rewritten to match the reference
- `src/components/auth/shader-background.tsx` — **new**
- `src/app/globals.css` — blob keyframes (`@theme` animations) + `bg-grain` utility

## Security considerations

- Credentials go only to Better Auth's same-origin endpoint, as before.
- The generic error message avoids revealing which emails have accounts.
- No secrets in the client.

## Acceptance criteria

- `/` matches `design/login@2x.png`: centered card, shader background, amber button, amber focus ring.
- A wrong password shows the generic banner; the loading state disables the form.
- A successful sign-in lands on `/dashboard`.
- The background animates slowly, and stays still with reduced motion.
- Lint shows no new errors; typecheck and build pass.

## Checks to run

`npm run lint`, `npm run typecheck`, `npm run build`, plus screenshots of `/` at 1440×900 and 390×844.

## Manual test steps

1. Open `/` signed out. It should match the reference.
2. Submit a wrong password. The red banner appears and the fields stay filled.
3. Submit the correct credentials. The button shows "Signing in…", then lands on `/dashboard`.
4. Click the eye icon. The password toggles visible and hidden.
5. Turn on OS "reduce motion". The background stops moving.
