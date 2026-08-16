import { useEffect, useState } from 'react'
import { List } from 'lucide-react'

export interface TocItem {
  id: string
  label: string
}

/**
 * Sticky glass table of contents. Highlights the section currently in view
 * using IntersectionObserver — no scroll listeners, no layout thrash.
 */
export function StickyToc({ items, className = '' }: { items: TocItem[]; className?: string }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? '')

  useEffect(() => {
    if (typeof window === 'undefined' || items.length === 0) return
    const elements = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => Boolean(el))
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible?.target.id) setActive(visible.target.id)
      },
      { rootMargin: '-12% 0px -70% 0px', threshold: [0, 0.25, 1] },
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [items])

  if (items.length === 0) return null

  return (
    <nav
      dir="rtl"
      aria-label="محتويات الصفحة"
      className={`glass-card sticky top-20 max-h-[70vh] overflow-y-auto p-4 ${className}`}
    >
      <p className="mb-3 flex items-center gap-2 text-xs font-bold text-gray-700">
        <List className="h-4 w-4 text-primary" aria-hidden />
        محتويات الصفحة
      </p>
      <ul className="space-y-1">
        {items.map((item) => {
          const isActive = item.id === active
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={isActive ? 'true' : undefined}
                className={`block rounded-lg border-r-2 px-3 py-1.5 text-xs transition ${
                  isActive
                    ? 'border-primary bg-primary/10 font-bold text-primary'
                    : 'border-transparent text-gray-600 hover:bg-white/60 hover:text-gray-900'
                }`}
              >
                {item.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
