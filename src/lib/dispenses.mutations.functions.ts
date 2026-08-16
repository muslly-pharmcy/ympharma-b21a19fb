import { createServerFn } from '@tanstack/react-start'
import {
  createDispenseInput, dispenseIdInput, cancelDispenseInput,
  returnDispenseInput, verifyBarcodeInput,
  type CreateDispenseInput, type DispenseIdInput, type CancelDispenseInput,
  type ReturnDispenseInput, type VerifyBarcodeInput,
} from '@/domain/dispenses/commands'
import { canTransitionDispense, type DispenseStatus } from '@/domain/dispenses/schemas'

type RpcFn = (name: string, args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>

async function loadDeps() {
  const [{ getActor, requireOrg, requirePermission }, { withIdempotency, newCorrelationId }, { supabaseAdmin }, { audit }] =
    await Promise.all([
      import('./session.server'),
      import('./idempotency.server'),
      import('@/integrations/supabase/client.server'),
      import('./audit.server'),
    ])
  return { getActor, requireOrg, requirePermission, withIdempotency, newCorrelationId, supabaseAdmin, audit }
}

async function emit(event: string, payload: Record<string, unknown>, correlation: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  await (supabaseAdmin.rpc as unknown as RpcFn)('emit_domain_event', {
    p_event_type: event,
    p_source: 'dispenses-mutations',
    p_payload: payload as unknown as never,
    p_priority: 'normal',
    p_correlation_id: correlation,
  })
}

interface DispenseRow {
  id: string
  organization_id: string
  prescription_id: string
  status: DispenseStatus
}

async function loadDispense(id: string, orgId: string): Promise<DispenseRow> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data, error } = await supabaseAdmin
    .from('hc_dispenses')
    .select('id, organization_id, prescription_id, status')
    .eq('id', id).single()
  if (error) throw new Error(error.message)
  if (data.organization_id !== orgId) throw new Error('Forbidden: cross-org dispense')
  return data as unknown as DispenseRow
}

async function writeStatus(
  dispenseId: string, from: DispenseStatus, to: DispenseStatus,
  actorId: string, reason: string | null, patch: Record<string, unknown>,
) {
  if (!canTransitionDispense(from, to)) {
    throw new Error(`Illegal transition: ${from} → ${to}`)
  }
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { error } = await supabaseAdmin.from('hc_dispenses')
    .update({ status: to, ...patch } as never)
    .eq('id', dispenseId)
  if (error) throw new Error(error.message)
  await supabaseAdmin.from('hc_dispense_status_history').insert({
    dispense_id: dispenseId, from_status: from, to_status: to,
    changed_by: actorId, reason,
  })
}

// -------------------- create --------------------
export const createDispense = createServerFn({ method: 'POST' })
  .validator((raw: unknown): CreateDispenseInput => createDispenseInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requireOrg, requirePermission, withIdempotency, newCorrelationId, supabaseAdmin, audit } = await loadDeps()
    const actor = await getActor()
    requireOrg(actor, data.organizationId)
    requirePermission(actor, 'dispense.write')
    const correlation = data.correlationId ?? newCorrelationId('dsp')

    return withIdempotency(data.idempotencyKey, actor.userId, 'createDispense', async () => {
      // Prescription must be approved
      const { data: rx, error: rxErr } = await supabaseAdmin
        .from('hc_prescriptions')
        .select('id, organization_id, patient_id, status')
        .eq('id', data.prescriptionId).single()
      if (rxErr) throw new Error(rxErr.message)
      if (rx.organization_id !== actor.organizationId) throw new Error('Forbidden: cross-org prescription')
      if (rx.status !== 'approved') throw new Error(`Prescription must be approved (current: ${rx.status})`)

      const { data: items, error: itErr } = await supabaseAdmin
        .from('hc_prescription_items').select('*').eq('prescription_id', data.prescriptionId)
      if (itErr) throw new Error(itErr.message)
      if (!items || items.length === 0) throw new Error('Prescription has no items')

      const { data: dsp, error } = await supabaseAdmin.from('hc_dispenses').insert({
        organization_id: data.organizationId,
        branch_id: actor.branchId,
        prescription_id: data.prescriptionId,
        patient_id: rx.patient_id,
        status: 'draft',
        notes: data.notes ?? null,
        correlation_id: correlation,
        created_by: actor.userId,
      }).select('id').single()
      if (error) throw new Error(error.message)
      const dspId = dsp.id as string

      const rows = (items as Array<{
        id: string; product_id: string | null; medication_name: string; quantity: number
      }>).map((it) => ({
        dispense_id: dspId,
        prescription_item_id: it.id,
        product_id: it.product_id,
        medication_name: it.medication_name,
        qty_requested: it.quantity,
      }))
      const { error: insErr } = await supabaseAdmin.from('hc_dispense_items').insert(rows)
      if (insErr) throw new Error(insErr.message)

      await supabaseAdmin.from('hc_dispense_status_history').insert({
        dispense_id: dspId, from_status: null, to_status: 'draft', changed_by: actor.userId,
      })
      await emit('DispenseCreated', { dispense_id: dspId, prescription_id: data.prescriptionId }, correlation)
      await audit(actor, { action: 'dispense.create', resourceType: 'dispense', resourceId: dspId, payload: { prescription_id: data.prescriptionId, items: rows.length } })
      return { id: dspId, correlationId: correlation }
    })
  })

