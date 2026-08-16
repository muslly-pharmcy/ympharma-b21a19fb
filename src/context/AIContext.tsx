import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { AIAgent, AIMemory, AIEvent } from '@/types'

interface AIContextType {
  agents: AIAgent[]
  memories: AIMemory[]
  events: AIEvent[]
  activeAgent: AIAgent | null
  isProcessing: boolean
  sendMessage: (message: string, context?: Record<string, unknown>) => Promise<string>
  getAgentStatus: (agentId: string) => AIAgent | undefined
  getRecentEvents: (limit?: number) => AIEvent[]
}

const defaultAgents: AIAgent[] = [
  {
    id: 'ceo-ai',
    name: 'CEO AI',
    nameAr: 'المدير التنفيذي',
    role: 'executive',
    avatar: '👔',
    status: 'active',
    capabilities: ['strategy', 'analytics', 'forecasting', 'decision-making'],
    lastActive: new Date().toISOString(),
    tasksCompleted: 1247,
  },
  {
    id: 'medical-ai',
    name: 'Medical AI',
    nameAr: 'المدير الطبي',
    role: 'medical',
    avatar: '⚕️',
    status: 'active',
    capabilities: ['diagnosis', 'prescription-review', 'drug-interactions', 'dose-calculation'],
    lastActive: new Date().toISOString(),
    tasksCompleted: 3892,
  },
  {
    id: 'inventory-ai',
    name: 'Inventory AI',
    nameAr: 'مدير المخزون',
    role: 'inventory',
    avatar: '📦',
    status: 'active',
    capabilities: ['stock-management', 'fefo', 'forecasting', 'reorder'],
    lastActive: new Date().toISOString(),
    tasksCompleted: 5621,
  },
  {
    id: 'marketing-ai',
    name: 'Marketing AI',
    nameAr: 'مدير التسويق',
    role: 'marketing',
    avatar: '📢',
    status: 'idle',
    capabilities: ['campaigns', 'seo', 'social-media', 'analytics'],
    lastActive: new Date().toISOString(),
    tasksCompleted: 892,
  },
  {
    id: 'finance-ai',
    name: 'Finance AI',
    nameAr: 'المدير المالي',
    role: 'finance',
    avatar: '💰',
    status: 'active',
    capabilities: ['accounting', 'forecasting', 'budgeting', 'reporting'],
    lastActive: new Date().toISOString(),
    tasksCompleted: 2156,
  },
  {
    id: 'doctor-ai',
    name: 'Doctor AI',
    nameAr: 'مساعد الأطباء',
    role: 'doctor',
    avatar: '👨‍⚕️',
    status: 'active',
    capabilities: ['appointments', 'diagnosis', 'referrals', 'patient-history'],
    lastActive: new Date().toISOString(),
    tasksCompleted: 4532,
  },
  {
    id: 'whatsapp-ai',
    name: 'WhatsApp AI',
    nameAr: 'واتساب',
    role: 'communication',
    avatar: '💬',
    status: 'active',
    capabilities: ['customer-support', 'order-updates', 'reminders', 'marketing'],
    lastActive: new Date().toISOString(),
    tasksCompleted: 12890,
  },
  {
    id: 'vision-ai',
    name: 'Vision AI',
    nameAr: 'الرؤية',
    role: 'vision',
    avatar: '👁️',
    status: 'idle',
    capabilities: ['ocr', 'prescription-reading', 'product-recognition', 'quality-check'],
    lastActive: new Date().toISOString(),
    tasksCompleted: 3456,
  },
]

const AIContext = createContext<AIContextType | undefined>(undefined)

