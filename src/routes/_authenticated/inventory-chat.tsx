import { createFileRoute } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, Trash2, Bot, User } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { askInventoryAgent } from '@/lib/ai/inventory-chat.functions'

export const Route = createFileRoute('/_authenticated/inventory-chat')({
  head: () => ({
    meta: [
      { title: 'مساعد المخزون الذكي — MUSLLY AI OS' },
      { name: 'description', content: 'دردشة ذكية للاستعلام عن الأسعار والمخزون والموردين.' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: InventoryChatPage,
})

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  meta?: { model?: string; toolsUsed?: string[]; latencyMs?: number }
}

const SUGGESTIONS = [
  'ما هي المنتجات منخفضة المخزون؟',
  'ابحث عن باراسيتامول',
  'ما هي الأصناف التي تنتهي خلال 60 يوم؟',
  'كم سعر أموكسيسيلين؟',
]

function InventoryChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const askFn = useServerFn(askInventoryAgent)

  const ask = useMutation({
    mutationFn: (message: string) => askFn({ data: { message } }),
  })

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, ask.isPending])

  async function send(text: string) {
    const clean = text.trim()
    if (!clean || ask.isPending) return
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: clean }
    setMessages((m) => [...m, userMsg])
    setInput('')
    try {
      const res = await ask.mutateAsync(clean)
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: res.output,
          meta: { model: res.model, toolsUsed: res.toolsUsed, latencyMs: res.latencyMs },
        },
      ])
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `⚠️ فشل الطلب: ${(err as Error).message}`,
        },
      ])
    }
  }

  return (
    <div dir="rtl" className="max-w-4xl mx-auto p-4 md:p-6 pt-24 h-[calc(100vh-4rem)] flex flex-col">
      <header className="flex items-center gap-3 pb-3 border-b">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold">مساعد المخزون الذكي</h1>
          <p className="text-xs text-muted-foreground">مدعوم بـ Brain Kernel · مستشار المنتجات</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="w-3.5 h-3.5" /> مسح
          </button>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-10 space-y-4">
            <p className="text-muted-foreground">ابدأ محادثة بسؤال المساعد عن المخزون، الأسعار، أو الأصناف قاربت على الانتهاء.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full border bg-background hover:bg-primary/5"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div
              className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                m.role === 'user' ? 'bg-primary text-white' : 'bg-muted'
              }`}
            >
              {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-primary text-white rounded-tr-sm'
                  : 'bg-muted rounded-tl-sm'
              }`}
            >
              {m.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{m.content}</div>
              )}
              {m.meta?.model && (
                <div className="mt-1 text-[10px] opacity-60">
                  {m.meta.model} · {m.meta.latencyMs}ms
                  {m.meta.toolsUsed && m.meta.toolsUsed.length > 0 && ` · ${m.meta.toolsUsed.join(', ')}`}
                </div>
              )}
            </div>
          </div>
        ))}

        {ask.isPending && (
          <div className="flex gap-2">
            <div className="shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="max-w-[80%] rounded-2xl px-4 py-2.5 bg-muted rounded-tl-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '120ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '240ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input) }}
        className="flex gap-2 pt-3 border-t"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="اكتب سؤالك عن المخزون…"
          disabled={ask.isPending}
          className="flex-1 border rounded-xl px-4 py-2.5 bg-background text-sm disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={ask.isPending || !input.trim()}
          className="px-4 py-2.5 rounded-xl bg-primary text-white disabled:opacity-40 hover:opacity-90"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