// -------------------- prepare (reserve inventory via FEFO) --------------------
export const prepareDispense = createServerFn({ method: 'POST' })
  .validator((raw: unknown): DispenseIdInput => dispenseIdInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission, withIdempotency, newCorrelationId, supabaseAdmin, audit } = await loadDeps()
    const actor = await getActor()
    requirePermission(actor, 'dispense.write')
    const correlation = data.correlationId ?? newCorrelationId('dsp')

    return withIdempotency(data.idempotencyKey, actor.userId, 'prepareDispense', async () => {
      const dsp = await loadDispense(data.dispenseId, actor.organizationId)
      if (dsp.status !== 'draft') throw new Error(`Cannot prepare when status is "${dsp.status}"`)

      const { data: items, error: itErr } = await supabaseAdmin
        .from('hc_dispense_items').select('*').eq('dispense_id', dsp.id)
      if (itErr) throw new Error(itErr.message)
      if (!items || items.length === 0) throw new Error('No items to prepare')

      // Reserve FEFO for each item that has a product_id
      for (const it of items as Array<{ id: string; product_id: string | null; qty_requested: number; reservation_id: string | null }>) {
        if (!it.product_id) continue // free-text medication, skip inventory
        if (it.reservation_id) continue // already reserved (idempotent partial retry)
        const { data: reservationId, error } = await (supabaseAdmin.rpc as unknown as RpcFn)('inv_reserve_fefo', {
          p_org: actor.organizationId,
          p_product: it.product_id,
          p_qty: it.qty_requested,
          p_ref_type: 'dispense_item',
          p_ref_id: it.id,
          p_actor: actor.userId,
          p_correlation: correlation,
          p_allow_partial: false,
        })
        if (error) throw new Error(`Reserve failed for ${it.id}: ${error.message}`)

        // Fetch reservation allocations
        const { data: reservation } = await supabaseAdmin
          .from('inv_reservations').select('allocations').eq('id', reservationId as string).single()

        const { error: updErr } = await supabaseAdmin
          .from('hc_dispense_items')
          .update({
            reservation_id: reservationId as string,
            batch_allocations: (reservation?.allocations ?? []) as unknown as never,
          } as never)
          .eq('id', it.id)
        if (updErr) throw new Error(updErr.message)
      }

      await writeStatus(dsp.id, dsp.status, 'prepared', actor.userId, null, { prepared_by: actor.userId })
      await emit('DispensePrepared', { dispense_id: dsp.id }, correlation)
      await audit(actor, { action: 'dispense.prepare', resourceType: 'dispense', resourceId: dsp.id })
      return { id: dsp.id, status: 'prepared' as const, correlationId: correlation }
    })
  })

