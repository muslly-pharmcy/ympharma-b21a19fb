
- Oracle sync receiver is the TanStack route /api/public/oracle-sync (HMAC ORACLE_SYNC_HMAC_SECRET); no Supabase edge functions — project rule.
- ERP integration goes through /api/public/erp/v1/* (HMAC + idempotency, versioned snapshots, ERP_SYNC_ENABLED kill switch); legacy oracle-sync apply is frozen — it overwrote stock and mixed official/selling prices.
