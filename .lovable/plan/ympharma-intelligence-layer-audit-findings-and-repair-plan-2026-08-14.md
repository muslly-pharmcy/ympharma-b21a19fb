# YmPharma Intelligence Layer — Audit Findings and Repair Plan

## Security first: the keys you pasted are burned

Six OpenAI keys were pasted as plain text in chat. Anything pasted into a chat transcript must be treated as compromised. Before anything else, revoke all six in the OpenAI dashboard and create one fresh key. I will store that fresh key as a server-only secret (`OPENAI_API_KEY`) through the secret tool — never in code, `.env`, `VITE_*`, the database, logs, or any reply. I will not echo any key value back to you.

## What the audit actually found

I inspected every AI file in the repo. The AI layer is not broken because of a bad model — there are **two competing AI paths**, and the one your customers use is the weakest one.

Path A — the real brain (unused by the website chat):
`src/lib/ai/runtime/` — kernel, intent router, model router, clinical RAG, tool registry, policy engine, budget engine, telemetry, PII filter, HITL, memory. ~2,900 lines, well structured.

Path B — what the website widget actually calls:
`src/routes/api/chat-widget.ts` — a 40-line raw `fetch` to the gateway with a hardcoded fast model, an inline Arabic prompt, no tools, no RAG, no retrieval, no memory strategy, no streaming, no timeout, no retry, no rate limit, no telemetry, and no authorization.

Concrete defects in the customer path:
1. It bypasses the kernel entirely, so none of the safety/routing/grounding work applies to real users.
2. It authenticates with `Authorization: Bearer` instead of the gateway's `Lovable-API-Key` header — a fragile auth path.
3. Hardcoded `google/gemini-3-flash-preview` for every question, including clinical ones — this is the "weak answers" symptom.
4. No product/inventory grounding, so medicine and order questions are answered from model memory. This is the "wrong answers" symptom.
5. No timeout or abort handling and a non-streaming call, so slow responses hang the UI — the "timeout / stuck generating" symptom.
6. Same pattern repeats in `generate-social-posts.ts` and `gemini-product-descriptions.functions.ts` (three separate hand-rolled gateway fetches).

Root cause statement: the intelligence layer exists but is not wired to the user-facing surface; the surface is a throwaway prototype endpoint.

## What I will build

1. **Single canonical provider.** Keep `src/lib/ai/gateway.server.ts` as the one server-side entry, and add a direct-OpenAI provider next to it that reads `OPENAI_API_KEY` server-side only. One switchable provider, not two architectures. Every AI call in the repo routes through it.
2. **Retire the prototype endpoint.** Rewrite `/api/chat-widget` to call the kernel: intent routing → authorization → tool use → grounded answer → streamed response. Same URL, so the existing widget keeps working.
3. **Model routing by task.** Update the router catalog to the current OpenAI ids: `gpt-5.6-luna` for FAQ/classification, `gpt-5.6-terra` for normal pharmacy help, `gpt-5.6-sol` for clinical reasoning, vision-capable model for medicine-box images. No hardcoded model at call sites.
4. **Tools with real authorization.** Wire the existing tool registry to genuine tools — medicine search, stock/branch availability, delivery zone + fee, order lookup, chronic medications, policy/FAQ search. Every tool validates input with a schema and runs under the caller's role (patient / pharmacist / admin). The model never picks its own permissions and never touches raw SQL.
5. **Grounding.** Route medicine and product questions through the catalog and the existing clinical RAG rather than model memory; interaction checks defer to the deterministic clinical engine already in the repo.
6. **Medical safety.** Explicit response classes (general info / medication info / guidance / warning / escalate / insufficient data), no diagnosis or dosing changes, pharmacist escalation with the pharmacy phone number.
7. **Arabic-first.** Language mirroring, Yemeni-dialect and transliterated drug-name matching, without destroying the original medicine identifier.
8. **Resilience.** Bounded retries with backoff on 429/5xx, timeout handling, a fallback model tier, safe user-facing Arabic error messages, and a request correlation id — reusing `src/lib/errors/classify.ts`.
9. **Rate limiting.** Apply the existing `public-endpoint-guard.server.ts` to the public AI endpoint with per-role limits.
10. **Observability.** Feed the existing telemetry table (model, latency, tokens, tool calls, error class, success) — aggregated only, no patient content — and add an "AI Intelligence" panel to Control Tower.
11. **Prompt registry.** Versioned server-side prompts per role (patient / pharmacist / admin / marketing) in `src/lib/ai/prompts/`, out of components.
12. **Tests.** New AI test suite: Arabic/English/mixed, tool authorization, prompt injection, schema failure, 429/timeout handling. Existing 214 tests must stay green.

## Verification I will report honestly

A minimal authenticated server-side test that calls OpenAI with the stored secret and prints only status + model + latency. Each acceptance item marked VERIFIED / PARTIALLY VERIFIED / NOT VERIFIED — no "production ready" claim without evidence.

## Scope note

Phases covering marketing approval workflow, long-term memory summarization, and the full pharmacist assistant are large. I will implement the core intelligence layer (items 1–12) first and list the deferred items explicitly in the final report rather than half-shipping them.

## Technical details

- New: `src/lib/ai/provider.server.ts` (OpenAI direct + gateway, one interface), `src/lib/ai/prompts/*.v1.ts`, `src/lib/ai/tools/*.ts` with Zod schemas, `src/lib/ai/telemetry` wiring.
- Rewritten: `src/routes/api/chat-widget.ts` (streaming, guarded, kernel-backed).
- Updated: `src/lib/ai/runtime/model-router.ts` catalog, `generate-social-posts.ts`, `gemini-product-descriptions.functions.ts` to use the central provider.
- Secret: `OPENAI_API_KEY` server-side only, read inside handlers, never at module scope, never `VITE_`-prefixed.
