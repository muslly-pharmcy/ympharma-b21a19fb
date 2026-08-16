import { createFileRoute } from '@tanstack/react-router'
import MissionControl from '@/pages/MissionControl'

export const Route = createFileRoute('/mission-control')({
  component: MissionControl,
})
