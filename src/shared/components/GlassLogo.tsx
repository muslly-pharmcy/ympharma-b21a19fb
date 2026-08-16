interface GlassLogoProps {
  src: string
  alt: string
  className?: string
}

/**
 * Renders a logo inside a borderless glass container so the asset's
 * white bounding box blends into light and ambient backgrounds.
 */
export function GlassLogo({ src, alt, className = '' }: GlassLogoProps) {
  return (
    <span
      className={`glass-logo relative inline-flex shrink-0 items-center justify-center ${className}`}
    >
      <img
        src={src}
        alt={alt}
        loading="eager"
        className="h-[86%] w-[86%] object-contain mix-blend-multiply"
      />
    </span>
  )
}

export default GlassLogo
