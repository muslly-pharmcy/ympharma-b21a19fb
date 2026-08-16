import { z } from 'zod'

// ============================================================================
// Catalog domain — mirrors public.catalog_products and related tables.
// Kept 1:1 with the DB shape so services and UI share a single source of truth.
// ============================================================================

export const catalogStatusSchema = z.enum([
  'draft',
  'pending',
  'approved',
  'rejected',
  'archived',
])
export type CatalogStatus = z.infer<typeof catalogStatusSchema>

export const catalogProductSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid().nullable(),
  category_id: z.string().uuid().nullable(),
  name_ar: z.string(),
  name_en: z.string().nullable(),
  generic_name: z.string().nullable(),
  brand: z.string().nullable(),
  manufacturer: z.string().nullable(),
  barcode: z.string().nullable(),
  active_ingredients: z.any(),
  dosage_form: z.string().nullable(),
  strength: z.string().nullable(),
  description_ar: z.string().nullable(),
  description_en: z.string().nullable(),
  metadata: z.record(z.string(), z.any()).default({}),
  status: catalogStatusSchema,
  is_public: z.boolean(),
  verified_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  requires_prescription: z.boolean().default(false),
  sbdma_official_price: z.number().nullable().optional(),
})
export type CatalogProduct = z.infer<typeof catalogProductSchema>

export const catalogCategorySchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid().nullable(),
  parent_id: z.string().uuid().nullable(),
  slug: z.string(),
  name_ar: z.string(),
  name_en: z.string(),
  sort_order: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type CatalogCategory = z.infer<typeof catalogCategorySchema>

export const catalogBarcodeSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  barcode: z.string(),
  symbology: z.string().nullable(),
  is_primary: z.boolean(),
})
export type CatalogBarcode = z.infer<typeof catalogBarcodeSchema>

export const catalogMediaSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  storage_bucket: z.string(),
  storage_path: z.string(),
  kind: z.string(),
  status: z.string(),
  sort_order: z.number(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  mime: z.string().nullable(),
})
export type CatalogMedia = z.infer<typeof catalogMediaSchema>

export const listProductsInputSchema = z.object({
  search: z.string().trim().max(200).optional(),
  categoryId: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(24),
  publicOnly: z.boolean().default(true),
})
export type ListProductsInput = z.infer<typeof listProductsInputSchema>

export interface ListProductsResult {
  items: CatalogProduct[]
  total: number
  page: number
  pageSize: number
}
