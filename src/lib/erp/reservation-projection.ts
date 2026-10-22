/** Contract reference ONLY. No website checkout or order route uses this projection.
 * The production order flow is hard-disabled until durable ERP reservation events exist. */
export class ReservationProjection {
  private version = 0n
  private watermark = 0n
  private qty = 0n
  private covered = new Set<string>()
  private blocked = true
  private holds = new Map<string, { qty: bigint; ack?: bigint }>()
  available() { if (this.blocked) return 0n; let q = this.qty; for (const [id, hold] of this.holds) if (!this.covered.has(id)) q -= hold.qty; return q > 0n ? q : 0n }
  reserve(id: string, qty: bigint) {
    if (qty <= 0n) throw Error('invalid_quantity')
    const old = this.holds.get(id)
    if (old) { if (old.qty !== qty) throw Error('request_conflict'); return true }
    if (this.available() < qty) return false
    this.holds.set(id, { qty }); return true
  }
  acknowledge(id: string, sequence: bigint) {
    const hold = this.holds.get(id)
    if (!hold || sequence <= 0n || hold.ack && hold.ack !== sequence) throw Error('ack_conflict')
    hold.ack = sequence
    if (sequence <= this.watermark && !this.covered.has(id)) this.blocked = true
    // ACK never adds quantity; only a matching authoritative snapshot covers the overlay.
  }
  snapshot(version: bigint, availableBase: bigint, watermark: bigint, coverage: { id: string; qty: bigint; sequence: bigint }[]) {
    if (version <= this.version || watermark < this.watermark) throw Error('stale_snapshot')
    const ids = new Set(coverage.map(e => e.id))
    const valid = availableBase >= 0n && ids.size === coverage.length && coverage.every(e => e.sequence > 0n && e.sequence <= watermark && (!this.holds.has(e.id) || this.holds.get(e.id)!.qty === e.qty && (!this.holds.get(e.id)!.ack || this.holds.get(e.id)!.ack === e.sequence))) && [...this.covered].every(id => ids.has(id)) && [...this.holds].every(([id,h]) => !h.ack || h.ack > watermark || ids.has(id))
    if (!valid) { this.blocked = true; throw Error('coverage_reconciliation_required') }
    this.qty = availableBase; this.version = version; this.watermark = watermark; this.covered = ids; this.blocked = false
  }
  release() { throw Error('reservation_lifecycle_not_implemented') }
}