// -------------------- verify barcode on one item --------------------
export const verifyDispenseItemBarcode = createServerFn({ method: 'POST' })
  .validator((raw: unknown): VerifyBarcodeInput => verifyBarcodeInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission, supabaseAdmin, audit } = await loadDeps()
    const actor = await getActor()
    requirePermission(actor, 'dispense.verify')

    const { data: item, error } = await supabaseAdmin
      .from('hc_dispense_items')
      .select('id, product_id, dispense_id, batch_allocations')
      .eq('id', data.dispenseItemId).single()
    if (error) throw new Error(error.message)

    // Look up barcode: product barcode OR batch barcode
    let matched = false
    if (item.product_id) {
      const { data: bc } = await supabaseAdmin
        .from('catalog_barcodes').select('id').eq('product_id', item.product_id).eq('barcode', data.barcodeValue).limit(1)
      if (bc && bc.length > 0) matched = true
    }
    if (!matched) {
      // batch barcode fallback: check batches referenced in allocations
      const allocations = (item.batch_allocations ?? []) as Array<{ batch_id?: string }>
      const batchIds = allocations.map((a) => a.batch_id).filter(Boolean) as string[]
      if (batchIds.length > 0) {
        const { data: batches } = await supabaseAdmin
          .from('inv_stock_batches').select('id, batch_no').in('id', batchIds)
        if (batches?.some((b) => (b as { batch_no: string | null }).batch_no === data.barcodeValue)) {
          matched = true
        }
      }
    }
    if (!matched) throw new Error('Barcode does not match product or allocated batch')

    const { error: updErr } = await supabaseAdmin
      .from('hc_dispense_items')
      .update({ barcode_verified: true, barcode_value: data.barcodeValue } as never)
      .eq('id', data.dispenseItemId)
    if (updErr) throw new Error(updErr.message)
    await audit(actor, { action: 'dispense.item.verify_barcode', resourceType: 'dispense_item', resourceId: data.dispenseItemId })
    return { ok: true as const }
  })

// -------------------- verify (safety checks) --------------------
export const verifyDispense = createServerFn({ method: 'POST' })
  .validator((raw: unknown): DispenseIdInput => dispenseIdInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission, newCorrelationId, supabaseAdmin, audit } = await loadDeps()
    const actor = await getActor()
    requirePermission(actor, 'dispense.verify')
    const correlation = data.correlationId ?? newCorrelationId('dsp')

    const dsp = await loadDispense(data.dispenseId, actor.organizationId)
    if (dsp.status !== 'prepared') throw new Error(`Cannot verify when status is "${dsp.status}"`)

    const { data: items } = await supabaseAdmin
      .from('hc_dispense_items').select('id, product_id, barcode_verified, reservation_id').eq('dispense_id', dsp.id)

    for (const it of (items ?? []) as Array<{ id: string; product_id: string | null; barcode_verified: boolean; reservation_id: string | null }>) {
      if (it.product_id && !it.reservation_id) throw new Error(`Item ${it.id} has no inventory reservation`)
      if (it.product_id && !it.barcode_verified) throw new Error(`Item ${it.id} missing barcode verification`)
    }

    await writeStatus(dsp.id, dsp.status, 'verified', actor.userId, null, { verified_by: actor.userId })
    await emit('DispenseVerified', { dispense_id: dsp.id }, correlation)
    await audit(actor, { action: 'dispense.verify', resourceType: 'dispense', resourceId: dsp.id })
    return { id: dsp.id, status: 'verified' as const, correlationId: correlation }
  })

// -------------------- dispense (consume reservations) --------------------
export const dispensePrescription = createServerFn({ method: 'POST' })
  .validator((raw: unknown): DispenseIdInput => dispenseIdInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission, withIdempotency, newCorrelationId, supabaseAdmin, audit } = await loadDeps()
    const actor = await getActor()
    requirePermission(actor, 'dispense.write')
    const correlation = data.correlationId ?? newCorrelationId('dsp')

    return withIdempotency(data.idempotencyKey, actor.userId, 'dispensePrescription', async () => {
      const dsp = await loadDispense(data.dispenseId, actor.organizationId)
      if (dsp.status !== 'verified') throw new Error(`Cannot dispense when status is "${dsp.status}"`)

      const { data: items } = await supabaseAdmin
        .from('hc_dispense_items').select('id, product_id, reservation_id, qty_requested').eq('dispense_id', dsp.id)

      for (const it of (items ?? []) as Array<{ id: string; product_id: string | null; reservation_id: string | null; qty_requested: number }>) {
        if (!it.reservation_id) continue // free-text item
        const { error } = await (supabaseAdmin.rpc as unknown as RpcFn)('inv_consume_reservation', {
          p_reservation: it.reservation_id,
          p_actor: actor.userId,
          p_correlation: correlation,
        })
        if (error) throw new Error(`Consume failed for ${it.id}: ${error.message}`)
        await supabaseAdmin.from('hc_dispense_items')
          .update({ qty_dispensed: it.qty_requested } as never).eq('id', it.id)
      }

      await writeStatus(dsp.id, dsp.status, 'dispensed', actor.userId, null, { dispensed_by: actor.userId })
      await emit('DispenseDispensed', { dispense_id: dsp.id, prescription_id: dsp.prescription_id }, correlation)
      await audit(actor, { action: 'dispense.dispense', resourceType: 'dispense', resourceId: dsp.id })
      return { id: dsp.id, status: 'dispensed' as const, correlationId: correlation }
    })
  })

