# React Best Practices Skill

## When to use
Use this skill when building components, managing state, handling forms, or working with React patterns.

## Core Principles

### Component Structure
- Use functional components with hooks
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use TypeScript for type safety

```tsx
// Good
interface UserCardProps {
  name: string;
  email: string;
}

export function UserCard({ name, email }: UserCardProps) {
  return (
    <div>
      <h3>{name}</h3>
      <p>{email}</p>
    </div>
  );
}
```

### State Management
- Use `useState` for local component state
- Use `useReducer` for complex state logic
- Use Context for shared state across components
- Use React Query for server state

```tsx
// Simple state
const [count, setCount] = useState(0);

// Complex state
const [state, dispatch] = useReducer(reducer, initialState);

// Context
const ThemeContext = createContext<ThemeContextType>(defaultTheme);

// React Query
const { data, isLoading } = useQuery(["users"], fetchUsers);
```

### Effects
- Use `useEffect` for side effects
- Always clean up subscriptions and timers
- Don't use effects for data fetching (use React Query)

```tsx
useEffect(() => {
  const subscription = subscribeToData();
  return () => subscription.unsubscribe();
}, []);
```

### Forms with React Hook Form
- Use React Hook Form for form management
- Validate with Zod
- Use controlled inputs when needed

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type FormData = z.infer<typeof schema>;

export function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: FormData) => {
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("email")} />
      {errors.email && <span>{errors.email.message}</span>}
      
      <input type="password" {...register("password")} />
      {errors.password && <span>{errors.password.message}</span>}
      
      <button type="submit">Login</button>
    </form>
  );
}
```

### Data Fetching with React Query
- Use React Query for server state
- Handle loading, error, and success states
- Use mutations for data changes
- Invalidate queries after mutations

```tsx
// Query
const { data, isLoading, error } = useQuery({
  queryKey: ["users"],
  queryFn: fetchUsers,
});

// Mutation
const mutation = useMutation({
  mutationFn: createUser,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
  },
});

// Usage
if (isLoading) return <div>Loading...</div>;
if (error) return <div>Error: {error.message}</div>;

return (
  <div>
    {data.map(user => <UserCard key={user.id} {...user} />)}
    <button onClick={() => mutation.mutate(newUser)}>
      Create User
    </button>
  </div>
);
```

### Custom Hooks
- Extract reusable logic into custom hooks
- Name hooks with `use` prefix
- Return values and functions

```tsx
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

// Usage
const [theme, setTheme] = useLocalStorage("theme", "light");
```

### Performance Optimization
- Use `React.memo` for expensive components
- Use `useMemo` for expensive calculations
- Use `useCallback` for stable function references
- Don't optimize prematurely

```tsx
// Memo component
const ExpensiveComponent = React.memo(function ExpensiveComponent({ data }) {
  return <div>{/* expensive render */}</div>;
});

// Memo value
const sortedData = useMemo(() => {
  return data.sort((a, b) => a.name.localeCompare(b.name));
}, [data]);

// Memo callback
const handleClick = useCallback(() => {
  console.log("clicked");
}, []);
```

## Common Patterns

### Conditional Rendering
```tsx
// Ternary
{isLoggedIn ? <Dashboard /> : <Login />}

// Logical AND
{showMessage && <Message />}

// Early return
if (isLoading) return <Loading />;
return <Content />;
```

### List Rendering
```tsx
{items.map(item => (
  <ListItem key={item.id} {...item} />
))}
```

### Event Handling
```tsx
function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
  console.log("clicked");
}

<button onClick={handleClick}>Click me</button>
```

### Refs
```tsx
const inputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  inputRef.current?.focus();
}, []);

<input ref={inputRef} />
```

## Anti-patterns to Avoid
- Don't use class components (use functional components)
- Don't mutate state directly
- Don't use effects for data fetching (use React Query)
- Don't forget to clean up effects
- Don't over-optimize with memoization
- Don't put all state in Context (use React Query for server state)
- Don't forget keys in lists
- Don't use index as key when list can reorder

## Resources
- React Docs: https://react.dev
- React Hook Form: https://react-hook-form.com
- React Query: https://tanstack.com/query/latest
- Zod: https://zod.dev
