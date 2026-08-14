import { useState, type ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'
import { MessageSquareHeart } from 'lucide-react'
import Navbar from '@/shared/components/Navbar'
import { Footer } from '@/shared/components/Footer'
import { FloatingMenu } from '@/shared/components/FloatingMenu'
import { ChatWidget } from '@/shared/components/ChatWidget'
import { ExitIntentModal } from '@/shared/components/engage/ExitIntentModal'
import { ScrollDepthPrompt } from '@/shared/components/engage/ScrollDepthPrompt'
import { AuthenticityBadge } from '@/components/store/AuthenticityBadge'
import { useShopifyCartSync } from '@/hooks/useShopifyCartSync'

interface MainLayoutProps {
  children?: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  useShopifyCartSync()
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background flex flex-col safe-area-x safe-area-top">
      <Navbar />
      {/* pb keeps content clear of the mobile bottom nav + speed dial */}
      <main id="main-content" role="main" className="pt-16 pb-24 md:pb-0 flex-1">
        {children}
      </main>

      {/* Site-wide trust strip */}
      <section dir="rtl" className="px-4 pb-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <AuthenticityBadge supplier="قنوات توريد مرخّصة" coldChain />
        </div>
      </section>

      <Footer />
      <FloatingMenu />

      {/* Engagement layer */}
      <ExitIntentModal />
      <ScrollDepthPrompt />

      <AnimatePresence>
        {chatOpen && <ChatWidget onClose={() => setChatOpen(false)} />}
      </AnimatePresence>
      {!chatOpen && (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          aria-label="افتح المساعد الصحي الذكي"
          className="press-scale safe-area-bottom fixed bottom-24 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/40 bg-white/70 text-primary shadow-lg backdrop-blur-xl md:bottom-6"
        >
          <MessageSquareHeart className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}
