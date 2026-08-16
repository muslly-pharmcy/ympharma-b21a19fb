/**
 * Secure Admin Audit Module
 * Mandatory permission enforcement + audit logging for critical operations
 */

import { ApiError } from '../errors/api-error';

// Permission types
export type Permission =
  | 'patient:delete'
  | 'prescription:delete'
  | 'inventory:delete'
  | 'role:change'
  | 'permission:change'
  | 'price:change'
  | 'config:change'
  | 'apikey:change'
  | 'secret:change';

// Actor interface
export interface Actor {
  id: string;
  organizationId?: string;
  permissions: Permission[];
  role?: string;
}

// Audit log entry
interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  organizationId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  correlationId: string;
  ipAddress?: string;
  userAgent?: string;
}

// In-memory audit log buffer (replace with DB in production)
const auditLogBuffer: AuditLogEntry[] = [];

function generateCorrelationId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateAuditId(): string {
  return `log_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Write audit log entry
 */
export async function writeAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
  const fullEntry: AuditLogEntry = {
    ...entry,
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
  };
  auditLogBuffer.push(fullEntry);

  // Also log to console for observability
  console.log(`[AUDIT] ${fullEntry.action} by ${fullEntry.actorId}`, {
    id: fullEntry.id,
    resourceType: fullEntry.resourceType,
    resourceId: fullEntry.resourceId,
    correlationId: fullEntry.correlationId,
  });
}

/**
 * Mandatory permission check - MUST be called before every callback
 */
export function requirePermission(actor: Actor, permission: Permission): void {
  if (!actor.permissions.includes(permission)) {
    const correlationId = generateCorrelationId();
    throw new ApiError(
      'FORBIDDEN',
      403,
      `Permission denied: ${permission}`,
      { details: { correlationId, requiredPermission: permission } }
    );
  }
}

/**
 * Secure query wrapper - enforces permission before callback
 */
export async function secureQuery<T>(
  actor: Actor,
  permission: Permission,
  callback: () => Promise<T>
): Promise<T> {
  requirePermission(actor, permission);
  return await callback();
}

// ====== Audit helper functions for 9 critical operations ======

export async function auditDeletePatient(
  actor: Actor,
  patientId: string,
  patientName?: string,
  context?: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  await writeAuditLog({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: 'DELETE_PATIENT',
    resourceType: 'patient',
    resourceId: patientId,
    oldValue: { patientName },
    correlationId: generateCorrelationId(),
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });
}

export async function auditDeletePrescription(
  actor: Actor,
  prescriptionId: string,
  prescriptionData?: unknown,
  context?: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  await writeAuditLog({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: 'DELETE_PRESCRIPTION',
    resourceType: 'prescription',
    resourceId: prescriptionId,
    oldValue: prescriptionData,
    correlationId: generateCorrelationId(),
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });
}

export async function auditDeleteInventory(
  actor: Actor,
  inventoryId: string,
  inventoryData?: unknown,
  context?: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  await writeAuditLog({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: 'DELETE_INVENTORY',
    resourceType: 'inventory',
    resourceId: inventoryId,
    oldValue: inventoryData,
    correlationId: generateCorrelationId(),
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });
}

export async function auditRoleChange(
  actor: Actor,
  targetUserId: string,
  oldRole: string,
  newRole: string,
  context?: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  await writeAuditLog({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: 'ROLE_CHANGE',
    resourceType: 'user',
    resourceId: targetUserId,
    oldValue: { role: oldRole },
    newValue: { role: newRole },
    correlationId: generateCorrelationId(),
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });
}

export async function auditPermissionChange(
  actor: Actor,
  targetUserId: string,
  oldPermissions: Permission[],
  newPermissions: Permission[],
  context?: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  await writeAuditLog({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: 'PERMISSION_CHANGE',
    resourceType: 'user',
    resourceId: targetUserId,
    oldValue: { permissions: oldPermissions },
    newValue: { permissions: newPermissions },
    correlationId: generateCorrelationId(),
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });
}

export async function auditPriceChange(
  actor: Actor,
  productId: string,
  oldPrice: number,
  newPrice: number,
  context?: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  await writeAuditLog({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: 'PRICE_CHANGE',
    resourceType: 'product',
    resourceId: productId,
    oldValue: { price: oldPrice },
    newValue: { price: newPrice },
    correlationId: generateCorrelationId(),
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });
}

export async function auditConfigChange(
  actor: Actor,
  configKey: string,
  oldValue: unknown,
  newValue: unknown,
  context?: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  await writeAuditLog({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: 'CONFIG_CHANGE',
    resourceType: 'config',
    resourceId: configKey,
    oldValue,
    newValue,
    correlationId: generateCorrelationId(),
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });
}

export async function auditApiKeyChange(
  actor: Actor,
  keyId: string,
  action: 'created' | 'revoked' | 'rotated',
  context?: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  await writeAuditLog({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: `APIKEY_${action.toUpperCase()}`,
    resourceType: 'api_key',
    resourceId: keyId,
    correlationId: generateCorrelationId(),
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });
}

export async function auditSecretChange(
  actor: Actor,
  secretName: string,
  action: 'created' | 'updated' | 'deleted',
  context?: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  await writeAuditLog({
    actorId: actor.id,
    organizationId: actor.organizationId,
    action: `SECRET_${action.toUpperCase()}`,
    resourceType: 'secret',
    resourceId: secretName,
    correlationId: generateCorrelationId(),
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });
}

export { auditLogBuffer };
