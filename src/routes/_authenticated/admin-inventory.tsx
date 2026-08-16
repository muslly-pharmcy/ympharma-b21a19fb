import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import {
  listStoreProductsAdmin,
  updateProductPrice,
  setProductStockBalance,
  updateProductImage,
} from '@/lib/store-admin.functions'

export const Route = createFileRoute('/_authenticated/admin-inventory')({
  head: () => ({
    meta: [
      { title: 'إدارة المخزون — MUSLLY AI OS' },
      { name: 'description', content: 'لوحة إدارة أسعار ومخزون المنتجات مع تعديل مباشر ورفع الصور.' },
    ],
  }),
  component: AdminInventoryPage,
})

type Row = {
  id: string | null
  name: string | null
  store_code: string | null
  barcode: string | null
  supplier_name_text: string | null
  pack_unit: string | null
  price: number | null
  stock_balance: number | null
  image_url: string | null
}

function AdminInventoryPage() {
  const [search, setSearch] = useState('')
  const [supplier, setSupplier] = useState('')
  const list = useServerFn(listStoreProductsAdmin)
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ['admin-inventory', search, supplier],
    queryFn: () => list({ data: { search: search || undefined, supplier: supplier || undefined, limit: 200, offset: 0 } }),
  })

  const priceMut = useMutation({
    mutationFn: useServerFn(updateProductPrice),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-inventory'] }),
  })
  const stockMut = useMutation({
    mutationFn: useServerFn(setProductStockBalance),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-inventory'] }),
  })
  const imageMut = useMutation({
    mutationFn: useServerFn(updateProductImage),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-inventory'] }),
  })

  return (
    <div dir="rtl" className="p-6 max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">إدارة المخزون والأسعار</h1>
        <div className="text-sm text-muted-foreground">{query.data?.total ?? 0} صنف</div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <input
          className="border rounded px-3 py-2 flex-1 min-w-[220px] bg-background"
          placeholder="ابحث بالاسم أو الكود أو الباركود…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2 min-w-[220px] bg-background"
          placeholder="فلترة حسب المورد…"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
        />
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-right">
            <tr>
              <th className="p-2">صورة</th>
              <th className="p-2">الكود</th>
              <th className="p-2">الاسم</th>
              <th className="p-2">المورد</th>
              <th className="p-2">الوحدة</th>
              <th className="p-2 w-32">السعر</th>
              <th className="p-2 w-28">الرصيد</th>
              <th className="p-2 w-40">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading && (
              <tr><td colSpan={8} className="p-6 text-center">جاري التحميل…</td></tr>
            )}
            {(query.data?.items ?? []).map((r) => {
              const row = r as Row
              if (!row.id) return null
              const id = row.id
              return (
                <ProductRow
                  key={id}
                  row={row}
                  onSavePrice={(price) => priceMut.mutateAsync({ data: { productId: id, price } })}
                  onSaveStock={(newBalance) => stockMut.mutateAsync({ data: { productId: id, newBalance, reason: 'admin manual' } })}
                  onUploadImage={async (file) => {
                    const path = `${id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
                    const { error } = await supabase.storage.from('product-images').upload(path, file, {
                      cacheControl: '3600',
                      upsert: true,
                    })
                    if (error) throw new Error(error.message)
                    await imageMut.mutateAsync({ data: { productId: id, storagePath: path, bucket: 'product-images' } })
                  }}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ProductRow({
  row,
  onSavePrice,
  onSaveStock,
  onUploadImage,
}: {
  row: Row
  onSavePrice: (price: number) => Promise<unknown>
  onSaveStock: (n: number) => Promise<unknown>
  onUploadImage: (file: File) => Promise<void>
}) {
  const [price, setPrice] = useState(String(row.price ?? ''))
  const [stock, setStock] = useState(String(row.stock_balance ?? 0))
  const [busy, setBusy] = useState<null | string>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const priceDirty = String(row.price ?? '') !== price
  const stockDirty = String(row.stock_balance ?? 0) !== stock

  return (
    <tr className="border-t hover:bg-muted/30">
      <td className="p-2">
        {row.image_url ? (
          <img src={row.image_url} alt="" className="w-10 h-10 rounded object-cover" />
        ) : (
          <div className="w-10 h-10 rounded bg-muted" />
        )}
      </td>
      <td className="p-2 font-mono text-xs">{row.store_code ?? '—'}</td>
      <td className="p-2">{row.name ?? '—'}</td>
      <td className="p-2 text-xs">{row.supplier_name_text ?? '—'}</td>
      <td className="p-2 text-xs">{row.pack_unit ?? '—'}</td>
      <td className="p-2">
        <input
          className="border rounded px-2 py-1 w-24 bg-background text-sm"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={async () => {
            const n = Number(price)
            if (!priceDirty || !Number.isFinite(n) || n < 0) return
            setBusy('price')
            try { await onSavePrice(n) } finally { setBusy(null) }
          }}
        />
        {busy === 'price' && <span className="text-xs mr-1">…</span>}
      </td>
      <td className="p-2">
        <input
          className="border rounded px-2 py-1 w-20 bg-background text-sm"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          onBlur={async () => {
            const n = Math.floor(Number(stock))
            if (!stockDirty || !Number.isFinite(n) || n < 0) return
            setBusy('stock')
            try { await onSaveStock(n) } finally { setBusy(null) }
          }}
        />
        {busy === 'stock' && <span className="text-xs mr-1">…</span>}
      </td>
      <td className="p-2">
        <button
          className="text-xs px-2 py-1 border rounded hover:bg-primary/10"
          onClick={() => fileRef.current?.click()}
          disabled={busy === 'image'}
        >
          {busy === 'image' ? 'يرفع…' : 'رفع صورة'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            setBusy('image')
            try { await onUploadImage(f) } catch (err) { alert((err as Error).message) } finally { setBusy(null); if (fileRef.current) fileRef.current.value = '' }
          }}
        />
      </td>
    </tr>
  )
}
