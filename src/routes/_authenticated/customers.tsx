import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { listCustomers } from '@/lib/customers.functions'
import { createCustomer } from '@/lib/customers.mutations.functions'


export const Route = createFileRoute('/_authenticated/customers')({
  component: CustomersPage,
  head: () => ({ meta: [{ title: 'العملاء — MUSLLY' }] }),
  errorComponent: ({ error }) => (
    <div className="p-6 text-red-500">فشل التحميل: {(error as Error).message}</div>
  ),
  notFoundComponent: () => <div className="p-6">غير موجود</div>,
})

function CustomersPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'active' | 'archived' | 'all'>('active')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ full_name: '', phone: '', email: '' })

  const q = useQuery({
    queryKey: ['customers', status, search],
    queryFn: () => listCustomers({ data: { search, status } }),
  })
  const create = useServerFn(createCustomer)
  const mut = useMutation({
    mutationFn: async () => create({ data: {
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      idempotencyKey: crypto.randomUUID(),
    } }),
    onSuccess: () => {
      setShowNew(false)
      setForm({ full_name: '', phone: '', email: '' })
      q.refetch()
    },
  })

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">👥 العملاء</h1>
          <p className="text-sm text-slate-400">CRM Core — Shipment D1</p>
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2"
        >
          {showNew ? 'إلغاء' : '+ عميل جديد'}
        </button>
      </header>

      {showNew && (
        <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-4 space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="الاسم الكامل *" className="rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2" />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="الهاتف" className="rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2" />
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="البريد" className="rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2" />
          </div>
          {mut.isError && <div className="text-red-300 text-sm">{(mut.error as Error).message}</div>}
          <button
            disabled={!form.full_name.trim() || mut.isPending}
            onClick={() => mut.mutate()}
            className="rounded-lg bg-emerald-500 disabled:opacity-40 text-slate-950 font-semibold px-4 py-2"
          >
            {mut.isPending ? 'جارٍ الإنشاء...' : 'إنشاء'}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم/الهاتف/البريد/الكود..."
          className="flex-1 min-w-[200px] rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'archived' | 'all')}
          className="rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2">
          <option value="active">النشطون</option>
          <option value="archived">المؤرشفون</option>
          <option value="all">الكل</option>
        </select>
      </div>

      {q.isLoading && <p className="text-slate-400">جارٍ التحميل...</p>}
      {q.isError && <p className="text-red-400">فشل: {(q.error as Error).message}</p>}

      <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-slate-300">
            <tr>
              <th className="text-right px-4 py-2">الكود</th>
              <th className="text-right px-4 py-2">الاسم</th>
              <th className="text-right px-4 py-2">الهاتف</th>
              <th className="text-right px-4 py-2">البريد</th>
              <th className="text-right px-4 py-2">الحالة</th>
              <th className="text-right px-4 py-2">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((c) => (
              <tr key={c.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-4 py-2 font-mono text-emerald-300">
                  <Link to="/customers/$customerId" params={{ customerId: c.id }}>{c.code}</Link>
                </td>
                <td className="px-4 py-2">{c.full_name}</td>
                <td className="px-4 py-2">{c.phone ?? '—'}</td>
                <td className="px-4 py-2">{c.email ?? '—'}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    c.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' :
                    c.status === 'archived' ? 'bg-slate-500/20 text-slate-300' :
                    'bg-amber-500/20 text-amber-300'
                  }`}>{c.status}</span>
                </td>
                <td className="px-4 py-2 text-slate-400">{new Date(c.created_at).toLocaleDateString('ar-EG')}</td>
              </tr>
            ))}
            {(q.data ?? []).length === 0 && !q.isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">لا يوجد عملاء</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
