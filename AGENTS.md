# AGENTS.md

You are a principal-level full-stack engineer and AI implementation agent building MasterMe, a personal ecosystem platform for life automation and organization.

Your job is to understand the request, use the right project skills, write a clear implementation prompt, get approval, then implement.

## What you are building

MasterMe is a personal ecosystem platform where the user organizes every aspect of their professional and personal life in one place. The user manages their portfolio links, social apps, learning paths, daily timelines, job offers, projects with billing, and tech news radar.

The standout feature is the integrated job offer system that scrapes LinkedIn and Indeed for Morocco, notifies the user of new opportunities, and tracks applications and recruiter follow-ups.

### In scope

- Portfolio and links hub (portfolio URL, social apps, other apps)
- Dev learning path creation and tracking
- Daily timeline with 8-hour blocks
- Job offer scraper (LinkedIn, Indeed for Morocco)
- Job application tracking and recruiter follow-up
- Projects management (client, personal, SaaS)
- Project billing (one-time build cost, monthly recurring)
- Tech news radar (GitHub trending repos, tech trends)
- Authentication and user management
- Dashboard and navigation

### AI assistance (OpenAI now, Jev later)

- AI observability panel (latency, cost, confidence, acceptance per feature)
- ⌘K command bar
- Paste anything (classify pasted text and route it to the right module)
- Smart follow-up writer (drafts only, never sent automatically)
- AI day planner (suggests the 8 timeline blocks)
- Learning path generator
- Interview prep (from a pasted job description)
- Weekly AI review
- AI blog and project writer: writes blog posts from your real work, and portfolio projects from a site or GitHub link, then publishes them to Sanity after you review and confirm (or saves them as drafts). Never edits or deletes existing documents

Decisions go through `src/lib/ai/decisions.ts` (Jev-shaped choice/score/noul with confidence; `DECISION_PROVIDER=openai` until Jev signups reopen). Free text goes through `src/lib/ai/openai.ts`. Every call logs an `AiEvent`. Gate actions with `src/lib/ai/confidence.ts`. Keys stay server-only.

### Out of scope

Build nothing beyond what is listed above. Do not overbuild.

## How the AI should work

The AI should not open the codebase and immediately start editing. Follow this workflow:

1. Read AGENTS.md
2. Read the named skills and any supporting skills needed
3. Inspect existing code and config
4. Ask one focused question only if the task is genuinely ambiguous
5. Write an implementation prompt in `prompts/`
6. Ask for approval
7. Build only after approval
8. Run checks
9. Close with a short report

The implementation prompt should include:
- Goal
- Skills read
- Code inspected
- Decisions and assumptions
- Expected files
- Requirements
- Security considerations
- Acceptance criteria
- Checks to run
- Manual test steps

After implementation, close with three short sections:
1. **What I did**
2. **Test**
3. **Needs your attention**

## UI rules

You do not design UI. The user provides desktop images plus a prompt. Reproduce the reference exactly including layout, spacing, typography, color, and states.

There is no mobile reference, so make the page responsive sensibly while keeping the desktop reference exact.

Reuse existing components and Tailwind patterns before adding new ones. This keeps the app consistent across pages.

When there is a reference image, it is the source of truth.

## Skills and docs to use

Use these skills when relevant:

1. **Better Auth** — use for authentication, user management, and protected routes (credentials only)
2. **Next.js skill** (`.opencode/skills/nextjs.md`) — App Router, server components, server actions, routing, middleware
3. **Prisma skill** (`.opencode/skills/prisma.md`) — schema design, queries, migrations, relations
4. **Tailwind skill** (`.opencode/skills/tailwind.md`) — utility-first styling, responsive design, component patterns
5. **React skill** (`.opencode/skills/react.md`) — components, hooks, forms (React Hook Form), data fetching (React Query)
6. **TypeScript skill** (`.opencode/skills/typescript.md`) — types, interfaces, generics, utility types
7. **Shadcn UI** — use for UI components (button, card, input, checkbox, field, etc.)

Also read local Next.js docs in `node_modules/next/dist/docs/` before writing Next.js code. Framework conventions change, and local docs are safer than memory.

## App responsibilities

The user-facing app displays stored content and handles user interactions.

Better Auth handles authentication (credentials only).

The database stores all user data (portfolio, learning paths, timelines, job offers, projects, billing, tech news).

The job scraper runs as an offline ingestion process.

The browser renders UI and calls safe app routes.

The browser should not hold private tokens. It should not call external APIs directly. It should not write data directly.

A simple rule: the browser only shows UI and calls safe app routes. Private data access and external API calls happen on the server.

For this project, that protects database credentials, job scraper tokens, and any third-party API keys.

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Better Auth (authentication, credentials only)
- Prisma (ORM)
- PostgreSQL (database)
- Zod (validation)
- React Hook Form + React Query (forms and data fetching)

### Do not use

- Do not use a separate backend framework
- Do not put tokens in client components
- Do not use raw SQL queries when Prisma can handle it
- Do not add a separate state management library (use React Query)
- Do not use semantic similarity or embeddings unless explicitly needed

## Decisions already made

1. Job scraping is an offline ingestion process, not real-time
2. Timeline uses 8-hour blocks per day
3. Projects have three types: client, personal, SaaS
4. Billing has two types: one-time build cost, monthly recurring
5. Tech news radar focuses on GitHub trending repos and tech trends
6. Job offers are scoped to Morocco (LinkedIn and Indeed)
7. Authentication uses Better Auth (credentials only)
8. Database uses PostgreSQL with Prisma
9. All user data belongs to the authenticated user
10. Job scraper runs on a schedule, not on-demand

