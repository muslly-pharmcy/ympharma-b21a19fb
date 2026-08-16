import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Send, X, Loader2, Stethoscope } from 'lucide-react'
import { useServerFn } from '@tanstack/react-start'
import { PHARMACY } from '@/shared/branding'
import { logWidgetEvent } from '@/lib/store-requests.functions'

type Msg = { role: 'user' | 'assistant'; content: string }

const GREETING = `أهلاً بك في ${PHARMACY.nameAr} 🌿
اسألني عن دواعي استعمال دواء، الجرعات العامة، أو التداخلات الدوائية — وسأرشدك بأمان.`

/**
 * Storefront AI health assistant — glassmorphic RTL panel.
 * Clinical-safety prompt is enforced server-side in /api/chat-widget.
 */
export function AiHealthBot({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: GREETING }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const logEvent = useServerFn(logWidgetEvent)

  useEffect(() => {
    void logEvent({ data: { kind: 'assistant_open' } }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    const next: Msg[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setBusy(true)
    void logEvent({ data: { kind: 'assistant_message' } }).catch(() => {})
    try {
      const res = await fetch('/api/chat-widget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as { reply?: string }
      setMessages([...next, { role: 'assistant', content: data.reply ?? '—' }])
    } catch {
      setMessages([
        ...next,
        {
          role: 'assistant',
          content: `تعذّر الرد الآن. تواصل معنا مباشرة عبر واتساب: ${PHARMACY.phone}`,
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      dir="rtl"
      role="dialog"
      aria-label="المساعد الصحي الذكي"
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="glass-card safe-area-bottom fixed bottom-24 left-4 z-50 flex h-[65vh] max-h-[540px] w-[92vw] max-w-sm flex-col overflow-hidden rounded-3xl border border-white/40 shadow-2xl sm:bottom-24"
    >
      <header className="flex items-center justify-between gap-2 border-b border-white/30 bg-primary/10 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Stethoscope className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-foreground">المساعد الصحي الذكي</p>
            <p className="text-[11px] text-muted-foreground">إرشاد دوائي — لا يغني عن الطبيب</p>
          </div>
        </div>
        <button onClick={onClose} aria-label="إغلاق" className="rounded-xl p-1.5 text-muted-foreground hover:bg-black/5">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-start' : 'flex justify-end'}>
            <p
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-6 ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-white/70 text-foreground'
              }`}
            >
              {m.content}
            </p>
          </div>
        ))}
        {busy && (
          <div className="flex justify-end">
            <span className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> جارٍ التفكير…
            </span>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
        className="flex items-center gap-2 border-t border-white/30 bg-white/40 p-2 backdrop-blur"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="اكتب سؤالك الصحي…"
          aria-label="سؤالك"
          className="flex-1 rounded-2xl border border-border/60 bg-background/80 px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="إرسال"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </motion.div>
  )
}
