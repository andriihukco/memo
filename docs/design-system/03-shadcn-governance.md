# Shadcn/UI Governance — Memo

This document defines rules for adding, extending, and customizing Shadcn/UI primitive components.

---

## Directory Structure

### Required Location

All raw/unmodified Shadcn/UI primitive components must be stored in:

```
src/components/ui/
```

### Forbidden Locations

- ❌ Do NOT store Shadcn primitives in `src/components/features/`
- ❌ Do NOT store Shadcn primitives in page directories
- ❌ Do NOT store Shadcn primitives in `src/lib/`

---

## Component Organization

### Atomic Design Hierarchy

```
src/components/
├── ui/                    # Shadcn primitives (unmodified)
│   ├── button.tsx
│   ├── badge.tsx
│   ├── card.tsx
│   ├── icon.tsx
│   └── ...
└── features/              # Domain-specific composed components
    ├── dashboard/
    │   ├── metrics-grid.tsx
    │   └── widget-creator.tsx
    ├── graph/
    │   ├── node-detail-panel.tsx
    │   └── date-filter-sheet.tsx
    └── voice/
        └── voice-recorder.tsx
```

---

## Adding New Shadcn Components

### Prerequisites

Before adding a new Shadcn component:

1. **Check if it already exists** in `src/components/ui/`
2. **Verify it's needed** — don't add components "just in case"
3. **Review the component** in the [Shadcn documentation](https://ui.shadcn.com/)

### Installation Process

```bash
# Install the component
npx shadcn-ui@latest add [component-name]

# Example: add dialog component
npx shadcn-ui@latest add dialog
```

### Post-Installation

1. **Verify location** — Component must be in `src/components/ui/`
2. **Check imports** — Ensure no relative path imports
3. **Review size** — Component should be < 200 lines
4. **Test in isolation** — Verify component works standalone

---

## Customizing Shadcn Components

### Allowed Customizations

You MAY customize Shadcn components for:

1. **Theme integration** — Use CSS variables from `globals.css`
2. **Accessibility** — Add ARIA labels, keyboard support
3. **Size constraints** — Enforce 44px minimum touch targets
4. **Brand alignment** — Adjust animations, transitions to match Memo design

### Forbidden Customizations

You MUST NOT:

1. **Remove Shadcn attributes** — Keep all Radix UI props
2. **Break API compatibility** — Maintain original prop interface
3. **Hardcode colors** — Use CSS variables (`hsl(var(--primary))`)
4. **Remove focus indicators** — Keep `:focus-visible` styles
5. **Change component behavior** — Functionality must remain consistent

### Customization Example

```tsx
// ✅ Good: Customization using CSS variables
// src/components/ui/button.tsx
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

// ❌ Bad: Hardcoded colors
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => {
    return (
      <button
        className="bg-blue-500 text-white" // ❌ Hardcoded
        ref={ref}
        {...props}
      />
    );
  }
);
```

---

## Extending Shadcn Components

### When to Extend

Extend a Shadcn component when you need:

1. **Additional props** — New props specific to Memo
2. **Memo-specific behavior** — Integration with Telegram, sound, haptics
3. **Composed patterns** — Reusable combinations of Shadcn components

### Extension Pattern

Create a new component in `src/components/features/` that composes Shadcn primitives:

```tsx
// ✅ Good: Extension in features directory
// src/components/features/dashboard/metric-card.tsx
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function MetricCard({ title, value, onEdit }: MetricCardProps) {
  return (
    <Card>
      <h3>{title}</h3>
      <p>{value}</p>
      <Button onClick={onEdit} aria-label={`Edit ${title}`}>
        <Icon name="edit" />
      </Button>
    </Card>
  );
}

// ❌ Bad: Modifying Shadcn primitive directly
// src/components/ui/card.tsx
export function Card({ title, value, onEdit, ...props }: CardProps) {
  // ❌ Adding Memo-specific props to Shadcn component
  return (
    <div {...props}>
      <h3>{title}</h3>
      <p>{value}</p>
      <Button onClick={onEdit}>Edit</Button>
    </div>
  );
}
```

---

## Component Size Limits

### 200-Line Rule

All components in `src/components/ui/` must be < 200 lines.

### Violation Handling

If a Shadcn component exceeds 200 lines:

1. **Split into sub-components** in `src/components/ui/`
2. **Extract logic to hooks** in `src/lib/hooks/`
3. **Extract types to separate file** in `src/components/ui/types/`

### Example Split

```tsx
// Before: 250 lines in button.tsx ❌
// src/components/ui/button.tsx

// After: Split into multiple files ✅
// src/components/ui/button.tsx (150 lines)
// src/components/ui/button-variants.tsx (40 lines)
// src/components/ui/button-loading.tsx (30 lines)
```

---

## Import Guidelines

### Allowed Imports

```tsx
// ✅ Good: Absolute path from @/
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// ✅ Good: Relative imports within same directory
import { buttonVariants } from './button-variants';
```

### Forbidden Imports

```tsx
// ❌ Bad: Relative imports from parent directories
import { Button } from '../../components/ui/button';

// ❌ Bad: Absolute paths without @/ alias
import { Button } from 'src/components/ui/button';
```

---

## Type Safety

### Prop Types

All components must have proper TypeScript types:

```tsx
// ✅ Good: Proper types
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

// ❌ Bad: Any types
interface ButtonProps {
  variant?: any;
  size?: any;
}
```

### Generic Components

Use generics for reusable components:

```tsx
// ✅ Good: Generic component
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}

function List<T>({ items, renderItem }: ListProps<T>) {
  return <ul>{items.map(renderItem)}</ul>;
}

// ❌ Bad: Hardcoded type
interface ListProps {
  items: string[];
  renderItem: (item: string) => React.ReactNode;
}
```

---

## Testing Requirements

### Unit Tests

All Shadcn components must have unit tests for:

1. **Render** — Component renders without errors
2. **Props** — All props work as expected
3. **Accessibility** — ARIA attributes are correct
4. **Keyboard** — Keyboard navigation works

### Example Test

```tsx
// __tests__/components/ui/button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders with default variant', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('applies aria-label for icon-only buttons', () => {
    render(<Button aria-label="Delete"><Icon name="delete" /></Button>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Delete');
  });
});
```

---

## Documentation

### Component Documentation

Each Shadcn component must have:

1. **JSDoc comment** — Describes purpose and usage
2. **Prop types** — Documented with TypeScript
3. **Usage example** — In code comments

### Example

```tsx
/**
 * Button component built on Radix UI primitive.
 *
 * @example
 * <Button variant="default" size="default">
 *   Click me
 * </Button>
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    // ...
  }
);
```

---

## Deprecation Process

### When to Deprecate

Deprecate a Shadcn component when:

1. **No longer used** — Component has zero references
2. **Replaced by new component** — Better alternative exists
3. **Shadcn deprecates it** — Upstream removal

### Deprecation Steps

1. **Add deprecation warning** in component
2. **Update all usages** to new component
3. **Remove after 1 release cycle**
4. **Delete component file**

### Example

```tsx
/**
 * @deprecated Use NewButton instead. Will be removed in v2.0.
 */
const OldButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => {
    console.warn('OldButton is deprecated. Use NewButton instead.');
    return <NewButton {...props} ref={ref} />;
  }
);
```

---

## Code Review Checklist

Before merging changes to Shadcn components:

- [ ] Component is in `src/components/ui/`
- [ ] Component is < 200 lines
- [ ] No hardcoded colors (use CSS variables)
- [ ] All props have TypeScript types
- [ ] ARIA labels are present where needed
- [ ] Focus indicators are preserved
- [ ] Touch targets are ≥ 44px
- [ ] Imports use `@/` alias
- [ ] Component has JSDoc documentation
- [ ] Unit tests pass
- [ ] Accessibility audit passes (axe-core)

---

## Resources

- [Shadcn/UI Documentation](https://ui.shadcn.com/)
- [Radix UI Primitives](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Class Variance Authority](https://cva.style/)
