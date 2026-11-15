/** Catalog import is review-only. Prices and stock here are proposals, never operational balances. */
export interface ExcelReviewRow {
  store_code: string
  name_ar: string
  name_en?: string | null
  brand?: string | null
  manufacturer?: string | null
  barcode?: string | null
  strength?: string | null
  dosage_form?: string | null
  price?: number | null
  qty?: number | null
}
export function toPendingReviewProduct(
  row: ExcelReviewRow,
  organizationId: string,
  actorId: string,
  categoryId: string | null,
) {
  return {
    organization_id: organizationId,
    owner_org_id: organizationId,
    created_by: actorId,
    store_code: row.store_code.trim(),
    name_ar: row.name_ar.trim(),
    name_en: row.name_en?.trim() || null,
    brand: row.brand?.trim() || null,
    manufacturer: row.manufacturer?.trim() || null,
    barcode: row.barcode?.trim() || null,
    strength: row.strength?.trim() || null,
    dosage_form: row.dosage_form?.trim() || null,
    category_id: categoryId,
    // Never approve, expose, or assume the clinical classification of Excel imports.
    status: 'pending_review' as const,
    is_public: false,
    requires_prescription: true,
    metadata: {
      excel_review: {
        source: 'admin-excel-import',
        classification: 'unverified',
        proposed_price_yer: row.price == null ? null : String(row.price),
        proposed_quantity: row.qty == null ? null : String(row.qty),
        // Separate sign-off is mandatory for supplier, cost, location, lot and expiry.
        inventory_posted: false,
      },
    },
  }
}
