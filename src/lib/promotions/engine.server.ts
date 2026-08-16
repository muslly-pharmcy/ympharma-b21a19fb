// Pure promotion rule engine. Data-driven — every discount is derived from
// stored promotion + targets + eligibility rows, not code branches per campaign.
// Kept in *.server.ts so tests can import directly without leaking to the browser.
import type {
  Promotion, PromotionTarget, PromotionEligibility, PromoWithMeta,
  PromoEvalContext, EvalResult, AppliedDiscount, CartLine,
} from '@/domain/promotions/schemas'

function sum(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
}

function withinWindow(p: Promotion, now: Date): boolean {
  if (p.starts_at && new Date(p.starts_at) > now) return false
  if (p.expires_at && new Date(p.expires_at) < now) return false
  return true
}

function passEligibility(el: PromotionEligibility[], ctx: PromoEvalContext): boolean {
  if (!el.length) return true
  // Every eligibility row must pass (AND semantics — more strict is safer).
  for (const e of el) {
    switch (e.kind) {
      case 'all': continue
      case 'first_purchase': if (!ctx.isFirstPurchase) return false; continue
      case 'customer':
        if (!ctx.customerId || ctx.customerId !== e.value) return false; continue
      case 'loyalty_tier':
        if (!ctx.loyaltyTier || ctx.loyaltyTier !== e.value) return false; continue
      case 'segment':
        // Segment membership is resolved server-side before evaluation; the caller
        // strips promotions with unmatched segments. If it reaches here we accept.
        continue
    }
  }
  return true
}

function matchesTargets(line: CartLine, targets: PromotionTarget[], ctx: PromoEvalContext): boolean {
  const includes = targets.filter((t) => t.target_kind === 'include')
  const excludes = targets.filter((t) => t.target_kind === 'exclude')
  const hit = (t: PromotionTarget): boolean => {
    switch (t.entity_kind) {
      case 'product': return line.productId === t.entity_ref
      case 'category': return (line.category ?? '') === t.entity_ref
      case 'manufacturer': return (line.manufacturer ?? '') === t.entity_ref
      case 'branch': return (ctx.branchId ?? '') === t.entity_ref
      case 'loyalty_tier': return (ctx.loyaltyTier ?? '') === t.entity_ref
    }
  }
  if (excludes.some(hit)) return false
  if (!includes.length) return true
  return includes.some(hit)
}

function applicableLines(p: PromoWithMeta, ctx: PromoEvalContext): CartLine[] {
  if (!p.targets.length) return ctx.cart
  return ctx.cart.filter((l) => matchesTargets(l, p.targets, ctx))
}

function num(v: unknown, fb = 0): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fb
}

function clampCap(amount: number, cap: number | null | undefined): number {
  if (cap == null) return amount
  return Math.min(amount, cap)
}

