import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { ShoppingCart, Loader2 } from 'lucide-react'
import { addToCart } from '@/lib/cart.functions'
import { ProductImage } from './ProductImage'

export interface StoreProduct {
  id: string
  name_ar?: string | null
  name_en?: string | null
  brand?: string | null
  generic_name?: string | null
  active_ingredients?: string | null
  dosage_form?: string | null
  strength?: string | null
  description_ar?: string | null
  category_id?: string | null
  sbdma_official_price?: number | null
  image_url?: string | null
  primary_image_url?: string | null
  requires_prescription?: boolean | null
}

interface ProductCardProps {
  product: StoreProduct
  index?: number
  featured?: boolean
}

const cardVariants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 140, damping: 20 } },
}

function usageSummary(p: StoreProduct): string {
  if (p.description_ar) return p.description_ar
  const form = p.dosage_form ?? ''
  const strength = p.strength ?? ''
  if (form || strength) return `${form} ${strength}`.trim()
  return 'استشر الصيدلي لمعرفة الجرعة المناسبة'
}

export function ProductCard({ product, index = 0, featured = false }: ProductCardProps) {
  const [ripple, setRipple] = useState(0)
  const addFn = useServerFn(addToCart)
  const name = product.name_ar ?? product.name_en ?? 'منتج'

  const mutation = useMutation({
    mutationFn: () => addFn({ data: { productId: product.id, quantity: 1 } }),
    onSuccess: () => toast.success(`تمت إضافة ${name} إلى السلة 🛒`),
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'تعذّر إضافة المنتج'
      toast.error(/unauthor|401/i.test(msg) ? 'سجّل الدخول لإتمام الطلب' : msg)
    },
  })

  const price = product.sbdma_official_price
  const ingredients = product.active_ingredients ?? product.generic_name ?? null

  return (
    <motion.article
      variants={cardVariants}
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      dir="rtl"
      className={`group relative isolate flex flex-col overflow-hidden rounded-3xl border border-white/30 bg-white/80 shadow-2xl backdrop-blur-xl dark:bg-slate-900/80 ${
        featured ? 'sm:col-span-2' : ''
      }`}
    >
      <Link
        to="/product/$productId"
        params={{ productId: product.id }}
        className="block"
        aria-label={name}
      >
        <div className="relative">
          <ProductImage
            product={product}
            alt={name}
            rounded="rounded-none"
            className="aspect-square w-full"
            priority={index < 4}
          />

          <span className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/50 bg-white/80 px-2.5 py-1 text-[10px] font-bold text-emerald-700 shadow-sm backdrop-blur-md dark:bg-slate-900/70 dark:text-emerald-300">
            يُؤكّد التوفر عند الطلب
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <Link to="/product/$productId" params={{ productId: product.id }}>
          <h3 className="line-clamp-2 text-sm font-black leading-snug text-foreground">{name}</h3>
        </Link>

        {ingredients && (
          <p className="truncate text-[11px] font-semibold text-primary/80">{ingredients}</p>
        )}
        <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          {usageSummary(product)}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="rounded-2xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-black text-primary">
            {typeof price === 'number' && price > 0
              ? `${price.toLocaleString('ar-EG')} ر.ي`
              : 'اسأل عن السعر'}
          </span>

          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            disabled={mutation.isPending}
            onClick={() => {
              setRipple((r) => r + 1)
              mutation.mutate()
            }}
            aria-label={`إضافة ${name} للسلة`}
            className="relative isolate overflow-hidden rounded-2xl bg-primary px-3 py-2 text-xs font-black text-primary-foreground shadow-lg shadow-primary/25 transition disabled:opacity-70"
          >
            {ripple > 0 && (
              <span
                key={ripple}
                className="ripple-out pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-white"
              />
            )}
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="flex items-center gap-1">
                <ShoppingCart className="h-3.5 w-3.5" /> إضافة 🛒
              </span>
            )}
          </motion.button>
        </div>
      </div>
    </motion.article>
  )
}

export default ProductCard
