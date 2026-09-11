---
name: web-design-guidelines
description: Optional user-invoked skill. Activate ONLY when the user explicitly requests @web-design-guidelines or asks for web design standards, WCAG accessibility compliance, keyboard navigation, or Core Web Vitals audits. Do NOT apply automatically to general coding tasks.
---

# Web Design Guidelines: Accessibility, Standards & Performance

A rigorous engineering handbook for building accessible, standards-compliant, and high-performance web applications adhering to WCAG 2.1 AA/AAA criteria, WAI-ARIA authoring practices, and Core Web Vitals thresholds.

> **USAGE**: This skill is strictly **OPTIONAL and USER-INVOKED**. Use ONLY when explicitly called via `@web-design-guidelines` or when conducting an accessibility/performance review. Never interrupt normal tasks without user request.

---

## 1. Accessibility (WCAG 2.1 Level AA) Mandatory Criteria

### A. Color Contrast Ratios
- **Normal Text (< 18pt / 24px, or < 14pt bold)**: Minimum **4.5:1** contrast ratio against its background.
- **Large Text (≥ 18pt / 24px, or ≥ 14pt bold)**: Minimum **3.0:1** contrast ratio.
- **UI Components & Graphical Objects**: Minimum **3.0:1** contrast against adjacent background colors for borders, active icons, form input outlines.
- **Never convey state solely through color**: Always pair color indicators with text, icons, or patterns (e.g., error red + alert triangle icon + descriptive text).

### B. Keyboard Navigation & Focus Ring Standards
- **Tab Order**: Logical reading order matching DOM order. Never use positive `tabindex` (`tabindex="1"` is forbidden; use `0` or `-1`).
- **Focus Rings**:
  - NEVER use `outline: none` without providing an explicit, high-visibility `:focus-visible` ring.
  - Standard focus ring: `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary focus-visible:outline-none`.
- **Keyboard Equivalents**:
  - Buttons and links activatable with `Enter` and `Space`.
  - Dropdowns navigatable with Up/Down arrows and closable with `Escape`.
  - Modals trap focus and return focus to triggering element upon closing.

### C. Semantic HTML & Accessible Names
- Use native HTML elements (`<button>`, `<a>`, `<nav>`, `<main>`, `<dialog>`) instead of `<div onClick=...>` divs.
- Every icon button MUST have an accessible name:
  ```jsx
  <button aria-label="Close dialog" onClick={onClose}>
    <XIcon aria-hidden="true" />
  </button>
  ```
- Images must have meaningful `alt` text or `alt=""` if strictly decorative.
- Form inputs must have an associated `<label htmlFor="id">` or `aria-label`.

### D. Touch Target Sizing (Mobile & Touch Devices)
- Minimum interactive target size: **44 x 44 CSS pixels**.
- Minimum spacing between adjacent touch targets: **8px** to prevent accidental mis-taps.

---

## 2. Core Web Vitals & Performance Benchmarks

### 1. Largest Contentful Paint (LCP) < 2.5s
- Preload critical hero images (`<link rel="preload" as="image" href="...">`).
- Use modern formats (`WebP`, `AVIF`) with responsive `srcset`.
- Ensure web fonts use `font-display: swap` to prevent FOIT (Flash of Invisible Text).

### 2. Cumulative Layout Shift (CLS) < 0.1
- Always specify explicit `width` and `height` (or aspect-ratio) on `<img>`, `<video>`, and `<iframe>` elements.
- Reserve space for dynamic ad slots, banners, and async widgets using skeleton placeholders.
- Avoid inserting new content above existing content without user interaction.

### 3. Interaction to Next Paint (INP) < 200ms
- Avoid blocking main thread tasks longer than 50ms.
- Yield to main thread using `scheduler.yield()` or `setTimeout(..., 0)` during heavy computations.
- Debounce rapid inputs (search inputs, resize handlers).

---

## 3. Web Design Guideline Audit Checklist

When reviewing any view or application component:
- [ ] **Contrast**: Check all text against 4.5:1 ratio.
- [ ] **Keyboard**: Unplug the mouse; can the entire workflow be completed using only Tab, Shift+Tab, Enter, Space, and Esc?
- [ ] **Screen Reader**: Do all buttons and links announce their destination and action clearly?
- [ ] **Layout Shifts**: Does the page jump or shift during data loading?
- [ ] **Reduced Motion**: Does `@media (prefers-reduced-motion: reduce)` deactivate transitions and animations?
