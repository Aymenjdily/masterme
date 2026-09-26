# Prisma Best Practices Skill

## When to use
Use this skill when working with database schema, queries, migrations, or Prisma Client operations.

## Core Principles

### Schema Design
- Use `@id @default(cuid())` for primary keys
- Use `@unique` for unique constraints
- Use `@relation` for relationships
- Use `@default(now())` for timestamps
- Use enums for fixed sets of values
- Use `@map` for custom table/column names

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
}
```

### Relationships
- **One-to-One**: Use `@relation` with `@unique` on one side
- **One-to-Many**: Use `@relation` on both sides
- **Many-to-Many**: Use implicit or explicit relation tables

```prisma
// One-to-Many
model User {
  posts Post[]
}

model Post {
  author   User @relation(fields: [authorId], references: [id])
  authorId String
}

// Many-to-Many (implicit)
model Post {
  categories Category[]
}

model Category {
  posts Post[]
}
```

### Queries

#### Find Operations
```tsx
// Find unique
const user = await prisma.user.findUnique({
  where: { id: "..." },
});

// Find first
const user = await prisma.user.findFirst({
  where: { email: "..." },
});

// Find many
const users = await prisma.user.findMany({
  where: { published: true },
  orderBy: { createdAt: "desc" },
  take: 10,
  skip: 0,
});
```

#### Include Relations
```tsx
const userWithPosts = await prisma.user.findUnique({
  where: { id: "..." },
  include: {
    posts: true,
  },
});

// Nested includes
const userWithPostsAndCategories = await prisma.user.findUnique({
  where: { id: "..." },
  include: {
    posts: {
      include: {
        categories: true,
      },
    },
  },
});
```

#### Select Specific Fields
```tsx
const user = await prisma.user.findUnique({
  where: { id: "..." },
  select: {
    id: true,
    email: true,
    name: true,
  },
});
```

#### Create Operations
```tsx
// Create single
const user = await prisma.user.create({
  data: {
    email: "user@example.com",
    name: "John",
  },
});

// Create with relations
const user = await prisma.user.create({
  data: {
    email: "user@example.com",
    posts: {
      create: {
        title: "My Post",
      },
    },
  },
});
```

#### Update Operations
```tsx
// Update single
const user = await prisma.user.update({
  where: { id: "..." },
  data: {
    name: "Updated Name",
  },
});

// Upsert (create or update)
const user = await prisma.user.upsert({
  where: { id: "..." },
  update: {
    name: "Updated Name",
  },
  create: {
    email: "user@example.com",
    name: "New User",
  },
});
```

#### Delete Operations
```tsx
// Delete single
const user = await prisma.user.delete({
  where: { id: "..." },
});

// Delete many
const deleted = await prisma.user.deleteMany({
  where: {
    published: false,
  },
});
```

### Transactions
```tsx
// Sequential transactions
const [user, post] = await prisma.$transaction([
  prisma.user.create({ data: { email: "..." } }),
  prisma.post.create({ data: { title: "..." } }),
]);

// Interactive transactions
await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: { email: "..." } });
  await tx.post.create({
    data: {
      title: "...",
      authorId: user.id,
    },
  });
});
```

### Migrations
- Run `npx prisma migrate dev` for development migrations
- Run `npx prisma migrate deploy` for production
- Run `npx prisma migrate reset` to reset database
- Always test migrations in development before production

### Prisma Client Setup
```tsx
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

## Common Patterns

### Pagination
```tsx
const PAGE_SIZE = 10;

async function getPosts(page: number) {
  const posts = await prisma.post.findMany({
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    orderBy: { createdAt: "desc" },
  });

  const count = await prisma.post.count();

  return {
    posts,
    totalPages: Math.ceil(count / PAGE_SIZE),
  };
}
```

### Filtering
```tsx
async function getPosts(filters: { published?: boolean; authorId?: string }) {
  const where = {
    ...(filters.published !== undefined && { published: filters.published }),
    ...(filters.authorId && { authorId: filters.authorId }),
  };

  return prisma.post.findMany({ where });
}
```

### Search
```tsx
async function searchPosts(query: string) {
  return prisma.post.findMany({
    where: {
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
      ],
    },
  });
}
```

## Anti-patterns to Avoid
- Don't create PrismaClient in every request (use singleton pattern)
- Don't use raw SQL when Prisma queries work
- Don't forget to handle cascade deletes
- Don't use `select` with `include` on same relation
- Don't forget to add indexes for frequently queried fields

## Resources
- Prisma Docs: https://www.prisma.io/docs
- Prisma Schema: https://www.prisma.io/docs/concepts/components/prisma-schema
- Prisma Client API: https://www.prisma.io/docs/reference/api-reference/prisma-client-reference
