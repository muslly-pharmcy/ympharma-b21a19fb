import { createFileRoute, redirect } from '@tanstack/react-router'
import PlanetPage from '@/pages/PlanetPage'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/planet/$planetId')({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) {
      throw redirect({ to: '/auth', search: { redirect: location.href } })
    }

    const [{ data: isAdmin }, { data: isOwner }] = await Promise.all([
      supabase.rpc('has_role', { _user_id: data.user.id, _role: 'admin' }),
      supabase.rpc('has_role', { _user_id: data.user.id, _role: 'owner' }),
    ])
    if (!isAdmin && !isOwner) throw redirect({ to: '/' })
  },
  component: PlanetPage,
})