export function AIProvider({ children }: { children: ReactNode }) {
  const [agents] = useState<AIAgent[]>(defaultAgents)
  const [memories, setMemories] = useState<AIMemory[]>([])
  const [events, setEvents] = useState<AIEvent[]>([])
  const [activeAgent, setActiveAgent] = useState<AIAgent | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const sendMessage = useCallback(async (message: string, context?: Record<string, unknown>) => {
    setIsProcessing(true)

    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Select best agent based on message content
    let selectedAgent = agents[0]
    const lowerMsg = message.toLowerCase()

    if (lowerMsg.includes('دواء') || lowerMsg.includes('وصفة') || lowerMsg.includes('جرعة')) {
      selectedAgent = agents.find(a => a.id === 'medical-ai') || agents[0]
    } else if (lowerMsg.includes('مخزون') || lowerMsg.includes('كمية') || lowerMsg.includes('طلبية')) {
      selectedAgent = agents.find(a => a.id === 'inventory-ai') || agents[0]
    } else if (lowerMsg.includes('سعر') || lowerMsg.includes('فاتورة') || lowerMsg.includes('ربح')) {
      selectedAgent = agents.find(a => a.id === 'finance-ai') || agents[0]
    } else if (lowerMsg.includes('طبيب') || lowerMsg.includes('حجز') || lowerMsg.includes('عيادة')) {
      selectedAgent = agents.find(a => a.id === 'doctor-ai') || agents[0]
    }

    setActiveAgent(selectedAgent)

    // Generate response based on agent
    const responses: Record<string, string> = {
      'medical-ai': `بناءً على تحليلي الطبي، أنصحك بالآتي:

١. التأكد من عدم وجود تداخلات دوائية
٢. مراجعة الجرعة المناسبة حسب العمر والوزن
٣. متابعة الأعراض الجانبية المحتملة

هل تريد مراجعة تفصيلية للوصفة الطبية؟`,
      'inventory-ai': `حالة المخزون الحالية:

• المنتجات المتوفرة: 2,847 صنف
• تنبيهات منخفضة: 12 صنف
• منتجات منتهية الصلاحية: 3 صنف
• طلبات الشراء المعلقة: 5

هل تريد إنشاء طلب شراء جديد؟`,
      'finance-ai': `التقرير المالي لليوم:

• الإيرادات: 1,250,000 ر.ي
• المصروفات: 780,000 ر.ي
• الربح الصافي: 470,000 ر.ي
• معدل الربح: 37.6%

الأداء أفضل من الأمس بنسبة 12%`,
      'doctor-ai': `جدول المواعيد اليوم:

• المواعيد المؤكدة: 24
• المواعيد المعلقة: 7
• الإلغاءات: 2
• متوسط وقت الانتظار: 15 دقيقة

هل تريد عرض تفاصيل موعد معين؟`,
      'ceo-ai': `تقرير الإدارة التنفيذية:

• إجمالي الطلبات: 156
• العملاء الجدد: 23
• معدل الرضا: 94.2%
• الأداء العام: ممتاز

التوصية: زيادة التسويق في منطقة الشيخ عثمان`,
    }

    const response = responses[selectedAgent.id] || `تم استلام رسالتك: "${message}"

أنا ${selectedAgent.nameAr}، وسأساعدك فيما تحتاج. يمكنك توضيح طلبك أكثر؟`

    // Save to memory
    const newMemory: AIMemory = {
      id: Date.now().toString(),
      type: 'short',
      content: `User: ${message} | AI: ${response}`,
      context: context || {},
      importance: 0.7,
      createdAt: new Date().toISOString(),
    }
    setMemories(prev => [newMemory, ...prev].slice(0, 100))

    // Create event
    const newEvent: AIEvent = {
      id: Date.now().toString(),
      type: 'AI_RESPONSE',
      payload: { message, response, agentId: selectedAgent.id },
      source: 'ai-chat',
      priority: 'medium',
      status: 'completed',
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
    }
    setEvents(prev => [newEvent, ...prev].slice(0, 500))

    setIsProcessing(false)
    return response
  }, [agents])

  const getAgentStatus = useCallback((agentId: string) => {
    return agents.find(a => a.id === agentId)
  }, [agents])

  const getRecentEvents = useCallback((limit = 10) => {
    return events.slice(0, limit)
  }, [events])

  return (
    <AIContext.Provider value={{
      agents,
      memories,
      events,
      activeAgent,
      isProcessing,
      sendMessage,
      getAgentStatus,
      getRecentEvents,
    }}>
      {children}
    </AIContext.Provider>
  )
}

export function useAI() {
  const context = useContext(AIContext)
  if (!context) throw new Error('useAI must be used within AIProvider')
  return context
}
