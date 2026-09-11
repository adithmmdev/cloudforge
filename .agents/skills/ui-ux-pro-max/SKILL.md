---
name: ui-ux-pro-max
description: Optional user-invoked skill. Activate ONLY when the user explicitly requests @ui-ux-pro-max or asks for advanced UI/UX optimization, style selection, palette generation, or UX guideline audits. Do NOT apply automatically to general coding tasks.
---

# UI/UX Pro Max

An advanced UI/UX intelligence skill delivering curated design styles, comprehensive UX guideline checklists, product-specific palette generators, and interaction audit frameworks.

> **USAGE**: This skill is strictly **OPTIONAL and USER-INVOKED**. Activate ONLY when explicitly called via `@ui-ux-pro-max` or when performing a user-requested UI/UX review. Do NOT auto-trigger for routine code updates.

---

## 1. Style Archetype Selector
Select one archetype tailored to the specific product domain:
1. **Minimalist Clean**: Pure monochrome with subtle grey accents, high whitespace, borderless or single-pixel dividers. Best for productivity tools and writing apps.
2. **Developer / Terminal Dark**: Deep charcoal/black (`#0a0a0c`), mono accents (`JetBrains Mono`, `Geist Mono`), neon status pips (emerald, amber, rose), high density. Best for DevOps, Cloud, and Developer Platforms.
3. **Swiss / International Typographic**: Grid-centric, asymmetric layouts, bold sans-serif display type (`Neue Haas Grotesk`, `Cabinet Grotesk`), strict geometric alignment.
4. **Brutalist / Neo-Brutalist**: High-contrast black outlines (2-3px), sharp drop shadows with zero blur (`box-shadow: 4px 4px 0px #000`), bold saturated primary tones.
5. **Modern Glassmorphism (Calibrated)**: Translucent frosted glass layers (`backdrop-blur-md bg-white/5 border border-white/10`), restrained specular highlights. Best for modern consumer apps.
6. **Editorial / Luxury**: Serif headings, muted earth/stone tones, generous leading, warm photography integration. Best for longform publishing and lifestyle.

---

## 2. Core UX Guideline Checklist (Essential Categories)

### A. Navigation & Information Architecture
- Clear active route indicators in navigation bars and sidebars.
- Breadcrumbs for nested structures greater than 2 levels deep.
- Persistent search and primary action availability.
- Back button behavior preservation in single-page applications.

### B. Form Design & Data Entry
- Group related fields with visual chunking.
- Floating or persistent top labels; never rely solely on placeholder text.
- Inline validation triggered on blur, not immediately on first keystroke.
- Explicit, human-readable error messages specifying how to fix the issue.
- Password fields must include a toggle visibility action.

### C. Feedback & State Communication
- Every user action MUST produce an immediate visual confirmation (hover, press, spinner, toast, or optimistic UI).
- Empty states must include: an illustrative visual, an explanation of why it's empty, and an actionable CTA to get started.
- Skeleton loaders preferred over blocking full-page spinners for content feeds.
- Destructive actions require two-step confirmation or undo snackbars.

### D. Modals, Sheets & Overlays
- Clicking backdrop or pressing `Escape` dismisses the overlay.
- Trap keyboard focus inside open dialogs.
- Prevent underlying page scroll (`overflow: hidden` on body when modal is mounted).
- Modals must have a visible close (X) button with `aria-label="Close"`.

---

## 3. Product-Specific Color Palette Generation
- **Primary / Action Color**: 1 high-contrast hue used exclusively for interactive CTAs and active states.
- **Surface Scale**: 4-5 steps of neutral tones (Canvas, Surface, Elevated Surface, Border, Border Focus).
- **Semantic Feedback Colors**:
  - Success: Emerald (`#10b981`)
  - Warning: Amber (`#f59e0b`)
  - Error: Rose / Crimson (`#f43f5e`)
  - Info: Sky / Cyan (`#0ea5e9`)

---

## 4. UI/UX Audit Workflow
When invoked to review a view or component:
1. Identify current design style and verify consistency.
2. Run through Navigation, Forms, Feedback, and Modals checklist.
3. Audit touch targets (minimum 44x44px for mobile) and desktop hover states.
4. Deliver concrete, actionable recommendations or code refactors.
