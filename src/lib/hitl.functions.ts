import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

// Thin wrapper module — all runtime logic lives in hitl.server.ts (serverFn splitting).
export const listHitlApprovals = createServerFn({ method: 'POST' })
  .validator((raw: unknown) =>
    z.object({ status: z.enum(['pending', 'approved', 'rejected', 'expired', 'all']).default('pending') }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { getActor } = await import('./session.server')
    const { listApprovals } = await import('./ai/runtime/hitl.server')
    const actor = await getActor()
    const rows = await listApprovals(actor.organizationId, data.status)
    return { items: rows.map((r) => JSON.parse(JSON.stringify(r)) as Record<string, string | number | boolean | null>) }

  })

export const decideHitlApproval = createServerFn({ method: 'POST' })
  .validator((raw: unknown) =>
    z
      .object({
        approvalId: z.string().uuid(),
        approve: z.boolean(),
        note: z.string().trim().max(500).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { getActor } = await import('./session.server')
    const { decideApproval } = await import('./ai/runtime/hitl.server')
    const actor = await getActor()
    const allowed =
      actor.roles.includes('admin') ||
      actor.roles.includes('owner') ||
      ['owner', 'admin', 'manager', 'pharmacist'].includes(actor.orgRole)
    if (!allowed) throw new Error('غير مصرح: اعتماد الإجراءات يتطلب صلاحية صيدلي أو مدير.')
    await decideApproval({
      organizationId: actor.organizationId,
      approvalId: data.approvalId,
      decidedBy: actor.userId,
      approve: data.approve,
      note: data.note,
    })
    return { ok: true }
  })
