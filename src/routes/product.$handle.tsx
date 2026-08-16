import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import {
  ArrowLeft,
  ShoppingCart,
  Loader2,
  Package,
  Check,
} from 'lucide-react'
import { fetchShopifyProductByHandle } from '@/lib/shopify/api'
import { useShopifyCartStore } from '@/stores/shopify-cart'
import { RouteSkeleton } from '@/components/skeletons/Skeleton'

export const Route = createFileRoute('/product/$handle')({
  component: ProductPage,
})

function ProductPage() {
  const { handle } = useParams({ from: '/product/$handle' })
  const { data: product, isLoading, error } = useQuery({
    queryKey: ['shopify', 'product', handle],
    queryFn: () => fetchShopifyProductByHandle(handle),
    staleTime: 60_000,
  })
  const [selectedVariant, setSelectedVariant] = useState(
    product?.variants.edges[0]?.node,
  )
  const addItem = useShopifyCartStore((state) => state.addItem)
  const isLoadingCart = useShopifyCartStore((state) => state.isLoading)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-24 px-4">
        <div className="max-w-6xl mx-auto">
          <RouteSkeleton />
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background pt-24 px-4 text-center">
        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          المنتج غير موجود
        </h1>
        <Link
          to="/shop"
          search={{ page: 1 }}
          className="inline-flex items-center gap-2 text-primary font-medium hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>العودة للمتجر</span>
        </Link>
      </div>
    )
  }

  const variant = selectedVariant ?? product.variants.edges[0]?.node
  const image = product.images.edges[0]?.node
  const currency = product.priceRange.minVariantPrice.currencyCode

  const handleAddToCart = async () => {
    if (!variant) return
    await addItem({
      product: { node: product },
      variantId: variant.id,
      variantTitle: variant.title,
      price: variant.price,
      quantity: 1,
      selectedOptions: variant.selectedOptions || [],
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <Link
          to="/shop"
          search={{ page: 1 }}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>العودة للمتجر</span>
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          <div className="aspect-square rounded-3xl overflow-hidden bg-white border border-gray-100 shadow-sm">
            {image ? (
              <img
                src={image.url}
                alt={image.altText ?? product.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <Package className="w-20 h-20" />
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {product.title}
            </h1>
            <p className="text-2xl font-bold text-primary mb-6">
              {currency} {parseFloat(product.priceRange.minVariantPrice.amount).toFixed(2)}
            </p>

            <p className="text-gray-600 leading-relaxed mb-8">
              {product.description || 'لا يوجد وصف'}
            </p>

            {product.options.length > 0 && (
              <div className="space-y-4 mb-8">
                {product.options.map((option) => (
                  <div key={option.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {option.name}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {option.values.map((value) => {
                        const isSelected =
                          variant?.selectedOptions.some(
                            (o) => o.name === option.name && o.value === value,
                          ) ?? false
                        return (
                          <button
                            key={value}
                            onClick={() => {
                              const next = product.variants.edges.find(
                                (v) =>
                                  v.node.selectedOptions.some(
                                    (o) =>
                                      o.name === option.name &&
                                      o.value === value,
                                  ),
                              )?.node
                              if (next) setSelectedVariant(next)
                            }}
                            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                              isSelected
                                ? 'bg-primary text-white border-primary'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-primary'
                            }`}
                          >
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 inline-block ml-1" />
                            )}
                            {value}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleAddToCart}
              disabled={isLoadingCart || !variant?.availableForSale}
              className="mt-auto flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white rounded-2xl font-bold text-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingCart ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5" />
                  <span>أضف إلى السلة</span>
                </>
              )}
            </button>

            {!variant?.availableForSale && (
              <p className="text-sm text-red-600 mt-3 text-center">
                هذا المنتج غير متوفر حالياً
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
