# YMPharma / صيدلية المصلي — Setup & Run

## Requirements
- Node.js 22.12+ and Bun 1.4.3
- A Supabase project (backend: DB, Auth, Storage)

## Install
```bash
bun install --frozen-lockfile
```
Use Bun as the sole package manager. Commit `bun.lock`; do not regenerate
`package-lock.json` or mix npm dependency installation with the Bun lockfile.
CI and Docker install from the same frozen lockfile.

## Environment
Copy `.env.example` to `.env.local` for local integration settings:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```
The selected public backend is pinned in `config/public-backend.ts` to
`ybhrmcdlgyccywpmiucz`; old managed environment bindings cannot override it.
For privileged operations configure `MUSLLY_SUPABASE_PROJECT_ID` and
`MUSLLY_SUPABASE_SERVICE_ROLE_KEY` securely for that same project, as described
in [the deployment guide](docs/deployment/SELECTED-SUPABASE-CONNECTION.md).
Server-only secrets (never prefixed with VITE_) are configured in your hosting
provider: GOOGLE_API_KEY, GOOGLE_CX_ID, WHATSAPP_ACCESS_TOKEN,
WHATSAPP_PHONE_NUMBER_ID, LOVABLE_API_KEY, SUPABASE_SERVICE_ROLE_KEY.
Never commit server secrets in environment files; the managed `.env` contains
only public integration values and must not be used to store privileged keys.

## Develop
```bash
bun run dev     # http://localhost:8080
```

## Quality gates
```bash
bunx tsc --noEmit       # typecheck
bunx vitest run         # unit tests
bunx playwright test    # e2e (needs dev server)
bun run lint
```

## Build & preview
```bash
bun run build
bun run preview
```

## Database
- Migration history: `supabase/migrations/`
- Full schema snapshot: `supabase_schema.sql`
This connection release requires no schema migration. Before any later migration,
verify the target project and migration history against the actual schema, test on
an isolated database, and prepare a restore point. Do not apply the entire Supabase
and Drizzle histories blindly or enable the frozen Oracle apply path.

## Stack
TanStack Start v1 (React 19 + Vite 8), Tailwind CSS v4, Supabase, TanStack Query.
Routing is file-based in `src/routes/`; `src/routeTree.gen.ts` is generated.
