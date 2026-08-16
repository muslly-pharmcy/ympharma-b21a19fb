import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Send, X, Loader2, Mic, MicOff } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { PHARMACY } from '@/shared/branding'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'

type Msg = { role: 'user' | 'assistant'; content: string }


// Lightweight floating AI chat popup for site visitors. Uses the same
// Lovable AI Gateway path as /ai-chat but stays inline (no navigation).
export function ChatWidget({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content: `مرحباً بك في ${PHARMACY.nameAr} 🌿\nأنا مساعدك الصحي الذكي. كيف أساعدك اليوم؟`,
    },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const voice = useSpeechRecognition({
    lang: 'ar-SA',
    onResult: (text) => setInput((prev) => (prev ? `${prev} ${text}` : text)),
  })

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
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      const res = await fetch('/api/chat-widget', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: next }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as { reply?: string }
      setMessages([...next, { role: 'assistant', content: data.reply ?? '—' }])
    } catch (e) {
      setMessages([
        ...next,
        {
          role: 'assistant',
          content: `تعذّر الرد الآن. جرّب التواصل عبر واتساب: ${PHARMACY.phone}`,
        },
      ])
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      dir="rtl"
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="glass-card safe-area-bottom fixed bottom-6 left-4 z-50 flex h-[520px] w-[90vw] max-w-sm flex-col"
    >
      <header className="flex items-center justify-between gap-2 bg-primary/95 px-4 py-3 text-white backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">مساعد {PHARMACY.nameAr}</p>
            <p className="text-[10px] opacity-80">متاح 24/7 · الردود إرشادية</p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="press-scale shrink-0 rounded-full p-1 hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-white/40 p-4">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm shadow-sm ${
                  m.role === 'user'
                    ? 'bg-primary text-white'
                    : 'border border-white/60 bg-white/85 text-gray-800 backdrop-blur'
                }`}
              >
                {m.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {busy && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="h-3 w-3 animate-spin" /> يكتب…
          </div>
        )}
        {voice.listening && (
          <div className="flex items-center gap-2 text-xs text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            أستمع إليك… {voice.transcript}
          </div>
        )}
        {voice.error && <p className="text-xs text-red-600">{voice.error}</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
        className="flex items-center gap-2 border-t border-white/50 bg-white/70 p-3 backdrop-blur-xl"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="اكتب سؤالك أو استخدم الميكروفون…"
          className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
        />
        {voice.supported && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={voice.toggle}
            aria-label={voice.listening ? 'إيقاف الإدخال الصوتي' : 'إدخال صوتي'}
            aria-pressed={voice.listening}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
              voice.listening
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                : 'bg-primary/10 text-primary hover:bg-primary/20'
            }`}
          >
            {voice.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </motion.button>
        )}
        <motion.button
          type="submit"
          whileTap={{ scale: 0.9 }}
          disabled={busy || !input.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-40"
          aria-label="إرسال"
        >
          <Send className="h-4 w-4" />
        </motion.button>
      </form>
    </motion.div>
  )

}
