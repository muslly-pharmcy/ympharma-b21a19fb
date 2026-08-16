import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { motion } from 'framer-motion'
import { Search, Plus, Minus, ShoppingCart, Trash2, Package, AlertTriangle } from 'lucide-react'
import { listPharmacyProducts, type ModuleProduct } from '@/lib/modules.functions'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { Skeleton } from '@/components/skeletons/Skeleton'

export function PharmacyModule() {
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState<{ product: ModuleProduct; quantity: number }[]>([])
  const debouncedSearch = useDebounce(searchQuery, 300)
  const fetchProducts = useServerFn(listPharmacyProducts)

  const { data, isLoading } = useQuery({
    queryKey: ['module', 'pharmacy', 'products', debouncedSearch],
    queryFn: () => fetchProducts({ data: { search: debouncedSearch } }),
    staleTime: 30_000,
  })
  const products = data?.items ?? []

  const addToCart = (product: ModuleProduct) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { product, quantity: 1 }]
    })
  }
  const removeFromCart = (id: string) => setCart((p) => p.filter((i) => i.product.id !== id))
  const updateQuantity = (id: string, delta: number) => setCart((p) => p.map((i) => i.product.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i))
  const cartTotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0)

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-2xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن دواء، باركود، أو مادة فعالة..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-right"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="glass-panel rounded-2xl p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              المنتجات
            </h3>
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>لا توجد منتجات</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {products.map((product, i) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-4 border border-gray-100 rounded-xl hover:border-primary/20 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-900">{product.nameAr}</h4>
                        <p className="text-xs text-gray-500">{product.name}</p>
                      </div>
                      {product.stock <= product.minStock && (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div>
                        <p className="text-lg font-bold text-primary">{product.price.toLocaleString()} ر.ي</p>
                        <p className="text-xs text-gray-500">متوفر: {product.stock}</p>
                      </div>
                      <button
                        onClick={() => addToCart(product)}
                        className="p-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors"
                        aria-label="أضف إلى السلة"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-gold" />
            سلة المشتريات
          </h3>
          {cart.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2" />
              <p className="text-sm">السلة فارغة</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.product.nameAr}</p>
                    <p className="text-xs text-gray-500">{item.product.price.toLocaleString()} ر.ي</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1 hover:bg-gray-200 rounded" aria-label="تقليل"><Minus className="w-3 h-3" /></button>
                    <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1 hover:bg-gray-200 rounded" aria-label="زيادة"><Plus className="w-3 h-3" /></button>
                  </div>
                  <button onClick={() => removeFromCart(item.product.id)} className="p-1 text-red-400 hover:text-red-600" aria-label="حذف"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-3 mt-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-600">الإجمالي</span>
                  <span className="text-xl font-bold text-primary">{cartTotal.toLocaleString()} ر.ي</span>
                </div>
                <button className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-600 transition-colors">
                  إتمام الطلب
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
