import { createFileRoute } from '@tanstack/react-router'
import MissionControl from '@/pages/MissionControl'

export const Route = createFileRoute('/mission-control')({
  head: () => ({
    meta: [
      { title: 'لوحة العمليات — صيدلية المصلي' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: MissionControl,
})