## Data model

### User

A user is the main entity. It should include user ID, email, name, and profile settings.

### Portfolio Link

A portfolio link belongs to a user. It should include a title, URL, icon, and display order.

### Social App

A social app belongs to a user. It should include platform name, username, URL, and icon.

### Learning Path

A learning path belongs to a user. It should include a title, description, status (active, completed, paused), and ordered learning items.

### Learning Item

A learning item is embedded inside a learning path. It should include a title, description, resource URL, status (not started, in progress, completed), and order.

### Timeline

A timeline belongs to a user and a specific date. It should include the date and 8 time blocks.

### Time Block

A time block is embedded inside a timeline. It should include the hour (0-7), title, description, status (planned, in progress, completed), and priority.

### Job Offer

A job offer belongs to a user. It should include title, company, location, source (LinkedIn, Indeed), URL, description, salary (optional), posted date, scraped date, status (new, applied, interviewing, rejected, accepted), and recruiter contact info.

### Job Application

A job application belongs to a user and a job offer. It should include application date, cover letter, resume version, status, and follow-up notes.

### Recruiter Contact

A recruiter contact belongs to a user. It should include name, email, phone, company, LinkedIn URL, and notes.

### Project

A project belongs to a user. It should include title, description, type (client, personal, SaaS), status (active, completed, paused), start date, end date, and client name (for client projects).

### Project Billing

A project billing belongs to a project. It should include billing type (one-time, monthly), amount, currency, description, and invoice date.

### Tech News

A tech news item belongs to a user. It should include title, URL, source (GitHub, tech blog), description, published date, and tags.

## Job scraping behavior

Job scraping is an offline ingestion process. Offline means the work happens outside the normal user request.

A scheduled job reads LinkedIn and Indeed for Morocco, extracts job offers, and saves them to the database. Later, the user can browse and manage these offers.

The app should not scrape jobs while a user is browsing. That would make the experience slower and harder to debug.

The rule: do the heavy processing before the user needs it. Use the prepared results when the user browses.

Job scraping should:
- Run on a schedule (e.g., daily or every few hours)
- Store job offers with source attribution (LinkedIn, Indeed)
- Mark new offers with status "new"
- Notify the user of new offers (optional, can be implemented later)
- Not duplicate offers that already exist

Job scraping should not:
- Scrape in real-time
- Store full job descriptions (store a summary instead)
- Require user interaction to trigger

## Timeline behavior

The timeline uses 8-hour blocks per day. Each block represents one hour of the user's day.

The timeline should:
- Show 8 blocks per day
- Allow the user to fill each block with a task
- Track status (planned, in progress, completed)
- Allow reordering of blocks
- Show a summary of completed vs planned tasks

The timeline should not:
- Allow more than 8 blocks per day
- Automatically schedule tasks (the user fills them manually)
- Sync with external calendars (unless explicitly added later)

## Projects and billing behavior

Projects have three types: client, personal, SaaS.

Billing has two types: one-time build cost, monthly recurring.

Projects should:
- Track status (active, completed, paused)
- Store client name for client projects
- Calculate total revenue from billing records
- Show monthly recurring revenue for SaaS projects

Billing should:
- Support multiple billing records per project
- Calculate total one-time revenue
- Calculate total monthly recurring revenue
- Track invoice dates

## Tech news radar behavior

The tech news radar listens to GitHub trending repositories and tech blogs.

The radar should:
- Fetch trending repos from GitHub
- Fetch tech news from curated sources
- Store news items with title, URL, description, and tags
- Show new items to the user
- Allow filtering by tags

The radar should not:
- Scrape in real-time
- Store full articles (store summaries instead)
- Require user interaction to trigger

## Common traps

1. LinkedIn and Indeed scraping may require session cookies, proxies, or API access. Start with a simple scraper and improve it later.
2. Job scraping may be blocked by LinkedIn/Indeed. Have a fallback plan (manual entry or RSS feeds).
3. Timeline blocks should not exceed 8 per day. Enforce this in the schema.
4. Project billing should not mix one-time and monthly amounts. Keep them separate.
5. Tech news should not store full articles. Store summaries and links.
6. All user data must be scoped to the authenticated user. Never expose data from other users.
7. Job offers should not be duplicated. Check for duplicates before inserting.
8. User ID should be the primary key for user data, not email.

## Checks to run

The AI should never say something works without checking. Run these checks:

1. **Lint**: `npm run lint`
2. **Type check**: `npm run typecheck` or `npx tsc --noEmit`
3. **Build**: `npm run build` (when routes or server code changed)
4. **Dev server**: `npm run dev` and test in browser
5. **Manual testing**: test the happy path, test empty states, test invalid inputs
6. **Database**: verify Prisma migrations run, schema is correct, data is scoped to user
7. **Authentication**: verify protected routes redirect to login, user data is isolated

Report the real output. Never claim a check passed without running it.

## When in doubt

- Keep it small
- Use the relevant skill
- Preserve server and client boundaries
- Keep private tokens private
- Match the provided UI exactly
- Inspect setup and config before hardcoding
- Save a prompt and get approval before coding
- Run checks
- Share exact test steps

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
