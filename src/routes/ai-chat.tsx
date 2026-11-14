import { createFileRoute } from '@tanstack/react-router'
import AIChat from '@/pages/AIChat'

export const Route = createFileRoute('/ai-chat')({
  head: () => ({
    meta: [
      { title: 'مساعد صيدلية المصلي الذكي — عدن' },
      { name: 'description', content: 'مساعد تفاعلي للمعلومات الدوائية العامة، وليس بديلاً عن استشارة الصيدلي.' },
      { name: 'robots', content: 'noindex, follow' },
    ],
  }),
  component: AIChat,
})
