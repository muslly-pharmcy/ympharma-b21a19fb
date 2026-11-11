---
name: pharma-offline-sync
description: Check offline-first PWA and Android sync, quotas and deterministic recovery.
---

# Offline synchronization

- A WebView is not offline support. Define server-authoritative sync contract and transactional outbox.
- Treat twelve-hour offline operation as a requirement until tested, not a deployed fact.
- Require protected local storage, device quotas, UUID idempotency and replay-safe versions.
- Never cache server-only secrets or sensitive private API responses.
- Distinguish accepted, rejected, retryable, conflict and manual-review outcomes.
- Test airplane mode, restarts, duplicate replay, clock skew, reconnect and multiple devices.
- Differentiate Debug APK, signed release APK and store-ready release; attach evidence.
