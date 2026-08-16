import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listSuppliers } from '@/lib/suppliers.functions'
import { Building2 } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/suppliers')({
  head: () => ({
    meta: [
      { title: 'الموردون — MUSLLY AI OS' },
      { name: 'description', content: 'قائمة الموردين المعتمدين.' },
    ],
  }),
  component: SuppliersPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-red-600">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">غير موجود</div>,
})

function SuppliersPage() {
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', 'list'],
    queryFn: () => listSuppliers(),
  })
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">الموردون</h1>
      {suppliers.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl p-12 text-center">
          <Building2 className="h-12 w-12 text-gray-400" />
          <p className="text-lg font-medium">لا يوجد موردون ظاهرون</p>
          <p className="max-w-md text-sm text-muted-foreground">
            الموردون محميون بسياسات RLS على مستوى المؤسسة. سجّل الدخول بحساب عضو
            في المؤسسة لعرضهم.
          </p>
        </div>
      ) : (
        <ul className="glass-panel divide-y divide-gray-100 rounded-2xl">
          {suppliers.map((s) => (
            <li key={s.id} className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">{s.name}</p>
                {s.legal_name && (
                  <p className="text-xs text-muted-foreground">{s.legal_name}</p>
                )}
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                {s.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
