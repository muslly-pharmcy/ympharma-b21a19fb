import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listWarehouses } from '@/lib/inventory.functions'
import { Warehouse as WarehouseIcon } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/warehouses')({
  head: () => ({
    meta: [
      { title: 'المستودعات — MUSLLY AI OS' },
      { name: 'description', content: 'قائمة المستودعات الفعّالة وحالتها.' },
    ],
  }),
  component: WarehousesPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-red-600">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">غير موجود</div>,
})

function WarehousesPage() {
  const { data: warehouses = [] } = useQuery({
    queryKey: ['inventory', 'warehouses'],
    queryFn: () => listWarehouses(),
  })
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">المستودعات</h1>
      {warehouses.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl p-12 text-center">
          <WarehouseIcon className="h-12 w-12 text-gray-400" />
          <p className="text-lg font-medium">لا توجد مستودعات ظاهرة</p>
          <p className="max-w-md text-sm text-muted-foreground">
            المستودعات محمية بسياسات RLS على مستوى المؤسسة. سجّل الدخول بحساب عضو
            في المؤسسة لعرضها.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((w) => (
            <div key={w.id} className="glass-panel rounded-2xl p-5">
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <WarehouseIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{w.name}</p>
                  <p className="text-xs text-muted-foreground">{w.code}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">النوع: {w.kind}</p>
              {w.address && <p className="mt-1 text-xs text-muted-foreground">{w.address}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