// -------------------- complete --------------------
export const completeDispense = createServerFn({ method: 'POST' })
  .validator((raw: unknown): DispenseIdInput => dispenseIdInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission, newCorrelationId, audit } = await loadDeps()
    const actor = await getActor()
    requirePermission(actor, 'dispense.write')
    const correlation = data.correlationId ?? newCorrelationId('dsp')

    const dsp = await loadDispense(data.dispenseId, actor.organizationId)
    if (dsp.status !== 'dispensed') throw new Error(`Cannot complete when status is "${dsp.status}"`)
    await writeStatus(dsp.id, dsp.status, 'completed', actor.userId, null, {})
    await emit('DispenseCompleted', { dispense_id: dsp.id }, correlation)
    await audit(actor, { action: 'dispense.complete', resourceType: 'dispense', resourceId: dsp.id })
    return { id: dsp.id, status: 'completed' as const, correlationId: correlation }
  })

// -------------------- cancel (release reservations if any) --------------------
export const cancelDispense = createServerFn({ method: 'POST' })
  .validator((raw: unknown): CancelDispenseInput => cancelDispenseInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission, newCorrelationId, supabaseAdmin, audit } = await loadDeps()
    const actor = await getActor()
    requirePermission(actor, 'dispense.write')
    const correlation = data.correlationId ?? newCorrelationId('dsp')

    const dsp = await loadDispense(data.dispenseId, actor.organizationId)
    if (dsp.status === 'completed' || dsp.status === 'returned' || dsp.status === 'cancelled') {
      throw new Error(`Cannot cancel when status is "${dsp.status}"`)
    }
    if (dsp.status === 'dispensed') throw new Error('Use return instead of cancel after dispensing')

    // Release any active reservations
    const { data: items } = await supabaseAdmin
      .from('hc_dispense_items').select('id, reservation_id').eq('dispense_id', dsp.id)
    for (const it of (items ?? []) as Array<{ id: string; reservation_id: string | null }>) {
      if (!it.reservation_id) continue
      await (supabaseAdmin.rpc as unknown as RpcFn)('inv_release_reservation', {
        p_reservation: it.reservation_id,
        p_actor: actor.userId,
        p_correlation: correlation,
      })
      await supabaseAdmin.from('hc_dispense_items')
        .update({ reservation_id: null, batch_allocations: [] as unknown as never } as never).eq('id', it.id)
    }

    await writeStatus(dsp.id, dsp.status, 'cancelled', actor.userId, data.reason, {})
    await emit('DispenseCancelled', { dispense_id: dsp.id, reason: data.reason }, correlation)
    await audit(actor, { action: 'dispense.cancel', resourceType: 'dispense', resourceId: dsp.id, payload: { reason: data.reason } })
    return { id: dsp.id, status: 'cancelled' as const, correlationId: correlation }
  })

// -------------------- return --------------------
export const returnDispense = createServerFn({ method: 'POST' })
  .validator((raw: unknown): ReturnDispenseInput => returnDispenseInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission, newCorrelationId, supabaseAdmin, audit } = await loadDeps()
    const actor = await getActor()
    requirePermission(actor, 'dispense.write')
    const correlation = data.correlationId ?? newCorrelationId('dsp')

    const dsp = await loadDispense(data.dispenseId, actor.organizationId)
    if (dsp.status !== 'dispensed' && dsp.status !== 'completed') {
      throw new Error(`Cannot return when status is "${dsp.status}"`)
    }

    const { data: ret, error } = await supabaseAdmin.from('hc_dispense_returns').insert({
      dispense_id: dsp.id,
      dispense_item_id: data.dispenseItemId ?? null,
      qty: data.qty,
      reason: data.reason,
      actor_user_id: actor.userId,
    }).select('id').single()
    if (error) throw new Error(error.message)

    // Transition to returned
    await writeStatus(dsp.id, dsp.status, 'returned', actor.userId, data.reason, {})
    await emit('DispenseReturned', { dispense_id: dsp.id, return_id: ret.id, qty: data.qty, reason: data.reason }, correlation)
    await audit(actor, { action: 'dispense.return', resourceType: 'dispense', resourceId: dsp.id, payload: { qty: data.qty, reason: data.reason } })
    return { id: dsp.id, status: 'returned' as const, returnId: ret.id as string, correlationId: correlation }
  })
