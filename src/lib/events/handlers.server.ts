// Event handler registry for the agent_events consumer.
//
// Contract (matches DB functions `claim_agent_events` / `mark_event_processed`
// / `fail_agent_event` + `agent_events_dlq`):
//
//   handler(event) => Promise<void>
//     - resolves      → mark_event_processed
//     - throws        → fail_agent_event (auto-DLQ at retry_count >= 5)
//
// Unknown event names are treated as pure audit records and acknowledged.
// This is intentional: `agent_events` is primarily an append-only domain
// audit stream. Downstream side effects are attached below on demand.

export interface AgentEvent {
  id: string
  event_name: string
  entity_type: string | null
  entity_id: string | null
  payload: Record<string, unknown>
  source: string
  occurred_at: string
  retry_count: number
}

export type EventHandler = (event: AgentEvent) => Promise<void>

// Explicit allow-list of downstream side effects. Add entries here as
// domain consumers are wired up; anything not listed is ack-only.
const HANDLERS: Record<string, EventHandler> = {
  // Example (kept commented until owning module lands):
  // 'ORDER_CONFIRMED': async (e) => { await sendOrderConfirmationEmail(e) },
}

export function getHandler(eventName: string): EventHandler | null {
  return HANDLERS[eventName] ?? null
}

export function listHandledEvents(): string[] {
  return Object.keys(HANDLERS)
}
