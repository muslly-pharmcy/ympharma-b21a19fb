# YMPharma Autonomous AI Kernel v3.0

Upgrade the existing Brain Kernel (Layer 0 runtime) into the v3.0 architecture: intent-aware routing, patient-scoped Ego Memory, an explicit Think → Plan → Critique → Execute loop, clinical RAG grounding, human-in-the-loop for risky actions, and the same capabilities exposed over MCP.

The project already has: model router (tier-based), memory manager (short/working/long/archive), tool registry, policy/budget/capability/safety layers, evaluation engine, a clinical engine with 7 adapters, and an MCP server with 3 tools. v3.0 fills the gaps rather than rebuilding.

## What changes

**1. Dynamic routing by intent (not just tier)**
An intent classifier picks the tier automatically: image/scan input → vision tier; clinical keywords (interaction, dose, diagnosis, treatment plan, forecast) → deep reasoning tier; everything else → fast tier. Callers may still pin a tier explicitly. Routing decision is recorded on every run.

**2. Ego Memory — unified Client Record**
A per-patient/customer memory scope layered on the existing memory tables: allergies, chronic conditions, medication history, preferences, and interaction log. The kernel loads the record when a request carries a patient/customer id and injects a compact, PHI-redacted context block. Writes are org-scoped with RLS; nothing crosses tenants.

**3. Volition loop (CoT + self-critique)**
Every deep-tier request runs four explicit stages — Thought, Plan, Critique, Execution — and stores the trace with the run so it is auditable. The Critique stage checks clinical risk, PII exposure, and plan coherence; it can force a verification step or downgrade the answer to advisory.

**4. Clinical RAG grounding**
Drug-interaction / allergy / dose / contraindication checks route through the existing clinical engine instead of the model's own knowledge. Any clinical answer carries the check results and a confidence statement; unverified claims are labelled as such.

**5. Human-in-the-loop gate**
Actions flagged as high-risk (dispensing, stock mutation, high-value orders, prescription changes) return a pending-approval result instead of executing. Approvals are recorded with actor and timestamp.

**6. MCP surface**
Add tools that expose the kernel over MCP alongside the current `whoami` / `search_catalog` / `check_stock`: a clinical-check tool and an ask-kernel tool, both running as the authenticated user with RLS enforced. Manifest re-extracted after the change.

**7. Observability**
Extend the AI runtime dashboard with routing distribution, critique outcomes, HITL queue, and per-tier cost — driven by the existing evaluation/run tables.

## Technical notes

- New/edited: `src/lib/ai/runtime/intent-router.ts`, `ego-memory.server.ts`, `volition.server.ts`, `clinical-rag.server.ts`, `hitl.server.ts`; `kernel.server.ts` wires them in the existing order (capabilities → safety → budget → prompt → route → tools → memory → generate → persist).
- The reference Python implementation is used as the architecture spec only; the app stays TypeScript on TanStack Start + `createServerFn`.
- Migration adds `air_hitl_approvals` and an ego-memory scope column, each with GRANTs, RLS, and org-scoped policies in the same migration.
- Constitution rules hold: no direct agent-to-agent calls, no hardcoded model, approved prompts only, every dispatch budgeted and audited.
- New system prompt (v3.0) is registered in `air_prompts` as a new version with `rollback_version` pointing at the current one, so it can be reverted in one update.

## Out of scope

No changes to storefront, checkout, or existing dashboards beyond the AI runtime page. No new external clinical data vendor — RAG grounds on the current clinical adapters and catalog.
