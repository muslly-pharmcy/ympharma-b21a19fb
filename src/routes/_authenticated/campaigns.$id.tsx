import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getCampaign } from '@/lib/campaigns.functions'

export const Route = createFileRoute('/_authenticated/campaigns/$id')({
  component: CampaignDetail,
  head: () => ({ meta: [{ title: 'حملة — MUSLLY' }] }),
  errorComponent: ({ error }) => <div className="p-6 text-red-500">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-6">غير موجود</div>,
})

function CampaignDetail() {
  const { id } = Route.useParams()
  const q = useQuery({ queryKey: ['campaign', id], queryFn: () => getCampaign({ data: { id } }) })

  if (q.isLoading) return <div className="p-6 text-slate-400">جارٍ التحميل...</div>
  if (!q.data) return <div className="p-6 text-slate-400">الحملة غير موجودة</div>
  const { campaign, recipients, events, stats } = q.data

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6 space-y-6">
      <Link to="/campaigns" className="text-sm text-slate-400 hover:text-slate-200">← الحملات</Link>
      <header>
        <h1 className="text-3xl font-bold">{campaign.name}</h1>
        <p className="text-sm text-slate-400 font-mono">{campaign.code} · {campaign.channel} · {campaign.status}</p>
      </header>

      <section className="grid md:grid-cols-6 gap-3">
        {[
          { label: 'الجمهور', value: campaign.audience_size },
          { label: 'إجمالي المستقبلين', value: stats.total },
          { label: 'مرسل', value: stats.sent, cls: 'text-emerald-300' },
          { label: 'مسلّم', value: stats.delivered, cls: 'text-blue-300' },
          { label: 'مفتوح', value: stats.opened, cls: 'text-purple-300' },
          { label: 'فشل', value: stats.failed, cls: 'text-red-300' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
            <div className="text-xs text-slate-400">{s.label}</div>
            <div className={`text-2xl font-bold ${s.cls ?? ''}`}>{s.value.toLocaleString('ar-EG')}</div>
          </div>
        ))}
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
          <h2 className="font-semibold mb-2">نص الرسالة</h2>
          <pre className="whitespace-pre-wrap text-sm text-slate-300 font-sans">{campaign.message_template}</pre>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
          <h2 className="font-semibold mb-2">أحدث الأحداث</h2>
          <ul className="text-xs space-y-1 max-h-64 overflow-auto">
            {events.slice(0, 25).map((e) => (
              <li key={e.id} className="text-slate-400">
                <span className="font-mono text-emerald-300">{e.kind}</span> · {new Date(e.occurred_at).toLocaleString('ar-EG')}
                {e.provider_ref && <span className="text-slate-500"> · {e.provider_ref}</span>}
              </li>
            ))}
            {events.length === 0 && <li className="text-slate-500">لا توجد أحداث بعد</li>}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
        <h2 className="font-semibold px-4 py-3 border-b border-white/10">المستقبِلون ({recipients.length})</h2>
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-slate-300">
            <tr>
              <th className="text-right px-4 py-2">العميل</th>
              <th className="text-right px-4 py-2">العنوان</th>
              <th className="text-right px-4 py-2">الحالة</th>
              <th className="text-right px-4 py-2">تاريخ الإرسال</th>
              <th className="text-right px-4 py-2">الخطأ</th>
            </tr>
          </thead>
          <tbody>
            {recipients.slice(0, 200).map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="px-4 py-2 font-mono text-xs text-slate-400">{r.customer_id.slice(0,8)}</td>
                <td className="px-4 py-2">{r.address ?? '—'}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    r.status === 'sent' ? 'bg-emerald-500/20 text-emerald-300' :
                    r.status === 'failed' ? 'bg-red-500/20 text-red-300' :
                    'bg-slate-500/20 text-slate-300'
                  }`}>{r.status}</span>
                </td>
                <td className="px-4 py-2 text-slate-400">{r.sent_at ? new Date(r.sent_at).toLocaleString('ar-EG') : '—'}</td>
                <td className="px-4 py-2 text-red-300 text-xs">{r.error ?? ''}</td>
              </tr>
            ))}
            {recipients.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">لا يوجد مستقبِلون بعد</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  )
}
