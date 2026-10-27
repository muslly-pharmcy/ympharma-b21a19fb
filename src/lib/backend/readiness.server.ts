import { getActor, requirePermission } from '@/lib/session.server'
import { inspectServerBackend } from './server-credentials.server'
import { createSelectedAdminClient } from './admin.server'

export async function readServerBackendReadiness() {
  const actor = await getActor()
  requirePermission(actor, 'system.admin')
  return inspectServerBackend(process.env, (key) => createSelectedAdminClient(key, 5000).storage.listBuckets())
}
