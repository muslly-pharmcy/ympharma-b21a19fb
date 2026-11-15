import { z } from 'zod'

export const excelProductRow = z.object({
  store_code: z.string().min(1),
  name_ar: z.string().min(1),
  name_en: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  strength: z.string().optional().nullable(),
  dosage_form: z.string().optional().nullable(),
  price: z.number().finite().nonnegative().optional().nullable(),
  qty: z.number().finite().nonnegative().max(0, 'استيراد الرصيد يتطلب استلام دفعة برقم تشغيلة وتاريخ صلاحية').optional().nullable(),
  category_slug: z.string().optional().nullable(),
})
export type ExcelProductRow = z.infer<typeof excelProductRow>
