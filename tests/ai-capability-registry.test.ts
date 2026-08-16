import { describe, expect, it } from 'vitest'
import {
  CapabilityLookupError,
  resolveCapabilityLookup,
} from '../src/lib/ai/runtime/capability-registry.server'

describe('AI capability registry boundary', () => {
  const agentKey = 'clinical-assistant'

  it('keeps the legacy fresh-organization defaults only for a confirmed absent row', () => {
    expect(resolveCapabilityLookup(agentKey, { data: null, error: null })).toMatchObject({
      agent_key: agentKey,
      can_execute: true,
      can_call_tools: true,
    })
  })

  it('fails closed when the database query fails', () => {
    expect(() => resolveCapabilityLookup(agentKey, { data: null, error: { message: 'timeout' } }))
      .toThrow(CapabilityLookupError)
  })

  it('fails closed when a capability record is malformed or belongs to another agent', () => {
    expect(() => resolveCapabilityLookup(agentKey, {
      data: { agent_key: 'other-agent', can_read: true },
      error: null,
    })).toThrow(CapabilityLookupError)
  })
})
