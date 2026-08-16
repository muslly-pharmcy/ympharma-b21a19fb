import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import {
  getStorefrontTelemetry,
  listBundleOrders,
  listPrescriptionUploads,
  listRefillSubscriptions,
  updateRequestStatus,
} from '@/lib/store-requests.admin.functions'

export const Route = createFileRoute('/_authenticated/admin/prescriptions')({
  head: () => ({
    meta: [
      { title: 'طلبات الوصفات والتعبئة — نواة الشمس' },
      { name: 'description', content: 'إدارة رفع الوصفات الطبية، تذكيرات التعبئة الشهرية، وطلبات الباقات الصحية.' },
      { property: 'og:title', content: 'طلبات الوصفات والتعبئة — نواة الشمس' },
      { property: 'og:description', content: 'لوحة إدارة طلبات العملاء الواردة من المتجر.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: AdminPrescriptions,
  errorComponent: ({ error }) => (
    <div dir="rtl" className="p-8 text-center text-destructive">{(error as Error).message}</div>
  ),
})

const STATUS_LABEL: Record<string, string> = {
  new: 'جديد',
  processing: 'قيد المعالجة',
  closed: 'مغلق',
}

function AdminPrescriptions() {
  const qc = useQueryClient()
  const rxFn = useServerFn(listPrescriptionUploads)
  const refillFn = useServerFn(listRefillSubscriptions)
  const bundleFn = useServerFn(listBundleOrders)
  const telemetryFn = useServerFn(getStorefrontTelemetry)
  const statusFn = useServerFn(updateRequestStatus)

  const rx = useQuery({ queryKey: ['admin-rx', 'uploads'], queryFn: () => rxFn() })
  const refills = useQuery({ queryKey: ['admin-rx', 'refills'], queryFn: () => refillFn() })
  const bundles = useQuery({ queryKey: ['admin-rx', 'bundles'], queryFn: () => bundleFn() })
  const telemetry = useQuery({ queryKey: ['admin-rx', 'telemetry'], queryFn: () => telemetryFn() })

  const setStatus = useMutation({
    mutationFn: (v: { table: 'prescription' | 'refill' | 'bundle'; id: string; status: string }) =>
      statusFn({ data: v }),
    onSuccess: () => {
      toast.success('تم تحديث الحالة')
      void qc.invalidateQueries({ queryKey: ['admin-rx'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const t = telemetry.data

  return (
    <div dir="rtl" className="mx-auto w-full max-w-6xl space-y-8 p-4 md:p-8">
      <header className="glass-panel rounded-3xl p-6">
        <h1 className="text-2xl font-bold text-foreground">طلبات المتجر — الوصفات والتعبئة والباقات</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          كل ما يرسله العملاء من المتجر العام يصل هنا، ويُزامَن مع Google Sheets والتقرير التنفيذي اليومي.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="وصفات جديدة" value={t?.pendingPrescriptions ?? 0} />
        <Stat label="تذكيرات تعبئة" value={t?.activeRefills ?? 0} />
        <Stat label="طلبات باقات" value={t?.bundleOrders ?? 0} />
        <Stat label="تفاعلات المساعد (24س)" value={t?.assistantMessages ?? 0} />

      </section>

      <Panel title="الوصفات المرفوعة">
        <table className="w-full text-right text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="p-2">الاسم</th>
              <th className="p-2">الهاتف</th>
              <th className="p-2">الملف</th>
              <th className="p-2">الحالة</th>
              <th className="p-2">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {(rx.data ?? []).map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="p-2">{row.full_name}</td>
                <td className="p-2">{row.phone}</td>
                <td className="p-2">
                  {row.signedUrl ? (
                    <a href={row.signedUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      عرض
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="p-2">{STATUS_LABEL[row.status] ?? row.status}</td>
                <td className="p-2">
                  <StatusButtons
                    current={row.status}
                    onSet={(status) => setStatus.mutate({ table: 'prescription', id: row.id, status })}
                  />
                </td>
              </tr>
            ))}
            {!rx.isLoading && (rx.data ?? []).length === 0 && <Empty cols={5} />}
          </tbody>
        </table>
      </Panel>

      <Panel title="تذكيرات إعادة التعبئة">
        <table className="w-full text-right text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="p-2">الاسم</th>
              <th className="p-2">الهاتف</th>
              <th className="p-2">الدواء</th>
              <th className="p-2">الحالة</th>
              <th className="p-2">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {(refills.data ?? []).map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="p-2">{row.full_name}</td>
                <td className="p-2">{row.phone}</td>
                <td className="p-2">{row.product_name ?? row.condition_tag ?? '—'}</td>
                <td className="p-2">{STATUS_LABEL[row.status] ?? row.status}</td>
                <td className="p-2">
                  <StatusButtons
                    current={row.status}
                    onSet={(status) => setStatus.mutate({ table: 'refill', id: row.id, status })}
                  />
                </td>
              </tr>
            ))}
            {!refills.isLoading && (refills.data ?? []).length === 0 && <Empty cols={5} />}
          </tbody>
        </table>
      </Panel>

      <Panel title="طلبات الباقات الصحية">
        <table className="w-full text-right text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="p-2">الاسم</th>
              <th className="p-2">الهاتف</th>
              <th className="p-2">الباقة</th>
              <th className="p-2">الحالة</th>
              <th className="p-2">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {(bundles.data ?? []).map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="p-2">{row.full_name}</td>
                <td className="p-2">{row.phone}</td>
                <td className="p-2">{row.bundle_title}</td>
                <td className="p-2">{STATUS_LABEL[row.status] ?? row.status}</td>
                <td className="p-2">
                  <StatusButtons
                    current={row.status}
                    onSet={(status) => setStatus.mutate({ table: 'bundle', id: row.id, status })}
                  />
                </td>
              </tr>
            ))}
            {!bundles.isLoading && (bundles.data ?? []).length === 0 && <Empty cols={5} />}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="overflow-x-auto rounded-2xl border border-border">{children}</div>
    </section>
  )
}

function Empty({ cols }: { cols: number }) {
  return (
    <tr>
      <td className="p-4 text-center text-muted-foreground" colSpan={cols}>
        لا توجد طلبات بعد
      </td>
    </tr>
  )
}

function StatusButtons({ current, onSet }: { current: string; onSet: (s: string) => void }) {
  return (
    <div className="flex gap-1">
      {(['new', 'processing', 'closed'] as const).map((s) => (
        <button
          key={s}
          onClick={() => onSet(s)}
          disabled={current === s}
          className="rounded-lg border border-border px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-40"
        >
          {STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-card rounded-2xl border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
    </div>
  )
}
