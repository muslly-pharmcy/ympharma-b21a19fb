import { createServerFn } from '@tanstack/react-start'

export interface DiagnosticsActor {
  userId: string
  organizationId: string
  orgRole: string
  roles: string[]
  permissions: string[]
  ip: string | null
  userAgent: string | null
}

export const getDiagnosticsActor = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DiagnosticsActor> => {
    const { getActor, actorPermissions } = await import('./session.server')
    const actor = await getActor()
    return {
      userId: actor.userId,
      organizationId: actor.organizationId,
      orgRole: actor.orgRole,
      roles: actor.roles,
      permissions: [...actorPermissions(actor)].sort(),
      ip: actor.ip,
      userAgent: actor.userAgent,
    }
  },
)
