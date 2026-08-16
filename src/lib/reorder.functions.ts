import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const refreshInput = z.object({
  windowDays: z.number().int().min(14).max(365).optional(),
  leadTimeDays: z.number().int().min(1).max(180).optional(),
  coverDays: z.number().int().min(7).max(365).optional(),
})

const listInput = z.object({
  status: z.enum(['open', 'drafted', 'dismissed', 'ordered']).optional(),
  limit: z.number().int().min(1).max(200).optional(),
})

const decideInput = z.object({
  id: z.string().uuid(),
  status: z.enum(['open', 'drafted', 'dismissed', 'ordered']),
})

/** Recompute predictive reorder suggestions for the caller's organization. */
export const refreshReorder = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => refreshInput.parse(raw ?? {}))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { runRefresh } = await import('./reorder.server')
    const actor = await getActor()
    requirePermission(actor, 'purchase.write')
    return runRefresh({ ...data, organizationId: actor.organizationId })
  })

/** List current suggestions for the caller's organization. */
export const listReorderSuggestions = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => listInput.parse(raw ?? {}))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { fetchSuggestions } = await import('./reorder.server')
    const actor = await getActor()
    requirePermission(actor, 'inventory.read')
    return fetchSuggestions({ ...data, organizationId: actor.organizationId })
  })

/** Mark a suggestion as drafted / dismissed / ordered. */
export const decideReorderSuggestion = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => decideInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { updateSuggestionStatus } = await import('./reorder.server')
    const actor = await getActor()
    requirePermission(actor, 'purchase.write')
    return updateSuggestionStatus(actor.organizationId, data.id, data.status)
  })
