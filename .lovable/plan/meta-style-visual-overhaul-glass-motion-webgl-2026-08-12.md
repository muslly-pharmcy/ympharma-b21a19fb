# Meta-Style Visual Overhaul (Glass + Motion + WebGL)

A presentation-layer makeover of the storefront. No changes to data fetching, cart logic, auth, or backend calls — every link, form, and handler keeps its current behaviour.

## What changes visually

### 1. Hero becomes a glass panel with a live 3D backdrop
- The flat white/teal hero card on the homepage becomes a frosted glass panel: heavy blur, illuminated hairline border, ambient teal/gold glow orbs behind it.
- A lightweight WebGL scene sits behind the hero: slowly drifting molecule/particle nodes in the brand teal, reacting to cursor movement on desktop and tilt/touch drag on mobile.
- The current CPU-driven "20 floating dots" loop is removed — the WebGL layer replaces it (less main-thread work, smoother scroll).
- Performance guards: the canvas only renders while it is on screen, caps device pixel ratio, drops particle count on small screens, and is fully disabled for users with reduced-motion enabled or on low-end devices. Falls back to a static gradient if WebGL is unavailable.

### 2. Bento grid layout
- The homepage AI tools row, categories, and quick-search become an elegant Bento grid (mixed tile sizes) instead of a uniform 4-column strip, using the bento tokens already defined in the stylesheet.
- Fully RTL-correct: tiles, icons, and text alignment mirror properly in Arabic.

### 3. Typography
- Fluid Arabic type scale (headings scale smoothly with viewport rather than jumping at breakpoints), tighter hierarchy between hero title, section titles, and body.

### 4. Motion
- Staggered entrance for cards, titles, badges, and buttons — fade + slide-up with spring physics, triggered when a section scrolls into view rather than all at once on load.
- Primary buttons ("تسوّق الأدوية", "استشارة ذكية") get spring press/hover scaling and a soft pulsing ambient glow on the main CTA.
- All motion respects `prefers-reduced-motion`.

### 5. Floating widget dock
- The WhatsApp + AI assistant floating buttons are refactored into a single glass dock: hover elevation, smooth expanding label tooltips, RTL-correct positioning, and safe-area padding so it never sits under the iOS home bar or the bottom nav.

### 6. Logos and assets
- Logo renders inside a borderless glass container (no white bounding box) so it blends into both light and ambient backgrounds. Applied to the hero, navbar, and footer.

### Reach
Homepage first (hero, bento, dock, logo). Then the shared shell — navbar, footer, floating dock, card and button styles — so every other screen inherits the new look without per-page rewrites. Store, product, cart, and checkout pages get the shared glass card/button treatment only; their logic and layout structure stay as-is.

## Technical notes

- New: `src/shared/3d/AmbientMoleculeField.tsx` (R3F scene, instanced points, pointer-parallax, `frameloop="demand"`-style visibility gating), lazy-loaded and client-only so SSR is unaffected.
- New: `src/shared/components/GlassHero.tsx`, `src/shared/components/motion/Reveal.tsx` (shared stagger primitive), `src/shared/components/GlassDock.tsx` (replaces the internals of `FloatingContactButtons`, same mount point in `MainLayout`).
- Edited: `src/pages/SolarSystem.tsx` (hero + bento composition), `src/index.css` (fluid type clamps, glow/pulse utilities, dock tokens), Navbar/Footer logo containers.
- Stack already present: `framer-motion`, `three`, `@react-three/fiber`, `@react-three/drei` — no new dependencies.
- Colors stay on existing semantic tokens; no hardcoded hex added in components.
- Verification: build + typecheck, plus Playwright screenshots at 390px, 820px, and 1440px to confirm RTL alignment and no layout regressions.
