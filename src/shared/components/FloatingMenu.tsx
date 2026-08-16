import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { MessageCircle, Bot, FileImage, Plus, X, Phone, ScanLine, Siren } from 'lucide-react'
import { PHARMACY } from '@/shared/branding'
import { AiHealthBot } from '@/components/store/AiHealthBot'
import { PrescriptionUploadModal } from '@/components/store/PrescriptionUploadModal'
import { AiPrescriptionScanner } from '@/components/store/AiPrescriptionScanner'
import { EmergencyOrderModal } from '@/components/store/EmergencyOrderModal'


/**
 * Single consolidated speed-dial, anchored bottom-right, sitting above the
 * customer bottom nav. Replaces the old multi-button floating dock so the
 * mobile viewport never stacks overlapping floating controls.
 */
export function FloatingMenu() {
  const [open, setOpen] = useState(false)
  const [botOpen, setBotOpen] = useState(false)
  const [rxOpen, setRxOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [sosOpen, setSosOpen] = useState(false)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const items = [
    {
      key: 'wa',
      label: 'واتساب',
      Icon: MessageCircle,
      className: 'bg-[#25D366] text-white',
      href: `${PHARMACY.whatsappUrl}?text=${encodeURIComponent('مرحباً، أحتاج استشارة من صيدلية المصلي')}`,
    },
    {
      key: 'bot',
      label: 'المساعد الذكي',
      Icon: Bot,
      className: 'bg-primary text-primary-foreground',
      onClick: () => setBotOpen(true),
    },
    {
      key: 'rx',
      label: 'رفع الوصفة',
      Icon: FileImage,
      className: 'bg-white text-primary ring-1 ring-primary/20 dark:bg-slate-900',
      onClick: () => setRxOpen(true),
    },
    {
      key: 'scan',
      label: 'قراءة الوصفة بالذكاء',
      Icon: ScanLine,
      className: 'bg-sky-600 text-white',
      onClick: () => setScanOpen(true),
    },
    {
      key: 'sos',
      label: 'طلب طوارئ',
      Icon: Siren,
      className: 'bg-red-600 text-white',
      onClick: () => setSosOpen(true),
    },
    {
      key: 'call',
      label: 'اتصال',
      Icon: Phone,
      className: 'bg-slate-900 text-white dark:bg-slate-700',
      href: `tel:${PHARMACY.phone.replace(/\s/g, '')}`,
    },
  ] as const

  return (
    <>
      <div
        dir="rtl"
        className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-2 md:bottom-6"
      >
        <AnimatePresence>
          {open &&
            items.map((it, i) => {
              const content = (
                <>
                  <span className="rounded-lg bg-slate-900/85 px-2 py-1 text-[11px] font-bold text-white shadow-md backdrop-blur">
                    {it.label}
                  </span>
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg ${it.className}`}
                  >
                    <it.Icon className="h-5 w-5" />
                  </span>
                </>
              )
              const common = {
                key: it.key,
                initial: reduce ? undefined : { opacity: 0, y: 12, scale: 0.9 },
                animate: { opacity: 1, y: 0, scale: 1 },
                exit: reduce ? undefined : { opacity: 0, y: 12, scale: 0.9 },
                transition: { delay: reduce ? 0 : i * 0.04, type: 'spring' as const, stiffness: 320, damping: 22 },
                className: 'flex items-center gap-2',
                'aria-label': it.label,
              }
              return 'href' in it ? (
                <motion.a
                  {...common}
                  href={it.href}
                  target={it.href.startsWith('http') ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                >
                  {content}
                </motion.a>
              ) : (
                <motion.button
                  {...common}
                  type="button"
                  onClick={() => {
                    it.onClick()
                    setOpen(false)
                  }}
                >
                  {content}
                </motion.button>
              )
            })}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'إغلاق قائمة الخدمات' : 'فتح قائمة الخدمات السريعة'}
          whileTap={reduce ? undefined : { scale: 0.92 }}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/30 ring-4 ring-white/40 dark:ring-white/10"
        >
          <motion.span animate={{ rotate: open ? 135 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
          </motion.span>
        </motion.button>
      </div>

      {botOpen && <AiHealthBot onClose={() => setBotOpen(false)} />}
      <PrescriptionUploadModal open={rxOpen} onClose={() => setRxOpen(false)} />
      <AiPrescriptionScanner open={scanOpen} onClose={() => setScanOpen(false)} />
      <EmergencyOrderModal open={sosOpen} onClose={() => setSosOpen(false)} />
    </>
  )
}

export default FloatingMenu
