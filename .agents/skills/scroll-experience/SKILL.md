---
name: scroll-experience
description: Optional user-invoked skill. Activate ONLY when the user explicitly requests @scroll-experience or asks for scroll-driven animations, sticky pinned sections, parallax, or narrative scrolling. Do NOT apply automatically to general coding tasks.
---

# Scroll Experience & Narrative Flow

Techniques and architectures for scroll-driven animations, sticky card stacking, parallax reveals, and narrative visual storytelling while strictly safeguarding accessibility and performance.

> **USAGE**: This skill is strictly **OPTIONAL and USER-INVOKED**. Activate ONLY when explicitly called with `@scroll-experience`. Never add scroll animations or scroll hijacking to standard views without explicit user instruction.

---

## 1. Core Principles of Scroll Design

1. **User Retains Control**: Never hijack native scrolling momentum or alter default trackpad/wheel physics unless explicitly requested.
2. **Transform & Opacity Only**: Animate exclusively hardware-accelerated CSS properties (`transform: translate3d/scale/rotate` and `opacity`). Never animate `width`, `height`, `top`, or `margin`.
3. **Accessibility First (`prefers-reduced-motion`)**: Always provide an immediate fallback where all elements are fully visible and static when reduced motion is preferred.
4. **Mobile Consideration**: Disable heavy multi-layer parallax on mobile devices; use simple touch-friendly swipe cards or vertical stacks instead.

---

## 2. Popular Scroll Experience Patterns

### Pattern A: Sticky Card Stacking (Narrative Feature Progression)
Cards pin sequentially as the user scrolls, each subsequent card stacking smoothly over the previous one with a subtle scale/dimming effect:
```css
.card-stack-container {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.sticky-card {
  position: sticky;
  top: 6rem;
  transition: transform 0.3s ease-out, filter 0.3s ease-out;
}
```

### Pattern B: Native CSS Scroll-Driven Animations (Modern Standard)
Using CSS `animation-timeline: view()` or `scroll()` without external JavaScript dependencies:
```css
@keyframes reveal-up {
  from {
    opacity: 0;
    transform: translateY(40px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.scroll-reveal {
  animation: reveal-up linear both;
  animation-timeline: view();
  animation-range: entry 10% cover 30%;
}

@media (prefers-reduced-motion: reduce) {
  .scroll-reveal {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
```

### Pattern C: Horizontal Section Pin in Vertical Scroll Flow
Pin a vertical container and translate an inner flex row horizontally based on scroll progress.

### Pattern D: Scrubbed SVG Path / Metric Counters
Tie SVG stroke dashoffset or numerical counts to scroll position via `IntersectionObserver` or scroll timeline.

---

## 3. Robust IntersectionObserver Reveal Hook (React Example)
```typescript
import { useEffect, useRef, useState } from 'react';

export function useScrollReveal(options = { threshold: 0.15 }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(entry.target);
      }
    }, options);

    const el = ref.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [options]);

  return { ref, isVisible };
}
```

---

## 4. Scroll Experience Audit & Verification Checklist
- [ ] Motion stops immediately when `@media (prefers-reduced-motion: reduce)` is enabled.
- [ ] No layout reflow or frame drops (60fps/120fps maintained on timeline inspection).
- [ ] Mobile experience is clean, readable, and does not require awkward scrubbing.
- [ ] Content is discoverable and readable even if JavaScript fails to load.
