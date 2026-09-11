---
name: cinematic-gsap-lenis-motion-system
description: Optional user-invoked skill. Activate ONLY when the user explicitly requests @cinematic-gsap-lenis-motion-system or asks for high-end cinematic animations with GSAP 3, ScrollTrigger, and Lenis smooth scrolling. Do NOT apply automatically to general coding tasks.
---

# Cinematic Motion System: GSAP 3 + ScrollTrigger + Lenis

A masterclass production guide for engineering butter-smooth, studio-grade cinematic motion using GreenSock (GSAP 3), ScrollTrigger, and Lenis smooth scrolling in modern React/Vite/Next.js architectures.

> **USAGE**: This skill is strictly **OPTIONAL and USER-INVOKED**. Use ONLY when explicitly summoned via `@cinematic-gsap-lenis-motion-system`. Do NOT inject GSAP or Lenis into standard views or regular components unprompted.

---

## 1. System Architecture & Synchronization

Lenis and GSAP ScrollTrigger must run on a synchronized tick to avoid jitter and fighting animation frames:

```
                  ┌──────────────────────────────┐
                  │          Lenis RAF           │
                  │   (Smooth Virtual Scroll)    │
                  └──────────────┬───────────────┘
                                 │ lenis.on('scroll')
                                 ▼
                  ┌──────────────────────────────┐
                  │     ScrollTrigger.update     │
                  │    (Calculates Pin & Scrub)  │
                  └──────────────┬───────────────┘
                                 │ gsap.ticker
                                 ▼
                  ┌──────────────────────────────┐
                  │         GSAP Render          │
                  │   (Hardware-Accelerated)     │
                  └──────────────────────────────┘
```

### Core Synchronization Setup:
```javascript
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export function initCinematicEngine() {
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });

  // Sync Lenis scroll updates with GSAP ScrollTrigger
  lenis.on('scroll', ScrollTrigger.update);

  // Drive Lenis RAF from GSAP's central ticker
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });

  // Prevent lag smoothing delays
  gsap.ticker.lagSmoothing(0);

  return lenis;
}
```

---

## 2. React / Next.js Lifecycle Hygiene & Memory Management

**CRITICAL RULE**: Never create GSAP animations in React without scoped cleanup! Failure to clean up results in duplicate ScrollTriggers, memory leaks, and broken pins on re-renders.

### Using `@gsap/react` (`useGSAP` hook) [Recommended]:
```jsx
import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function HeroCinematic() {
  const container = useRef();

  useGSAP(() => {
    // Everything created inside is automatically reverted on unmount!
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: container.current,
        start: 'top top',
        end: '+=200%',
        pin: true,
        scrub: 1,
      }
    });

    tl.from('.hero-headline', { y: 60, opacity: 0, duration: 1 })
      .from('.hero-badge', { scale: 0.8, opacity: 0, stagger: 0.1 }, '-=0.5')
      .to('.hero-visual', { scale: 1.15, rotateX: 10 }, 0);
  }, { scope: container });

  return (
    <div ref={container} className="hero-container min-h-screen">
      <h1 className="hero-headline text-6xl font-bold">CloudForge</h1>
      <div className="hero-visual">...</div>
    </div>
  );
}
```

### Classic `gsap.context()` Fallback:
```jsx
useEffect(() => {
  const ctx = gsap.context(() => {
    // animations and ScrollTriggers here
  }, containerRef);

  return () => ctx.revert(); // Essential cleanup
}, []);
```

---

## 3. Cinematic Motion Presets & Curves

### Easing Spectrum
- **Crisp Entrance**: `ease: "power3.out"` or `ease: "expo.out"`
- **Dramatic Momentum**: `ease: "power4.inOut"`
- **Organic Spring**: `ease: "elastic.out(1, 0.75)"`

### Magnetic Button Interaction
```javascript
export function makeMagnetic(element) {
  const xTo = gsap.quickTo(element, "x", { duration: 0.4, ease: "power3" });
  const yTo = gsap.quickTo(element, "y", { duration: 0.4, ease: "power3" });

  element.addEventListener("mousemove", (e) => {
    const { clientX, clientY } = e;
    const { left, top, width, height } = element.getBoundingClientRect();
    const x = clientX - (left + width / 2);
    const y = clientY - (top + height / 2);
    xTo(x * 0.35);
    yTo(y * 0.35);
  });

  element.addEventListener("mouseleave", () => {
    xTo(0);
    yTo(0);
  });
}
```

---

## 4. Performance & Reduced Motion Guardrails
1. **Always check `prefers-reduced-motion`**:
   ```javascript
   if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
     return; // Bypass GSAP timeline
   }
   ```
2. **Use `will-change` sparingly**: Apply `will-change: transform` only right before heavy animations, remove after completion.
3. **Trigger Refreshes**: Call `ScrollTrigger.refresh()` after dynamic DOM mutations or fonts load.
