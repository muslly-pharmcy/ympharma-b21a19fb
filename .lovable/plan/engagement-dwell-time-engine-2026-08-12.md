# Engagement & Dwell-Time Engine

A four-phase build that adds interactive clinical tools, sequential reading mechanics, smarter AI hand-offs, and gentle exit interventions — all in the existing glassmorphic RTL style, with no third-party ads.

## Phase 1 — Clinical Tools Hub (`/tools`)

New section with a hub page and four tools, each a glass-panel wizard with Arabic-first copy, spring transitions, and mobile-safe layout:

- **Pediatric dosage calculator** — weight/age/formulation steps, mg-per-kg math, max-dose safety cap, clear "not a substitute for medical advice" note.
- **Interaction visualizer** — user adds active ingredients; results render as severity badges (low / medium / high) with plain-Arabic explanations. Backed by the existing clinical interaction provider already in the codebase, so no invented data.
- **Symptom assessment wizard** — branching decision tree with self-care guidance and deep links into matching pharmacy items.
- **Medication schedule planner** — build a daily dose grid, save locally, export as calendar reminders (.ics) and a printable sheet.

Each tool page gets its own SEO metadata, and the hub is linked from the homepage tools grid and bottom navigation.

## Phase 2 — Reading mechanics & scroll triggers

- Fixed top **reading progress bar** on long content pages.
- Sticky glass **table of contents** that auto-highlights the section currently in view (desktop sidebar, collapsible sheet on mobile).
- **80% scroll trigger**: a slide-up glass card suggesting a generic alternative and a related guide — dismissible, shown once per session.
- **Horizontal smart sliders** on product pages: "بدائل بنفس المادة الفعالة" (same active ingredient) and "يُشترى معًا كثيرًا".

## Phase 3 — AI assistant deep-linking

Upgrade the assistant so answers can emit **interactive preview cards** — product cards, tool cards, category cards — rendered inline in the chat and clickable straight through to the target page. The model returns structured card references; the UI resolves them against the real catalog so nothing fictional is ever shown.

## Phase 4 — Exit intent & instant navigation

- **Exit-intent glass modal** on desktop pointer-leave and mobile rapid back-gesture: one soft suggestion (try a tool / ask the assistant), capped at once per session, never on checkout or auth pages.
- **Hover prefetching** is already enabled globally; extend it to viewport prefetching for the main product and tool grids so taps feel instant on mobile.

## Technical notes

- Routes: `src/routes/tools.tsx` (layout) + `tools.index.tsx`, `tools.pediatric-dose.tsx`, `tools.interactions.tsx`, `tools.symptoms.tsx`, `tools.schedule.tsx`, each with its own `head()`.
- Reuse `Reveal`/`Stagger` motion primitives and existing `glass-*` tokens; no new design system.
- Interaction checks call the existing server-side clinical provider via `createServerFn`; catalog lookups use the public column whitelist already in `catalog.functions.ts`.
- Schedule planner and dismissal state use localStorage only — no new tables unless you want cross-device sync.
- Full TypeScript types, RTL-correct layouts, `prefers-reduced-motion` respected.

## Open question

The schedule planner and exit-intent/scroll dismissals default to per-browser storage. Say the word if you'd rather have them saved to the account so they follow the patient across devices.
