# Claude Red defensive integration policy — YmPharma and muslly.com
Upstream reference: SnailSploit/Claude-Red@6196ba7464662de34e8744d359f175d1a7bca530 (MIT); these skills were independently drafted for defensive source audits. No offensive upstream skill or installer is shipped.

## Authorized for the review branch
- Read authorized repository source/config without revealing secrets or patient/account records.
- Propose and implement narrow, reviewable fixes on `security/claude-red-safe-20261121`, with synthetic unit tests and GitHub CI evidence.
- Create a draft PR. Treat the existing `AGENTS.md`, pharmacy RLS, immutable financial ledger, lot/FEFO, offline and clinical controls as authoritative.

## Not authorized by this integration
- Active probing/fuzzing/exploitation of a live service, production database writes or authenticated production API calls.
- Installing offensive scripts; brute-force, credential extraction, data exfiltration, C2, container breakout, RLS bypass or privilege escalation.
- Secret reads in logs, copying `.env` values, screenshots of PHI, outgoing patient payloads.
- Merge, deploy, DNS edits, Cloudflare/Supabase modifications, private data imports, real-device intrusive tests or branch protection changes.

## Required gates
- G1: Pin repository head, verify source and review code diff.
- G2: CI with synthetic tests for the exact PR head; PASS means observed result only.
- G3: Any RLS, concurrent POS or mobile dynamic testing needs isolated staging with fabricated data and explicit approved limits.
- G4: Independent code review and rollback before merge/release.

## Contract
For each finding give: `ID | affected repo/commit/path:line | severity | OBSERVATION/PASS/FAIL/BLOCKED/NOT_RUN | evidence | proposed fix | residual risk | next gate`.
Storefront source in this repo does not prove which commit muslly.com deploys; verify the deployment mapping separately.
