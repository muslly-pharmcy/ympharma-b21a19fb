import { createFileRoute, redirect } from '@tanstack/react-router'

// /admin → product & stock management page.
export const Route = createFileRoute('/_authenticated/admin/')({
  beforeLoad: () => {
    throw redirect({ to: '/admin-inventory' })
  },
})
