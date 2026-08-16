import { createServerFn } from '@tanstack/react-start'

export const getMyOrganization = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ organizationId: string; orgRole: string } | null> => {
    try {
      const { getActor } = await import('./session.server')
      const actor = await getActor()
      return { organizationId: actor.organizationId, orgRole: actor.orgRole }
    } catch {
      return null
    }
  },
)
