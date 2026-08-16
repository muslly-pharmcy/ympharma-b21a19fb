// AI Runtime Layer 0 — shared types.
// All modules speak this vocabulary; the Kernel is the ONLY orchestrator.

export type ModelTier = 'fast' | 'balanced' | 'deep' | 'vision'

export interface CapabilityRow {
  agent_key: string
  can_read: boolean
  can_write: boolean
  can_execute: boolean
  can_call_tools: boolean
  can_approve: boolean
  can_learn: boolean
  allowed_domains: string[]
}

export interface PolicyRule {
  when?: Record<string, unknown>       // arbitrary predicate matched against KernelCall.context
  require?: Array<'human_approval' | 'role:admin' | 'role:doctor' | 'role:pharmacist'>
  deny?: boolean
  reason?: string
}

export interface PolicyRow {
  key: string
  subject: string
  rule: PolicyRule
  priority: number
  is_active: boolean
}

export interface BudgetRow {
  id: string
  scope: string
  period: 'daily' | 'monthly' | 'emergency'
  token_limit: number | null
  cost_limit_cents: number | null
  latency_ms_limit: number | null
  consumed_tokens: number
  consumed_cost_cents: number
  window_start: string
  is_active: boolean
}

export interface KernelDecision {
  allowed: boolean
  deniedReason?: string
  policyKey?: string
  requiresApproval?: boolean
}

export interface KernelCall {
  fromAgent: string | null       // null when initiated by user
  toAgent: string
  purpose: string                // e.g. 'invoke', 'read', 'write', 'tool:search_products'
  context: Record<string, unknown>
}
