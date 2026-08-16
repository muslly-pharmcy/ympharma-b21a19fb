// Real Supabase-backed actor resolution.
// Every mutation server fn calls `await getActor()` to identify the caller.
// Public API is unchanged from the demo bridge; the internals now:
//   1. read the bearer token attached by `attachSupabaseAuth` (client middleware)
//   2. validate it via Supabase Auth (`auth.getUser(token)`)
//   3. look up the user's active org membership + app roles via the service role
//   4. attach request metadata (IP, UA, correlation ID) for audit
import { getRequest, getRequestHeader } from '@tanstack/react-start/server'

export interface Actor {
  userId: string
  organizationId: string
  branchId: string | null
  roles: string[] // app_role from public.user_roles
  orgRole: string // role from public.organization_members
  correlationId: string
  ip: string | null
  userAgent: string | null
}

export class UnauthorizedError extends Error {
  constructor(msg = 'Unauthorized') {
    super(msg)
    this.name = 'UnauthorizedError'
  }
}

function readBearer(): string {
  const raw = getRequestHeader('authorization') ?? ''
  if (!raw.toLowerCase().startsWith('bearer ')) {
    throw new UnauthorizedError('Missing bearer token')
  }
  const token = raw.slice(7).trim()
  if (!token || token.split('.').length !== 3) {
    throw new UnauthorizedError('Invalid bearer token')
  }
  return token
}

function extractRequestMeta(): { ip: string | null; userAgent: string | null } {
  const req = getRequest()
  const headers = req?.headers
  const fwd = headers?.get('x-forwarded-for') ?? ''
  const ip = fwd.split(',')[0]?.trim() || headers?.get('x-real-ip') || null
  return { ip: ip || null, userAgent: headers?.get('user-agent') ?? null }
}

/**
 * Resolves the calling user to an Actor.
 * Throws UnauthorizedError when the token is missing, invalid, or the user
 * has no active organization membership.
 */
export async function getActor(): Promise<Actor> {
  const token = readBearer()
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
  if (userErr || !userRes?.user) {
    throw new UnauthorizedError('Invalid session')
  }
  const userId = userRes.user.id

  const [{ data: mem, error: memErr }, { data: roles }] = await Promise.all([
    supabaseAdmin
      .from('organization_members')
      .select('organization_id, role, branch_scope')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin.from('user_roles').select('role').eq('user_id', userId),
  ])
  if (memErr) throw new UnauthorizedError(memErr.message)
  if (!mem) {
    throw new UnauthorizedError('User has no active organization membership')
  }

  const meta = extractRequestMeta()
  const branchScope = (mem.branch_scope as unknown as string[] | null) ?? []
  return {
    userId,
    organizationId: mem.organization_id as unknown as string,
    branchId: branchScope[0] ?? null,
    roles: ((roles ?? []) as Array<{ role: string }>).map((r) => r.role),
    orgRole: mem.role as unknown as string,
    correlationId: crypto.randomUUID(),
    ip: meta.ip,
    userAgent: meta.userAgent,
  }
}

export function requireOrg(actor: Actor, organizationId: string) {
  if (actor.organizationId !== organizationId) {
    throw new UnauthorizedError('Actor is not a member of this organization.')
  }
}

export function requireRole(actor: Actor, roles: string[]) {
  const has = actor.roles.some((r) => roles.includes(r)) || roles.includes(actor.orgRole)
  if (!has) throw new UnauthorizedError(`Missing required role: ${roles.join('|')}`)
}

