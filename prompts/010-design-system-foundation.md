# Design System Foundation — Amber Lens (light-first)

## Goal

Implement the **Amber Lens** design system (reference: `design/masterme-design-system@2x.png`, source `design/masterme-design-system.html`) at the foundation level: color tokens, fonts, radius/shadow tokens, and the shared UI components. After this, every page picks up the new look automatically through tokens, and the next step is redesigning pages one by one on top of these components.

This task does **not** redesign page layouts. It changes tokens, primitives, and the few places with hardcoded colors.

## Skills read

- `.opencode/skills/tailwind.md` — utility-first, tokens over custom CSS, `dark:` variant
- `.opencode/skills/react.md`, `.opencode/skills/typescript.md` — component + `cva` variant typing
- `.opencode/skills/nextjs.md` — root layout, `next/font`
- Shadcn UI conventions (`components.json`: style `base-nova`, Base UI primitives, CSS variables, Tailwind v4 `@theme inline`)
- Local Next.js docs: `01-app/01-getting-started/13-fonts.md`, `01-app/03-api-reference/02-components/font.md` (`variable` option for CSS-variable fonts)

## Code inspected

- `src/app/globals.css` — stock shadcn neutral tokens (grayscale OKLCH). `@theme inline` maps `--font-sans: var(--font-sans)` (self-reference, effectively unset) and `--font-mono: var(--font-geist-mono)` (never loaded).
- `src/app/layout.tsx` — Poppins via `next/font/google` applied with `className`; no mono font.
- `src/components/ui/button.tsx`, `input.tsx`, `card.tsx`, `tabs.tsx`, `checkbox.tsx`, `skeleton.tsx`, `sidebar.tsx` — all token-driven (`bg-primary`, `border-input`, `ring-ring`, `bg-muted`…), so token changes restyle them. Sizes are shadcn defaults (button/input `h-8`), smaller than the reference (40px / 42px).
- `src/components/shadcn-space/blocks/sidebar-06/app-sidebar.tsx`, `nav-main.tsx` — app navigation.
- `src/app/(dashboard)/layout.tsx` — shell uses `bg-muted` wrapper, `bg-background` header/main.
- Hardcoded Tailwind palette colors (13 usages) in: `projects/ProjectCard.tsx`, `jobs/FollowUpTab.tsx`, `jobs/RecruiterContactList.tsx`, `timeline/TimeBlockSlot.tsx`, `shadcn-space/blocks/login-01/login.tsx`.
- No `Badge` component exists; status pills are hand-built spans with palette classes.
- No theme toggle / `next-themes`; `.dark` class is never applied.

## Decisions and assumptions

1. **Light is the default** (`:root`). `.dark` gets the "Ink" palette from the reference so dark mode is ready, but **no toggle is added** (not requested).
2. **Token mapping to shadcn names** (so existing components keep working):

   | Token | Light | Dark |
   |---|---|---|
   | `--background` | `#F6F4EF` chalk | `#15171F` |
   | `--foreground` | `#1B1E29` ink | `#F6F4EF` |
   | `--card` / `--popover` | `#FFFFFF` | `#222634` |
   | `--primary` / `-foreground` | `#E9B03F` / `#0E0F14` | same |
   | `--secondary`, `--muted`, `--accent` | `#EFECE5` (sunken / hover) | `#2D3243` |
   | `--muted-foreground` | `#5E6578` | `#9AA3B8` |
   | `--border` / `--input` | `#1B1E29` @ 8% / 15% | white @ 8% / `#3A4056` |
   | `--ring` | `#C98A1E` | `#E9B03F` |
   | `--destructive` | `#E0654F` | `#E0654F` |
   | `--sidebar` / `--sidebar-accent` | `#FBFAF7` / `#FFFFFF` | `#1B1E29` / `#2D3243` |
   | `--chart-1..5` | amber, sky, olive, clay, violet | same |

   `--accent` stays a quiet hover surface (shadcn uses it for menu hover). Stone `#D9CBB5` becomes its own token, `--stone`.
