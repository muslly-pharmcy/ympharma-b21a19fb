import { describe, expect, it } from 'vitest'
import { listTools } from '../src/lib/ai/tools.server'
import {
  listToolMeta,
  ToolRegistrationError,
  validateToolInput,
} from '../src/lib/ai/runtime/tool-registry.server'

describe('AI tool registry coverage', () => {
  it('requires every executable tool to have policy metadata and a strict input schema', () => {
    const executableKeys = listTools().map((tool) => tool.key).sort()
    const metadataKeys = listToolMeta().map((metadata) => metadata.key).sort()

    expect(metadataKeys).toEqual(executableKeys)
    for (const toolKey of executableKeys) {
      expect(() => validateToolInput(toolKey, {})).not.toThrow(ToolRegistrationError)
    }
  })

  it('rejects an unregistered tool instead of forwarding arbitrary model input', () => {
    expect(() => validateToolInput('unregistered_tool', { organization_id: 'attacker-controlled' }))
      .toThrow(ToolRegistrationError)
  })
})