// -------------------- RBAC permission matrix --------------------
// Role-derived permissions. Owner/admin (app_role) get everything.
// Org roles (organization_members.role) map to a per-resource permission set.
// This is intentionally simple; a full policy engine ships in Phase 2.6+.
export type Permission =
  | 'catalog.read' | 'catalog.write'
  | 'inventory.read' | 'inventory.write'
  | 'warehouse.read' | 'warehouse.write'
  | 'supplier.read' | 'supplier.write'
  | 'purchase.read' | 'purchase.write'
  | 'doctor.read' | 'doctor.write'
  | 'patient.read' | 'patient.write'
  | 'prescription.read' | 'prescription.write'
  | 'dispense.read' | 'dispense.write' | 'dispense.verify'
  | 'insurance.read' | 'insurance.write' | 'insurance.approve'
  | 'customer.read' | 'customer.write' | 'customer.merge'
  | 'loyalty.read' | 'loyalty.write' | 'loyalty.adjust' | 'loyalty.redeem'
  | 'campaign.read' | 'campaign.write'
  | 'segment.read' | 'segment.write'
  | 'ai.execute' | 'ai.loyalty.read' | 'ai.campaign.read'
  | 'analytics.read' | 'analytics.export'
  | 'system.admin'

const ALL: Permission[] = [
  'catalog.read','catalog.write','inventory.read','inventory.write',
  'warehouse.read','warehouse.write','supplier.read','supplier.write',
  'purchase.read','purchase.write','doctor.read','doctor.write',
  'patient.read','patient.write','prescription.read','prescription.write',
  'dispense.read','dispense.write','dispense.verify',
  'insurance.read','insurance.write','insurance.approve',
  'customer.read','customer.write','customer.merge',
  'loyalty.read','loyalty.write','loyalty.adjust','loyalty.redeem',
  'campaign.read','campaign.write','segment.read','segment.write',
  'ai.execute','ai.loyalty.read','ai.campaign.read',
  'analytics.read','analytics.export','system.admin',
]

const ORG_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: ALL,
  admin: ALL.filter((p) => p !== 'system.admin'),
  manager: [
    'catalog.read','catalog.write','inventory.read','inventory.write',
    'warehouse.read','warehouse.write','supplier.read','supplier.write',
    'purchase.read','purchase.write','doctor.read','patient.read',
    'prescription.read','dispense.read','dispense.verify','ai.execute','ai.loyalty.read','ai.campaign.read',
    'insurance.read','insurance.write','insurance.approve',
    'customer.read','customer.write','customer.merge',
    'loyalty.read','loyalty.write','loyalty.adjust','loyalty.redeem',
    'campaign.read','campaign.write','segment.read','segment.write',
    'analytics.read','analytics.export',
  ],
  pharmacist: [
    'catalog.read','inventory.read','inventory.write','warehouse.read',
    'supplier.read','purchase.read','patient.read','patient.write',
    'prescription.read','prescription.write',
    'dispense.read','dispense.write','dispense.verify','ai.execute','ai.loyalty.read',
    'insurance.read','insurance.write',
    'customer.read','customer.write',
    'loyalty.read','loyalty.write','loyalty.redeem',
    'campaign.read','segment.read','analytics.read',
  ],
  staff: [
    'catalog.read','inventory.read','warehouse.read','supplier.read',
    'purchase.read','patient.read','prescription.read','dispense.read',
    'insurance.read','customer.read','loyalty.read','campaign.read','segment.read',
  ],
  viewer: [
    'catalog.read','inventory.read','warehouse.read','supplier.read',
    'purchase.read','patient.read','prescription.read','doctor.read',
    'dispense.read','insurance.read','customer.read','loyalty.read','campaign.read','segment.read',
  ],
}

export function actorPermissions(actor: Actor): Set<Permission> {
  // app_role 'admin' or 'superadmin' = full access
  if (actor.roles.includes('admin') || actor.roles.includes('superadmin')) {
    return new Set(ALL)
  }
  return new Set(ORG_ROLE_PERMISSIONS[actor.orgRole] ?? [])
}

export function hasPermission(actor: Actor, permission: Permission): boolean {
  return actorPermissions(actor).has(permission)
}

export function requirePermission(actor: Actor, permission: Permission) {
  if (!hasPermission(actor, permission)) {
    throw new UnauthorizedError(`Missing permission: ${permission}`)
  }
}
