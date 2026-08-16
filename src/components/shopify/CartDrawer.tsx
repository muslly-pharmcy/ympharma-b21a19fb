import { useState, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ShoppingCart,
  Minus,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
  X,
} from 'lucide-react'
import { useShopifyCartStore } from '@/stores/shopify-cart'

export function ShopifyCartDrawer() {
  const [isOpen, setIsOpen] = useState(false)
  const {
    items,
    isLoading,
    isSyncing,
    updateQuantity,
    removeItem,
    getCheckoutUrl,
    syncCart,
  } = useShopifyCartStore()

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = items.reduce(
    (sum, item) => sum + parseFloat(item.price.amount) * item.quantity,
    0,
  )
  const currencyCode = items[0]?.price.currencyCode ?? 'YER'

  useEffect(() => {
    if (isOpen) void syncCart()
  }, [isOpen, syncCart])

  const handleCheckout = () => {
    const checkoutUrl = getCheckoutUrl()
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank')
      setIsOpen(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="relative p-2.5 rounded-xl hover:bg-gray-100 transition-colors"
        title="سلة المتجر"
        aria-label="سلة المتجر"
      >
        <ShoppingCart className="w-5 h-5 text-gray-700" />
        {totalItems > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-gold text-white text-[10px] rounded-full flex items-center justify-center font-bold">
            {totalItems > 99 ? '99+' : totalItems}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full z-[101] w-full max-w-md bg-surface shadow-2xl transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-bold text-gray-900">سلة المتجر</h2>
              <p className="text-sm text-gray-500">
                {totalItems === 0
                  ? 'السلة فارغة'
                  : `${totalItems} منتج في السلة`}
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <ShoppingCart className="w-14 h-14 text-gray-300 mb-4" />
                <p className="text-gray-500 mb-2">سلة المتجر فارغة</p>
                <Link
                  to="/shop"
                  search={{ page: 1 }}
                  onClick={() => setIsOpen(false)}
                  className="text-primary font-medium hover:underline"
                >
                  تصفح المنتجات
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.variantId}
                    className="flex gap-3 p-3 rounded-2xl bg-gray-50/80 border border-gray-100"
                  >
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-white flex-shrink-0">
                      {item.product.node.images?.edges?.[0]?.node && (
                        <img
                          src={item.product.node.images.edges[0].node.url}
                          alt={item.product.node.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 truncate">
                        {item.product.node.title}
                      </h4>
                      <p className="text-xs text-gray-500 mb-1">
                        {item.selectedOptions.map((o) => o.value).join(' • ')}
                      </p>
                      <p className="font-bold text-primary">
                        {currencyCode} {parseFloat(item.price.amount).toFixed(2)}
                      </p>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              updateQuantity(item.variantId, item.quantity - 1)
                            }
                            className="p-1 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 transition-colors"
                            disabled={isLoading}
                          >
                            <Minus className="w-3.5 h-3.5 text-gray-600" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(item.variantId, item.quantity + 1)
                            }
                            className="p-1 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 transition-colors"
                            disabled={isLoading}
                          >
                            <Plus className="w-3.5 h-3.5 text-gray-600" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeItem(item.variantId)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                          disabled={isLoading}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="border-t border-gray-100 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-900">
                  الإجمالي
                </span>
                <span className="text-xl font-bold text-primary">
                  {currencyCode} {totalPrice.toFixed(2)}
                </span>
              </div>
              <button
                onClick={handleCheckout}
                disabled={isLoading || isSyncing}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary-600 transition-colors disabled:opacity-60"
              >
                {isLoading || isSyncing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    <span>إتمام الشراء عبر Shopify</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
