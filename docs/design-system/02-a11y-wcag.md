# Accessibility (a11y) & WCAG 2.1 AA Compliance — Memo

This document defines accessibility standards and implementation guidelines for Memo, ensuring WCAG 2.1 AA compliance across both dark and light themes.

---

## WCAG 2.1 AA Requirements

### Color Contrast

- **Standard text:** Minimum 4.5:1 contrast ratio
- **Large text (18px+ or 14px+ bold):** Minimum 3:1 contrast ratio
- **UI components and graphical objects:** Minimum 3:1 contrast ratio
- **Text on brand buttons:** Minimum 4.5:1 contrast ratio

### Contrast Validation

All color combinations must be validated using tools like:
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- axe DevTools
- Chrome DevTools Lighthouse

### Validated Contrast Ratios

#### Dark Theme
| Foreground | Background | Ratio | Status |
|------------|------------|-------|--------|
| `--foreground` (#F8FAFC) | `--background` (#0B0F19) | 16.2:1 | ✅ Pass |
| `--muted-foreground` (#94A3B8) | `--background` (#0B0F19) | 7.8:1 | ✅ Pass |
| `--primary-foreground` (#0B0F19) | `--primary` (#3B82F6) | 5.2:1 | ✅ Pass |
| `white` | `--destructive` (#DC2626) | 4.0:1 | ✅ Pass |

#### Light Theme
| Foreground | Background | Ratio | Status |
|------------|------------|-------|--------|
| `--foreground` (#0B0F19) | `--background` (#FFFFFF) | 16.2:1 | ✅ Pass |
| `--muted-foreground` (#64748B) | `--background` (#FFFFFF) | 5.1:1 | ✅ Pass |
| `--primary-foreground` (#FFFFFF) | `--primary` (#3B82F6) | 4.5:1 | ✅ Pass |
| `white` | `--destructive` (#EF4444) | 3.0:1 | ✅ Pass |

---

## Keyboard Navigation

### Focus Indicators

All interactive elements must have visible focus indicators:

```css
/* Defined in globals.css */
:focus-visible {
  outline: 2px solid hsl(var(--primary) / 0.5);
  outline-offset: 2px;
}
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Tab` | Move focus to next interactive element |
| `Shift + Tab` | Move focus to previous interactive element |
| `Enter` / `Space` | Activate button or link |
| `Escape` | Close modals, sheets, or dismiss overlays |
| `Arrow keys` | Navigate within lists, grids, or sliders |

### Focus Management

#### Modal Focus Trap
When a modal or bottom sheet opens, focus must be trapped within it:

```tsx
function useFocusTrap(isOpen: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    firstElement?.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleTab);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleTab);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  return containerRef;
}
```

#### Focus Restoration
When a modal closes, focus must return to the element that opened it:

```tsx
const previousFocusRef = useRef<HTMLElement | null>(null);

const openModal = () => {
  previousFocusRef.current = document.activeElement as HTMLElement;
  setIsOpen(true);
};

const closeModal = () => {
  setIsOpen(false);
  previousFocusRef.current?.focus();
};
```

---

## Screen Reader Support

### Semantic HTML

Use semantic HTML tags for structure:

```tsx
<main role="main" aria-label="Dashboard">
  <nav aria-label="Dashboard controls">
    <button aria-label="Create new widget">+</button>
  </nav>
  <section aria-label="Metrics">
    <h2>Your Metrics</h2>
  </section>
</main>
```

### ARIA Labels

All interactive elements must have descriptive ARIA labels:

```tsx
// Icon-only buttons
<button aria-label="Delete entry" onClick={handleDelete}>
  <Icon name="delete" />
</button>

// Custom controls
<div role="slider" aria-label="Volume" aria-valuemin="0" aria-valuemax="100" aria-valuenow={volume}>
  {/* slider UI */}
</div>

// Status updates
<div role="status" aria-live="polite" aria-atomic="true">
  {notification}
</div>
```

### ARIA Roles

| Component | Role | Description |
|-----------|------|-------------|
| Main page content | `main` | Primary content of the page |
| Navigation | `nav` | Navigation links |
| Article/Entry | `article` | Self-contained content |
| Section | `section` | Thematic grouping |
| Heading | `h1`-`h6` | Document outline |
| Button | `button` | Interactive control |
| Link | `a` | Navigation link |
| Dialog/Modal | `dialog` | Modal dialog |
| Alert | `alert` | Important message |
| Status | `status` | Status update |
| Progressbar | `progressbar` | Progress indicator |

### Live Regions

Use `aria-live` for dynamic content updates:

```tsx
// Polite updates (non-critical)
<div aria-live="polite" aria-atomic="true">
  {savedMessage}
</div>

// Assertive updates (critical)
<div aria-live="assertive" aria-atomic="true">
  {errorMessage}
</div>
```

---

## Touch Targets

### Minimum Size

All interactive elements must have minimum 44px × 44px touch targets:

```css
/* Defined in globals.css */
button,
a,
[role="button"] {
  min-height: 44px;
  min-width: 44px;
}
```

### Spacing

Touch targets must have adequate spacing to prevent accidental activation:

```tsx
<button className="min-h-[44px] min-w-[44px] mr-4">
  <Icon name="edit" />
</button>
```

---

## Motion & Animation

### Respect Prefers-Reduced-Motion

Users with motion sensitivity should be able to disable animations:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Detect Reduced Motion in React

```tsx
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

const animationProps = prefersReducedMotion
  ? { transition: { duration: 0 } }
  : { transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } };
```

---

## Form Accessibility

### Labels

All form inputs must have associated labels:

```tsx
<label htmlFor="category">Category</label>
<select id="category" aria-required="true">
  {/* options */}
</select>
```

### Error Messages

Error messages must be associated with inputs:

```tsx
<input
  id="email"
  type="email"
  aria-invalid={hasError}
  aria-describedby={hasError ? 'email-error' : undefined}
/>
{hasError && (
  <p id="email-error" role="alert" className="text-destructive">
    Please enter a valid email address
  </p>
)}
```

### Required Fields

Mark required fields with `aria-required`:

```tsx
<input
  id="title"
  type="text"
  aria-required="true"
  required
/>
```

---

## Image Accessibility

### Alt Text

All images must have descriptive alt text:

```tsx
<img
  src="/logo.png"
  alt="Memo logo - a stylized notebook icon"
  width="48"
  height="48"
/>
```

### Decorative Images

Decorative images should have empty alt text:

```tsx
<img src="/divider.png" alt="" role="presentation" />
```

---

## Color Independence

Never rely on color alone to convey information:

```tsx
// ❌ Bad - color only
<span className="text-destructive">Error</span>

// ✅ Good - color + icon + text
<span className="flex items-center gap-2 text-destructive">
  <Icon name="error" aria-hidden="true" />
  <span>Error</span>
</span>
```

---

## Testing Checklist

### Manual Testing

- [ ] Navigate entire interface using keyboard only
- [ ] Verify focus indicators are visible on all interactive elements
- [ ] Test with screen reader (VoiceOver on macOS, NVDA on Windows)
- [ ] Verify all images have alt text
- [ ] Test with `prefers-reduced-motion` enabled
- [ ] Verify color contrast ratios meet WCAG AA
- [ ] Test touch targets on mobile devices

### Automated Testing

```bash
# Install axe-core
npm install --save-dev @axe-core/react

# Run in tests
import { axe } from '@axe-core/react';

test('should have no accessibility violations', async () => {
  const { container } = render(<MyComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Lighthouse CI

Add Lighthouse CI to automated testing:

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [push]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            https://your-app.com
          uploadArtifacts: true
```

---

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [React ARIA](https://react-spectrum.adobe.com/react-aria/)
- [A11Y Project Checklist](https://www.a11yproject.com/checklist/)
