---
name: frontend-design
description: Optional user-invoked skill. Activate ONLY when the user explicitly requests @frontend-design or asks for distinctive, production-grade frontend design and aesthetic direction. Do NOT apply automatically to general coding tasks.
---

# Frontend Design

A skill for creating distinctive, production-grade frontend designs, elevating user interfaces beyond generic "AI-generated" aesthetics, and establishing memorable brand identity and visual hierarchy.

> **USAGE**: This skill is strictly **OPTIONAL and USER-INVOKED**. It should only be active when the user explicitly mentions `@frontend-design` or asks for high-end aesthetic direction. Never apply this automatically or redesign existing components without an explicit request.

---

## 1. Core Philosophy: Eliminating "AI Slop"

Generic AI-generated interfaces typically exhibit:
- Monotonous dark slate themes with purple/indigo glow gradients (`from-purple-500 to-indigo-600`).
- Predictable 3-column equal-height card grids with identical padding and border radiuses.
- Lack of typographic tension or contrast (everything is medium weight, same generic font family).
- Inconsistent micro-interactions and superficial decorative shapes that provide zero functional meaning.
- Low information density or uncalibrated whitespace.

**The Golden Standard**:
Design with conviction. Every interface should reflect a specific product personality, domain purpose, and purposeful visual rhythm.

---

## 2. The 5 Pillars of Distinctive Frontend Design

### Pillar 1: Defined Design Persona & Aesthetic Anchors
Before writing markup or CSS, determine the visual identity:
- **Technical / Industrial / CLI-Inspired**: High density, monospace accents, sharp corners (`rounded-none` or `rounded-sm`), subtle border lines (`border-neutral-800`), status indicators, muted slate/zinc canvas.
- **Editorial / High-End**: High typographic contrast (serif or bold modern sans display + crisp geometric body), asymmetric layouts, generous margins, refined monochromatic tones with a single striking accent.
- **Modern Product SaaS**: Crisp hierarchy, intentional elevation without excessive blur, purposeful color coding for system states, tactile controls.
- **Cyber / Hyper-Modern**: Deep blacks, sharp borders, high-contrast neon accents used sparingly (5-10% of canvas), terminal indicators.

### Pillar 2: Typography as Interface
- **Font Pairing**: Never use a single generic font for everything. Pair a distinctive display font (e.g., `Syne`, `Cabinet Grotesk`, `Clash Display`, or `Playfair`) with a hyper-readable body workhorse (`Inter`, `Geist`, `Plus Jakarta Sans`, `JetBrains Mono`).
- **Scale & Fluidity**: Use fluid typographic scales via `clamp()` (e.g., `clamp(2rem, 5vw + 1rem, 3.75rem)` for hero displays).
- **Weight Contrast**: Pair bold display headers (`font-extrabold` / `font-black`) with regular or medium subtext. Avoid ubiquitous semi-bold everywhere.
- **Letter Spacing & Line Height**: Tighten tracking on display headings (`tracking-tight` or `-0.02em`), open tracking on micro-labels / uppercase badges (`tracking-widest` or `0.05em`).

### Pillar 3: Layout Tension & Structural Rhythm
- Break out of repetitive 3-column cards:
  - **Bento Grid Hierarchy**: Vary card spans (e.g., 2-col hero card, stacked 1-col cards, interactive widget card).
  - **Asymmetrical Balance**: Offset headers, sticky feature descriptions alongside scrolling graphic showcases.
  - **Whitespace as Structural Punctuation**: Group related elements tightly, separate disparate modules with generous negative space.

### Pillar 4: Color Distribution (60-30-10 Rule)
- **60% Dominant Canvas**: Background surfaces, cards, and negative space (e.g., `#09090b` dark or `#fbfbfb` light).
- **30% Secondary Structure**: Card backgrounds, borders, secondary text, navigation surfaces, dividers.
- **10% Accent / Signature**: High-impact focal points, active states, key conversion buttons, status indicators. Do not splatter accent colors everywhere.

### Pillar 5: Tactile Micro-Interactions & Depth
- **Borders over Blurs**: Use crisp 1px borders (`border-white/10` or `border-zinc-800`) rather than oversized blurry drop shadows.
- **Tactile Hover States**: Slight elevation, border brightening (`hover:border-neutral-500`), subtle transform (`translate-y-[-1px]`), active depression (`active:translate-y-[1px]`).
- **Interactive Affordance**: Buttons, dropdowns, and interactive tabs must have unmistakable focus and active states.

---

## 3. Implementation Checklist for Frontend Work

When invoked with `@frontend-design`:
1. **Identify the Core Audience**: Developer tool? Consumer dashboard? Fintech? Creative showcase?
2. **Select Design Tokens**: Set display font, body font, canvas background, surface background, and accent color.
3. **Draft the Layout Hierarchy**: Structure bento grids, sticky columns, or responsive flex layouts before styling individual details.
4. **Calibrate Information Density**: Ensure tables, lists, and cards display critical metrics clearly without clutter.
5. **Verify Contrast & Legibility**: Check text readability against WCAG AA standards.
6. **Polish Interactions**: Add smooth transitions (`transition-all duration-200 ease-out`), active states, and hover feedback.
