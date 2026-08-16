import { useState } from 'react'
import { motion } from 'framer-motion'
import { Package, AlertTriangle, Search } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listProducts } from '@/lib/catalog.functions'

/**
 * InventoryModule (Phase 3 Shipment A)
 *
 * Rewired from legacy `products` table onto the canonical `catalog_products`
 * via the `listProducts` server function. Writes and batch-level details
 * arrive in Shipment B.
 */
export function InventoryModule() {
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)

  const { data, isFetching } = useQuery({
    queryKey: ['inventory-module', 'products', searchQuery, page],
    queryFn: () =>
      listProducts({
        data: {
          search: searchQuery || undefined,
          page,
          pageSize: 30,
          publicOnly: true,
        },
      }),
  })

  const products = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Package className="h-5 w-5 text-blue-600" />}
          bg="bg-blue-50"
          value={total}
          label="إجمالي المنتجات"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
          bg="bg-amber-50"
          value={0}
          label="مخزون منخفض (قريبًا)"
          valueClass="text-amber-600"
        />
        <StatCard
          icon={<Package className="h-5 w-5 text-emerald-600" />}
          bg="bg-emerald-50"
          value={products.length}
          label="ظاهر في هذه الصفحة"
          valueClass="text-emerald-600"
        />
      </div>

      <div className="glass-panel rounded-2xl p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setPage(1)
              setSearchQuery(e.target.value)
            }}
            placeholder="ابحث عن منتج..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-4 pr-10 text-right focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <div className="glass-panel overflow-x-auto rounded-2xl p-4">
        {isFetching && (
          <p className="pb-3 text-xs text-muted-foreground">جاري التحميل...</p>
        )}
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">المنتج</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">الباركود</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">التركيز</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && !isFetching && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  لا توجد منتجات مطابقة.
                </td>
              </tr>
            )}
            {products.map((product, i) => (
              <motion.tr
                key={product.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="border-b border-gray-50 transition-colors hover:bg-gray-50/50"
              >
                <td className="px-4 py-3">
                  <Link
                    to="/catalog/$productId"
                    params={{ productId: product.id }}
                    className="block"
                  >
                    <p className="font-medium text-gray-900">{product.name_ar}</p>
                    {product.brand && (
                      <p className="text-xs text-gray-500">{product.brand}</p>
                    )}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{product.barcode ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {product.strength ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600">
                    {product.status}
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  bg,
  value,
  label,
  valueClass = 'text-gray-900',
}: {
  icon: React.ReactNode
  bg: string
  value: number
  label: string
  valueClass?: string
}) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>{icon}</div>
        <div>
          <p className={`text-2xl font-bold ${valueClass}`}>{value.toLocaleString('ar-EG')}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  )
}
