/**
 * Client-supplied conversation history is untrusted. Never accept a client
 * "system", "developer", "tool", or arbitrary role as provider input.
 */
export type ClientMessage = Readonly<{ role: 'user' | 'assistant'; content: string }>

function isClientMessage(value: unknown): value is ClientMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const msg = value as Record<string, unknown>
  return (
    (msg.role === 'user' || msg.role === 'assistant') &&
    typeof msg.content === 'string' &&
    msg.content.trim().length > 0
  )
}

export function normalizeClientMessages(
  input: unknown,
  maxTurns = 10,
  maxChars = 2000,
): ClientMessage[] {
  if (!Array.isArray(input)) return []
  const turns = Number.isSafeInteger(maxTurns) && maxTurns > 0 ? Math.min(maxTurns, 50) : 10
  const chars = Number.isSafeInteger(maxChars) && maxChars > 0 ? Math.min(maxChars, 4000) : 2000
  return input
    .filter(isClientMessage)
    .slice(-turns)
    .map((m) => ({ role: m.role, content: m.content.slice(0, chars) }))
}
