# Next.js Best Practices Skill

## When to use
Use this skill when working with Next.js App Router, server components, server actions, routing, middleware, or API routes.

## Core Principles

### App Router Structure
- Use `app/` directory for all routes
- Use route groups `(group)` for layout organization without affecting URL
- Use dynamic routes `[param]` for dynamic segments
- Use catch-all routes `[...slug]` for multiple segments
- Use optional catch-all routes `[[...slug]]` for optional segments

### Server vs Client Components
- **Server Components** (default): Use for data fetching, accessing backend resources, keeping sensitive data on server
- **Client Components**: Add `"use client"` directive at top. Use for interactivity, browser APIs, state, effects

```tsx
// Server Component (default)
export default async function Page() {
  const data = await fetch("...");
  return <div>{data}</div>;
}

// Client Component
"use client";
import { useState } from "react";
export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

### Data Fetching
- Fetch data in Server Components when possible
- Use `async/await` in Server Components
- Cache data with `revalidatePath` or `revalidateTag`
- Use React Query for client-side data fetching and mutations

```tsx
// Server Component with data fetching
export default async function Page() {
  const data = await prisma.user.findMany();
  return <UserList users={data} />;
}
```

### Server Actions
- Use for form submissions and mutations
- Add `"use server"` directive at top of function
- Validate input with Zod
- Revalidate paths after mutations

```tsx
"use server";
import { revalidatePath } from "next/cache";

export async function createUser(formData: FormData) {
  const data = Object.fromEntries(formData);
  await prisma.user.create({ data });
  revalidatePath("/users");
}
```

### Middleware
- Use `middleware.ts` in root for request/response manipulation
- Protect routes with Clerk middleware
- Match specific routes with `matcher` config

### API Routes
- Use `route.ts` files in `app/api/` directory
- Export HTTP method handlers (GET, POST, PUT, DELETE, PATCH)
- Return Response objects

```tsx
export async function GET() {
  const data = await fetchSomething();
  return Response.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const result = await createSomething(body);
  return Response.json(result, { status: 201 });
}
```

### Metadata
- Use `generateMetadata` for dynamic metadata
- Export static `metadata` object for static metadata
- Use `viewport` export for viewport configuration

### Error Handling
- Use `error.tsx` for error boundaries
- Use `not-found.tsx` for 404 pages
- Use `global-error.tsx` for root error boundary

### Loading States
- Use `loading.tsx` for loading UI
- Use Suspense for granular loading states

## Common Patterns

### Protected Routes with Clerk
```tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function ProtectedPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return <div>Protected content</div>;
}
```

### Search Params
```tsx
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>;
}) {
  const { query } = await searchParams;
  return <div>Query: {query}</div>;
}
```

## Anti-patterns to Avoid
- Don't use `getServerSideProps` or `getStaticProps` (Pages Router)
- Don't fetch data in Client Components when Server Components work
- Don't put sensitive data in Client Components
- Don't use `useEffect` for data fetching in Client Components (use React Query)
- Don't mix Pages Router and App Router patterns

## Resources
- Read local Next.js docs: `node_modules/next/dist/docs/`
- Next.js App Router: https://nextjs.org/docs/app
- Clerk Next.js: https://clerk.com/docs/quickstarts/nextjs
