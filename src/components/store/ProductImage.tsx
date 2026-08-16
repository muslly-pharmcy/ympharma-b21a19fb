import { useMemo, useState } from 'react'
import { Pill } from 'lucide-react'
import {
  bucketGradient,
  buildSrcSet,
  lowBandwidthSrc,
  resolveBucket,
  resolveProductImage,
  type ImageResolvable,
} from '@/lib/store/product-images'

interface ProductImageProps {
  product: ImageResolvable
  alt: string
  className?: string
  rounded?: string
  priority?: boolean
  /** Responsive sizes hint; defaults tuned for the 2-up mobile product grid. */
  sizes?: string
}

/**
 * Smart storefront image: glassmorphic shimmer while loading, real studio
 * photography (WebP + responsive srcset for weak connections), and a rendered
 * gradient packaging card instead of a broken-image icon when the network fails.
 */
export function ProductImage({
  product,
  alt,
  className = '',
  rounded = 'rounded-3xl',
  priority = false,
  sizes = '(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 240px',
}: ProductImageProps) {
  const resolved = useMemo(() => resolveProductImage(product), [product])
  const src = useMemo(() => lowBandwidthSrc(resolved), [resolved])
  const srcSet = useMemo(() => buildSrcSet(resolved), [resolved])
  const bucket = useMemo(() => resolveBucket(product), [product])
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <div
      className={`relative isolate overflow-hidden ${rounded} bg-gradient-to-br ${bucketGradient(
        bucket,
      )} ${className}`}
    >
      <div className="pointer-events-none absolute -top-1/3 left-1/2 h-2/3 w-2/3 -translate-x-1/2 rounded-full bg-white/40 blur-3xl dark:bg-white/10" />

      {!failed && (
        <img
          src={src}
          {...(srcSet ? { srcSet, sizes } : {})}
          alt={alt}
          width={400}
          height={400}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'low'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`relative z-10 h-full w-full object-contain p-4 mix-blend-multiply drop-shadow-[0_18px_24px_rgba(15,60,55,0.25)] transition-all duration-500 ease-out dark:mix-blend-normal ${
            loaded ? 'scale-100 opacity-100 blur-0' : 'scale-95 opacity-0 blur-sm'
          } group-hover:scale-[1.06]`}
        />
      )}

      {!loaded && !failed && (
        <div className="absolute inset-0 z-20 overflow-hidden">
          <div className="h-full w-full bg-white/30 backdrop-blur-xl dark:bg-slate-900/30" />
          <div className="shimmer-sweep absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/10" />
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 p-4 text-center">
          <div className="flex h-16 w-14 items-center justify-center rounded-xl border border-white/50 bg-white/70 shadow-[0_14px_30px_-12px_rgba(15,60,55,0.55)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/60">
            <Pill className="h-7 w-7 text-primary" />
          </div>
          <span className="line-clamp-2 text-[11px] font-semibold text-foreground/70">{alt}</span>
        </div>
      )}
    </div>
  )
}

export default ProductImage
