import { Link, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Home, Store, ShoppingCart, FileImage, User } from 'lucide-react'
import { listCart } from '@/lib/cart.functions'
import { useAuth } from '@/context/AuthContext'

const ITEMS = [
  { to: '/', label: 'الرئيسية', icon: Home },
  { to: '/shop', label: 'المتجر', icon: Store },
  { to: '/cart', label: 'السلة', icon: ShoppingCart },
  { to: '/request', label: 'طلب دواء', icon: FileImage },
  { to: '/customers', label: 'حسابي', icon: User },
] as const

/**
 * Customer-only mobile bottom nav. No admin, analytics or dispensing tabs —
 * those surfaces stay entirely invisible on public pages.
 */
export function BottomNav() {
  const { location } = useRouterState()
  const path = location.pathname
  const { isAuthenticated } = useAuth()

  const { data: cartItems } = useQuery({
    queryKey: ['cart', 'items'],
    queryFn: () => listCart(),
    enabled: isAuthenticated,
    staleTime: 30_000,
    retry: false,
  })
  const cartCount = cartItems?.reduce((n, it) => n + (it.quantity ?? 0), 0) ?? 0

  // hide on auth screens and any admin surface
  if (
    path.startsWith('/auth') ||
    path.startsWith('/reset-password') ||
    path.startsWith('/admin')
  )
    return null

  return (
    <nav
      dir="rtl"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-white/15 bg-slate-950/85 backdrop-blur-xl safe-area-bottom"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="التنقل الرئيسي"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ to, label, icon: Icon }) => {
          const active = to === '/' ? path === '/' : path.startsWith(to)
          return (
            <li key={to}>
              <Link
                to={to}
                {...(to === '/shop' ? { search: { page: 1 } } : {})}
                className={`relative flex flex-col items-center gap-1 py-2 text-[11px] ${
                  active ? 'text-emerald-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" aria-hidden />
                  {to === '/cart' && cartCount > 0 && (
                    <span className="absolute -right-2 -top-1.5 min-w-[16px] rounded-full bg-emerald-500 px-1 text-center text-[9px] font-black leading-4 text-white">
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </span>
                <span>{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
