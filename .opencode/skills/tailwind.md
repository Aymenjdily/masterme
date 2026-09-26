# Tailwind CSS Best Practices Skill

## When to use
Use this skill when styling components, creating layouts, or working with responsive design.

## Core Principles

### Utility-First Approach
- Use Tailwind utility classes directly in JSX
- Avoid custom CSS when Tailwind utilities work
- Compose utilities for complex styles

```tsx
// Good
<button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
  Click me
</button>

// Avoid custom CSS
<style>{`.btn { ... }`}</style>
<button className="btn">Click me</button>
```

### Responsive Design
- Use responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`
- Mobile-first approach (base styles are mobile)
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px), 2xl (1536px)

```tsx
<div className="text-sm md:text-base lg:text-lg">
  Responsive text size
</div>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  Responsive grid
</div>
```

### Dark Mode
- Use `dark:` prefix for dark mode styles
- Configure in `tailwind.config.js` if needed

```tsx
<div className="bg-white dark:bg-gray-900 text-black dark:text-white">
  Dark mode support
</div>
```

### Spacing and Layout
- Use consistent spacing scale: `p-1`, `p-2`, `p-3`, `p-4`, etc.
- Use flexbox and grid for layouts
- Use gap utilities for spacing between items

```tsx
// Flexbox
<div className="flex items-center justify-between gap-4">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

// Grid
<div className="grid grid-cols-3 gap-4">
  <div>1</div>
  <div>2</div>
  <div>3</div>
</div>
```

### Typography
- Use text size utilities: `text-xs`, `text-sm`, `text-base`, `text-lg`, etc.
- Use font weight utilities: `font-light`, `font-normal`, `font-bold`, etc.
- Use text alignment: `text-left`, `text-center`, `text-right`

```tsx
<h1 className="text-2xl md:text-3xl font-bold text-gray-900">
  Heading
</h1>

<p className="text-base text-gray-600 leading-relaxed">
  Paragraph text
</p>
```

### Colors
- Use Tailwind color palette
- Use opacity modifiers: `bg-blue-500/50`
- Use custom colors in config if needed

```tsx
<div className="bg-blue-500 text-white">
  Blue background
</div>

<div className="bg-blue-500/50 text-blue-900">
  Semi-transparent blue
</div>
```

### Hover and Focus States
- Use `hover:`, `focus:`, `active:`, `disabled:` prefixes
- Always provide focus styles for accessibility

```tsx
<button className="bg-blue-500 hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50">
  Button
</button>
```

### Transitions and Animations
- Use `transition` utilities for smooth state changes
- Use `duration-*` for timing
- Use `animate-*` for built-in animations

```tsx
<button className="bg-blue-500 hover:bg-blue-600 transition-colors duration-200">
  Smooth hover
</button>

<div className="animate-pulse">
  Pulsing element
</div>
```

## Common Patterns

### Card Component
```tsx
<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
  <h3 className="text-lg font-semibold text-gray-900">Card Title</h3>
  <p className="mt-2 text-sm text-gray-600">Card content</p>
</div>
```

### Button Variants
```tsx
// Primary
<button className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors">
  Primary
</button>

// Secondary
<button className="bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-2 px-4 rounded-lg transition-colors">
  Secondary
</button>

// Outline
<button className="border-2 border-blue-500 text-blue-500 hover:bg-blue-50 font-medium py-2 px-4 rounded-lg transition-colors">
  Outline
</button>
```

### Form Input
```tsx
<input
  type="text"
  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
  placeholder="Enter text..."
/>
```

### Container
```tsx
<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
  Content
</div>
```

### Sidebar Layout
```tsx
<div className="flex h-screen">
  <aside className="w-64 border-r border-gray-200 bg-white p-4">
    Sidebar
  </aside>
  <main className="flex-1 overflow-auto p-6">
    Main content
  </main>
</div>
```

## Component Extraction
- Extract repeated patterns into components
- Use component props for variants
- Keep components small and focused

```tsx
// Button component with variants
interface ButtonProps {
  variant?: "primary" | "secondary" | "outline";
  children: React.ReactNode;
}

export function Button({ variant = "primary", children }: ButtonProps) {
  const baseStyles = "font-medium py-2 px-4 rounded-lg transition-colors";
  const variants = {
    primary: "bg-blue-500 hover:bg-blue-600 text-white",
    secondary: "bg-gray-100 hover:bg-gray-200 text-gray-900",
    outline: "border-2 border-blue-500 text-blue-500 hover:bg-blue-50",
  };

  return (
    <button className={`${baseStyles} ${variants[variant]}`}>
      {children}
    </button>
  );
}
```

## Anti-patterns to Avoid
- Don't use arbitrary values when Tailwind scale works: `w-[347px]` → use `w-80` or similar
- Don't nest custom CSS when utilities work
- Don't use inline styles when Tailwind classes work
- Don't forget responsive design
- Don't skip focus states for accessibility
- Don't use too many custom colors (stick to palette)

## Resources
- Tailwind Docs: https://tailwindcss.com/docs
- Tailwind Play: https://play.tailwindcss.com
- Tailwind UI: https://tailwindui.com
