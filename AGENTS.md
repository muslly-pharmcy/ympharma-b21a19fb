
- Oracle sync receiver is the TanStack route /api/public/oracle-sync (HMAC ORACLE_SYNC_HMAC_SECRET); no Supabase edge functions — project rule.
- ERP integration goes through /api/public/erp/v1/* (HMAC + idempotency, versioned snapshots, ERP_SYNC_ENABLED kill switch); legacy oracle-sync apply is frozen — it overwrote stock and mixed official/selling prices.
- Public backend identity is pinned in config/public-backend.ts; generated clients are redirected by the Vite resolver to app-owned lazy adapters to survive managed regeneration and prevent stale runtime overrides.
- Privileged access requires a securely bound URL, project ID and matching credential; never reuse a credential from another binding.
- SSR emits only public URL/key in escaped inert JSON before Scripts; session storage and public query/navigation caches are project-scoped, and private query/API responses are not persisted.