3. **New semantic tokens**, exposed as Tailwind utilities through `@theme inline`. Each has a fill color plus a darker `-strong` text shade that stays readable on light backgrounds (the reference's "fill / text on light" row):
   - `info` `#5B9DE6` / `info-strong` `#2F6FB8` (links, "new")
   - `success` `#7E9A62` / `success-strong` `#4E6B35`
   - `warning` `#E9B03F` / `warning-strong` `#9A6710`
   - `destructive-strong` `#B8432F`
   - `special` `#A67BE5` / `special-strong` `#7A4FC0` (interviewing)
   - `stone` `#D9CBB5` / `stone-strong` `#6B5A3E` (tags)

   In `.dark`, the `-strong` shades switch to the light tints (`#A9CBF2`, `#A9C98C`, …) so the same classes work in both themes.
4. **Fonts:** load Poppins with `variable: "--font-poppins"` and JetBrains Mono with `variable: "--font-jetbrains-mono"`. Map `@theme` `--font-sans` and `--font-mono` to them. `font-mono` is used for numbers, money and times.
5. **Radius:** base `--radius: 0.625rem` (10px) is unchanged; it already matches.
6. **Shadow:** add `--shadow-card: 0 1px 2px #1B1E290A, 0 4px 16px #1B1E290D` (as `shadow-card`), and `none` in dark mode.
7. **Component sizes match the reference:** Button default `h-10`, `sm` `h-8`, `lg` `h-11`, `xs` stays. Input `h-10`. This will make controls on current pages slightly taller; that's intended, since pages get redesigned next.
8. **Badge:** add `src/components/ui/badge.tsx` (shadcn-style `cva`) with variants `neutral | info | warning | special | success | destructive`, each an optional dot pill. Add `src/lib/status-styles.ts`, which maps job status, project type/status and time-block status to Badge variants, so pages don't duplicate the mapping.
9. **No new primitives beyond Badge.** Switch, Select and similar get added only when a page needs them (don't overbuild).
10. **Dashboard shell:** only recolor. Wrapper `bg-muted` becomes `bg-background`, and header/main use `bg-card` + `border` + `shadow-card`. Layout structure is unchanged (page phase).

## Expected files

- `src/app/globals.css` — new `:root` / `.dark` tokens, semantic tokens, `@theme inline` mappings, fonts, shadow
- `src/app/layout.tsx` — Poppins + JetBrains Mono as CSS variables
- `src/components/ui/button.tsx` — variants (primary amber + glow hover, `outline` white bordered, `secondary` sunken, `ghost`, `destructive` clay tint, new `info` sky, `link` sky-strong) and sizes
- `src/components/ui/input.tsx` — `h-10`, card background, amber focus ring (4px `ring-ring/25`), clay error ring
- `src/components/ui/card.tsx` — `rounded-2xl`, `border` + `shadow-card` instead of `ring-foreground/10`
- `src/components/ui/tabs.tsx` — sunken track; active tab white + shadow + inset amber underline
- `src/components/ui/checkbox.tsx` — checked amber with ink check mark (tokens already do most of it, sizing to 18px, radius 5px)
- `src/components/ui/badge.tsx` — **new**
- `src/lib/status-styles.ts` — **new**
- `src/components/shadcn-space/blocks/sidebar-06/nav-main.tsx` — active item: white surface, soft shadow, amber left indicator, amber icon
- `src/app/(dashboard)/layout.tsx` — shell recolor
- `src/components/projects/ProjectCard.tsx`, `jobs/FollowUpTab.tsx`, `jobs/RecruiterContactList.tsx`, `timeline/TimeBlockSlot.tsx`, `shadcn-space/blocks/login-01/login.tsx` — replace palette classes with Badge / semantic tokens

## Requirements

- No hardcoded Tailwind palette colors (`amber-100`, `blue-800`, …) left in `src/` after this change. Only tokens.
- Every component still works with `.dark` applied (tokens swap; no light-only hex in class names).
- Amber appears only on primary actions, active/focus states and warnings (design principle 01). Sky is for info/links, never primary actions (principle 02).
- Keep existing component APIs (props, variant names) backward-compatible so current pages don't break. `outline`, `secondary`, `ghost`, `destructive`, `link` and all sizes still exist.
- Text contrast on light backgrounds: body text ≥ 4.5:1 (ink on chalk and the `-strong` shades on their 10–15% tints all pass).

## Security considerations

- Styling-only change; no data, auth, or API surface touched.
- Fonts load through `next/font/google`, which self-hosts at build time, so no runtime request to Google from the browser.

## Acceptance criteria

- The login page and every dashboard page render on a chalk background with white cards, ink text, amber primary buttons and an amber focus ring.
- Sidebar active item matches the reference (white pill, amber indicator).
- Job status / project type / timeline status pills use the new Badge colors from the reference.
- Numbers can use `font-mono` and render in JetBrains Mono.
- `grep -rE "(red|green|blue|amber|emerald)-[0-9]" src` returns nothing.
- Lint, typecheck and build pass.

## Checks to run

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm run dev`, then open `/` (login) and the dashboard pages and compare against `design/masterme-design-system@2x.png`
5. Palette grep from the acceptance criteria

## Manual test steps

1. `npm run dev`, open `http://localhost:3000`. The login card is white on chalk, the sign-in button is amber, and focusing an input shows an amber ring.
2. Sign in. The sidebar is off-white; the active item is a white pill with an amber left bar.
3. `/projects` — type/status pills: SaaS amber, client neutral, active green, paused amber.
4. `/jobs`, Follow-up tab — the overdue banner uses warning tokens, not raw amber.
5. `/timeline` — in-progress and completed block statuses use warning/success colors.
6. Temporarily add `class="dark"` to `<html>` in DevTools. The app switches to the Ink palette with readable text, then remove it again.
