# Restore acceptance plan — NOT EXECUTED

1. DB owner identifies the exact configured backend, staging project, migration runner and backup artifact/time. Do not reuse an unrelated project's credentials.
2. Verify backup readability, checksum, encryption and access controls. Keep patient data local; prefer synthetic fixtures for developer testing.
3. Restore only into an explicitly isolated non-production database. Disable external hooks, jobs, notifications, ERP exports and payment integrations before allowing application access.
4. Record restore start/end, PostgreSQL/extension versions, migration history, constraints, RLS, function definitions/ACLs and reconciliation totals without exposing patient records.
5. Exercise synthetic purchase/receipt/sale/return, financial balancing, idempotent retry and tenant/branch rejection. Prove the recovered data matches the backup cutoff.
6. Measure RTO and actual recoverable point against the proposed two-hour RTO/five-minute RPO. A successful dump or an available backup schedule alone is insufficient.
7. Obtain review of the evidence before marking G0 closed. Production changes and deployment still need separate approval.

Rollback for this baseline branch: close its PR or revert the documentation commit. It contains no executable migration or application change.
