# YMPharma / صيدلية المصلي — Setup & Run

## Requirements
- Node.js 20+ (or Bun 1.1+)
- A Supabase project (backend: DB, Auth, Storage)

## Install
```bash
bun install     # or: npm install
```

## Environment
Copy `.env.example` to `.env.local` and fill in values:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```
Server-only secrets (never prefixed with VITE_) are configured in your hosting
provider: GOOGLE_API_KEY, GOOGLE_CX_ID, WHATSAPP_ACCESS_TOKEN,
WHATSAPP_PHONE_NUMBER_ID, LOVABLE_API_KEY, SUPABASE_SERVICE_ROLE_KEY.
Real `.env` / `.env.local` files were intentionally excluded from this export.

## Develop
```bash
bun run dev     # http://localhost:8080
```

## Quality gates
```bash
bunx tsgo --noEmit      # typecheck
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
Apply with the Supabase CLI: `supabase db push`

## Stack
TanStack Start v1 (React 19 + Vite 7), Tailwind CSS v4, Supabase, TanStack Query.
Routing is file-based in `src/routes/`; `src/routeTree.gen.ts` is generated.
