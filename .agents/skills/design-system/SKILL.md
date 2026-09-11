---
name: design-system
description: Optional user-invoked skill. Activate ONLY when the user explicitly requests @design-system or asks to establish or refactor design tokens, CSS variables, spacing scales, or component libraries. Do NOT apply automatically to general coding tasks.
---

# Design System & Token Architecture

A systematic methodology for architecting scalable, maintainable design systems with multi-tiered token hierarchies, responsive spacing, fluid typography, and component-level abstraction.

> **USAGE**: This skill is strictly **OPTIONAL and USER-INVOKED**. Use ONLY when the user mentions `@design-system` or explicitly requests design token setup or design system refactoring.

---

## 1. The 3-Tier Token Architecture

Scalable design systems separate tokens into three distinct abstraction layers:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PRIMITIVE TOKENS (Raw values, agnostic to meaning)       │
│    --color-slate-900: #0f172a;                              │
│    --color-emerald-500: #10b981;                            │
│    --space-4: 1rem;                                         │
└──────────────────────────────┬──────────────────────────────┘
                               │ references
┌──────────────────────────────▼──────────────────────────────┐
│ 2. SEMANTIC / ALIAS TOKENS (Contextual, theme-aware)        │
│    --bg-canvas: var(--color-slate-950);                     │
│    --text-primary: var(--color-slate-50);                   │
│    --status-success: var(--color-emerald-500);              │
└──────────────────────────────┬──────────────────────────────┘
                               │ references
┌──────────────────────────────▼──────────────────────────────┐
│ 3. COMPONENT TOKENS (Scoped strictly to specific UI)        │
│    --btn-primary-bg: var(--brand-accent);                   │
│    --card-surface: var(--bg-surface);                       │
│    --input-border-focus: var(--brand-accent);               │
└─────────────────────────────────────────────────────────────┘
```

### Why 3 Tiers?
- Changing theme (light to dark) only touches Semantic Tokens.
- Updating brand color palette only touches Primitive Tokens.
- Tweaking a specific component only touches Component Tokens without global regressions.

---

## 2. Spacing & Sizing Scale
Use an 8-point harmonic spacing grid with 4-point micro-steps:
- `--space-1`: `0.25rem` (4px) — micro gaps, badge padding
- `--space-2`: `0.5rem` (8px) — icon gaps, button padding-y
- `--space-3`: `0.75rem` (12px) — dense card padding
- `--space-4`: `1rem` (16px) — standard card padding, form gaps
- `--space-6`: `1.5rem` (24px) — component margins, section sub-gaps
- `--space-8`: `2rem` (32px) — grid gaps, modal padding
- `--space-12`: `3rem` (48px) — page section spacing
- `--space-16`: `4rem` (64px) — hero section spacing

---

## 3. Typography Scale & Fluid Type
Use a Major Second (1.125) or Minor Third (1.200) ratio for dashboards, and Major Third (1.250) for marketing pages.
Fluid typography via CSS `clamp()`:
```css
:root {
  --font-display: 'Cabinet Grotesk', 'Inter', sans-serif;
  --font-body: 'Inter', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  --text-xs: clamp(0.75rem, 0.7rem + 0.2vw, 0.8125rem);
  --text-sm: clamp(0.875rem, 0.8rem + 0.3vw, 0.9375rem);
  --text-base: clamp(1rem, 0.95rem + 0.25vw, 1.0625rem);
  --text-lg: clamp(1.125rem, 1.05rem + 0.35vw, 1.25rem);
  --text-xl: clamp(1.25rem, 1.15rem + 0.5vw, 1.5rem);
  --text-2xl: clamp(1.5rem, 1.35rem + 0.75vw, 2rem);
  --text-3xl: clamp(1.875rem, 1.6rem + 1.2vw, 2.5rem);
  --text-4xl: clamp(2.25rem, 1.8rem + 1.8vw, 3.25rem);
}
```

---

## 4. Elevation & Surface Tokens
Avoid single arbitrary box shadows. Use an ambient + direct key shadow system:
```css
:root {
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.15), 0 8px 10px -6px rgb(0 0 0 / 0.1);
}
```

---

## 5. Design System Implementation Checklist
1. Create `tokens.css` with Primitive and Semantic CSS Custom Properties.
2. Configure Tailwind `theme.extend` to reference CSS variables for smooth light/dark switching.
3. Establish base primitive components: `Button`, `Input`, `Card`, `Badge`, `Modal`.
4. Document token names in a design tokens reference.
