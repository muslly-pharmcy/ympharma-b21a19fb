import { createFileRoute } from '@tanstack/react-router'
import AIChat from '@/pages/AIChat'

export const Route = createFileRoute('/ai-chat')({
  component: AIChat,
})
