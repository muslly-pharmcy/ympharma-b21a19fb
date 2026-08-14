# Workspace Cleanup + Cursor IDE Setup

## Reality check first

Two items in the directive can't be done as written, so the plan adapts them:

1. **Cross-repo merge** — this workspace is a single codebase. I have no read access to a second repository (`muslly-pharmcy/ympharma-b21a19fb`) from here, so I can't diff or merge files that only exist there. What I can do is deduplicate and repair *this* workspace, which is what the GitHub connector then syncs.
2. **Squashing `supabase/migrations/`** — there are 59 migration files and every one of them has already been applied to the live database. Rewriting them into a single "clean" sequence does not change the database, but it does destroy the applied-migration history and risks a broken rebuild on any future restore. I will not rewrite applied migrations. Instead I'll audit the *current live schema* for the RLS guarantees you asked for and issue one new migration only if a real gap exists.

Everything else is doable.

## What I'll do

### 1. Codebase audit and deduplication
- Map every route, component, hook and lib module; list duplicates (same feature implemented twice) and orphans (files nothing imports).
- For each duplicate pair, keep the newest, fully-typed, feature-rich version and delete the other, updating all importers.
- Fix every broken or mismatched `@/*` import path.
- The four core modules stay untouched in behaviour: patient profile + medication vault (`src/routes/_authenticated/patient-profile.tsx` — it lives under the authenticated layout, that path is correct and stays), pharmacist clinical inspector, AI marketing assistant, and the SEO surfaces `/delivery/aden`, `/guides`, `/tools`.

### 2. Clinical data access review
- Verify RLS on patient vault images, chronic medication lists and health profiles is scoped to `auth.uid()` (with the pharmacist/staff read path going through the role check, not a blanket policy).
- Verify the `medical-vault` storage bucket is private and its object policies are owner-scoped.
- Only if a gap turns up: one new migration to close it, shown to you for approval.

### 3. package.json and environment
- Rename the project to `ympharma-b21a19fb`.
- Report any dependency version conflicts found; align them where it's safe to do so without breaking the build.
- Add `.env.example` with public placeholders only (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SITE_URL=https://muslly.com`, and the other `VITE_*` keys already in use). Note: this project's client key variable is `VITE_SUPABASE_PUBLISHABLE_KEY`, not `VITE_SUPABASE_ANON_KEY` — I'll keep the real name so nothing breaks.

### 4. Cursor IDE setup
- `.cursorrules` covering: strict TypeScript (no `any`), `@/*` path aliases, TanStack Start routing rules (routes live in `src/routes`, no React Router, server logic via `createServerFn`), Tailwind + glassmorphism/RTL conventions, the mandatory clinical-disclaimer harness on any AI-generated medical content, and a context map pointing at `src/lib/medical/*`, `src/lib/*.functions.ts` and the Supabase RLS model.
- `.cursorignore` excluding `node_modules`, build output, `.env*`, generated files (`src/routeTree.gen.ts`, `src/integrations/supabase/types.ts`).

### 5. Verification
- Full typecheck, lint, and a route smoke pass over the key public and admin surfaces before I report done.

## Deliverable

A short report listing: files removed, imports repaired, dependency conflicts found and resolved, RLS findings, and the new Cursor config files.
