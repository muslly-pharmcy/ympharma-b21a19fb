# Phase 3 — AI Root-Cause Diagnosis + Central AI Core Blueprint

Diagnosis only. No Control Tower changes, no rebuild, no new chatbot.

## A. Current AI architecture (evidence-based)

There is not one AI system — there are **four disconnected call paths**:

| Path | Entry | Provider call | Models |
|---|---|---|---|
| 1. Patient chat | `src/routes/api/chat-widget.ts` → `src/lib/ai/provider.server.ts` | OpenAI Responses API direct, gateway failover | `gpt-5.6-sol/terra/luna` (`src/lib/ai/model-policy.ts`) |
| 2. "Kernel" runtime | `src/lib/ai/runtime/kernel.server.ts` (+18 sibling modules) | AI SDK via `src/lib/ai/gateway.server.ts` | tier table in `runtime/model-router.ts` |
| 3. Feature one-offs | `social.functions.ts`, `cosmic-search.functions.ts`, `vision.server.ts`, `rx-scan.functions.ts`, `gemini-product-descriptions.functions.ts`, `product-imagery.functions.ts`, `seedance.functions.ts`, `api/public/hooks/generate-social-posts.ts` | 5 separate raw `fetch` call sites + 2 SDK call sites | hardcoded per file, mostly `google/gemini-3-flash-preview` |
| 4. Super-agent | `src/super-agent/*` | optional dynamic import of the kernel, silently falls back | n/a |

Clients: `ChatWidget.tsx`, `AiHealthBot.tsx` (both POST `/api/chat-widget`), `AiPrescriptionScanner.tsx`, `vision-lab`, `inventory-chat`, `scan-invoice`, `seedance-studio`, `search`.

## B. Root cause

Two distinct causes, both confirmed:

1. **Provider credit exhaustion (the visible failure).** The configured `OPENAI_API_KEY` authenticates successfully but the account returns `insufficient_quota / credit_balance_exhausted`. It arrives as a **mid-stream SSE error on an HTTP 200 response**, so the old code saw a valid stream with zero text and returned a blank/fallback reply. Symptom looked like "the AI is broken"; it was an unhandled billing error class.
2. **Architectural fragmentation (the systemic cause).** Nine independent provider call sites means each one has its own key handling, model id, timeout, retry, error mapping and telemetry. Nothing is centrally observable, so a provider-level failure surfaced as an unexplained blank reply instead of a classified error.

Not the cause (checked and ruled out): key exposed to the browser (never in `VITE_*`), wrong API shape, broken streaming, CORS, RLS blocking, missing auth.

## C. Status summary

| Item | Status |
|---|---|
| OpenAI key | VALID — server-side only, but **BLOCKED** (no credit) |
| Model ids | VALID |
| Streaming | WORKING (SSE, one canonical parser in `provider.server.ts`) |
| Tools | WORKING for patient scope (4 tools), NOT USED by every other path |
| Supabase access from AI | Read-only, explicit columns, no dynamic SQL — safe |
| Telemetry | PARTIAL — only `kernel_module_telemetry`, only two paths write to it |
| Feature flags | EXISTS (`useFeatureFlags`, `app_settings`) — no AI flags yet |

## D. Real risks (no speculation)

- **Availability**: single-account dependency; the failover I added is the only thing keeping the assistant alive.
- **Cost/observability**: 9 call sites, no unified token/cost accounting, no per-feature budget.
- **Consistency**: clinical safety rules exist only in the patient prompt; other paths call models with no safety layer.
- **Dead weight**: ~19 runtime modules under `src/lib/ai/runtime/` are barely reachable (2 dynamic imports) — a maintenance hazard, not a security one.

## E. AI feature inventory

| Feature | State | Destination in Core |
|---|---|---|
| Patient chat / product / order / delivery | EXISTS, working | Patient domain (reference implementation) |
| Clinical / interactions | PARTIAL — deterministic engine authoritative, AI not wired | Clinical domain, stricter tools |
| Pharmacist assist | MISSING | Staff domain |
| Vision (Rx, boxes, invoices) | EXISTS, 3 duplicated implementations | Vision domain |
| Marketing / social | EXISTS, duplicated (2 call sites) | Marketing domain |
| Admin / system health | PARTIAL | Control Tower AI panel |
| RAG / embeddings | MISSING — `clinical-rag.server.ts` is a stub, no pgvector store in use | Knowledge domain (build once, later) |
| Kernel runtime | DUPLICATED / mostly dead | Retire or absorb |

## F. Central AI Core — target

One module owns every model call:

```text
UI (patient / staff / admin)
      ↓
Central AI Core  ← identity, role, tenant, feature flags
      ↓
Router → Context → Safety → Model → Tool Registry (permissioned)
      ↓
Supabase / Clinical engine / Knowledge
      ↓
Validated response + telemetry → Control Tower
```

Non-negotiables: key stays server-side; authorization is enforced in code **before** tool execution, never by the model; clinical engine stays authoritative; admin surface lives only under `/control-tower`.

## G. Migration path (later phases, not now)

1. **Stabilize** — resolve billing, classify provider errors everywhere, surface AI health in Control Tower read-only.
2. **Centralize** — every call site routes through `provider.server.ts`; delete duplicate fetch clients.
3. **Tool registry** — one registry with `permission`, `roles`, `scope`, `audit` per tool; patient tools migrate first.
4. **Context engine** — minimum-necessary context assembly, per-role.
5. **Model routing** — task/cost/latency policy replaces hardcoded ids.
6. **Safety** — shared clinical + PII layer applied to all domains.
7. **Observability** — one telemetry table: request id, role, feature, model, tokens, cost, tool calls, error class.
8. **Control Tower** — AI health/cost/flags panel inside the existing dashboard.
9. **Certification** — regression suite + load test.

## H. What I recommend doing next (pick one)

- **Option 1 — Billing first**: add credit to the OpenAI account, then I verify direct-key operation end to end. Lowest effort; AI already works today on failover.
- **Option 2 — Phase 1 Stabilize**: unify error classification across the 9 call sites and add a read-only AI health panel to Control Tower. No behaviour change for users.
- **Option 3 — Phase 2 Centralize**: collapse all 9 provider call sites into the canonical provider and retire the dead kernel modules. Bigger diff, biggest long-term payoff.

## Final status

**PARTIALLY VERIFIED** — root cause confirmed with live evidence and the patient path is verified working; clinical, RAG, and admin AI paths remain unverified because they are not implemented or not reachable.
