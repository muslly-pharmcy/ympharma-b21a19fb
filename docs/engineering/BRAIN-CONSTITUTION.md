# 🧠 MUSLLY AI OS — Brain Constitution (Wave I-Zero)

> **Status:** Ratified. Every future AI feature MUST conform to this document.
> **Scope:** Layer 0 (AI Runtime Governance) — foundation for the full 10-layer Brain.

---

## Principle #0 — The Brain is an Orchestrator, not a Model

No feature depends on a specific model, provider, or SDK primitive. Every call
crosses the same layers in the same order. Swapping a model = editing one row in
`MODEL_CATALOG`. Adding a tool = one entry in `META`. Adding an agent = one row
in `air_agents` + one row in `air_capabilities`.

---

## Layer 0 — AI Runtime Governance

The Runtime is the operating system for the Brain. It does not "think"; it decides
whether thinking is allowed, by whom, at what cost, and against which rules.

| # | Component | File | Responsibility |
|---|-----------|------|----------------|
| 1 | **Model Router**       | `src/lib/ai/runtime/model-router.ts`             | Policy-driven `tier → model` (never if/else). |
| 2 | **Tool Registry**      | `src/lib/ai/runtime/tool-registry.server.ts`     | Metadata (capability, cost, latency, timeout, retry, owner, version) + retry/timeout wrapper. |
| 3 | **Prompt Registry**    | `src/lib/ai/runtime/prompt-registry.server.ts`   | Versioned prompts with `status ∈ {draft, approved, deprecated}` + `rollback_version` + guardrails + `output_schema`. Only `approved` prompts run. |
| 4 | **Policy Engine**      | `src/lib/ai/runtime/policy-engine.server.ts`     | Declarative deny/require rules from `air_policies`; per-subject, per-org, priority-ordered. |
| 5 | **Budget Engine**      | `src/lib/ai/runtime/budget-engine.server.ts`     | Token / cost / latency budgets across `daily`, `monthly`, `emergency` windows. |
| 6 | **Capability Registry**| `src/lib/ai/runtime/capability-registry.server.ts` | `air_capabilities` — declares read/write/execute/call_tools/approve/learn per agent. |
| 7 | **Safety Layer**       | `src/lib/ai/runtime/safety-layer.server.ts`      | Pipeline: Input Validation → Policy Check → Tool Permission → Human Approval → Execution → Audit. |
| 8 | **Evaluation Engine**  | `src/lib/ai/runtime/evaluation-engine.server.ts` | `air_evaluations` — quality, latency, cost, success, retries, feedback per run. |
| 9 | **Memory Manager**     | `src/lib/ai/runtime/memory-manager.server.ts`    | `air_memory_layers` — `short (15m) / working (24h) / long / archive`. |
| 10| **Brain Kernel**       | `src/lib/ai/runtime/kernel.server.ts`            | The **single orchestrator**. Agents never call each other directly. |

---

## The Non-Negotiables

1. **No direct agent-to-agent calls.** `Agent A → Kernel → Agent B`. Always. Every hop is audited in `air_kernel_calls`.
2. **No hardcoded model.** All model choices route through `routeModel()`; catalog owns the mapping.
3. **No unapproved prompt in production.** `loadApprovedPrompt()` rejects `deprecated` status; `draft` prompts run only in test suites.
4. **No unbounded call.** Every dispatch passes Budget Engine before generation and settles after.
5. **No silent tool execution.** Every tool call is guarded by capability + metadata timeout/retry + audit trail via the Kernel.
6. **No memory leakage across orgs.** Every memory/policy/budget/capability row is `organization_id`-scoped with RLS.
7. **Reversibility.** Every prompt has `rollback_version`. Every run has an evaluation. Bad releases can be reverted in one UPDATE.

---

## Database (Layer 0 tables)

- `air_policies(org, key, subject, rule jsonb, priority, is_active)`
- `air_budgets(org, scope, period, token_limit, cost_limit_cents, latency_ms_limit, consumed_*, window_start)`
- `air_capabilities(org, agent_key, can_read/write/execute/call_tools/approve/learn, allowed_domains[])`
- `air_evaluations(org, run_id, quality, latency_ms, cost_cents, success, retries, feedback)`
- `air_kernel_calls(org, correlation_id, from_agent, to_agent, purpose, allowed, decision, policy_key, denied_reason)`
- `air_memory_layers(org, agent_key, layer, key, content, importance, expires_at)`
- `air_prompts` extended with: `version, status, guardrails, output_schema, approved_by, approved_at, rollback_version, evaluation_score`

All tables: `GRANT ... TO authenticated` + `service_role`, `ENABLE RLS`, org-scoped SELECT, admin-only writes for governance tables.

---

## Roadmap After I-Zero

Layer 0 is the platform. Layers 1–10 (Brain Core, Memory, Agents, Learning,
Knowledge, Decision Intelligence, Automation, Monitoring, Governance UI,
Evolution) are built on top **without** re-architecting the platform.

Order of build (from user's approved plan):
`Wave A ✅ → Wave E ✅ → Wave I-Zero ✅ → B → C → F → D → G → H → I (Full Brain) → J`.
