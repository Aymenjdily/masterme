# TypeScript Best Practices Skill

## When to use
Use this skill when defining types, interfaces, or working with TypeScript in the project.

## Core Principles

### Type Definitions
- Use `interface` for object shapes
- Use `type` for unions, intersections, and complex types
- Use `enum` for fixed sets of values (prefer const enums or string literals)
- Use `as const` for literal types

```tsx
// Interface
interface User {
  id: string;
  name: string;
  email: string;
}

// Type alias
type Status = "active" | "inactive" | "pending";

// Union type
type Result = Success | Error;

// Const assertion
const ROLES = ["admin", "user", "guest"] as const;
type Role = typeof ROLES[number];
```

### Function Types
- Type function parameters and return values
- Use generics for reusable functions
- Use overloads for complex function signatures

```tsx
// Basic function type
function greet(name: string): string {
  return `Hello, ${name}`;
}

// Generic function
function getFirst<T>(items: T[]): T | undefined {
  return items[0];
}

// Function type alias
type Handler = (event: Event) => void;
```

### Props Typing
- Define props interfaces
- Use destructuring with types
- Make optional props explicit

```tsx
interface ButtonProps {
  variant: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  onClick: () => void;
  children: React.ReactNode;
}

export function Button({ variant, size = "md", onClick, children }: ButtonProps) {
  return <button onClick={onClick}>{children}</button>;
}
```

### Generics
- Use generics for reusable components and functions
- Constrain generics when needed
- Use generic defaults

```tsx
// Generic component
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}

function List<T>({ items, renderItem }: ListProps<T>) {
  return <>{items.map(renderItem)}</>;
}

// Generic with constraint
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

### Type Guards
- Use type guards for type narrowing
- Use `typeof`, `instanceof`, and custom type guards

```tsx
// typeof
if (typeof value === "string") {
  console.log(value.toUpperCase());
}

// Custom type guard
interface Fish {
  swim: () => void;
}

interface Bird {
  fly: () => void;
}

function isFish(pet: Fish | Bird): pet is Fish {
  return (pet as Fish).swim !== undefined;
}

if (isFish(pet)) {
  pet.swim();
}
```

### Utility Types
- Use built-in utility types
- `Partial<T>`, `Required<T>`, `Readonly<T>`, `Pick<T, K>`, `Omit<T, K>`

```tsx
interface User {
  id: string;
  name: string;
  email: string;
}

// Partial - all properties optional
type UpdateUser = Partial<User>;

// Required - all properties required
type RequiredUser = Required<User>;

// Pick - select properties
type UserPreview = Pick<User, "id" | "name">;

// Omit - exclude properties
type UserWithoutEmail = Omit<User, "email">;
```

## Common Patterns

### API Response Types
```tsx
interface ApiResponse<T> {
  data: T;
  error?: string;
  status: number;
}

async function fetchUser(id: string): Promise<ApiResponse<User>> {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}
```

### Form Data Types
```tsx
interface FormData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

function handleSubmit(data: FormData) {
  console.log(data);
}
```

### Event Types
```tsx
function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
}

function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
  console.log(event.target.value);
}
```

### Context Types
```tsx
interface ThemeContextType {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
```

## Anti-patterns to Avoid
- Don't use `any` (use `unknown` or proper types)
- Don't use type assertions (`as`) unless necessary
- Don't use non-null assertion (`!`) unless certain
- Don't use `@ts-ignore` (fix the type error instead)
- Don't over-use generics (keep it simple)
- Don't forget to type function parameters

## Resources
- TypeScript Docs: https://www.typescriptlang.org/docs
- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook
- React TypeScript Cheatsheet: https://react-typescript-cheatsheet.netlify.app