interface ComputeArgs { pwm: PromoWithMeta; ctx: PromoEvalContext; subtotal: number }
function computeDiscount({ pwm, ctx, subtotal }: ComputeArgs): AppliedDiscount | null {
  const p = pwm.promotion
  const cfg = p.config
  const applicable = applicableLines(pwm, ctx)
  const applicableTotal = sum(applicable)
  if (applicableTotal <= 0 && p.kind !== 'free_shipping') return null

  let amount = 0
  let detail = ''
  switch (p.kind) {
    case 'percentage': {
      const pct = num(cfg.percent, 0)
      amount = (applicableTotal * pct) / 100
      detail = `${pct}% × ${applicableTotal.toFixed(2)}`
      break
    }
    case 'fixed': {
      amount = num(cfg.amount, 0)
      detail = `flat ${amount.toFixed(2)}`
      break
    }
    case 'category_discount': {
      const pct = num(cfg.percent, 0)
      amount = (applicableTotal * pct) / 100
      detail = `category ${cfg.category ?? '?'} × ${pct}%`
      break
    }
    case 'tier_discount': {
      if (!ctx.loyaltyTier || ctx.loyaltyTier !== cfg.tier) return null
      const pct = num(cfg.percent, 0)
      amount = (subtotal * pct) / 100
      detail = `tier ${cfg.tier} × ${pct}%`
      break
    }
    case 'bogo': {
      const buy = Math.max(1, num(cfg.buy, 1))
      const get = Math.max(1, num(cfg.get, 1))
      const pct = num(cfg.discount_percent, 100)
      // Discount the cheapest `get` units per group of (buy+get).
      const units: number[] = []
      for (const l of applicable) for (let i = 0; i < l.qty; i++) units.push(l.unitPrice)
      units.sort((a, b) => a - b)
      const groups = Math.floor(units.length / (buy + get))
      const freeUnits = groups * get
      const disc = units.slice(0, freeUnits).reduce((s, u) => s + (u * pct) / 100, 0)
      amount = disc
      detail = `BOGO ${buy}+${get} × ${pct}% (${freeUnits} units)`
      break
    }
    case 'free_shipping': {
      amount = num(cfg.shipping_cost, 0) // caller may override via ctx metadata later
      detail = 'free shipping'
      break
    }
    case 'free_gift': {
      amount = 0
      detail = `gift ${cfg.gift_product ?? '?'}`
      break
    }
  }

  amount = Math.max(0, amount)
  amount = clampCap(amount, p.max_discount)
  // Never discount below zero.
  amount = Math.min(amount, subtotal)
  if (amount <= 0 && p.kind !== 'free_gift' && p.kind !== 'free_shipping') return null
  return {
    promotionId: p.id, code: p.code, kind: p.kind,
    amount: Math.round(amount * 100) / 100, detail,
  }
}

export function evaluatePromotions(
  promotions: PromoWithMeta[],
  ctx: PromoEvalContext,
): EvalResult {
  const now = ctx.now ?? new Date()
  const subtotal = sum(ctx.cart)
  const applied: AppliedDiscount[] = []
  const skipped: EvalResult['skipped'] = []

  // Sort by priority ascending (lower runs first, so higher-priority = smaller number).
  const sorted = [...promotions]
    .filter((pw) => pw.promotion.status === 'active')
    .sort((a, b) => a.promotion.priority - b.promotion.priority)

  let stackedApplied = false
  let stopStacking = false
  let runningSubtotal = subtotal
  for (const pw of sorted) {
    const p = pw.promotion
    if (stopStacking) { skipped.push({ promotionId: p.id, code: p.code, reason: 'not_stackable' }); continue }
    if (!withinWindow(p, now)) { skipped.push({ promotionId: p.id, code: p.code, reason: 'out_of_window' }); continue }
    if (p.min_spend != null && subtotal < p.min_spend) { skipped.push({ promotionId: p.id, code: p.code, reason: 'below_min_spend' }); continue }
    if (p.usage_limit != null && p.usage_count >= p.usage_limit) { skipped.push({ promotionId: p.id, code: p.code, reason: 'exhausted' }); continue }
    if (!passEligibility(pw.eligibility, ctx)) { skipped.push({ promotionId: p.id, code: p.code, reason: 'ineligible' }); continue }
    if (stackedApplied && !p.stackable) { skipped.push({ promotionId: p.id, code: p.code, reason: 'not_stackable' }); continue }

    const disc = computeDiscount({ pwm: pw, ctx, subtotal: runningSubtotal })
    if (!disc) { skipped.push({ promotionId: p.id, code: p.code, reason: 'no_discount' }); continue }
    applied.push(disc)
    runningSubtotal = Math.max(0, runningSubtotal - disc.amount)
    stackedApplied = true
    // A non-stackable promotion consumes the slot; all subsequent promotions are marked skipped.
    if (!p.stackable) stopStacking = true
  }

  const discountTotal = Math.round(applied.reduce((s, a) => s + a.amount, 0) * 100) / 100
  const finalTotal = Math.max(0, Math.round((subtotal - discountTotal) * 100) / 100)
  return { subtotal, discountTotal, finalTotal, applied, skipped }
}
