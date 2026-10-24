import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { supabase } from '@/integrations/supabase/client'
import { listCart } from '@/lib/cart.functions'
import { isCurrentUserAdmin } from '@/lib/admin-orders.functions'
import { ShopifyCartDrawer } from '@/components/shopify/CartDrawer'
import almoslyLogo from '@/assets/almosly-logo-optimized.webp'
import { GlassLogo } from '@/shared/components/GlassLogo'
import {
  Sun, Moon, Bell, MessageSquare, LogOut, LogIn,
  Stethoscope, Search, ShoppingCart, Store, ClipboardList, Gauge,
} from 'lucide-react'
import { useState } from 'react'


export default function Navbar() {
  const { user, isAuthenticated } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  const { data: cartItems } = useQuery({
    queryKey: ['cart', 'items'],
    queryFn: () => listCart(),
    enabled: isAuthenticated,
    staleTime: 30_000,
  })
  const cartCount = cartItems?.reduce((n, it) => n + (it.quantity ?? 0), 0) ?? 0

  const { data: isAdmin } = useQuery({
    queryKey: ['is-admin'],
    queryFn: () => isCurrentUserAdmin(),
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  })

  const displayName = (user?.user_metadata as { name?: string } | undefined)?.name ?? user?.email ?? ''
  const avatar =
    (user?.user_metadata as { avatar_url?: string } | undefined)?.avatar_url ??
    `https://api.dicebear.com/7.x/personas/svg?seed=${user?.id ?? 'guest'}&backgroundColor=D9EEEB&clothingColor=0F766E&hair=short01&facialHair=none&body=squared`


  async function handleSignOut() {
    await queryClient.cancelQueries()
    queryClient.clear()
    await supabase.auth.signOut()
    await navigate({ to: '/auth', replace: true })
  }

  return (
    <nav className="fixed top-0 right-0 left-0 z-50 h-16 glass-panel border-b border-primary/10">
      <div className="h-full px-3 md:px-6 flex items-center justify-between gap-2 max-w-[1920px] mx-auto">
        <Link to="/" className="flex min-w-0 items-center gap-2 md:gap-3 shrink">
          <GlassLogo
            src={almoslyLogo}
            alt="صيدلية المصلي — Almosly Pharmacy"
            className="h-10 w-10 md:h-12 md:w-12"
          />
          <div className="hidden md:block min-w-0 leading-tight">
            <h1 className="truncate text-base font-bold text-gray-900">صيدلية المصلي</h1>
            <p className="truncate text-[11px] text-gray-500">Almosly Pharmacy · عدن</p>
          </div>
        </Link>




        <div className="hidden md:flex items-center gap-1 lg:gap-2">
          <Link
            to="/medical-directory"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors"
          >
            <Stethoscope className="w-4 h-4" />
            <span>الدليل الطبي</span>
          </Link>
          <Link
            to="/store"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors"
          >
            <Store className="w-4 h-4" />
            <span>المتجر</span>
          </Link>
          <Link
            to="/catalog"
            search={{ page: 1 }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors"
          >
            <Search className="w-4 h-4" />
            <span>الكتالوج</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors"
            title="تبديل الوضع"
          >
            {isDark ? <Sun className="w-5 h-5 text-gold" /> : <Moon className="w-5 h-5 text-gray-600" />}
          </button>

          {isAuthenticated && (
            <>
              <Link to="/ai-chat" className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors relative" title="المحادثة الذكية">
                <MessageSquare className="w-5 h-5 text-primary" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-gold text-white text-[10px] rounded-full flex items-center justify-center font-bold">AI</span>
              </Link>
              <Link to="/cart" className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors relative" title="سلة الأدوية">
                <ShoppingCart className="w-5 h-5 text-gray-700" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-primary text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Link>
              {isAdmin && (
                <>
                  <Link to="/admin-orders" className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors" title="إدارة الطلبات">
                    <ClipboardList className="w-5 h-5 text-gold" />
                  </Link>
                  <Link to="/control-tower" className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors" title="الإدارة المركزية">
                    <Gauge className="w-5 h-5 text-gold" />
                  </Link>
                </>
              )}

            </>
          )}

          <div className="relative" title="سلة المتجر">
            <ShopifyCartDrawer />
          </div>

          {isAuthenticated ? (
            <>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors relative"
              >
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowProfile(!showProfile)}
                  className="flex items-center gap-2 p-1.5 pr-3 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <img src={avatar} alt={displayName} className="w-9 h-9 shrink-0 rounded-full object-cover ring-2 ring-primary/20 bg-white" />
                  <span className="hidden md:block truncate max-w-[140px] text-sm font-medium text-gray-700">{displayName}</span>

                </button>

                {showProfile && (
                  <div className="absolute left-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="font-semibold text-gray-900">{displayName}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors text-right"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>تسجيل الخروج</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <a
              href="/auth"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90"
            >
              <LogIn className="w-4 h-4" />
              <span>تسجيل الدخول</span>
            </a>
          )}
        </div>
      </div>
    </nav>
  )
}
