import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAI } from '@/context/AIContext'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { Send, Bot, User, Loader2, Sparkles, Trash2, Mic, MicOff } from 'lucide-react'


interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  agent?: string
}

export default function AIChat() {
  const { sendMessage, isProcessing, activeAgent } = useAI()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `مرحباً! أنا MUSLLY AI، المخ الصناعي لمنصة التشغيل الصحية الوطنية. كيف يمكنني مساعدتك اليوم؟

يمكنني:
• مراجعة الوصفات الطبية
• التحقق من التداخلات الدوائية
• إدارة المخزون
• تحليل البيانات المالية
• والمزيد...`,
      timestamp: new Date().toISOString(),
      agent: 'AI SUN',
    },
  ])
  const [input, setInput] = useState('')
  const voice = useSpeechRecognition({
    lang: 'ar-SA',
    onResult: (text) => setInput((prev) => (prev ? `${prev} ${text}` : text)),
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')

    try {
      const response = await sendMessage(input)
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
        agent: activeAgent?.name || 'AI SUN',
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('AI Chat Error:', error)
    }
  }

  const clearChat = () => {
    setMessages([messages[0]])
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Bot className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">مساعد MUSLLY AI</h1>
            <p className="text-sm text-muted-foreground">متصل بالوحدة: {activeAgent?.name || 'AI SUN'}</p>
          </div>
        </div>
        <button
          onClick={clearChat}
          className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
          title="مسح المحادثة"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2 custom-scrollbar">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-4 rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tr-none'
                    : 'bg-card border rounded-tl-none shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {message.role === 'assistant' ? (
                    <Bot className="w-4 h-4" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                  <span className="text-[10px] opacity-70">
                    {message.agent || (message.role === 'user' ? 'أنت' : 'AI')} • {new Date(message.timestamp).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="whitespace-pre-wrap leading-relaxed text-sm">
                  {message.content}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-card border p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground italic">جاري التفكير...</span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="relative">
        <div className="absolute -top-12 left-0 right-0 flex justify-center pointer-events-none">
          <div className="bg-background/80 backdrop-blur-sm border px-3 py-1 rounded-full text-[10px] text-muted-foreground flex items-center gap-2 shadow-sm">
            <Sparkles className="w-3 h-3 text-yellow-500" />
            يعمل بواسطة MUSLLY AI SUN Core
          </div>
        </div>
        {voice.listening && (
          <div className="mb-2 flex items-center gap-2 text-xs text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            أستمع إليك… {voice.transcript}
          </div>
        )}
        {voice.error && <p className="mb-2 text-xs text-red-600">{voice.error}</p>}
        <div className="glass-card flex gap-2 p-2 !rounded-xl">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="اكتب رسالتك أو تحدث بالميكروفون..."
            className="flex-1 min-w-0 bg-transparent border-none focus:ring-0 resize-none py-2 px-3 text-sm min-h-[44px] max-h-32 custom-scrollbar"
            rows={1}
          />
          {voice.supported && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={voice.toggle}
              aria-label={voice.listening ? 'إيقاف الإدخال الصوتي' : 'إدخال صوتي'}
              aria-pressed={voice.listening}
              className={`shrink-0 rounded-lg p-3 transition-all ${
                voice.listening
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                  : 'bg-primary/10 text-primary hover:bg-primary/20'
              }`}
            >
              {voice.listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="shrink-0 p-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-all shadow-md flex items-center justify-center"
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </motion.button>
        </div>
      </div>

    </div>
  )
}
